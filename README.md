# FríoTrack

Shipment management for refrigerated transport, built with Vue 3, PrimeVue 4 and Vite 7. English is the default for a new browser; Spanish (Latin America) is available throughout the application.

The application uses email/password sign-in through the ASP.NET Core 10 supporting API. Its independent source repository is [friotrack-api](https://github.com/upc-pre-202620-1asi0730-8088-FrioTrackk/friotrack-api); `api/` remains a compatible transition copy for existing local commands. Account roles and shipment permissions are checked by the server. The initial shipments and sensor readings are fictional; simulated readings are identified in monitoring views and CSV reports.

## Published application

| Entry | URL |
| --- | --- |
| Frontend | https://friotracktb1bce6db1b.z22.web.core.windows.net/ |
| Coordinator | https://friotracktb1bce6db1b.z22.web.core.windows.net/#/login?role=coordinator&lang=es |
| Cargo client | https://friotracktb1bce6db1b.z22.web.core.windows.net/#/login?role=cargo-client&lang=es |
| Landing | https://friotracktb1bce6db1b.z22.web.core.windows.net/landing/ |
| API health | https://friotrack-api-bce6db1b.azurewebsites.net/api/health |

The initial accounts are `coordinador@friotrack.app` and `cliente@friotrack.app`. Their generated deployment passwords are delivered privately and excluded from this repository and the public frontend bundle. Changing the `role` parameter in a link only changes the access heading; it cannot grant permissions.

## Run locally

Requires Node 20.19+ or 22.12+ and npm. The supporting API requires .NET SDK 10.

```powershell
npm ci
# Start the API using the environment configuration in api/README.md.
dotnet run --project api/FrioTrack.Api.csproj --urls http://localhost:5080
# In another terminal:
npm run dev
```

The development frontend runs at `http://127.0.0.1:5173`. `.env.example` documents the local API URL. `.env.production` contains only public Azure URLs and configures production builds to use the deployed API. There are no passwords or Azure keys in these files. A valid `lang=en` or `lang=es` query overrides the saved language preference.

## Workflows and access

| Workflow | Behavior |
| --- | --- |
| Accounts | Email/password sign-in, cargo-client registration, profile updates and server session revocation on sign-out. |
| Coordinator | Plan shipments, manage vehicles/drivers, record incidents/readings and corrective actions. |
| Cargo client | Read only assigned shipments, associated resources, readings, alerts, action history and CSV exports. |
| Shipment planning | Four steps: cargo/route/dates, resources/client, thermal ranges, review. Server validates dates, capacity, overlapping assignments and record version. |
| Lifecycle | Scheduled → in transit → delivered. Only scheduled shipments may be cancelled or deleted. |
| Alerts | Corrective actions acknowledge alerts. A subsequent reading within both configured ranges resolves them. |
| Monitoring | Simulated readings, accessible chart/table and optional OpenStreetMap tiles. |
| Language and terms | English/Spanish, remembered language preference and terms links in both authenticated and access views. |

`src/shared/infrastructure/rest-workspace-gateway.js` implements the `WorkspaceGateway` application port and calls the REST API. `src/shared/application/workspace.js` coordinates state and use cases; `src/main.js` injects the adapter. The browser retains its temporary session token in sessionStorage and restores the account after refresh. API sessions expire after eight hours. Passwords and the operational database are not retained by the frontend.

The five feature contexts are `shipment-management`, `monitoring`, `fleet`, `alerts-reporting` and `iam`. Shared UI, use cases and adapters are separated by responsibility. Policies under `domain` are pure JavaScript; seed fixtures and the local command simulator live only under `tests/`. See [code structure and dependency direction](docs/code-structure.md).

`api/` contains the supporting C# service so existing commands remain reproducible during the repository transition. It persists a small shared JSON store outside the public webroot, hashes passwords with PBKDF2 and enforces permissions independently of the Vue router. Public registration creates cargo clients only; coordinators assign shipments to them. See [API setup and boundaries](api/README.md).

## Verification

```powershell
npm test
npm run build
dotnet publish api/FrioTrack.Api.csproj -c Release -o output/api-publish --no-self-contained
node scripts/test-api.mjs
```

The frontend suite has 18 tests: 15 policy/simulator regressions and three application/gateway tests for accepted responses, expired sessions, client-only registration, transport failure and logout cleanup. The supporting API suite has 26 integration checks for development CORS, credentials, registration, role escalation, client isolation, persistence, shipment commands, alerts, revoked sessions and rate limiting. The local API suite uses a fresh isolated store with disposable local credentials. The Azure suite checks authentication and authorization using the private generated account file and does not create shipments or register persistent test accounts. CI runs the local frontend and API checks on pull requests and changes to `main` and `develop`.

## Azure deployment

Frontend files are hosted in Azure Storage; the API runs on Azure App Service Free F1. [Deployment configuration and evidence](docs/azure-deployment.md) includes the public URLs, screenshots and verification records. Only `dist/` is uploaded as static frontend content.

The landing has a separate source repository. Its updated code is not duplicated here; its published copy remains at `/landing/` on the same Storage site. Updating the frontend with `scripts/deploy-storage-tb1.mjs` preserves the existing landing files.

## Boundaries

This is a single-instance course deployment with a persistent file store and simulated readings. It does not ingest physical sensors, send email/SMS, process payments, verify emails, recover passwords or issue sensor audit certificates. Commercial use requires transactional persistence, organization tenancy, account recovery, backups and real sensor integration. The terms are an informational project draft. The checks and screenshots do not establish complete WCAG compliance.

The repository uses `feature/* → develop`, then a reviewed `release/* → main` integration with the result returned to `develop`. Emergency fixes use `hotfix/*` from `main` and are integrated into both branches. Commits use Conventional Commits and describe one coherent change. New code revisions require a separate deployment before the published Azure URLs can be attributed to them.
