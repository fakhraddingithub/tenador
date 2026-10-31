import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createProductWithVariants } from '../src/lib/createProductWithVariants.js';
import { parseRegenerationDraft, PRODUCT_LABELS } from '../src/lib/productRegeneration.js';
import { AiError, generate as realGenerate } from '../src/lib/ai/index.js';

register('./productRegenerationHooks.mjs', import.meta.url);

let repl, Product, Variant, POST, GENERATE;
let sport, category, otherCategory, brandA, brandB, serieA, serieB, editionA, athlete, padelAthlete, product;

before(async () => {
  // Real replica set, real schemas, real transactions and save hooks.
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ launchTimeout: 60000 }] });
  await mongoose.connect(repl.getUri());
  await import('../models/registerModels.js');
  Product = mongoose.model('Product');
  Variant = mongoose.model('Variant');
  await Product.init();
  await Variant.init();

  sport = await mongoose.model('Sport').create({ name: 'Tennis', title: 'تنیس' });
  const Category = mongoose.model('Category');
  category = await Category.create({
    name: 'racket', title: 'راکت', sport: sport._id,
    attributes: [
      { name: 'material', label: 'جنس', required: true },
      { name: 'grip', label: 'گریپ', uiType: 'dropdown', required: false },
      { name: 'weight', label: 'وزن', uiType: 'number-input', required: false },
      // فقط برای بزرگسالان — روی محصولِ بچگانه نباید پاک شود
      { name: 'balance', label: 'بالانس', required: true, targetAudiences: ['یونی سکس'] },
    ],
    variantAttributes: [{ name: 'size', label: 'سایز', required: true }],
    technicalStats: [{ name: 'power', label: 'قدرت', min: 0, max: 100 }],
    customTab: { enabled: true, title: 'ویژگی‌ها', items: [{ title: 'سبک' }, { title: 'قدرتی' }] },
  });
  otherCategory = await Category.create({ name: 'shoe', title: 'کفش', sport: sport._id });

  const Brand = mongoose.model('Brand');
  brandA = await Brand.create({ name: 'Wilson', title: 'ویلسون' });
  brandB = await Brand.create({ name: 'Head', title: 'هد' });
  const Serie = mongoose.model('Serie');
  serieA = await Serie.create({ name: 'Blade', title: 'بلید', brand: brandA._id });
  serieB = await Serie.create({ name: 'Speed', title: 'اسپید', brand: brandB._id });
  editionA = await mongoose.model('LimitedEdition').create({ name: 'RG', title: 'رولان گاروس', brand: brandA._id });
  athlete = await mongoose.model('Athlete').create({ name: 'Federer', title: 'فدرر', sport: sport._id });
  const padel = await mongoose.model('Sport').create({ name: 'Padel', title: 'پدل' });
  padelAthlete = await mongoose.model('Athlete').create({ name: 'Galan', title: 'گالان', sport: padel._id });
  // قواعدِ پنل: یک قاعده‌ی پایه و یک قاعده‌ی گروهِ همین دسته — باید به AI برسند
  await mongoose.model('ProductPromptConfig').create({
    key: 'product',
    base: [{ section: 'task', rules: ['ADMIN-BASE-RULE-7731'] }],
    groups: [{ title: 'g', categories: [category._id], rules: [{ field: 'name', text: 'GROUP-RULE-5512', categories: [] }] }],
  });

  ({ POST } = await import('../src/app/api/product/[productId]/regenerate/route.js'));
  ({ POST: GENERATE } = await import('../src/app/api/product/[productId]/regenerate/generate/route.js'));
});

after(async () => { await mongoose.disconnect(); await repl?.stop(); });

beforeEach(async () => {
  await Product.deleteMany({});
  await Variant.deleteMany({});
  product = await createProductWithVariants({
    Product, Variant,
    productData: {
      name: 'Old Racket', sku: `OLD-${Date.now()}`, shortDescription: 'old short', longDescription: 'old long',
      color: '#000000', basePrice: 120, label: 'none', targetAudience: 'یونی سکس',
      category: category._id, sport: sport._id, brand: brandA._id, serie: serieA._id, limitedEdition: null,
      mainImage: 'https://ik.imagekit.io/x/main.jpg', gallery: ['https://ik.imagekit.io/x/g1.jpg'],
      attributes: { material: 'Graphite', balance: 'Head-light' }, technicalStats: { power: 50 },
      variantMeta: { size: { L2: { images: ['https://ik.imagekit.io/x/l2.jpg'] } } },
      tag: ['old'],
    },
    variants: [
      { categoryId: category._id, attributes: { size: 'L2' }, price: 120, images: ['https://ik.imagekit.io/x/v1.jpg'] },
      { categoryId: category._id, attributes: { size: 'L3' }, price: 150, images: [] },
    ],
  });
});

const call = (body, id = product._id) =>
  POST({ json: async () => body }, { params: Promise.resolve({ productId: String(id) }) });

function draft(overrides = {}) {
  return {
    name: 'New Racket Pro', shortDescription: '<p>کوتاه</p>', longDescription: '<p>بلند</p>',
    color: '#ff0000', basePrice: 199, label: 'new', targetAudience: 'یونی سکس',
    brand: String(brandA._id), serie: String(serieA._id), limitedEdition: String(editionA._id),
    sport: String(sport._id), athlete: [String(athlete._id)], category: String(category._id),
    attributes: { material: 'Carbon', grip: 'G2, G3', weight: '300', balance: 'Even' },
    // AI که تصاویر و واریانت‌ها را عوض می‌کند — باید کاملاً نادیده گرفته شوند
    variantOptions: { size: ['L9'] }, variantMeta: { size: { L9: { images: ['https://evil/x.jpg'] } } },
    technicalStats: { power: 88 }, customTabItems: ['قدرتی'], tag: ['راکت', 'حرفه‌ای', 'راکت'],
    mainImage: 'https://evil/main.jpg', gallery: ['https://evil/g.jpg'],
    ...overrides,
  };
}

async function snapshot() {
  const p = await Product.findById(product._id).lean();
  const variants = await Variant.find({ productId: product._id }).sort({ sku: 1 }).lean();
  return { p, variants };
}

async function preview(json) {
  const res = await call({ json: JSON.stringify(json), dryRun: true });
  return { res, data: await res.json() };
}

async function apply(json) {
  const { res, data } = await preview(json);
  assert.equal(res.status, 200, data.error);
  return call({ json: JSON.stringify(json), expectedUpdatedAt: data.updatedAt });
}

function assertImagesAndVariantsIntact(before, afterSnap) {
  assert.equal(afterSnap.p.mainImage, before.p.mainImage);
  assert.deepEqual(afterSnap.p.gallery, before.p.gallery);
  assert.deepEqual(afterSnap.p.variants.map(String), before.p.variants.map(String));
  assert.deepEqual(afterSnap.p.variantMeta, before.p.variantMeta);
  assert.deepEqual(afterSnap.variants, before.variants); // _id, sku, price, images, attributes, updatedAt
}

/* ── parsing ─────────────────────────────────────────────────────────────── */

test('parse accepts fenced JSON and rejects malformed, non-object and duplicate-key input', () => {
  assert.deepEqual(parseRegenerationDraft('```json\n{"name":"x"}\n```').draft, { name: 'x' });
  for (const bad of ['', '   ', '{"name":', '[1,2]', 'null', '"x"', '{"name":"a","name":"b"}', 42]) {
    assert.ok(parseRegenerationDraft(bad).error, String(bad));
  }
});

test('the label whitelist matches the Product schema enum', () => {
  assert.deepEqual(PRODUCT_LABELS, Product.schema.path('label').enumValues);
});

/* ── preview ─────────────────────────────────────────────────────────────── */

test('dry run reports the diff and writes nothing', async () => {
  const before = await snapshot();
  const { res, data } = await preview(draft());
  assert.equal(res.status, 200);
  const fields = data.changes.map((c) => c.field).sort();
  assert.deepEqual(fields, ['athlete', 'attributes', 'basePrice', 'color', 'customTabItems', 'label',
    'limitedEdition', 'longDescription', 'name', 'shortDescription', 'tag', 'technicalStats'].sort());
  assert.deepEqual(data.preserved.sort(), ['gallery', 'mainImage', 'variantMeta', 'variantOptions'].sort());
  assert.deepEqual(data.slug, { before: before.p.slug, after: 'new-racket-pro' });
  assert.deepEqual(data.changes.find((c) => c.field === 'athlete').after, ['فدرر']);
  assert.deepEqual(await snapshot(), before);
});

/* ── apply ───────────────────────────────────────────────────────────────── */

test('apply updates every regenerated field and leaves images and variants untouched', async () => {
  const before = await snapshot();
  const res = await apply(draft());
  assert.equal(res.status, 200, (await res.clone().json()).error);
  const afterSnap = await snapshot();
  const p = afterSnap.p;

  assert.equal(p.name, 'New Racket Pro');
  assert.equal(p.slug, 'new-racket-pro');
  assert.equal(p.shortDescription, '<p>کوتاه</p>');
  assert.equal(p.longDescription, '<p>بلند</p>');
  assert.equal(p.color, '#ff0000');
  assert.equal(p.basePrice, 199);
  assert.equal(p.label, 'new');
  assert.equal(String(p.limitedEdition), String(editionA._id));
  assert.deepEqual(p.athlete.map(String), [String(athlete._id)]);
  assert.deepEqual(p.attributes, { material: 'Carbon', grip: ['G2', 'G3'], weight: 300, balance: 'Even' });
  assert.deepEqual(p.technicalStats, { power: 88 });
  assert.deepEqual(p.customTabItems.map(String), [String(category.customTab.items[1]._id)]);
  assert.deepEqual(p.tag, ['راکت', 'حرفه‌ای']);
  // context fields are never rewritten
  assert.equal(String(p.category), String(category._id));
  assert.equal(p.sku, before.p.sku);
  assert.equal(p.isActive, before.p.isActive);

  assertImagesAndVariantsIntact(before, afterSnap);
});

test('a key absent from the JSON is left alone; an explicit empty value clears it', async () => {
  const json = draft({ serie: '', limitedEdition: '', athlete: [], tag: [] });
  delete json.basePrice;
  delete json.color;
  const res = await apply(json);
  assert.equal(res.status, 200);
  const { p } = await snapshot();
  assert.equal(p.basePrice, 120);
  assert.equal(p.color, '#000000');
  assert.equal(p.serie, null);
  assert.equal(p.limitedEdition, null);
  assert.deepEqual(p.athlete, []);
  assert.deepEqual(p.tag, []);
});

test('an attribute scoped out for the new audience keeps its stored value', async () => {
  const json = draft({ targetAudience: 'بچگانه', attributes: { material: 'Aluminium' } });
  const res = await apply(json);
  assert.equal(res.status, 200, (await res.clone().json()).error);
  const { p } = await snapshot();
  assert.equal(p.targetAudience, 'بچگانه');
  assert.deepEqual(p.attributes, { material: 'Aluminium', balance: 'Head-light' });
});

/* ── rejection: nothing is written ───────────────────────────────────────── */

test('invalid or foreign JSON is rejected with field errors and changes nothing', async () => {
  const cases = [
    [{ category: String(otherCategory._id) }, 'category'],
    [{ sport: String(new mongoose.Types.ObjectId()) }, 'sport'],
    [{ name: '   ' }, 'name'],
    [{ color: '#hexcode' }, 'color'],
    [{ basePrice: -5 }, 'basePrice'],
    [{ basePrice: 'نامشخص' }, 'basePrice'],
    [{ label: 'best_seller' }, 'label'],
    [{ targetAudience: 'همه‌ی سنین' }, 'targetAudience'],
    [{ brand: '' }, 'brand'],
    [{ brand: String(new mongoose.Types.ObjectId()) }, 'brand'],
    [{ serie: String(serieB._id) }, 'serie'],
    [{ limitedEdition: String(new mongoose.Types.ObjectId()) }, 'limitedEdition'],
    [{ athlete: ['nope'] }, 'athlete'],
    [{ attributes: { material: 'x', unknownKey: 'y' } }, 'unknownKey'],
    [{ attributes: { weight: 'heavy', material: 'x' } }, 'weight'],
    [{ attributes: { grip: 'G2' } }, 'material'], // required attribute missing
    [{ attributes: [] }, 'attributes'],
    [{ technicalStats: { power: 500 } }, 'power'],
    [{ technicalStats: { speed: 10 } }, 'speed'],
    [{ customTabItems: ['ناموجود'] }, 'customTabItems'],
    [{ tag: [{}] }, 'tag'],
  ];
  const before = await snapshot();
  for (const [overrides, field] of cases) {
    const res = await call({ json: JSON.stringify(draft(overrides)), dryRun: true });
    const data = await res.json();
    assert.equal(res.status, 400, `${field}: ${JSON.stringify(data)}`);
    assert.ok(data.fieldErrors?.[field], `${field}: ${JSON.stringify(data.fieldErrors)}`);
    // the apply path re-validates instead of trusting the preview
    const applied = await call({ json: JSON.stringify(draft(overrides)), expectedUpdatedAt: before.p.updatedAt.toISOString() });
    assert.equal(applied.status, 400, field);
  }
  assert.deepEqual(await snapshot(), before);
});

test('changing the brand without naming a new serie refuses to keep the old brand serie', async () => {
  const json = draft({ brand: String(brandB._id), limitedEdition: '' });
  delete json.serie;
  const { res, data } = await preview(json);
  assert.equal(res.status, 400);
  assert.ok(data.fieldErrors.serie);
});

test('malformed JSON, missing product and invalid id fail safely', async () => {
  assert.equal((await call({ json: '{"name": ' , dryRun: true })).status, 400);
  assert.equal((await call({ dryRun: true })).status, 400);
  assert.equal((await call({ json: JSON.stringify(draft()), dryRun: true }, new mongoose.Types.ObjectId())).status, 404);
  assert.equal((await call({ json: JSON.stringify(draft()), dryRun: true }, 'not-an-id')).status, 400);
});

test('apply requires the preview version and refuses a product edited since', async () => {
  const json = JSON.stringify(draft());
  assert.equal((await call({ json })).status, 400); // no preview
  const { data } = await preview(draft());
  await Product.updateOne({ _id: product._id }, { $set: { shortDescription: 'edited elsewhere' } });
  const before = await snapshot();
  const res = await call({ json, expectedUpdatedAt: data.updatedAt });
  assert.equal(res.status, 409);
  assert.deepEqual(await snapshot(), before);
});

test('a duplicate slug is reported at preview time, not as a database error', async () => {
  await Product.create({
    name: 'New Racket Pro', sku: 'OTHER', shortDescription: 's', longDescription: 'l',
    mainImage: 'https://ik.imagekit.io/x/o.jpg', category: category._id, brand: brandA._id, sport: sport._id,
  });
  const { res, data } = await preview(draft());
  assert.equal(res.status, 409);
  assert.ok(data.fieldErrors.name);
});

test('a database failure during save rolls back and leaves the product untouched', async () => {
  const before = await snapshot();
  const { data } = await preview(draft());
  const save = Product.prototype.save;
  Product.prototype.save = async function () { throw new Error('simulated database failure'); };
  try {
    const res = await call({ json: JSON.stringify(draft()), expectedUpdatedAt: data.updatedAt });
    assert.equal(res.status, 500);
    assert.doesNotMatch((await res.json()).error, /simulated/); // no internal detail leaks
  } finally {
    Product.prototype.save = save;
  }
  assert.deepEqual(await snapshot(), before);
});

test('a JSON identical to the product reports no changes and apply refuses', async () => {
  await apply(draft());
  const { res, data } = await preview(draft());
  assert.equal(res.status, 200);
  assert.deepEqual(data.changes, []);
  assert.equal((await call({ json: JSON.stringify(draft()), expectedUpdatedAt: data.updatedAt })).status, 400);
});

/* ── automatic mode: POST /regenerate/generate ──────────────────────────── */

const RAW = 'Wilson Blade Pro racket, 300g, graphite frame, comfortable grip, made for advanced adult players.';
const GEMINI_ENV = { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-test' };
const OPENAI_ENV = { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'k', OPENAI_MODEL: 'gpt-test' };

/**
 * Wires the route to the *real* shared AI layer with a fake HTTP transport, so the
 * provider request/response formats are exercised end to end. Returns the captured calls.
 */
function useProvider(env, replyText, { finish, status } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push(JSON.parse(init.body));
    if (status) return Response.json({ error: { message: 'secret-provider-detail' } }, { status });
    return env.AI_PROVIDER === 'openai'
      ? Response.json({ choices: [{ message: { content: replyText }, finish_reason: finish || 'stop' }], usage: { total_tokens: 5 } })
      : Response.json({ candidates: [{ content: { parts: [{ text: replyText }] }, finishReason: finish || 'STOP' }], usageMetadata: { totalTokenCount: 5 } });
  };
  globalThis.__ai = {
    config: () => ({ configured: true }),
    generate: (request) => realGenerate(request, { env, fetchImpl }),
    quota: async () => {},
  };
  return calls;
}
const promptOf = (call) => call.contents?.[0].parts[0].text ?? call.messages.at(-1).content;

const generateCall = (body, id = product._id) =>
  GENERATE({ json: async () => body, signal: undefined }, { params: Promise.resolve({ productId: String(id) }) });
async function generateRaw(rawContent = RAW, id) {
  const res = await generateCall({ rawContent }, id);
  return { res, data: await res.json() };
}

test('auto: one click produces a preview from the shared prompt and writes nothing', async () => {
  const calls = useProvider(GEMINI_ENV, JSON.stringify(draft()));
  const before = await snapshot();
  const { res, data } = await generateRaw();
  assert.equal(res.status, 200, data.error);
  assert.equal(calls.length, 1);

  const prompt = promptOf(calls[0]);
  assert.ok(prompt.includes('ADMIN-BASE-RULE-7731'), 'admin base rule reaches the model');
  assert.ok(prompt.includes('GROUP-RULE-5512'), 'category group rule reaches the model');
  assert.ok(prompt.includes(`Category ID   : ${category._id}`));
  assert.ok(prompt.includes(RAW));
  assert.ok(prompt.includes(String(brandA._id)) && prompt.includes(String(athlete._id)));
  assert.ok(!prompt.includes(String(padelAthlete._id)), 'athletes of other sports are not sent');
  assert.match(calls[0].systemInstruction.parts[0].text, /untrusted/);
  assert.equal(calls[0].generationConfig.responseMimeType, 'application/json');

  assert.deepEqual(data.ai, { provider: 'gemini', model: 'gemini-test', tokens: 5 });
  assert.deepEqual(JSON.parse(data.json), draft());
  assert.ok(data.preview.changes.length > 0);
  assert.deepEqual(data.preview.preserved.sort(), ['gallery', 'mainImage', 'variantMeta', 'variantOptions'].sort());
  assert.deepEqual(await snapshot(), before, 'generation never writes');
});

test('auto: the generated JSON applies through the manual route with images and variants intact', async () => {
  useProvider(GEMINI_ENV, JSON.stringify(draft()));
  const before = await snapshot();
  const { data } = await generateRaw();
  const res = await call({ json: data.json, expectedUpdatedAt: data.preview.updatedAt });
  assert.equal(res.status, 200, (await res.clone().json()).error);
  const afterSnap = await snapshot();
  assert.equal(afterSnap.p.name, 'New Racket Pro');
  assert.equal(afterSnap.p.basePrice, 199);
  assert.deepEqual(afterSnap.p.technicalStats, { power: 88 });
  assertImagesAndVariantsIntact(before, afterSnap);
});

test('auto: switching provider changes nothing downstream', async () => {
  useProvider(GEMINI_ENV, JSON.stringify(draft()));
  const fromGemini = (await generateRaw()).data;
  const calls = useProvider(OPENAI_ENV, '```json\n' + JSON.stringify(draft()) + '\n```');
  const fromOpenAi = (await generateRaw()).data;
  assert.equal(fromOpenAi.ai.provider, 'openai');
  assert.deepEqual(calls[0].response_format, { type: 'json_object' });
  assert.equal(promptOf(calls[0]).includes('ADMIN-BASE-RULE-7731'), true);
  assert.deepEqual(fromOpenAi.preview, fromGemini.preview);
  assert.deepEqual(JSON.parse(fromOpenAi.json), JSON.parse(fromGemini.json));
});

test('auto: invalid source text, missing AI config or missing product never reach the model', async () => {
  const calls = useProvider(GEMINI_ENV, JSON.stringify(draft()));
  assert.equal((await generateRaw('too short')).res.status, 400);
  assert.equal((await generateRaw('x'.repeat(60001))).res.status, 400);
  assert.equal((await generateCall({})).status, 400);
  assert.equal((await generateRaw(RAW, new mongoose.Types.ObjectId())).res.status, 404);
  globalThis.__ai.config = () => ({ configured: false });
  const unconfigured = await generateRaw();
  assert.equal(unconfigured.res.status, 503);
  assert.equal(unconfigured.data.code, 'AI_NOT_CONFIGURED');
  assert.equal(calls.length, 0);
});

test('auto: an exhausted quota stops the request before the model is called', async () => {
  const calls = useProvider(GEMINI_ENV, JSON.stringify(draft()));
  const { AssistantError } = await import('../src/lib/assistant/validation.js');
  globalThis.__ai.quota = async (user, now, { scope }) => {
    assert.equal(user, 'tester');
    assert.equal(scope, 'product:');
    throw new AssistantError('سقف', 429);
  };
  assert.equal((await generateRaw()).res.status, 429);
  assert.equal(calls.length, 0);
});

test('auto: malformed, incomplete or wrong AI output is rejected (422) with the raw JSON for manual repair', async () => {
  const before = await snapshot();
  const omit = (key) => { const d = draft(); delete d[key]; return d; };
  const cases = [
    ['not json at all', null],
    ['[1, 2, 3]', null],
    [JSON.stringify(draft({ brand: String(new mongoose.Types.ObjectId()) })), 'brand'], // invented id
    [JSON.stringify(draft({ brand: 'Wilson' })), 'brand'],                                 // name instead of id
    [JSON.stringify(draft({ serie: String(serieB._id) })), 'serie'],                       // serie of another brand
    [JSON.stringify(draft({ brand: String(brandB._id), serie: String(serieA._id), limitedEdition: '' })), 'serie'],
    [JSON.stringify(draft({ category: String(otherCategory._id) })), 'category'],
    [JSON.stringify(draft({ athlete: [String(padelAthlete._id), 'bogus'] })), 'athlete'],
    [JSON.stringify(draft({ technicalStats: { power: 140 } })), 'power'],
    [JSON.stringify(omit('longDescription')), 'longDescription'],  // incomplete: auto mode requires every field
    [JSON.stringify(omit('basePrice')), 'basePrice'],
    [JSON.stringify(omit('customTabItems')), 'customTabItems'],
  ];
  for (const [reply, field] of cases) {
    useProvider(GEMINI_ENV, reply);
    const { res, data } = await generateRaw();
    assert.equal(res.status, 422, `${field}: ${JSON.stringify(data)}`);
    assert.equal(typeof data.json, 'string', 'raw output is returned for manual repair');
    if (field) assert.ok(data.fieldErrors?.[field], `${field}: ${JSON.stringify(data.fieldErrors)}`);
  }
  assert.deepEqual(await snapshot(), before);
});

test('auto: provider errors, rate limits, timeouts and truncated answers fail safely', async () => {
  const before = await snapshot();
  useProvider(GEMINI_ENV, '', { status: 429 });
  let r = await generateRaw();
  assert.equal(r.res.status, 429);
  assert.equal(r.data.code, 'GEMINI_QUOTA');
  assert.doesNotMatch(r.data.error, /secret/);

  useProvider(OPENAI_ENV, '', { status: 503 });
  assert.equal((await generateRaw()).res.status, 503);

  useProvider(GEMINI_ENV, JSON.stringify(draft()).slice(0, 80), { finish: 'MAX_TOKENS' });
  r = await generateRaw();
  assert.equal(r.res.status, 502);
  assert.equal(r.data.code, 'AI_INCOMPLETE');

  globalThis.__ai.generate = (request) => realGenerate(request, {
    env: GEMINI_ENV, fetchImpl: async () => { throw new DOMException('slow', 'TimeoutError'); },
  });
  r = await generateRaw();
  assert.equal(r.res.status, 504);
  assert.equal(r.data.code, 'AI_TIMEOUT');

  globalThis.__ai.generate = async () => { throw new AiError('x', 503, 'AI_UNREACHABLE'); };
  assert.equal((await generateRaw()).res.status, 503);
  assert.deepEqual(await snapshot(), before);
});

test('auto: a product edited between generation and apply is not overwritten', async () => {
  useProvider(GEMINI_ENV, JSON.stringify(draft()));
  const { data } = await generateRaw();
  await Product.updateOne({ _id: product._id }, { $set: { name: 'Edited meanwhile' } });
  const before = await snapshot();
  const res = await call({ json: data.json, expectedUpdatedAt: data.preview.updatedAt });
  assert.equal(res.status, 409);
  assert.deepEqual(await snapshot(), before);
});
