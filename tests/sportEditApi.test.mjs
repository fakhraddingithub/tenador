import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function updateSport(body, { denied = null, missing = false } = {}) {
  const calls = [];
  const sport = {
    name: 'tennis', title: 'تنیس', slug: 'tennis',
    description: 'description', icon: 'icon.svg', image: 'image.jpg',
    async save() { calls.push('save'); },
  };
  const deps = {
    'base/models/registerModels': {},
    'base/configs/db': { default: async () => { calls.push('connect'); } },
    'base/models/Sport': { default: {
      findById: async (id) => {
        assert.equal(id, 'sport-id');
        return missing ? null : sport;
      },
    } },
    'next/server': { NextResponse: {
      json: (body, options = {}) => ({ body, status: options.status || 200 }),
    } },
    '@/lib/revalidate': { revalidateContent: (tags) => calls.push([...tags]) },
    '@/lib/apiError': {
      apiError: (error, status, details) => ({ body: { error, ...details }, status }),
      handleApiError: (error) => { throw error; },
    },
    '@/lib/requireAdminPermission': { default: async (permission) => {
      assert.equal(permission, 'sports.edit');
      return { denied };
    } },
  };
  const context = vm.createContext({});
  const source = await readFile(new URL('../src/app/api/sports/[sportId]/route.js', import.meta.url), 'utf8');
  const mod = new vm.SourceTextModule(source, { context });
  await mod.link((name) => new vm.SyntheticModule(Object.keys(deps[name]), function () {
    for (const [key, value] of Object.entries(deps[name])) this.setExport(key, value);
  }, { context }));
  await mod.evaluate();
  const result = await mod.namespace.PUT({ json: async () => body }, {
    params: Promise.resolve({ sportId: 'sport-id' }),
  });
  return { result, sport, calls };
}

test('updates both names and invalidates sport/navigation caches', async () => {
  const { result, sport, calls } = await updateSport({ name: ' basketball ', title: ' بسکتبال ' });
  assert.equal(result.status, 200);
  assert.equal(sport.name, 'basketball');
  assert.equal(sport.title, 'بسکتبال');
  assert.deepEqual(calls, ['connect', 'save', ['navbar', 'sports']]);
  assert.equal(sport.description, 'description');
  assert.equal(sport.icon, 'icon.svg');
  assert.equal(sport.image, 'image.jpg');
});

test('editing only the Persian title preserves English name and slug', async () => {
  const { result, sport } = await updateSport({ title: 'تنیس جدید' });
  assert.equal(result.status, 200);
  assert.equal(sport.title, 'تنیس جدید');
  assert.equal(sport.name, 'tennis');
  assert.equal(sport.slug, 'tennis');
});

test('older partial updates preserve the existing Persian title', async () => {
  const { sport } = await updateSport({ description: 'updated' });
  assert.equal(sport.title, 'تنیس');
  assert.equal(sport.description, 'updated');
});

test('rejects empty and non-string titles without saving', async () => {
  for (const title of ['', '   ', null, 42, {}, []]) {
    const { result, calls } = await updateSport({ title });
    assert.equal(result.status, 400);
    assert.ok(result.body.fieldErrors.title);
    assert.equal(calls.includes('save'), false);
  }
});

test('permission denial prevents database access', async () => {
  const denied = { status: 403 };
  const { result, calls } = await updateSport({ title: 'تنیس' }, { denied });
  assert.equal(result, denied);
  assert.deepEqual(calls, []);
});

test('missing sport returns 404 without saving', async () => {
  const { result, calls } = await updateSport({ title: 'تنیس' }, { missing: true });
  assert.equal(result.status, 404);
  assert.equal(calls.includes('save'), false);
});
