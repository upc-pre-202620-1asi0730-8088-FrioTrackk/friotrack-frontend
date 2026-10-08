<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { execute, profile, resetSamples } from '../infrastructure/demo-repository.js';
import { language, setLanguage, t } from '../shared/i18n.js';
import { announce, errorText } from '../shared/feedback.js';
const router = useRouter();
const draft = reactive({ name: profile.value.name, email: profile.value.email, organization: profile.value.organization });
const error = ref(''), resetOpen = ref(false);
function save() { error.value = ''; try { execute('updateProfile', draft); announce('saved'); } catch (failure) { error.value = errorText(failure); } }
function reset() { try { resetSamples(); router.push('/login'); } catch (failure) { error.value = errorText(failure); } resetOpen.value = false; }
</script>
<template>
  <div class="page-heading"><div><div class="eyebrow">{{ t('localIdentity') }}</div><h1>{{ t('profile') }}</h1><p>{{ t('profileHelp') }}</p></div></div>
  <div class="profile-grid"><section class="panel profile-form"><h2>{{ t(profile.role) }}</h2><form @submit.prevent="save"><div class="field"><label for="profile-name">{{ t('name') }} *</label><PInputText id="profile-name" v-model="draft.name" required maxlength="90" autocomplete="name"/></div><div class="field"><label for="profile-organization">{{ t('organization') }} *</label><PInputText id="profile-organization" v-model="draft.organization" required maxlength="100" autocomplete="organization"/></div><div class="field"><label for="profile-email">{{ t('email') }} *</label><PInputText id="profile-email" v-model="draft.email" type="email" required maxlength="140" autocomplete="email"/></div><PMessage v-if="error" severity="error" class="form-error">{{ error }}</PMessage><PButton type="submit" :label="t('save')" icon="pi pi-check"/></form></section><div><section class="panel preferences-panel"><h2>{{ t('preferences') }}</h2><p>{{ t('language') }}</p><div class="language-toggle" role="group" :aria-label="t('language')"><button :aria-pressed="language === 'en'" @click="setLanguage('en')">English (US)</button><button :aria-pressed="language === 'es'" @click="setLanguage('es')">Español (Latinoamérica)</button></div></section><section class="panel local-data-panel"><span class="sample-tag">{{ t('sampleShort') }}</span><h2>{{ t('reset') }}</h2><p>{{ t('resetHelp') }}</p><PButton :label="t('reset')" icon="pi pi-refresh" outlined severity="danger" @click="resetOpen = true"/></section><section class="integration-note"><i class="pi pi-link" aria-hidden="true"></i><h2>{{ t('limitTitle') }}</h2><p>{{ t('limitText') }}</p></section></div></div>
  <PDialog v-model:visible="resetOpen" :header="t('resetConfirm')" modal :style="{ width: '30rem', maxWidth: '94vw' }"><p>{{ t('resetHelp') }}</p><template #footer><PButton :label="t('cancel')" text @click="resetOpen = false"/><PButton :label="t('reset')" severity="danger" @click="reset"/></template></PDialog>
</template>
