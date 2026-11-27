/** Port for the API workspace contract; infrastructure supplies the adapter. */
export class WorkspaceGateway {
  get hasSession() { throw new Error('Not implemented'); }
  login(draft) { throw new Error('Not implemented'); }
  register(draft) { throw new Error('Not implemented'); }
  read() { throw new Error('Not implemented'); }
  readReport(id) { throw new Error('Not implemented'); }
  capabilities() { throw new Error('Not implemented'); }
  requestRecovery() { throw new Error('Not implemented'); }
  resetPassword() { throw new Error('Not implemented'); }
  monthly() { throw new Error('Not implemented'); }
  audit() { throw new Error('Not implemented'); }
  accounts() { throw new Error('Not implemented'); }
  updateAccess() { throw new Error('Not implemented'); }
  monthlyPdf() { throw new Error('Not implemented'); }
  thermalPdf() { throw new Error('Not implemented'); }
  execute(type, payload) { throw new Error('Not implemented'); }
  logout() { throw new Error('Not implemented'); }
  clearSession() { throw new Error('Not implemented'); }
}
