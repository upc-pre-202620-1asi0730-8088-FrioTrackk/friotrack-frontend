<script setup>
import {ref,computed,watch} from 'vue';
import {data,readMonthlyAnalytics,readQuarterlyAnalytics,readOperationalAudit,downloadMonthlyPdf} from '../../../shared/application/workspace.js';
import {t,formatDate} from '../../../shared/presentation/i18n.js';
import {errorText} from '../../../shared/presentation/feedback.js';
import {downloadFile} from '../../application/download-file.js';
const latest=data.value.shipments.map(s=>s.departure).sort().at(-1);
const periodMode=ref('month'),actor=ref('');
const month=ref((latest||new Date().toISOString()).slice(0,7)),summary=ref(null),audit=ref([]),error=ref(''),busy=ref(false),downloading=ref(false);
let revision=0;
const quarter=computed(()=>Math.floor((Number(month.value.slice(5,7))-1)/3)+1);
const year=computed(()=>Number(month.value.slice(0,4)));
const periodLabel=computed(()=>periodMode.value==='quarter'?`${year.value}-Q${quarter.value}`:month.value);
function auditFilters(){
  const filters={};
  if(periodMode.value==='quarter'){
    const start=new Date(Date.UTC(year.value,(quarter.value-1)*3,1));
    const end=new Date(Date.UTC(year.value,quarter.value*3,1));
    filters.from=start.toISOString();filters.to=end.toISOString();
  }else filters.month=month.value;
  if(actor.value.trim())filters.actor=actor.value.trim();
  return filters;
}
async function load(){const current=++revision;error.value='';busy.value=true;try{
  const [result,events]=await Promise.all([periodMode.value==='quarter'?readQuarterlyAnalytics(year.value,quarter.value):readMonthlyAnalytics(month.value),readOperationalAudit(auditFilters())]);
  if(current!==revision)return;summary.value=result;audit.value=events;
}catch(failure){if(current===revision){summary.value=null;audit.value=[];error.value=errorText(failure);}}finally{if(current===revision)busy.value=false;}}
async function download(){if(downloading.value)return;downloading.value=true;try{downloadFile(await downloadMonthlyPdf(month.value),`friotrack-monthly-${month.value}.pdf`);}catch(failure){error.value=errorText(failure);}finally{downloading.value=false;}}
const maxAlerts=computed(()=>Math.max(1,...(summary.value?.routes||[]).map(r=>r.alerts)));
watch([month,periodMode],()=>{if(/^\d{4}-\d{2}$/.test(month.value))load();},{immediate:true});
</script>
<template>
  <div class="page-heading"><div><h1>{{t('analytics')}}</h1><p>{{t('analyticsHelp')}}</p></div><PButton v-if="periodMode==='month'" :label="t('monthlyPdf')" icon="pi pi-file-pdf" :loading="downloading" :disabled="busy||!summary" @click="download"/></div>
  <section class="panel analytics-toolbar"><label for="analytics-period">{{t('period')}}</label><select id="analytics-period" v-model="periodMode"><option value="month">{{t('monthly')}}</option><option value="quarter">{{t('quarterly')}}</option></select><label for="analytics-month">{{t('departureMonth')}}</label><input id="analytics-month" type="month" v-model="month" min="2000-01" max="2100-12"/><strong>{{periodLabel}}</strong><PButton :label="t('refresh')" icon="pi pi-refresh" outlined :loading="busy" @click="load"/></section>
  <PMessage v-if="error" severity="error" role="alert">{{error}}</PMessage>
  <p v-if="busy" role="status">{{t('loading')}}</p>
  <template v-if="summary&&!busy">
    <div class="kpi-grid"><section class="panel"><span>{{t('shipments')}}</span><h2>{{summary.shipments}}</h2></section><section class="panel"><span>{{t('readingCount')}}</span><h2>{{summary.readings}}</h2></section><section class="panel"><span>{{t('thermalAlerts')}}</span><h2>{{summary.thermalAlerts}}</h2></section><section class="panel"><span>{{t('openAlerts')}}</span><h2>{{summary.openAlerts}}</h2></section></div>
    <section class="panel"><div class="panel-head"><h2>{{t('routeComparison')}}</h2></div><div v-if="summary.routes.length" class="table-scroll"><table><thead><tr><th>{{t('route')}}</th><th>{{t('shipments')}}</th><th>{{t('readingCount')}}</th><th>{{t('temperatureSummary')}}</th><th>{{t('alerts')}}</th></tr></thead><tbody><tr v-for="row in summary.routes" :key="row.origin+'|'+row.destination"><td>{{row.origin}} → {{row.destination}}</td><td>{{row.shipments}}</td><td>{{row.readings}}</td><td><template v-if="row.readings"><div class="temperature-range" role="img" :aria-label="`${row.minimumTemperature} / ${row.averageTemperature} / ${row.maximumTemperature} °C`"><span :style="{left:(row.minimumTemperature+50)+'%',width:Math.max(.5,row.maximumTemperature-row.minimumTemperature)+'%'}"></span><b :style="{left:(row.averageTemperature+50)+'%'}"></b></div>{{`${row.minimumTemperature} / ${row.averageTemperature} / ${row.maximumTemperature} °C`}}</template><span v-else>{{t('noReadings')}}</span></td><td><div class="route-alert-bar"><span :style="{width:(row.alerts/maxAlerts*100)+'%'}"></span><b>{{row.alerts}}</b></div></td></tr></tbody></table></div><p v-else class="empty-state">{{t('noMonthShipments')}}</p><p class="analytics-note">{{t('analyticsNotice')}}</p></section>
    <section class="panel"><div class="panel-head"><h2>{{t('operationalAudit')}}</h2></div><form class="analytics-toolbar" @submit.prevent="load"><label for="audit-actor">{{t('actorFilter')}}</label><input id="audit-actor" v-model="actor" type="search" maxlength="140" :placeholder="t('allActors')"/><PButton type="submit" :label="t('applyFilters')" :loading="busy"/></form><div v-if="audit.length" class="table-scroll"><table><thead><tr><th>{{t('date')}}</th><th>{{t('shipment')}}</th><th>{{t('action')}}</th><th>{{t('actor')}}</th><th>{{t('notes')}}</th></tr></thead><tbody><tr v-for="(entry,index) in audit" :key="index"><td>{{formatDate(entry.at)}}</td><td><RouterLink :to="'/shipments/'+entry.shipmentId">{{entry.shipmentId}}</RouterLink></td><td>{{t(entry.action)}}</td><td>{{entry.actor}}</td><td>{{entry.note}}</td></tr></tbody></table></div><p v-else class="empty-state">{{t('noAuditEvents')}}</p></section>
  </template>
</template>
