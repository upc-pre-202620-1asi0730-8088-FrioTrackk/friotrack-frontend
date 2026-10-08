<script setup>
import { computed, nextTick, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { data, execute } from '../infrastructure/demo-repository.js';
import { DomainError } from '../domains/operations.js';
import { t, formatDate } from '../shared/i18n.js';
import { announce, errorText } from '../shared/feedback.js';
const route = useRoute(), router = useRouter();
const existing = data.value.shipments.find(item => item.id === route.params.id);
const editing = !!route.params.id;
const unavailable = editing && (!existing || existing.status !== 'scheduled');
const localInput = (date) => new Date(Date.parse(date) - 5 * 60 * 60 * 1000).toISOString().slice(0, 16);
const draft = reactive(existing ? { ...existing, departure: localInput(existing.departure), arrival: localInput(existing.arrival) } : {
  cargo: '', weight: '', origin: '', destination: '', customerId: '', vehicleId: '', driverId: '',
  departure: localInput(new Date(Date.now() + 86400000).toISOString()), arrival: localInput(new Date(Date.now() + 2 * 86400000).toISOString()), minTemp: 2, maxTemp: 6, minHumidity: 70, maxHumidity: 95,
});
const step = ref(0), error = ref(''), errorBox = ref();
const steps = ['details', 'assignment', 'limits', 'review'];
const vehicles = computed(() => data.value.vehicles.filter(item => item.enabled).map(item => ({ ...item, label: `${item.plate} · ${item.capacity} t · ${item.sensor}` })));
const drivers = computed(() => data.value.drivers.filter(item => item.enabled));
const customers = computed(() => data.value.profiles.filter(item => item.role === 'cargo-client').map(item => ({ ...item, label: `${item.name} · ${item.organization}` })));
function validateStep() {
  if (step.value === 0) {
    if (![draft.cargo, draft.origin, draft.destination].every(value => String(value).trim())) throw new DomainError('requiredFields');
    if (draft.origin.trim().toLowerCase() === draft.destination.trim().toLowerCase()) throw new DomainError('sameRoute');
    if (!(Number(draft.weight) > 0)) throw new DomainError('invalidWeight');
    if (!draft.departure || !draft.arrival || Date.parse(draft.arrival) <= Date.parse(draft.departure)) throw new DomainError('invalidDates');
  }
  if (step.value === 1 && (!draft.vehicleId || !draft.driverId || !draft.customerId)) throw new DomainError('missingAssignment');
  if (step.value === 2) {
    if (draft.minTemp === '' || draft.maxTemp === '' || Number(draft.minTemp) >= Number(draft.maxTemp) || Number(draft.minTemp) < -50 || Number(draft.maxTemp) > 50) throw new DomainError('invalidRange');
    if (draft.minHumidity === '' || draft.maxHumidity === '' || Number(draft.minHumidity) >= Number(draft.maxHumidity) || Number(draft.minHumidity) < 0 || Number(draft.maxHumidity) > 100) throw new DomainError('invalidHumidity');
  }
}
async function submit() {
  error.value = '';
  try {
    if (step.value < 3) { validateStep(); step.value++; return; }
    const payload = { ...draft, departure: `${draft.departure}:00-05:00`, arrival: `${draft.arrival}:00-05:00` };
    const shipment = execute(editing ? 'updateShipment' : 'createShipment', payload);
    announce(editing ? 'shipmentUpdated' : 'shipmentCreated'); router.push(`/shipments/${shipment.id}`);
  } catch (failure) { error.value = errorText(failure); await nextTick(); errorBox.value?.$el?.focus(); }
}
const overview = computed(() => [
  ['cargo', draft.cargo], ['route', `${draft.origin} → ${draft.destination}`], ['weight', `${draft.weight} t`],
  ['vehicle', vehicles.value.find(item => item.id === draft.vehicleId)?.label], ['driver', drivers.value.find(item => item.id === draft.driverId)?.name], ['customer', customers.value.find(item => item.id === draft.customerId)?.label],
  ['departure', draft.departure ? `${formatDate(draft.departure + ':00-05:00')} · Lima` : ''], ['arrival', draft.arrival ? `${formatDate(draft.arrival + ':00-05:00')} · Lima` : ''],
  ['temperature', `${draft.minTemp}–${draft.maxTemp} °C`], ['humidity', `${draft.minHumidity}–${draft.maxHumidity} %`],
]);
</script>
<template>
  <div class="page-heading"><div><RouterLink to="/shipments" class="back-link"><i class="pi pi-arrow-left" aria-hidden="true"></i>{{ t('shipments') }}</RouterLink><h1>{{ t(editing ? 'edit' : 'newShipment') }}</h1><p>{{ t('sampleNotice') }}</p></div><span class="step-count">{{ t('step') }} {{ step + 1 }} {{ t('of') }} 4</span></div>
  <PMessage v-if="unavailable" severity="error">{{ t('editScheduledOnly') }}</PMessage>
  <div v-else class="form-layout"><section class="panel wizard-panel"><ol class="wizard-steps"><li v-for="(label, index) in steps" :key="label" :class="{ current: step === index, completed: step > index }" :aria-current="step === index ? 'step' : undefined"><button type="button" :disabled="index > step" @click="step = index; error = ''"><span>{{ step > index ? '✓' : index + 1 }}</span><strong>{{ t(label) }}</strong></button></li></ol>
    <form class="wizard-form" @submit.prevent="submit"><h2>{{ t(steps[step]) }}</h2><p class="form-caption">* {{ t('required') }}</p>
      <div v-if="step === 0" class="form-grid"><div class="field span-2"><label for="cargo">{{ t('cargo') }} *</label><PInputText id="cargo" v-model="draft.cargo" required maxlength="160"/></div><div class="field"><label for="origin">{{ t('origin') }} *</label><PInputText id="origin" v-model="draft.origin" required maxlength="90"/></div><div class="field"><label for="destination">{{ t('destination') }} *</label><PInputText id="destination" v-model="draft.destination" required maxlength="90"/></div><div class="field"><label for="weight">{{ t('weight') }} *</label><PInputText id="weight" v-model="draft.weight" type="number" min="0.01" max="100" step="0.01" required/></div><div></div><div class="field"><label for="departure">{{ t('departure') }} *</label><PInputText id="departure" v-model="draft.departure" type="datetime-local" required/><small>Lima · UTC−5</small></div><div class="field"><label for="arrival">{{ t('arrival') }} *</label><PInputText id="arrival" v-model="draft.arrival" type="datetime-local" required/><small>Lima · UTC−5</small></div></div>
      <div v-if="step === 1" class="form-grid"><div class="field span-2"><label for="vehicle">{{ t('vehicle') }} *</label><PSelect inputId="vehicle" v-model="draft.vehicleId" :options="vehicles" optionValue="id" optionLabel="label" :placeholder="t('selectVehicle')"/></div><div class="field span-2"><label for="driver">{{ t('driver') }} *</label><PSelect inputId="driver" v-model="draft.driverId" :options="drivers" optionValue="id" optionLabel="name" :placeholder="t('selectDriver')"/></div><div class="field span-2"><label for="customer">{{ t('customer') }} *</label><PSelect inputId="customer" v-model="draft.customerId" :options="customers" optionValue="id" optionLabel="label" :placeholder="t('selectClient')"/></div><PMessage severity="info" class="span-2">{{ t('resourceHelp') }}</PMessage></div>
      <div v-if="step === 2" class="form-grid"><div class="field"><label for="min-temp">{{ t('minTemp') }} *</label><PInputText id="min-temp" v-model="draft.minTemp" type="number" step="0.1" min="-50" max="50" required/></div><div class="field"><label for="max-temp">{{ t('maxTemp') }} *</label><PInputText id="max-temp" v-model="draft.maxTemp" type="number" step="0.1" min="-50" max="50" required/></div><div class="field"><label for="min-humidity">{{ t('minHumidity') }} *</label><PInputText id="min-humidity" v-model="draft.minHumidity" type="number" step="0.1" min="0" max="100" required/></div><div class="field"><label for="max-humidity">{{ t('maxHumidity') }} *</label><PInputText id="max-humidity" v-model="draft.maxHumidity" type="number" step="0.1" min="0" max="100" required/></div><PMessage severity="info" class="span-2">{{ t('rangeHelp') }}</PMessage></div>
      <div v-if="step === 3"><dl class="review-grid"><div v-for="[label, value] in overview" :key="label"><dt>{{ t(label) }}</dt><dd>{{ value }}</dd></div></dl><PMessage severity="info">{{ t('resourceHelp') }}</PMessage></div>
      <PMessage v-if="error" ref="errorBox" tabindex="-1" severity="error" class="form-error">{{ error }}</PMessage><div class="wizard-actions"><PButton v-if="step > 0" :label="t('back')" outlined icon="pi pi-arrow-left" @click="step--; error = ''"/><RouterLink v-else to="/shipments" class="quiet-link">{{ t('cancel') }}</RouterLink><PButton type="submit" :label="t(step === 3 ? (editing ? 'save' : 'create') : 'next')" :icon="step === 3 ? 'pi pi-check' : 'pi pi-arrow-right'" iconPos="right"/></div>
    </form></section><aside class="wizard-aside"><span class="aside-icon"><i class="pi pi-shield" aria-hidden="true"></i></span><h2>{{ t('limits') }}</h2><p>{{ t('rangeHelp') }}</p><div class="aside-tip"><i class="pi pi-info-circle" aria-hidden="true"></i><p>{{ t('resourceHelp') }}</p></div><span class="sample-tag">{{ t('sampleShort') }}</span></aside></div>
</template>
