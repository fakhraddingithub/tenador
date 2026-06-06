// ابزار پیمایش گراف فرایند سفارش
// نودها و لبه‌ها یک گراف جهت‌دار بدون دور (DAG) می‌سازند که در پنل ادمین تعریف شده.
// این توابع گراف را به یک دنباله‌ی مرحله‌به‌مرحله برای نمایش به مشتری تبدیل می‌کنند.

// نقشه‌ی نود بر اساس id برای دسترسی سریع
function buildNodeMap(flow) {
  const map = new Map();
  for (const node of flow?.nodes || []) {
    if (node?.id) map.set(node.id, node);
  }
  return map;
}

// فقط لبه‌هایی که هر دو سرشان به نود معتبر اشاره می‌کنند
function validEdges(flow, nodeMap) {
  return (flow?.edges || []).filter(
    (e) => e?.source && e?.target && nodeMap.has(e.source) && nodeMap.has(e.target)
  );
}

// نودهای ورودی: نودهایی که هیچ لبه‌ی ورودی ندارند (شروع گراف)
export function getEntryNodes(flow) {
  const nodeMap = buildNodeMap(flow);
  const edges = validEdges(flow, nodeMap);
  const hasIncoming = new Set(edges.map((e) => e.target));
  return (flow?.nodes || []).filter((n) => n?.id && !hasIncoming.has(n.id));
}

// نودهای بعدی: نودهایی که مستقیماً از nodeId قابل دسترسی‌اند
export function getNextNodes(flow, nodeId) {
  const nodeMap = buildNodeMap(flow);
  const edges = validEdges(flow, nodeMap);
  return edges
    .filter((e) => e.source === nodeId)
    .map((e) => nodeMap.get(e.target))
    .filter(Boolean);
}

// ساخت دنباله‌ی مرتب مراحل با مرتب‌سازی توپولوژیک (الگوریتم Kahn).
// - گراف بدون لبه: نودها به ترتیب طبیعی برمی‌گردند.
// - شاخه‌ها: به ترتیب لایه‌ای مسطح می‌شوند.
// - نودهای جدا افتاده: در انتها افزوده می‌شوند تا حذف نشوند.
// - دور احتمالی: بدون حلقه‌ی بی‌نهایت مدیریت می‌شود.
export function buildStepSequence(flow) {
  const nodes = flow?.nodes || [];
  if (nodes.length === 0) return [];

  const nodeMap = buildNodeMap(flow);
  const edges = validEdges(flow, nodeMap);

  // محاسبه‌ی درجه‌ی ورودی هر نود
  const inDegree = new Map();
  for (const node of nodes) {
    if (node?.id) inDegree.set(node.id, 0);
  }
  for (const edge of edges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // ترتیب اولیه‌ی نودها (برای پایداری خروجی) بر اساس index آرایه
  const orderIndex = new Map();
  nodes.forEach((n, i) => {
    if (n?.id) orderIndex.set(n.id, i);
  });

  // صف نودهای با درجه‌ی ورودی صفر، مرتب بر اساس ترتیب اولیه
  const queue = nodes
    .filter((n) => n?.id && inDegree.get(n.id) === 0)
    .sort((a, b) => orderIndex.get(a.id) - orderIndex.get(b.id))
    .map((n) => n.id);

  const sequence = [];
  const visited = new Set();

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const currentNode = nodeMap.get(currentId);
    if (currentNode) sequence.push(currentNode);

    // کاهش درجه‌ی ورودی همسایه‌ها و افزودن آن‌هایی که به صفر می‌رسند
    const newlyReady = [];
    for (const edge of edges) {
      if (edge.source !== currentId) continue;
      const target = edge.target;
      inDegree.set(target, (inDegree.get(target) || 0) - 1);
      if (inDegree.get(target) === 0 && !visited.has(target)) {
        newlyReady.push(target);
      }
    }
    newlyReady.sort((a, b) => orderIndex.get(a) - orderIndex.get(b));
    queue.push(...newlyReady);
  }

  // نودهای باقی‌مانده (دور یا جدا افتاده) را در انتها، با ترتیب اولیه، اضافه کن
  if (sequence.length < nodes.length) {
    const leftovers = nodes
      .filter((n) => n?.id && !visited.has(n.id))
      .sort((a, b) => orderIndex.get(a.id) - orderIndex.get(b.id));
    sequence.push(...leftovers);
  }

  return sequence;
}

// آیا این فرایند مرحله‌ی قابل نمایشی دارد؟
export function hasSteps(flow) {
  return (flow?.nodes?.length || 0) > 0;
}
