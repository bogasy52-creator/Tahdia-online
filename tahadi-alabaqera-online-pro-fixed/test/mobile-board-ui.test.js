import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {join} from 'node:path';
const root=process.cwd(),pub=join(root,'public');

test('mobile board stylesheet is shipped and cached', async()=>{
  await access(join(pub,'assets/css/mobile-game.css'));
  const sw=await readFile(join(pub,'service-worker.js'),'utf8');
  assert.match(sw,/busraj-games-v16/);
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

test('snakes and zahra use the dedicated viewport-filling stage with measured board fitting', async()=>{
  const fullscreenCss=await readFile(join(pub,'assets/css/fullscreen-board.css'),'utf8');
  const fullscreenJs=await readFile(join(pub,'assets/js/fullscreen-game.js'),'utf8');
  const snakes=await readFile(join(pub,'snakes.html'),'utf8');
  const zahra=await readFile(join(pub,'zahra.html'),'utf8');
  assert.match(fullscreenCss,/body\.game-snakes\.game-running[\s\S]*--game-vh:\s*100dvh/);
  assert.match(fullscreenCss,/body\.game-zahra\.game-running[\s\S]*height:\s*var\(--game-vh\)/);
  assert.match(fullscreenCss,/grid-template-columns:\s*minmax\(0,1fr\)\s+var\(--game-dock-width\)/);
  assert.match(fullscreenCss,/width:\s*var\(--game-board-size\)\s*!important/);
  assert.match(fullscreenCss,/@media \(max-height: 560px\) and \(orientation: landscape\)/);
  assert.match(fullscreenJs,/requestFullscreen|webkitRequestFullscreen/);
  assert.match(fullscreenJs,/visualViewport/);
  assert.match(fullscreenJs,/ResizeObserver/);
  assert.match(fullscreenJs,/MutationObserver/);
  assert.match(fullscreenJs,/busraj:game-layout/);
  assert.match(fullscreenJs,/Math\.min\(rect\.width, rect\.height\)/);
  for(const html of [snakes,zahra]){
    assert.match(html,/assets\/css\/fullscreen-board\.css/);
    assert.match(html,/assets\/js\/fullscreen-game\.js/);
    assert.match(html,/data-game-fullscreen/);
    assert.match(html,/BS_GAME_FULLSCREEN\?\.fit/);
  }
});

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

