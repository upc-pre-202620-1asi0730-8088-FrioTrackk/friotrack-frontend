import { DeviceCodeCredential } from '@azure/identity';
import { StorageManagementClient } from '@azure/arm-storage';
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(workspace, 'dist');
const subscriptionId = 'bce6db1b-2de4-491e-aa92-4f9c47db032d';
const resourceGroup = 'rg-friotrack-tb1';
const accountName = 'friotracktb1bce6db1b';
const location = 'westus';
const credential = new DeviceCodeCredential({
  tenantId: '0e0cb060-09ad-49f5-a005-68b9b49aa1f6',
  userPromptCallback: (info) => console.log(info.message),
});
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject', '.ico': 'image/x-icon' };

async function* files(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* files(target);
    else if (entry.isFile()) yield target;
  }
}

try {
  await stat(path.join(dist, 'index.html'));
  const access = await credential.getToken('https://management.azure.com/.default');
  const armHeaders = { Authorization: `Bearer ${access.token}`, 'Content-Type': 'application/json' };
  const groupResponse = await fetch(`https://management.azure.com/subscriptions/${subscriptionId}/resourcegroups/${resourceGroup}?api-version=2022-09-01`, {
    method: 'PUT', headers: armHeaders,
    body: JSON.stringify({ location, tags: { project: 'FrioTrack', delivery: 'TB1', course: '1ASI0730' } }),
  });
  if (!groupResponse.ok) throw new Error(`Resource group: HTTP ${groupResponse.status}: ${await groupResponse.text()}`);
  const providerUrl = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.Storage`;
  const providerResponse = await fetch(providerUrl + '?api-version=2021-04-01', { headers: armHeaders });
  if (!providerResponse.ok) throw new Error(`Storage provider: HTTP ${providerResponse.status}`);
  let provider = await providerResponse.json();
  if (provider.registrationState !== 'Registered') {
    console.log('Registering the Microsoft.Storage resource provider for this subscription.');
    const registered = await fetch(providerUrl + '/register?api-version=2021-04-01', { method: 'POST', headers: armHeaders });
    if (!registered.ok) throw new Error(`Provider registration: HTTP ${registered.status}: ${await registered.text()}`);
    for (let attempt = 0; attempt < 24; attempt++) {
      provider = await (await fetch(providerUrl + '?api-version=2021-04-01', { headers: armHeaders })).json();
      if (provider.registrationState === 'Registered') break;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    if (provider.registrationState !== 'Registered') throw new Error('Storage provider registration is still in progress. Run deployment again after registration completes.');
  }
  const management = new StorageManagementClient({ getToken: async () => access }, subscriptionId);
  let account;
  try { account = await management.storageAccounts.getProperties(resourceGroup, accountName); }
  catch (error) { if (error.statusCode !== 404) throw error; }
  if (!account) {
    console.log('Creating Azure Storage Standard_LRS in permitted region westus.');
    account = await management.storageAccounts.beginCreateAndWait(resourceGroup, accountName, {
      location, sku: { name: 'Standard_LRS' }, kind: 'StorageV2',
      enableHttpsTrafficOnly: true, minimumTlsVersion: 'TLS1_2',
      allowBlobPublicAccess: false, accessTier: 'Hot',
      tags: { project: 'FrioTrack', delivery: 'TB1', course: '1ASI0730' },
    });
  }
  const keys = await management.storageAccounts.listKeys(resourceGroup, accountName);
  const key = keys.keys?.[0]?.value;
  if (!key) throw new Error('Azure did not return an account key.');
  const blobService = new BlobServiceClient(account.primaryEndpoints.blob, new StorageSharedKeyCredential(accountName, key));
  await blobService.setProperties({ staticWebsite: { enabled: true, indexDocument: 'index.html', errorDocument404Path: '404.html' } });
  const container = blobService.getContainerClient('$web');
  let count = 0;
  let bytes = 0;
  for await (const file of files(dist)) {
    const name = path.relative(dist, file).split(path.sep).join('/');
    const extension = path.extname(file).toLowerCase();
    await container.getBlockBlobClient(name).uploadFile(file, {
      blobHTTPHeaders: {
        blobContentType: mimeTypes[extension] || 'application/octet-stream',
        blobCacheControl: name.startsWith('assets/') && /-[A-Za-z0-9_-]{8}\./.test(name) ? 'public, max-age=31536000, immutable' : 'no-cache',
      },
    });
    count++;
    bytes += (await stat(file)).size;
  }
  account = await management.storageAccounts.getProperties(resourceGroup, accountName);
  const endpoint = account.primaryEndpoints.web;
  const checks = [];
  for (const route of ['', 'landing/', 'landing/Terms-and-Condition.html', 'logo.svg']) {
    const response = await fetch(new URL(route, endpoint));
    checks.push({ route: '/' + route, status: response.status, contentType: response.headers.get('content-type') });
    if (!response.ok) throw new Error(`Published URL failed: ${route}: HTTP ${response.status}`);
  }
  const record = { verifiedAt: new Date().toISOString(), subscriptionName: 'Azure for Students', resourceGroup, accountName, location, sku: 'Standard_LRS', endpoint, landingUrl: new URL('landing/', endpoint).href, coordinatorUrl: endpoint + '#/login?role=coordinator&lang=en', cargoClientUrl: endpoint + '#/login?role=cargo-client&lang=en', fileCount: count, totalBytes: bytes, checks };
  await mkdir(path.join(workspace, 'docs'), { recursive: true });
  await writeFile(path.join(workspace, 'docs/azure-deployment.json'), JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify(record, null, 2));
} catch (error) {
  console.error(`${error.name}: ${error.message}`);
  process.exitCode = 1;
}
