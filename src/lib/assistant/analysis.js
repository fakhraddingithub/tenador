import { compileQuery, assert, plain, timeRange } from './validation.js';
import { hasOwn, LIMITS } from './catalog.js';

// These pipelines are authored by the server. The model never supplies Mongo stages or code.
function viewStages(definition) {
  if (definition.view === 'checks') return [
    { $unwind: '$checks' },
    { $project: { _id: '$checks._id', installment: '$_id', order: 1, createdAt: 1, amount: '$checks.amount', dueDate: '$checks.dueDate', paidAt: '$checks.paidAt', status: '$checks.status', reviewedAt: '$checks.reviewedAt' } },
  ];
  if (definition.view === 'orderItems') return [
    { $unwind: '$items' },
    { $project: { _id: '$items._id', order: '$_id', user: 1, trackingCode: 1, createdAt: 1, fulfillmentStatus: 1, product: '$items.product', usedProduct: '$items.usedProduct', quantity: '$items.quantity', unitPrice: '$items.unitPrice', priceEUR: '$items.priceEUR', procurementStatus: '$items.procurementStatus', lineTotal: { $multiply: ['$items.quantity', '$items.unitPrice'] }, lineTotalEUR: { $multiply: ['$items.quantity', '$items.priceEUR'] } } },
  ];
  if (definition.view === 'euroPayments') return [
    { $unwind: '$paymentsEUR' },
    { $project: { _id: '$paymentsEUR._id', order: '$_id', user: 1, trackingCode: 1, createdAt: 1, fulfillmentStatus: 1, amount: '$paymentsEUR.amount', confirmedAt: '$paymentsEUR.confirmedAt' } },
  ];
  return [];
}

export function datasetStages(definition) {
  const stages = viewStages(definition);
  if (definition.relation) {
    const r = definition.relation;
    // All target names are fixed, real collection names from RELATIONS, never raw model output.
    stages.push({ $lookup: { from: r.target, localField: r.local, foreignField: '_id', as: 'related',
      pipeline: [{ $project: Object.fromEntries(Object.keys(r.fields).map(f => [f, 1])) }] } });
    stages.push({ $unwind: { path: '$related', preserveNullAndEmptyArrays: true } });
  }
  return stages;
}

export function compileAnalysis(input, permissions, toId) {
  // Reuse the exact same field/permission/type guards as ordinary reads.
  const q = compileQuery({ ...input, operation: 'list', groupBy: '', metric: '' }, permissions, toId);
  const fields = q.definition.fields;
  const metrics = input.metrics ?? [{ op: 'count' }];
  assert(Array.isArray(metrics) && metrics.length > 0 && metrics.length <= 4);
  const group = { _id: null };
  metrics.forEach((m, i) => {
    assert(plain(m) && ['count', 'sum', 'avg', 'min', 'max', 'distinct'].includes(m.op));
    if (m.op === 'count') { group[`m${i}`] = { $sum: 1 }; return; }
    assert(hasOwn(fields, m.field));
    if (m.op === 'distinct') { group[`m${i}`] = { $addToSet: `$${m.field}` }; return; }
    assert(fields[m.field] === 'number');
    group[`m${i}`] = { [`$${m.op}`]: `$${m.field}` };
    // Report missing numeric values instead of claiming missing data equals zero.
    group[`valid${i}`] = { $sum: { $cond: [{ $isNumber: `$${m.field}` }, 1, 0] } };
  });
  const projection = { _id: 1 };
  metrics.forEach((m, i) => {
    projection[`m${i}`] = m.op === 'distinct' ? { $size: { $setDifference: [`$m${i}`, [null]] } } : 1;
    if (!['count', 'distinct'].includes(m.op)) projection[`valid${i}`] = 1;
  });
  const groupBy = input.groupBy || '';
  let groupId = null;
  if (groupBy) {
    assert(hasOwn(fields, groupBy));
    if (fields[groupBy] === 'date') {
      assert(['day', 'week', 'month', 'year'].includes(input.bucket));
      groupId = { $dateTrunc: { date: `$${groupBy}`, unit: input.bucket, timezone: 'Asia/Tehran', ...(input.bucket === 'week' ? { startOfWeek: 'saturday' } : {}) } };
    } else { assert(!input.bucket); groupId = `$${groupBy}`; }
  } else assert(!input.bucket);
  const sortMetric = input.sortMetric ?? 0;
  assert(Number.isInteger(sortMetric) && sortMetric >= 0 && sortMetric < metrics.length);
  const periods = input.periods ?? [];
  assert(Array.isArray(periods) && periods.length <= 2);
  if (periods.length) assert(hasOwn(fields, input.dateField) && fields[input.dateField] === 'date');
  const windows = periods.length ? periods.map(p => {
    assert(plain(p));
    const range = timeRange('custom', p.from, p.to);
    return { from: range.from.toISOString(), to: range.to.toISOString() };
  }) : [null];
  const stats = [{ $group: group }, { $project: projection }];
  const facet = {};
  windows.forEach((window, i) => {
    const match = window ? [{ $match: { [input.dateField]: { $gte: new Date(window.from), $lt: new Date(window.to) } } }] : [];
    facet[`total${i}`] = [...match, ...stats];
    if (groupBy) {
      const groups = [...match, { $group: { ...group, _id: groupId } }, { $project: projection }];
      facet[`rows${i}`] = [...groups, { $sort: { [`m${sortMetric}`]: input.direction ?? -1, _id: 1 } }, { $limit: q.limit }];
      facet[`groups${i}`] = [...match, { $group: { _id: groupId } }, { $count: 'count' }];
    }
  });
  return { q, metrics, groupBy, windows, pipeline: [...datasetStages(q.definition), { $match: q.filter }, { $facet: facet }] };
}

export function analysisResult(compiled, output) {
  const { metrics, windows, groupBy } = compiled;
  const values = (row = {}) => metrics.map((m, i) => ({ op: m.op, field: m.field || null,
    value: row[`m${i}`] ?? (['count', 'distinct'].includes(m.op) ? 0 : null),
    ...(!['count', 'distinct'].includes(m.op) ? { validValues: row[`valid${i}`] || 0 } : {}),
  }));
  const periods = windows.map((window, i) => ({ window, totals: values(output[`total${i}`]?.[0]),
    ...(groupBy ? { totalGroups: output[`groups${i}`]?.[0]?.count || 0, rows: (output[`rows${i}`] || []).map(r => ({ group: typeof r._id === 'string' ? r._id.slice(0,180) : r._id, metrics: values(r) })) } : {}),
  }));
  const comparison = periods.length === 2 ? metrics.map((m, i) => {
    const a = periods[0].totals[i], b = periods[1].totals[i];
    const valid = Number.isFinite(a.value) && Number.isFinite(b.value) && (a.validValues === undefined || (a.validValues > 0 && b.validValues > 0));
    return { metric: i, difference: valid ? b.value - a.value : null, percentChange: valid && a.value !== 0 ? (b.value - a.value) / Math.abs(a.value) * 100 : null };
  }) : undefined;
  return { dataset: compiled.q.dataset, groupBy, periods, comparison, note: compiled.q.definition.note,
    interpretation: `Totals cover all matches, grouped rows are top ${LIMITS.rows} samples. Comparison is second period minus first. Missing numeric values are excluded; validValues=0 means unknown, not zero. Date buckets use Gregorian calendar in Tehran; month is NOT Persian month. No cost data means no profit calculation.` };
}
