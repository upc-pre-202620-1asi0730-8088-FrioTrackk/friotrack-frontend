import { createRouter, createWebHashHistory } from 'vue-router';
import { profile } from './shared/application/workspace.js';
import AccessView from './iam/presentation/pages/AccessView.vue';
import DashboardView from './shipment-management/presentation/pages/DashboardView.vue';
import ShipmentsView from './shipment-management/presentation/pages/ShipmentsView.vue';
import ShipmentFormView from './shipment-management/presentation/pages/ShipmentFormView.vue';
import ShipmentDetailView from './shipment-management/presentation/pages/ShipmentDetailView.vue';
import AlertsView from './alerts-reporting/presentation/pages/AlertsView.vue';
import FleetView from './fleet/presentation/pages/FleetView.vue';
import ProfileView from './iam/presentation/pages/ProfileView.vue';
import TermsView from './shared/presentation/pages/TermsView.vue';

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
