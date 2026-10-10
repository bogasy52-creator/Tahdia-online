import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const home = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const snakes = await readFile(new URL('../public/snakes.html', import.meta.url), 'utf8');
const elite = await readFile(new URL('../public/assets/css/snakes-premium.css', import.meta.url), 'utf8');

test('home presents the table collection, real career values and working games',()=>{for(const marker of ['home-hero','table-feature','home-game-grid','data-career-coins','/shop'])assert.ok(home.includes(marker));assert.doesNotMatch(home,/id="level">15|id="xpText">3500|100 لاعب/)});

test('snakes uses an engine-backed board with no baked-in pawns or results',async()=>{assert.match(snakes,/assets\/css\/pro-games\.css/);assert.doesNotMatch(snakes,/reference-skin|snake-reference-skin\.png/);for(const marker of ['snakeCurve(','ladder-shadow','snake-head-creature','snakeVisualParts(','route-highlight'])assert.ok(snakes.includes(marker));const css=await readFile(new URL('../public/assets/css/pro-games.css',import.meta.url),'utf8');assert.match(css,/\.snake-board[\s\S]*repeat\(10,1fr\)/)});
