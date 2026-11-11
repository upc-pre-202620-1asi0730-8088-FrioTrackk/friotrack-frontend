import test from 'node:test';
import assert from 'node:assert/strict';
import { RestWorkspaceGateway } from '../src/shared/infrastructure/rest-workspace-gateway.js';
import { configureWorkspaceGateway, clearWorkspace, data, profile, login, execute, logout } from '../src/shared/application/workspace.js';

const result = { profile: { id: 'cargo-1', role: 'cargo-client' }, state: { shipments: [{ id: 'FT-1' }] } };

test('workspace use cases apply only accepted gateway results and clear state on failed logout', async () => {
  clearWorkspace();
  configureWorkspaceGateway({
    login: async () => result,
    execute: async () => { throw new Error('forbidden'); },
    logout: async () => { throw new Error('serviceUnavailable'); },
  });
  await login({ email: 'client@example.invalid', password: 'private' });
  assert.deepEqual(profile.value, result.profile);
  await assert.rejects(execute('createShipment', {}), /forbidden/);
  assert.deepEqual(data.value.shipments, [{ id: 'FT-1' }]);
  await assert.rejects(logout(), /serviceUnavailable/);
  assert.equal(profile.value, null);
  assert.deepEqual(data.value.shipments, []);
});

test('REST gateway preserves session authorization, enforces client registration and expires rejected sessions', async (t) => {
  const oldFetch = globalThis.fetch;
  const oldStorage = globalThis.sessionStorage;
  const storage = new Map();
  globalThis.sessionStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  t.after(() => { globalThis.fetch = oldFetch; if (oldStorage === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = oldStorage; });
  let request, expired = 0;
  globalThis.fetch = async (url, options) => {
    request = { url, ...options };
    return new Response(JSON.stringify({ ...result, token: 'temporary-session-token' }), { status: 200 });
  };
  const gateway = new RestWorkspaceGateway({ apiUrl: 'http://localhost:5080/api/', onSessionExpired: () => expired++ });
  await gateway.register({ email: 'client@example.invalid', password: 'not-stored', role: 'coordinator' });
  assert.equal(JSON.parse(request.body).role, 'cargo-client');
  assert.equal(storage.get('friotrack.session'), 'temporary-session-token');
  assert.ok(!JSON.stringify([...storage]).includes('not-stored'));
  await gateway.read();
  assert.equal(request.url, 'http://localhost:5080/api/workspace');
  assert.equal(request.headers.Authorization, 'Bearer temporary-session-token');
  const restored = new RestWorkspaceGateway({ apiUrl: 'http://localhost:5080/api', onSessionExpired: () => expired++ });
  assert.equal(restored.hasSession, true);
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 'sessionExpired' }), { status: 401 });
  await assert.rejects(restored.read(), /sessionExpired/);
  assert.equal(restored.hasSession, false);
  assert.equal(storage.has('friotrack.session'), false);
  assert.equal(expired, 1);
});

test('REST gateway reports transport failures without silently replacing workspace data', async (t) => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  t.after(() => { globalThis.fetch = oldFetch; });
  const gateway = new RestWorkspaceGateway({ apiUrl: 'http://localhost:5080/api' });
  await assert.rejects(gateway.read(), /serviceUnavailable/);
});
