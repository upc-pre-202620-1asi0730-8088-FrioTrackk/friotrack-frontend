export class DomainError extends Error {
  constructor(code, details = {}) { super(code); this.code = code; this.details = details; }
}
