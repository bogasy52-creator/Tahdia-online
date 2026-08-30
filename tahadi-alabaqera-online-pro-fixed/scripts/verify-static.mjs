import { readFile, readdir, access } from 'node:fs/promises';
import { dirname, join, resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const missing = [];
const checked = new Set();

async function walk(dir) {
  const out = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) out.push(...await walk(path));
    else out.push(path);
  }
  return out;
}

function localTarget(raw, fromFile) {
  const value = String(raw || '').trim();
  if (!value || value.startsWith('#') || /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(value)) return null;
  if (value.startsWith('/api/')) return null;
  const clean = value.split(/[?#]/)[0];
  if (!clean) return null;
  const base = clean.startsWith('/') ? publicDir : dirname(fromFile);
  return resolve(base, clean.replace(/^\//, ''));
}

async function requireTarget(target, source, raw) {
  if (!target) return;
  if (!target.startsWith(publicDir)) {
    missing.push(`${relative(root, source)} -> ${raw} (outside public)`);
    return;
  }
  const key = `${source}|${target}`;
  if (checked.has(key)) return;
  checked.add(key);
  try { await access(target); }
  catch { missing.push(`${relative(root, source)} -> ${raw}`); }
}

const files = await walk(publicDir);
for (const file of files) {
  const ext = extname(file).toLowerCase();
  if (!['.html', '.js', '.webmanifest'].includes(ext)) continue;
  const text = await readFile(file, 'utf8');

  if (ext === '.html') {
    const attrRe = /\b(?:href|src)=["']([^"']+)["']/gi;
    for (const match of text.matchAll(attrRe)) {
      await requireTarget(localTarget(match[1], file), file, match[1]);
    }
    const importRe = /\bimport\s+(?:[^'";]+?\s+from\s+)?["']([^"']+)["']/g;
    for (const match of text.matchAll(importRe)) {
      await requireTarget(localTarget(match[1], file), file, match[1]);
    }
  }

  if (ext === '.js') {
    const importRe = /\bimport\s+(?:[^'";]+?\s+from\s+)?["']([^"']+)["']/g;
    for (const match of text.matchAll(importRe)) {
      await requireTarget(localTarget(match[1], file), file, match[1]);
    }
  }

  if (ext === '.webmanifest') {
    const manifest = JSON.parse(text);
    for (const raw of [manifest.start_url, ...(manifest.icons || []).map((icon) => icon.src)]) {
      await requireTarget(localTarget(raw, file), file, raw);
    }
  }
}

if (missing.length) {
  console.error('Static asset verification failed:');
  for (const item of missing) console.error(` - ${item}`);
  process.exit(1);
}

console.log(`Static asset verification passed (${checked.size} local references checked).`);
