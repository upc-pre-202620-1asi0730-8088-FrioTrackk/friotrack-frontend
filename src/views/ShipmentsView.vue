<script setup>
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { data, profile } from '../infrastructure/workspace-repository.js';
import { visibleShipments, thermalStatus } from '../domains/operations.js';
import { t } from '../shared/i18n.js';
import ShipmentTable from '../components/ShipmentTable.vue';
const route = useRoute();
const search = ref(''), status = ref('all'), thermal = ref('all');
const historical = computed(() => route.path === '/history');
const statuses = computed(() => ['all', 'scheduled', 'in-transit', 'delivered', 'cancelled'].map(value => ({ value, label: t(value) })));
const thermalOptions = computed(() => ['all', 'normal', 'critical', 'offline', 'pending'].map(value => ({ value, label: t(value) })));
const results = computed(() => visibleShipments(data.value, profile.value).filter(item => {
  const query = search.value.trim().toLowerCase();
  return (!query || [item.id, item.cargo, item.origin, item.destination].some(text => text.toLowerCase().includes(query))) && (status.value === 'all' || item.status === status.value) && (thermal.value === 'all' || thermalStatus(item) === thermal.value);
}));
function clear() { search.value = ''; status.value = 'all'; thermal.value = 'all'; }
</script>
<template>
  <div class="page-heading"><div><h1>{{ t(historical ? 'history' : 'shipments') }}</h1><p>{{ t(historical ? 'exportHelp' : 'dashboardSubtitle') }}</p></div><RouterLink v-if="profile.role === 'coordinator' && !historical" to="/shipments/new" class="button-primary"><i class="pi pi-plus" aria-hidden="true"></i>{{ t('newShipment') }}</RouterLink></div>
  <section class="panel"><form class="filter-bar" @submit.prevent><div class="field search-field"><label class="sr-only" for="shipment-search">{{ t('search') }}</label><i class="pi pi-search" aria-hidden="true"></i><PInputText id="shipment-search" v-model="search" :placeholder="t('search')"/></div><div class="field"><label class="sr-only" for="status-filter">{{ t('filterStatus') }}</label><PSelect inputId="status-filter" v-model="status" :options="statuses" optionLabel="label" optionValue="value" :aria-label="t('filterStatus')"/></div><div class="field"><label class="sr-only" for="thermal-filter">{{ t('filterThermal') }}</label><PSelect inputId="thermal-filter" v-model="thermal" :options="thermalOptions" optionLabel="label" optionValue="value" :aria-label="t('filterThermal')"/></div><PButton text :label="t('clearFilters')" icon="pi pi-filter-slash" @click="clear"/></form><div class="results-count" aria-live="polite">{{ results.length }} {{ t('results') }}</div><ShipmentTable v-if="results.length" :shipments="results" :show-export="historical"/><div v-else class="empty-state"><i class="pi pi-inbox" aria-hidden="true"></i><h2>{{ t('noResults') }}</h2><PButton :label="t('clearFilters')" outlined @click="clear"/></div></section>
</template>
