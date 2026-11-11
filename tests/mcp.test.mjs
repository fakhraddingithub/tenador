import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { publicAddress, sourceUrl, extractSource, validImage, downloadPublic } from '../src/lib/mcp/source.js';
import { secret, digest, validateAuthorization } from '../src/lib/mcp/security.js';
register('./mcpHooks.mjs', import.meta.url);

let repl, Grant, productServer, tokenRequest, authenticateMcp, category, brand, userId, sport;
const reviewArgs = () => ({ analystId: 'host-agent-analyst', writerId: 'host-agent-writer', reviewerId: 'host-agent-reviewer', review: { approved: true, checks: { facts: true, identity: true, coherence: true, rules: true, depth: true, images: true }, issues: [], editorialNotes: ['Reviewed exact draft against source.'] } });
const ctx = { isAdmin: true, can: () => true, permissions: ['products.create', 'products.edit'] };
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri());
  await import('../models/registerModels.js');
  Grant = mongoose.model('McpGrant'); await Grant.init();
  ({ productServer } = await import('../src/lib/mcp/products.js'));
  ({ tokenRequest } = await import('../src/lib/mcp/oauth.js'));
  ({ authenticateMcp } = await import('../src/lib/mcp/auth.js'));
  userId = String(new mongoose.Types.ObjectId()); ctx.userId = userId;
  globalThis.__mcpContext = async () => ctx;
  process.env.MCP_PUBLIC_ORIGIN = 'https://shop.example';
  process.env.MCP_CLIENT_ID = 'chatgpt'; process.env.MCP_CLIENT_SECRET = secret();
  process.env.MCP_REDIRECT_URIS = 'https://chatgpt.com/callback';
  sport = await mongoose.model('Sport').create({ name: 'Tennis', title: 'تنیس' });
  category = await mongoose.model('Category').create({ name: 'racket', title: 'راکت', sport: sport._id });
  brand = await mongoose.model('Brand').create({ name: 'Wilson', title: 'ویلسون' });
  await mongoose.model('ProductPromptConfig').create({ key: 'product', base: [{ section: 'task', rules: ['ADMIN-MCP-RULE'] }] });
});
after(async () => { await mongoose.disconnect(); await repl?.stop(); });

test('public importer blocks private, loopback, mapped, link local and non-HTTPS targets', async () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.1.1', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '0.0.0.0']) assert.equal(publicAddress(address), false, address);
  assert.equal(publicAddress('8.8.8.8'), true);
  for (const url of ['http://example.com', 'file:///etc/passwd', 'https://user:pass@example.com', 'https://example.com:8080']) assert.throws(() => sourceUrl(url));
  await assert.rejects(downloadPublic('https://127.0.0.1/test'));
});
test('reference extractor reads Product JSON-LD, relative photos and visible text without scripts', () => {
  const result = extractSource(`<title>Racket</title><script type="application/ld+json">{"@type":"Product","name":"Blade","image":["/a.jpg"],"description":"Graphite racket"}</script><script>EVIL_INSTRUCTION</script><main>Product specs<img src="/b.jpg"></main>`, 'https://vendor.example/product');
  assert.match(result.rawContent, /Blade/); assert.match(result.rawContent, /Product specs/);
  assert.doesNotMatch(result.rawContent, /EVIL_INSTRUCTION/);
  assert.deepEqual(result.images, ['https://vendor.example/a.jpg', 'https://vendor.example/b.jpg']);
  assert.equal(validImage(Buffer.from('<script>bad</script>'), 'image/jpeg'), false);
});
test('OAuth rejects unregistered redirects and requires S256', () => {
  const c = { clientId: 'c', redirects: ['https://chatgpt.com/callback'], resource: 'https://shop.example/api/mcp' };
  const p = new URLSearchParams({ client_id: 'c', redirect_uri: c.redirects[0], response_type: 'code', code_challenge_method: 'S256', code_challenge: digest(secret()) });
  assert.ok(validateAuthorization(p, c)); p.set('redirect_uri', 'https://evil.example'); assert.throws(() => validateAuthorization(p, c));
  p.set('redirect_uri', c.redirects[0]); p.set('code_challenge_method', 'plain'); assert.throws(() => validateAuthorization(p, c));
});
test('OAuth discovery works before callback setup while authorization remains closed', async () => {
  const saved = process.env.MCP_REDIRECT_URIS;
  process.env.MCP_REDIRECT_URIS = '';
  try {
    const { GET: metadata } = await import('../src/app/.well-known/oauth-authorization-server/route.js');
    const { GET: resource } = await import('../src/app/.well-known/oauth-protected-resource/api/mcp/route.js');
    const { GET, POST } = await import('../src/app/api/mcp/route.js');
    const { config } = await import('../src/lib/mcp/security.js');
    assert.equal((await metadata()).status, 200);
    assert.equal((await resource()).status, 200);
    const response = await GET(new Request('https://shop.example/api/mcp'));
    assert.equal(response.status, 401);
    assert.match(response.headers.get('www-authenticate'), /oauth-protected-resource/);
    assert.equal((await POST(new Request('https://shop.example/api/mcp', { method: 'POST' }))).status, 400);
    assert.throws(() => validateAuthorization(new URLSearchParams({ client_id: 'chatgpt', redirect_uri: 'https://chatgpt.com/callback', response_type: 'code', code_challenge_method: 'S256', code_challenge: digest(secret()) }), config()));
  } finally { process.env.MCP_REDIRECT_URIS = saved; }
});
const oauthRequest = body => new Request('https://shop.example/api/mcp/oauth/token', { method: 'POST', body: new URLSearchParams({ client_id: 'chatgpt', client_secret: process.env.MCP_CLIENT_SECRET, ...body }) });
test('browser login returns to the same OAuth request and still requires consent', async () => {
  const { GET, POST } = await import('../src/app/api/mcp/oauth/authorize/route.js');
  const params = new URLSearchParams({ client_id: 'chatgpt', redirect_uri: 'https://chatgpt.com/callback', response_type: 'code',
    code_challenge_method: 'S256', code_challenge: digest(secret()), state: 'browser-state&+/<test>', scope: 'products' });
  globalThis.__mcpContext = async () => null;
  let login;
  try {
    const response = await GET(new Request(`https://shop.example/api/mcp/oauth/authorize?${params}`));
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    const html = await response.text();
    login = new URL(html.match(/href="([^"]+)"/)[1].replaceAll('&amp;', '&'), 'https://shop.example');
    assert.equal(login.pathname, '/login-register');
  } finally { globalThis.__mcpContext = async () => ctx; }
  const returned = new URL(login.searchParams.get('callbackUrl'), 'https://shop.example');
  assert.equal(returned.pathname, '/api/mcp/oauth/authorize');
  assert.deepEqual(Object.fromEntries(returned.searchParams), Object.fromEntries(params));
  ctx.user = { name: 'Admin' };
  const consentPage = await GET(new Request(returned));
  assert.equal(consentPage.status, 200);
  const consent = (await consentPage.text()).match(/name="consent" value="([^"]+)"/)[1];
  const result = await POST(new Request(returned, { method: 'POST', headers: { origin: 'https://shop.example' },
    body: new URLSearchParams({ consent, decision: 'allow' }) }));
  assert.equal(result.status, 303);
  assert.equal(new URL(result.headers.get('location')).searchParams.get('state'), params.get('state'));
});
test('authorization needs same-origin consent bound to the current admin and consumes it once', async () => {
  const { GET, POST } = await import('../src/app/api/mcp/oauth/authorize/route.js');
  const params = new URLSearchParams({ client_id: 'chatgpt', redirect_uri: 'https://chatgpt.com/callback', response_type: 'code', code_challenge_method: 'S256', code_challenge: digest(secret()), state: 'client-state' });
  const url = `https://shop.example/api/mcp/oauth/authorize?${params}`;
  ctx.user = { name: 'Admin' };
  const page = await GET(new Request(url)); assert.equal(page.status, 200);
  // Native HTML form POSTs under no-referrer send Origin: null; keep the
  // browser-compatible policy while continuing to reject opaque origins.
  assert.equal(page.headers.get('referrer-policy'), 'strict-origin');
  assert.match(page.headers.get('content-security-policy'), /form-action 'self' https:\/\/chatgpt\.com;/);
  const consent = (await page.text()).match(/name="consent" value="([^"]+)"/)[1];
  const req = origin => new Request(url, { method: 'POST', headers: { origin }, body: new URLSearchParams({ consent, decision: 'allow' }) });
  assert.equal((await POST(req('https://evil.example'))).status, 403);
  assert.equal((await POST(req('null'))).status, 403);
  const withoutOrigin = req('https://shop.example'); withoutOrigin.headers.delete('origin');
  assert.equal((await POST(withoutOrigin)).status, 403);
  ctx.userId = String(new mongoose.Types.ObjectId());
  assert.equal((await POST(req('https://shop.example'))).status, 400); ctx.userId = userId;
  const accepted = await POST(req('https://shop.example')); assert.equal(accepted.status, 303);
  const callback = new URL(accepted.headers.get('location'));
  assert.equal(callback.origin, 'https://chatgpt.com'); assert.equal(callback.searchParams.get('state'), 'client-state'); assert.ok(callback.searchParams.get('code'));
  assert.equal((await POST(req('https://shop.example'))).status, 400);
});
test('OAuth code is PKCE-bound and single-use; refresh rotates; revocation invalidates the family', async () => {
  const code = secret(), verifier = secret();
  await Grant.create({ key: digest(code), kind: 'code', userId, expiresAt: new Date(Date.now() + 60000), data: { code_challenge: digest(verifier), redirect_uri: 'https://chatgpt.com/callback', client_id: 'chatgpt' } });
  const body = { grant_type: 'authorization_code', code, redirect_uri: 'https://chatgpt.com/callback', code_verifier: verifier };
  assert.equal((await tokenRequest(oauthRequest({ ...body, code_verifier: secret() }))).status, 400);
  const response = await tokenRequest(oauthRequest(body)); assert.equal(response.status, 200);
  const tokens = await response.json();
  assert.equal((await tokenRequest(oauthRequest(body))).status, 400);
  const request = new Request('https://shop.example/api/mcp', { headers: { authorization: `Bearer ${tokens.access_token}` } });
  assert.equal((await authenticateMcp(request)).userId, userId);
  ctx.isAdmin = false; assert.equal(await authenticateMcp(request), null); ctx.isAdmin = true;
  const rotated = await tokenRequest(oauthRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token }));
  assert.equal(rotated.status, 200);
  assert.equal((await tokenRequest(oauthRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token }))).status, 400);
  const fresh = await rotated.json();
  assert.equal((await tokenRequest(oauthRequest({ token: fresh.refresh_token }), true)).status, 200);
  assert.equal(await authenticateMcp(request), null);
});
async function connect(context = ctx) {
  const [a,b] = InMemoryTransport.createLinkedPair(); const server = productServer(context);
  const client = new Client({ name: 'test', version: '1' }); await server.connect(b); await client.connect(a);
  return { client, close: async () => { await client.close(); await server.close(); } };
}
// start_product_job is the only way to prepare; a fresh requestKey per call keeps tests independent.
const prepare = async (client, args) => (await call(client, 'start_product_job', { requestKey: secret().slice(0, 24), ...args })).preparation;
const call = async (client, name, args) => {
  const result = await client.callTool({ name, arguments: args });
  return { ...JSON.parse(result.content[0].text), isError: result.isError };
};
test('MCP tools enforce permissions through actual protocol calls', async () => {
  const { client, close } = await connect({ ...ctx, can: () => false });
  try {
    assert.equal((await client.listTools()).tools.length, 12);
    assert.equal((await call(client, 'search_products', { query: 'test' })).isError, true);
  } finally { await close(); }
});
test('HTTP endpoint negotiates MCP, lists tools and rejects missing credentials', async () => {
  const { POST } = await import('../src/app/api/mcp/route.js');
  const access = secret();
  await Grant.create({ key: digest(access), kind: 'access', userId, data: { resource: 'https://shop.example/api/mcp' }, expiresAt: new Date(Date.now() + 60000) });
  const request = (body, token = access) => new Request('https://shop.example/api/mcp', {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body),
  });
  const init = await POST(request({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' } } }));
  assert.equal(init.status, 200); assert.equal((await init.json()).result.serverInfo.name, 'tenador-products');
  const list = await POST(request({ jsonrpc: '2.0', id: 2, method: 'tools/list' }));
  assert.equal(list.status, 200); assert.equal((await list.json()).result.tools.length, 12);
  const denied = await POST(request({ jsonrpc: '2.0', id: 3, method: 'tools/list' }, 'invalid'));
  assert.equal(denied.status, 401); assert.match(denied.headers.get('www-authenticate'), /oauth-protected-resource/);
});
test('anonymous clients discover tools but every tool requests OAuth without reading or writing data', async () => {
  const { POST } = await import('../src/app/api/mcp/route.js');
  const request = body => new Request('https://shop.example/api/mcp', {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body),
  });
  const init = await POST(request({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'anonymous', version: '1' } } }));
  assert.equal(init.status, 200);
  const listed = await POST(request({ jsonrpc: '2.0', id: 2, method: 'tools/list' }));
  assert.equal(listed.status, 200);
  const tools = (await listed.json()).result.tools;
  assert.equal(tools.length, 12);
  for (const tool of tools) assert.deepEqual(tool._meta.securitySchemes, [{ type: 'oauth2', scopes: ['products'] }]);
  const key = secret(), objectId = String(new mongoose.Types.ObjectId());
  const cases = {
    start_product_job: { requestKey: 'oauth-test-request', categoryId: objectId, rawContent: 'x'.repeat(60) },
    get_product_job: { jobId: objectId }, resume_product_job: { jobId: objectId, clarification: 'x'.repeat(60) },
    list_product_categories: {}, search_products: { query: 'Wilson' },
    import_product_images: { preparationId: key, urls: ['https://vendor.example/photo.jpg'] },
    create_product: { preparationId: key, json: '{}' },
    review_product_draft: { preparationId: key, json: '{}', ...reviewArgs() },
    validate_product_draft: { preparationId: key, json: '{}' },
    preview_product_regeneration: { preparationId: key, json: '{}' },
    apply_product_regeneration: { preparationId: key, json: '{}', expectedUpdatedAt: new Date().toISOString() },
    replace_product_images: { preparationId: key, mainImage: 'https://vendor.example/photo.jpg', gallery: [], expectedUpdatedAt: new Date().toISOString() },
  };
  const before = await Grant.countDocuments();
  for (const [name, args] of Object.entries(cases)) {
    const r = await POST(request({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name, arguments: args } }));
    assert.equal(r.status, 200);
    const result = (await r.json()).result;
    assert.equal(result.isError, true);
    assert.match(result._meta['mcp/www_authenticate'][0], /error="insufficient_scope"/);
    assert.match(result._meta['mcp/www_authenticate'][0], /error_description=/);
  }
  assert.equal(await Grant.countDocuments(), before);
});
test('prepare uses admin rules; create requires imported photos, creates inactive, and retry does not duplicate', async () => {
  const { client, close } = await connect();
  try {
    const source = 'Wilson graphite tennis racket, specifications and full product reference text.';
    const prepared = await prepare(client, { categoryId: String(category._id), rawContent: source });
    assert.match(prepared.prompt, /ADMIN-MCP-RULE/);
    // The source comes back once, in rawContent; the prompt points at it.
    assert.equal(prepared.rawContent, source); assert.ok(!prepared.prompt.includes(source)); assert.match(prepared.prompt, /identical to the rawContent field/);
    const draft = { name: 'MCP Racket', shortDescription: 'short', longDescription: 'long description', brand: String(brand._id), basePrice: 100, mainImage: 'https://ik.imagekit.io/test/photo.jpg', attributes: {}, technicalStats: {}, isActive: true };
    const args = { preparationId: prepared.preparationId, json: JSON.stringify(draft) };
    assert.equal((await call(client, 'create_product', args)).isError, true);
    globalThis.__mcpDownload = async url => {
      if (url.endsWith('missing.jpg')) throw new Error('private vendor error');
      return { buffer: Buffer.from([255,216,255,0]), mime: 'image/jpeg' };
    };
    let uploadCount = 0;
    globalThis.__mcpUpload = async args => {
      assert.ok(Buffer.isBuffer(args.file)); assert.equal(args.folder, '/product'); uploadCount++;
      return { url: draft.mainImage, fileId: 'imagekit-id' };
    };
    const imported = await call(client, 'import_product_images', { preparationId: prepared.preparationId, urls: ['https://vendor.example/photo.jpg', 'https://vendor.example/missing.jpg'] });
    assert.equal(imported.images[0].url, draft.mainImage); assert.ok(imported.images[1].error); assert.doesNotMatch(JSON.stringify(imported), /private vendor error/);
    await call(client, 'import_product_images', { preparationId: prepared.preparationId, urls: ['https://vendor.example/photo.jpg'] });
    assert.equal(uploadCount, 1);
    delete globalThis.__mcpDownload; delete globalThis.__mcpUpload;
    assert.equal((await call(client, 'review_product_draft', { ...args, ...reviewArgs(), reviewerId: 'host-agent-writer' })).isError, true);
    assert.equal((await call(client, 'review_product_draft', { ...args, ...reviewArgs() })).approved, true);
    assert.equal((await call(client, 'create_product', { ...args, json: JSON.stringify({ ...draft, name: 'Changed after review' }) })).isError, true);
    const created = await call(client, 'create_product', args);
    assert.equal(created.saved, true, JSON.stringify(created));
    assert.equal(created.product.isActive, false);
    assert.equal((await call(client, 'create_product', args)).alreadyCreated, true);
    assert.equal(await mongoose.model('Product').countDocuments({ name: draft.name }), 1);
    const p = await prepare(client, { productId: created.product._id, rawContent: 'Wilson graphite tennis racket, updated specifications and reference text.' });
    const regen = { preparationId: p.preparationId, json: JSON.stringify({ shortDescription: 'new text' }) };
    assert.equal((await call(client, 'apply_product_regeneration', { ...regen, expectedUpdatedAt: p.original.updatedAt })).isError, true);
    const preview = await call(client, 'preview_product_regeneration', regen);
    assert.equal((await call(client, 'apply_product_regeneration', { ...regen, json: JSON.stringify({ shortDescription: 'unreviewed' }), expectedUpdatedAt: preview.updatedAt })).isError, true);
    assert.equal((await call(client, 'review_product_draft', { ...regen, ...reviewArgs() })).approved, true);
    const applied = await call(client, 'apply_product_regeneration', { ...regen, expectedUpdatedAt: preview.updatedAt });
    assert.equal(applied.saved, true, JSON.stringify(applied));
    const saved = await mongoose.model('Product').findById(created.product._id).lean();
    assert.equal(saved.shortDescription, 'new text'); assert.equal(saved.mainImage, draft.mainImage);
    assert.equal((await call(client, 'apply_product_regeneration', { ...regen, expectedUpdatedAt: preview.updatedAt })).isError, true);
    const picture = 'https://ik.imagekit.io/test/replacement.jpg';
    await Grant.updateOne({ key: digest(p.preparationId) }, { $push: { 'data.images': { url: picture } } });
    const images = { preparationId: p.preparationId, mainImage: picture, gallery: [], expectedUpdatedAt: preview.updatedAt };
    assert.equal((await call(client, 'replace_product_images', images)).isError, true);
    assert.equal((await call(client, 'replace_product_images', { ...images, expectedUpdatedAt: saved.updatedAt.toISOString() })).saved, true);
    await mongoose.model('ProductPromptConfig').updateOne({ key: 'product' }, { $set: { base: [{ section: 'task', rules: ['CHANGED-ADMIN-RULE'] }] } });
    const stale = await call(client, 'preview_product_regeneration', regen);
    assert.equal(stale.isError, true); assert.match(stale.error, /قواعد پنل/);
  } finally { await close(); }
});

test('Codex job commits the reviewed product atomically and recovers retries without model keys', async () => {
  const { client, close } = await connect();
  try {
    const input = { requestKey: 'codex-product-job-1', categoryId: String(category._id), rawContent: 'Exact Wilson racket reference with graphite frame and verified catalogue information.' };
    const job = await call(client, 'start_product_job', input);
    assert.equal(job.status, 'awaiting_chat', JSON.stringify(job));
    assert.equal(job.preparation.rawContent, input.rawContent);
    assert.match(job.preparation.workflow, /native subagent/);
    assert.equal((await call(client, 'start_product_job', input)).preparation.preparationId, job.preparation.preparationId);
    const draft = { name: 'Codex coordinated racket', shortDescription: 'Verified short description', longDescription: 'Detailed product description', brand: String(brand._id), basePrice: 100, mainImage: 'https://ik.imagekit.io/test/codex.jpg', attributes: {}, technicalStats: {} };
    const args = { preparationId: job.preparation.preparationId, json: JSON.stringify(draft) };
    await Grant.updateOne({ key: digest(args.preparationId) }, { $push: { 'data.images': { url: draft.mainImage } } });
    const unsafe = await call(client, 'review_product_draft', { ...args, json: JSON.stringify({ ...draft, longDescription: '<p onclick="bad()">Description</p><script>bad()</script>' }), ...reviewArgs() });
    assert.equal(unsafe.approved, false);
    assert.doesNotMatch(unsafe.normalizedJson, /onclick|<script|bad\(\)/);
    assert.equal((await call(client, 'create_product', { ...args, json: unsafe.normalizedJson })).isError, true);
    const rejected = reviewArgs(); rejected.review.approved = false; rejected.review.checks.depth = false;
    assert.equal((await call(client, 'review_product_draft', { ...args, ...rejected })).approved, false);
    assert.equal((await call(client, 'create_product', args)).isError, true);
    assert.equal((await call(client, 'review_product_draft', { ...args, ...reviewArgs() })).approved, true);
    const saved = await call(client, 'create_product', args); assert.equal(saved.saved, true, JSON.stringify(saved));
    const status = await call(client, 'get_product_job', { jobId: job.jobId });
    assert.equal(status.status, 'completed'); assert.equal(status.result.productId, saved.product._id);
    assert.equal((await call(client, 'start_product_job', input)).result.productId, saved.product._id);
    assert.equal(await mongoose.model('Product').countDocuments({ name: draft.name }), 1);
    const regenJob = await call(client, 'start_product_job', { requestKey: 'codex-regenerate-job', productId: saved.product._id, rawContent: input.rawContent });
    const regen = { preparationId: regenJob.preparation.preparationId, json: JSON.stringify({ shortDescription: 'More useful regenerated text' }) };
    const badPrice = { ...regen, json: JSON.stringify({ basePrice: 999 }) };
    assert.equal((await call(client, 'review_product_draft', { ...badPrice, ...reviewArgs() })).isError, true);
    assert.equal((await call(client, 'review_product_draft', { ...regen, ...reviewArgs() })).approved, true);
    const preview = await call(client, 'preview_product_regeneration', regen);
    const applied = await call(client, 'apply_product_regeneration', { ...regen, expectedUpdatedAt: preview.updatedAt });
    assert.equal(applied.saved, true, JSON.stringify(applied));
    assert.equal((await call(client, 'get_product_job', { jobId: regenJob.jobId })).status, 'completed');
    const actual = await mongoose.model('Product').findById(saved.product._id);
    assert.equal(actual.basePrice, 100); assert.equal(actual.mainImage, draft.mainImage);
  } finally { await close(); }
});

test('validation runs before review; unrelated catalog edits keep a preparation; resume keeps key, images and an unchanged review', async () => {
  const { client, close } = await connect();
  try {
    const input = { requestKey: 'codex-resume-keeps-state', categoryId: String(category._id), rawContent: 'Exact Wilson racket reference with graphite frame for a resumable preparation test.' };
    const job = await call(client, 'start_product_job', input);
    const key = job.preparation.preparationId;
    const draft = { name: 'Resumable racket', shortDescription: 'Short text', longDescription: 'Long description', brand: String(brand._id), basePrice: 100, mainImage: 'https://ik.imagekit.io/test/resume.jpg', attributes: {}, technicalStats: {} };
    const args = { preparationId: key, json: JSON.stringify(draft) };
    const grant = () => Grant.findOne({ key: digest(key) }).lean();

    // The save's own checks run before review, and review refuses JSON that fails them.
    const notImported = await call(client, 'validate_product_draft', args);
    assert.equal(notImported.valid, false); assert.ok(notImported.fieldErrors.mainImage);
    const refused = await call(client, 'review_product_draft', { ...args, ...reviewArgs() });
    assert.equal(refused.approved, false); assert.equal(refused.valid, false);
    assert.equal((await grant()).data.reviewHash, undefined);
    globalThis.__mcpDownload = async () => ({ buffer: Buffer.from([255,216,255,0]), mime: 'image/jpeg' });
    globalThis.__mcpUpload = async () => ({ url: draft.mainImage, fileId: 'resume-id' });
    await call(client, 'import_product_images', { preparationId: key, urls: ['https://vendor.example/resume.jpg'] });
    delete globalThis.__mcpDownload; delete globalThis.__mcpUpload;
    const negative = await call(client, 'validate_product_draft', { ...args, json: JSON.stringify({ ...draft, basePrice: -5 }) });
    assert.equal(negative.valid, false, JSON.stringify(negative)); assert.ok(negative.fieldErrors?.basePrice, JSON.stringify(negative));
    const html = await call(client, 'validate_product_draft', { ...args, json: JSON.stringify({ ...draft, longDescription: '<p onclick="x()">Long</p>' }) });
    assert.equal(html.valid, false); assert.doesNotMatch(html.normalizedJson, /onclick/);
    assert.equal((await call(client, 'validate_product_draft', args)).valid, true);
    assert.equal((await call(client, 'review_product_draft', { ...args, ...reviewArgs() })).approved, true);

    // A brand added elsewhere changes the full prompt but not the rules: still valid, still reviewed.
    await mongoose.model('Brand').create({ name: 'Head', title: 'هد' });
    assert.equal((await call(client, 'validate_product_draft', args)).valid, true);

    // Using the preparation slides its expiry.
    await Grant.updateOne({ key: digest(key) }, { $set: { expiresAt: new Date(Date.now() + 5000) } });
    await call(client, 'validate_product_draft', args);
    assert.ok((await grant()).expiresAt > new Date(Date.now() + 3000000));

    // Resume without changes: same key, same images, review kept.
    assert.equal((await call(client, 'resume_product_job', { jobId: job.jobId })).preparation.preparationId, key);
    assert.equal((await grant()).data.images.length, 1); assert.equal((await grant()).data.reviewHash, digest(args.json));

    // A clarification changes the source: same key and images, review dropped.
    assert.equal((await call(client, 'resume_product_job', { jobId: job.jobId, clarification: 'Confirmed by admin: 2026 edition.' })).preparation.preparationId, key);
    assert.equal((await grant()).data.images.length, 1); assert.equal((await grant()).data.reviewHash, undefined);
    assert.equal((await call(client, 'create_product', args)).isError, true);

    // The preparation record is gone (TTL): the renewed one re-adopts the job's images.
    await Grant.deleteOne({ key: digest(key) });
    await call(client, 'resume_product_job', { jobId: job.jobId });
    assert.equal((await grant()).data.images[0].url, draft.mainImage);
    assert.equal((await call(client, 'review_product_draft', { ...args, ...reviewArgs() })).approved, true);
    const saved = await call(client, 'create_product', args);
    assert.equal(saved.saved, true, JSON.stringify(saved)); assert.equal(saved.product.mainImage, draft.mainImage);
  } finally { await close(); }
});

test('annotations mark only overwrites destructive, quota splits reads from writes, variantMeta is kept and checked, the job keeps the review', async () => {
  const { client, close } = await connect();
  try {
    const tools = Object.fromEntries((await client.listTools()).tools.map(t => [t.name, t.annotations]));
    assert.deepEqual(Object.keys(tools).filter(n => tools[n].destructiveHint).sort(), ['apply_product_regeneration', 'replace_product_images']);
    assert.equal(tools.create_product.readOnlyHint, false); assert.equal(tools.create_product.idempotentHint, true);
    assert.equal(tools.search_products.readOnlyHint, true); assert.equal(tools.search_products.openWorldHint, false);
    for (const name of ['start_product_job', 'resume_product_job', 'import_product_images']) assert.equal(tools[name].openWorldHint, true, name);
    assert.equal(tools.prepare_product, undefined);

    const scopes = [];
    globalThis.__mcpQuota = async (_user, _now, options) => { scopes.push(options.scope); };
    await call(client, 'search_products', { query: 'nothing' });
    const shoes = await mongoose.model('Category').create({ name: 'shoes', title: 'کفش', sport: sport._id, variantAttributes: [{ name: 'size', label: 'سایز', required: true }] });
    const job = await call(client, 'start_product_job', { requestKey: 'variant-meta-job', categoryId: String(shoes._id), rawContent: 'Wilson tennis shoe reference with sizes 42 and 43 in EU and US units, verified catalogue.' });
    delete globalThis.__mcpQuota;
    assert.deepEqual(scopes, ['mcp-read:', 'mcp:']);

    const key = job.preparation.preparationId, image = 'https://ik.imagekit.io/test/shoe.jpg', sizeImage = 'https://ik.imagekit.io/test/shoe-42.jpg';
    await Grant.updateOne({ key: digest(key) }, { $push: { 'data.images': { $each: [{ url: image }, { url: sizeImage }] } } });
    const variantMeta = { size: { 42: { units: { EU: '42', US: '8.5' }, images: [sizeImage] }, 43: { units: { EU: '43', US: '9.5' } } } };
    const draft = { name: 'Variant meta shoe', shortDescription: 'Short', longDescription: 'Long description', brand: String(brand._id), basePrice: 100, mainImage: image,
      attributes: {}, technicalStats: {}, variantOptions: { size: ['42', '43'] }, selectedCombos: ['size=42', 'size=43'], variantMeta };
    const json = d => ({ preparationId: key, json: JSON.stringify(d) });
    for (const bad of [
      { size: { 44: { units: { EU: '44' } } } },                          // value not in variantOptions
      { colour: { red: { units: {} } } },                                 // attribute not in variantOptions
      { size: { 42: { units: { EU: 42 } } } },                            // unit value not a string
      { size: { 42: { images: ['https://evil.example/x.jpg'] } } },      // image not imported here
      { size: { 42: { price: 5 } } },                                     // undocumented key
    ]) assert.equal((await call(client, 'validate_product_draft', json({ ...draft, variantMeta: bad }))).valid, false, JSON.stringify(bad));
    assert.equal((await call(client, 'validate_product_draft', json(draft))).valid, true);
    assert.equal((await call(client, 'review_product_draft', { ...json(draft), ...reviewArgs() })).approved, true);
    const saved = await call(client, 'create_product', json(draft));
    assert.equal(saved.saved, true, JSON.stringify(saved));
    assert.deepEqual((await mongoose.model('Product').findById(saved.product._id).lean()).variantMeta, variantMeta);

    // The preparation record expires; the completed job keeps the review evidence for good.
    const done = await call(client, 'get_product_job', { jobId: job.jobId });
    assert.equal(done.result.review.agents.reviewer, 'host-agent-reviewer');
    assert.equal(done.result.review.report.approved, true);
    assert.equal(done.result.review.jsonHash, digest(JSON.stringify(draft)));
    assert.ok(done.result.review.reviewedAt);
  } finally { await close(); }
});
