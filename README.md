# FríoTrack

Shipment management for refrigerated transport, built with Vue 3, PrimeVue 4 and Vite 7. English is the default for a new browser; Spanish (Latin America) is available throughout the application.

The AV2 client consumes the resource REST API in the independent [friotrack-api](https://github.com/upc-pre-202620-1asi0730-8088-FrioTrackk/friotrack-api) repository. The application port remains stable while the HTTP gateway maps operations to shipment, fleet, sensor, alert, profile and notification resources. The AV2 backend uses PostgreSQL and Entity Framework Core; configure and run that canonical project before using this frontend revision. Account permissions are checked by the server.

Readings remain simulated and are identified in monitoring views and CSV exports. A frontend source update does not deploy the AV2 backend or change the existing Azure data.

## Existing TB1 publication

| Entry | URL |
| --- | --- |
| Frontend | https://friotracktb1bce6db1b.z22.web.core.windows.net/ |
| Coordinator | https://friotracktb1bce6db1b.z22.web.core.windows.net/#/login?role=coordinator&lang=es |
| Cargo client | https://friotracktb1bce6db1b.z22.web.core.windows.net/#/login?role=cargo-client&lang=es |
| Landing | https://friotracktb1bce6db1b.z22.web.core.windows.net/landing/ |
| API health | https://friotrack-api-bce6db1b.azurewebsites.net/api/health |

These URLs document the existing deployment; this source revision must be published with its compatible AV2 API before those URLs can be used as AV2 execution evidence.

The initial accounts are `coordinador@friotrack.app` and `cliente@friotrack.app`. Their generated deployment passwords are delivered privately and excluded from this repository and the public frontend bundle. Changing the `role` parameter in a link only changes the access heading; it cannot grant permissions.

## Run locally

Requires Node 20.19+ or 22.12+ and npm. The canonical API requires the .NET 10 SDK and a PostgreSQL database.

1. Follow [the canonical API setup](https://github.com/upc-pre-202620-1asi0730-8088-FrioTrackk/friotrack-api#local-execution). Configure `FRIOTRACK_DB`, allowed origins and private initial passwords in your local environment. Apply migrations and opt in to demonstration seeding only for a new database.
2. Start the API on `http://localhost:5080`.
3. Run the frontend in another terminal:

```powershell
npm ci
npm run dev
```

The development frontend runs at `http://127.0.0.1:5173`. `.env.example` documents the local API URL. `.env.production` contains only public Azure URLs and configures production builds to use the deployed API. There are no passwords or Azure keys in these files. A valid `lang=en` or `lang=es` query overrides the saved language preference.

## Workflows and access

| Workflow | Behavior |
| --- | --- |
| Accounts | Email/password sign-in, cargo-client registration, profile updates and server session revocation on sign-out. |
| Coordinator | Plan shipments, manage vehicles, drivers and independent sensors, record incidents/readings and corrective actions. |
| Cargo client | Read only assigned shipments, associated resources, readings, alerts, action history and CSV exports. |
| Shipment planning | Four steps: cargo/route/dates, resources/client, thermal ranges, review. Server validates dates, capacity, overlapping assignments and record version. |
| Lifecycle | Scheduled → in transit → delivered. Only scheduled shipments may be cancelled or deleted. |
| Alerts | Corrective actions acknowledge alerts. A subsequent reading within both configured ranges resolves them. |
| Monitoring | Simulated readings, accessible chart/table and optional OpenStreetMap tiles. |
| Language and terms | English/Spanish, remembered language preference and terms links in both authenticated and access views. |

`src/shared/infrastructure/rest-workspace-gateway.js` implements the `WorkspaceGateway` application port and calls the REST API. `src/shared/application/workspace.js` coordinates state and use cases; `src/main.js` injects the adapter. The browser retains its temporary session token in sessionStorage and restores the account after refresh. API sessions expire after eight hours. Passwords and the operational database are not retained by the frontend.

The five feature contexts are `shipment-management`, `monitoring`, `fleet`, `alerts-reporting` and `iam`. Shared UI, use cases and adapters are separated by responsibility. Policies under `domain` are pure JavaScript; seed fixtures and the local command simulator live only under `tests/`. See [code structure and dependency direction](docs/code-structure.md).

Sensors have their own inventory tab and may remain unassigned. The vehicle form no longer requires creating a sensor as part of a vehicle. An assignment references an available vehicle and is validated by the server. Resource changes and shipment actions show pending feedback and prevent duplicate form submissions.

## REST operations

`GET /api/workspace` provides the authorized composite view. Mutations use domain resources and return `{ profile, state, result }` so the client updates only accepted server state:

| Operation | HTTP resource |
| --- | --- |
| Schedule / edit / delete shipment | `POST /shipments`, `PUT /shipments/{id}`, `DELETE /shipments/{id}?version=n` |
| Start / deliver / cancel trip | `POST /shipments/{id}/transitions` |
| Simulated reading / incident | `POST /shipments/{id}/readings`, `POST /shipments/{id}/incidents` |
| Corrective action | `POST /alerts/{id}/corrective-actions` |
| Delivered shipment thermal snapshot | `POST /shipments/{id}/reports`, then `GET /reports/{reportId}` |
| Vehicle / driver / sensor inventory | `POST /vehicles`, `/drivers`, `/sensors`; `PUT /{resource}/{id}` |
| Own profile / notification reading | `PUT /profiles/me`, `POST /notifications/read` |

All routes are relative to the configured API base, normally `/api`. Mutation paths encode resource identifiers; shipment writes retain the optimistic version. Requests send `Accept-Language: en-US` or `es-419`. The client does not use the old generic `/commands` endpoint. Authentication still uses the API's opaque bearer session; registration cannot request coordinator privileges. A `401` clears the browser session, while a `409` preserves the current view and reports the conflict. A response arriving after sign-out cannot restore the previous user workspace.

Delivered shipments expose a user-requested thermal report download as JSON. The API stores an immutable snapshot and rechecks authorization when it is fetched. This is separate from the CSV reading export available during the trip; neither is described as a PDF or a sensor certificate. Demonstration provenance remains in the downloaded snapshot.

## Verification

```powershell
npm test
npm run build
```

The frontend suite has 25 tests: 15 policy/simulator regressions and ten application/gateway tests. The wire contract covers 16 resource operations, URI encoding, HTTP verbs, version conflicts and language headers. Session tests cover registration, expiry, logout revocation requests, rejected state updates and responses arriving after sign-out. Production compilation succeeds independently of the API process; it does not prove live integration. PostgreSQL integration and headless acceptance receipts must be recorded separately against the exact API revision.

## Azure deployment

Frontend files are hosted in Azure Storage; the API runs on Azure App Service Free F1. [Deployment configuration and evidence](docs/azure-deployment.md) includes the public URLs, screenshots and verification records. Only `dist/` is uploaded as static frontend content.

The landing has a separate source repository. Its updated code is not duplicated here; its published copy remains at `/landing/` on the same Storage site. Updating the frontend with `scripts/deploy-storage-tb1.mjs` preserves the existing landing files.

## Boundaries

The existing TB1 deployment uses a single-instance JSON store. The AV2 source targets a relational API and continues to identify all demonstration readings as simulated. It does not ingest physical sensors, send email/SMS, process payments, verify emails, recover passwords or issue sensor audit certificates. Production readiness requires deployment validation, account recovery, backups and real sensor integration beyond this course demonstration. The terms are an informational project draft. The checks and screenshots do not establish complete WCAG compliance.

The repository uses `feature/* → develop`, then a reviewed `release/* → main` integration with the result returned to `develop`. Emergency fixes use `hotfix/*` from `main` and are integrated into both branches. Commits use Conventional Commits and describe one coherent change. New code revisions require a separate deployment before the published Azure URLs can be attributed to them.
