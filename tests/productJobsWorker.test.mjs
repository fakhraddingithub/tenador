import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
test('retired worker exits without env or network and is not deployed as daemon', () => {
 const output = execFileSync(process.execPath, ['workers/productJobsWorker.mjs'], { encoding: 'utf8', env: { PATH: process.env.PATH }, timeout: 5000 });
 assert.match(output, /retired/);
 assert.equal(JSON.parse(readFileSync('vercel.json', 'utf8')).daemons, undefined);
});
