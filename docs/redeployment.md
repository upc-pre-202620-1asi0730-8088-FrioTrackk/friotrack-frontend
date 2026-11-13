# Redeploy to existing Azure resources

`scripts/redeploy-existing.mjs` updates the existing FríoTrack static website and .NET 10 API. It does not create resources, change tiers or application settings, migrate a database, initialize accounts or replace persisted data. The old provisioning script has been removed from the current source. Historical TB1 deployment records remain in this repository.

## Requirements

- An Azure account authorized to read the existing resources and API settings, list the Storage upload keys and deploy through Kudu. GitHub access does not grant Azure access.
- Node.js 22 or later and deployment dependencies installed with `npm ci --prefix scripts`.
- A clean checkout for each selected product. The full source SHA must equal its checked-out `HEAD`, and its origin must be the corresponding repository in the FríoTrack organization.
- Artifacts built from those recorded revisions: the frontend `dist/`, a directory containing only the landing's public files, and/or the canonical `friotrack-api` publish ZIP.
- Existing resources `friotracktb1bce6db1b`, `$web`, `/landing/` and `friotrack-api-bce6db1b`. The API must already use .NET 10 and have an accessible PostgreSQL database with the reviewed EF Core migrations applied.

For an AV2 API upload, the tool reads the existing settings into memory and requires PostgreSQL mode and a nonempty `FRIOTRACK_DB` or `ConnectionStrings__FrioTrack`. It refuses an explicit JSON mode, automatic migrations (`FRIOTRACK_MIGRATE=true`) or automatic seeding (`FRIOTRACK_SEED=true`). Settings and connection strings are never printed or saved to the receipt. This prevents uploading the relational API over a TB1 service whose database has not been prepared.

Database hosting, access rules, backups, reviewed migration application and any initial demonstration accounts must be arranged separately before deployment. Use private credentials and a database intended for FríoTrack; do not point local test scripts at a hosted or production database. The Docker Compose database in `friotrack-api` is local development infrastructure, not cloud hosting. No new cloud database or AV2 deployment is implied by these source files.

The AV2 SPA requires the domain REST API. A frontend-only deployment checks the existing public API's health before any upload and requires version 0.2.0 or later with PostgreSQL persistence. A batch containing both API and frontend must put the API first; an incompatible order is rejected before authentication. After the API upload succeeds, backend compatibility is checked again immediately before uploading the frontend. A running TB1 JSON API is not compatible with the new SPA. The frontend receipt records the backend version and persistence actually observed.

## Build the artifacts

From this frontend repository:

```powershell
npm ci
npm test
npm run build
npm ci --prefix scripts
```

From the independent [friotrack-api repository](https://github.com/upc-pre-202620-1asi0730-8088-FrioTrackk/friotrack-api), with the .NET 10 SDK in `PATH`:

```powershell
dotnet test tests/FrioTrack.Api.Tests/FrioTrack.Api.Tests.csproj -c Release
dotnet publish FrioTrack.Api.csproj -c Release -o output/api-publish --no-self-contained
node scripts/test-postgres.mjs
node scripts/test-api.mjs
```

The PostgreSQL integration suite requires `FRIOTRACK_TEST_DB` to identify an isolated loopback PostgreSQL server and `psql` in `PATH` (or `FRIOTRACK_PSQL`). It creates and removes its own random test database. Consult the API README for the local configuration; never use a cloud connection for this suite. The last command tests the explicit historical JSON adapter.

Create a ZIP containing the files *inside* `output/api-publish`. `FrioTrack.Api.dll`, `FrioTrack.Api.runtimeconfig.json`, `FrioTrack.Api.deps.json` and `seed.json` must be at its root. Exclude populated `data/` directories, private settings and credentials. The tool verifies the .NET 10 runtime and that the packaged application version matches the canonical source project (0.2.0 or later).

Stage the landing from its own clean repository using only `index.html`, `Terms-and-Condition.html`, `assets/` and `i18n/`. Its directory must have `index.html` at its root; deployment places it beneath `/landing/`.

## Check without authentication

Replace paths and SHA with actual values:

```powershell
node scripts/redeploy-existing.mjs --component frontend --artifact dist --source-repo . --source-sha <full-frontend-SHA> --check
```

`--check` validates the local source revision, artifact and component order. It does not authenticate, inspect Azure settings, contact the backend or publish. Static checks reject secret files and symlinks. A frontend artifact cannot contain `landing/`, because the landing has its own source and publication.

## Deploy with one Microsoft sign-in

For multiple components, create a private plan outside the source checkouts. Each component may appear once; use absolute paths and real SHAs:

```json
[
  {
    "component": "api",
    "artifact": "C:/path/to/friotrack-api/output/friotrack-api.zip",
    "sourceRepo": "C:/path/to/friotrack-api",
    "sourceSha": "<full-api-SHA>"
  },
  {
    "component": "frontend",
    "artifact": "C:/path/to/friotrack-frontend/dist",
    "sourceRepo": "C:/path/to/friotrack-frontend",
    "sourceSha": "<full-frontend-SHA>"
  },
  {
    "component": "landing",
    "artifact": "C:/path/to/landing-public-files",
    "sourceRepo": "C:/path/to/friotrack-landing",
    "sourceSha": "<full-landing-SHA>"
  }
]
```

From the frontend repository:

```powershell
node scripts/redeploy-existing.mjs --plan C:/path/to/deployment-plan.json --check
node scripts/redeploy-existing.mjs --plan C:/path/to/deployment-plan.json
```

All local checks finish before authentication. The tool displays Microsoft's sign-in URL and one-time device code; complete the sign-in yourself. It does not open or control your screen. Tokens and Storage keys stay in memory. All destinations and required API settings are checked before the first upload. The batch then follows plan order. A failure stops the remaining components; this is not a transaction across products.

Static uploads preserve unrelated files, publish entry-point HTML last and compare every uploaded public file against its local SHA-256. API deployment uploads only the supplied ZIP to the existing Kudu endpoint and waits for successful completion. It changes no application settings or database contents. Polls are bounded and pause at most five seconds between checks.

## Evidence

Successful components produce `docs/redeployment-frontend.json`, `docs/redeployment-landing.json` and/or `docs/redeployment-api.json`. Receipts include source repository/SHA, artifact hashes, destination, verification and timestamps; API receipts include the Kudu deployment ID. Local `--check` output is not deployment evidence.

API smoke checks require the packaged version and PostgreSQL persistence in health, anonymous workspace rejection (`401`) and rejection of public coordinator registration (`403`). They do not certify database connectivity, the migration state or authenticated business flows. The team must verify coordinator/client operations with the existing private accounts after deployment and record the results. Do not publish passwords in source, the report or screenshots.

The health endpoint reports an application version, not a compiled Git revision. Build from the clean recorded source; use its ZIP SHA and Kudu ID for the upload trace. Receipts from older versions remain historical evidence and do not prove an AV2 publication.
