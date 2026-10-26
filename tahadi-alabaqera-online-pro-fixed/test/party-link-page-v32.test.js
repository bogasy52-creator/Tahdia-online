import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const SOURCE = await readFile(new URL('../public/assets/js/party-link-v32.js', import.meta.url), 'utf8');

// Just enough of a page for the party-link script: inputs, a header, sockets and timers.
function page({ search = '', saved = null, header = 'command', inputs = [{ readOnly: false, maxLength: 20 }] } = {}) {
  const timers = [], nodes = [];
  const element = (tag) => {
    const el = { tagName: tag.toUpperCase(), children: [], attributes: {}, className: '', textContent: '', innerHTML: '', parentNode: null, listeners: {},
      setAttribute(k, v) { this.attributes[k] = String(v); }, getAttribute(k) { return this.attributes[k] ?? null; },
      appendChild(child) { child.parentNode = this; this.children.push(child); nodes.push(child); return child; },
      prepend(child) { child.parentNode = this; this.children.unshift(child); nodes.push(child); },
      remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((c) => c !== this); this.parentNode = null; },
      addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
      querySelector(sel) { if (sel === '.bs-party-nav') return this.children.find((c) => c.className === 'bs-party-nav') || null; if (sel === 'strong') return this._strong ||= { textContent: '' }; if (sel === 'button') return this._button ||= element('button'); return null; },
    };
    return el;
  };
  const fields = inputs.map((o) => ({ value: 'لاعب', ...o }));
  const nav = element('nav'), body = element('body'), head = element('head');
  const command = header === 'command' ? { id: 'bsGameCommand' } : null;
  const document = {
    readyState: 'interactive', head, body, fullscreenElement: null, documentElement: {},
    createElement: element,
    querySelectorAll: (sel) => (sel === 'input[data-account-name]' ? fields : []),
    querySelector: (sel) => (header === 'nav' && sel.includes('.picture-header nav') ? nav : null),
    getElementById: (id) => (id === 'bsGameCommand' ? command : null),
    addEventListener() {},
  };
  const store = new Map(saved ? [['bs_party_link', JSON.stringify(saved)]] : []);
  class NativeSocket {
    constructor(url, protocols) { this.url = String(url); this.protocols = protocols; this.listeners = {}; NativeSocket.made.push(this); }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    emit(data) { for (const fn of this.listeners.message || []) fn({ data }); }
  }
  NativeSocket.made = [];
  NativeSocket.OPEN = 1;
  const location = { search, href: '' };
  const window = { location, WebSocket: NativeSocket, addEventListener() {} };
  const context = {
    window, document, location, URLSearchParams,
    sessionStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    setTimeout: (fn, ms) => { timers.push({ fn, ms, kind: 'timeout' }); return timers.length; },
    setInterval: (fn, ms) => { timers.push({ fn, ms, kind: 'interval' }); return timers.length; },
    clearInterval: (id) => { if (timers[id - 1]) timers[id - 1].cleared = true; },
    Date, JSON, String, Number, Boolean, Object, Error,
  };
  vm.createContext(context);
  vm.runInContext(SOURCE, context);
  return { window, document, fields, nav, body, head, timers, NativeSocket, location, nodes };
}
const SAVED = { party: '111111', room: '222222', game: 'sudoku', round: 'r-1', name: 'نورة الحربي', at: Date.now() };

test('without a party in the address the page is untouched', () => {
  const p = page({ search: '?room=222222' });
  assert.equal(p.window.BS_PARTY_LINK, null);
  assert.equal(p.window.WebSocket, p.NativeSocket, 'sockets are not wrapped');
  assert.equal(p.fields[0].value, 'لاعب');
  assert.equal(p.head.children.length, 0);
});

test('a party round gives the guest the party name and the way back', () => {
  const p = page({ search: '?room=222222&party=111111', saved: SAVED, inputs: [{ readOnly: false, maxLength: 20 }, { readOnly: true, value: 'اسم الحساب', maxLength: 20 }] });
  const link = p.window.BS_PARTY_LINK;
  assert.deepEqual({ ...link }, { party: '111111', room: '222222', back: '/party?room=111111', game: 'sudoku', round: 'r-1', name: 'نورة الحربي' });
  assert.equal(Object.isFrozen(link), true);
  assert.equal(p.fields[0].value, 'نورة الحربي');
  assert.equal(p.fields[1].value, 'اسم الحساب', 'an account keeps its own name');
  assert.equal(p.body.children.length, 0, 'the game bar carries the way back; nothing floats over the page');
});

test('a page with its own header gets a link to the party; a bare page a small button', () => {
  const withNav = page({ search: '?room=222222&party=111111', saved: SAVED, header: 'nav' });
  assert.equal(withNav.nav.children[0].className, 'bs-party-nav');
  assert.equal(withNav.nav.children[0].href, '/party?room=111111');
  const bare = page({ search: '?room=222222&party=111111', saved: SAVED, header: 'none' });
  assert.equal(bare.body.children[0].className, 'bs-party-back');
  assert.equal(bare.body.children[0].href, '/party?room=111111');
});

test('a reload after the game dropped ?party from the address is still the party round', () => {
  const p = page({ search: '?room=222222', saved: SAVED });
  assert.equal(p.window.BS_PARTY_LINK.party, '111111');
  const other = page({ search: '?room=333333', saved: SAVED });
  assert.equal(other.window.BS_PARTY_LINK, null, 'another room is not the party round');
  const stale = page({ search: '?room=222222', saved: { ...SAVED, at: Date.now() - 7 * 3600000 } });
  assert.equal(stale.window.BS_PARTY_LINK, null);
  const unknown = page({ search: '?room=222222&party=111111', saved: null });
  assert.equal(unknown.window.BS_PARTY_LINK.name, '', 'no saved name: the page keeps its own');
});

test('when the room says the match is finished, the page offers the return and goes back by itself', () => {
  const p = page({ search: '?room=222222&party=111111', saved: SAVED });
  const Socket = p.window.WebSocket;
  assert.notEqual(Socket, p.NativeSocket);
  const game = new Socket('wss://x/api/sudoku/rooms/222222/ws?name=a', ['v1']);
  const social = new Socket('wss://x/api/social/ws');
  assert.equal(game instanceof p.NativeSocket, true, 'the game keeps a real socket');
  assert.deepEqual(game.protocols, ['v1']);
  assert.equal(social.listeners.message, undefined, 'other sockets are not watched');
  game.emit(JSON.stringify({ type: 'state', state: { status: 'playing' } }));
  game.emit(new ArrayBuffer(4));
  assert.equal(p.timers.length, 0);
  game.emit(JSON.stringify({ type: 'state', state: { status: 'finished' } }));
  game.emit(JSON.stringify({ type: 'state', state: { status: 'finished' } }));
  const offer = p.timers.filter((t) => t.kind === 'timeout');
  assert.equal(offer.length, 1, 'offered once');
  assert.equal(offer[0].ms, 3500, 'the game shows its own result first');
  offer[0].fn();
  const sheet = p.body.children.find((c) => c.className === 'bs-party-return');
  assert.ok(sheet);
  assert.match(sheet.innerHTML, /انتهت جولة الجمعة/);
  assert.match(sheet.innerHTML, /href="\/party\?room=111111"/);
  const tick = p.timers.find((t) => t.kind === 'interval');
  for (let i = 0; i < 14; i++) tick.fn();
  assert.equal(p.location.href, '');
  tick.fn();
  assert.equal(p.location.href, '/party?room=111111');
});

test('staying on the game page cancels the automatic return', () => {
  const p = page({ search: '?room=222222&party=111111', saved: SAVED });
  const game = new p.window.WebSocket('wss://x/api/rooms/222222/ws');
  game.emit(JSON.stringify({ type: 'welcome', state: { status: 'finished' } }));
  p.timers.find((t) => t.kind === 'timeout').fn();
  const sheet = p.body.children.find((c) => c.className === 'bs-party-return');
  sheet.querySelector('button').listeners.click[0]();
  assert.equal(p.timers.find((t) => t.kind === 'interval').cleared, true);
  assert.equal(p.body.children.includes(sheet), false);
});
