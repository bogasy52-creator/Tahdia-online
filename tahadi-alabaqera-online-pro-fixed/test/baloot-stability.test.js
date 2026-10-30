import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createDOM} from './dom-harness.mjs';

const cards = ['7S','8S','9S','TS','AH','KD','QC','JC'];
async function table() {
  const calls = [];
  const h = await createDOM('baloot.html', {
    getComputedStyle: () => ({getPropertyValue: () => '92'}),
    BS_CARDS: {url: card => '/cards/' + card},
    BalootVoice: {stop: () => calls.push('stop'), finish: () => calls.push('finish'),
      say: text => {calls.push(text); return true;}}
  });
  const source = await readFile(new URL('../public/assets/js/baloot-table.js', import.meta.url), 'utf8');
  vm.runInContext(source.replace(/import[\s\S]*?from\s*['"][^'"]+['"];?/g, '').replace(/\ninit\(\);\s*$/, ''), h.context);
  const run = code => vm.runInContext(code, h.context);
  h.context.fixture = {phase:'playing', turn:1, open:true, handNo:1, hands:[cards.slice(),[],[],[]], tricks:[]};
  run('ui.me=0; ui.view=fixture;');
  return {...h, calls, run, hand:h.doc.getElementById('hand')};
}
const positions = hand => new Map(hand.children.map(el => [el.dataset.card, {node:el, left:el.style.left, fan:el.style['--fan'], z:el.style.zIndex}]));
function unchanged(before, hand) {
  for (const el of hand.children) {
    const old = before.get(el.dataset.card);
    assert.equal(el, old.node, 'keep the same card node');
    assert.equal(el.style.left, old.left, el.dataset.card + ' keeps its slot');
    assert.equal(el.style['--fan'], old.fan, el.dataset.card + ' keeps its rotation');
    assert.equal(el.style.zIndex, old.z, el.dataset.card + ' keeps its stacking');
  }
}
test('first, middle and last Baloot cards leave without moving the remaining cards', async () => {
  const h = await table(); h.run('renderHand(fixture)'); const before = positions(h.hand);
  for (const card of [cards[0], cards[4], cards[7]]) {
    h.context.playedCard = card;
    await h.run('animatePlay(0,playedCard)');
    unchanged(before, h.hand);
    h.context.fixture.hands[0] = h.context.fixture.hands[0].filter(c => c !== card);
    h.run('renderHand(fixture)'); unchanged(before, h.hand);
  }
  // Repeated/resorted authoritative snapshots cannot reorder a dealt hand.
  h.context.fixture.hands[0].reverse(); h.run('renderHand(fixture)'); unchanged(before, h.hand);
});
test('a new Baloot deal releases empty slots, and a completed deal lays out all eight cards', async () => {
  const h = await table(); h.run('renderHand(fixture)');
  h.context.fixture.hands[0] = cards.slice(0, 5); h.context.fixture.handNo = 2;
  h.run('renderHand(fixture)');
  const short = positions(h.hand); assert.equal(short.size, 5);
  h.context.fixture.hands[0] = cards.slice(); h.run('renderHand(fixture)');
  assert.equal(new Set(h.hand.children.map(el => el.style.left)).size, 8);
  const full = positions(h.hand);
  h.context.fixture.hands[0] = cards.slice(1); h.run('renderHand(fixture)'); unchanged(full, h.hand);
});
test('a redraw during a confirmed play animation cannot bring the played card back', async () => {
  const h=await table();h.run('renderHand(fixture)');
  await h.run("animatePlay(0,'AH')");
  h.run('renderHand(fixture)');
  assert.equal(h.hand.children.some(el=>el.dataset.card==='AH'),false);
});
test('a scored server snapshot does not silence the still-visible preceding turn', async () => {
  const h = await table();
  h.doc.getElementById('table').hidden = false;
  h.run("ui.matchStart=10; ui.pending=new Promise(()=>{}); window.BS_GAME_MENU={remember(){}};");
  h.context.roomFixture = {code:'601234', startedAt:10, status:'playing', me:{index:0}, state:{...h.context.fixture, phase:'scored'}};
  h.run('onRoomState(roomFixture)');
  assert.deepEqual(h.calls, []);
  assert.equal(h.run("speak('claim',0)"), true, 'the displayed final call remains audible');
});
test('finishing a Baloot hand lets the active full recording finish', async () => {
  const h = await table(); h.run('endHandAudio()');
  assert.deepEqual(h.calls, ['finish']);
  assert.equal(h.run("speak('pass',0)"), false, 'no later chatter from the closed hand');
});
