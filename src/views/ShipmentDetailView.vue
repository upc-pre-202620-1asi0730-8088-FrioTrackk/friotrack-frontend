<script setup>
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { canManage, canView, thermalStatus } from '../domains/operations.js';
import { data, execute, profile } from '../infrastructure/demo-repository.js';
import { t, formatDate } from '../shared/i18n.js';
import { announce, errorText } from '../shared/feedback.js';
import { downloadSample } from '../shared/export.js';
import StatusBadge from '../components/StatusBadge.vue';
import TemperatureChart from '../components/TemperatureChart.vue';
import MapPanel from '../components/MapPanel.vue';
const route = useRoute(), router = useRouter();
const shipment = computed(() => { const item = data.value.shipments.find(s => s.id === route.params.id); return item && canView(profile.value, item) ? item : null; });
const manager = computed(() => canManage(profile.value));
const reading = computed(() => shipment.value?.readings.at(-1));
const metadata = computed(() => shipment.value ? [
  ['vehicle', data.value.vehicles.find(item => item.id === shipment.value.vehicleId)?.plate],
  ['driver', data.value.drivers.find(item => item.id === shipment.value.driverId)?.name],
  ['customer', data.value.profiles.find(item => item.id === shipment.value.customerId)?.organization],
  ['weight', `${shipment.value.weight} t`],
  ['departure', formatDate(shipment.value.departure)], ['arrival', formatDate(shipment.value.arrival)],
  ['temperature', `${shipment.value.minTemp}–${shipment.value.maxTemp} °C`], ['humidity', `${shipment.value.minHumidity}–${shipment.value.maxHumidity} %`],
] : []);
const shipmentAlerts = computed(() => data.value.alerts.filter(a => a.shipmentId === shipment.value?.id && !a.resolved));
const dialog = ref(''), error = ref(''), note = ref('');
const sampleReading = reactive({ temperature: 4, humidity: 82, lat: -12.05, lng: -77.05 });
function show(type) { dialog.value = type; error.value = ''; note.value = ''; if (type === 'reading' && reading.value) Object.assign(sampleReading, reading.value); }
function confirm() {
  error.value = '';
  try {
    if (dialog.value === 'delete') { execute('deleteShipment', { id: shipment.value.id, version: shipment.value.version }); announce('deleted'); router.push('/shipments'); }
    else if (dialog.value === 'reading') { execute('addReading', { id: shipment.value.id, ...sampleReading }); announce('readingAdded'); }
    else if (dialog.value === 'incident') { execute('recordIncident', { id: shipment.value.id, note: note.value }); announce('incident'); }
    else { execute('transition', { id: shipment.value.id, version: shipment.value.version, status: dialog.value, note: note.value }); announce('updated'); }
    dialog.value = '';
  } catch (failure) { error.value = errorText(failure); }
}
const dialogTitle = computed(() => t({ delete: 'confirmDelete', reading: 'addReading', 'in-transit': 'start', delivered: 'deliver', cancelled: 'cancelTrip', incident: 'recordIncident' }[dialog.value]));
const eventLabel = (action) => t(action === 'correctiveAction' ? 'correctiveActionEvent' : action);
const eventNote = (event) => event.action === 'created' && event.note === 'Seeded sample shipment' && event.actor === 'Sample workspace' ? t('seededShipment') : event.action === 'created' && event.note === 'Local sample shipment' ? t('localShipment') : event.note;
const eventActor = (event) => event.action === 'created' && event.actor === 'Sample workspace' && event.note === 'Seeded sample shipment' ? t('sampleWorkspace') : event.actor;
</script>
<template>
  <div v-if="!shipment" class="panel empty-state"><i class="pi pi-lock" aria-hidden="true"></i><h1>{{ t('notFoundTitle') }}</h1><p>{{ t('notFoundText') }}</p><RouterLink to="/shipments" class="button-primary">{{ t('shipments') }}</RouterLink></div>
  <template v-else>
    <div class="page-heading"><div><RouterLink to="/shipments" class="back-link"><i class="pi pi-arrow-left" aria-hidden="true"></i>{{ t('shipments') }}</RouterLink><div class="detail-title"><h1>{{ shipment.id }}</h1><StatusBadge :status="shipment.status"/></div><p>{{ shipment.cargo }} <span class="heading-divider">·</span> {{ shipment.origin }} → {{ shipment.destination }}</p></div><div class="heading-actions"><PButton :label="t('export')" icon="pi pi-download" outlined @click="downloadSample(shipment.id)"/><RouterLink v-if="manager && shipment.status === 'scheduled'" :to="`/shipments/${shipment.id}/edit`" class="button-primary"><i class="pi pi-pencil" aria-hidden="true"></i>{{ t('edit') }}</RouterLink></div></div>
    <PMessage v-if="shipmentAlerts.length" severity="warn" class="detail-warning"><RouterLink :to="`/alerts?shipment=${shipment.id}`">{{ shipmentAlerts.length }} {{ t('exceptions') }} · {{ t('openAlert') }}</RouterLink></PMessage>
    <div class="detail-stats"><article class="stat-card"><div class="stat-top"><span>{{ t('temperature') }}</span><i class="pi pi-chart-line blue" aria-hidden="true"></i></div><strong>{{ reading?.temperature ?? '—' }}<small v-if="reading">°C</small></strong><StatusBadge :status="thermalStatus(shipment)"/></article><article class="stat-card"><div class="stat-top"><span>{{ t('humidity') }}</span><i class="pi pi-percentage teal" aria-hidden="true"></i></div><strong>{{ reading?.humidity ?? '—' }}<small v-if="reading">%</small></strong><span class="stat-meta">{{ shipment.minHumidity }}–{{ shipment.maxHumidity }} %</span></article><article class="stat-card reading-card"><div class="stat-top"><span>{{ t('lastReading') }}</span><i class="pi pi-clock blue" aria-hidden="true"></i></div><strong>{{ reading ? formatDate(reading.at) : t('noReadings') }}</strong><span class="stat-meta">{{ t('sampleShort') }} · Lima, UTC−5</span></article></div>
    <div class="detail-grid"><div class="detail-main"><TemperatureChart :shipment="shipment"/><MapPanel :shipments="[shipment]" compact/><section class="panel"><div class="panel-head"><h2>{{ t('timeline') }}</h2><span class="count-pill">{{ shipment.history.length }}</span></div><ol class="timeline"><li v-for="(event, index) in [...shipment.history].reverse()" :key="index"><span class="timeline-dot"></span><div><strong>{{ eventLabel(event.action) }}</strong><small>{{ formatDate(event.at) }} · {{ eventActor(event) }}</small><p v-if="event.note">{{ eventNote(event) }}</p></div></li></ol></section></div><aside class="detail-aside"><section class="panel"><div class="panel-head"><h2>{{ t('details') }}</h2></div><dl class="metadata"><div v-for="[label, value] in metadata" :key="label"><dt>{{ t(label) }}</dt><dd>{{ value }}</dd></div></dl></section><section v-if="manager" class="panel trip-actions"><div class="panel-head"><h2>{{ t('lifecycle') }}</h2></div><p>{{ t('transitionHelp') }}</p><PButton v-if="shipment.status === 'scheduled'" :label="t('start')" icon="pi pi-play" @click="show('in-transit')"/><PButton v-if="shipment.status === 'in-transit'" :label="t('deliver')" icon="pi pi-check-circle" @click="show('delivered')"/><PButton v-if="shipment.status === 'in-transit'" :label="t('addReading')" icon="pi pi-plus" outlined @click="show('reading')"/><PButton :label="t('recordIncident')" icon="pi pi-file-edit" outlined @click="show('incident')"/><PButton v-if="shipment.status === 'scheduled'" :label="t('cancelTrip')" icon="pi pi-ban" outlined severity="danger" @click="show('cancelled')"/><PButton v-if="shipment.status === 'scheduled'" :label="t('delete')" icon="pi pi-trash" text severity="danger" @click="show('delete')"/></section><p class="export-note"><i class="pi pi-info-circle" aria-hidden="true"></i>{{ t('exportHelp') }}</p></aside></div>
  </template>
  <PDialog :visible="!!dialog" @update:visible="value => { if (!value) dialog = '' }" :header="dialogTitle" modal :style="{ width: '34rem', maxWidth: '94vw' }"><form v-if="shipment" id="detail-action-form" @submit.prevent="confirm"><p v-if="dialog === 'delete'">{{ t('deleteHelp') }}</p><template v-else-if="dialog === 'reading'"><p>{{ t('readingNotice') }}</p><div class="form-grid"><div v-for="[key, label, min, max, step] in [['temperature','temperature',-50,50,0.1],['humidity','humidity',0,100,0.1],['lat','latitude',-90,90,0.0001],['lng','longitude',-180,180,0.0001]]" :key="key" class="field"><label :for="`reading-${key}`">{{ t(label) }} *</label><PInputText :id="`reading-${key}`" v-model="sampleReading[key]" type="number" :min="min" :max="max" :step="step" required/></div></div></template><div v-else class="field"><p>{{ t(dialog === 'incident' ? 'incidentHelp' : 'transitionHelp') }}</p><label for="action-note">{{ t('actionNote') }}{{ ['cancelled', 'incident'].includes(dialog) ? ' *' : '' }}</label><PTextarea id="action-note" v-model="note" rows="4" :required="['cancelled', 'incident'].includes(dialog)" :minlength="dialog === 'incident' ? 8 : undefined" maxlength="1000"/></div><PMessage v-if="error" severity="error" class="form-error">{{ error }}</PMessage></form><template #footer><PButton :label="t('cancel')" text @click="dialog = ''"/><PButton :label="dialogTitle" :severity="['delete', 'cancelled'].includes(dialog) ? 'danger' : undefined" type="submit" form="detail-action-form"/></template></PDialog>
</template>

