import { execute, readReport } from '../../shared/application/workspace.js';

export async function downloadThermalReport(shipmentId) {
  const metadata = await execute('generateThermalReport', { id: shipmentId });
  const snapshot = await readReport(metadata.id);
  const file = new Blob([JSON.stringify({ report: metadata, ...snapshot }, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `friotrack-${String(shipmentId).replace(/[^a-zA-Z0-9_-]/g, '_')}-thermal-report.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
