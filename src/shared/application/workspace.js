import { ref } from 'vue';
const emptyState = () => ({ schema: 1, revision: 0, profiles: [], vehicles: [], drivers: [], sensors: [], shipments: [], alerts: [], notifications: [] });
export const data = ref(emptyState());
export const profile = ref(null);
export const persistenceWarning = ref(false);
export const pendingRequests = ref(0);
let gateway;
let workspaceEpoch = 0;
// Infrastructure is supplied by the composition root.
export function configureWorkspaceGateway(adapter) { gateway = adapter; }
export function clearWorkspace() { workspaceEpoch++; profile.value = null; data.value = emptyState(); }
export function warnAboutPersistence() { persistenceWarning.value = true; }
async function tracked(action) { pendingRequests.value++; try { return await action(); } finally { pendingRequests.value--; } }
function update(result) {
  if (!result?.profile || !result?.state || typeof result.state !== 'object') throw new Error('unexpected');
  data.value = { ...emptyState(), ...result.state }; profile.value = result.profile;
}
async function enterIdentity(method, draft) {
  return tracked(async () => {
    clearWorkspace();
    const epoch = workspaceEpoch;
    const result = await gateway[method](draft);
    if (epoch !== workspaceEpoch) throw new Error('sessionExpired');
    update(result);
    return result.profile;
  });
}
export async function login(draft) { return enterIdentity('login', draft); }
export async function register(draft) { return enterIdentity('register', draft); }
export async function logout() { return tracked(async () => { clearWorkspace(); await gateway.logout(); }); }
export async function execute(type, payload = {}) { return tracked(async () => { const epoch = workspaceEpoch; const result = await gateway.execute(type, payload); if (epoch !== workspaceEpoch) throw new Error('sessionExpired'); update(result); return result.result; }); }
export async function refreshWorkspace() { if (gateway.hasSession) return tracked(async () => { const epoch = workspaceEpoch; const result = await gateway.read(); if (epoch !== workspaceEpoch) throw new Error('sessionExpired'); update(result); }); }
export async function readReport(id) { return tracked(async () => { const epoch = workspaceEpoch; const result = await gateway.readReport(id); if (epoch !== workspaceEpoch) throw new Error('sessionExpired'); return result; }); }
export async function restoreSession() { if (!gateway.hasSession) return; const epoch = workspaceEpoch; try { await refreshWorkspace(); } catch { if (epoch === workspaceEpoch) { gateway.clearSession(); clearWorkspace(); } } }
