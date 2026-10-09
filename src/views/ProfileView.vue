<script setup>
import { reactive, ref } from 'vue';
import { execute, profile } from '../infrastructure/workspace-repository.js';
import { language, setLanguage, t } from '../shared/i18n.js';
import { announce, errorText } from '../shared/feedback.js';
const draft = reactive({ name: profile.value.name, email: profile.value.email, organization: profile.value.organization });
const error = ref(''), busy = ref(false);
async function save() { if (busy.value) return; error.value = ''; busy.value = true; try { await execute('updateProfile', draft); announce('saved'); } catch (failure) { error.value = errorText(failure); } finally { busy.value = false; } }

</script>
<template>
  <div class="page-heading"><div><div class="eyebrow">{{ t('localIdentity') }}</div><h1>{{ t('profile') }}</h1><p>{{ t('profileHelp') }}</p></div></div>
  <div class="profile-grid"><section class="panel profile-form"><h2>{{ t(profile.role) }}</h2><form @submit.prevent="save"><div class="field"><label for="profile-name">{{ t('name') }} *</label><PInputText id="profile-name" v-model="draft.name" required maxlength="90" autocomplete="name"/></div><div class="field"><label for="profile-organization">{{ t('organization') }} *</label><PInputText id="profile-organization" v-model="draft.organization" required maxlength="100" autocomplete="organization"/></div><div class="field"><label for="profile-email">{{ t('email') }} *</label><PInputText id="profile-email" v-model="draft.email" type="email" required maxlength="140" autocomplete="email"/></div><PMessage v-if="error" severity="error" class="form-error">{{ error }}</PMessage><PButton type="submit" :label="t('save')" icon="pi pi-check" :loading="busy" :disabled="busy"/></form></section><div><section class="panel preferences-panel"><h2>{{ t('preferences') }}</h2><p>{{ t('language') }}</p><div class="language-toggle" role="group" :aria-label="t('language')"><button :aria-pressed="language === 'en'" @click="setLanguage('en')">English (US)</button><button :aria-pressed="language === 'es'" @click="setLanguage('es')">Español (Latinoamérica)</button></div></section></div></div>

</template>
