# Historical TB1 Azure deployment and execution evidence

This page and its linked receipts describe the original TB1 JSON-backed publication. They do not certify the current AV2 REST/PostgreSQL source or its deployment. Use [redeployment instructions](redeployment.md) for current updates, after preparing the hosted database. The API source is maintained independently in `friotrack-api`.

The frontend now uses email/password authentication through its supporting ASP.NET Core API. Academic labels and the sample-profile selector have been removed from the application interface. Operational seed records remain fictional; simulated readings are identified beside the monitoring view and in reports.

## Configuration

| Component | Deployment |
| --- | --- |
| Frontend | https://friotracktb1bce6db1b.z22.web.core.windows.net/ |
| Landing | https://friotracktb1bce6db1b.z22.web.core.windows.net/landing/ |
| API | https://friotrack-api-bce6db1b.azurewebsites.net/api |
| Azure resource group | `rg-friotrack-tb1` |
| Static hosting | StorageV2, Standard LRS, West US; `$web` container. |
| API hosting | Windows App Service, .NET 10, West US; `plan-friotrack-free`, Free F1. |
| Transport | HTTPS and minimum TLS 1.2. |
| Persistence | Single-instance JSON file under App Service `HOME/data`, outside the deployed public files. |

The account role is assigned by the API. Cargo clients receive only their own shipments and associated resources. Coordinator commands require a coordinator account in the server. Profile updates and public registration cannot grant coordinator permissions. Passwords use individually salted PBKDF2-SHA256 hashes, sessions have random tokens and eight-hour expiry, and sign-out revokes the server token. Login and registration requests are rate limited.

Initial account emails are recorded in the README. Generated passwords, Azure access tokens, Storage keys and `.azure-tools/accounts.json` are excluded from source control. The initial passwords are configured for the server at deployment and initialize the persisted accounts only on their first run. `.env.production` contains public endpoint URLs only.

## Historical publication

The original publication used Microsoft Entra device authentication, Kudu ZIP deployment for the API and Storage uploads for the static products. Its API copy and provisioning command are no longer maintained in this frontend repository. Reproducing that historical version requires the corresponding TB1 source revision; do not execute its provisioning procedure against the current service.

Current updates use independently built source artifacts and the existing-resource tool described in [redeployment instructions](redeployment.md). Hash router URLs do not require server route rewrites. The landing remains a separate source and publication beneath `/landing/`.

The API plan is Free F1, has execution quotas and may require a cold start after inactivity. Azure Storage is charged according to usage. No paid database or paid App Service tier was created for this version. [Microsoft App Service documentation](https://learn.microsoft.com/en-us/azure/app-service/quickstart-dotnetcore), [Storage static websites](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website).

## Verification records

| Verification | Result |
| --- | --- |
| Frontend domain tests | 15 passed. |
| API local integration suite | 24 checks passed before publication; the repository suite adds two development CORS checks, for 26 total. |
| API deployed HTTPS suite | 12 checks passed for authentication, role enforcement, isolation and session revocation. |
| Source compilation | Vue/Vite production build and ASP.NET Core publish succeeded. |
| Published content | 34 files from the original combined frontend/landing publication matched their local SHA-256 hashes; missing route returned HTTP 404. |
| Browser | Wrong password rejected; coordinator sees 4 shipments; client sees its 3 shipments; session restored after refresh; sign-out returns to login and subsequent dashboard access requires authentication. |

[Static deployment record](azure-deployment.json), [API deployment record](azure-api-deployment.json), [published-file verification](azure-file-verification.json), [API verification](azure-api-verification.json), [browser verification](azure-browser-verification.json).

The stored file verification describes the original combined Azure publication, including the separately maintained landing. A later run from this standalone repository verifies the files currently present under its own `dist/`.

![Email/password sign-in](evidence/login-es.jpg)

![Authenticated coordinator](evidence/coordinator-authenticated-es.jpg)

![Authenticated cargo client](evidence/client-authenticated-es.jpg)

![Client CTA on the published landing](evidence/landing-client-cta-es.jpg)

The screenshots show the TB1 integrated browser viewport; they do not certify all screen sizes or full accessibility compliance. That version used a single-instance file store. The AV2 source adds relational persistence and organization-scoped operations; those changes require their own tests and deployment evidence. Physical sensors, password recovery, verified emails and external notifications remain outside these historical checks.
