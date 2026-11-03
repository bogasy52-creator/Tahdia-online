// 33.7.0: «ساعة الغرفة» — one clear countdown for every room, the tension of the last seconds,
// «قرب يفوز» for everybody else, and a call when the turn becomes yours.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

// a small page: enough of the DOM for the clock, with a hand on the timer
function page() {
  const watchers = [];
  class Node {
    constructor(tag) { this.tagName = tag; this.children = []; this.parent = null; this.dataset = {}; this.attrs = {}; this.className = ''; this.textContent = ''; this.rendered = true; this.top = 100;
      const props = {}; this.style = { setProperty: (k, v) => { props[k] = String(v); }, getPropertyValue: (k) => props[k] || '' };
      const self = this; this.classList = { add: (...c) => { const set = new Set(self.className.split(' ').filter(Boolean)); c.forEach((x) => set.add(x)); self.className = [...set].join(' '); }, remove: (...c) => { self.className = self.className.split(' ').filter((x) => x && !c.includes(x)).join(' '); }, toggle: (c, on) => { if (on === undefined) on = !self.classList.contains(c); on ? self.classList.add(c) : self.classList.remove(c); return on; }, contains: (c) => self.className.split(' ').includes(c) }; }
    get firstChild() { return this.children[0] || null; }
    get isConnected() { let n = this; while (n.parent) n = n.parent; return n === doc.documentElement; }
    get offsetWidth() { return 1; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k] ?? null; }
    append(...nodes) { for (const n of nodes) { n.remove?.(); n.parent = this; this.children.push(n); } this.changed(); }
    prepend(...nodes) { for (const n of nodes.reverse()) { n.remove?.(); n.parent = this; this.children.unshift(n); } this.changed(); }
    remove() { if (!this.parent) return; const p = this.parent; p.children = p.children.filter((x) => x !== this); this.parent = null; p.changed(); }
    replaceText(text) { for (const c of [...this.children]) { c.parent = null; } this.children = []; this.textContent = text; this.changed(); }
    changed() { for (const w of watchers) if (w.node === this) queueMicrotask(() => w.fn()); }
    getClientRects() { return this.isConnected && this.rendered ? [1] : []; }
    getBoundingClientRect() { return { width: 40, top: this.top, bottom: this.top + 40 }; }
  }
  const doc = { documentElement: new Node('html'), hidden: false, title: 'جاكارو', listeners: {}, createElement: (t) => new Node(t), addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); } };
  doc.body = new Node('body'); doc.documentElement.append(doc.body);
  let intervals = [], now = 1_000_000;
  const sounds = [];
  const context = {
    document: doc, Date: { now: () => now }, innerHeight: 800,
    setInterval: (fn) => { intervals.push(fn); return intervals.length; }, clearInterval: (id) => { intervals[id - 1] = null; },
    setTimeout: () => 0, clearTimeout: () => {}, queueMicrotask,
    MutationObserver: class { constructor(fn) { this.fn = fn; } observe(node) { watchers.push({ node, fn: this.fn }); } disconnect() {} },
  };
  context.window = context;
  context.BS_AUDIO = { getSettings: () => ({ muted: false, effects: true, timer: true }), timerTick: (s) => sounds.push('tick' + s), timerEnd: () => sounds.push('end'), tone: (f) => sounds.push('tone' + f), vibrate: () => sounds.push('buzz'), unlock: () => {} };
  vm.createContext(context);
  return { context, doc, sounds, Node, advance(ms) { const end = now + ms; while (now < end) { now += 200; for (const f of intervals) f?.(); } }, get now() { return now; } };
}

test('the clock: big seconds in a ring, amber then red, ticks for the last five seconds of your own turn', async () => {
  const p = page();
  vm.runInContext(await read('public/assets/js/room-clock-v33-7.js'), p.context);
  const host = p.doc.createElement('div'); p.doc.body.append(host);
  const clock = p.context.BS_CLOCK.attach(host);
  clock.set({ end: p.now + 9000, total: 35000, mine: true, key: 't1', label: 'دورك' });
  const ring = host.firstChild;
  assert.equal(ring.className, 'bs-clock'); assert.equal(ring.dataset.s, '9'); assert.ok(host.classList.contains('bs-clock-on'));
  assert.equal(ring.dataset.tone, 'warn', 'nine seconds left');
  assert.ok(p.sounds.includes('tone523'), 'a call when the turn becomes yours');
  // the page rewrites its turn line: the clock comes back to its place
  host.replaceText('دورك — ارم الزهرة'); await Promise.resolve(); await Promise.resolve();
  assert.equal(host.firstChild, ring);
  p.advance(5000);
  assert.equal(ring.dataset.s, '4'); assert.equal(ring.dataset.tone, 'danger');
  assert.deepEqual(p.sounds.filter((s) => s.startsWith('tick')), ['tick5', 'tick4']);
  assert.ok(p.doc.body.children.some((n) => n.className.includes('bs-tension-edge') && n.className.includes('on')), 'the red edge of the last seconds');
  p.advance(5000);
  assert.equal(ring.dataset.tone, 'out'); assert.ok(p.sounds.includes('end'));
  assert.deepEqual(p.sounds.filter((s) => s.startsWith('tick')), ['tick5', 'tick4', 'tick3', 'tick2', 'tick1']);
  clock.clear(); assert.equal(host.children.length, 0); assert.ok(!host.classList.contains('bs-clock-on'));
});

test('another player\'s turn is counted in silence; a round clock is everybody\'s', async () => {
  const p = page();
  vm.runInContext(await read('public/assets/js/room-clock-v33-7.js'), p.context);
  const a = p.doc.createElement('div'), b = p.doc.createElement('div'); p.doc.body.append(a, b);
  p.context.BS_CLOCK.attach(a).set({ end: p.now + 6000, total: 35000, mine: false, key: 'x' });
  p.advance(4000);
  assert.equal(p.sounds.length, 0);
  p.context.BS_CLOCK.attach(b).set({ end: p.now + 4100, total: 75000, shared: true, key: 'round' });
  p.advance(1000);
  assert.ok(p.sounds.some((s) => s.startsWith('tick')));
  assert.ok(!p.sounds.includes('end'));
});

test('out of sight, the clock floats at the top of the screen', async () => {
  const p = page();
  vm.runInContext(await read('public/assets/js/room-clock-v33-7.js'), p.context);
  const host = p.doc.createElement('div'); p.doc.body.append(host);
  p.context.BS_CLOCK.attach(host).set({ end: p.now + 30000, total: 60000, shared: true, key: 'r', label: 'الجولة 2 من 3' });
  const float = p.doc.body.children.find((n) => n.className.startsWith('bs-clock-float'));
  assert.ok(!float.className.includes('show'));
  host.firstChild.top = -300; p.advance(400);
  assert.ok(float.className.includes('show'));
  assert.equal(float.children[0].dataset.s, host.firstChild.dataset.s);
  assert.equal(float.children[1].textContent, 'الجولة 2 من 3');
  host.rendered = false; p.advance(400);
  assert.ok(!float.className.includes('show'), 'a hidden room does not float its clock');
});

test('«قرب يفوز»: once per player and match, a heartbeat for the others, a gold note for the player', async () => {
  const p = page();
  vm.runInContext(await read('public/assets/js/room-clock-v33-7.js'), p.context);
  assert.equal(p.context.BS_CLOCK.alert('m1:seat2', 'نورة باقي لها حجر واحد ويفوز!'), true);
  const banner = p.doc.body.children.find((n) => n.className.startsWith('bs-alert-banner'));
  assert.equal(banner.textContent, 'نورة باقي لها حجر واحد ويفوز!'); assert.equal(banner.dataset.tone, 'rival');
  assert.ok(p.sounds.includes('tone66'), 'a heartbeat'); assert.ok(p.sounds.includes('buzz'));
  assert.equal(p.context.BS_CLOCK.alert('m1:seat2', 'again'), false, 'once is enough');
  p.sounds.length = 0;
  p.context.BS_CLOCK.alert('m1:seat0', 'قربت تفوز!', { tone: 'mine' });
  assert.equal(banner.dataset.tone, 'mine'); assert.ok(p.sounds.includes('tone660') && !p.sounds.includes('tone66'));
});

test('every room has the clock and the player card: board tables, Baloot, the challenges and the party', async () => {
  const bundles = JSON.parse(await read('scripts/style-bundles.json')), styles = await read('scripts/build-styles.mjs');
  for (const page of ['snakes', 'zahra', 'jackaroo', 'dice', 'baloot', 'focus', 'cipher', 'wordbomb', 'chaos', 'reaction', 'party']) {
    const html = await read('public/' + page + '.html');
    assert.match(html, /<script src="assets\/js\/room-clock-v33-7\.js\?v=[0-9.]+"><\/script><script src="assets\/js\/player-card-v33-7\.js\?v=[0-9.]+"><\/script>/, page);
    for (const css of ['assets/css/room-clock-v33-7.css', 'assets/css/player-card-v33-7.css']) assert.ok(bundles[page + '.html'].includes(css), page + ' ' + css);
  }
  assert.match(styles, /'assets\/css\/room-clock-v33-7\.css','assets\/css\/player-card-v33-7\.css'/);
  const table = await read('public/assets/js/board-table-v33.js');
  assert.match(table, /const clock=window\.BS_CLOCK\?\.attach\(\$\('#status'\)\);/);
  assert.match(table, /clock\.set\(\{end:Number\(next\.turnDeadline\),total:Number\(next\.turnTotal\)\|\|0,/);
  assert.match(table, /window\.BS_PLAYER_CARD\.open\(\{name:p\.name,username:p\.username,/);
  assert.match(await read('public/assets/js/baloot-table.js'), /const clock = ui\.clock \|\| \(ui\.clock = window\.BS_CLOCK\?\.attach\(\$\('prompt'\)\)\);/);
  const ch = await read('public/assets/js/challenge-client.js');
  assert.match(ch, /c\.set\(\{end,total,clock:now,shared:true,/);
  assert.match(ch, /function nearWin\(m\)\{/);
  assert.match(await read('public/assets/js/party-v29.js'), /function partyClock\(end\)\{/);
  // the small «⏱ 30ث» steps aside when the room clock is on
  assert.match(await read('public/assets/css/room-clock-v33-7.css'), /body:has\(#status\.bs-clock-on\) #turnTimer\{display:none!important\}/);
  // the offline core does not carry any of it
  assert.doesNotMatch(await read('public/service-worker.js'), /APP_SHELL = \[[^\]]*room-clock/);
});
