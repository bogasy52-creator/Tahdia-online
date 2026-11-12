import {assertReleaseAtLeast,releaseVersion} from './release-contract.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = (p) => readFile(new URL('../' + p, import.meta.url), 'utf8');
test('33.9.11 keeps the verified same-board duel and ships the premium visual/audio refinements', async()=>{
 const [pkg, html, jewels, pool, sound, notes] = await Promise.all([
  read('package.json'),read('public/jewels.html'),read('public/assets/css/app-jewels.css'),read('public/assets/css/app-billiards.css'),read('public/assets/js/sound-v33-9-3.js'),read('RELEASE_V33_9_11_AR.md')
 ]);
 assertReleaseAtLeast(JSON.parse(pkg).version,'33.9.11');
 assert.ok(html.includes('assets/js/jewels/main.js?v='+releaseVersion));
 assert.match(jewels,/33\.9\.11 — Master Match premium arena refinement/);
 assert.match(pool,/33\.9\.11 — restrained tournament-room finish/);
 assert.ok(sound.includes('(s.musicVolume ?? .28))) * .62'));
 assert.match(notes,/لوحة واحدة مشتركة/);
});
