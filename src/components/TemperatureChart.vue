<script setup>
import { computed } from 'vue';
import { t, formatDate, language } from '../shared/i18n.js';
const props = defineProps({ shipment: Object });
const values = computed(() => props.shipment.readings);
const bottom = computed(() => Math.min(props.shipment.minTemp, ...values.value.map(v => v.temperature)) - 1.5);
const top = computed(() => Math.max(props.shipment.maxTemp, ...values.value.map(v => v.temperature)) + 1.5);
const y = (value) => 180 - (value - bottom.value) / (top.value - bottom.value) * 150;
const x = (index) => 45 + index / Math.max(1, values.value.length - 1) * 655;
const line = computed(() => values.value.map((v, index) => `${x(index)},${y(v.temperature)}`).join(' '));
const temperatureFormatter = computed(() => new Intl.NumberFormat(language.value === 'es' ? 'es-419' : 'en-US', { maximumFractionDigits: 1, useGrouping: false }));
const chartLabel = computed(() => `${t('temperature')}: ${values.value.map(value => temperatureFormatter.value.format(value.temperature) + ' °C').join(', ')}`);
</script>
<template>
  <section class="panel temperature-panel"><div class="panel-head"><div><h2>{{ t('readings') }}</h2><p>{{ t('readingNotice') }}</p></div><span class="range-label">{{ shipment.minTemp }}–{{ shipment.maxTemp }} °C</span></div>
    <p v-if="!values.length" class="empty">{{ t('noReadings') }}</p>
    <template v-else><svg class="temperature-chart" viewBox="0 0 750 225" role="img" :aria-label="chartLabel"><rect x="45" :y="y(shipment.maxTemp)" width="655" :height="y(shipment.minTemp) - y(shipment.maxTemp)" fill="#e7f6ec"/><g v-for="value in [shipment.minTemp, shipment.maxTemp]" :key="value"><line x1="45" x2="700" :y1="y(value)" :y2="y(value)" stroke="#aacbbb" stroke-dasharray="5 5"/><text x="8" :y="y(value) + 4" fill="#64748b" font-size="12">{{ value }}°</text></g><polyline :points="line" fill="none" stroke="#0b5ed7" stroke-width="3" stroke-linejoin="round"/><g v-for="(reading, index) in values" :key="index"><circle :cx="x(index)" :cy="y(reading.temperature)" r="5" :fill="reading.temperature < shipment.minTemp || reading.temperature > shipment.maxTemp ? '#b42318' : '#0b5ed7'" stroke="white" stroke-width="2"/><text v-if="index === 0 || index === values.length - 1" :x="x(index)" y="216" text-anchor="middle" fill="#64748b" font-size="12">{{ formatDate(reading.at).split(',').at(-1) }}</text></g></svg>
      <details class="reading-details"><summary>{{ t('tableData') }} ({{ values.length }})</summary><div class="table-scroll"><table><thead><tr><th scope="col">{{ t('timestamp') }}</th><th scope="col">{{ t('temperature') }}</th><th scope="col">{{ t('humidity') }}</th><th scope="col">{{ t('latitude') }}</th><th scope="col">{{ t('longitude') }}</th></tr></thead><tbody><tr v-for="(reading, index) in values" :key="index"><td>{{ formatDate(reading.at) }}</td><td>{{ reading.temperature }} °C</td><td>{{ reading.humidity }} %</td><td>{{ reading.lat }}</td><td>{{ reading.lng }}</td></tr></tbody></table></div></details>
    </template>
  </section>
</template>
