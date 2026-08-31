import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const outputName = 'SHA256SUMS.txt';
const ignoredDirectories = new Set(['node_modules', '.git', '.wrangler']);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const files = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error(`Refusing to checksum symbolic link: ${join(directory, entry.name)}`);
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) continue;
      files.push(...await walk(join(directory, entry.name)));
      continue;
    }
    if (!entry.isFile()) continue;
    const absolute = join(directory, entry.name);
    const rel = relative(root, absolute).split(sep).join('/');
    if (rel === outputName) continue;
    files.push({ absolute, rel: `./${rel}` });
  }
  return files;
}

const files = await walk(root);
files.sort((a, b) => a.rel.localeCompare(b.rel, 'en'));
const lines = [];
for (const file of files) {
  const hash = createHash('sha256').update(await readFile(file.absolute)).digest('hex');
  lines.push(`${hash}  ${file.rel}`);
}
await writeFile(join(root, outputName), `${lines.join('\n')}\n`);
console.log(`Checksums refreshed for ${lines.length} files.`);
