import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
const root = new URL('../', import.meta.url).pathname;
const pub = join(root,'public');

test('shared luxury dice layer is loaded by every dice game', async()=>{
  await access(join(pub,'assets/css/luxury-game-ui.css'));
  await access(join(pub,'assets/js/luxury-game-ui.js'));
  for(const file of ['snakes.html','zahra.html','dice.html']){
    const html=await readFile(join(pub,file),'utf8');
    assert.match(html,/assets\/css\/luxury-game-ui\.css/);
    assert.match(html,/assets\/js\/luxury-game-ui\.js/);
    assert.match(html,/class="die"/);
  }
});

test('all board games load premium playing-stone styling', async()=>{
  for(const file of ['snakes.html','zahra.html','jackaroo.html']){
    const html=await readFile(join(pub,file),'utf8');
    assert.match(html,/assets\/css\/luxury-game-ui\.css/);
  }
  const css=await readFile(join(pub,'assets/css/luxury-game-ui.css'),'utf8');
  for(const cls of ['.snake-token','.ludo-piece','.jack-piece']) assert.ok(css.includes(cls));
});

test('snake renderer includes layered body, scale and tongue detail', async()=>{
  const html=await readFile(join(pub,'snakes.html'),'utf8');
  for(const cls of ['snake-path-shadow','snake-path-outline','snake-scale-line','snake-head-shell','snake-tongue']) assert.ok(html.includes(cls));
});

test('service worker caches luxury presentation assets', async()=>{
  const sw=await readFile(join(pub,'service-worker.js'),'utf8');
  assert.ok(sw.includes('/assets/css/luxury-game-ui.css'));
  assert.ok(sw.includes('/assets/js/luxury-game-ui.js'));
  assert.match(sw,/busraj-games-v16/);
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
