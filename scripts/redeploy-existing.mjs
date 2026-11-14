import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, lstat, realpath, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import path from 'node:path';
import { requirePreparedPostgres, requireCompatibleBackend, requireCompatibleDeploymentOrder, createCoordinatorRegistrationProbe } from './deployment-policy.mjs';

const usage = `Redeploy an existing FríoTrack resource without changing its settings.
node scripts/redeploy-existing.mjs --component frontend|landing|api --artifact <dist-directory|api.zip> --source-repo <repository-directory> --source-sha <full-Git-SHA> [--check]
node scripts/redeploy-existing.mjs --plan <JSON-array-file> [--check]
--check validates the artifact and clean source revision without authenticating or deploying.
Microsoft device authentication is shown only when a deployment actually starts.`;
const flags = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--help') { console.log(usage); process.exit(0); }
  if (arg === '--check') { flags.set(arg, true); continue; }
  if (!['--component', '--artifact', '--source-repo', '--source-sha', '--plan'].includes(arg) || !process.argv[i + 1] || process.argv[i + 1].startsWith('--') || flags.has(arg)) throw new Error(usage);
  flags.set(arg, process.argv[++i]);
}
const scriptRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let tasks;
if (flags.has('--plan')) {
  if (['--component', '--artifact', '--source-repo', '--source-sha'].some(flag => flags.has(flag))) throw new Error('Use a plan or a single component, not both.');
  tasks = JSON.parse(await readFile(path.resolve(flags.get('--plan')), 'utf8'));
  if (!Array.isArray(tasks) || tasks.length < 1 || tasks.length > 3 || new Set(tasks.map(task => task.component)).size !== tasks.length) throw new Error('A plan must contain one to three distinct components.');
} else tasks = [{ component: flags.get('--component'), artifact: flags.get('--artifact'), sourceRepo: flags.get('--source-repo'), sourceSha: flags.get('--source-sha') }];
async function prepareTask(task) {
const { component, sourceSha } = task;
if (!['frontend', 'landing', 'api'].includes(component) || !task.artifact || !task.sourceRepo || !/^[a-f0-9]{40}$/i.test(sourceSha || '')) throw new Error(usage);
const artifact = await realpath(path.resolve(task.artifact));
const sourceRepo = await realpath(path.resolve(task.sourceRepo));
const git = (...args) => execFileSync('git', ['-c', 'safe.directory=' + sourceRepo.replaceAll('\\', '/'), ...args], { cwd: sourceRepo, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
if (git('rev-parse', 'HEAD').toLowerCase() !== sourceSha.toLowerCase()) throw new Error('The source SHA must equal the checked-out repository HEAD.');
if (git('status', '--porcelain=v1', '--untracked-files=normal')) throw new Error('Commit or separate source changes before deploying a recorded revision.');
const origin = git('remote', 'get-url', 'origin');
const expectedRepo = component === 'frontend' ? 'friotrack-frontend' : component === 'landing' ? 'friotrack-landing' : 'friotrack-api';
if (!new RegExp('(?:github\\.com[/:])upc-pre-202620-1asi0730-8088-FrioTrackk/' + expectedRepo + '(?:\\.git)?/?$', 'i').test(origin)) throw new Error('The source repository does not match the selected organization product.');

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const unsafeName = name => name.split('/').some(part => ['.git', '.azure-tools', 'node_modules', 'data'].includes(part) || part.startsWith('.env')) || /(^|\/)(accounts\.json|[^/]+\.(?:pfx|pem|key))$/i.test(name);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
const files = [];
async function collect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Artifacts cannot contain symbolic links.');
    if (entry.isDirectory()) await collect(full);
    else if (entry.isFile()) {
      const relative = path.relative(artifact, full).split(path.sep).join('/');
      if (unsafeName(relative) || (component === 'frontend' && relative.startsWith('landing/'))) throw new Error('Unexpected public artifact path: ' + relative);
      const bytes = await readFile(full);
      files.push({ full, path: relative, bytes: bytes.length, sha256: hash(bytes) });
    }
  }
}
function zipEntries(bytes) {
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (bytes.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('The API artifact is not a valid standard ZIP.');
  const count = bytes.readUInt16LE(end + 10), offset = bytes.readUInt32LE(end + 16);
  if (count === 0xffff || offset === 0xffffffff) throw new Error('ZIP64 packages are not supported.');
  const entries = new Map();
  let current = offset;
  for (let i = 0; i < count; i++) {
    if (current + 46 > bytes.length || bytes.readUInt32LE(current) !== 0x02014b50) throw new Error('Invalid ZIP directory.');
    const flags = bytes.readUInt16LE(current + 8), method = bytes.readUInt16LE(current + 10), size = bytes.readUInt32LE(current + 20);
    const nameLength = bytes.readUInt16LE(current + 28), extraLength = bytes.readUInt16LE(current + 30), commentLength = bytes.readUInt16LE(current + 32);
    const name = bytes.subarray(current + 46, current + 46 + nameLength).toString('utf8');
    if ((flags & 1) || name.startsWith('/') || /^[A-Za-z]:/.test(name) || name.includes('\\') || name.split('/').includes('..') || unsafeName(name) || entries.has(name)) throw new Error('Unexpected or duplicate API package entry.');
    entries.set(name, { method, size, offset: bytes.readUInt32LE(current + 42) });
    current += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
let packageBytes, packageSha, apiVersion;
if (component === 'api') {
  if (!(await lstat(artifact)).isFile()) throw new Error('The API artifact must be a ZIP file.');
  packageBytes = await readFile(artifact); packageSha = hash(packageBytes);
  const entries = zipEntries(packageBytes);
  for (const required of ['FrioTrack.Api.dll', 'FrioTrack.Api.runtimeconfig.json', 'FrioTrack.Api.deps.json', 'seed.json']) if (!entries.has(required)) throw new Error('API package lacks ' + required);
  function readPackageJson(name) {
    const entry = entries.get(name);
    if (entry.size > 2 * 1024 * 1024) throw new Error('Unexpected API metadata size.');
    const local = entry.offset;
    if (packageBytes.readUInt32LE(local) !== 0x04034b50) throw new Error('Invalid API metadata entry.');
    const start = local + 30 + packageBytes.readUInt16LE(local + 26) + packageBytes.readUInt16LE(local + 28);
    const content = packageBytes.subarray(start, start + entry.size);
    const decoded = entry.method === 0 ? content : entry.method === 8 ? inflateRawSync(content, { maxOutputLength: 2 * 1024 * 1024 }) : null;
    if (!decoded) throw new Error('Unsupported API metadata compression.');
    return JSON.parse(decoded.toString('utf8'));
  }
  if (readPackageJson('FrioTrack.Api.runtimeconfig.json').runtimeOptions?.tfm !== 'net10.0') throw new Error('Publish the .NET 10 API before packaging it.');
  apiVersion = /<Version>([^<]+)<\/Version>/.exec(await readFile(path.join(sourceRepo, 'FrioTrack.Api.csproj'), 'utf8'))?.[1];
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(apiVersion || '') || (Number(apiVersion.split('.')[0]) === 0 && Number(apiVersion.split('.')[1]) < 2)) throw new Error('This tool requires the canonical PostgreSQL API version 0.2.0 or later.');
  if (!readPackageJson('FrioTrack.Api.deps.json').libraries?.['FrioTrack.Api/' + apiVersion]) throw new Error('The API package version does not match the source project.');
} else {
  if (!(await lstat(artifact)).isDirectory()) throw new Error('Static artifacts must be directories.');
  await collect(artifact);
  if (!files.some(file => file.path === 'index.html')) throw new Error('The artifact must contain index.html at its root.');
  if (component === 'landing' && !files.some(file => file.path === 'Terms-and-Condition.html')) throw new Error('The landing artifact must include its terms page.');
  files.sort((a, b) => a.path.localeCompare(b.path));
}
const receipt = {
  component, sourceRepository: `https://github.com/upc-pre-202620-1asi0730-8088-FrioTrackk/${expectedRepo}`,
  sourceSha: sourceSha.toLowerCase(), startedAt: new Date().toISOString(),
  artifact: component === 'api' ? { sha256: packageSha, bytes: packageBytes.length } : { files: files.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })), manifestSha256: hash(Buffer.from(JSON.stringify(files.map(({ path, sha256 }) => ({ path, sha256 }))))) },
  scope: 'Redeployment to existing resources; no resource creation, app-setting changes or persisted-data replacement.'
};
return { component, sourceSha, artifact, sourceRepo, files, packageBytes, apiVersion, receipt, mime, hash };
}
const prepared = [];
// Validate every local source and artifact before beginning authentication.
for (const task of tasks) prepared.push(await prepareTask(task));
requireCompatibleDeploymentOrder(prepared.map(task => task.component));
if (flags.get('--check')) {
  console.log(JSON.stringify(prepared.map(({ component, sourceSha, files, packageBytes, receipt }) => ({ component, sourceSha, checked: true, authenticationStarted: false, ...(component === 'api' ? { packageSha256: receipt.artifact.sha256, bytes: packageBytes.length } : { files: files.length, manifestSha256: receipt.artifact.manifestSha256 }) })), null, 2));
  process.exit(0);
}

const tenantId = '0e0cb060-09ad-49f5-a005-68b9b49aa1f6';
const subscriptionId = 'bce6db1b-2de4-491e-aa92-4f9c47db032d';
const resourceGroup = 'rg-friotrack-tb1';
const appName = 'friotrack-api-bce6db1b';
const accountName = 'friotracktb1bce6db1b';
const version = '2024-11-01';
const apiUrl = 'https://' + appName + '.azurewebsites.net/api';
const { DeviceCodeCredential } = await import('@azure/identity');
const credential = new DeviceCodeCredential({ tenantId, userPromptCallback: info => console.log(info.message) });
const scope = 'https://management.azure.com/.default';
async function authorizedFetch(url, options = {}) {
  const token = await credential.getToken(scope);
  return fetch(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(120000), headers: { ...options.headers, Authorization: 'Bearer ' + token.token } });
}
async function arm(resource, method = 'GET') {
  const response = await authorizedFetch('https://management.azure.com' + resource, { method });
  if (!response.ok) throw new Error('Azure resource operation failed: HTTP ' + response.status);
  return response.json();
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function requirePublishedBackend() {
  const response = await fetch(apiUrl + '/health', { cache: 'no-store', signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!response.ok) throw new Error('The existing REST API is unavailable; publish and verify it before the AV2 frontend.');
  const health = await response.json().catch(() => null);
  requireCompatibleBackend(health);
  return { apiUrl, version: health.version, persistence: health.persistence };
}
async function preflightCloud({ component }) {
  if (component !== 'api') {
    const storagePath = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Storage/storageAccounts/${accountName}`;
    const account = await arm(storagePath + '?api-version=2023-05-01');
    if (!account.properties?.primaryEndpoints?.web || !account.properties?.primaryEndpoints?.blob) throw new Error('The existing static website endpoints are unavailable.');
    if (new URL(account.properties.primaryEndpoints.web).hostname !== accountName + '.z22.web.core.windows.net') throw new Error('Unexpected static website destination.');
    const { keys } = await arm(storagePath + '/listKeys?api-version=2023-05-01', 'POST');
    if (!keys?.[0]?.value) throw new Error('No Storage upload credential was returned.');
    return { account, storageKey: keys[0].value };
  }
  const root = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Web`;
  const site = await arm(root + '/sites/' + appName + '?api-version=' + version);
  const config = await arm(root + '/sites/' + appName + '/config/web?api-version=' + version);
  if (config.properties?.netFrameworkVersion !== 'v10.0') throw new Error('The existing App Service must already be configured for .NET 10.');
  const settings = await arm(root + '/sites/' + appName + '/config/appsettings/list?api-version=' + version, 'POST');
  requirePreparedPostgres(settings.properties || {});
  const planId = site.properties?.serverFarmId;
  if (!planId || !planId.startsWith(`/subscriptions/${subscriptionId}/`)) throw new Error('Unexpected App Service plan.');
  const plan = await arm(planId + '?api-version=' + version);
  const scmHost = site.properties?.enabledHostNames?.find(host => host === appName + '.scm.azurewebsites.net');
  if (!scmHost) throw new Error('The expected existing Kudu endpoint is unavailable.');
  return { site, plan, scmHost };
}
try {
  if (prepared.some(task => task.component === 'frontend') && !prepared.some(task => task.component === 'api')) await requirePublishedBackend();
  // GET every destination before the first upload; missing access/resources abort the batch.
  for (const task of prepared) task.cloud = await preflightCloud(task);
  for (const task of prepared) {
  const { component, sourceSha, files, packageBytes, apiVersion, receipt, mime, hash, cloud } = task;
  if (component !== 'api') {
    if (component === 'frontend') receipt.backendCompatibility = await requirePublishedBackend();
    const { account, storageKey } = cloud;
    const endpoint = account.properties.primaryEndpoints.web;
    if (new URL(endpoint).hostname !== accountName + '.z22.web.core.windows.net') throw new Error('Unexpected static website destination.');
    const { BlobServiceClient, StorageSharedKeyCredential } = await import('@azure/storage-blob');
    const service = new BlobServiceClient(account.properties.primaryEndpoints.blob, new StorageSharedKeyCredential(accountName, storageKey));
    const container = service.getContainerClient('$web');
    // Upload content before HTML entry points so the current page stays usable.
    const uploadOrder = [...files].sort((a, b) => Number(a.path.endsWith('.html')) - Number(b.path.endsWith('.html')));
    for (const file of uploadOrder) {
      const current = await readFile(file.full);
      if (hash(current) !== file.sha256) throw new Error('The artifact changed after preflight: ' + file.path);
      const name = (component === 'landing' ? 'landing/' : '') + file.path;
      await container.getBlockBlobClient(name).uploadData(current, { blobHTTPHeaders: {
        blobContentType: mime[path.extname(file.path).toLowerCase()] || 'application/octet-stream',
        blobCacheControl: name.startsWith('assets/') && /-[A-Za-z0-9_-]{8}\./.test(name) ? 'public, max-age=31536000, immutable' : 'no-cache'
      } });
    }
    const checks = [];
    for (const file of files) {
      const remotePath = (component === 'landing' ? 'landing/' : '') + file.path;
      const url = new URL(remotePath, endpoint);
      url.searchParams.set('verification', receipt.startedAt);
      const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(45000) });
      const sha256 = hash(Buffer.from(await response.arrayBuffer()));
      if (response.status !== 200 || sha256 !== file.sha256) throw new Error('Published content mismatch: ' + remotePath + ', HTTP ' + response.status);
      checks.push({ path: remotePath, status: response.status, sha256, contentType: response.headers.get('content-type') });
    }
    receipt.destination = { resourceGroup, storageAccount: accountName, endpoint, pathPrefix: component === 'landing' ? '/landing/' : '/' };
    receipt.verification = { checkedFiles: checks.length, allHashesMatch: true, checks };
  } else {
    const { plan, scmHost } = cloud;
    const registrationProbe = createCoordinatorRegistrationProbe();
    const upload = await authorizedFetch(`https://${scmHost}/api/zipdeploy?isAsync=true`, { method: 'POST', headers: { 'Content-Type': 'application/zip' }, body: packageBytes });
    if (!upload.ok) throw new Error('Kudu upload failed: HTTP ' + upload.status);
    const location = new URL(upload.headers.get('location') || '/api/deployments/latest', `https://${scmHost}`);
    if (location.origin !== `https://${scmHost}` || !location.pathname.startsWith('/api/deployments/')) throw new Error('Unexpected Kudu polling endpoint.');
    let deployment;
    for (let i = 0; i < 90; i++) {
      await pause(5000);
      const response = await authorizedFetch(location.href);
      if (!response.ok) throw new Error('Kudu status failed: HTTP ' + response.status);
      deployment = await response.json();
      if (deployment.status === 4) break;
      if (deployment.status === 3) throw new Error('Kudu reported a failed deployment.');
      if (i === 89) throw new Error('Deployment did not finish within 450 seconds.');
    }
    let health;
    for (let i = 0; i < 30; i++) {
      const response = await fetch(apiUrl + '/health', { signal: AbortSignal.timeout(15000), redirect: 'error' }).catch(() => null);
      if (response?.ok) { health = await response.json(); break; }
      if (i === 29) throw new Error('The deployed API did not become healthy.');
      await pause(5000);
    }
    if (health?.status !== 'ok' || health?.service !== 'FrioTrack' || health?.persistence !== 'postgresql' || health?.version !== apiVersion) throw new Error('The deployed API must report the packaged PostgreSQL service version.');
    const anonymous = await fetch(apiUrl + '/workspace', { signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (anonymous.status !== 401) throw new Error('The API must reject anonymous workspace access.');
    const denied = await fetch(apiUrl + '/auth/register', { method: 'POST', signal: AbortSignal.timeout(15000), redirect: 'error', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(registrationProbe) });
    if (denied.status !== 403) throw new Error('The API must reject coordinator privileges through public registration.');
    receipt.destination = { resourceGroup, appName, apiUrl, plan: { name: plan.name, tier: plan.sku?.tier, capacity: plan.sku?.capacity ?? 1 }, runtime: 'net10.0' };
    receipt.verification = { kuduDeploymentId: deployment.id, kuduStatus: deployment.status, health: { status: health.status, service: health.service, version: health.version, persistence: health.persistence }, anonymousWorkspaceStatus: anonymous.status, publicCoordinatorRegistrationStatus: denied.status, authenticatedRolesVerified: false, note: 'Authenticated coordinator/client regression checks require the existing private account passwords; this receipt does not certify them.' };
  }
  receipt.completedAt = new Date().toISOString();
  const receiptPath = path.join(scriptRepo, 'docs', `redeployment-${component}.json`);
  await mkdir(path.dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ component, sourceSha, completed: true, receipt: path.relative(scriptRepo, receiptPath), ...(component === 'api' ? { deploymentId: receipt.verification.kuduDeploymentId } : { verifiedFiles: files.length }) }, null, 2));
  }
} catch (error) {
  // Do not forward SDK response bodies, tokens, account keys or signed URLs.
  console.error('Redeployment failed: ' + (error.name === 'Error' ? error.message : error.name));
  process.exitCode = 1;
}
