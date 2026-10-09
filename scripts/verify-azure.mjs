import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const record = JSON.parse(await readFile(path.join(workspace, 'docs/azure-deployment.json'), 'utf8'));
const dist = path.join(workspace, 'dist');
const files = await readdir(dist, { recursive: true, withFileTypes: true });
const results = [];
for (const file of files.filter((entry) => entry.isFile())) {
  const local = path.join(file.parentPath, file.name);
  const relative = path.relative(dist, local).split(path.sep).join('/');
  const response = await fetch(new URL(relative, record.endpoint), { cache: 'no-store' });
  const remote = Buffer.from(await response.arrayBuffer());
  const hash = (value) => createHash('sha256').update(value).digest('hex');
  const expected = hash(await readFile(local));
  const actual = hash(remote);
  if (response.status !== 200 || expected !== actual) throw new Error(`Published file differs: ${relative}, HTTP ${response.status}`);
  results.push({ path: relative, status: response.status, sha256: actual, contentType: response.headers.get('content-type') });
}
const missing = await fetch(new URL('tb1-page-that-does-not-exist.html', record.endpoint));
if (missing.status !== 404) throw new Error(`Expected 404, received ${missing.status}`);
const verification = { verifiedAt: new Date().toISOString(), checkedFiles: results.length, allMatch: true, missingPageStatus: missing.status, files: results };
await writeFile(path.join(workspace, 'docs/azure-file-verification.json'), JSON.stringify(verification, null, 2) + '\n');
console.log(`Verified ${results.length} published files by SHA-256; missing page returns 404.`);
