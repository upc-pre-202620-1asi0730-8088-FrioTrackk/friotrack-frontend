import { DomainError } from '../../shared/domain/domain-error.js';
import { canView } from '../../iam/domain/access-policy.js';
function getShipment(state, profile, id) {
  const shipment = state.shipments.find((item) => item.id === id);
  if (!shipment || !canView(profile, shipment)) throw new DomainError('notFound');
  return shipment;
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
