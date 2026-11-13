import { WorkspaceGateway } from '../application/ports/workspace-gateway.js';

const SESSION_KEY = 'friotrack.session';

const resourceId = (payload) => {
  if (typeof payload.id !== 'string' || !payload.id.trim()) throw new Error('requiredFields');
  return encodeURIComponent(payload.id);
};

// The application port stays stable while HTTP exposes domain resources.
export function resourceRequest(type, payload = {}) {
  const body = { ...payload };
  delete body.id;
  switch (type) {
    case 'createShipment': return { path: '/shipments', method: 'POST', body };
    case 'updateShipment': return { path: `/shipments/${resourceId(payload)}`, method: 'PUT', body };
    case 'deleteShipment': {
      if (!Number.isInteger(payload.version) || payload.version < 1) throw new Error('staleShipment');
      return { path: `/shipments/${resourceId(payload)}?version=${payload.version}`, method: 'DELETE' };
    }
    case 'transition': return { path: `/shipments/${resourceId(payload)}/transitions`, method: 'POST', body };
    case 'addReading': return { path: `/shipments/${resourceId(payload)}/readings`, method: 'POST', body };
    case 'recordIncident': return { path: `/shipments/${resourceId(payload)}/incidents`, method: 'POST', body };
    case 'generateThermalReport': return { path: `/shipments/${resourceId(payload)}/reports`, method: 'POST', body: {} };
    case 'recordCorrectiveAction': return { path: `/alerts/${resourceId(payload)}/corrective-actions`, method: 'POST', body };
    case 'saveVehicle': return { path: payload.id ? `/vehicles/${resourceId(payload)}` : '/vehicles', method: payload.id ? 'PUT' : 'POST', body };
    case 'saveDriver': return { path: payload.id ? `/drivers/${resourceId(payload)}` : '/drivers', method: payload.id ? 'PUT' : 'POST', body };
    case 'saveSensor': return { path: payload.id ? `/sensors/${resourceId(payload)}` : '/sensors', method: payload.id ? 'PUT' : 'POST', body };
    case 'updateProfile': return { path: '/profiles/me', method: 'PUT', body };
    case 'readNotifications': return { path: '/notifications/read', method: 'POST', body: {} };
    default: throw new Error('unknownCommand');
  }
}

export class RestWorkspaceGateway extends WorkspaceGateway {
  constructor({ apiUrl, getLanguage = () => 'en-US', onSessionExpired = () => {}, onPersistenceWarning = () => {} }) {
    super();
    this.apiUrl = apiUrl.replace(/\/$/, '');
    this.onSessionExpired = onSessionExpired;
    this.onPersistenceWarning = onPersistenceWarning;
    this.getLanguage = getLanguage;
    this.token = '';
    this.identityEpoch = 0;
    try { this.token = sessionStorage.getItem(SESSION_KEY) || ''; } catch { this.onPersistenceWarning(); }
  }
  get hasSession() { return !!this.token; }
  clearSession() {
    this.identityEpoch++;
    this.token = '';
    try { sessionStorage.removeItem(SESSION_KEY); } catch { this.onPersistenceWarning(); }
  }
  async request(path, { method = 'GET', body, token = this.token, identityEpoch = this.identityEpoch } = {}) {
    let response;
    try {
      response = await fetch(this.apiUrl + path, {
        method,
        headers: { 'Accept': 'application/json', 'Accept-Language': this.getLanguage() === 'es-419' ? 'es-419' : 'en-US', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(45000),
      });
    } catch { throw new Error('serviceUnavailable'); }
    const result = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 && path !== '/auth/login' && identityEpoch === this.identityEpoch && token === this.token) { this.clearSession(); this.onSessionExpired(); }
      throw new Error(result?.code || (response.status === 429 ? 'tooManyAttempts' : 'unexpected'));
    }
    if (response.status !== 204 && (!result || typeof result !== 'object')) throw new Error('unexpected');
    return result;
  }
  async enter(path, draft) {
    this.clearSession();
    const identityEpoch = this.identityEpoch;
    const result = await this.request(path, { method: 'POST', body: draft });
    if (identityEpoch !== this.identityEpoch) throw new Error('sessionExpired');
    if (typeof result?.token !== 'string' || !result.token || !result.profile || !result.state) throw new Error('unexpected');
    this.token = result.token;
    try { sessionStorage.setItem(SESSION_KEY, this.token); } catch { this.onPersistenceWarning(); }
    return result;
  }
  login(draft) { return this.enter('/auth/login', draft); }
  register(draft) { return this.enter('/auth/register', { ...draft, role: 'cargo-client' }); }
  read() { return this.request('/workspace'); }
  readReport(id) { return this.request(`/reports/${resourceId({ id })}`); }
  execute(type, payload = {}) { const { path, ...options } = resourceRequest(type, payload); return this.request(path, options); }
  async logout() {
    const token = this.token, identityEpoch = this.identityEpoch;
    this.clearSession();
    if (token) await this.request('/auth/logout', { method: 'POST', body: {}, token, identityEpoch });
  }
}
