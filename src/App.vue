<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePrimeVue } from 'primevue/config';
import { data, execute, leaveSample, persistenceWarning, profile } from './infrastructure/demo-repository.js';
import { canView } from './domains/operations.js';
import { language, setLanguage, t, formatDate } from './shared/i18n.js';
import { announce, feedback, errorText } from './shared/feedback.js';
import { primeVueLocale } from './shared/primevue-locale.js';
const route = useRoute(), router = useRouter();
const primevue = usePrimeVue();
watch(language, (locale) => { primevue.config.locale = primeVueLocale(locale); });
// Landing links explicitly select language. A valid route choice takes
// precedence over a saved preference, including same-page hash navigation.
watch(() => route.query.lang, (locale) => { if (locale === 'en' || locale === 'es') setLanguage(locale); }, { immediate: true });
const menuOpen = ref(false), noticesOpen = ref(false), main = ref();
const sidebarElement = ref(), menuButton = ref();
const mobileQuery = window.matchMedia('(max-width: 760px)');
const mobile = ref(mobileQuery.matches);
function syncBreakpoint(event) { mobile.value = event.matches; if (!event.matches) menuOpen.value = false; }
mobileQuery.addEventListener('change', syncBreakpoint);
onBeforeUnmount(() => mobileQuery.removeEventListener('change', syncBreakpoint));
async function openMenu() { menuOpen.value = true; await nextTick(); sidebarElement.value?.querySelector('a[href],button:not([disabled])')?.focus(); }
async function closeMenu() { menuOpen.value = false; await nextTick(); menuButton.value?.$el?.focus(); }
function navigationKey(event) {
  if (!mobile.value || !menuOpen.value) return;
  if (event.key === 'Escape') { event.preventDefault(); closeMenu(); return; }
  if (event.key !== 'Tab') return;
  const targets = [...sidebarElement.value.querySelectorAll('a[href],button:not([disabled])')];
  const first = targets[0], last = targets.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}
const bare = computed(() => ['/login', '/register'].includes(route.path) || (route.path === '/terms' && !profile.value));
const navigation = computed(() => [
  { path: '/dashboard', label: 'dashboard', icon: 'objects-column' },
  { path: '/shipments', label: 'shipments', icon: 'truck' },
  { path: '/alerts', label: 'alerts', icon: 'bell' },
  ...(profile.value?.role === 'coordinator' ? [{ path: '/fleet', label: 'fleet', icon: 'warehouse' }] : []),
  { path: '/history', label: 'history', icon: 'history' },
]);
const notices = computed(() => data.value.notifications.filter((notice) => {
  const shipment = data.value.shipments.find((item) => item.id === notice.shipmentId);
  return shipment && canView(profile.value, shipment) && (!notice.recipientProfileIds || notice.recipientProfileIds.includes(profile.value?.id));
}));
const unread = computed(() => notices.value.filter((item) => !item.readBy.includes(profile.value?.id)).length);
function leave() { leaveSample(); router.push('/login'); }
function markRead() { try { execute('readNotifications'); announce('saved'); } catch (error) { announce(error.code || error.message, 'error'); } }
function noticeText(type) { return t({ alert: 'noticeAlert', created: 'noticeCreated', 'in-transit': 'noticeTransit', delivered: 'noticeDelivered', cancelled: 'noticeCancelled', correctiveAction: 'noticeAction' }[type]); }
watch(() => route.fullPath, async () => { menuOpen.value = false; await nextTick(); main.value?.focus({ preventScroll: true }); document.title = `${t(route.meta.title || 'app')} · FríoTrack`; });
watch(profile, (next) => { if (!next && !route.meta.public) router.push('/login'); });
const landingUrl = import.meta.env.VITE_LANDING_URL || 'https://upc-pre-202620-1asi0730-8088-friotrack.github.io/friotrack-landing/';
const brandLogo = `${import.meta.env.BASE_URL}logo.svg`;
</script>
<template>
  <a class="skip-link" href="#main-content">{{ language === 'es' ? 'Saltar al contenido' : 'Skip to content' }}</a>
  <div :class="['app-shell', { bare }]">
    <template v-if="!bare">
      <button v-if="menuOpen && mobile" class="nav-backdrop" tabindex="-1" :aria-label="t('close')" @click="closeMenu"></button>
      <aside id="workspace-navigation" ref="sidebarElement" :class="['sidebar', { 'is-open': menuOpen }]" :inert="mobile && !menuOpen ? true : undefined" :aria-hidden="mobile && !menuOpen ? 'true' : undefined" :role="mobile && menuOpen ? 'dialog' : undefined" :aria-modal="mobile && menuOpen ? 'true' : undefined" :aria-label="mobile ? t('menu') : undefined" @keydown="navigationKey">
        <RouterLink to="/dashboard" class="brand"><img :src="brandLogo" alt="" width="38" height="38"/><span>Frío<span>Track</span></span></RouterLink>
        <div class="workspace-label">{{ t('app') }}</div>
        <nav :aria-label="t('app')"><RouterLink v-for="item in navigation" :key="item.path" :to="item.path" :class="['nav-item', { active: route.path.startsWith(item.path) }]" :aria-current="route.path.startsWith(item.path) ? 'page' : undefined"><i :class="`pi pi-${item.icon}`" aria-hidden="true"></i><span>{{ t(item.label) }}</span><span v-if="item.label === 'alerts'" class="nav-count">{{ data.alerts.filter(a => !a.resolved && notices.some(n => n.shipmentId === a.shipmentId)).length }}</span></RouterLink></nav>
        <div class="sidebar-bottom"><div class="sample-pip"><span></span>{{ t('sampleMode') }}</div><RouterLink to="/profile" class="nav-item"><i class="pi pi-user" aria-hidden="true"></i>{{ t('profile') }}</RouterLink><RouterLink to="/terms" class="nav-item"><i class="pi pi-shield" aria-hidden="true"></i>{{ t('terms') }}</RouterLink><button class="nav-item" @click="leave"><i class="pi pi-sign-out" aria-hidden="true"></i>{{ t('logout') }}</button></div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <PButton ref="menuButton" class="mobile-menu" icon="pi pi-bars" text :aria-label="t('menu')" :aria-expanded="menuOpen" aria-controls="workspace-navigation" @click="menuOpen ? closeMenu() : openMenu()"/>
          <div class="breadcrumb"><span>FríoTrack</span><i class="pi pi-angle-right" aria-hidden="true"></i><strong>{{ t(route.meta.title || 'app') }}</strong></div>
          <div class="top-actions">
            <div class="language-toggle" role="group" :aria-label="t('language')"><button :aria-pressed="language === 'en'" @click="setLanguage('en')">EN</button><button :aria-pressed="language === 'es'" @click="setLanguage('es')">ES</button></div>
            <button class="notification-button" :aria-label="`${t('notifications')} (${unread})`" @click="noticesOpen = true"><i class="pi pi-bell" aria-hidden="true"></i><span v-if="unread" class="notification-dot">{{ unread }}</span></button>
            <RouterLink to="/profile" class="profile-link"><span class="avatar">{{ profile?.name.split(' ').map(v => v[0]).slice(0, 2).join('') }}</span><span class="profile-caption"><strong>{{ profile?.name }}</strong><small>{{ t(profile?.role) }}</small></span></RouterLink>
          </div>
        </header>
        <div class="sample-banner"><span class="sample-tag"><i class="pi pi-flask" aria-hidden="true"></i>{{ t('sampleShort') }}</span><span>{{ t('sampleNotice') }}</span></div>
        <main ref="main" id="main-content" tabindex="-1" class="main-content"><PMessage v-if="persistenceWarning" severity="warn">{{ t('persistence') }}</PMessage><PMessage v-if="feedback" :severity="feedback.severity" class="feedback" :closable="true" @close="feedback = null">{{ t(feedback.key) }}</PMessage><RouterView v-if="profile || route.meta.public" :key="route.path" /></main>
        <footer class="app-footer"><span>FríoTrack · BlackStartup · TB1</span><span>{{ t('sampleDate') }}</span></footer>
      </div>
    </template>
    <template v-else>
      <header class="access-header"><RouterLink to="/login" class="brand"><img :src="brandLogo" alt="" width="36" height="36"/><span>Frío<span>Track</span></span></RouterLink><div class="access-controls"><a :href="landingUrl" class="quiet-link">{{ t('landing') }} <i class="pi pi-arrow-up-right" aria-hidden="true"></i></a><div class="language-toggle" role="group" :aria-label="t('language')"><button :aria-pressed="language === 'en'" @click="setLanguage('en')">EN</button><button :aria-pressed="language === 'es'" @click="setLanguage('es')">ES</button></div></div></header>
      <main ref="main" id="main-content" tabindex="-1"><RouterView :key="route.path" /></main>
    </template>
  </div>
  <PDialog v-model:visible="noticesOpen" modal :header="t('notifications')" :style="{ width: '32rem', maxWidth: '94vw' }">
    <p v-if="!notices.length" class="empty">{{ t('noNotifications') }}</p>
    <ul v-else class="notification-list"><li v-for="notice in notices" :key="notice.id" :class="{ unread: !notice.readBy.includes(profile?.id) }"><RouterLink :to="notice.type === 'alert' ? `/alerts?shipment=${notice.shipmentId}` : `/shipments/${notice.shipmentId}`" @click="noticesOpen = false"><strong>{{ notice.shipmentId }}</strong><span>{{ noticeText(notice.type) }}</span><small>{{ formatDate(notice.at) }}</small></RouterLink></li></ul>
    <template #footer><PButton :label="t('markRead')" icon="pi pi-check" :disabled="!unread" @click="markRead"/></template>
  </PDialog>
</template>

