# Code structure

The Vue application is organized by bounded context. These folders are logical modules in one SPA, not separately deployed services.

| Context | Responsibility | Source |
| --- | --- | --- |
| Shipment Management | Planning, shipment lists, lifecycle and detail | `src/shipment-management/` |
| Monitoring and Telemetry | Reading charts, map and thermal status | `src/monitoring/` |
| Fleet and Resources | Vehicles, drivers and independent sensors | `src/fleet/` |
| Alert and Reporting | Corrective actions, persisted JSON reports and CSV exports | `src/alerts-reporting/` |
| IAM | Access, session profile and preferences | `src/iam/` |

`presentation/pages` and `presentation/components` contain Vue screens and UI components. `domain` contains pure policies and value calculations; it does not import Vue, browser storage or HTTP. Contexts without an independent domain policy do not have empty placeholder layers.

`shared/application/workspace.js` coordinates workspace use cases and reactive state. Its `WorkspaceGateway` port describes the server contract. `shared/infrastructure/rest-workspace-gateway.js` implements that contract using fetch and temporary session storage. `src/main.js` is the composition root that supplies the adapter. Shared presentation contains localization, status feedback and the terms screen. Vue Router selects the pages and the server remains responsible for authorization.

The local command simulator and seed fixture are under `tests/support/` and `tests/fixtures/`. They support regression tests and are not imported by the production bundle. They do not replace server acceptance tests. The policy suite covers shipment validation, visibility, thermal status and CSV provenance; gateway tests cover expired sessions, client-only registration, rejected commands and logout cleanup.

## Supporting API

The independent Web Services repository is [friotrack-api](https://github.com/upc-pre-202620-1asi0730-8088-FrioTrackk/friotrack-api). It owns backend source, EF Core migrations, domain tests, PostgreSQL integration tests and its CI workflow. This frontend repository owns the Vue SPA and gateway contract; its workflow runs frontend tests and the production build. There is no second maintained API copy in the frontend source.

| Layer or module | Responsibility |
| --- | --- |
| `Program.cs` | Dependency injection, CORS, rate limiting, persistence selection and Swagger |
| `Interfaces/` | Domain REST endpoints, authorization headers and localized error responses |
| Context `Domain/` folders | Shipment, monitoring, fleet, alerts/reporting and IAM rules |
| `Shared/Application/` | Authorized operations, projections and transactional coordination |
| `Shared/Application/Ports/` | Aggregate repository and persistence contracts |
| `Shared/Infrastructure/` | EF Core mappings, migrations and database initialization |
| `Iam/Infrastructure/` | Salted PBKDF2 password hashing |

These paths are relative to the API repository. The AV2 adapter maps workspace use cases to domain REST operations. PostgreSQL transactions, organization-level advisory locks and shipment version checks protect reservations and updates. The server owns authorization and tenant boundaries. The workspace projection supports the SPA, while writes use explicit resource endpoints.

The API defaults to PostgreSQL. Its historical JSON adapter requires explicit `FRIOTRACK_PERSISTENCE=json` and remains solely for reproducing TB1. The frontend's production gateway uses the AV2 REST contract. Manually recorded telemetry and seeded shipments are demonstration data; no physical sensor ingestion or external event delivery is implied. Target diagrams and historical deployment receipts must be distinguished from the implemented schema and current deployment evidence.
