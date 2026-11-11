<script setup>
import { terms } from '../../domain/terms.js';
import { language, t } from '../i18n.js';
</script>
<template>
  <article class="terms-container"><RouterLink to="/dashboard" class="back-link"><i class="pi pi-arrow-left" aria-hidden="true"></i>{{ t('back') }}</RouterLink><h1>{{ t('terms') }}</h1><div class="legal-copy" v-html="terms[language]"></div></article>
</template>
