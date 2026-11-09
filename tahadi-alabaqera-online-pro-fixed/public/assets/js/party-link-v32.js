/* Tahdia 32.1.0 — a group-games round played in the real game.
   Loaded first on every game page a party can open. With ?party=CODE in the
   address it keeps the way back to the party in reach, hands a guest the same
   name they carry in the party (that is how their result finds them), and when
   the match ends offers the return with a short countdown. Without ?party it
   does nothing at all.
   33.9.1: inside the group room (embedded=1, in its frame) every game is shown as
   itself: the page leaves its own way around to the group room, tells the room when
   its game is live, and a game with no online room (local=1) plays the same board as
   everyone and sends its result to the room. */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const framed = params.get('embedded') === '1' && window.parent !== window;
  const clean = (value) => String(value || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  const say = (type, data) => { try { window.parent.postMessage({ type, ...data }, location.origin); } catch {} };
  // A guest plays under the party name; an account keeps its own name (social-client locks it).
  const fillName = (name) => {
    if (!name) return;
    document.querySelectorAll('input[data-account-name]').forEach((input) => {
      if (!input.readOnly) input.value = name.slice(0, input.maxLength > 0 ? input.maxLength : 24);
    });
  };
  // Inside the group room the page keeps its game and drops its own way around.
  function embed(seat) {
    document.documentElement.classList.add('party-embedded');
    if (seat) document.documentElement.classList.add('party-embedded-seat');
    const css = document.createElement('style');
    css.textContent =
      '.party-embedded body{min-height:0}' +
      '.party-embedded-seat body{background:transparent}' +
      '.party-embedded :is(#bsGameCommand,.bs-party-back,.bs-party-return,.bs-party-nav){display:none!important}' +
      // the way out of a game is the group room itself, and the site's own header stays out
      '.party-embedded :is(#leaveGame,#soLeave,#pathLeave,#pathCopy,#arenaExit,#arenaLeaveLobby,#arenaPauseExit,#arenaResultExit,.gm33-leave,.bs-topbar,.paths-header,.arcade-info){display:none!important}' +
      '.party-embedded body.picture-page:not(.sudoku-page) #leave{display:none!important}' +
      ':is(html,#v31).party-embedded body #game#game#game#game #leaveGame{display:none!important}' +
      '.party-embedded body.quiz-v19 :is(.top,#roomHeader,.footer){display:none!important}' +
      '.party-embedded body.quiz-v19 #lobby :is(.roomHead,#cats,#modePicker,#relayOnlineSetting,#hostActions,#startWrap){display:none!important}' +
      // a round on a game's own page plays the room's level: no menu
      '.party-embedded body[data-arcade] :is(.arcade-shell>.eyebrow,.arcade-shell>h1,.arcade-shell>p,.arcade-options-v16,#best){display:none!important}' +
      '.party-embedded .ch-shell{max-width:none;padding:0;margin:0}' +
      '.party-embedded .ch-layout{display:block}' +
      '.party-embedded :is(#chLobby,#chSetup,#chRematch,#chLeave,.ch-topbar,.ch-heading,.ch-aside,.ch-footer){display:none!important}';
    document.head.append(css);
  }
  // Watch only this room's socket; the game keeps using it exactly as before.
  function watch(room, onMessage) {
    const Native = window.WebSocket;
    if (typeof Native !== 'function' || Native.bsPartyLink) return;
    class PartyLinkSocket extends Native {
      constructor(url, protocols) {
        if (protocols === undefined) super(url); else super(url, protocols);
        try { if (String(url).includes('/' + room + '/')) this.addEventListener('message', onMessage); } catch {}
      }
    }
    Object.defineProperty(PartyLinkSocket, 'bsPartyLink', { value: true });
    try { window.WebSocket = PartyLinkSocket; } catch {}
  }
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('bs_party_link') || 'null'); } catch {}

  // 33.9.1: a game with no online room, on its own page inside the group room. The seed
  // gives every player the same board; the page reports with BS_PARTY_LINK.report().
  if (framed && params.get('local') === '1') {
    const party = params.get('party') || '', round = params.get('round') || '', seed = Number(params.get('seed'));
    if (!/^\d{6}$/.test(party) || !/^[0-9a-f-]{36}$/i.test(round) || !Number.isInteger(seed) || seed < 0) { window.BS_PARTY_LINK = null; return; }
    const own = saved?.party === party && saved.round === round ? saved : null, level = params.get('level');
    const local = Object.freeze({
      seed: seed >>> 0,
      level: ['casual', 'standard', 'expert'].includes(level) ? level : 'standard',
      mode: params.get('mode') === 'sequence' ? 'sequence' : 'pairs',
      theme: String(params.get('theme') || '').replace(/[^a-z]/g, '').slice(0, 20),
      stage: Math.max(1, Math.min(60, Math.floor(Number(params.get('stage')) || 1))),
    });
    const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
    window.BS_PARTY_LINK = Object.freeze({
      party, room: '', back: '', round, game: String(own?.game || ''), name: clean(own?.name), embedded: true, local,
      live: () => say('tahdia-party-live', { round }),
      report: (result = {}) => say('tahdia-party-report', { round, report: { progress: number(result.progress), score: number(result.score), mistakes: number(result.mistakes), done: result.done === true, won: result.won === true } }),
    });
    fillName(window.BS_PARTY_LINK.name);
    embed(false);
    return;
  }

  const room = params.get('room') || '';
  let seat = '';
  if (framed && /^\d{6}$/.test(room)) {
    try {
      const own = JSON.parse(sessionStorage.getItem('bs-party-seat:' + room) || 'null');
      if (own?.room === room && own.party === params.get('party') && /^[a-f0-9]{64}$/.test(own.token)) {
        saved = own;
        seat = own.token;
      }
    } catch {}
  }
  const recent = Boolean(saved && Date.now() - Number(saved.at || 0) < 6 * 3600000);
  // some games drop ?party from the address once seated; a reload of that room is still the party's
  const party = params.get('party') || (recent && saved.room === room ? String(saved.party || '') : '');
  if (!/^\d{6}$/.test(party) || !/^\d{6}$/.test(room)) { window.BS_PARTY_LINK = null; return; }
  const fresh = Boolean(recent && saved.party === party && saved.room === room);
  const back = '/party?room=' + party;
  const link = Object.freeze({ party, room, back, game: fresh ? String(saved.game || '') : '', round: fresh ? String(saved.round || '') : '', name: fresh ? clean(saved.name) : '', ...(seat ? { seat } : {}), ...(framed ? { embedded: true } : {}) });
  window.BS_PARTY_LINK = link;
  fillName(link.name);

  if (framed) {
    embed(Boolean(seat));
    // the group room shows the game the moment its room answers (a challenge page says so itself)
    if (!seat) {
      let told = false;
      watch(room, () => { if (told) return; told = true; say('tahdia-party-live', { room }); });
    }
    return;
  }
  const style = document.createElement('style');
  style.textContent = `
.bs-party-back{position:fixed;z-index:2147483000;inset-inline-start:max(12px,env(safe-area-inset-left));top:max(10px,env(safe-area-inset-top));display:inline-flex;align-items:center;gap:7px;min-height:38px;padding:7px 14px 7px 12px;border-radius:999px;background:#13203aee;color:#f6f1e3;border:1px solid #a2e5cb70;box-shadow:0 10px 24px #0007;font-family:inherit;font-weight:700;font-size:13px;line-height:1.2;text-decoration:none;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.bs-party-back i{font-style:normal;color:#a2e5cb;font-size:15px}
.bs-party-nav{color:#a2e5cb!important;font-weight:800;text-decoration:none;white-space:nowrap}
.bs-party-back:focus-visible,.bs-party-return a:focus-visible,.bs-party-return button:focus-visible{outline:3px solid #f3ce83;outline-offset:2px}
.bs-party-return{position:fixed;z-index:2147483001;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(420px,calc(100vw - 24px));box-sizing:border-box;padding:18px 18px 16px;border-radius:20px;background:linear-gradient(140deg,#1b2a45,#14203a);color:#f6f1e3;border:1px solid #a2e5cb55;box-shadow:0 24px 60px #000a;font-family:inherit;text-align:center;animation:bs-party-in .35s ease-out}
.bs-party-return b{display:block;font-size:19px;margin-bottom:6px}
.bs-party-return p{margin:0 0 14px;font-size:14px;line-height:1.7;color:#d7deeb}
.bs-party-return p strong{color:#f3ce83;font-variant-numeric:tabular-nums}
.bs-party-return div{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.bs-party-return a,.bs-party-return button{min-height:44px;padding:10px 18px;border-radius:14px;font:inherit;font-weight:800;font-size:15px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
.bs-party-return a{background:#a2e5cb;color:#0e1a2e;border:0;min-width:170px}
.bs-party-return button{background:transparent;color:#f6f1e3;border:1px solid #ffffff38}
@keyframes bs-party-in{from{opacity:0;transform:translate(-50%,16px)}}
@media (prefers-reduced-motion:reduce){.bs-party-return{animation:none}}
@media print{.bs-party-back,.bs-party-return{display:none}}`;
  document.head.appendChild(style);

  let ended = false, sheet = null, timer = 0, pill = null;
  const RETURN_SECONDS = 15;
  // A stage in fullscreen hides everything outside it: keep our pieces inside it.
  const host = () => (document.fullscreenElement && document.fullscreenElement !== document.documentElement ? document.fullscreenElement : document.body);
  const place = (node) => { const parent = host(); if (node && parent && node.parentNode !== parent) parent.appendChild(node); };
  // The way back lives where the page keeps its own: the game bar's back button turns into
  // «الجمعة» (play-feedback reads BS_PARTY_LINK), a page header gets a link, and only a page
  // with neither gets a small floating button.
  function wayBack() {
    if (document.getElementById('bsGameCommand')) return;
    const nav = document.querySelector('.picture-header nav, .bs-topbar nav');
    if (nav) {
      if (nav.querySelector('.bs-party-nav')) return;
      const a = document.createElement('a');
      a.href = back; a.className = 'bs-party-nav'; a.textContent = '↩ الجمعة'; a.setAttribute('aria-label', 'ارجع لغرفة الجمعة');
      nav.prepend(a);
      return;
    }
    pill = document.createElement('a');
    pill.className = 'bs-party-back'; pill.href = back; pill.setAttribute('aria-label', 'ارجع لغرفة الجمعة');
    pill.innerHTML = '<i aria-hidden="true">↩</i><span>الجمعة</span>';
    place(pill);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wayBack, { once: true }); else wayBack();
  document.addEventListener('fullscreenchange', () => { place(pill); place(sheet); });

  // When the match ends the room reports to the party; offer the way back.
  function offerReturn() {
    if (sheet) return;
    sheet = document.createElement('div');
    sheet.className = 'bs-party-return';
    sheet.setAttribute('role', 'status');
    sheet.innerHTML = '<b>انتهت جولة الجمعة</b><p>نتيجتك انحسبت في ترتيب الجمعة. نرجعك بعد <strong>' + RETURN_SECONDS + '</strong> ثانية.</p><div><a href="' + back + '">ارجع للجمعة الحين</a><button type="button">ابق هنا</button></div>';
    const count = sheet.querySelector('strong');
    let left = RETURN_SECONDS;
    timer = setInterval(() => {
      left -= 1;
      if (left <= 0) { clearInterval(timer); location.href = back; return; }
      count.textContent = String(left);
    }, 1000);
    sheet.querySelector('button').addEventListener('click', () => { clearInterval(timer); sheet.remove(); sheet = null; });
    place(sheet);
  }
  function peek(event) {
    if (ended || typeof event.data !== 'string' || event.data.indexOf('"finished"') < 0) return;
    let message; try { message = JSON.parse(event.data); } catch { return; }
    if ((message?.type === 'state' || message?.type === 'welcome') && message.state?.status === 'finished') {
      ended = true;
      setTimeout(offerReturn, 3500); // the game shows its own result first
    }
  }
  watch(room, peek);
  window.addEventListener('pagehide', () => clearInterval(timer));
})();
