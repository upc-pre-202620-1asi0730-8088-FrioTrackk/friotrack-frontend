/** Port for the API workspace contract; infrastructure supplies the adapter. */
export class WorkspaceGateway {
  get hasSession() { throw new Error('Not implemented'); }
  login(draft) { throw new Error('Not implemented'); }
  register(draft) { throw new Error('Not implemented'); }
  read() { throw new Error('Not implemented'); }
  readReport(id) { throw new Error('Not implemented'); }
  execute(type, payload) { throw new Error('Not implemented'); }
  logout() { throw new Error('Not implemented'); }
  clearSession() { throw new Error('Not implemented'); }
}
