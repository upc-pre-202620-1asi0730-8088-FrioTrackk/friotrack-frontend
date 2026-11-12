# Redeploy the corrected sources to existing Azure resources

`scripts/redeploy-existing.mjs` updates the existing FríoTrack static website and API. It does not create resources, enable features, change tiers, reset app settings, generate account passwords or replace `HOME/data/friotrack.json`.

The original provisioning scripts remain historical setup instructions. For an update to the existing resources, use this redeployment tool instead of `deploy-api.mjs`, which also writes initial app settings.

## Requirements

- Access to the existing Azure subscription, Storage account and App Service. The account needs resource read access, permission to list the Storage upload keys and permission to deploy through Kudu. A GitHub login alone does not grant Azure access.
- Node.js 22 or later; deployment dependencies installed with `npm ci --prefix scripts`.
- A clean source checkout for each selected product. The supplied full SHA must equal its checked-out `HEAD`, and the origin must be the corresponding repository in the FríoTrack organization.
- A production frontend build, a staging directory containing only the published landing files, and/or a ZIP of the standalone .NET 10 API publish output. Build each artifact from the recorded clean revision before deployment.
- Existing Azure configuration: `friotracktb1bce6db1b`, `$web`, `/landing/`, and `friotrack-api-bce6db1b`, configured for .NET 10 and one instance. The tool aborts if the existing resource or required configuration is absent.

The command uses Microsoft device authentication and prints the official sign-in URL and one-time code. Complete that sign-in yourself in a browser. It does not open or control your screen. One credential instance is shared across a batch; access tokens and Storage keys stay in process memory and are not written to the receipts.

## Build the artifacts

From the frontend repository:

```powershell
npm ci
npm test
npm run build
npm ci --prefix scripts
```

From the canonical `friotrack-api` repository, with the .NET 10 SDK available in `PATH`:

```powershell
dotnet publish FrioTrack.Api.csproj -c Release -o output/api-publish --no-self-contained
node scripts/test-api.mjs
```

Create a ZIP containing the files inside `output/api-publish`, with `FrioTrack.Api.dll`, `FrioTrack.Api.runtimeconfig.json` and `seed.json` at the ZIP root. Do not include a populated `data/` directory. Do not package the outer `api-publish` folder as the root entry.

Stage the landing from its own clean repository using only `index.html`, `Terms-and-Condition.html`, `assets/` and `i18n/`. Its directory is deployed beneath `/landing/`; the staging directory itself must have `index.html` at its root. Do not include `.git`, account credentials, deployment caches or unrelated documentation.

## Preflight without authentication

For one component, replace the paths and full SHA:

```powershell
node scripts/redeploy-existing.mjs --component frontend --artifact dist --source-repo . --source-sha <full-frontend-SHA> --check
```

`--check` validates the clean Git revision and local artifact only. It does not authenticate, contact Azure or publish anything. API preflight checks ZIP entries and the `.NET 10` runtime configuration. Static preflight rejects secret files and symlinks. A frontend artifact cannot contain `landing/`, because the landing must be published from its independent source.

## Deploy a batch with one Microsoft sign-in

Create a local plan outside the source checkouts. It is a JSON array; each component may appear at most once. Use absolute paths and real full SHAs in place of the examples:

```json
[
  {
    "component": "api",
    "artifact": "C:/path/to/api/output/friotrack-api.zip",
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

All local sources and artifacts are checked before sign-in. After authentication, all destination resources are read and checked before the first upload. The batch runs in plan order, with one Microsoft credential shared by the selected components. A failure aborts the remaining components; receipts for already completed components remain valid. This is not an atomic transaction across the three products.

Static uploads preserve unrelated files and upload HTML entry points after the other files. Every uploaded file is fetched from its public URL and compared byte-for-byte by SHA-256. Old hashed assets are retained; the command does not delete another product's files.

API deployment uploads only the supplied ZIP to the existing Kudu endpoint and records the returned deployment ID and successful completion status. It does not modify app settings, rotate the initial passwords, read private database contents or overwrite the persisted JSON file outside the application package. Polls are bounded and wait at most five seconds between checks.

## Evidence and remaining authenticated review

Successful components write `docs/redeployment-frontend.json`, `docs/redeployment-landing.json` and/or `docs/redeployment-api.json`. Each receipt contains its source repository, full source SHA, artifact hashes, destination, verification result and timestamp. The API receipt also contains its actual Kudu deployment ID. Do not claim publication from `--check` output or from an incomplete batch.

The API smoke checks verify health, anonymous workspace rejection (`401`) and rejection of a coordinator role through public registration (`403`). They do not create a user, replace credentials or certify authenticated coordinator/client flows. For that final review, the team must use the existing private account passwords. Do not paste passwords into the report, source control or public screenshots.

These source-to-artifact receipts document what was uploaded. The API health response currently identifies the service version, not a compiled Git revision; the Kudu ID and ZIP SHA provide the deployment trace. Build the package from the recorded source rather than treating an operator-supplied SHA as a substitute for a reproducible build.

A separate PostgreSQL database is not required to redeploy this TB1 JSON-backed demo. PostgreSQL, typed DDD aggregates and physical telemetry remain planned work; creating a database alone would not implement or validate them.
