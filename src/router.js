import { createRouter, createWebHashHistory } from 'vue-router';
import { profile } from './infrastructure/demo-repository.js';
import AccessView from './views/AccessView.vue';
import DashboardView from './views/DashboardView.vue';
import ShipmentsView from './views/ShipmentsView.vue';
import ShipmentFormView from './views/ShipmentFormView.vue';
import ShipmentDetailView from './views/ShipmentDetailView.vue';
import AlertsView from './views/AlertsView.vue';
import FleetView from './views/FleetView.vue';
import ProfileView from './views/ProfileView.vue';
import TermsView from './views/TermsView.vue';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/login', component: AccessView, meta: { public: true, title: 'login' } },
    { path: '/register', component: AccessView, meta: { public: true, title: 'register' } },
    { path: '/dashboard', component: DashboardView, meta: { title: 'dashboard' } },
    { path: '/shipments', component: ShipmentsView, meta: { title: 'shipments' } },
    { path: '/shipments/new', component: ShipmentFormView, meta: { manager: true, title: 'newShipment' } },
    { path: '/shipments/:id/edit', component: ShipmentFormView, meta: { manager: true, title: 'edit' } },
    { path: '/shipments/:id', component: ShipmentDetailView, meta: { title: 'shipment' } },
    { path: '/alerts', component: AlertsView, meta: { title: 'alerts' } },
    { path: '/fleet', component: FleetView, meta: { manager: true, title: 'fleet' } },
    { path: '/history', component: ShipmentsView, meta: { title: 'history' } },
    { path: '/profile', component: ProfileView, meta: { title: 'profile' } },
    { path: '/terms', component: TermsView, meta: { public: true, title: 'terms' } },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
router.beforeEach((to) => {
  if (!to.meta.public && !profile.value) return { path: '/login', query: { next: to.fullPath } };
  if (to.meta.manager && profile.value?.role !== 'coordinator') return '/dashboard';
});
