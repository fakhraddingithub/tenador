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
test('authorization needs same-origin consent bound to the current admin and consumes it once', async () => {
  const { GET, POST } = await import('../src/app/api/mcp/oauth/authorize/route.js');
  const params = new URLSearchParams({ client_id: 'chatgpt', redirect_uri: 'https://chatgpt.com/callback', response_type: 'code', code_challenge_method: 'S256', code_challenge: digest(secret()), state: 'client-state' });
  const url = `https://shop.example/api/mcp/oauth/authorize?${params}`;
  ctx.user = { name: 'Admin' };
  const page = await GET(new Request(url)); assert.equal(page.status, 200);
  const consent = (await page.text()).match(/name="consent" value="([^"]+)"/)[1];
  const req = origin => new Request(url, { method: 'POST', headers: { origin }, body: new URLSearchParams({ consent, decision: 'allow' }) });
  assert.equal((await POST(req('https://evil.example'))).status, 403);
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
const call = async (client, name, args) => {
  const result = await client.callTool({ name, arguments: args });
  return { ...JSON.parse(result.content[0].text), isError: result.isError };
};
test('MCP tools enforce permissions through actual protocol calls', async () => {
  const { client, close } = await connect({ ...ctx, can: () => false });
  try {
    assert.equal((await client.listTools()).tools.length, 8);
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
  assert.equal(list.status, 200); assert.equal((await list.json()).result.tools.length, 8);
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
  assert.equal(tools.length, 8);
  for (const tool of tools) assert.deepEqual(tool._meta.securitySchemes, [{ type: 'oauth2', scopes: ['products'] }]);
  const key = secret(), objectId = String(new mongoose.Types.ObjectId());
  const cases = {
    list_product_categories: {}, search_products: { query: 'Wilson' },
    prepare_product: { categoryId: objectId, rawContent: 'x'.repeat(60) },
    import_product_images: { preparationId: key, urls: ['https://vendor.example/photo.jpg'] },
    create_product: { preparationId: key, json: '{}' },
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
    const prepared = await call(client, 'prepare_product', { categoryId: String(category._id), rawContent: 'Wilson graphite tennis racket, specifications and full product reference text.' });
    assert.match(prepared.prompt, /ADMIN-MCP-RULE/);
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
    const created = await call(client, 'create_product', args);
    assert.equal(created.saved, true, JSON.stringify(created));
    assert.equal(created.product.isActive, false);
    assert.equal((await call(client, 'create_product', args)).alreadyCreated, true);
    assert.equal(await mongoose.model('Product').countDocuments({ name: draft.name }), 1);
    const p = await call(client, 'prepare_product', { productId: created.product._id, rawContent: 'Wilson graphite tennis racket, updated specifications and reference text.' });
    const regen = { preparationId: p.preparationId, json: JSON.stringify({ shortDescription: 'new text' }) };
    assert.equal((await call(client, 'apply_product_regeneration', { ...regen, expectedUpdatedAt: p.original.updatedAt })).isError, true);
    const preview = await call(client, 'preview_product_regeneration', regen);
    assert.equal((await call(client, 'apply_product_regeneration', { ...regen, json: JSON.stringify({ shortDescription: 'unreviewed' }), expectedUpdatedAt: preview.updatedAt })).isError, true);
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
