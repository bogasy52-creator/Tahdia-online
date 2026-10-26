/* Tahdia 32.1.0 — a group-games round played in the real game.
   Loaded first on every game page a party can open. With ?party=CODE in the
   address it keeps the way back to the party in reach, hands a guest the same
   name they carry in the party (that is how their result finds them), and when
   the match ends offers the return with a short countdown. Without ?party it
   does nothing at all. */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('bs_party_link') || 'null'); } catch {}
  const room = params.get('room') || '';
  const recent = Boolean(saved && Date.now() - Number(saved.at || 0) < 6 * 3600000);
  // some games drop ?party from the address once seated; a reload of that room is still the party's
  const party = params.get('party') || (recent && saved.room === room ? String(saved.party || '') : '');
  if (!/^\d{6}$/.test(party) || !/^\d{6}$/.test(room)) { window.BS_PARTY_LINK = null; return; }
  const fresh = Boolean(recent && saved.party === party && saved.room === room);
  const clean = (value) => String(value || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  const back = '/party?room=' + party;
  const link = Object.freeze({ party, room, back, game: fresh ? String(saved.game || '') : '', round: fresh ? String(saved.round || '') : '', name: fresh ? clean(saved.name) : '' });
  window.BS_PARTY_LINK = link;

  // A guest plays under the party name; an account keeps its own name (social-client locks it).
  if (link.name) {
    document.querySelectorAll('input[data-account-name]').forEach((input) => {
      if (!input.readOnly) input.value = link.name.slice(0, input.maxLength > 0 ? input.maxLength : 24);
    });
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
  // Watch only this room's socket; the game keeps using it exactly as before.
  const Native = window.WebSocket;
  if (typeof Native === 'function' && !Native.bsPartyLink) {
    class PartyLinkSocket extends Native {
      constructor(url, protocols) {
        if (protocols === undefined) super(url); else super(url, protocols);
        try { if (String(url).includes('/' + room + '/')) this.addEventListener('message', peek); } catch {}
      }
    }
    Object.defineProperty(PartyLinkSocket, 'bsPartyLink', { value: true });
    try { window.WebSocket = PartyLinkSocket; } catch {}
  }
  window.addEventListener('pagehide', () => clearInterval(timer));
})();
