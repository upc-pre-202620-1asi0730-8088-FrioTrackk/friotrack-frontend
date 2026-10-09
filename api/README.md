# FríoTrack API

ASP.NET Core 10 REST API for account access and shared shipment operations. The operational seed contains fictional shipments and simulated readings; the login, session validation, registration and server authorization are functional.

## Local execution

Requires .NET SDK 10. Set `FRIOTRACK_COORDINATOR_PASSWORD` and `FRIOTRACK_CLIENT_PASSWORD` to initial passwords of at least 12 characters, then run from the workspace root:

```powershell
rtk proxy dotnet run --project api/FrioTrack.Api.csproj --urls http://localhost:5080
```

The initial accounts are `coordinador@friotrack.app` and `cliente@friotrack.app`. Passwords are supplied through environment variables, not committed to source. They initialize the account store only on its first run.

| Endpoint | Authorization | Purpose |
| --- | --- | --- |
| GET `/api/health` | Public | Service availability |
| POST `/api/auth/login` | Email/password | Start an eight-hour session |
| POST `/api/auth/register` | Public; cargo clients only | Register and sign in |
| GET `/api/workspace` | Bearer session | Profile and authorized workspace |
| POST `/api/commands` | Bearer session | Validated operation and updated workspace |
| POST `/api/auth/logout` | Bearer session | Revoke session |

Passwords use PBKDF2-SHA256 with individual random salts and 210,000 iterations. Sessions use random 256-bit tokens; only their SHA-256 digests are persisted. The browser retains its token in sessionStorage, clears it when signing out and never saves the password. Authentication endpoints allow 15 requests per minute per remote IP. HTTPS is required on Azure.

The authenticated account determines the role. The role query in frontend links only selects the heading. Cargo clients receive their own profile, shipments, readings, alerts and associated resources. Management commands require a coordinator on the server. Profile changes cannot change role. Public registration cannot create coordinators.

The single-instance API serializes commands under a process lock, validates the latest state and writes a replacement JSON file under Azure's persistent `HOME/data` directory. Configure `FRIOTRACK_DATA_FILE` to override the file and `FRIOTRACK_ORIGINS` for allowed frontend origins.

This deployment uses a small persistent file store suitable for the course demonstration. A production service still needs a transactional database, organization tenancy, email verification, password recovery, retention/backups and real sensor ingestion. It does not send emails, payments or sensor signals.

## Verification

```powershell
rtk proxy dotnet publish api/FrioTrack.Api.csproj -c Release -o output/api-publish --no-self-contained
rtk proxy node scripts/test-api.mjs
rtk proxy node scripts/test-api.mjs --azure
```

The local suite uses an isolated store and checks development CORS, credentials, role escalation, registration, persistence, shipment validation, alerts, logout and rate limiting. The default CORS origins include both `localhost:5173` and `127.0.0.1:5173`. The Azure suite reads the local generated accounts file, verifies authentication and authorization, and does not add shipments or register persistent test accounts.

Keep the original ignored `.azure-tools/accounts.json` when redeploying an existing Azure instance. Newly generated deployment values do not reset passwords in an existing persisted account store.
