import { DATASETS, LIMITS, hasOwn } from './catalog.js';

export class AssistantError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function assert(condition, message = 'درخواست ابزار نامعتبر است.') {
  if (!condition) throw new AssistantError(message);
}
export function text(value, max = 150) {
  assert(typeof value === 'string' && value.length <= max);
  return value.trim();
}
export const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateChat(body) {
  assert(plain(body), 'بدنهٔ درخواست نامعتبر است.');
  const message = text(body.message, LIMITS.message);
  assert(message.length > 0, 'سؤال را وارد کنید.');
  const history = body.history ?? [];
  assert(Array.isArray(history) && history.length <= LIMITS.history, 'تاریخچه بیش از حد طولانی است.');
  const clean = history.map((m) => {
    assert(plain(m) && ['user', 'assistant'].includes(m.role));
    return { role: m.role, content: text(m.content, LIMITS.message) };
  });
  assert(clean.reduce((n, m) => n + m.content.length, 0) <= LIMITS.historyChars);
  return { message, history: clean };
}

export function tehranDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const p = Object.fromEntries(parts.map((v) => [v.type, v.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function isoDate(value) {
  assert(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value), 'تاریخ باید ISO و دارای منطقهٔ زمانی باشد.');
  const date = new Date(value);
  assert(Number.isFinite(date.getTime()), 'تاریخ نامعتبر است.');
  return date;
}
export function timeRange(range = 'today', from = '', to = '', now = new Date()) {
  if (range === 'custom') {
    const start = isoDate(from), end = isoDate(to);
    assert(start < end && end - start <= 366 * 86400000, 'بازه باید حداکثر یک سال و پایان آن پس از شروع باشد.');
    return { from: start, to: end };
  }
  assert(['today', 'yesterday', 'last7days', 'last30days'].includes(range));
  const start = new Date(`${tehranDay(now)}T00:00:00+03:30`);
  if (range === 'yesterday') return { from: new Date(+start - 86400000), to: start };
  const days = range === 'last7days' ? 6 : range === 'last30days' ? 29 : 0;
  return { from: new Date(+start - days * 86400000), to: now };
}

export function compileQuery(input, permissions, toId = (value) => value) {
  assert(plain(input) && hasOwn(DATASETS, input.dataset));
  const d = DATASETS[input.dataset];
  if (!new Set(permissions).has(d.permission)) throw new AssistantError('دسترسی به این بخش مجاز نیست.', 403);
  const operation = input.operation;
  assert(['list', 'count', 'sum', 'group'].includes(operation));
  const filters = input.filters ?? [];
  assert(Array.isArray(filters) && filters.length <= LIMITS.filters);
  const clauses = filters.map((filter) => {
    assert(plain(filter) && hasOwn(d.fields, filter.field));
    const { field, op } = filter;
    const type = d.fields[field];
    assert(['eq', 'ne', 'contains', 'gte', 'lt'].includes(op));
    assert(typeof filter.value === 'string');
    let value = text(filter.value, 120);
    if (type === 'id') { assert(/^[a-f\d]{24}$/i.test(value)); value = toId(value); }
    if (type === 'number') { assert(value !== '' && Number.isFinite(Number(value))); value = Number(value); }
    if (type === 'boolean') { assert(['true', 'false'].includes(value)); value = value === 'true'; }
    if (type === 'date') value = isoDate(value);
    if (op === 'contains') { assert(type === 'text' && value.length >= 2); return { [field]: { $regex: escapeRegex(value), $options: 'i' } }; }
    if (['gte', 'lt'].includes(op)) assert(['number', 'date'].includes(type));
    return { [field]: { [{ eq: '$eq', ne: '$ne', gte: '$gte', lt: '$lt' }[op]]: value } };
  });
  if (input.dataset === 'articles') clauses.push({ deletedAt: null });
  const filter = clauses.length ? { $and: clauses } : {};
  const limit = input.limit ?? LIMITS.rows;
  assert(Number.isInteger(limit) && limit >= 1 && limit <= LIMITS.rows);
  const metric = input.metric || '';
  if (operation === 'sum' || (operation === 'group' && metric)) assert(hasOwn(d.fields, metric) && d.fields[metric] === 'number');
  const groupBy = input.groupBy || '';
  if (operation === 'group') assert(hasOwn(d.fields, groupBy) && d.fields[groupBy] !== 'date');
  const sortBy = input.sortBy || 'createdAt';
  assert(hasOwn(d.fields, sortBy));
  const direction = input.direction ?? -1;
  assert([1, -1].includes(direction));
  return { dataset: input.dataset, definition: d, operation, filter, metric, groupBy, limit, sort: { [sortBy]: direction, ...(sortBy === '_id' ? {} : { _id: direction }) } };
}

export async function readChatBody(request) {
  const reader = request.body?.getReader();
  assert(reader, 'درخواست خالی است.');
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LIMITS.bodyBytes) { await reader.cancel(); throw new AssistantError('درخواست بیش از حد بزرگ است.', 413); }
      chunks.push(Buffer.from(value));
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AssistantError('JSON نامعتبر است.'); }
    return validateChat(body);
  } finally { reader.releaseLock(); }
}
