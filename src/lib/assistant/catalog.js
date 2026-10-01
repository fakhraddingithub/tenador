// Explicit read-only data contract. Never expose whole schemas or documents to a model.
const common = { _id: 'id', createdAt: 'date' };
function dataset(model, permission, title, path, fields, note = '') {
  return { model, permission, title, path, fields: { ...common, ...fields }, note };
}

export const DATASETS = {
  products: dataset('Product', 'products.view', 'محصولات', '/p-admin/admin-products', {
    name: 'text', sku: 'text', slug: 'text', basePrice: 'number', isActive: 'boolean',
    brand: 'id', category: 'id', sport: 'id',
  }, 'basePrice is base Toman, not final sale price. No inventory field. Creator is in activity tool.'),
  orders: dataset('Order', 'orders.view', 'سفارش‌ها', '/p-admin/admin-orders', {
    trackingCode: 'text', user: 'id', totalPrice: 'number', paymentStatus: 'text',
    fulfillmentStatus: 'text', paymentMethod: 'text', subtotalPrice: 'number', discountAmount: 'number', couponDiscount: 'number', walletPaid: 'number', priceEUR: 'number', orderDate: 'date',
  }, 'Toman except priceEUR. paymentStatus UNPAID/PARTIALLY_PAID/PAID; fulfillmentStatus WAITING/NEEDS_PURCHASE/PROCESSING/SENT/DELIVERED/CANCELED. Exclude CANCELED for sales. totalPrice is net order value, not received cash. finance provides dashboard metrics; analyze supports custom questions.'),
  users: dataset('User', 'users.view', 'کاربران', '/p-admin/users', {
    name: 'text', lastName: 'text', role: 'text', isBanned: 'boolean',
  }),
  payments: dataset('Payment', 'payments.view', 'پرداخت‌ها', '/p-admin/admin-orders', {
    order: 'id', amount: 'number', status: 'text', method: 'text', 'onlinePayment.paidAt': 'date', 'bankReceipt.reviewedAt': 'date',
  }, 'Toman. status PENDING/PAID/FAILED/REJECTED. PAID payment sums are receipts, not order revenue. createdAt is creation, onlinePayment.paidAt is online settlement, bankReceipt.reviewedAt is receipt review, not necessarily actual transfer date.'),
  installments: dataset('Installment', 'installments.view', 'اقساط', '/p-admin/financial/installments', {
    order: 'id', totalAmount: 'number', downPayment: 'id', numberOfChecks: 'number', status: 'text',
  }, 'Toman; PENDING/ACTIVE/COMPLETED/DEFAULTED. downPayment references Payment, not an amount. Individual checks are in checks dataset.'),
  checks: { ...dataset('Installment', 'installments.view', 'چک‌های اقساط', '/p-admin/financial/installments', {
    installment: 'id', order: 'id', amount: 'number', dueDate: 'date', paidAt: 'date', status: 'text', reviewedAt: 'date',
  }, 'One row per check. Toman. PENDING/CLEARED/BOUNCED. Overdue = dueDate before now and status != CLEARED. Parent createdAt is installment creation, not check payment.'), view: 'checks' },
  orderItems: { ...dataset('Order', 'orders.view', 'اقلام سفارش', '/p-admin/admin-orders', {
    order: 'id', user: 'id', trackingCode: 'text', product: 'id', usedProduct: 'id', quantity: 'number', unitPrice: 'number', lineTotal: 'number', priceEUR: 'number', lineTotalEUR: 'number', fulfillmentStatus: 'text', procurementStatus: 'text',
  }, 'One row per item. lineTotal=quantity*unitPrice (Toman, before order-level coupon). lineTotalEUR=quantity*priceEUR, null if unset. Exclude CANCELED for sales. Count counts items, not orders; distinct(order) counts orders. Find product id via products before filtering.'), view: 'orderItems' },
  euroPayments: { ...dataset('Order', 'orders.view', 'پرداخت‌های یورویی', '/p-admin/admin-orders', {
    order: 'id', user: 'id', trackingCode: 'text', amount: 'number', confirmedAt: 'date', fulfillmentStatus: 'text',
  }, 'One row per recorded EUR payment. Filter confirmedAt for receipts by date. EUR only, never combine with Toman. Exclude canceled orders if appropriate.'), view: 'euroPayments' },
  tickets: dataset('Ticket', 'tickets.view', 'تیکت‌ها', '/p-admin/support?tab=tickets', {
    subject: 'text', user: 'id', status: 'text', priority: 'text', department: 'text',
  }, 'status open/answered/pending_user/closed; priority low/medium/high/urgent. Subject only, no message bodies.'),
  articles: dataset('Article', 'articles.view', 'مقاله‌ها', '/p-admin/admin-articles', {
    title: 'text', slug: 'text', status: 'text', author: 'id', publishedAt: 'date',
  }, 'draft/review/scheduled/published/archived; excludes deleted articles.'),
  usedProducts: dataset('UsedProduct', 'secondHand.view', 'محصولات دست دوم', '/p-admin/admin-secondHands/used-products', {
    name: 'text', slug: 'text', price: 'number', status: 'text', overallScore: 'number',
  }, 'Toman; available/reserved/sold.'),
  brands: dataset('Brand', 'brands.view', 'برندها', '/p-admin/admin-brands', { name: 'text', title: 'text', slug: 'text' }),
  sports: dataset('Sport', 'sports.view', 'ورزش‌ها', '/p-admin/admin-sports', { name: 'text', title: 'text', slug: 'text' }),
  categories: dataset('Category', 'categories.view', 'دسته‌بندی‌ها', '/p-admin/admin-categories', { name: 'text', title: 'text', slug: 'text', sport: 'id' }),
  variants: dataset('Variant', 'variants.view', 'واریانت محصولات', '/p-admin/admin-products', { productId: 'id', categoryId: 'id', sku: 'text', slug: 'text', price: 'number' }, 'No stock quantity in this database model; price is the stored variant price.'),
  comments: dataset('Comment', 'comments.view', 'نظرات و امتیازها', '/p-admin/support?tab=comments', { user: 'id', product: 'id', usedProduct: 'id', order: 'id', parent: 'id', rating: 'number', status: 'text', isVerifiedPurchase: 'boolean', text: 'text' }, 'pending/approved/rejected. Text is truncated in lists. Filter parent absent for root reviews; ratings can be missing for replies.'),
  coupons: dataset('Coupon', 'discounts.view', 'کوپن‌ها', '/p-admin/discounts', { code: 'text', active: 'boolean', 'discount.kind': 'text', 'discount.value': 'number', startAt: 'date', endAt: 'date', usedAt: 'date', usedBy: 'id', usedOrder: 'id', appliedAmount: 'number', returnedAmount: 'number', usageLimit: 'number' }),
  discountRules: dataset('DiscountRule', 'discounts.view', 'قوانین تخفیف', '/p-admin/discounts', { title: 'text', type: 'text', active: 'boolean', 'discount.kind': 'text', 'discount.value': 'number', startAt: 'date', endAt: 'date', usedCount: 'number', priority: 'number' }),
  series: dataset('Serie', 'series.view', 'سری محصولات', '/p-admin/admin-brands', { name: 'text', title: 'text', slug: 'text', brand: 'id' }),
  collections: dataset('Event', 'collections.view', 'کالکشن‌ها و کمپین‌ها', '/p-admin/admin-events', { name: 'text', slug: 'text', status: 'text' }, 'draft/scheduled/active/paused/ended/archived'),
};

// Only many-to-one relationships on unique _id; joins cannot multiply source rows.
export const RELATIONS = {
  orders: { users: 'user' }, products: { brands: 'brand', categories: 'category', sports: 'sport' },
  orderItems: { products: 'product', users: 'user' }, euroPayments: { users: 'user' },
  payments: { orders: 'order' }, installments: { orders: 'order' }, checks: { orders: 'order' },
  tickets: { users: 'user' }, comments: { users: 'user', products: 'product' },
  variants: { products: 'productId', categories: 'categoryId' }, coupons: { users: 'usedBy', orders: 'usedOrder' },
};

export const TOOL_PERMISSIONS = { activity: 'admins.viewActivity', finance: 'analytics.view' };
export const LIMITS = { message: 1500, history: 6, historyChars: 4500, queries: 3, totalQueries: 6, filters: 6, rows: 8, rounds: 3, bodyBytes: 24000, evidenceChars: 16000 };
export const hasOwn = (object, key) => typeof key === 'string' && Object.hasOwn(object, key);

export function availableCatalog(permissions) {
  const allowed = new Set(permissions);
  return Object.entries(DATASETS).filter(([, d]) => allowed.has(d.permission)).map(([name, d]) => ({
    name, title: d.title, fields: d.fields, note: d.note,
    joins: Object.keys(RELATIONS[name] || {}).filter(target => allowed.has(DATASETS[target].permission)),
  }));
}

// Actual route URLs are generated by the server, never by the language model.
export function recordPath(datasetName, row) {
  if (['orderItems', 'euroPayments', 'payments'].includes(datasetName) && /^[a-f\d]{24}$/i.test(String(row.order || ''))) return `/p-admin/admin-orders/${row.order}`;
  if (datasetName === 'checks' && /^[a-f\d]{24}$/i.test(String(row.installment || ''))) return `/p-admin/financial/installments/${row.installment}`;
  const id = String(row._id || '');
  if (!/^[a-f\d]{24}$/i.test(id)) return DATASETS[datasetName]?.path;
  if (datasetName === 'orders') return `/p-admin/admin-orders/${id}`;
  if (datasetName === 'users') return `/p-admin/users/${id}`;
  if (datasetName === 'tickets') return `/p-admin/support/tickets/${id}`;
  if (datasetName === 'installments') return `/p-admin/financial/installments/${id}`;
  if (datasetName === 'articles') return `/p-admin/admin-articles/${id}/preview`;
  // Product details live in an editor, so permission checking may fall back to the list.
  if (datasetName === 'products') return `/p-admin/admin-products/edit/${id}`;
  return DATASETS[datasetName]?.path;
}
