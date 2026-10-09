import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../src/domains/seed.js';
import { applyCommand, canView, registerLocalProfile, sampleReport, thermalStatus, validateShipment, visibleShipments } from '../src/domains/operations.js';

const seed = () => createSeed();
const manager = (state) => state.profiles.find(item => item.role === 'coordinator');
const client = (state, id = 'cargo-1') => state.profiles.find(item => item.id === id);
const draft = (overrides = {}) => ({ cargo: 'Sample cargo', weight: 5, origin: 'Lima', destination: 'Ica', customerId: 'cargo-1', vehicleId: 'vehicle-4', driverId: 'driver-4', minTemp: 2, maxTemp: 6, minHumidity: 70, maxHumidity: 95, departure: '2035-10-08T08:00:00-05:00', arrival: '2035-10-09T08:00:00-05:00', ...overrides });
const command = (state, type, payload, actor = manager(state)) => applyCommand(state, actor, { type, payload });
const rejects = (fn, code) => assert.throws(fn, error => error.code === code);

test('cargo clients list/view/export only shipments assigned to their own profile', () => {
  const state = seed(), actor = client(state);
  assert.deepEqual(visibleShipments(state, actor).map(s => s.id), ['FT-0001', 'FT-0002', 'FT-0004']);
  assert.equal(canView(actor, state.shipments.find(s => s.id === 'FT-0003')), false);
  rejects(() => sampleReport(state, actor, 'FT-0003'), 'notFound');
  assert.match(sampleReport(state, actor, 'FT-0001'), /LOCAL SAMPLE DATA/);
});
test('a client cannot create, edit, change status, add readings or acknowledge alerts', () => {
  const state = seed(), actor = client(state);
  for (const [type, payload] of [['createShipment', draft()], ['updateShipment', { id: 'FT-0001' }], ['transition', { id: 'FT-0001', status: 'delivered' }], ['addReading', { id: 'FT-0001' }], ['recordCorrectiveAction', { id: 'alert-1', note: 'Confirmed correction' }], ['saveVehicle', {}], ['saveDriver', {}]]) rejects(() => command(state, type, payload, actor), 'forbidden');
  rejects(() => command(state, 'createShipment', draft(), { ...actor, role: 'coordinator' }), 'forbidden');
});
test('invalid ranges, capacity, customers, dates and same route are rejected without mutating the input', () => {
  const state = seed(), before = JSON.stringify(state);
  for (const [fields, code] of [[{ minTemp: 8, maxTemp: 6 }, 'invalidRange'], [{ minTemp: '' }, 'invalidRange'], [{ maxHumidity: 101 }, 'invalidHumidity'], [{ weight: 11 }, 'overCapacity'], [{ customerId: 'missing' }, 'missingCustomer'], [{ arrival: 'invalid' }, 'invalidDates'], [{ destination: 'lima' }, 'sameRoute'], [{ driverId: 'missing' }, 'missingAssignment']]) rejects(() => validateShipment(state, draft(fields)), code);
  assert.equal(JSON.stringify(state), before);
});
test('new shipment departure must be in the future', () => {
  const state = seed();
  rejects(() => command(state, 'createShipment', draft({ departure: '2020-01-01T08:00:00Z', arrival: '2020-01-02T08:00:00Z' })), 'futureDeparture');
});
test('overlapping vehicle and driver allocations are rejected against the latest state', () => {
  let state = seed();
  const first = command(state, 'createShipment', draft()); state = first.state;
  rejects(() => command(state, 'createShipment', draft()), 'vehicleBusy');
  rejects(() => command(state, 'createShipment', draft({ vehicleId: 'vehicle-1' })), 'driverBusy');
  const adjacent = command(state, 'createShipment', draft({ departure: draft().arrival, arrival: '2035-10-10T08:00:00-05:00' }));
  assert.equal(adjacent.result.status, 'scheduled');
});
test('scheduled edits enforce version checks and reject stale writes', () => {
  const first = command(seed(), 'createShipment', draft());
  const edited = command(first.state, 'updateShipment', { ...first.result, cargo: 'Changed cargo' });
  assert.equal(edited.result.cargo, 'Changed cargo');
  rejects(() => command(edited.state, 'updateShipment', { ...first.result, cargo: 'Stale change' }), 'staleShipment');
});
test('trip lifecycle preserves started records and rejects cancellation in transit or after delivery', () => {
  const first = command(seed(), 'createShipment', draft());
  const started = command(first.state, 'transition', { id: first.result.id, version: first.result.version, status: 'in-transit' });
  rejects(() => command(started.state, 'deleteShipment', { id: started.result.id, version: started.result.version }), 'deleteScheduledOnly');
  const beforeCancellation = JSON.stringify(started.state);
  rejects(() => command(started.state, 'transition', { id: started.result.id, version: started.result.version, status: 'cancelled', note: 'Request after departure' }), 'invalidTransition');
  assert.equal(JSON.stringify(started.state), beforeCancellation);
  const delivered = command(started.state, 'transition', { id: started.result.id, version: started.result.version, status: 'delivered' });
  assert.equal(delivered.result.history.at(-1).action, 'delivered');
  rejects(() => command(delivered.state, 'transition', { id: delivered.result.id, version: delivered.result.version, status: 'cancelled', note: 'Request after delivery' }), 'invalidTransition');
  rejects(() => command(delivered.state, 'transition', { id: delivered.result.id, version: delivered.result.version, status: 'in-transit' }), 'invalidTransition');
});
test('scheduled cancellation requires a note and releases reservations; scheduled deletion removes notices', () => {
  const first = command(seed(), 'createShipment', draft());
  rejects(() => command(first.state, 'transition', { id: first.result.id, version: 1, status: 'cancelled', note: '' }), 'requiredAction');
  const cancelled = command(first.state, 'transition', { id: first.result.id, version: 1, status: 'cancelled', note: 'Client cancelled before departure' });
  assert.equal(cancelled.result.status, 'cancelled');
  assert.equal(cancelled.result.history.at(-1).action, 'cancelled');
  rejects(() => command(cancelled.state, 'transition', { id: cancelled.result.id, version: cancelled.result.version, status: 'in-transit' }), 'invalidTransition');
  const replacement = command(cancelled.state, 'createShipment', draft());
  assert.equal(replacement.result.status, 'scheduled');
  const deleted = command(first.state, 'deleteShipment', { id: first.result.id, version: 1 });
  assert.equal(deleted.state.shipments.some(s => s.id === first.result.id), false);
  assert.equal(deleted.state.notifications.some(n => n.shipmentId === first.result.id), false);
});
test('empty corrective action fails; a valid action acknowledges but never resolves an excursion', () => {
  const state = seed();
  rejects(() => command(state, 'recordCorrectiveAction', { id: 'alert-1', note: '' }), 'requiredAction');
  const recorded = command(state, 'recordCorrectiveAction', { id: 'alert-1', note: 'Checked refrigerator and adjusted controls' });
  const alert = recorded.state.alerts.find(a => a.id === 'alert-1');
  assert.equal(alert.acknowledged, true); assert.equal(alert.resolved, false);
  assert.equal(alert.actions.length, 1);
  assert.equal(thermalStatus(recorded.state.shipments.find(s => s.id === 'FT-0002')), 'critical');
  assert.equal(recorded.state.notifications.length, state.notifications.length);
});
test('optional corrective-action notification targets only the assigned client', () => {
  const result = command(seed(), 'recordCorrectiveAction', { id: 'alert-1', note: 'Checked temperature and refrigeration', notifyClient: true });
  assert.deepEqual(result.state.notifications[0].recipientProfileIds, ['cargo-1']);
  assert.equal(result.state.notifications[0].type, 'correctiveAction');
});
test('a normal new reading closes unresolved alerts only when both ranges are normal', () => {
  const outOfHumidity = command(seed(), 'addReading', { id: 'FT-0002', temperature: 4, humidity: 99, lat: -12, lng: -77 });
  assert.equal(outOfHumidity.state.alerts.find(a => a.id === 'alert-1').resolved, false);
  const normal = command(outOfHumidity.state, 'addReading', { id: 'FT-0002', temperature: 4, humidity: 82, lat: -12, lng: -77 });
  assert.equal(normal.state.alerts.filter(a => a.shipmentId === 'FT-0002' && !a.resolved).length, 0);
  assert.equal(thermalStatus(normal.state.shipments.find(s => s.id === 'FT-0002')), 'normal');
  const signal = command(seed(), 'addReading', { id: 'FT-0003', temperature: 4, humidity: 82, lat: -7, lng: -79 });
  assert.equal(signal.state.alerts.find(a => a.id === 'alert-2').resolved, true);
  assert.equal(signal.state.shipments.find(s => s.id === 'FT-0003').offline, false);
});
test('invalid sample coordinates and out-of-range humidity are rejected', () => {
  const state = seed();
  for (const values of [{ temperature: '', humidity: 82, lat: -12, lng: -77 }, { temperature: 4, humidity: 110, lat: -12, lng: -77 }, { temperature: 4, humidity: 82, lat: 91, lng: -77 }]) rejects(() => command(state, 'addReading', { id: 'FT-0001', ...values }), 'invalidReading');
});
test('vehicle/sensor uniqueness and active resource protection are enforced', () => {
  const state = seed();
  rejects(() => command(state, 'saveVehicle', { plate: 'A1B-728', sensor: 'NEW', capacity: 10 }), 'duplicateVehicle');
  rejects(() => command(state, 'saveVehicle', { plate: 'Z8X-329', sensor: 'FT-S001', capacity: 10 }), 'duplicateVehicle');
  rejects(() => command(state, 'saveVehicle', { ...state.vehicles[0], enabled: false }), 'assignedResource');
  rejects(() => command(state, 'saveDriver', { ...state.drivers[0], enabled: false }), 'assignedResource');
});
test('local registration stores no password and clients start without access to other shipments', () => {
  const registered = registerLocalProfile(seed(), { name: 'Sample client', email: 'new@example.invalid', organization: 'Sample company', role: 'cargo-client', password: 'not stored' });
  assert.equal('password' in registered.result, false);
  assert.equal(visibleShipments(registered.state, registered.result).length, 0);
  rejects(() => registerLocalProfile(registered.state, { ...registered.result }), 'duplicateProfile');
});
test('CSV marks sample provenance, escapes quotes and neutralizes formula-like action notes', () => {
  const state = seed();
  state.shipments[0].history.push({ at: '2026-10-06T20:00:00Z', action: 'incident', actor: 'Sample', note: '=HYPERLINK("unsafe")' });
  const report = sampleReport(state, manager(state), 'FT-0001');
  assert.match(report, /NOT A SENSOR AUDIT CERTIFICATE/);
  assert.match(report, /'=HYPERLINK\(""unsafe""\)/);
});
