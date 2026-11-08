/* Jackaroo uses the shared 52-card deck, including court artwork and equipped palettes. Card rules remain available in the guide and legal-action controls. */
(function () {
  'use strict';
  const ICON = {
    burn: '<rect x="3" y="4" width="10" height="15" rx="2"/><path d="M16 20c-4-2-4-5-1-8 0 2 2 2 2 3 3-3 0-6 2-9 6 6 7 12-3 14Z"/>',
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
    '10': {act:'burn',b:'10',s:'أو حرق',say:'العشرة: تحرّك 10 خطوات، أو تحرق ورقة اللاعب التالي وتتجاوز دوره.'}, '9': N(9), '8': N(8), '6': N(6), '3': N(3), '2': N(2),
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
  // the suits as paths in a 100 × 100 box (a font's ♥ may turn into an emoji on some phones)
  const SUIT = {
    S: 'M50 8C66 26 88 40 88 60C88 73 78 81 67 81C60 81 55 78 52 73C53 82 57 89 64 94H36C43 89 47 82 48 73C45 78 40 81 33 81C22 81 12 73 12 60C12 40 34 26 50 8Z',
    H: 'M50 90C28 72 10 56 10 36C10 22 20 12 33 12C41 12 47 17 50 24C53 17 59 12 67 12C80 12 90 22 90 36C90 56 72 72 50 90Z',
    D: 'M50 6C60 26 74 40 92 50C74 60 60 74 50 94C40 74 26 60 8 50C26 40 40 26 50 6Z',
    C: 'M50 8C61 8 70 17 70 28C70 34 67 39 63 43C66 41 70 40 74 40C85 40 94 49 94 60C94 71 85 80 74 80C66 80 59 75 56 68C57 78 60 87 67 94H33C40 87 43 78 44 68C41 75 34 80 26 80C15 80 6 71 6 60C6 49 15 40 26 40C30 40 34 41 37 43C33 39 30 34 30 28C30 17 39 8 50 8Z',
  };
  const COURT = { K: 'M31 56L35 36L43 47L50 31L57 47L65 36L69 56Z', Q: 'M33 55C38 45 44 42 50 42S62 45 67 55ZM50 34A4 4 0 1 1 49.9 34ZM36 40A3 3 0 1 1 35.9 40ZM64 40A3 3 0 1 1 63.9 40Z', J: 'M30 52C29 44 37 37.5 49 37C60 36.5 69 41 69 47.5C69 50.5 66 52 61 52ZM30.5 52.5H63.5V58H30.5ZM57.5 39C59 30.5 66 25.5 75 25.5C71 29.5 67 34 63.5 40.5ZM62 33.5L70 29.2' };

  function illustration(rank, ink) {
    const icon = (act,x,y,scale=1.3) => '<g transform="translate('+x+' '+y+') scale('+scale+')" fill="none" stroke="'+ink+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(ICON[act]||ICON.step)+'</g>';
    const label = (value,x,y,size=16) => '<text x="'+x+'" y="'+y+'" fill="'+ink+'" text-anchor="middle" font-family="Arial,sans-serif" font-size="'+size+'" font-weight="900">'+value+'</text>';
    const marble = (x,y,color) => '<circle cx="'+x+'" cy="'+y+'" r="8" fill="'+color+'" stroke="#ffffff" stroke-width="1.5"/><circle cx="'+(x-2)+'" cy="'+(y-2)+'" r="2" fill="#ffffff" opacity=".65"/>';
    let scene;
    if(rank==='10'){
      scene='<g data-card-action="move10"><rect x="20" y="43" width="60" height="31" rx="8" fill="#e6eff7"/>'+marble(32,58,'#3e82ae')+icon('step',48,46,.75)+label('10',61,67,12)+'</g>'
        +label('أو',50,86,10)+'<g data-card-action="burn-next"><rect x="20" y="92" width="60" height="30" rx="8" fill="#fce4d9"/>'+icon('burn',26,93,1)+label('التالي',65,112,8)+'</g>';
    }else if(rank==='A'||rank==='K'){
      scene='<g data-card-action="enter">'+icon('exit',18,41,1.3)+marble(60,58,'#3e82ae')+'</g>'+label('أو',50,86,10)
        +'<g data-card-action="move">'+icon(rank==='K'?'king':'step',18,92,1.05)+label(rank==='A'?'1 / 11':'13',64,112,17)+'</g>';
      if(rank==='K')scene+='<path d="'+COURT.K+'" transform="translate(32 -1) scale(.42)" fill="#e0b54a" stroke="#9b7a24" stroke-width="1"/>';
    }else if(rank==='J'){
      scene='<g data-card-action="swap">'+marble(31,61,'#3e82ae')+marble(69,99,'#d46a55')+icon('swap',29,66,1.8)+'</g><path d="'+COURT.J+'" transform="translate(32 -1) scale(.42)" fill="#e0b54a" stroke="#9b7a24" stroke-width="1"/>';
    }else if(rank==='7'){
      scene='<g data-card-action="split">'+icon('split',29,42,1.7)+marble(30,96,'#3e82ae')+marble(70,96,'#aa74c0')+label('3',30,101,12)+label('4',70,101,12)+label('= 7',50,124,12)+'</g>';
    }else if(rank==='5'){
      scene='<g data-card-action="any-five">'+icon('any',23,41,2.2)+label('5',50,119,26)
        +marble(23,50,'#3e82ae')+marble(77,50,'#d46a55')+marble(23,92,'#aa74c0')+marble(77,92,'#419b76')+'</g>';
    }else{
      const backwards=rank==='4';
      scene='<g data-card-action="'+(backwards?'back-four':'forward')+'">'+icon(backwards?'back':'step',21,43,2.4)+label(rank==='Q'?'12':rank,50,118,27)+'</g>';
      if(rank==='Q')scene+='<path d="'+COURT.Q+'" transform="translate(32 -1) scale(.42)" fill="#e0b54a" stroke="#9b7a24" stroke-width="1"/>';
    }
    return '<rect x="17" y="38" width="66" height="89" rx="11" fill="#f5f0e6" stroke="#cfbba0" stroke-width=".8"/>'+scene;
  }
  const cache = new Map();
  /** The face of a card as an SVG data address ('?' or 'back' is the back). */
  function url(card) {
    const code=String(card||'back'),skin=deck(),key=skin+':'+code;if(window.BS_CARDS?.url){const rank=rankOf(code),suit=code.slice(-1);return window.BS_CARDS.url(code==='?'||code==='back'?'back':(rank==='10'?'T':rank)+suit,skin);}
    if (cache.has(key)) return cache.get(key);
    let body;
    if (code === '?' || code === 'back') {
      body = '<rect x="1.5" y="1.5" width="97" height="137" rx="10" fill="#14275f" stroke="#5cc0ff" stroke-width="2.4"/><rect x="9" y="9" width="82" height="122" rx="6" fill="none" stroke="#5cc0ff" stroke-opacity=".55" stroke-width="1.2"/>'
        + '<g fill="none" stroke="#8fd3ff" stroke-opacity=".28" stroke-width="1">' + Array.from({ length: 9 }, (_, i) => `<path d="M${9 + i * 10} 9L${-31 + i * 10} 131M${91 - i * 10} 9L${131 - i * 10} 131"/>`).join('') + '</g>'
        + '<circle cx="50" cy="70" r="20" fill="#14275f" stroke="#5cc0ff" stroke-width="1.6"/><path d="' + SUIT.S + '" transform="translate(37 57) scale(.26)" fill="#e9f6ff"/>';
    } else {
      const rank = rankOf(code), suit = code.slice(-1), red = suit === 'H' || suit === 'D', ink = red ? '#d3263b' : '#1b2230', path = SUIT[suit] || SUIT.S;
      const corner = `<text x="12" y="27" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="${rank === '10' ? 19 : 24}" letter-spacing="${rank === '10' ? -1.5 : 0}" fill="${ink}">${rank}</text><path d="${path}" transform="translate(4.5 32) scale(.15)" fill="${ink}"/>`;
      const middle = illustration(rank, ink);
      body = '<defs><linearGradient id="p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eef1f6"/></linearGradient></defs>'
        + '<rect x="1.5" y="1.5" width="97" height="137" rx="10" fill="url(#p)" stroke="#cfd6e2" stroke-width="2"/>' + corner + `<g transform="rotate(180 50 70)">${corner}</g>` + middle;
    }
    const out = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140">' + body + '</svg>');
    cache.set(key, out);
    return out;
  }
  function art(card) {
    const img = document.createElement('img');
    img.className = 'jk-face'; img.alt = ''; img.decoding = 'async'; img.draggable = false;
    img.src = url(card);
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
    el.append(art(card));
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
  // 33.6.0: ICON also draws the badge on the card that was just played, in the middle of the board
  window.BS_JACK_CARDS = Object.freeze({ INFO, ORDER, ICON, face, legend, info, rankOf, url });
  const guide = () => legend(document.getElementById('cardGuide'));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guide, { once: true }); else guide();
})();
