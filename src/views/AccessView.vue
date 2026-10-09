<script setup>
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { login, register } from '../infrastructure/workspace-repository.js';
import { t } from '../shared/i18n.js';
import { errorText } from '../shared/feedback.js';
const route = useRoute(), router = useRouter();
const registering = computed(() => route.path === '/register');
const segment = computed(() => route.query.role === 'cargo-client' ? 'cargo-client' : 'coordinator');
const draft = reactive({ name: '', email: '', organization: '', password: '', confirmPassword: '' });
const consent = ref(false), error = ref(''), busy = ref(false), passwordVisible = ref(false);
async function submit() {
  if (busy.value) return;
  error.value = ''; busy.value = true;
  try {
    if (registering.value) {
      if (!consent.value) throw new Error('requiredConsent');
      if (draft.password !== draft.confirmPassword) throw new Error('passwordMismatch');
      await register({ name: draft.name, email: draft.email, organization: draft.organization, password: draft.password, consent: consent.value });
    } else await login({ email: draft.email, password: draft.password });
    draft.password = ''; draft.confirmPassword = '';
    const next = typeof route.query.next === 'string' && route.query.next.startsWith('/') && !route.query.next.startsWith('//') && !['/login', '/register'].some(p => route.query.next.startsWith(p)) ? route.query.next : '/dashboard';
    await router.push(next);
  } catch (failure) { error.value = errorText(failure); } finally { busy.value = false; }
}
</script>
<template>
  <div class="access-layout">
    <section class="access-story"><div class="eyebrow light"><span></span>FRÍOTRACK</div><h1>{{ t('loginTitle') }}</h1><p>{{ t('loginDescription') }}</p><div class="access-benefits"><div><i class="pi pi-truck" aria-hidden="true"></i><span>{{ t('accessShipments') }}</span></div><div><i class="pi pi-chart-line" aria-hidden="true"></i><span>{{ t('accessConditions') }}</span></div><div><i class="pi pi-shield" aria-hidden="true"></i><span>{{ t('accessHistory') }}</span></div></div></section>
    <section class="access-form"><span class="eyebrow">{{ t(registering ? 'cargo-client' : segment) }}</span><h2>{{ t(registering ? 'register' : 'login') }}</h2><p>{{ t(registering ? 'createHelp' : 'loginNotice') }}</p>
      <form @submit.prevent="submit" :aria-busy="busy">
        <template v-if="registering"><div class="field"><label for="register-name">{{ t('name') }} *</label><PInputText id="register-name" v-model="draft.name" required autocomplete="name" maxlength="90" :disabled="busy"/></div><div class="field"><label for="register-organization">{{ t('organization') }} *</label><PInputText id="register-organization" v-model="draft.organization" required autocomplete="organization" maxlength="100" :disabled="busy"/></div></template>
        <div class="field"><label for="access-email">{{ t('email') }}</label><PInputText id="access-email" v-model="draft.email" required type="email" autocomplete="username" maxlength="140" :disabled="busy" :aria-invalid="!!error" :aria-describedby="error ? 'access-error' : undefined"/></div>
        <div class="field"><label for="access-password">{{ t('password') }}</label><div class="password-field"><PInputText id="access-password" v-model="draft.password" :type="passwordVisible ? 'text' : 'password'" required :minlength="registering ? 12 : undefined" maxlength="128" :autocomplete="registering ? 'new-password' : 'current-password'" :disabled="busy" :aria-invalid="!!error" :aria-describedby="error ? 'access-error' : registering ? 'password-help' : undefined"/><button type="button" class="password-toggle" :aria-label="t(passwordVisible ? 'hidePassword' : 'showPassword')" :aria-pressed="passwordVisible" @click="passwordVisible = !passwordVisible"><i :class="passwordVisible ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true"></i></button></div><small v-if="registering" id="password-help">{{ t('passwordHelp') }}</small></div>
        <template v-if="registering"><div class="field"><label for="confirm-password">{{ t('confirmPassword') }}</label><PInputText id="confirm-password" v-model="draft.confirmPassword" type="password" required minlength="12" maxlength="128" autocomplete="new-password" :disabled="busy"/></div><div class="checkbox-field"><PCheckbox v-model="consent" inputId="consent" :binary="true" :disabled="busy"/><label for="consent">{{ t('consent') }} <RouterLink to="/terms">{{ t('terms') }}</RouterLink></label></div></template>
        <PMessage v-if="error" id="access-error" severity="error" class="form-error" role="alert">{{ error }}</PMessage><PButton type="submit" :label="t(registering ? 'register' : 'login')" icon="pi pi-arrow-right" iconPos="right" class="full-width" :loading="busy" :disabled="busy"/>
      </form>
      <div class="access-links"><RouterLink :to="{ path: registering ? '/login' : '/register', query: { role: 'cargo-client' } }">{{ t(registering ? 'alreadyAccount' : 'newAccount') }}</RouterLink></div><div class="local-disclosure"><i class="pi pi-lock" aria-hidden="true"></i><p>{{ t('accessPermissions') }}</p></div>
    </section>
  </div>
</template>
