import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {join} from 'node:path';
const root=process.cwd(),pub=join(root,'public');

test('mobile board stylesheet is shipped and cached', async()=>{
  await access(join(pub,'assets/css/mobile-game.css'));
  const sw=await readFile(join(pub,'service-worker.js'),'utf8');
  assert.match(sw,/busraj-games-v13/);
  assert.ok(sw.includes('/assets/css/mobile-game.css'));
});

test('all board games opt into fullscreen mobile game mode', async()=>{
  for(const [file,cls] of [['snakes.html','game-snakes'],['zahra.html','game-zahra'],['jackaroo.html','game-jackaroo'],['dice.html','game-dice']]){
    const html=await readFile(join(pub,file),'utf8');
    assert.ok(html.includes('assets/css/mobile-game.css'),`${file} loads mobile CSS`);
    assert.match(html,new RegExp(`body class="[^"]*board-game[^"]*${cls}`));
    assert.ok(html.includes("document.body.classList.add('game-running')"),`${file} enters fullscreen mode`);
  }
});

test('snakes pieces cannot be clipped during movement', async()=>{
  const html=await readFile(join(pub,'snakes.html'),'utf8');
  const css=await readFile(join(pub,'assets/css/mobile-game.css'),'utf8');
  assert.ok(html.includes("classList.add('occupied-cell')"));
  assert.ok(html.includes('async function glideToken('));
  assert.ok(html.includes("classList.add('moving-token')"));
  assert.match(css,/\.snake-cell\.occupied-cell\s*\{[^}]*overflow:\s*visible\s*!important/s);
  assert.match(css,/\.token-stack\s*\{[^}]*z-index:\s*40\s*!important/s);
});

test('zahra pieces are promoted above the board when occupied', async()=>{
  const html=await readFile(join(pub,'zahra.html'),'utf8');
  const css=await readFile(join(pub,'assets/css/mobile-game.css'),'utf8');
  assert.ok(html.includes("classList.add('occupied-cell')"));
  assert.ok(html.includes('async function animateLudoPiece('));
  assert.ok(html.includes("classList.add('moving-piece')"));
  assert.match(css,/game-zahra\.game-running \.ludo-cell\.occupied-cell/);
  assert.match(css,/game-zahra\.game-running \.piece-stack\s*\{[^}]*z-index:\s*40/s);
});


test('jackaroo pieces animate above the board for move, swap and split seven', async()=>{
  const html=await readFile(join(pub,'jackaroo.html'),'utf8');
  const css=await readFile(join(pub,'assets/css/mobile-game.css'),'utf8');
  assert.ok(html.includes('function captureJackMotions('));
  assert.ok(html.includes('async function animateJackPiece('));
  assert.ok(html.includes("type==='split7'"));
  assert.match(css,/game-jackaroo\.game-running \.jack-piece\.moving-piece/);
});
