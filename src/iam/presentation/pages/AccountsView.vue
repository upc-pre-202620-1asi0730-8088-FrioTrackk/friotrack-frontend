<script setup>
import {ref,onMounted} from 'vue';
import {profile,readAccounts,updateAccountAccess,refreshWorkspace} from '../../../shared/application/workspace.js';
import {t} from '../../../shared/presentation/i18n.js';
import {errorText} from '../../../shared/presentation/feedback.js';
const accounts=ref([]),busy=ref(''),error=ref(''),saved=ref(false);
async function load(){try{accounts.value=await readAccounts();}catch(failure){error.value=errorText(failure);}}
async function save(account){if(busy.value)return;busy.value=account.id;error.value='';saved.value=false;try{await updateAccountAccess(account.id,{role:account.role,enabled:account.enabled});await refreshWorkspace();await load();saved.value=true;}catch(failure){error.value=errorText(failure);await load();}finally{busy.value='';}}
onMounted(load);
</script>
<template><div class="page-heading"><div><h1>{{t('accounts')}}</h1><p>{{t('accountsHelp')}}</p></div></div><PMessage v-if="error" severity="error" role="alert">{{error}}</PMessage><PMessage v-if="saved" severity="success" role="status">{{t('accountAccessSaved')}}</PMessage><section class="panel"><div class="table-scroll"><table><thead><tr><th>{{t('name')}}</th><th>{{t('email')}}</th><th>{{t('accountRole')}}</th><th>{{t('accountEnabled')}}</th><th>{{t('accountActions')}}</th></tr></thead><tbody><tr v-for="account in accounts" :key="account.id"><td>{{account.name}}</td><td>{{account.email}}</td><td><select v-model="account.role" :aria-label="t('accountRole')+' '+account.name" :disabled="account.id===profile.id||!!busy"><option value="cargo-client">{{t('cargo-client')}}</option><option value="coordinator">{{t('coordinator')}}</option></select></td><td><input type="checkbox" v-model="account.enabled" :aria-label="t('accountEnabled')+' '+account.name" :disabled="account.id===profile.id||!!busy"/></td><td><PButton :label="t('save')" :disabled="account.id===profile.id||!!busy" :loading="busy===account.id" @click="save(account)"/></td></tr></tbody></table></div><p class="analytics-note">{{t('accountSecurityNote')}}</p></section></template>
