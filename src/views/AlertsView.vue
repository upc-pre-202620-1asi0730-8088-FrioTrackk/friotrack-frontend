<script setup>
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { data, execute, profile } from '../infrastructure/demo-repository.js';
import { canView } from '../domains/operations.js';
import { t, formatDate } from '../shared/i18n.js';
import { announce, errorText } from '../shared/feedback.js';
const route = useRoute();
const filter = ref('open'), resolving = ref(null), note = ref(''), error = ref(''), notifyClient = ref(false);
const options = computed(() => [{ value: 'open', label: t('openAlerts') }, { value: 'resolved', label: t('resolved') }, { value: 'all', label: t('allAlerts') }]);
const alerts = computed(() => data.value.alerts.filter(alert => {
  const shipment = data.value.shipments.find(item => item.id === alert.shipmentId);
  return shipment && canView(profile.value, shipment) && (filter.value === 'all' || (filter.value === 'resolved' ? alert.resolved : !alert.resolved)) && (!route.query.shipment || route.query.shipment === alert.shipmentId);
}));
const alertTitle = (type) => t({ temperature: 'temperatureAlert', humidity: 'humidityAlert', offline: 'offlineAlert' }[type]);
function start(alert) { resolving.value = alert; note.value = ''; error.value = ''; notifyClient.value = false; }
function resolve() {
  try { execute('recordCorrectiveAction', { id: resolving.value.id, note: note.value, notifyClient: notifyClient.value }); resolving.value = null; announce('correctiveSaved'); }
  catch (failure) { error.value = errorText(failure); }
}
</script>
<template>
  <div class="page-heading"><div><div class="eyebrow">{{ t('sampleShort') }}</div><h1>{{ t('alerts') }}</h1><p>{{ t('actionHelp') }}</p></div><div class="field"><label class="sr-only" for="alerts-filter">{{ t('filterStatus') }}</label><PSelect inputId="alerts-filter" v-model="filter" :options="options" optionLabel="label" optionValue="value"/></div></div>
  <div v-if="route.query.shipment" class="selected-filter"><span>{{ t('shipment') }}: {{ route.query.shipment }}</span><RouterLink to="/alerts">{{ t('clearFilters') }}</RouterLink></div>
  <div v-if="!alerts.length" class="panel empty-state"><i class="pi pi-check-circle" aria-hidden="true"></i><h2>{{ t('noAlerts') }}</h2></div>
  <section v-for="alert in alerts" :key="alert.id" class="panel alert-panel"><div class="alert-summary"><span :class="['alert-symbol', { offline: alert.type === 'offline', resolved: alert.resolved }]"><i :class="`pi pi-${alert.resolved ? 'check-circle' : alert.type === 'offline' ? 'wifi' : 'exclamation-triangle'}`" aria-hidden="true"></i></span><div><RouterLink :to="`/shipments/${alert.shipmentId}`" class="shipment-id">{{ alert.shipmentId }}</RouterLink><h2>{{ alertTitle(alert.type) }}</h2><p>{{ data.shipments.find(s => s.id === alert.shipmentId)?.cargo }} · {{ formatDate(alert.at) }}</p></div><div class="alert-reading"><strong v-if="alert.reading !== undefined">{{ alert.reading }}<small>{{ alert.type === 'temperature' ? '°C' : '%' }}</small></strong><span v-else class="status offline">{{ t('offline') }}</span><span v-if="alert.resolved" class="status resolved">{{ t('resolved') }}</span><span v-else-if="alert.acknowledged" class="status scheduled">{{ t('acknowledged') }}</span></div></div><div class="alert-content"><div><h3>{{ t('actions') }}</h3><p v-if="!alert.actions.length" class="muted">{{ t('noActions') }}</p><ul v-else class="action-records"><li v-for="(action, index) in alert.actions" :key="index"><p>{{ action.note }}</p><small>{{ action.actor }} · {{ formatDate(action.at) }}</small></li></ul></div><PButton v-if="!alert.resolved && profile.role === 'coordinator'" :label="t('correctiveAction')" icon="pi pi-file-edit" @click="start(alert)"/><RouterLink v-else :to="`/shipments/${alert.shipmentId}`" class="quiet-link">{{ t('viewDetail') }}</RouterLink></div></section>
  <PDialog :visible="!!resolving" @update:visible="value => { if (!value) resolving = null }" :header="t('correctiveAction')" modal :style="{ width: '35rem', maxWidth: '94vw' }"><form id="corrective-action-form" @submit.prevent="resolve"><p>{{ t('actionHelp') }}</p><div class="field"><label for="corrective-note">{{ t('actionNote') }} *</label><PTextarea id="corrective-note" v-model="note" rows="5" required minlength="8" maxlength="1000"/></div><div class="checkbox-field"><PCheckbox v-model="notifyClient" inputId="notify-client" :binary="true"/><label for="notify-client">{{ t('notifyClient') }}</label></div><PMessage v-if="error" severity="error" class="form-error">{{ error }}</PMessage></form><template #footer><PButton :label="t('cancel')" text @click="resolving = null"/><PButton :label="t('recordAction')" type="submit" form="corrective-action-form" icon="pi pi-check"/></template></PDialog>
</template>

