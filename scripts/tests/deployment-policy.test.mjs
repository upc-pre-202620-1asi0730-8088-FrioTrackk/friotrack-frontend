import assert from 'node:assert/strict';
import test from 'node:test';
import { requirePreparedPostgres, requireCompatibleBackend, requireCompatibleDeploymentOrder } from '../deployment-policy.mjs';

const database = 'Host=private.invalid;Database=example;Username=example;Password=test-only';

test('accepts the API default mode with an existing PostgreSQL connection', () => {
  assert.doesNotThrow(() => requirePreparedPostgres({ FRIOTRACK_DB: database }));
  assert.doesNotThrow(() => requirePreparedPostgres({ FRIOTRACK_PERSISTENCE: 'postgres', ConnectionStrings__FrioTrack: database }));
});

test('rejects a historical JSON destination even when a connection exists', () => {
  assert.throws(() => requirePreparedPostgres({ FRIOTRACK_PERSISTENCE: 'json', FRIOTRACK_DB: database }), /Configure the existing App Service/);
});

test('rejects missing, blank and invalid persistence configuration', () => {
  for (const settings of [{}, { FRIOTRACK_DB: '  ' }, { FRIOTRACK_PERSISTENCE: '', FRIOTRACK_DB: database }, { FRIOTRACK_PERSISTENCE: 'Postgres', FRIOTRACK_DB: database }]) {
    assert.throws(() => requirePreparedPostgres(settings), /Configure the existing App Service/);
  }
});

test('blank primary connection cannot be masked by a valid fallback', () => {
  assert.throws(() => requirePreparedPostgres({ FRIOTRACK_DB: ' ', ConnectionStrings__FrioTrack: database }), /Configure the existing App Service/);
});

test('database migrations and initialization are refused during a cloud source update', () => {
  assert.throws(() => requirePreparedPostgres({ FRIOTRACK_DB: database, FRIOTRACK_MIGRATE: 'true' }), /Apply reviewed database migrations separately/);
  assert.throws(() => requirePreparedPostgres({ FRIOTRACK_DB: database, FRIOTRACK_SEED: 'true' }), /Initialize the intended demonstration database separately/);
  assert.doesNotThrow(() => requirePreparedPostgres({ FRIOTRACK_DB: database, FRIOTRACK_MIGRATE: 'false', FRIOTRACK_SEED: 'false' }));
});

test('configuration errors do not disclose a connection string or password', () => {
  const secret = 'private-password-not-for-receipts';
  try {
    requirePreparedPostgres({ FRIOTRACK_PERSISTENCE: 'json', FRIOTRACK_DB: database + secret });
    assert.fail('Expected a deployment precondition error');
  } catch (error) {
    assert.ok(!error.message.includes(secret));
    assert.ok(!error.message.includes(database));
  }
});

test('the AV2 SPA refuses a running historical JSON backend', () => {
  assert.throws(() => requireCompatibleBackend({ status: 'ok', service: 'FrioTrack', version: '0.1.0', persistence: 'json' }), /before uploading the AV2 frontend/);
  assert.throws(() => requireCompatibleBackend({ status: 'ok', service: 'FrioTrack', version: '0.2.0', persistence: 'json' }), /before uploading the AV2 frontend/);
});

test('the AV2 SPA requires a healthy compatible relational service', () => {
  for (const health of [null, {}, { status: 'ok', service: 'Other', version: '0.2.0', persistence: 'postgresql' }, { status: 'error', service: 'FrioTrack', version: '0.2.0', persistence: 'postgresql' }, { status: 'ok', service: 'FrioTrack', version: '0.1.9', persistence: 'postgresql' }]) {
    assert.throws(() => requireCompatibleBackend(health), /before uploading the AV2 frontend/);
  }
  for (const version of ['0.2.0', '0.10.0', '1.0.0']) {
    assert.doesNotThrow(() => requireCompatibleBackend({ status: 'ok', service: 'FrioTrack', version, persistence: 'postgresql' }));
  }
});

test('a combined deployment cannot publish the SPA before its REST backend', () => {
  assert.throws(() => requireCompatibleDeploymentOrder(['frontend', 'api', 'landing']), /Place the API before the frontend/);
  assert.throws(() => requireCompatibleDeploymentOrder(['landing', 'frontend', 'api']), /Place the API before the frontend/);
  assert.doesNotThrow(() => requireCompatibleDeploymentOrder(['api', 'frontend', 'landing']));
  assert.doesNotThrow(() => requireCompatibleDeploymentOrder(['frontend']));
  assert.doesNotThrow(() => requireCompatibleDeploymentOrder(['landing', 'api']));
});
