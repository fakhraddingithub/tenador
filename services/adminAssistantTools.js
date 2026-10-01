import 'base/models/registerModels';
import mongoose from 'mongoose';
import { DATASETS, LIMITS, recordPath } from '../src/lib/assistant/catalog.js';
import { AssistantError, assert, compileQuery, escapeRegex, text, timeRange } from '../src/lib/assistant/validation.js';
import { canAccessAdminRoute } from '../src/lib/permissions.js';
import { datasetStages, compileAnalysis, analysisResult } from '../src/lib/assistant/analysis.js';

const MAX_MS = 5000;
const oid = (value) => new mongoose.Types.ObjectId(value);
const safeString = (value) => String(value ?? '').slice(0, 180);
const aggregate = (model, pipeline) => mongoose.model(model).aggregate(pipeline).option({ maxTimeMS: MAX_MS });

function source(permissions, title, href, fallback) {
  const path = canAccessAdminRoute(permissions, href) ? href : fallback;
  return path && canAccessAdminRoute(permissions, path) ? { title: safeString(title), href: path } : null;
}
function recordSource(name, row, permissions) {
  const d = DATASETS[name];
  const title = row.name || row.title || row.subject || row.trackingCode || `${d.title} ${String(row._id).slice(-6)}`;
  return source(permissions, title, recordPath(name, row), d.path);
}
function cleanRows(rows) {
  const clean = (value) => {
    if (typeof value === 'string') return safeString(value);
    if (Array.isArray(value)) return value.map(clean);
    if (value && Object.getPrototypeOf(value) === Object.prototype) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item)]));
    return value;
  };
  return rows.map(clean);
}

export async function queryData(input, permissions) {
  const q = compileQuery(input, permissions, oid);
  const prefix = [...datasetStages(q.definition), { $match: q.filter }];
  const baseSource = source(permissions, q.definition.title, q.definition.path);
  if (q.operation === 'count') {
    const rows = await aggregate(q.definition.model, [...prefix, { $count: 'count' }]);
    return { data: { dataset: q.dataset, count: rows[0]?.count || 0 }, sources: [baseSource].filter(Boolean) };
  }
  if (q.operation === 'sum') {
    const rows = await aggregate(q.definition.model, [...prefix, { $group: { _id: null, count: { $sum: 1 }, value: { $sum: `$${q.metric}` } } }, { $project: { _id: 0 } }]);
    return { data: { dataset: q.dataset, metric: q.metric, ...(rows[0] || { count: 0, value: 0 }) }, sources: [baseSource].filter(Boolean) };
  }
  if (q.operation === 'group') {
    const rows = await aggregate(q.definition.model, [...prefix,
      { $group: { _id: `$${q.groupBy}`, count: { $sum: 1 }, ...(q.metric ? { value: { $sum: `$${q.metric}` } } : {}) } },
      { $sort: { [q.metric ? 'value' : 'count']: q.sort[Object.keys(q.sort)[0]], _id: 1 } },
      { $facet: { rows: [{ $limit: q.limit }], totalGroups: [{ $count: 'count' }] } },
    ]);
    return { data: { dataset: q.dataset, groupBy: q.groupBy, metric: q.metric, rows: cleanRows(rows[0].rows), totalGroups: rows[0].totalGroups[0]?.count || 0 }, sources: [baseSource].filter(Boolean) };
  }
  const rows = await aggregate(q.definition.model, [...prefix, { $facet: {
    rows: [{ $sort: q.sort }, { $limit: q.limit }, { $project: Object.fromEntries(Object.keys(q.definition.fields).map((f) => [f, 1])) }],
    total: [{ $count: 'count' }],
  } }]);
  const result = rows[0];
  return { data: { dataset: q.dataset, total: result.total[0]?.count || 0, shown: result.rows.length, rows: cleanRows(result.rows), note: q.definition.note }, sources: result.rows.map((row) => recordSource(q.dataset, row, permissions)).filter(Boolean) };
}

// Expand primary AND related mutations; successful created resources are counted once.
// Never count authz.granted/attempted as a product creation.
export function activityPipeline({ match, action, resourceType, limit = LIMITS.rows }) {
  return [
    { $match: { ...match, result: 'success' } },
    { $project: {
      actorAdmin: 1, actorUser: 1, actorSnapshot: 1, createdAt: 1,
      events: { $concatArrays: [[{ action: '$action', type: '$resourceType', id: '$resourceId', label: '$resourceLabel' }],
        { $map: { input: { $ifNull: ['$related', []] }, as: 'r', in: { action: '$$r.action', type: '$$r.type', id: '$$r.id', label: '$$r.label' } } }] },
    } },
        { $unwind: '$events' },
        { $match: { 'events.action': action, 'events.type': resourceType, 'events.id': { $type: 'string', $ne: '' } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: { actor: { $ifNull: ['$actorAdmin', '$actorUser'] }, resource: '$events.id' }, actorName: { $first: '$actorSnapshot.name' }, label: { $first: '$events.label' }, date: { $first: '$createdAt' } } },
        { $facet: {
          total: [{ $count: 'count' }],
          totalActors: [{ $group: { _id: '$_id.actor' } }, { $count: 'count' }],
          byActor: [{ $group: { _id: '$_id.actor', name: { $first: '$actorName' }, count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: limit }],
          records: [{ $sort: { date: -1, '_id.resource': 1 } }, { $limit: limit }],
        } },
  ];
}

async function resolveActor(actor) {
  const term = text(actor, 100);
  if (!term) return null;
  const isId = /^[a-f\d]{24}$/i.test(term);
  const rx = { $regex: escapeRegex(term), $options: 'i' };
  const admins = await mongoose.model('Admin').find(isId ? { _id: oid(term) } : { $or: [{ name: rx }, { username: rx }] })
    .select('_id user name username').limit(9).maxTimeMS(MAX_MS).lean();
  if (admins.length === 1) return { match: { $or: [{ actorAdmin: admins[0]._id }, ...(admins[0].user ? [{ actorUser: admins[0].user }] : [])] }, name: admins[0].name };
  if (admins.length > 1) return { candidates: admins.map((a) => ({ id: a._id, name: a.name, username: a.username })) };
  // Historical identity is retained even after a rename or a removed membership.
  const snapshots = await aggregate('AdminActivity', [
    { $match: isId ? { $or: [{ actorAdmin: oid(term) }, { actorUser: oid(term) }] } : { $or: [{ 'actorSnapshot.name': rx }, { 'actorSnapshot.username': rx }] } },
    { $group: { _id: { $ifNull: ['$actorAdmin', '$actorUser'] }, name: { $first: '$actorSnapshot.name' } } }, { $limit: 9 },
  ]);
  if (snapshots.length === 1 && snapshots[0]._id) return { match: { $or: [{ actorAdmin: snapshots[0]._id }, { actorUser: snapshots[0]._id }] }, name: snapshots[0].name };
  return { candidates: snapshots.map((a) => ({ id: a._id, name: a.name })) };
}

async function activity(input, permissions, now) {
  const types = { product: 'Product', order: 'Order', article: 'Article', user: 'User', usedProduct: 'UsedProduct', ticket: 'Ticket', category: 'Category', brand: 'Brand' };
  const entity = input.entity || 'product';
  assert(Object.hasOwn(types, entity));
  const operation = input.operation || 'create';
  assert(['create', 'update', 'delete'].includes(operation));
  const range = timeRange(input.range || 'today', input.from, input.to, now);
  const actor = await resolveActor(input.actor || '');
  if (actor?.candidates) return { data: { clarification: actor.candidates.length ? 'چند ادمین پیدا شد؛ نام کاربری یا شناسه را مشخص کنید.' : 'ادمین با این نام پیدا نشد؛ نام یا نام کاربری دقیق را بپرس.', candidates: actor.candidates }, sources: [] };
  const match = { ...actor?.match, createdAt: { $gte: range.from, $lt: range.to } };
  const [results, coverage] = await Promise.all([
    aggregate('AdminActivity', activityPipeline({ match, action: `${entity}.${operation}`, resourceType: types[entity] })),
    aggregate('AdminActivity', [{ $match: { $and: [match, { result: 'success' }, { $or: [{ 'metadata.relatedOmitted': { $gt: 0 } }, { 'metadata.droppedEvents': { $gt: 0 } }] }] } }, { $limit: 1 }, { $project: { _id: 1 } }]),
  ]);
  const grouped = results[0];
  const sources = [];
  const datasetName = Object.keys(DATASETS).find((k) => DATASETS[k].model === types[entity]);
  for (const record of grouped?.records || []) {
    if (datasetName) sources.push(recordSource(datasetName, { _id: record._id.resource, name: record.label }, permissions));
  }
  return { data: {
    source: 'AdminActivity', entity, operation, actor: actor?.name || 'all',
    from: range.from.toISOString(), toExclusive: range.to.toISOString(), timezone: 'Asia/Tehran',
    count: grouped?.total[0]?.count || 0, byActor: cleanRows(grouped?.byActor || []),
    totalActors: grouped?.totalActors[0]?.count || 0,
    actorsShown: grouped?.byActor.length || 0,
    incomplete: coverage.length > 0,
    note: 'Count of DISTINCT resources per actor in recorded successful events, not all historical work. Always say «طبق فعالیت‌های ثبت‌شده». Specialized update actions are not included in generic update. If incomplete=true, count is only a lower bound.',
  }, sources: sources.filter(Boolean) };
}

export async function executeAssistantTool(input, permissions, now = new Date()) {
  assert(input && typeof input === 'object' && !Array.isArray(input));
  const allowed = new Set(permissions);
  if (input.tool === 'query') return queryData(input, permissions);
  if (input.tool === 'analyze') {
    const compiled = compileAnalysis(input, permissions, oid);
    const rows = await aggregate(compiled.q.definition.model, compiled.pipeline);
    return { data: analysisResult(compiled, rows[0] || {}), sources: [source(permissions, compiled.q.definition.title, compiled.q.definition.path)].filter(Boolean) };
  }
  if (input.tool === 'activity') {
    if (!allowed.has('admins.viewActivity')) throw new AssistantError('مجوز مشاهدهٔ فعالیت ادمین‌ها لازم است.', 403);
    return activity(input, permissions, now);
  }
  if (input.tool === 'finance') {
    if (!allowed.has('analytics.view')) throw new AssistantError('مجوز مشاهدهٔ گزارش مالی لازم است.', 403);
    const range = timeRange(input.range || 'last30days', input.from, input.to, now);
    const currency = input.currency || 'IRT';
    assert(['IRT', 'EUR'].includes(currency));
    const { computeAssistantFinancialSummary } = await import('./analyticsService.js');
    const data = await computeAssistantFinancialSummary({ from: range.from, to: new Date(+range.to - 1), currency });
    return { data: { ...data, note: 'Revenue=non-cancelled order totals; collected=capped paid payments+cleared checks; outstanding=revenue-collected. Date filter is order creation, not payment date. EUR is independently recorded, never converted.' }, sources: [{ title: 'گزارش مالی', href: '/p-admin/financial/analytics' }] };
  }
  throw new AssistantError('ابزار ناشناخته است.');
}
