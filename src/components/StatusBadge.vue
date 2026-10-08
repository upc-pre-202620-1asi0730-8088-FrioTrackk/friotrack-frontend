<script setup>
import { t } from '../shared/i18n.js';
defineProps({ status: { type: String, required: true } });
const icons = { normal: 'check-circle', critical: 'exclamation-triangle', offline: 'wifi', pending: 'clock', scheduled: 'calendar', 'in-transit': 'truck', delivered: 'check-circle', cancelled: 'ban', resolved: 'check-circle' };
</script>
<template><span class="status" :class="status"><i :class="`pi pi-${icons[status] || 'info-circle'}`" aria-hidden="true"></i>{{ t(status) }}</span></template>
