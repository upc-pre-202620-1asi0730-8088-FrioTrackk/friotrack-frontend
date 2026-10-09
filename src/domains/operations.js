export class DomainError extends Error {
  constructor(code, details = {}) { super(code); this.code = code; this.details = details; }
}

const fail = (code, details) => { throw new DomainError(code, details); };
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const number = (value) => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
const currentTime = () => new Date().toISOString();
const active = (shipment) => ['scheduled', 'in-transit'].includes(shipment.status);
export const canManage = (profile) => profile?.role === 'coordinator';
export const canView = (profile, shipment) => !!profile && (canManage(profile) || (profile.role === 'cargo-client' && shipment.customerId === profile.id));
export const visibleShipments = (state, profile) => state.shipments.filter((shipment) => canView(profile, shipment));

export function thermalStatus(shipment) {
  if (shipment.status === 'scheduled' && !shipment.readings.length) return 'pending';
  if (shipment.offline) return 'offline';
  const reading = shipment.readings.at(-1);
  if (!reading) return 'pending';
  if (reading.temperature < shipment.minTemp || reading.temperature > shipment.maxTemp || reading.humidity < shipment.minHumidity || reading.humidity > shipment.maxHumidity) return 'critical';
  return 'normal';
}

export function validateShipment(state, draft, excludeId) {
  if (![draft.cargo, draft.origin, draft.destination].every(text)) fail('requiredFields');
  if (draft.origin.trim().toLowerCase() === draft.destination.trim().toLowerCase()) fail('sameRoute');
  if (!number(draft.weight) || Number(draft.weight) <= 0) fail('invalidWeight');
  if (![draft.minTemp, draft.maxTemp, draft.minHumidity, draft.maxHumidity].every(number)) fail('invalidRange');
  if (Number(draft.minTemp) < -50 || Number(draft.maxTemp) > 50 || Number(draft.minTemp) >= Number(draft.maxTemp)) fail('invalidRange');
  if (Number(draft.minHumidity) < 0 || Number(draft.maxHumidity) > 100 || Number(draft.minHumidity) >= Number(draft.maxHumidity)) fail('invalidHumidity');
  const start = Date.parse(draft.departure), end = Date.parse(draft.arrival);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) fail('invalidDates');
  const vehicle = state.vehicles.find((item) => item.id === draft.vehicleId && item.enabled);
  const driver = state.drivers.find((item) => item.id === draft.driverId && item.enabled);
  if (!vehicle || !driver) fail('missingAssignment');
  if (!state.profiles.some((item) => item.id === draft.customerId && item.role === 'cargo-client')) fail('missingCustomer');
  if (Number(draft.weight) > vehicle.capacity) fail('overCapacity', { capacity: vehicle.capacity });
  const overlaps = state.shipments.filter((item) => item.id !== excludeId && active(item) && start < Date.parse(item.arrival) && end > Date.parse(item.departure));
  if (overlaps.some((item) => item.vehicleId === draft.vehicleId)) fail('vehicleBusy');
  if (overlaps.some((item) => item.driverId === draft.driverId)) fail('driverBusy');
  return { ...draft, cargo: draft.cargo.trim(), origin: draft.origin.trim(), destination: draft.destination.trim(), weight: Number(draft.weight), minTemp: Number(draft.minTemp), maxTemp: Number(draft.maxTemp), minHumidity: Number(draft.minHumidity), maxHumidity: Number(draft.maxHumidity), departure: new Date(start).toISOString(), arrival: new Date(end).toISOString() };
}

function requireManager(profile) { if (!canManage(profile)) fail('forbidden'); }
function getShipment(state, profile, id) {
  const shipment = state.shipments.find((item) => item.id === id);
  if (!shipment || !canView(profile, shipment)) fail('notFound');
  return shipment;
}
function audit(shipment, profile, action, note) {
  shipment.history.push({ at: currentTime(), action, note: note || '', actor: profile.name });
  shipment.version++;
}
function notify(state, shipment, type, recipientProfileIds) {
  state.notifications.unshift({ id: `notice-${crypto.randomUUID()}`, shipmentId: shipment.id, type, readBy: [], at: currentTime(), ...(recipientProfileIds ? { recipientProfileIds } : {}) });
}

export function applyCommand(source, profile, command) {
  if (!profile || !source.profiles.some((item) => item.id === profile.id && item.role === profile.role)) fail('forbidden');
  const state = structuredClone(source);
  const { type, payload = {} } = command;
  let result;
  if (type === 'createShipment') {
    requireManager(profile);
    const draft = validateShipment(state, payload);
    if (Date.parse(draft.departure) <= Date.now()) fail('futureDeparture');
    const nextId = Math.max(0, ...state.shipments.map((item) => Number(item.id.split('-')[1]) || 0)) + 1;
    result = { ...draft, id: `FT-${String(nextId).padStart(4, '0')}`, status: 'scheduled', readings: [], offline: false, version: 1, history: [{ at: currentTime(), actor: profile.name, action: 'created', note: 'Local sample shipment' }] };
    state.shipments.unshift(result); notify(state, result, 'created');
  } else if (type === 'updateShipment') {
    requireManager(profile);
    const shipment = getShipment(state, profile, payload.id);
    if (payload.version !== shipment.version) fail('staleShipment');
    if (shipment.status !== 'scheduled') fail('editScheduledOnly');
    const fields = ['cargo', 'weight', 'origin', 'destination', 'customerId', 'vehicleId', 'driverId', 'minTemp', 'maxTemp', 'minHumidity', 'maxHumidity', 'departure', 'arrival'];
    const proposed = Object.fromEntries(fields.map((key) => [key, payload[key]]));
    Object.assign(shipment, validateShipment(state, proposed, shipment.id));
    audit(shipment, profile, 'updated'); result = shipment;
  } else if (type === 'transition') {
    requireManager(profile);
    const shipment = getShipment(state, profile, payload.id);
    if (payload.version !== shipment.version) fail('staleShipment');
    const transitions = { scheduled: ['in-transit', 'cancelled'], 'in-transit': ['delivered'], delivered: [], cancelled: [] };
    if (!transitions[shipment.status]?.includes(payload.status)) fail('invalidTransition');
    if (payload.status === 'cancelled' && !text(payload.note)) fail('requiredAction');
    shipment.status = payload.status;
    audit(shipment, profile, payload.status, payload.note); notify(state, shipment, payload.status); result = shipment;
  } else if (type === 'deleteShipment') {
    requireManager(profile);
    const shipment = getShipment(state, profile, payload.id);
    if (payload.version !== shipment.version) fail('staleShipment');
    if (shipment.status !== 'scheduled') fail('deleteScheduledOnly');
    if (shipment.readings.length) fail('deleteScheduledOnly');
    state.shipments = state.shipments.filter((item) => item.id !== shipment.id);
    state.notifications = state.notifications.filter((item) => item.shipmentId !== shipment.id);
    state.alerts = state.alerts.filter((item) => item.shipmentId !== shipment.id);
    result = shipment.id;
  } else if (type === 'addReading') {
    requireManager(profile);
    const shipment = getShipment(state, profile, payload.id);
    if (shipment.status !== 'in-transit') fail('readingsTransitOnly');
    if (![payload.temperature, payload.humidity, payload.lat, payload.lng].every(number)) fail('invalidReading');
    if (Number(payload.temperature) < -50 || Number(payload.temperature) > 50 || Number(payload.humidity) < 0 || Number(payload.humidity) > 100 || Math.abs(Number(payload.lat)) > 90 || Math.abs(Number(payload.lng)) > 180) fail('invalidReading');
    const reading = { at: currentTime(), temperature: Number(payload.temperature), humidity: Number(payload.humidity), lat: Number(payload.lat), lng: Number(payload.lng) };
    shipment.readings.push(reading); shipment.offline = false;
    const conditions = [['temperature', reading.temperature < shipment.minTemp || reading.temperature > shipment.maxTemp], ['humidity', reading.humidity < shipment.minHumidity || reading.humidity > shipment.maxHumidity]];
    for (const [alertType, outOfRange] of conditions) {
      if (outOfRange) { state.alerts.unshift({ id: `alert-${crypto.randomUUID()}`, shipmentId: shipment.id, type: alertType, reading: reading[alertType], at: reading.at, resolved: false, actions: [] }); notify(state, shipment, 'alert'); }
    }
    // A note acknowledges an alert; only a subsequent reading proving both
    // configured ranges are normal closes the stored excursion/signal alerts.
    if (conditions.every(([, outOfRange]) => !outOfRange)) {
      for (const alert of state.alerts.filter(item => item.shipmentId === shipment.id && !item.resolved)) {
        alert.resolved = true; alert.resolvedAt = reading.at;
      }
    }
    audit(shipment, profile, 'sampleReading'); result = reading;
  } else if (type === 'recordIncident') {
    requireManager(profile);
    const shipment = getShipment(state, profile, payload.id);
    if (!text(payload.note) || payload.note.trim().length < 8) fail('requiredAction');
    audit(shipment, profile, 'incident', payload.note.trim()); result = shipment;
  } else if (type === 'recordCorrectiveAction' || type === 'resolveAlert') {
    requireManager(profile);
    const alert = state.alerts.find((item) => item.id === payload.id);
    if (!alert) fail('notFound');
    const shipment = getShipment(state, profile, alert.shipmentId);
    if (alert.resolved) fail('alreadyResolved');
    if (!text(payload.note) || payload.note.trim().length < 8) fail('requiredAction');
    alert.actions.push({ note: payload.note.trim(), at: currentTime(), actor: profile.name });
    alert.acknowledged = true;
    if (payload.notifyClient === true) notify(state, shipment, 'correctiveAction', [shipment.customerId]);
    audit(shipment, profile, 'correctiveAction', payload.note.trim()); result = alert;
  } else if (type === 'saveVehicle') {
    requireManager(profile);
    if (!text(payload.plate) || !/^[A-Z0-9]{3}-[A-Z0-9]{3}$/i.test(payload.plate.trim()) || !text(payload.sensor)) fail('invalidVehicle');
    if (!number(payload.capacity) || Number(payload.capacity) <= 0 || Number(payload.capacity) > 100) fail('invalidWeight');
    if (state.vehicles.some((item) => item.id !== payload.id && (item.plate.toUpperCase() === payload.plate.trim().toUpperCase() || item.sensor.toUpperCase() === payload.sensor.trim().toUpperCase()))) fail('duplicateVehicle');
    const vehicle = state.vehicles.find((item) => item.id === payload.id);
    if (vehicle && state.shipments.some((item) => active(item) && item.vehicleId === vehicle.id)) fail('assignedResource');
    result = { id: payload.id || `vehicle-${crypto.randomUUID()}`, plate: payload.plate.trim().toUpperCase(), sensor: payload.sensor.trim().toUpperCase(), capacity: Number(payload.capacity), enabled: payload.enabled !== false };
    if (vehicle) Object.assign(vehicle, result); else state.vehicles.push(result);
  } else if (type === 'saveDriver') {
    requireManager(profile);
    if (!text(payload.name) || !text(payload.license)) fail('requiredFields');
    if (state.drivers.some((item) => item.id !== payload.id && item.license.toUpperCase() === payload.license.trim().toUpperCase())) fail('duplicateDriver');
    const driver = state.drivers.find((item) => item.id === payload.id);
    if (driver && state.shipments.some((item) => active(item) && item.driverId === driver.id)) fail('assignedResource');
    result = { id: payload.id || `driver-${crypto.randomUUID()}`, name: payload.name.trim(), license: payload.license.trim(), enabled: payload.enabled !== false };
    if (driver) Object.assign(driver, result); else state.drivers.push(result);
  } else if (type === 'updateProfile') {
    if (!text(payload.name) || !text(payload.organization) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email || '')) fail('invalidProfile');
    if (state.profiles.some((item) => item.id !== profile.id && item.email.toLowerCase() === payload.email.trim().toLowerCase())) fail('duplicateProfile');
    result = state.profiles.find((item) => item.id === profile.id);
    Object.assign(result, { name: payload.name.trim(), organization: payload.organization.trim(), email: payload.email.trim().toLowerCase() });
  } else if (type === 'readNotifications') {
    for (const notice of state.notifications) {
      const shipment = state.shipments.find((item) => item.id === notice.shipmentId);
      if (shipment && canView(profile, shipment) && (!notice.recipientProfileIds || notice.recipientProfileIds.includes(profile.id)) && !notice.readBy.includes(profile.id)) notice.readBy.push(profile.id);
    }
  } else fail('unknownCommand');
  state.revision++;
  return { state, result };
}

export function registerLocalProfile(source, draft) {
  if (!text(draft.name) || !text(draft.organization) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email || '')) fail('invalidProfile');
  if (!['coordinator', 'cargo-client'].includes(draft.role)) fail('forbidden');
  if (source.profiles.some((item) => item.email.toLowerCase() === draft.email.trim().toLowerCase())) fail('duplicateProfile');
  const state = structuredClone(source);
  const profile = { id: `profile-${crypto.randomUUID()}`, name: draft.name.trim(), email: draft.email.trim().toLowerCase(), organization: draft.organization.trim(), role: draft.role };
  state.profiles.push(profile); state.revision++;
  return { state, result: profile };
}

export function sampleReport(state, profile, shipmentId) {
  const shipment = getShipment(state, profile, shipmentId);
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  // Prefix formula-like values to prevent CSV spreadsheet formula injection.
  const safe = (value) => quote(/^[=+\-@\t\r]/.test(String(value)) ? `'${value}` : value);
  return [
    ['LOCAL SAMPLE DATA — NOT A SENSOR AUDIT CERTIFICATE'],
    ['Shipment', shipment.id, shipment.cargo],
    ['Route', shipment.origin, shipment.destination],
    ['Status', shipment.status],
    ['Temperature range °C', shipment.minTemp, shipment.maxTemp],
    ['Humidity range %', shipment.minHumidity, shipment.maxHumidity],
    [], ['Timestamp UTC', 'Temperature °C', 'Humidity %', 'Latitude', 'Longitude'],
    ...shipment.readings.map((item) => [item.at, item.temperature, item.humidity, item.lat, item.lng]),
    [], ['Action timestamp UTC', 'Action', 'Actor', 'Note'],
    ...shipment.history.map((item) => [item.at, item.action, item.actor, item.note]),
  ].map((row) => row.map(safe).join(',')).join('\r\n');
}
