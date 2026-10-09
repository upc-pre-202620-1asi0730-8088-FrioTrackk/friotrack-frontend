import { ref } from 'vue';
const API = (import.meta.env.VITE_API_URL || 'http://localhost:5080/api').replace(/\/$/, '');
const SESSION_KEY = 'friotrack.session';
const emptyState = () => ({ schema: 1, revision: 0, profiles: [], vehicles: [], drivers: [], shipments: [], alerts: [], notifications: [] });
export const data = ref(emptyState());
export const profile = ref(null);
export const persistenceWarning = ref(false);
let token = '';
try { token = sessionStorage.getItem(SESSION_KEY) || ''; } catch { persistenceWarning.value = true; }
function clearSession() { token = ''; profile.value = null; data.value = emptyState(); try { sessionStorage.removeItem(SESSION_KEY); } catch { persistenceWarning.value = true; } }
async function request(path, body) {
  let response;
  try { response = await fetch(API + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(45000) }); }
  catch { throw new Error('serviceUnavailable'); }
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) { if (response.status === 401 && path !== '/auth/login') clearSession(); throw new Error(payload?.code || (response.status === 429 ? 'tooManyAttempts' : 'unexpected')); }
  return payload;
}
function update(result) { data.value = result.state; profile.value = result.profile; }
async function enter(path, draft) { const result = await request(path, draft); token = result.token; try { sessionStorage.setItem(SESSION_KEY, token); } catch { persistenceWarning.value = true; } update(result); return result.profile; }
export const login = (draft) => enter('/auth/login', draft);
export const register = (draft) => enter('/auth/register', { ...draft, role: 'cargo-client' });
export async function logout() { try { if (token) await request('/auth/logout', {}); } finally { clearSession(); } }
export async function execute(type, payload = {}) { const result = await request('/commands', { type, payload }); update(result); return result.result; }
export async function refreshWorkspace() { if (token) update(await request('/workspace')); }
export async function restoreSession() { if (!token) return; try { await refreshWorkspace(); } catch { clearSession(); } }
