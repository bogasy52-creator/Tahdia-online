import {createHash} from 'node:crypto';
import {lstatSync, readFileSync, unlinkSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

// Roll back only the two test-only additions from commit 7b177c73.
// The installed sparse ZIP updater cannot remove files, so release preparation
// performs this explicitly. Existing character runtime and artwork stay intact.
const retiredFiles = {
  'test/character-animation-v33.test.js': 'e4841854d2eda37e6ace4870fb73c50543318fb3cc93a32ec72562f1105675c1',
  'test/character-presentation-repair.test.js': '970ab163e0e118fbeefa91002250c194989f11ef5e8aeb1abe29528d0872e9e9',
};

function inspect(path) {
  try { return lstatSync(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export function removeIncompleteCharacterUpdate(root) {
  root = resolve(root);
  const directory = inspect(join(root, 'test'));
  if (!directory) return [];
  if (directory.isSymbolicLink() || !directory.isDirectory()) {
    throw new Error('Refusing cleanup through a symbolic link or invalid test directory.');
  }
  const pending = [];
  // Validate every candidate before deleting anything. Preserve later edits.
  for (const [relative, expected] of Object.entries(retiredFiles)) {
    const path = join(root, relative), entry = inspect(path);
    if (!entry) continue;
    if (entry.isSymbolicLink() || !entry.isFile()) {
      throw new Error('Refusing cleanup of a symbolic link or invalid file: ' + relative);
    }
    const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
    if (actual !== expected) throw new Error('Incomplete-update file changed unexpectedly; cleanup stopped: ' + relative);
    pending.push(relative);
  }
  for (const relative of pending) unlinkSync(join(root, relative));
  return pending;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const removed = removeIncompleteCharacterUpdate(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  console.log('Incomplete character update cleanup: ' + removed.length + ' file(s) removed.');
  for (const path of removed) console.log('Removed: ' + path);
}
