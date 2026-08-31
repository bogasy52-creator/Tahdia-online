import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const home = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const snakes = await readFile(new URL('../public/snakes.html', import.meta.url), 'utf8');
const elite = await readFile(new URL('../public/assets/css/snakes-premium.css', import.meta.url), 'utf8');

test('home hero separates copy from a contained game-console showcase',()=>{
  for(const marker of ['hero-showcase','showcase-console','showcase-games','كل ألعاب جمعتكم','quick-strip']) assert.ok(home.includes(marker),`missing ${marker}`);
  assert.ok(!home.includes('class="orbit a"'),'legacy overlapping orbit art should be gone');
});

test('snakes uses elite physical-board art layer',()=>{
  assert.match(snakes,/assets\/css\/snakes-premium\.css/);
  for(const marker of ['snakeCurve(','ladder-shadow','ladder-rail-hi','snake-belly-line','snake-mouth','snake-tail-tip']) assert.ok(snakes.includes(marker),`missing ${marker}`);
  for(const marker of ['Elite tabletop art direction','--snake-ivory','data-n="100"','BUSRAJ • RACE 100']) assert.ok(elite.includes(marker),`missing elite CSS ${marker}`);
});
