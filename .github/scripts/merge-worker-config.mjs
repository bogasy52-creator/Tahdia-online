import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// Strip JSONC comments and trailing commas without changing quoted strings.
export function parseJsonc(raw) {
  let clean = '', quoted = false, escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (quoted) {
      clean += c;
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') {
      quoted = true;
      clean += c;
    } else if (c === '/' && raw[i + 1] === '/') {
      while (i + 1 < raw.length && raw[i + 1] !== '\n') i++;
      clean += ' ';
    } else if (c === '/' && raw[i + 1] === '*') {
      const end = raw.indexOf('*/', i + 2);
      if (end < 0) throw new Error('Unterminated JSONC comment');
      clean += ' ';
      i = end + 1;
    } else clean += c;
  }
  let json = '';
  quoted = escaped = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      json += c;
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') {
      quoted = true;
      json += c;
    } else if (c === ',' && /^[\s]*[}\]]/.test(clean.slice(i + 1))) {
      // JSONC permits a trailing comma in either an object or an array.
    } else json += c;
  }
  const value = JSON.parse(json);
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Worker config must be an object');
  return value;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
function keyed(items, key, label) {
  if (!Array.isArray(items)) throw new Error(`${label} must be an array`);
  const map = new Map();
  for (const item of items) {
    if (!item || typeof item[key] !== 'string' || !item[key] || map.has(item[key])) throw new Error(`Invalid or duplicate ${label}: ${item?.[key]}`);
    map.set(item[key], item);
  }
  return map;
}
export function mergeWorkerConfig(current, incoming) {
  const merged = structuredClone(current);
  const migrations = structuredClone(current.migrations || []);
  const history = keyed(migrations, 'tag', 'migration');
  const additions = keyed(incoming.migrations || [], 'tag', 'migration');
  const classes = new Set();
  function applyMigration(migration) {
    for (const name of [...(migration.new_classes || []), ...(migration.new_sqlite_classes || [])]) {
      if (typeof name !== 'string' || !name || classes.has(name)) throw new Error(`Migration recreates an existing class: ${name}`);
      classes.add(name);
    }
    for (const rename of migration.renamed_classes || []) {
      if (!classes.has(rename.from) || classes.has(rename.to)) throw new Error(`Invalid migration rename: ${rename.from} -> ${rename.to}`);
      classes.delete(rename.from);
      classes.add(rename.to);
    }
    for (const name of migration.deleted_classes || []) classes.delete(name);
  }
  for (const migration of migrations) applyMigration(migration);
  for (const [tag, migration] of additions) {
    if (history.has(tag)) {
      if (!equal(history.get(tag), migration)) throw new Error(`Cannot rewrite deployed migration: ${tag}`);
      continue;
    }
    if (migration.deleted_classes?.length || migration.transferred_classes?.length) throw new Error(`ZIP updater only accepts additive migrations: ${tag}`);
    applyMigration(migration);
    migrations.push(structuredClone(migration));
  }
  if (migrations.length) merged.migrations = migrations;
  const bindings = keyed(structuredClone(current.durable_objects?.bindings || []), 'name', 'Durable Object binding');
  for (const [name, binding] of keyed(incoming.durable_objects?.bindings || [], 'name', 'Durable Object binding')) {
    if (bindings.has(name)) {
      if (!equal(bindings.get(name), binding)) throw new Error(`Cannot replace deployed Durable Object binding: ${name}`);
    } else bindings.set(name, structuredClone(binding));
  }
  for (const binding of bindings.values()) {
    if (!binding.script_name && !classes.has(binding.class_name)) throw new Error(`Binding has no class migration: ${binding.name} / ${binding.class_name}`);
  }
  if (bindings.size) merged.durable_objects = { ...current.durable_objects, bindings: [...bindings.values()] };
  return merged;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const [existingPath, incomingPath, destination] = process.argv.slice(2);
    if (!destination) throw new Error('Usage: merge-worker-config.mjs <deployed-config> <incoming-config> <output>');
    const oldRaw = await readFile(existingPath, 'utf8');
    const current = parseJsonc(oldRaw);
    const merged = mergeWorkerConfig(current, parseJsonc(await readFile(incomingPath, 'utf8')));
    await writeFile(destination, equal(current, merged) ? oldRaw : `${JSON.stringify(merged, null, 2)}\n`);
  } catch (error) {
    console.error(`Worker config merge failed: ${error.message}`);
    process.exitCode = 1;
  }
}
