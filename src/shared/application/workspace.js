import { ref } from 'vue';
const emptyState = () => ({ schema: 1, revision: 0, profiles: [], vehicles: [], drivers: [], shipments: [], alerts: [], notifications: [] });
export const data = ref(emptyState());
export const profile = ref(null);
export const persistenceWarning = ref(false);
let gateway;
// Infrastructure is supplied by the composition root.
export function configureWorkspaceGateway(adapter) { gateway = adapter; }
export function clearWorkspace() { profile.value = null; data.value = emptyState(); }
export function warnAboutPersistence() { persistenceWarning.value = true; }
function update(result) { data.value = result.state; profile.value = result.profile; }
export async function login(draft) { const result = await gateway.login(draft); update(result); return result.profile; }
export async function register(draft) { const result = await gateway.register(draft); update(result); return result.profile; }
export async function logout() { try { await gateway.logout(); } finally { clearWorkspace(); } }
export async function execute(type, payload = {}) { const result = await gateway.execute(type, payload); update(result); return result.result; }
export async function refreshWorkspace() { if (gateway.hasSession) update(await gateway.read()); }
export async function restoreSession() { if (!gateway.hasSession) return; try { await refreshWorkspace(); } catch { gateway.clearSession(); clearWorkspace(); } }
