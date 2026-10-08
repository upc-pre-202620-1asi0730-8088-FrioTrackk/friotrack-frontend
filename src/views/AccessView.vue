<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { data, enterSample, registerSample } from '../infrastructure/demo-repository.js';
import { t } from '../shared/i18n.js';
import { errorText } from '../shared/feedback.js';
const route = useRoute(), router = useRouter();
const registering = computed(() => route.path === '/register');
const role = ref(route.query.role === 'cargo-client' ? 'cargo-client' : 'coordinator');
watch(() => route.query.role, (value) => { if (value === 'coordinator' || value === 'cargo-client') role.value = value; }, { immediate: true });
const selectedProfile = ref('');
const samples = computed(() => data.value.profiles.filter(item => item.role === role.value).map(item => ({ ...item, label: `${item.name} · ${item.organization}` })));
watch(samples, (items) => { selectedProfile.value = items[0]?.id || ''; }, { immediate: true });
const draft = reactive({ name: '', email: '', organization: '' });
const consent = ref(false), error = ref(''), recoveryOpen = ref(false);
function submit() {
  error.value = '';
  try {
    if (registering.value) {
      if (!consent.value) throw new Error('requiredConsent');
      registerSample({ ...draft, role: role.value });
    } else enterSample(selectedProfile.value);
    const next = typeof route.query.next === 'string' && route.query.next.startsWith('/') && !route.query.next.startsWith('//') ? route.query.next : '/dashboard';
    router.push(next);
  } catch (failure) { error.value = errorText(failure); }
}
</script>
<template>
  <div class="access-layout">
    <section class="access-story"><div class="eyebrow light"><span></span>FRÍOTRACK · TB1</div><h1>{{ t('loginTitle') }}</h1><p>{{ t('loginDescription') }}</p>
      <div class="journey-preview" aria-hidden="true"><div class="preview-top"><span><i class="pi pi-truck"></i> FT-0001</span><span class="preview-badge">{{ t('sampleShort') }}</span></div><div class="preview-route"><strong>Trujillo</strong><div><span></span><i class="pi pi-arrow-right"></i><span></span></div><strong>Lima</strong></div><div class="preview-metrics"><div><small>{{ t('temperature') }}</small><strong>4.2 <span>°C</span></strong></div><div><small>{{ t('humidity') }}</small><strong>82 <span>%</span></strong></div><div><small>{{ t('thermal') }}</small><strong class="preview-safe"><i class="pi pi-check-circle"></i> {{ t('normal') }}</strong></div></div><svg viewBox="0 0 480 72"><path d="M0 42 C40 35 60 50 90 36 S145 26 170 34 S220 48 250 38 S300 27 335 34 S400 42 430 31 L480 28" fill="none" stroke="#68DDD0" stroke-width="3"/><path d="M0 42 C40 35 60 50 90 36 S145 26 170 34 S220 48 250 38 S300 27 335 34 S400 42 430 31 L480 28 L480 72 L0 72Z" fill="#00b4a615"/></svg></div>
      <p class="access-footnote"><i class="pi pi-info-circle" aria-hidden="true"></i>{{ t('sampleDate') }}</p>
    </section>
    <section class="access-form"><span class="eyebrow">{{ t('localIdentity') }}</span><h2>{{ t(registering ? 'register' : 'chooseRole') }}</h2><p>{{ t(registering ? 'createHelp' : 'loginNotice') }}</p>
      <form @submit.prevent="submit">
        <fieldset class="role-picker"><legend class="sr-only">{{ t('role') }}</legend><label v-for="option in ['coordinator', 'cargo-client']" :key="option" :class="{ selected: role === option }"><input type="radio" v-model="role" :value="option" name="sample-role"/><i :class="`pi pi-${option === 'coordinator' ? 'truck' : 'box'}`" aria-hidden="true"></i><span>{{ t(option) }}</span><i v-if="role === option" class="pi pi-check-circle" aria-hidden="true"></i></label></fieldset>
        <template v-if="registering"><div class="field"><label for="register-name">{{ t('name') }} *</label><PInputText id="register-name" v-model="draft.name" required autocomplete="name" maxlength="80"/></div><div class="field"><label for="register-organization">{{ t('organization') }} *</label><PInputText id="register-organization" v-model="draft.organization" required autocomplete="organization" maxlength="100"/></div><div class="field"><label for="register-email">{{ t('email') }} *</label><PInputText id="register-email" v-model="draft.email" required type="email" autocomplete="email" maxlength="140"/></div><div class="checkbox-field"><PCheckbox v-model="consent" inputId="consent" :binary="true"/><label for="consent">{{ t('consent') }} <RouterLink to="/terms">{{ t('terms') }}</RouterLink></label></div></template>
        <div v-else class="field"><label for="sample-profile">{{ t('chooseProfile') }}</label><PSelect inputId="sample-profile" v-model="selectedProfile" :options="samples" optionLabel="label" optionValue="id" :placeholder="t('chooseProfile')"/></div>
        <PMessage v-if="error" severity="error" class="form-error">{{ error }}</PMessage><PButton type="submit" :label="t(registering ? 'register' : 'login')" icon="pi pi-arrow-right" iconPos="right" class="full-width" :disabled="!registering && !selectedProfile"/>
      </form>
      <div class="access-links"><RouterLink :to="{ path: registering ? '/login' : '/register', query: { role } }">{{ t(registering ? 'useSample' : 'register') }}</RouterLink><button v-if="!registering" class="text-button" @click="recoveryOpen = true">{{ t('recovery') }}</button></div>
      <div class="local-disclosure"><i class="pi pi-desktop" aria-hidden="true"></i><p>{{ t('profileHelp') }}</p></div>
    </section>
  </div>
  <PDialog v-model:visible="recoveryOpen" :header="t('recovery')" modal :style="{ width: '30rem', maxWidth: '94vw' }"><p>{{ t('recoveryHelp') }}</p><template #footer><PButton :label="t('close')" @click="recoveryOpen = false"/></template></PDialog>
</template>
