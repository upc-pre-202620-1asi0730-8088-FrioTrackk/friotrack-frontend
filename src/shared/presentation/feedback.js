import { ref } from 'vue';
import { t } from './i18n.js';
export const feedback = ref(null);
let timeout;
export function announce(key, severity = 'success') {
  clearTimeout(timeout); feedback.value = { key: t(key) === key ? 'unexpected' : key, severity };
  timeout = setTimeout(() => { feedback.value = null; }, 7000);
}
export function errorText(error) { const key = error?.code || error?.message || 'unexpected'; const message = t(key); return message === key ? t('unexpected') : message; }
