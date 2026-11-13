<script setup>
import { ref } from 'vue';
import { t, formatDate } from '../../../shared/presentation/i18n.js';
import { thermalStatus } from '../../../monitoring/domain/thermal-status.js';
import StatusBadge from '../../../shared/presentation/components/StatusBadge.vue';
import { downloadSample } from '../../../alerts-reporting/application/download-sample.js';
import { downloadThermalReport } from '../../../alerts-reporting/application/download-thermal-report.js';
import { announce } from '../../../shared/presentation/feedback.js';
defineProps({ shipments: Array, showExport: Boolean });
const reportBusy = ref('');
async function exportThermalReport(id) {
  if (reportBusy.value) return;
  reportBusy.value = id;
  try { await downloadThermalReport(id); announce('thermalReportReady'); }
  catch (failure) { announce(failure.code || failure.message || 'unexpected', 'error'); }
  finally { reportBusy.value = ''; }
}
</script>
<template>
  <div class="table-scroll">
    <table class="shipment-table">
      <caption class="sr-only">{{ t('shipments') }}</caption>
      <thead><tr><th scope="col">{{ t('shipment') }}</th><th scope="col">{{ t('route') }}</th><th scope="col">{{ t('temperature') }}</th><th scope="col">{{ t('thermal') }}</th><th scope="col">{{ t('lifecycle') }}</th><th scope="col"><span class="sr-only">{{ t('open') }}</span></th></tr></thead>
      <tbody><tr v-for="item in shipments" :key="item.id">
        <td><RouterLink :to="`/shipments/${item.id}`" class="shipment-id">{{ item.id }}</RouterLink><span class="cell-sub">{{ item.cargo }}</span></td>
        <td><span>{{ item.origin }} <i class="pi pi-arrow-right route-arrow" aria-hidden="true"></i> {{ item.destination }}</span><span class="cell-sub">{{ formatDate(item.arrival) }}</span></td>
        <td><strong class="numeric">{{ item.readings.at(-1)?.temperature ?? '—' }}<small v-if="item.readings.length"> °C</small></strong><span class="cell-sub">{{ item.minTemp }}–{{ item.maxTemp }} °C</span></td>
        <td><StatusBadge :status="thermalStatus(item)" /></td>
        <td><StatusBadge :status="item.status" /></td>
        <td class="actions-cell"><RouterLink :to="`/shipments/${item.id}`" class="icon-link" :aria-label="`${t('viewDetail')} ${item.id}`"><i class="pi pi-arrow-up-right" aria-hidden="true"></i></RouterLink><PButton v-if="showExport" icon="pi pi-download" text :aria-label="`${t('export')} ${item.id}`" @click="downloadSample(item.id)"/><PButton v-if="showExport && item.status === 'delivered'" icon="pi pi-file" text :title="t('thermalReport')" :aria-label="`${t('thermalReport')} ${item.id}`" :loading="reportBusy === item.id" :disabled="!!reportBusy" @click="exportThermalReport(item.id)"/></td>
      </tr></tbody>
    </table>
  </div>
</template>
