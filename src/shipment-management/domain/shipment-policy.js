import { DomainError } from '../../shared/domain/domain-error.js';
import { canView } from '../../iam/domain/access-policy.js';
const fail = (code, details) => { throw new DomainError(code, details); };
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const number = (value) => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
export const isActiveShipment = (shipment) => ['scheduled', 'in-transit'].includes(shipment.status);
export const visibleShipments = (state, profile) => state.shipments.filter((shipment) => canView(profile, shipment));
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
  const overlaps = state.shipments.filter((item) => item.id !== excludeId && isActiveShipment(item) && start < Date.parse(item.arrival) && end > Date.parse(item.departure));
  if (overlaps.some((item) => item.vehicleId === draft.vehicleId)) fail('vehicleBusy');
  if (overlaps.some((item) => item.driverId === draft.driverId)) fail('driverBusy');
  return { ...draft, cargo: draft.cargo.trim(), origin: draft.origin.trim(), destination: draft.destination.trim(), weight: Number(draft.weight), minTemp: Number(draft.minTemp), maxTemp: Number(draft.maxTemp), minHumidity: Number(draft.minHumidity), maxHumidity: Number(draft.maxHumidity), departure: new Date(start).toISOString(), arrival: new Date(end).toISOString() };
}
