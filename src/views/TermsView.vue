<script setup>
import { terms } from '../shared/terms.js';
import { language, t } from '../shared/i18n.js';
</script>
<template>
  <article class="terms-container"><RouterLink to="/dashboard" class="back-link"><i class="pi pi-arrow-left" aria-hidden="true"></i>{{ t('back') }}</RouterLink><h1>{{ t('terms') }}</h1><PMessage severity="info">{{ language === 'es' ? 'Borrador informativo tomado de la landing. Este panel solo guarda datos locales de ejemplo. El acceso seguro, servicio comercial y manejo de datos compartidos requieren la futura API. No ingreses información personal sensible. OpenStreetMap solo se carga si eliges esa opción.' : 'Informational draft from the landing. This workspace saves local sample data only. Secure access, commercial service and shared data processing require the future API. Do not enter sensitive personal information. OpenStreetMap loads only when you choose that option.' }}</PMessage><div class="legal-copy" v-html="terms[language]"></div></article>
</template>
