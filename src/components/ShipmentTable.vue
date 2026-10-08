<script setup>
import { t, formatDate } from '../shared/i18n.js';
import { thermalStatus } from '../domains/operations.js';
import StatusBadge from './StatusBadge.vue';
import { downloadSample } from '../shared/export.js';
defineProps({ shipments: Array, showExport: Boolean });
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
        <td class="actions-cell"><RouterLink :to="`/shipments/${item.id}`" class="icon-link" :aria-label="`${t('viewDetail')} ${item.id}`"><i class="pi pi-arrow-up-right" aria-hidden="true"></i></RouterLink><PButton v-if="showExport" icon="pi pi-download" text :aria-label="`${t('export')} ${item.id}`" @click="downloadSample(item.id)" /></td>
      </tr></tbody>
    </table>
  </div>
</template>
