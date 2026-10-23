import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
const root = new URL('../', import.meta.url).pathname;
const pub = join(root,'public');

test('every dice game uses one shared professional die provider',async()=>{const snakes=await readFile(join(pub,'snakes.html'),'utf8');assert.match(snakes,/pro-dice\.js/);assert.doesNotMatch(snakes,/luxury-game-ui\.js/);for(const file of ['zahra.html','dice.html']){const html=await readFile(join(pub,file),'utf8');assert.match(html,/pro-dice\.js/);assert.doesNotMatch(html,/luxury-game-ui\.js/)}const die=await readFile(join(pub,'assets/js/pro-dice.js'),'utf8');assert.match(die,/running\.has\(el\)/);assert.match(die,/duration:1180/);assert.doesNotMatch(die,/setInterval|MutationObserver/)});

test('the redesigned board games share professional pieces and readable labels',async()=>{for(const file of ['snakes.html','jackaroo.html']){const html=await readFile(join(pub,file),'utf8');assert.match(html,/app-(?:snakes|jackaroo)\.css/);assert.match(html,/pawn-label/)}const css=await readFile(join(pub,'assets/css/pro-games.css'),'utf8');assert.match(css,/\.snake-token/);assert.match(css,/\.jack-piece/)});

test('snake renderer includes layered body, scale and tongue detail', async()=>{
  const html=await readFile(join(pub,'snakes.html'),'utf8');
  for(const cls of ['snake-path-shadow','snake-path-outline','snake-scale-line','snake-head-shell','snake-tongue']) assert.ok(html.includes(cls));
});

test('service worker caches luxury presentation assets', async()=>{
  const sw=await readFile(join(pub,'service-worker.js'),'utf8');
  assert.ok(sw.includes('/assets/css/luxury-game-ui.css'));
  assert.ok(sw.includes('/assets/js/luxury-game-ui.js'));
  assert.match(sw,/busraj-games-v59-release-29-1-0/);
});


test('dice is porcelain white with large recessed black pips and board pieces are sculpted pawns', async()=>{
  const css=await readFile(join(pub,'assets/css/luxury-game-ui.css'),'utf8');
  assert.match(css,/Porcelain Pro Dice/);
  assert.match(css,/linear-gradient\(145deg,#ffffff 0%,#fdfdfd/);
  assert.match(css,/width:clamp\(12px,28%,25px\)/);
  assert.match(css,/luxuryDiceBody/);
  assert.match(css,/luxuryDiceShadow/);
  assert.match(css,/Sculpted playing pawns/);
  assert.match(css,/clip-path:polygon\(36% 0,64% 0/);
  for(const file of ['snakes.html','zahra.html','jackaroo.html']){
    const html=await readFile(join(pub,file),'utf8');
    assert.match(html,/pawn-label/);
  }
});
