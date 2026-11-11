import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { approvedReview, validateEvidence } from '../src/lib/productJobs/policy.js';
register('./productJobsHooks.mjs', import.meta.url);
let repl, Job, Product, category, brand, sport, service, sequence = 0, calls, uploads, ctx;
const rawContent = 'Exact product Model 98 Espresso 2026. Weight 305 grams unstrung. Head size 98 square inches. Price EUR 300. Colour espresso. Graphite frame.';
const photo = 'https://vendor.example/model-98.jpg';
const review = () => ({ approved: true, checks: { facts: true, identity: true, coherence: true, rules: true, depth: true, images: true }, issues: [], editorialNotes: ['Specification-based analysis; no playtesting.'] });
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri());
  await import('../models/registerModels.js');
  Job = mongoose.model('ProductJob'); Product = mongoose.model('Product');
  await Job.init(); await Product.init();
  sport = await mongoose.model('Sport').create({ name: 'Tennis', title: 'تنیس' });
  category = await mongoose.model('Category').create({ name: 'racket', title: 'راکت', sport: sport._id,
    prompts: [{ field: 'longDescription', context: 'CATEGORY-WRITING-RULE: explain trade-offs and use cases.' }] });
  brand = await mongoose.model('Brand').create({ name: 'Yonex', title: 'یونکس' });
  process.env.PRODUCT_AI_MODEL = 'test-product-model'; process.env.PRODUCT_JOBS_WORKER_SECRET = 'test-only-worker-secret';
  service = await import('../src/lib/productJobs/service.js');
});
after(async () => { await mongoose.disconnect(); await repl?.stop(); });
beforeEach(async () => {
  await Job.deleteMany({}); calls = []; uploads = 0;
  ctx = { userId: String(new mongoose.Types.ObjectId()), isAdmin: true, can: () => true };
  globalThis.__jobContext = ctx;
  globalThis.__jobDownload = async () => ({ buffer: Buffer.from('test-image'), mime: 'image/jpeg' });
  globalThis.__jobUpload = async () => { uploads++; return { url: `https://ik.imagekit.io/test/${sequence}.jpg`, fileId: 'file-1' }; };
  const name = `Model 98 ${++sequence}`;
  globalThis.__jobAI = async request => {
    const data = JSON.parse(request.prompt); calls.push({ request, data });
    let value;
    if (request.system.includes('Extract one coherent')) value = {
      draft: { name, brand: String(brand._id), basePrice: 300, attributes: {}, technicalStats: {}, variantOptions: {},
        shortDescription: '', longDescription: '', targetAudience: 'یونی سکس', tag: [], athlete: [] },
      facts: [{ field: 'weight', value: '305 g', evidence: 'Weight 305 grams unstrung.' }], missing: [], imageUrls: data.original ? [] : [photo],
    };
    else if (request.system.includes('Your ONLY task')) value = { shortDescription: '<p>شرح کوتاه منسجم برای مدل مشخص با وزن ۳۰۵ گرم.</p>',
      longDescription: '<h2>بررسی محصول</h2><p>این متن مستقل نوشته شده و توضیحات کاربردی را با مشخصات مشترک محصول هماهنگ می‌کند.</p>' };
    else value = review();
    return { value, provider: 'gemini', model: 'test-product-model', tokens: 100 };
  };
});
const input = () => ({ requestKey: `test-request-${sequence}`, categoryId: String(category._id), rawContent, imageUrls: [photo] });
async function runToEnd(id, limit = 12) {
  for (let i = 0; i < limit; i++) {
    const state = await service.getProductJob(ctx, id);
    if (!['queued', 'running'].includes(state.status)) return state;
    await service.runProductJobStage();
  }
  return service.getProductJob(ctx, id);
}

test('separate writer and reviewer, complete product saved once with transactional job result', async () => {
  const initial = await service.startProductJob(ctx, input());
  const duplicate = await service.startProductJob(ctx, input()); assert.equal(initial.jobId, duplicate.jobId);
  const result = await runToEnd(initial.jobId);
  assert.equal(result.status, 'completed', JSON.stringify(result));
  const product = await Product.findById(result.result.productId).lean();
  assert.equal(product.isActive, false); assert.equal(product.basePrice, 300); assert.equal(uploads, 1);
  assert.equal(calls.length, 3);
  assert.match(calls[1].data.adminRules, /CATEGORY-WRITING-RULE/);
  assert.equal(calls[1].data.source, rawContent);
  assert.equal(calls[2].data.effectiveProduct.longDescription, product.longDescription);
  assert.equal((await service.runProductJobStage()).idle, true);
  assert.equal((await service.startProductJob(ctx, input())).result.productId, result.result.productId);
  assert.equal(await Product.countDocuments({ _id: product._id }), 1);
  await assert.rejects(service.startProductJob(ctx, { ...input(), rawContent: rawContent + ' changed' }), /requestKey/);
});

test('rejected prose goes through revision and a new independent review before save', async () => {
  const originalAI = globalThis.__jobAI; let reviews = 0;
  globalThis.__jobAI = async request => {
    const result = await originalAI(request);
    if (request.system.includes('Independently audit') && reviews++ === 0) result.value = { ...review(), approved: false,
      checks: { ...review().checks, depth: false }, issues: [{ field: 'longDescription', problem: 'Missing depth', fix: 'Explain trade-offs', requiresInput: false }] };
    return result;
  };
  const job = await service.startProductJob(ctx, input());
  const result = await runToEnd(job.jobId);
  assert.equal(result.status, 'completed', JSON.stringify(result)); assert.equal(result.revisions, 1);
  assert.equal(reviews, 2); assert.equal(uploads, 1); assert.equal(calls.length, 5);
  assert.equal(calls[3].data.feedback[0].problem, 'Missing depth');
});

test('unsupported facts stop without storing a product and can be clarified', async () => {
  const originalAI = globalThis.__jobAI;
  globalThis.__jobAI = async request => {
    const result = await originalAI(request);
    if (request.system.includes('Independently audit')) result.value = { ...review(), approved: false,
      checks: { ...review().checks, facts: false }, issues: [{ field: 'attributes', problem: 'Unknown weight', fix: 'Provide weight', requiresInput: true }] };
    return result;
  };
  const count = await Product.countDocuments(); const job = await service.startProductJob(ctx, input());
  assert.equal((await runToEnd(job.jobId)).status, 'needs_input');
  assert.equal(await Product.countDocuments(), count);
  globalThis.__jobAI = originalAI;
  await service.resumeProductJob(ctx, job.jobId, 'Confirmed unstrung weight is 305 grams.');
  assert.equal((await runToEnd(job.jobId)).status, 'completed'); assert.equal(uploads, 1);
});

test('ownership and live permissions prevent reading or running another user job', async () => {
  const job = await service.startProductJob(ctx, input());
  await assert.rejects(service.getProductJob({ ...ctx, userId: String(new mongoose.Types.ObjectId()) }, job.jobId), /پیدا/);
  globalThis.__jobContext = { ...ctx, can: () => false };
  await service.runProductJobStage();
  assert.equal((await Job.findById(job.jobId)).status, 'failed'); assert.equal(calls.length, 0);
});

test('parallel workers acquire a single lease; expired stage can recover', async () => {
  const job = await service.startProductJob(ctx, input());
  const result = await Promise.all([service.runProductJobStage(), service.runProductJobStage()]);
  assert.equal(result.filter(r => r.idle).length, 1);
  await Job.updateOne({ _id: job.jobId }, { $set: { status: 'running', leaseUntil: new Date(Date.now() - 1000) } });
  await service.runProductJobStage();
  assert.equal((await Job.findById(job.jobId)).stage, 'write');
});

test('changed panel rules prevent commit of previously approved content', async () => {
  const job = await service.startProductJob(ctx, input());
  for (let i = 0; i < 4; i++) await service.runProductJobStage();
  assert.equal((await Job.findById(job.jobId)).stage, 'commit');
  await mongoose.model('Category').updateOne({ _id: category._id }, { $push: { prompts: { field: 'shortDescription', context: 'NEW-RULE' } } });
  await service.runProductJobStage();
  assert.equal((await Job.findById(job.jobId)).status, 'failed');
  await mongoose.model('Category').updateOne({ _id: category._id }, { $pull: { prompts: { field: 'shortDescription' } } });
});

test('regeneration preserves price, images, variants and rejects concurrent edits', async () => {
  const first = await service.startProductJob(ctx, input()); const created = await runToEnd(first.jobId);
  const before = await Product.findById(created.result.productId).lean();
  const job = await service.startProductJob(ctx, { ...input(), requestKey: 'regenerate-unique', productId: String(before._id) });
  const result = await runToEnd(job.jobId);
  assert.equal(result.status, 'completed', JSON.stringify(result));
  const after = await Product.findById(before._id).lean();
  for (const key of ['basePrice', 'mainImage', 'gallery', 'variants', 'variantMeta']) assert.deepEqual(after[key], before[key]);
  const stale = await service.startProductJob(ctx, { ...input(), requestKey: 'regenerate-stale', productId: String(before._id) });
  await service.runProductJobStage();
  await Product.updateOne({ _id: before._id }, { $set: { basePrice: 999 } });
  assert.equal((await runToEnd(stale.jobId)).status, 'failed');
  assert.equal((await Product.findById(before._id)).basePrice, 999);
});

test('invalid evidence and failed review cannot be treated as approved', () => {
  assert.equal(validateEvidence([{ evidence: 'Invented weight' }], rawContent), false);
  assert.equal(approvedReview({ ...review(), checks: { ...review().checks, coherence: false } }), false);
  assert.equal(approvedReview({ ...review(), issues: [{}] }), false);
});

test('internal dispatcher endpoint rejects missing or wrong secret before execution', async () => {
  const { POST } = await import('../src/app/api/internal/product-jobs/route.js');
  for (const authorization of ['', 'Bearer bad']) {
    assert.equal((await POST(new Request('https://shop.example/api/internal/product-jobs', { method: 'POST', headers: { authorization } }))).status, 401);
  }
});

test('failed upload resumes from the successful writing checkpoint without generating prose again', async () => {
  const goodUpload = globalThis.__jobUpload; let failUpload = true;
  globalThis.__jobUpload = async args => { if (failUpload) throw new Error('temporary upload failure'); return goodUpload(args); };
  const job = await service.startProductJob(ctx, input());
  for (let i = 0; i < 3; i++) await service.runProductJobStage();
  const pending = await Job.findById(job.jobId).lean();
  assert.equal(pending.status, 'queued'); assert.equal(pending.stage, 'write');
  assert.ok(pending.data.writing); assert.equal(calls.length, 2);
  failUpload = false;
  await Job.updateOne({ _id: job.jobId }, { $set: { nextRunAt: new Date(0) } });
  const result = await runToEnd(job.jobId);
  assert.equal(result.status, 'completed', JSON.stringify(result));
  assert.equal(calls.length, 3); assert.equal(uploads, 1);
});

test('transaction rolls back the product when the completion checkpoint cannot be written', async () => {
  const job = await service.startProductJob(ctx, input());
  for (let i = 0; i < 4; i++) await service.runProductJobStage();
  const count = await Product.countDocuments();
  const update = Job.updateOne;
  Job.updateOne = function(filter, change, options) {
    if (options?.session && change.$set?.status === 'completed') throw new Error('test commit interruption');
    return update.call(this, filter, change, options);
  };
  try { await service.runProductJobStage(); } finally { Job.updateOne = update; }
  assert.equal(await Product.countDocuments(), count);
  assert.equal((await Job.findById(job.jobId)).status, 'failed');
});

test('review refusal is bounded to two revisions and never persists the rejected draft', async () => {
  const originalAI = globalThis.__jobAI;
  globalThis.__jobAI = async request => {
    const result = await originalAI(request);
    if (request.system.includes('Independently audit')) result.value = { ...review(), approved: false,
      checks: { ...review().checks, depth: false }, issues: [{ field: 'longDescription', problem: 'Still too generic', fix: 'Explain specific interactions', requiresInput: false }] };
    return result;
  };
  const count = await Product.countDocuments(); const job = await service.startProductJob(ctx, input());
  const result = await runToEnd(job.jobId);
  assert.equal(result.status, 'needs_input'); assert.equal(result.revisions, 2);
  assert.equal(await Product.countDocuments(), count);
});

test('an image outside the candidate source is rejected before any upload', async () => {
  const originalAI = globalThis.__jobAI;
  globalThis.__jobAI = async request => {
    const result = await originalAI(request);
    if (result.value.imageUrls) result.value.imageUrls = ['https://unrelated.example/wrong.jpg'];
    return result;
  };
  const job = await service.startProductJob(ctx, input());
  assert.equal((await runToEnd(job.jobId)).status, 'failed'); assert.equal(uploads, 0);
});

test('upload uses bounded binary transfer and stable job filename, never a remote URL upload', async () => {
  const { uploadJobImage } = await import('../src/lib/productJobs/images.js');
  const result = await uploadJobImage({ buffer: Buffer.from('bytes'), mime: 'image/jpeg', fileName: 'job-unique.jpg' }, {
    env: { IMAGEKIT_PRIVATE_KEY: 'test-image-key' }, fetchImpl: async (url, request) => {
      assert.equal(url, 'https://upload.imagekit.io/api/v1/files/upload');
      assert.equal(request.redirect, 'error'); assert.ok(request.signal);
      assert.equal(await request.body.get('file').text(), 'bytes');
      assert.equal(request.body.get('useUniqueFileName'), 'false');
      return Response.json({ url: 'https://ik.imagekit.io/test/job-unique.jpg', fileId: 'file-unique' });
    },
  });
  assert.equal(result.fileId, 'file-unique');
});
