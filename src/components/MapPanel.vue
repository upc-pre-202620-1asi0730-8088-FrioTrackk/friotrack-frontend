<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { language, t } from '../shared/i18n.js';
import 'leaflet/dist/leaflet.css';
const props = defineProps({ shipments: { type: Array, default: () => [] }, compact: Boolean });
const mapElement = ref(), loaded = ref(false), mapError = ref(false);
let map, leaflet, layers, tiles, zoom;
let tileAttribution = '';
const attribution = () => `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ${t('mapContributors')}`;
function updateMapLanguage() {
  if (!map) return;
  if (zoom) zoom.remove();
  zoom = leaflet.control.zoom({ zoomInTitle: t('zoomIn'), zoomOutTitle: t('zoomOut') }).addTo(map);
  if (tileAttribution) map.attributionControl.removeAttribution(tileAttribution);
  tileAttribution = attribution();
  map.attributionControl.addAttribution(tileAttribution);
  if (tiles) tiles.options.attribution = tileAttribution;
}
const points = computed(() => props.shipments.filter(item => item.readings.length).map(item => ({ id: item.id, ...item.readings.at(-1), origin: item.origin, destination: item.destination })));
const project = (point) => ({ x: 60 + ((point.lng + 81.8) / 8) * 490, y: 35 + ((-4.0 - point.lat) / 11.8) * 310 });
function drawMap() {
  if (!map) return;
  if (layers) layers.clearLayers();
  else layers = leaflet.featureGroup().addTo(map);
  for (const shipment of props.shipments) {
    if (!shipment.readings.length) continue;
    leaflet.polyline(shipment.readings.map(item => [item.lat, item.lng]), { color: '#0b5ed7', weight: 3, dashArray: '6 5' }).addTo(layers);
    const point = shipment.readings.at(-1);
    leaflet.marker([point.lat, point.lng], { icon: leaflet.divIcon({ className: '', html: '<span class="leaflet-pin"></span>', iconSize: [20, 20] }), keyboard: true, title: `${shipment.id}: ${shipment.origin} → ${shipment.destination}` }).addTo(layers);
  }
  if (points.value.length) map.fitBounds(layers.getBounds(), { padding: [34, 34], maxZoom: 9 });
  else map.setView([-10.2, -77.6], 6);
}
async function loadMap() {
  loaded.value = true;
  try {
    const imported = await import('leaflet'); leaflet = imported.default;
    await nextTick();
    map = leaflet.map(mapElement.value, { scrollWheelZoom: false, zoomControl: false }).setView([-10.2, -77.6], 6);
    tiles = leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).on('tileerror', () => { mapError.value = true; }).addTo(map);
    updateMapLanguage();
    drawMap(); setTimeout(() => map.invalidateSize(), 150);
  } catch { mapError.value = true; }
}
watch(points, drawMap);
watch(language, updateMapLanguage);
onBeforeUnmount(() => map?.remove());
</script>
<template>
  <section :class="['panel map-panel', { compact }]">
    <div class="panel-head"><div><h2>{{ t('activeRoutes') }}</h2><p>{{ t('routeHelp') }}</p></div><span class="map-label">PERÚ</span></div>
    <div v-if="!loaded" class="illustrative-map">
      <svg viewBox="0 0 620 400" aria-hidden="true"><defs><pattern id="map-grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="#dfe9f0" stroke-width="1"/></pattern></defs><rect width="620" height="400" fill="#edf5f9"/><rect width="620" height="400" fill="url(#map-grid)"/><path d="M240 0L310 55 280 125 335 185 315 225 372 310 358 370 404 400H620V0Z" fill="#fafcf9" stroke="#d5e5db"/><path d="M305 0L338 68 318 129 370 199 349 237 405 313 402 371" fill="none" stroke="#e5ede0" stroke-width="24"/><path d="M248 45Q205 100 243 164T305 267T366 350" fill="none" stroke="#91b9d9" stroke-width="2" stroke-dasharray="6 8"/><text x="64" y="315" fill="#829aac" font-size="15" letter-spacing="3">PACÍFICO</text><text x="430" y="90" fill="#9aad9b" font-size="15" letter-spacing="3">PERÚ</text><g v-for="point in points" :key="point.id" :transform="`translate(${project(point).x}, ${project(point).y})`"><circle r="20" fill="#0b5ed716"/><circle r="8" fill="#0b5ed7" stroke="white" stroke-width="3"/><rect x="14" y="-17" width="82" height="31" rx="8" fill="white" stroke="#dce5ef"/><text x="24" y="3" font-size="12" font-weight="600" fill="#0f172a">{{ point.id }}</text></g></svg>
      <div class="map-key"><span class="map-dot"></span>{{ t('sampleShort') }}</div>
    </div>
    <div v-else ref="mapElement" class="leaflet-map" role="region" :aria-label="t('activeRoutes')"></div>
    <div class="map-footer"><PButton v-if="!loaded" :label="t('loadMap')" icon="pi pi-map" size="small" outlined @click="loadMap"/><p>{{ t(mapError ? 'mapOffline' : 'mapPrivacy') }}</p></div>
    <ul class="coordinate-list"><li v-for="point in points" :key="point.id"><RouterLink :to="`/shipments/${point.id}`">{{ point.id }}</RouterLink><span>{{ point.origin }} → {{ point.destination }}</span><small>{{ point.lat.toFixed(4) }}, {{ point.lng.toFixed(4) }}</small></li></ul>
  </section>
</template>
