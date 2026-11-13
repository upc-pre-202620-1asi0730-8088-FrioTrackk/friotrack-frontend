<script setup>
import { computed, reactive, ref } from 'vue';
import { data, execute } from '../../../shared/application/workspace.js';
import { t } from '../../../shared/presentation/i18n.js';
import { announce, errorText } from '../../../shared/presentation/feedback.js';
const tab = ref('vehicles'), dialogOpen = ref(false), editing = ref(''), error = ref(''), busy = ref(false);
const draft = reactive({});
const resources = computed(() => data.value[tab.value] || []);
const icon = computed(() => ({ vehicles: 'truck', drivers: 'user', sensors: 'microchip' }[tab.value]));
const resourceName = item => item.plate || item.name || item.serialCode;
const addLabel = computed(() => ({ vehicles: 'addVehicle', drivers: 'addDriver', sensors: 'addSensor' }[tab.value]));
const availableVehicles = computed(() => data.value.vehicles.filter(vehicle => vehicle.enabled && !(data.value.sensors || []).some(sensor => sensor.id !== editing.value && sensor.vehicleId === vehicle.id)));
const vehicleName = id => data.value.vehicles.find(vehicle => vehicle.id === id)?.plate || t('unassigned');
function assigned(id) {
  const vehicleId = tab.value === 'sensors' ? resources.value.find(sensor => sensor.id === id)?.vehicleId : id;
  return data.value.shipments.some(item => ['scheduled', 'in-transit'].includes(item.status) && item[tab.value === 'drivers' ? 'driverId' : 'vehicleId'] === vehicleId);
}
function open(item) {
  editing.value = item?.id || '';
  Object.keys(draft).forEach(key => delete draft[key]);
  Object.assign(draft, item || ({ vehicles: { plate: '', capacity: '', enabled: true }, drivers: { name: '', license: '', enabled: true }, sensors: { serialCode: '', vehicleId: null, enabled: true } }[tab.value]));
  error.value = ''; dialogOpen.value = true;
}
async function save() {
  if (busy.value) return;
  busy.value = true; error.value = '';
  try {
    const command = { vehicles: 'saveVehicle', drivers: 'saveDriver', sensors: 'saveSensor' }[tab.value];
    const payload = { ...draft, id: editing.value || undefined };
    // Sensor assignment is managed from its independent inventory form.
    if (tab.value === 'vehicles') delete payload.sensor;
    if (tab.value === 'sensors') payload.vehicleId = payload.vehicleId || null;
    await execute(command, payload);
    dialogOpen.value = false; announce('saved');
  } catch (failure) { error.value = errorText(failure); }
  finally { busy.value = false; }
}
</script>
<template>
  <div class="page-heading"><div><h1>{{ t('fleet') }}</h1><p>{{ t('resourceLocked') }}</p></div><PButton :label="t(addLabel)" icon="pi pi-plus" @click="open()"/></div>
  <div class="section-tabs" role="group" :aria-label="t('fleet')"><button v-for="type in ['vehicles', 'drivers', 'sensors']" :key="type" :aria-pressed="tab === type" @click="tab = type"><i :class="`pi pi-${{ vehicles: 'truck', drivers: 'id-card', sensors: 'microchip' }[type]}`" aria-hidden="true"></i>{{ t(type) }} <span>{{ (data[type] || []).length }}</span></button></div>
  <p v-if="tab === 'sensors'" class="muted">{{ t('sensorOwnershipHelp') }}</p>
  <div v-if="!resources.length" class="panel empty-state"><i :class="`pi pi-${icon}`" aria-hidden="true"></i><h2>{{ t('noResources') }}</h2></div>
  <div class="resource-grid"><article v-for="item in resources" :key="item.id" class="panel resource-card">
    <div class="resource-head"><span class="resource-icon"><i :class="`pi pi-${icon}`" aria-hidden="true"></i></span><PButton icon="pi pi-pencil" :aria-label="`${t('editResource')} ${resourceName(item)}`" text :disabled="assigned(item.id)" @click="open(item)"/></div>
    <h2>{{ resourceName(item) }}</h2>
    <dl v-if="tab === 'vehicles'"><div><dt>{{ t('capacity') }}</dt><dd>{{ item.capacity }} t</dd></div><div><dt>{{ t('sensor') }}</dt><dd>{{ item.sensor || t('unassigned') }}</dd></div></dl>
    <dl v-else-if="tab === 'drivers'"><div><dt>{{ t('license') }}</dt><dd>{{ item.license }}</dd></div></dl>
    <dl v-else><div><dt>{{ t('vehicle') }}</dt><dd>{{ vehicleName(item.vehicleId) }}</dd></div></dl>
    <span :class="['status', item.enabled ? 'normal' : 'offline']"><i :class="`pi pi-${item.enabled ? 'check-circle' : 'ban'}`" aria-hidden="true"></i>{{ t(item.enabled ? 'enabled' : 'disabled') }}</span>
    <p v-if="assigned(item.id)" class="resource-assigned"><i class="pi pi-lock" aria-hidden="true"></i>{{ t('selected') }}</p>
  </article></div>
  <PDialog v-model:visible="dialogOpen" modal :closable="!busy" :closeOnEscape="!busy" :header="t(editing ? 'editResource' : addLabel)" :style="{ width: '32rem', maxWidth: '94vw' }">
    <form id="resource-form" :aria-busy="busy" @submit.prevent="save">
      <template v-if="tab === 'vehicles'">
        <div class="field"><label for="resource-plate">{{ t('plate') }} *</label><PInputText id="resource-plate" v-model="draft.plate" placeholder="A1B-728" required maxlength="7" pattern="[A-Za-z0-9]{3}-[A-Za-z0-9]{3}" :disabled="busy"/></div>
        <div class="field"><label for="resource-capacity">{{ t('capacity') }} *</label><PInputText id="resource-capacity" v-model="draft.capacity" type="number" min="0.01" max="100" step="0.01" required :disabled="busy"/></div>
      </template>
      <template v-else-if="tab === 'drivers'">
        <div class="field"><label for="resource-name">{{ t('name') }} *</label><PInputText id="resource-name" v-model="draft.name" required maxlength="90" :disabled="busy"/></div>
        <div class="field"><label for="resource-license">{{ t('license') }} *</label><PInputText id="resource-license" v-model="draft.license" required maxlength="50" :disabled="busy"/></div>
      </template>
      <template v-else>
        <div class="field"><label for="sensor-serial">{{ t('sensorSerial') }} *</label><PInputText id="sensor-serial" v-model="draft.serialCode" required maxlength="50" :disabled="busy"/></div>
        <div class="field"><label for="sensor-vehicle">{{ t('vehicle') }}</label><PSelect inputId="sensor-vehicle" v-model="draft.vehicleId" :options="availableVehicles" optionLabel="plate" optionValue="id" :placeholder="t('unassigned')" showClear :disabled="busy"/></div>
      </template>
      <div class="checkbox-field"><PCheckbox v-model="draft.enabled" :binary="true" inputId="resource-enabled" :disabled="busy"/><label for="resource-enabled">{{ t('enabledLabel') }}</label></div>
      <PMessage v-if="error" severity="error" class="form-error" role="alert">{{ error }}</PMessage>
    </form>
    <template #footer><PButton :label="t('cancel')" text :disabled="busy" @click="dialogOpen = false"/><PButton :label="t('save')" type="submit" form="resource-form" icon="pi pi-check" :loading="busy" :disabled="busy"/></template>
  </PDialog>
</template>
