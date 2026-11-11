import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { readFile } from 'node:fs/promises';

const exec = promisify(execFile);
const worker = new URL('../workers/productJobsWorker.mjs', import.meta.url).href;
function run(code, env = {}) {
  return exec(process.execPath, ['--input-type=module', '-e', `${code}\nawait import(${JSON.stringify(worker)});`], {
    cwd: tmpdir(), timeout: 5000,
    env: { ...process.env, PRODUCT_JOBS_BASE_URL: 'https://shop.example', PRODUCT_JOBS_WORKER_SECRET: 'test-only',
      PRODUCT_JOBS_POLL_INTERVAL_MS: '60000', PRODUCT_JOBS_ERROR_INTERVAL_MS: '60000', ...env },
  });
}
test('SIGTERM drains the current request without starting another stage', async () => {
  const { stdout } = await run(`
    globalThis.fetch = async (url, options) => {
      if (url.href !== 'https://shop.example/api/internal/product-jobs' || options.headers.Authorization !== 'Bearer test-only') throw new Error('wrong request');
      process.emit('SIGTERM');
      await new Promise(r => setTimeout(r, 20));
      return Response.json({idle: false, jobId: 'test-job'});
    };
  `);
  assert.match(stdout, /Processed product job stage test-job/);
  assert.match(stdout, /stopped cleanly/);
});
test('SIGTERM interrupts a long idle wait promptly', async () => {
  const { stdout } = await run(`
    globalThis.fetch = async () => {
      setTimeout(() => process.emit('SIGTERM'), 30);
      return Response.json({idle: true});
    };
  `);
  assert.match(stdout, /stopped cleanly/);
});
test('invalid polling configuration fails before making a request', async () => {
  await assert.rejects(run(`globalThis.fetch = () => { throw new Error('unexpected network'); };`,
    { PRODUCT_JOBS_POLL_INTERVAL_MS: '0' }), error => /Invalid PRODUCT_JOBS_POLL_INTERVAL_MS/.test(error.stderr));
});
test('deployment keeps a single worker and a grace period longer than the stage request', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.deepEqual(config.daemons['product-jobs'].instances, { iad1: 1 });
  assert.ok(config.daemons['product-jobs'].terminationGracePeriodSeconds > 190);
  assert.equal(config.crons.length, 3);
  const dockerfile = await readFile(new URL('../workers/Dockerfile.products', import.meta.url), 'utf8');
  assert.match(dockerfile, /COPY --chown=node:node productJobsWorker.mjs/);
  assert.doesNotMatch(dockerfile, /COPY\s+\.\s|ARG\s+.*(?:SECRET|KEY)/);
});
