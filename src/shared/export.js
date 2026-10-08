import { toRaw } from 'vue';
import { sampleReport } from '../domains/operations.js';
import { data, profile } from '../infrastructure/demo-repository.js';

export function downloadSample(id) {
  const content = '\ufeff' + sampleReport(toRaw(data.value), toRaw(profile.value), id);
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = `${id}-sample-traceability.csv`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
