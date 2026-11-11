import { WorkspaceGateway } from '../application/ports/workspace-gateway.js';

const SESSION_KEY = 'friotrack.session';

export class RestWorkspaceGateway extends WorkspaceGateway {
  constructor({ apiUrl, onSessionExpired = () => {}, onPersistenceWarning = () => {} }) {
    super();
    this.apiUrl = apiUrl.replace(/\/$/, '');
    this.onSessionExpired = onSessionExpired;
    this.onPersistenceWarning = onPersistenceWarning;
    this.token = '';
    try { this.token = sessionStorage.getItem(SESSION_KEY) || ''; } catch { this.onPersistenceWarning(); }
  }
  get hasSession() { return !!this.token; }
  clearSession() {
    this.token = '';
    try { sessionStorage.removeItem(SESSION_KEY); } catch { this.onPersistenceWarning(); }
  }
  async request(path, body) {
    let response;
    try {
      response = await fetch(this.apiUrl + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(this.token ? { Authorization: 'Bearer ' + this.token } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(45000),
      });
    } catch { throw new Error('serviceUnavailable'); }
    const result = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 && path !== '/auth/login') { this.clearSession(); this.onSessionExpired(); }
      throw new Error(result?.code || (response.status === 429 ? 'tooManyAttempts' : 'unexpected'));
    }
    return result;
  }
  async enter(path, draft) {
    const result = await this.request(path, draft);
    this.token = result.token;
    try { sessionStorage.setItem(SESSION_KEY, this.token); } catch { this.onPersistenceWarning(); }
    return result;
  }
  login(draft) { return this.enter('/auth/login', draft); }
  register(draft) { return this.enter('/auth/register', { ...draft, role: 'cargo-client' }); }
  read() { return this.request('/workspace'); }
  execute(type, payload = {}) { return this.request('/commands', { type, payload }); }
  async logout() { try { if (this.token) await this.request('/auth/logout', {}); } finally { this.clearSession(); } }
}
