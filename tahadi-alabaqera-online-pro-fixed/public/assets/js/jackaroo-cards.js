/* Tahdia 33.4.0 — Jackaroo cards. The faces are the Baloot deck's (baloot-cards.js:
   real courts, real pips, the deck you equipped), and every card carries a plate
   with a drawing of what it does: out of the yard, steps forward, back, swap,
   split, any stone, the king's sweep. The same plates make the card guide. */
(function () {
  'use strict';
  const ICON = {
    exit: '<path d="M4 20h16"/><path d="M12 17V5"/><path d="M7.5 9.5 12 5l4.5 4.5"/>',
    king: '<path d="M3 19h18"/><path d="M4 16 3 7l5 4 4-6 4 6 5-4-1 9z"/>',
    step: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>',
    back: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v5h5"/>',
    swap: '<path d="M5 8h13"/><path d="M15 5l3 3-3 3"/><path d="M19 16H6"/><path d="M9 13l-3 3 3 3"/>',
    split: '<path d="M12 21v-7"/><path d="M12 14 6.5 7.5"/><path d="M12 14l5.5-6.5"/><path d="M5.5 11.5V7h4.5"/><path d="M18.5 11.5V7H14"/>',
    any: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  };
  const N = (n) => ({ act: 'step', b: String(n), s: n === 2 ? 'خطوتين' : 'خطوات', say: `${n === 2 ? 'الثنين' : n === 3 ? 'الثلاثة' : n === 6 ? 'الستة' : n === 8 ? 'الثمانية' : n === 9 ? 'التسعة' : 'العشرة'}: تمشي ${n === 2 ? 'خطوتين' : n + ' خطوات'} لقدّام.` });
  const INFO = {
    A: { act: 'exit', b: 'اطلع', s: 'أو 1/11', say: 'الإكة: تطلّع حجر من البيت، أو تمشي خطوة وحدة أو 11 خطوة.' },
    K: { act: 'king', b: 'اطلع', s: 'أو 13', say: 'الشايب: تطلّع حجر، أو تمشي 13 خطوة وتكسح كل حجر بطريقك.' },
    Q: { act: 'step', b: '12', s: 'خطوة', say: 'البنت: تمشي 12 خطوة لقدّام.' },
    J: { act: 'swap', b: 'بدّل', s: 'حجرين', say: 'الولد: تبدّل مكان حجرك مع أي حجر ثاني على الطريق.' },
    '10': N(10), '9': N(9), '8': N(8), '6': N(6), '3': N(3), '2': N(2),
    '7': { act: 'split', b: '7', s: 'تتقسّم', say: 'السبعة: 7 خطوات لحجر واحد، أو تقسمها على حجرين (مثل 3 و4).' },
    '5': { act: 'any', b: '5', s: 'لأي حجر', say: 'الخمسة: تمشّي أي حجر على الطريق 5 خطوات، حتى حجر خصمك.' },
    '4': { act: 'back', b: '4', s: 'لورا', say: 'الأربعة: ترجع 4 خطوات لورا.' },
  };
  const ORDER = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
  const SUIT_NAME = { S: 'سبيت', H: 'هاص', D: 'ديمن', C: 'شريا' };
  const rankOf = (card) => String(card).replace(/[SHDC]$/, '');
  const deck = () => { try { return window.BS_CAREER?.get?.()?.equipped?.deck || 'deck-classic'; } catch { return 'deck-classic'; } };
  const svgIcon = (act) => `<svg class="jk-ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICON[act] || ICON.step}</svg>`;
  function plate(rank) {
    const info = INFO[rank] || INFO['2'], el = document.createElement('span');
    el.className = 'jk-act'; el.dataset.act = info.act;
    el.innerHTML = svgIcon(info.act) + '<b></b><small></small>';
    el.querySelector('b').textContent = info.b; el.querySelector('small').textContent = info.s;
    return el;
  }
  function art(card) {
    const img = document.createElement('img');
    img.className = 'jk-face'; img.alt = ''; img.decoding = 'async'; img.draggable = false;
    const cards = window.BS_CARDS;
    if (cards?.url) { const rank = rankOf(card), suit = String(card).slice(-1); img.src = card === '?' ? cards.url('back', deck()) : cards.url((rank === '10' ? 'T' : rank) + suit, deck()); }
    return img;
  }
  /** A card for the hand: the deck's face and the plate saying what it does. */
  function face(card, { button = true } = {}) {
    const el = document.createElement(button ? 'button' : 'div');
    if (button) el.type = 'button';
    if (card === '?') { el.className = 'playing-card jk-card card-back'; el.append(art('?')); return el; }
    const rank = rankOf(card), suit = String(card).slice(-1);
    el.className = 'playing-card jk-card' + (suit === 'H' || suit === 'D' ? ' red' : '');
    el.dataset.rank = rank;
    el.setAttribute('aria-label', `${rank} ${SUIT_NAME[suit] || ''} — ${(INFO[rank] || {}).say || ''}`);
    el.append(art(card), plate(rank));
    return el;
  }
  /** The card guide: every rank with its plate and what it does. */
  function legend(target) {
    if (!target) return;
    const list = document.createElement('div'); list.className = 'jk-legend';
    for (const rank of ORDER) {
      const row = document.createElement('div'); row.className = 'jk-legend-row'; row.dataset.rank = rank;
      const chip = document.createElement('span'); chip.className = 'jk-legend-rank'; chip.textContent = rank;
      const text = document.createElement('p'); text.textContent = INFO[rank].say;
      row.append(chip, plate(rank), text); list.append(row);
    }
    target.replaceChildren(list);
  }
  const info = (card) => INFO[rankOf(card)] || null;
  window.BS_JACK_CARDS = Object.freeze({ INFO, ORDER, face, legend, info, rankOf });
  const guide = () => legend(document.getElementById('cardGuide'));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guide, { once: true }); else guide();
})();
