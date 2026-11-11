import { ref } from 'vue';
import { t } from './i18n.js';
export const feedback = ref(null);
let timeout;
export function announce(key, severity = 'success') {
  clearTimeout(timeout); feedback.value = { key, severity };
  timeout = setTimeout(() => { feedback.value = null; }, 7000);
}
export function errorText(error) { return t(error.code || error.message || 'unexpected'); }
