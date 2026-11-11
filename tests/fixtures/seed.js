export const SAMPLE_REFERENCE = '2026-10-06T15:00:00-05:00';

const readings = (temperature, humidity, lat, lng, offline = false) => [
  { at: '2026-10-06T16:00:00Z', temperature: temperature - 0.7, humidity: humidity - 2, lat: lat + 0.18, lng },
  { at: '2026-10-06T17:00:00Z', temperature: temperature - 0.5, humidity: humidity - 1, lat: lat + 0.11, lng },
  { at: '2026-10-06T18:00:00Z', temperature: temperature - 0.3, humidity, lat: lat + 0.07, lng },
  { at: offline ? '2026-10-06T18:15:00Z' : '2026-10-06T20:00:00Z', temperature, humidity, lat, lng },
];
const shipment = (id, data) => ({
  id, version: 1, minTemp: 2, maxTemp: 6, minHumidity: 70, maxHumidity: 95,
  departure: '2026-10-06T07:00:00-05:00', arrival: '2026-10-07T07:00:00-05:00',
  status: 'in-transit', history: [{ at: '2026-10-06T12:00:00Z', action: 'created', note: 'Seeded sample shipment', actor: 'Sample workspace' }],
  ...data,
});

export function createSeed() {
  return {
    schema: 1, revision: 0,
    profiles: [
      { id: 'coordinator-1', name: 'Alex Rivera', email: 'coordinator@example.invalid', organization: 'ColdWay Logistics · sample', role: 'coordinator' },
      { id: 'cargo-1', name: 'Andrea Salas', email: 'client@example.invalid', organization: 'Valle Verde Export · sample', role: 'cargo-client' },
      { id: 'cargo-2', name: 'Marco León', email: 'second-client@example.invalid', organization: 'Costa Foods · sample', role: 'cargo-client' },
    ],
    vehicles: [
      { id: 'vehicle-1', plate: 'A1B-728', capacity: 12, sensor: 'FT-S001', enabled: true },
      { id: 'vehicle-2', plate: 'C3D-419', capacity: 8, sensor: 'FT-S002', enabled: true },
      { id: 'vehicle-3', plate: 'F5G-603', capacity: 16, sensor: 'FT-S003', enabled: true },
      { id: 'vehicle-4', plate: 'H7J-281', capacity: 10, sensor: 'FT-S004', enabled: true },
    ],
    drivers: [
      { id: 'driver-1', name: 'Daniel Flores', license: 'Q-SAMPLE-101', enabled: true },
      { id: 'driver-2', name: 'Lucía Ramos', license: 'Q-SAMPLE-102', enabled: true },
      { id: 'driver-3', name: 'Miguel Soto', license: 'Q-SAMPLE-103', enabled: true },
      { id: 'driver-4', name: 'José Cabrera', license: 'Q-SAMPLE-104', enabled: true },
    ],
    shipments: [
      shipment('FT-0001', { cargo: 'Palta Hass / Hass avocado', weight: 8, origin: 'Trujillo', destination: 'Lima', customerId: 'cargo-1', vehicleId: 'vehicle-1', driverId: 'driver-1', readings: readings(4.2, 82, -10.06, -78.16), offline: false }),
      shipment('FT-0002', { cargo: 'Uva de mesa / Table grapes', weight: 6, origin: 'Ica', destination: 'Lima', customerId: 'cargo-1', vehicleId: 'vehicle-2', driverId: 'driver-2', readings: readings(7.8, 86, -12.65, -76.63), offline: false }),
      shipment('FT-0003', { cargo: 'Arándanos / Blueberries', weight: 11, origin: 'Chiclayo', destination: 'Trujillo', customerId: 'cargo-2', vehicleId: 'vehicle-3', driverId: 'driver-3', readings: readings(3.8, 84, -7.08, -79.55, true), offline: true }),
      shipment('FT-0004', { cargo: 'Pescado congelado / Frozen fish', weight: 7, origin: 'Chimbote', destination: 'Lima', customerId: 'cargo-1', vehicleId: 'vehicle-4', driverId: 'driver-4', minTemp: -22, maxTemp: -18, minHumidity: 50, maxHumidity: 90, status: 'delivered', departure: '2026-10-04T07:00:00-05:00', arrival: '2026-10-05T07:00:00-05:00', readings: readings(-19.4, 72, -12.05, -77.05), offline: false }),
    ],
    alerts: [
      { id: 'alert-1', shipmentId: 'FT-0002', type: 'temperature', reading: 7.8, at: '2026-10-06T20:00:00Z', resolved: false, actions: [] },
      { id: 'alert-2', shipmentId: 'FT-0003', type: 'offline', at: '2026-10-06T20:00:00Z', resolved: false, actions: [] },
    ],
    notifications: [
      { id: 'notice-1', shipmentId: 'FT-0002', type: 'alert', readBy: [], at: '2026-10-06T20:00:00Z' },
      { id: 'notice-2', shipmentId: 'FT-0003', type: 'alert', readBy: [], at: '2026-10-06T20:00:00Z' },
    ],
  };
}
