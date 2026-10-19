import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const src=path=>readFile(new URL(path,root),'utf8');
test('the in-game arena is above backgrounds and non-game instructional sections are hidden',async()=>{
 const css=await src('public/assets/css/app-serpent.css');
 assert.match(css,/body\.serpent-active \.arena-combat-guide[^\n]*display:none!important/);
 assert.match(css,/#arenaPlay:not\(\.hidden\)\{[^}]*z-index:70/);
 assert.match(css,/#arenaPlay \.arena-overlay\.hidden\{[^}]*display:none!important/);
});
test('mobile boost and floating joystick no longer overlap on the right',async()=>{
 const css=await src('public/assets/css/app-serpent.css');
 assert.match(css,/#arenaPlay\[data-duo=false\] #boost1\{[^}]*left:[^}]*!important;right:auto!important/);
 const js=await src('public/assets/js/serpent-ui.js');
 assert.doesNotMatch(js,/originX\?\?e\.clientX\)-rect\.left-34/);
 assert.match(js,/const diameter=ring\.getBoundingClientRect\(\)\.width\|\|112/);
 assert.match(js,/pointer\?\.knobX/);
});
test('hotfix assets bust the previous mobile cache',async()=>{
 const html=await src('public/serpent.html'),sw=await src('public/service-worker.js');
 assert.match(html,/app-serpent\.css\?v=24\.0\.1/);
 assert.match(html,/serpent-ui\.js\?v=25\.3\.0/);
 assert.match(sw,/busraj-games-v54-release-25-3-0/);
});
