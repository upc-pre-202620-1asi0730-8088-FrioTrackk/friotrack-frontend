<script setup>
import { computed } from 'vue';
import { data, profile } from '../infrastructure/workspace-repository.js';
import { visibleShipments } from '../domains/operations.js';
import { t } from '../shared/i18n.js';
import ShipmentTable from '../components/ShipmentTable.vue';
import MapPanel from '../components/MapPanel.vue';
const shipments = computed(() => visibleShipments(data.value, profile.value));
const active = computed(() => shipments.value.filter(item => item.status === 'in-transit'));
const alerts = computed(() => data.value.alerts.filter(item => !item.resolved && shipments.value.some(s => s.id === item.shipmentId)));
const stats = computed(() => [
  { label: 'totalShipments', value: shipments.value.length, icon: 'box', tone: 'blue' },
  { label: 'inTransit', value: active.value.length, icon: 'truck', tone: 'teal' },
  { label: 'exceptions', value: alerts.value.length, icon: 'exclamation-triangle', tone: 'amber' },
  { label: 'delivered', value: shipments.value.filter(item => item.status === 'delivered').length, icon: 'check-circle', tone: 'green' },
]);
const alertTitle = (type) => t({ temperature: 'temperatureAlert', humidity: 'humidityAlert', offline: 'offlineAlert' }[type]);
</script>
<template>
  <div class="page-heading"><div><div class="eyebrow">{{ t(profile.role) }}</div><h1>{{ t(profile.role === 'coordinator' ? 'greeting' : 'clientGreeting') }}</h1><p>{{ t(profile.role === 'coordinator' ? 'dashboardSubtitle' : 'clientSubtitle') }}</p></div><RouterLink v-if="profile.role === 'coordinator'" to="/shipments/new" class="button-primary"><i class="pi pi-plus" aria-hidden="true"></i>{{ t('newShipment') }}</RouterLink></div>
  <div class="stats-grid"><article v-for="stat in stats" :key="stat.label" class="stat-card"><div class="stat-top"><span>{{ t(stat.label) }}</span><i :class="[`pi pi-${stat.icon}`, stat.tone]" aria-hidden="true"></i></div><strong>{{ String(stat.value).padStart(2, '0') }}</strong></article></div>
  <PMessage v-if="!shipments.length" severity="info">{{ t(profile.role === 'cargo-client' ? 'newClientEmpty' : 'emptyText') }}</PMessage>
  <div class="overview-grid"><MapPanel :shipments="active"/><section class="panel attention-panel"><div class="panel-head"><h2>{{ t('attention') }}</h2><span class="count-pill">{{ alerts.length }}</span></div><div v-if="!alerts.length" class="empty-success"><i class="pi pi-check-circle" aria-hidden="true"></i><p>{{ t('noAlerts') }}</p></div><article v-for="alert in alerts.slice(0, 3)" :key="alert.id" :class="['attention-card', { offline: alert.type === 'offline' }]"><div class="alert-icon"><i :class="`pi pi-${alert.type === 'offline' ? 'wifi' : 'exclamation-triangle'}`" aria-hidden="true"></i></div><div><span class="attention-id">{{ alert.shipmentId }}</span><h3>{{ alertTitle(alert.type) }}</h3><p>{{ data.shipments.find(s => s.id === alert.shipmentId)?.cargo }}</p><strong v-if="alert.reading !== undefined">{{ alert.reading }} {{ alert.type === 'temperature' ? '°C' : '%' }}</strong><RouterLink :to="`/alerts?shipment=${alert.shipmentId}`">{{ t('openAlert') }} <i class="pi pi-arrow-right" aria-hidden="true"></i></RouterLink></div></article><RouterLink to="/alerts" class="attention-all">{{ t('viewAll') }} <i class="pi pi-arrow-right" aria-hidden="true"></i></RouterLink></section></div>
  <section class="panel"><div class="panel-head"><h2>{{ t('recentShipments') }}</h2><RouterLink to="/shipments">{{ t('viewAll') }} <i class="pi pi-arrow-up-right" aria-hidden="true"></i></RouterLink></div><ShipmentTable v-if="shipments.length" :shipments="shipments.slice(0, 5)"/><div v-else class="empty">{{ t('emptyTitle') }}</div></section>
</template>
