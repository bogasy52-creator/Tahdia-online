import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
const root=process.cwd(), pub=join(root,'public');
const read=(p)=>readFile(join(root,p),'utf8');

test('the snake is the only current user-facing name and legacy race labels are gone', async()=>{
  const files=['public/index.html','public/snakes.html','public/social.html','public/manifest.webmanifest','public/assets/js/social-client.js','src/rooms/board-game-room.js','README-AR.md'];
  const text=(await Promise.all(files.map(read))).join('\n');
  assert.match(text,/الثعبان/);
  assert.doesNotMatch(text,/سباق\s*(?:الـ)?100|السلم\s*والثعبان/);
});

test('snake animation uses one floating pawn and a creature attack/eat/drop sequence', async()=>{
  const html=await read('public/snakes.html');
  const css=await read('public/assets/css/snakes-premium.css');
  for(const marker of ['makeTravelPawn(','animatePawnPath(','animateSnakeEat(',"classList.add('motion-hidden')",'.snake-creature[data-from=']) assert.ok(html.includes(marker),`missing ${marker}`);
  for(const marker of ['.snake-travel-pawn','.motion-hidden','.snake-creature.attacking','.snake-creature.digesting','@keyframes snakeLunge','@keyframes snakeDigest']) assert.ok(css.includes(marker),`missing ${marker}`);
});

test('mobile snake stage is edge-to-edge and keeps the cockpit directly under the board', async()=>{
  const css=await read('public/assets/css/fullscreen-board.css');
  assert.match(css,/Busraj 3\.2 final mobile cockpit/);
  assert.match(css,/body\.game-snakes\.game-running \.game-layout,[\s\S]*grid-template-rows:auto auto!important/);
  assert.match(css,/body\.game-snakes\.game-running \.snake-board-wrap \{[\s\S]*width:100vw!important;[\s\S]*height:100vw!important/);
  assert.match(css,/body\.game-snakes\.game-running \.snake-side \{[\s\S]*grid-template-areas:'players players players' 'status status status' 'start dice roll'!important/);
  assert.match(css,/body\.game-snakes\.game-running \.snake-side,[\s\S]*height:auto!important;[\s\S]*margin:0!important/);
});

test('zahra and jackaroo ship dedicated 3.2 art-direction layers', async()=>{
  const zahra=await read('public/zahra.html'), jack=await read('public/jackaroo.html');
  const zcss=await read('public/assets/css/zahra-premium.css'), jcss=await read('public/assets/css/jackaroo-next.css');
  assert.match(zahra,/assets\/css\/zahra-premium\.css/);
  assert.match(jack,/assets\/css\/jackaroo-next\.css/);
  assert.match(zcss,/Busraj 3\.2/); assert.match(jcss,/Busraj 3\.2/);
  assert.match(zcss,/game-zahra/); assert.match(jcss,/game-jackaroo/);
});

test('genius question-selection board is a compact category-card grid with no score or point overlap', async()=>{
  const local=await read('public/local.html'), online=await read('public/online.html'), css=await read('public/assets/css/quiz-board-v2.css');
  assert.match(local,/assets\/css\/quiz-board-v2\.css/); assert.match(online,/assets\/css\/quiz-board-v2\.css/);
  assert.match(css,/#game \.gameTop\{position:relative!important;top:auto!important;inset:auto!important/);
  assert.match(css,/#game \.boardWrap\{[\s\S]*overflow:visible!important/);
  assert.match(css,/#game \.board\{[\s\S]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.match(css,/#game \.pointPair\{[\s\S]*grid-template-columns:1fr 1fr!important/);
  assert.match(css,/@media\(max-width:760px\)\{[\s\S]*#game \.board\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(local,/سؤال \$\{q===deck\[i\*2\]\?'أ':'ب'\}/);
});

test('3.2 PWA cache includes every new presentation layer', async()=>{
  const sw=await read('public/service-worker.js');
  assert.match(sw,/busraj-games-v20/);
  for(const asset of ['/assets/css/snakes-premium.css','/assets/css/zahra-premium.css','/assets/css/jackaroo-next.css','/assets/css/quiz-board-v2.css']) assert.ok(sw.includes(asset),`missing ${asset}`);
});
