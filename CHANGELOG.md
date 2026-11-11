# Changelog

## 0.1.1 — 2026-11-10

- Organize the SPA by bounded context, presentation and pure domain policies.
- Inject the workspace HTTP gateway and keep demo fixtures in tests.
- Separate API composition, HTTP endpoints, use cases, persistence and password hashing.
- Add session and authorization regressions and CI for frontend and supporting API.
- Document the independent Web Services repository and the transitional API copy.

Validation: 18 frontend tests, Vite production build, ASP.NET Core 10 publish and 26 local API checks passed. Historical Azure receipts describe the earlier deployed version; this source release does not imply a new deployment.

Earlier tags 0.0.1 and 0.0.3 both point to the same historical commit. They remain unchanged; this changelog does not infer functional differences between them.
