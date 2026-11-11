import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { readFile } from 'node:fs/promises';
import { digest } from '../src/lib/mcp/security.js';
register('./mcpHooks.mjs', import.meta.url);
let repl, Job, Grant, service, ctx, calls;
const rawContent = 'Exact model 98 Espresso, weight 305 grams unstrung, graphite frame. Reference source.';
const input = () => ({ requestKey: 'test-request-key', categoryId: String(new mongoose.Types.ObjectId()), rawContent });
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri()); await import('../models/registerModels.js');
  Job = mongoose.model('ProductJob'); Grant = mongoose.model('McpGrant');
  await Job.init(); await Grant.init();
  service = await import('../src/lib/productJobs/service.js');
});
after(async () => { await mongoose.disconnect(); await repl?.stop(); });
beforeEach(async () => {
  await Job.deleteMany({}); await Grant.deleteMany({}); calls = 0;
  ctx = { userId: String(new mongoose.Types.ObjectId()), isAdmin: true, can: () => true };
  for (const key of ['PRODUCT_AI_MODEL', 'PRODUCT_JOBS_WORKER_SECRET', 'GEMINI_API_KEY', 'OPENAI_API_KEY']) delete process.env[key];
});
let lastJob;
async function prepare(args, job) {
  calls++; lastJob = job;
  const raw = args.rawContent || 'Extracted original source text from website for source-only jobs.';
  await Grant.updateOne({ key: digest(job.key), kind: 'preparation', userId: ctx.userId },
    { $set: { 'data.jobId': job.jobId, expiresAt: new Date(Date.now() + 3600000) } }, { upsert: true });
  return { preparationId: job.key, workflow: 'Native Codex subagents only', rawContent: raw + (args.clarification || ''), prompt: 'FULL ADMIN PROMPT' };
}
test('start requires no provider keys, preserves source, repeats same identity and never queues work', async () => {
  const args = input();
  const initial = await service.startProductJob(ctx, args, prepare);
  const again = await service.startProductJob(ctx, args, prepare);
  assert.equal(initial.status, 'awaiting_chat'); assert.equal(initial.executionMode, 'codex_agents');
  assert.equal(initial.jobId, again.jobId); assert.equal(initial.preparation.preparationId, again.preparation.preparationId);
  assert.equal(initial.preparation.rawContent, rawContent); assert.equal(calls, 1);
  assert.equal((await service.getProductJob(ctx, initial.jobId)).pollAfterSeconds, null);
  assert.deepEqual(await service.runProductJobStage(), { disabled: true, executionMode: 'codex_agents' });
  await assert.rejects(service.startProductJob(ctx, { ...args, rawContent: rawContent + ' changed' }, prepare), /requestKey/);
});
test('resume keeps the preparation key and imported images, preserves source/identity; completed jobs cannot restart', async () => {
  const args = input();
  const initial = await service.startProductJob(ctx, args, prepare);
  const image = { sourceUrl: 'https://vendor.example/a.jpg', url: 'https://ik.imagekit.io/t/a.jpg', fileId: 'f1' };
  await Job.updateOne({ _id: initial.jobId }, { $push: { 'data.images': image } });
  const stored = await Job.findById(initial.jobId).lean();
  const resumed = await service.resumeProductJob(ctx, initial.jobId, 'Confirmed exact year 2026', prepare);
  assert.equal(resumed.jobId, initial.jobId);
  assert.match(resumed.preparation.rawContent, /Exact model 98/);
  assert.match(resumed.preparation.rawContent, /Confirmed exact year/);
  assert.equal(lastJob.key, initial.preparation.preparationId);
  assert.deepEqual(lastJob.images, [image]);
  assert.equal((await Job.findById(initial.jobId)).data.reservedProductId, stored.data.reservedProductId);
  await Job.updateOne({ _id: initial.jobId }, { $set: { status: 'completed', result: { saved: true, productId: stored.data.reservedProductId } } });
  const done = await service.resumeProductJob(ctx, initial.jobId, 'please retry again', prepare);
  assert.equal(done.result.saved, true); assert.equal(calls, 2);
});
test('owner and current mutation permissions are required even for get/resume', async () => {
  const job = await service.startProductJob(ctx, input(), prepare);
  await assert.rejects(service.getProductJob({ ...ctx, userId: String(new mongoose.Types.ObjectId()) }, job.jobId), /پیدا/);
  await assert.rejects(service.getProductJob({ ...ctx, can: () => false }, job.jobId), /دسترسی/);
  await assert.rejects(service.resumeProductJob({ ...ctx, isAdmin: false }, job.jobId, 'long enough clarification', prepare), /دسترسی/);
});
test('legacy failed job uses its extracted source and does not call server model', async () => {
  const args = input();
  const old = await Job.create({ userId: ctx.userId, requestKey: 'legacy', inputHash: 'legacy', input: { ...args, rawContent: undefined, sourceUrl: 'https://example.com/old' }, status: 'failed', stage: 'analyse', data: { rawContent, reservedProductId: String(new mongoose.Types.ObjectId()) }, errorCode: 'GEMINI_MODEL_UNAVAILABLE' });
  assert.match((await service.getProductJob(ctx, old._id)).nextAction, /resume_product_job/);
  const resumed = await service.resumeProductJob(ctx, old._id, 'Continue from the original source', prepare);
  assert.equal(resumed.status, 'awaiting_chat'); assert.match(resumed.preparation.rawContent, /Exact model/);
  assert.equal((await Job.findById(old._id)).errorCode, null);
});
test('legacy active lease cannot be migrated while an old worker may commit', async () => {
  const args = input();
  const old = await Job.create({ userId: ctx.userId, requestKey: 'legacy', inputHash: 'legacy', input: args, status: 'running', leaseUntil: new Date(Date.now() + 60000) });
  await assert.rejects(service.resumeProductJob(ctx, old._id, 'continue in chat now', prepare), /قفل/);
  assert.equal(calls, 0);
});
test('source-only legacy job keeps the source URL when adding clarification', async () => {
  const old = await Job.create({ userId: ctx.userId, requestKey: 'legacy', inputHash: 'legacy', input: { ...input(), rawContent: undefined, sourceUrl: 'https://example.com/source' }, status: 'failed' });
  const resumed = await service.resumeProductJob(ctx, old._id, 'Confirmed model year', prepare);
  assert.match(resumed.preparation.rawContent, /Extracted original source/);
  assert.match(resumed.preparation.rawContent, /Confirmed model year/);
});
test('preparation failure releases lock and concurrent requests cannot prepare twice', async () => {
  const args = input();
  await assert.rejects(service.startProductJob(ctx, args, async () => { throw new Error('source temporarily unavailable'); }));
  const ok = await service.startProductJob(ctx, args, prepare); assert.equal(ok.status, 'awaiting_chat');
  await Job.updateOne({ _id: ok.jobId }, { $unset: { 'data.preparation': 1 }, $set: { 'data.preparingUntil': new Date(Date.now() + 60000), 'data.preparingLock': 'other' } });
  await assert.rejects(service.startProductJob(ctx, args, prepare), /هم‌زمان/);
});
test('retired HTTP worker returns 410 and service has no model provider imports', async () => {
  const { POST } = await import('../src/app/api/internal/product-jobs/route.js');
  const response = await POST(); assert.equal(response.status, 410);
  assert.equal((await response.json()).executionMode, 'codex_agents');
  const source = await readFile(new URL('../src/lib/productJobs/service.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /generateJson|@\/lib\/ai|fetch\(/);
});

test('expired preparation renews the same job and token without adding facts', async () => {
  const job = await service.startProductJob(ctx, input(), prepare);
  await Grant.updateOne({ key: digest(job.preparation.preparationId) }, { $set: { expiresAt: new Date(0) } });
  const state = await service.getProductJob(ctx, job.jobId);
  assert.equal(state.preparationExpired, true); assert.equal(state.preparation, undefined);
  assert.match(state.nextAction, /resume_product_job/);
  const renewed = await service.resumeProductJob(ctx, job.jobId, undefined, prepare);
  assert.equal(renewed.jobId, job.jobId);
  assert.equal(renewed.preparation.rawContent, rawContent);
  assert.equal(renewed.preparation.preparationId, job.preparation.preparationId);
  assert.equal((await service.getProductJob(ctx, job.jobId)).preparationExpired, false);
});
test('legacy queued job is fenced before external preparation starts', async () => {
  const old = await Job.create({ userId: ctx.userId, requestKey: 'legacy', inputHash: 'legacy', input: input(), status: 'queued' });
  await service.resumeProductJob(ctx, old._id, undefined, async (args, job) => {
    assert.equal((await Job.findById(old._id)).status, 'awaiting_chat');
    return prepare(args, job);
  });
});
