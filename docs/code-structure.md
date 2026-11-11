# Code structure

The Vue application is organized by bounded context. These folders are logical modules in one SPA, not separately deployed services.

| Context | Responsibility | Source |
| --- | --- | --- |
| Shipment Management | Planning, shipment lists, lifecycle and detail | `src/shipment-management/` |
| Monitoring and Telemetry | Reading charts, map and thermal status | `src/monitoring/` |
| Fleet and Resources | Vehicles and drivers | `src/fleet/` |
| Alert and Reporting | Alert actions and sample traceability exports | `src/alerts-reporting/` |
| IAM | Access, session profile and preferences | `src/iam/` |

`presentation/pages` and `presentation/components` contain Vue screens and UI components. `domain` contains pure policies and value calculations; it does not import Vue, browser storage or HTTP. Contexts without an independent domain policy do not have empty placeholder layers.

`shared/application/workspace.js` coordinates workspace use cases and reactive state. Its `WorkspaceGateway` port describes the server contract. `shared/infrastructure/rest-workspace-gateway.js` implements that contract using fetch and temporary session storage. `src/main.js` is the composition root that supplies the adapter. Shared presentation contains localization, status feedback and the terms screen. Vue Router selects the pages and the server remains responsible for authorization.

The local command simulator and seed fixture are under `tests/support/` and `tests/fixtures/`. They support regression tests and are not imported by the production bundle. They do not replace server acceptance tests. The policy suite covers shipment validation, visibility, thermal status and CSV provenance; gateway tests cover expired sessions, client-only registration, rejected commands and logout cleanup.

## Supporting API

The independent Web Services repository is [friotrack-api](https://github.com/upc-pre-202620-1asi0730-8088-FrioTrackk/friotrack-api). The `api/` directory is retained during the repository transition so existing local and deployment commands remain reproducible.

| Layer or module | Responsibility |
| --- | --- |
| `api/Program.cs` | Dependency injection, CORS, rate limiting and composition |
| `api/Interfaces/` | Endpoint mapping, HTTP authorization header extraction and error responses |
| `api/Shared/Application/` | Session/workspace use cases and validated command processing |
| `api/Shared/Application/Ports/` | Persistence contract consumed by the application |
| `api/Shared/Infrastructure/` | JSON file initialization and replacement writes |
| `api/Iam/Application/Ports/` | Password hashing contract |
| `api/Iam/Infrastructure/` | PBKDF2 implementation |

The application service depends on persistence and password ports, supplied by dependency injection. It serializes operations with a process lock. HTTP objects and file paths are handled at the interfaces and infrastructure boundaries. The request/response schema, session lifetime, password derivation and command behavior remain compatible with TB1.

The supporting API operates on JSON state. This technical separation does not implement the target DDD aggregate model, PostgreSQL, EF Core repositories, physical sensor ingestion or event dispatch. Those remain explicit backend evolution work. The report's target class diagrams must not be presented as classes already implemented here.
