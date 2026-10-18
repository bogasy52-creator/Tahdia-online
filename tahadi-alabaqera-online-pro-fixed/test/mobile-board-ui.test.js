import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {join} from 'node:path';
const root=process.cwd(),pub=join(root,'public');

test('mobile board stylesheet is shipped and cached', async()=>{
  await access(join(pub,'assets/css/mobile-game.css'));
  const sw=await readFile(join(pub,'service-worker.js'),'utf8');
  assert.match(sw,/busraj-games-v49-release-22-0-0/);
  assert.ok(sw.includes('/assets/css/mobile-game.css'));
});

test('all board games keep a responsive stylesheet and an active-game state',async()=>{for(const [file,cls] of [['snakes.html','game-snakes'],['zahra.html','game-zahra'],['jackaroo.html','game-jackaroo'],['dice.html','game-dice']]){const html=await readFile(join(pub,file),'utf8');assert.match(html,/app-(?:snakes|zahra|jackaroo|dice)\.css/);assert.ok(html.includes(cls));assert.ok(html.includes("document.body.classList.add('game-running')"))}});

test('snakes pieces cannot be clipped during movement', async()=>{
  const html=await readFile(join(pub,'snakes.html'),'utf8');
  const css=await readFile(join(pub,'assets/css/mobile-game.css'),'utf8');
  assert.ok(html.includes("classList.add('occupied-cell')"));
  assert.ok(html.includes('async function animatePawnPath('));
  assert.ok(html.includes('async function animateSnakeEat('));
  assert.ok(html.includes("classList.add('motion-hidden')"));
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

test('snakes has an optional fullscreen board and a scrollable mobile control area',async()=>{const html=await readFile(join(pub,'snakes.html'),'utf8'),css=await readFile(join(pub,'assets/css/pro-games.css'),'utf8');assert.match(html,/requestFullscreen/);assert.match(html,/data-game-fullscreen/);assert.match(css,/#game:fullscreen/);assert.match(css,/@media\(max-width:900px\)/);assert.match(css,/\.game-layout\{grid-template-columns:1fr\}/)});

test('snakes fullscreen keeps unstarted pieces visible without covering the board', async()=>{
  const fullscreenCss=await readFile(join(pub,'assets/css/fullscreen-board.css'),'utf8');
  const snakes=await readFile(join(pub,'snakes.html'),'utf8');
  const boardEnd=snakes.indexOf('</div><div class=\"snake-legend\">');
  const tray=snakes.indexOf('id=\"mobileStartLane\"');
  assert.ok(boardEnd>0 && tray>boardEnd,'start tray is outside the square board');
  assert.match(fullscreenCss,/game-snakes\.game-running \.mobile-start-lane\s*\{[\s\S]*display:\s*flex\s*!important/);
  assert.match(fullscreenCss,/game-snakes\.game-running \.snake-legend \+ div[\s\S]*display:\s*none\s*!important/);
  assert.match(snakes,/busraj:game-layout/);
});
