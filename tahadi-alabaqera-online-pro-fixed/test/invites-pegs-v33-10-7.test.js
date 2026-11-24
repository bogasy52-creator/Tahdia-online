// 33.10.7: invitations that "didn't show" and screenshots in شطرنج الذاكرة.
// 1. The newer table games (tanks, hockey, billiards, carrom, pegs, jewels) sent invitations the
//    phone dropped: their pages were missing from the list of pages an invitation may open.
// 2. An invitation showed once, at the bottom of the screen, and was gone for good. Now every
//    pending invitation and friend request waits in a red inbox on the home page, with a red count
//    on the friends button (and on the home button of the game pages), until it's answered or expires.
// 3. The memory chess board covers its colours whenever the page leaves the screen, loses focus or a
//    desktop screenshot key is pressed. A phone's own screenshot can't be stopped from a web page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

// a small DOM: enough for the inbox, the badge and the invitation card
function dom() {
  const byId = new Map();
  class Node {
    constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = null; this.attrs = new Map(); this.dataset = {}; this.hidden = false; this.textContent = ''; this.listeners = {}; this.classList = { add() {}, remove() {}, toggle() {} }; }
    set id(v) { this._id = v; byId.set(v, this); } get id() { return this._id; }
    append(...nodes) { for (const n of nodes) { if (typeof n === 'string') { const t = new Node('#text'); t.textContent = n; this.children.push(t); continue; } this.children.push(n); n.parentElement = this; } }
    appendChild(n) { this.append(n); return n; }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((c) => c !== this); if (this._id) byId.delete(this._id); }
    setAttribute(k, v) { this.attrs.set(k, String(v)); } getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; } removeAttribute(k) { this.attrs.delete(k); }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    querySelector(q) { if (q === ':scope > .bs-invite-badge') return this.children.find((c) => c.className === 'bs-invite-badge') || null; return null; }
    querySelectorAll() { return []; }
    get text() { return this.textContent + this.children.map((c) => c.text).join(''); }
    set innerHTML(_) { this.children = []; }
    all() { return [this, ...this.children.flatMap((c) => c.all())]; }
  }
  const body = new Node('body'), head = new Node('head');
  const friends = new Node('a'); friends.setAttribute('aria-label', 'حسابك وأصدقاؤك');
  const list = new Node('section'); list.hidden = true;
  const document = {
    body, head, hidden: false, readyState: 'complete', createElement: (t) => new Node(t), createTextNode: (t) => { const n = new Node('#text'); n.textContent = t; return n; },
    getElementById: (id) => byId.get(id) || null,
    querySelector: (q) => (q.startsWith('#') ? byId.get(q.slice(1)) || null : null),
    querySelectorAll: (q) => (q === '[data-invite-list]' ? [list] : q.includes('[data-social-open]') ? [friends] : []),
    addEventListener() {}
  };
  return { document, byId, friends, list, Node };
}

async function phone(dashboard, { now = Date.now() } = {}) {
  const source = await read('public/assets/js/social-client.js');
  const cache = new Map([['bs_social_session', 'bob_2.secret'], ['bs_social_profile', JSON.stringify({ username: 'bob_2', displayName: 'بوب' })]]);
  const { document, byId, friends, list } = dom(), sent = [];
  const localStorage = { getItem: (k) => cache.get(k) || null, setItem: (k, v) => cache.set(k, v), removeItem: (k) => cache.delete(k) };
  const fetch = async (path, init = {}) => { sent.push({ path, body: init.body ? JSON.parse(init.body) : null }); return { ok: true, status: 200, json: async () => ({ ok: true, profile: { username: 'bob_2', displayName: 'بوب' }, incoming: [], ...dashboard }) }; };
  const window = { addEventListener() {}, dispatchEvent() {} };
  class CE extends Event { constructor(name, options) { super(name); this.detail = options?.detail; } }
  const clock = { now: () => now };
  runInNewContext(source, { window, document, localStorage, Headers, fetch, EventTarget, CustomEvent: CE, console, location: { protocol: 'https:', host: 'game.test', pathname: '/', search: '' }, setTimeout: () => 1, setInterval: () => 1, clearTimeout() {}, clearInterval() {}, Date: class extends Date { static now() { return clock.now(); } }, JSON, Number, Error, Promise });
  await new Promise((resolve) => setTimeout(resolve, 30));
  const badge = friends.children.find((c) => c.className === 'bs-invite-badge');
  return { card: byId.get('bsSocialInvite'), sent, friends, list, badge, social: window.BS_SOCIAL };
}
const invite = (game, joinPath, extra = {}) => ({ id: 'inv-' + game, type: 'game_invite', game, roomCode: (joinPath.match(/room=(\d{6})/) || [])[1] || '', joinPath, createdAt: Date.now(), expiresAt: Date.now() + 60000, read: false, from: { displayName: 'أليس' }, ...extra });

for (const [game, path, label] of [['tanks', '/tanks?room=451234', 'معركة الدبابات'], ['hockey', '/hockey?room=461234', 'الهوكي'], ['billiards', '/billiards?room=471234', 'البلياردو'], ['carrom', '/carrom?room=481234', 'الكيرم'], ['pegs', '/pegs?room=491234', 'سر الألوان'], ['jewels', '/jewels?room=501234', 'ماستر الجواهر']]) {
  test('the phone shows an invitation to ' + game, async () => {
    const { card, badge, list } = await phone({ notifications: [invite(game, path)] });
    assert.ok(card, game);
    assert.match(card.text, new RegExp(label));
    assert.equal(badge?.textContent, '1');
    assert.equal(badge.hidden, false);
    assert.equal(list.hidden, false);
  });
}

test('the home inbox lists every pending invitation and friend request, with a red count', async () => {
  const past = Date.now() - 1000;
  const { list, badge, friends, social } = await phone({
    notifications: [invite('tanks', '/tanks'), invite('pegs', '/pegs?room=491234'), invite('dice', '/dice?room=111111', { read: true }), invite('snakes', '/snakes?room=222222', { expiresAt: past }), invite('admin', '/admin')],
    incoming: [{ username: 'saad_1', displayName: 'سعد' }]
  });
  assert.equal(badge.textContent, '3', 'two open invitations and one friend request');
  assert.match(friends.getAttribute('aria-label'), /عندك 3 دعوات/);
  const rows = list.children.filter((c) => c.className === 'bs-invite-row');
  assert.equal(rows.length, 3);
  assert.match(list.children[0].text, /^3عندك دعوات$/);
  assert.match(rows.map((r) => r.text).join('|'), /معركة الدبابات/);
  assert.match(rows.map((r) => r.text).join('|'), /سعد يبي يصير صديقك/);
  assert.equal(social.invites().length, 2);
});

test('«لاحقًا» puts the card away and keeps the invitation; «تجاهل» clears it', async () => {
  const { card, sent, badge, list } = await phone({ notifications: [invite('tanks', '/tanks?room=451234')] });
  const later = card.all().find((n) => n.textContent === 'لاحقًا');
  later.onclick();
  assert.equal(sent.some((s) => s.path === '/api/social/notifications/read'), false);
  assert.equal(badge.textContent, '1');
  const ignore = list.all().find((n) => n.textContent === 'تجاهل');
  ignore.onclick();
  assert.ok(sent.some((s) => s.path === '/api/social/notifications/read' && s.body.ids[0] === 'inv-tanks'));
  assert.equal(badge.hidden, true);
  assert.equal(list.hidden, true);
});

test('the home page has the inbox right under the header, and the card sits at the top in red', async () => {
  const home = await read('public/index.html');
  assert.match(home, /<\/header><p class="store-news hidden" data-career-news role="status"><\/p>\n<section class="bs-invite-inbox" data-invite-list hidden aria-live="polite" aria-label="دعواتك"><\/section>/);
  const client = await read('public/assets/js/social-client.js');
  assert.match(client, /#bsSocialInvite\.bs-social-invite-card\{top:calc\(10px \+ env\(safe-area-inset-top\)\)!important;bottom:auto!important/);
  assert.match(client, /border:2px solid #ef4444!important/);
  assert.match(client, /\.bs-invite-badge\{[^}]*background:#ef4444/);
  const compact = await read('public/assets/js/compact/social-client.js');
  assert.match(compact, /bs-invite-inbox/);
});

test('سر الألوان (formerly شطرنج الذاكرة) covers its colours when the page loses focus or a screenshot key is pressed', async (t) => {
  const { document: doc, Node } = dom();
  const listeners = { doc: {}, win: {} };
  doc.documentElement = { classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); }, contains(c) { return this.set.has(c); } } };
  doc.addEventListener = (type, fn) => { (listeners.doc[type] ||= []).push(fn); };
  doc.removeEventListener = () => {};
  const timers = [];
  const env = { document: doc, window: { addEventListener: (type, fn) => { (listeners.win[type] ||= []).push(fn); }, removeEventListener() {} }, navigator: { clipboard: { writeText: async (v) => { env.clip = v; } } }, getComputedStyle: () => ({ position: 'relative' }), setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout() {} };
  for (const [k, v] of Object.entries(env)) { const old = globalThis[k]; Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); t.after(() => Object.defineProperty(globalThis, k, { value: old, configurable: true, writable: true })); }
  const stage = new Node('div'); stage.style = {}; stage.classList = { add() {}, remove() {} };
  const toasts = [];
  const { guardPegs } = await import('../public/assets/js/pegs/guard.js?test=1');
  guardPegs(stage, { toast: (m) => toasts.push(m) });
  const shield = stage.children.find((c) => c.className === 'pegs-shield');
  assert.ok(shield);
  assert.equal(shield.hidden, true);
  const fire = (where, type, event = {}) => (listeners[where][type] || []).forEach((fn) => fn({ preventDefault() {}, ...event }));
  fire('win', 'blur');
  assert.equal(shield.hidden, false, 'leaving the page covers the board');
  assert.ok(doc.documentElement.classList.contains('pegs-covered'));
  fire('win', 'focus'); timers.splice(0).forEach((fn) => fn());
  assert.equal(shield.hidden, true, 'back on the page, the board shows again');
  fire('doc', 'keyup', { key: 'PrintScreen', code: 'PrintScreen' });
  assert.equal(shield.hidden, false);
  assert.equal(env.clip, undefined, 'Privacy cover leaves the existing clipboard unchanged');
  assert.deepEqual(toasts, ['التصوير ممنوع في سر الألوان']);
  timers.splice(0).forEach((fn) => fn());
  fire('doc', 'keydown', { key: 'Shift', metaKey: true, shiftKey: true });
  timers.splice(0).forEach((fn) => fn());
  assert.equal(shield.hidden, false, 'while ⌘⇧ is held the board stays covered');
  fire('doc', 'keyup', { key: 'Meta' }); timers.splice(0).forEach((fn) => fn());
  assert.equal(shield.hidden, true);
  const main = await read('public/assets/js/pegs/main.js');
  assert.match(main, /import \{ guardPegs \} from '\.\/guard\.js\?v=[^']+';/);
  assert.match(main, /guardPegs\(stageEl,/);
  assert.match(main, /التصوير ممنوع/);
});
