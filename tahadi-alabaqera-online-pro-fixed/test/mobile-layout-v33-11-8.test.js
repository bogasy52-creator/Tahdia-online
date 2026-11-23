import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDOM} from './dom-harness.mjs';
const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');

async function viewportHarness() {
  const h = await createDOM('ludo.html');
  let rectangle = {width: 374, height: 590}, landscape = false;
  const observed = [], callbacks = [];
  const Observer = class {constructor(callback) {callbacks.push(callback);} observe(el) {observed.push(el);} disconnect() {}};
  Object.assign(h.context, {MutationObserver: Observer, ResizeObserver: Observer,
    getComputedStyle: () => ({rowGap: '8px'}), matchMedia: () => ({matches: landscape})});
  const stage = h.doc.querySelector('.ludo-stage');
  stage.getBoundingClientRect = () => rectangle;
  for (const roster of stage.querySelectorAll('.ludo-plates')) roster.getBoundingClientRect = () => ({height: 64});
  h.doc.body.classList.add('game-running');h.doc.getElementById('game').classList.remove('hidden');
  await h.runFile('assets/js/ludo-viewport-v33-11-8.js');await Promise.resolve();
  return {...h, stage, observed, callbacks,
    resize(width, height, sideways = false) {rectangle = {width, height};landscape = sideways;h.context.dispatchEvent({type: 'resize'});}};
}

test('Ludo fits phone widths and the space left by both player rows, for 2, 4 and 6 seats', async () => {
  const h = await viewportHarness(), compute = h.context.BS_LUDO_VIEWPORT.compute;
  let cases = 0;
  for (const seats of [2,4,6]) for (const width of [320,350,360,375,390,393,414,430,600,768,1024]) {
    for (const height of [568,640,740,844,932,1024]) {
      const w = width - 16, stageHeight = height - 160, roster = seats === 6 ? 62 : 64;
      const size = compute({width:w,height:stageHeight,top:roster,bottom:roster,gap:8});
      assert.ok(size > 0 && size <= w);
      assert.ok(size + 2*roster + 16 <= stageHeight);
      // Centring must leave both edges inside the same available width.
      const left = (w-size)/2;assert.ok(left >= 0 && left+size <= w);cases++;
    }
  }
  assert.equal(cases,198);
  for (const [width,height] of [[568,320],[667,375],[740,360],[844,390],[932,430],[1024,600]]) {
    const w=width-32, remaining=height-110, size=compute({width:w,height:remaining,landscape:true,gap:8});
    const side=Math.min(180,Math.max(100,w*.22));
    assert.ok(size<=remaining && size+side*2+16<=w);
  }
});

test('Ludo resizes after rotation and return without touching the board or room state', async () => {
  const h = await viewportHarness(), board=h.doc.getElementById('board');
  board.innerHTML='<svg data-round="retained"></svg>';const before=board.innerHTML;
  assert.equal(h.stage.style['--ludo-board-size'],'374px');
  h.resize(300,350);await Promise.resolve();assert.equal(h.stage.style['--ludo-board-size'],'206px');
  h.resize(812,240,true);await Promise.resolve();assert.equal(h.stage.style['--ludo-board-size'],'240px');
  assert.ok(h.observed.includes(h.stage));
  h.resize(414,650);await Promise.resolve();h.context.dispatchEvent({type:'pageshow'});await Promise.resolve();
  assert.equal(h.stage.style['--ludo-board-size'],'414px');assert.equal(board.innerHTML,before);
  h.doc.getElementById('game').classList.add('hidden');h.resize(100,100);await Promise.resolve();
  assert.equal(h.stage.style['--ludo-board-size'],'414px');
});

test('the home header has one currency balance and keeps owner/audio controls in the disclosure', async () => {
  const h=await createDOM('index.html'), bar=h.doc.querySelector('.palace-topbar'), more=bar.querySelector('.palace-more');
  assert.equal(bar.querySelectorAll('[data-career-coins]').length,1);
  assert.equal(bar.querySelectorAll('.palace-coin').length,1);
  assert.equal(bar.querySelectorAll('.palace-xp').length,0);
  assert.ok(bar.querySelector('.palace-profile [data-career-xp]'));
  assert.ok(more.contains(bar.querySelector('[data-manager-link]')));
  assert.ok(more.contains(bar.querySelector('[data-audio-toggle]')));
  const balance=bar.querySelector('[data-career-coins]');balance.textContent='1,250,000';
  await h.runFile('assets/js/home-header-v33-11-8.js');
  more.open=true;h.doc.dispatchEvent({type:'keydown',key:'Escape'});
  assert.equal(more.open,false);assert.equal(h.doc.activeElement,more.querySelector('summary'));
  more.open=true;h.doc.dispatchEvent({type:'pointerdown',target:h.doc.body});assert.equal(more.open,false);
  more.open=true;h.doc.dispatchEvent({type:'pointerdown',target:more.querySelector('[data-audio-toggle]')});assert.equal(more.open,true);
  assert.equal(balance.textContent,'1,250,000');
});

test('mobile overrides win the header cascade, and the Ludo width chain can shrink',async()=>{
  const manifest=JSON.parse(await read('scripts/style-bundles.json'));
  assert.equal(manifest['index.html'].at(-1),'assets/css/palace-lobby-v33-11-8.css');
  assert.equal(manifest['ludo.html'].at(-1),'assets/css/ludo-viewport-v33-11-8.css');
  const home=await read('public/assets/css/palace-lobby-v33-11-8.css');
  // Equal selector specificity is essential: the previous phone rule lost to `body.home-palace`.
  assert.match(home,/@media\(max-width:600px\)[\s\S]*?body\.home-palace \.palace-topbar\{grid-template-columns:minmax\(0,1fr\) auto;grid-template-areas:'profile tools' 'wallet wallet'/);
  assert.match(home,/\[data-career-coins\]::before[^{}]*\{content:none!important;display:none!important\}/);
  const ludo=await read('public/assets/css/ludo-viewport-v33-11-8.css');
  assert.match(ludo,/#game\.ludo-arena\{[^}]*min-width:0;grid-template-columns:minmax\(0,1fr\)/);
  assert.match(ludo,/\.ludo-stage\{grid-row:3\}/);assert.match(ludo,/\.ludo-dock\{grid-row:4\}/);
  assert.match(ludo,/\.ludo-plates \.ludo-plate\[hidden\]\{display:none!important\}/);
  const global=await read('public/assets/css/design-system.css');
  assert.match(global,/body \.bs-actions \.coin-chip:before\{[^}]*display:inline-grid!important/);
  assert.match(global,/body \.bs-actions \.coin-chip \[data-career-coins\]::before/);
});
