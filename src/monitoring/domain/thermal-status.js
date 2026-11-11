export function thermalStatus(shipment) {
  if (shipment.status === 'scheduled' && !shipment.readings.length) return 'pending';
  if (shipment.offline) return 'offline';
  const reading = shipment.readings.at(-1);
  if (!reading) return 'pending';
  if (reading.temperature < shipment.minTemp || reading.temperature > shipment.maxTemp || reading.humidity < shipment.minHumidity || reading.humidity > shipment.maxHumidity) return 'critical';
  return 'normal';
}
