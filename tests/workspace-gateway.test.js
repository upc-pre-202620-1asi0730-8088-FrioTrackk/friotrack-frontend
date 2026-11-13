import test from 'node:test';
import assert from 'node:assert/strict';
import { RestWorkspaceGateway, resourceRequest } from '../src/shared/infrastructure/rest-workspace-gateway.js';
import { configureWorkspaceGateway, clearWorkspace, data, profile, pendingRequests, login, register, execute, logout, refreshWorkspace, restoreSession } from '../src/shared/application/workspace.js';

const result = { profile: { id: 'cargo-1', role: 'cargo-client' }, state: { shipments: [{ id: 'FT-1' }] } };

const identityResult = id => ({ token: 'token-' + id, profile: { id, role: 'cargo-client' }, state: { shipments: [{ id: 'shipment-' + id }] } });
const response = value => new Response(JSON.stringify(value), { status: 200 });
function browserStorage(t) {
  const oldFetch = globalThis.fetch, oldStorage = globalThis.sessionStorage;
  const storage = new Map();
  globalThis.sessionStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  t.after(() => { globalThis.fetch = oldFetch; if (oldStorage === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = oldStorage; });
  clearWorkspace();
  return storage;
}

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

test('REST operations use resource verbs and URLs with protected path identifiers and record versions', async (t) => {
  const oldFetch = globalThis.fetch;
  const oldStorage = globalThis.sessionStorage;
  globalThis.sessionStorage = { getItem: () => 'session-for-resource-contract', removeItem: () => {} };
  t.after(() => { globalThis.fetch = oldFetch; if (oldStorage === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = oldStorage; });
  const requests = [];
  globalThis.fetch = async (url, options) => { requests.push({ url, ...options }); return new Response(JSON.stringify({ ...result, result: {} }), { status: 200 }); };
  let locale = 'en-US';
  const gateway = new RestWorkspaceGateway({ apiUrl: 'https://api.example.invalid/api/', getLanguage: () => locale });
  const cases = [
    ['createShipment', { cargo: 'Fruit', weight: 3 }, 'POST', '/shipments', { cargo: 'Fruit', weight: 3 }],
    ['updateShipment', { id: 'FT/one?#', cargo: 'Fruit', version: 7 }, 'PUT', '/shipments/FT%2Fone%3F%23', { cargo: 'Fruit', version: 7 }],
    ['deleteShipment', { id: 'FT-1', version: 7 }, 'DELETE', '/shipments/FT-1?version=7', undefined],
    ['transition', { id: 'FT-1', version: 7, status: 'in-transit', note: '' }, 'POST', '/shipments/FT-1/transitions', { version: 7, status: 'in-transit', note: '' }],
    ['addReading', { id: 'FT-1', temperature: 4, humidity: 80, lat: -12, lng: -77 }, 'POST', '/shipments/FT-1/readings', { temperature: 4, humidity: 80, lat: -12, lng: -77 }],
    ['recordIncident', { id: 'FT-1', note: 'Road access delayed' }, 'POST', '/shipments/FT-1/incidents', { note: 'Road access delayed' }],
    ['generateThermalReport', { id: 'FT-1' }, 'POST', '/shipments/FT-1/reports', {}],
    ['recordCorrectiveAction', { id: 'alert-1', note: 'Cooling checked', notifyClient: true }, 'POST', '/alerts/alert-1/corrective-actions', { note: 'Cooling checked', notifyClient: true }],
    ['saveVehicle', { plate: 'ABC-123', capacity: 7, enabled: true }, 'POST', '/vehicles', { plate: 'ABC-123', capacity: 7, enabled: true }],
    ['saveVehicle', { id: 'vehicle-1', enabled: false }, 'PUT', '/vehicles/vehicle-1', { enabled: false }],
    ['saveDriver', { name: 'Driver', license: 'Q-123', enabled: true }, 'POST', '/drivers', { name: 'Driver', license: 'Q-123', enabled: true }],
    ['saveDriver', { id: 'driver-1', enabled: false }, 'PUT', '/drivers/driver-1', { enabled: false }],
    ['saveSensor', { serialCode: 'S-2', vehicleId: null, enabled: true }, 'POST', '/sensors', { serialCode: 'S-2', vehicleId: null, enabled: true }],
    ['saveSensor', { id: 'sensor-2', serialCode: 'S-2', vehicleId: 'vehicle-1', enabled: true }, 'PUT', '/sensors/sensor-2', { serialCode: 'S-2', vehicleId: 'vehicle-1', enabled: true }],
    ['updateProfile', { id: 'cannot-select-another-user', name: 'Client' }, 'PUT', '/profiles/me', { name: 'Client' }],
    ['readNotifications', {}, 'POST', '/notifications/read', {}],
  ];
  for (const [command, payload, method, path, body] of cases) {
    const before = structuredClone(payload);
    await gateway.execute(command, payload);
    const request = requests.at(-1);
    assert.equal(request.url, 'https://api.example.invalid/api' + path, command);
    assert.equal(request.method, method, command);
    assert.deepEqual(request.body === undefined ? undefined : JSON.parse(request.body), body, command);
    assert.equal(request.headers.Authorization, 'Bearer session-for-resource-contract');
    assert.equal(request.headers['Accept-Language'], 'en-US');
    assert.deepEqual(payload, before, 'Routing must not mutate form data');
  }
  locale = 'es-419'; await gateway.read();
  assert.equal(requests.at(-1).headers['Accept-Language'], 'es-419');
  assert.ok(requests.every(request => !request.url.includes('/commands')));
});

test('unknown operations and missing mutation identifiers are rejected before sending HTTP requests', () => {
  assert.throws(() => resourceRequest('not-a-supported-operation'), /unknownCommand/);
  for (const type of ['updateShipment', 'transition', 'addReading', 'recordIncident', 'recordCorrectiveAction', 'generateThermalReport']) assert.throws(() => resourceRequest(type, {}), /requiredFields/);
  for (const version of [0, -1, '1', undefined, 1.5]) assert.throws(() => resourceRequest('deleteShipment', { id: 'FT-1', version }), /staleShipment/);
});

test('a rejected stale write preserves the current workspace and authenticated session', async (t) => {
  const oldFetch = globalThis.fetch;
  const oldStorage = globalThis.sessionStorage;
  const storage = new Map([['friotrack.session', 'still-valid']]);
  globalThis.sessionStorage = { getItem: key => storage.get(key), removeItem: key => storage.delete(key) };
  t.after(() => { globalThis.fetch = oldFetch; if (oldStorage === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = oldStorage; });
  const gateway = new RestWorkspaceGateway({ apiUrl: 'https://api.example.invalid/api' });
  configureWorkspaceGateway(gateway);
  const previous = JSON.parse(JSON.stringify(data.value));
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 'staleShipment', message: 'The shipment has changed.' }), { status: 409 });
  await assert.rejects(execute('updateShipment', { id: 'FT-1', version: 1 }), /staleShipment/);
  assert.equal(gateway.hasSession, true);
  assert.equal(storage.get('friotrack.session'), 'still-valid');
  assert.deepEqual(data.value, previous);
  assert.equal(pendingRequests.value, 0);
});

test('pending requests remain announced until completion and malformed success cannot replace workspace data', async () => {
  const before = JSON.parse(JSON.stringify(data.value));
  let release;
  configureWorkspaceGateway({ execute: () => new Promise(resolve => { release = resolve; }) });
  const operation = execute('saveVehicle', {});
  assert.equal(pendingRequests.value, 1);
  release({ result: {} });
  await assert.rejects(operation, /unexpected/);
  assert.equal(pendingRequests.value, 0);
  assert.deepEqual(data.value, before);
});

test('logout uses a protected POST and always removes the browser session', async (t) => {
  const oldFetch = globalThis.fetch;
  const oldStorage = globalThis.sessionStorage;
  const storage = new Map([['friotrack.session', 'session-to-revoke']]);
  globalThis.sessionStorage = { getItem: key => storage.get(key), removeItem: key => storage.delete(key) };
  t.after(() => { globalThis.fetch = oldFetch; if (oldStorage === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = oldStorage; });
  let request;
  globalThis.fetch = async (url, options) => { request = { url, ...options }; return new Response(null, { status: 204 }); };
  const gateway = new RestWorkspaceGateway({ apiUrl: 'https://api.example.invalid/api' });
  await gateway.logout();
  assert.equal(request.url, 'https://api.example.invalid/api/auth/logout');
  assert.equal(request.method, 'POST');
  assert.equal(request.headers.Authorization, 'Bearer session-to-revoke');
  assert.deepEqual(JSON.parse(request.body), {});
  assert.equal(gateway.hasSession, false);
  assert.equal(storage.has('friotrack.session'), false);
});

test('a response arriving after sign-out cannot restore a previous user workspace', async () => {
  let release;
  configureWorkspaceGateway({ login: async () => result, execute: () => new Promise(resolve => { release = resolve; }), logout: async () => {} });
  await login({});
  const delayed = execute('saveVehicle', {});
  await logout();
  release({ ...result, result: { id: 'vehicle-2' } });
  await assert.rejects(delayed, /sessionExpired/);
  assert.equal(profile.value, null);
  assert.deepEqual(data.value.shipments, []);
  assert.equal(pendingRequests.value, 0);
});

test('thermal report snapshots are fetched through an authorized resource GET', async (t) => {
  const oldFetch = globalThis.fetch;
  const oldStorage = globalThis.sessionStorage;
  globalThis.sessionStorage = { getItem: () => 'authorized-report-reader' };
  t.after(() => { globalThis.fetch = oldFetch; if (oldStorage === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = oldStorage; });
  let request;
  const snapshot = { shipment: { id: 'FT-1' }, alerts: [], dataSource: 'demonstration', generatedAt: '2026-11-13T12:00:00Z' };
  globalThis.fetch = async (url, options) => { request = { url, ...options }; return new Response(JSON.stringify(snapshot), { status: 200 }); };
  const gateway = new RestWorkspaceGateway({ apiUrl: 'https://api.example.invalid/api' });
  assert.deepEqual(await gateway.readReport('report/one'), snapshot);
  assert.equal(request.url, 'https://api.example.invalid/api/reports/report%2Fone');
  assert.equal(request.method, 'GET');
  assert.equal(request.headers.Authorization, 'Bearer authorized-report-reader');
});

test('a late unauthorized response for a revoked identity cannot expire the next signed-in user', async (t) => {
  const storage = browserStorage(t);
  let release, expired = 0;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/auth/login')) return response(identityResult(JSON.parse(options.body).email));
    if (url.endsWith('/auth/logout')) return new Response(null, { status: 204 });
    return new Promise(resolve => { release = resolve; });
  };
  const gateway = new RestWorkspaceGateway({ apiUrl: 'https://api.example.invalid/api', onSessionExpired: () => { expired++; clearWorkspace(); } });
  configureWorkspaceGateway(gateway);
  await login({ email: 'A' });
  const rejected = assert.rejects(refreshWorkspace(), /sessionExpired/);
  await logout();
  await login({ email: 'B' });
  release(new Response(JSON.stringify({ code: 'sessionExpired' }), { status: 401 }));
  await rejected;
  assert.equal(expired, 0);
  assert.equal(profile.value.id, 'B');
  assert.equal(storage.get('friotrack.session'), 'token-B');
  assert.equal(gateway.hasSession, true);
});

test('a delayed logout revokes its captured token without clearing a newer login', async (t) => {
  const storage = browserStorage(t);
  let release, authorization;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/auth/login')) return response(identityResult(JSON.parse(options.body).email));
    authorization = options.headers.Authorization;
    return new Promise(resolve => { release = resolve; });
  };
  const gateway = new RestWorkspaceGateway({ apiUrl: 'https://api.example.invalid/api' });
  configureWorkspaceGateway(gateway);
  await login({ email: 'A' });
  const delayed = logout();
  assert.equal(profile.value, null);
  assert.equal(gateway.hasSession, false);
  assert.equal(storage.has('friotrack.session'), false);
  await login({ email: 'B' });
  release(new Response(null, { status: 204 }));
  await delayed;
  assert.equal(authorization, 'Bearer token-A');
  assert.equal(profile.value.id, 'B');
  assert.equal(storage.get('friotrack.session'), 'token-B');
  assert.deepEqual(data.value.shipments, [{ id: 'shipment-B' }]);
});

test('an earlier login response cannot replace a later registration identity', async (t) => {
  const storage = browserStorage(t);
  let release;
  globalThis.fetch = async (url) => url.endsWith('/auth/login') ? new Promise(resolve => { release = resolve; }) : response(identityResult('B'));
  const gateway = new RestWorkspaceGateway({ apiUrl: 'https://api.example.invalid/api' });
  configureWorkspaceGateway(gateway);
  const rejected = assert.rejects(login({ email: 'A' }), /sessionExpired/);
  await register({ email: 'B' });
  release(response(identityResult('A')));
  await rejected;
  assert.equal(profile.value.id, 'B');
  assert.equal(storage.get('friotrack.session'), 'token-B');
  assert.deepEqual(data.value.shipments, [{ id: 'shipment-B' }]);
});

test('a login response arriving after logout cannot install a browser session', async (t) => {
  const storage = browserStorage(t);
  let release;
  globalThis.fetch = async () => new Promise(resolve => { release = resolve; });
  const gateway = new RestWorkspaceGateway({ apiUrl: 'https://api.example.invalid/api' });
  configureWorkspaceGateway(gateway);
  const rejected = assert.rejects(login({ email: 'A' }), /sessionExpired/);
  await logout();
  release(response(identityResult('A')));
  await rejected;
  assert.equal(profile.value, null);
  assert.equal(gateway.hasSession, false);
  assert.equal(storage.has('friotrack.session'), false);
});

test('workspace identity protection also applies to adapters without transport generation guards', async () => {
  let release;
  configureWorkspaceGateway({ login: () => new Promise(resolve => { release = resolve; }), register: async () => identityResult('B') });
  const rejected = assert.rejects(login({ email: 'A' }), /sessionExpired/);
  await register({ email: 'B' });
  release(identityResult('A'));
  await rejected;
  assert.equal(profile.value.id, 'B');
  assert.deepEqual(data.value.shipments, [{ id: 'shipment-B' }]);
});

test('logout clears local identity immediately even when revocation fails in transit', async (t) => {
  const storage = browserStorage(t);
  let reject;
  globalThis.fetch = async url => url.endsWith('/auth/login') ? response(identityResult('A')) : new Promise((_, fail) => { reject = fail; });
  const gateway = new RestWorkspaceGateway({ apiUrl: 'https://api.example.invalid/api' });
  configureWorkspaceGateway(gateway);
  await login({ email: 'A' });
  const rejected = assert.rejects(logout(), /serviceUnavailable/);
  assert.equal(profile.value, null);
  assert.equal(gateway.hasSession, false);
  assert.equal(storage.has('friotrack.session'), false);
  reject(new TypeError('offline'));
  await rejected;
  assert.equal(profile.value, null);
  assert.equal(pendingRequests.value, 0);
});

test('a delayed failed session restoration cannot clear a newer signed-in identity', async (t) => {
  const storage = browserStorage(t);
  storage.set('friotrack.session', 'restored-token-A');
  let release;
  globalThis.fetch = async url => url.endsWith('/auth/login') ? response(identityResult('B')) : new Promise(resolve => { release = resolve; });
  const gateway = new RestWorkspaceGateway({ apiUrl: 'https://api.example.invalid/api' });
  configureWorkspaceGateway(gateway);
  const restoring = restoreSession();
  await login({ email: 'B' });
  release(new Response(JSON.stringify({ code: 'sessionExpired' }), { status: 401 }));
  await restoring;
  assert.equal(profile.value.id, 'B');
  assert.equal(storage.get('friotrack.session'), 'token-B');
  assert.equal(gateway.hasSession, true);
});
