# FríoTrack Frontend · TB1

First local frontend built with **Vue 3, JavaScript, PrimeVue and Vite**. It uses the project's blue / cold-teal / Inter brand and has English (US) as the initial language, with Spanish (Latin America). Review date: **7 October 2026**.

## Run and build

Requires Node 20.19+ or 22.12+ and npm. The lockfile records the installed dependency versions.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

- Development: `http://127.0.0.1:5173/`
- Built preview: `http://127.0.0.1:4173/`
- Coordinator entry: `http://127.0.0.1:5173/#/login?role=coordinator`
- Cargo-client entry: `http://127.0.0.1:5173/#/login?role=cargo-client`
- Local profile creation: `http://127.0.0.1:5173/#/register?role=cargo-client`

Landing links can append `&lang=en` or `&lang=es`. A valid explicit hash-route language overrides and updates the stored preference on entry or navigation. Access-view role query changes are applied even when staying on the same login/register route. Without an explicit language, a saved user preference is retained; a fresh browser defaults to English.

These are **local URLs, not a deployment**. A GitHub source repository does not provide the required AWS or Azure app deployment. No published frontend URL or cloud service is configured in this version.

## Implemented local workflows

| Workflow | Local behavior | Catalog reference |
| --- | --- | --- |
| Access and profile | Explicit sample role/profile entry and exit; new local profiles; name/email/organization changes. No password is collected or stored. | Partial US06, US07, US32, US39 |
| Shipment planning | Four steps: cargo/route/dates, vehicle/driver/client, temperature/humidity ranges, review. Create/edit/delete scheduled shipments. | US33; ranges US17 |
| Shipment lifecycle | Scheduled → in transit → delivered. Only scheduled shipments can be cancelled, with a note, releasing their resource reservations. Cancellation in transit or after delivery is rejected. Started records are retained. | Local US34 |
| Monitoring | Stored sample readings, numerical values, accessible reading table, chart, normal/out-of-range/no-signal states, search and filters. An explicit action adds a new sample reading; no readings are generated automatically. | Local part of US10, US12–US15, US37 |
| Map | Initial local route illustration with coordinates. Optional Leaflet/OpenStreetMap loads third-party tiles only on request and shows attribution. | Local part of US11 |
| Alerts and actions | Record a corrective-action note; the alert becomes acknowledged and remains open. Only a subsequent sample reading within both configured ranges closes it. Optional in-app notification targets only the assigned cargo client. | US18, US35; local US16 |
| Fleet and drivers | Add/edit records, unique plates/sensors/licences, availability toggle, prevent changes to resources assigned to scheduled or active shipments. | US19–US22, US29, US38 |
| Cargo client | Read-only own assigned shipments, readings, alerts, actions and CSV. Other clients' shipment details/exports are rejected by the demo domain rules. | US36 |
| History and incidents | Action timeline; record incident notes; download CSV labelled sample and not a sensor audit certificate. | Local US23, US24, US40 |
| Language and terms | EN/ES labels, default EN for a fresh browser, language persistence, local copy of the landing terms plus a clear sample-mode notice. | US30 |

User-entered names/cargo/notes are kept as entered. Generated UI messages, navigation, labels and validation are translated. Dates are displayed in **America/Lima**; shipment planning inputs are explicitly Lima UTC−5. Initial readings are fixed, fictional examples dated 6 October 2026, labelled throughout the app.

PrimeVue's reactive locale also translates built-in accessible messages (dialog/message close labels, option lists and selection announcements). Leaflet zoom titles/labels and map attribution update when the language changes. Known seed-history labels are translated only for display; free-text notes remain unchanged. These changes do not certify WCAG conformance.

Tables scroll inside their own containers on small screens. The closed mobile navigation is hidden and inert; when open it receives focus and contains Tab navigation. Escape closes it and returns focus to the menu button. Navigation to another page focuses the main content. The desktop navigation remains a normal sidebar.

## Data, boundaries and limitations

- `src/domains/operations.js` contains validation, role visibility, lifecycle, audit history, commands and sample CSV export. It is pure JavaScript and tested without Vue.
- `src/domains/seed.js` contains fictitious shipments, fleet, profiles and sensor readings. Emails use reserved `example.invalid` domains. These values are not interview data or evidence of customer usage.
- `src/infrastructure/demo-repository.js` is a **localStorage demo adapter** and exposes a future repository contract. Vue views call it instead of directly editing persistent arrays.
- The four-step planning form keeps an unsaved draft in memory and creates a scheduled shipment on confirmation. Persisted DRAFT shipments are not implemented; US34 cancellation applies to the scheduled state available in this version.
- The storage key is `friotrack.tb1.sample.v1`; the sample session/profile and language have separate keys. The profile page can reset all local examples with a confirmation.
- Each mutation reloads the latest stored snapshot and validates allocations/record versions. Stale shipment edits are rejected. localStorage is **not an atomic multi-tab database**; simultaneous cross-tab writes are not guaranteed. API transactions and concurrency control remain necessary.
- Client visibility is a frontend demonstration of role rules. Anyone controlling this browser can inspect/modify localStorage or switch sample profiles. This is **not secure authentication or server authorization**.
- There is no JWT, identity provider, password recovery, real registration, sensor ingestion, shared cloud storage, email/SMS/push delivery, backend API or signed audit report.
- Resolving the sampled thermal state requires a new sample reading; entering a corrective-action note never rewrites telemetry or proves cargo safety.
- Local fleet deactivation acts as availability control. Resources linked to active/scheduled trips cannot be modified; historical records are preserved.
- The map sends ordinary tile requests to OpenStreetMap only after pressing its load button. No secret or production location data is present.
- The terms are the supplied landing's **informational draft**, not legal verification or a claim of an operational commercial service.

## Validation

`npm test` runs 15 meaningful domain tests covering client isolation and rejected mutations, invalid thermal ranges/capacity/dates, future departure, resource allocation overlap, stale versions, permitted lifecycle and deletion, cancellation blocked in transit/after delivery, released reservations after scheduled cancellation, empty corrective actions, acknowledgement without premature closure, client-targeted notification, normal-reading recovery, invalid readings, resource uniqueness, password-free local registration and CSV formula escaping.

`npm run build` validates Vue SFC compilation and production assets. Browser interaction, responsive screenshots and accessibility checks must be documented from actual runs; a successful build is not evidence that those checks passed. Selected local browser checks and actual screenshots are recorded in the [project report](https://github.com/upc-pre-202620-1asi0730-8088-FrioTrack/report-friotrack). Those earlier checks do not imply a new browser run for this standalone copy.

## Deployment preparation

Copy `.env.example` to `.env.local` only if changing build settings. `VITE_BASE_PATH=./` keeps asset links relative and hash routing avoids history-route server rewrites. Set `VITE_LANDING_URL` to the authorized landing URL. Build, then publish **the contents of `dist/`** to the chosen AWS or Azure static hosting service only after deployment authorization. Replace local links in the landing with the verified published entry URLs after deployment. There is intentionally no automatic cloud publishing workflow.

Before production, replace the demo adapter with an authenticated ASP.NET Core REST adapter implementing server-side tenant/client authorization, validated lifecycle rules, sensor timestamps and signal loss, transaction-safe allocations, ETag/concurrency checks, audit retention, protected exports, account registration/recovery and notification delivery. Preserve the distinction between data received from sensors and test data.

Package documentation used during implementation: [Vue](https://vuejs.org/guide/introduction.html), [PrimeVue with Vite](https://primevue.dev/vite), [Vite](https://vite.dev/guide/), [Leaflet](https://leafletjs.com/reference.html).

Fresh standalone-source verification: `npm ci` completed, `npm test` passed 15/15 tests (zero failures), and `npm run build` processed 223 modules with Vite 7.3.7 in 2.15 seconds with no build warnings. This verifies the published source copy; it does not verify a cloud deployment.
