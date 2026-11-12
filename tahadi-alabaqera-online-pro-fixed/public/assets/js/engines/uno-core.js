// Private rules state stays on the room. unoView exposes only the viewer's cards.
export const UNO_COLORS = Object.freeze(['red', 'gold', 'green', 'blue']);
export const UNO_MODES = Object.freeze(['classic', 'stack', 'quick']);
const TURN_MS = 30000;
const nextSeat = (u, seat, steps = 1) => (seat + u.direction * steps + u.hands.length * steps) % u.hands.length;
function random(u) {
  u.random = (u.random + 0x6D2B79F5) >>> 0;
  let t = Math.imul(u.random ^ u.random >>> 15, 1 | u.random);
  t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
function shuffle(u, list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random(u) * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
export function unoDeck(copies = 1) {
  const cards = [];
  const put = (color, face) => cards.push({ id: 'u' + cards.length, color, face });
  for (let d = 0; d < copies; d++) {
    for (const color of UNO_COLORS) {
      put(color, '0');
      for (let copy = 0; copy < 2; copy++) {
        for (const face of ['1','2','3','4','5','6','7','8','9','skip','reverse','draw2']) put(color, face);
      }
    }
    for (let i = 0; i < 4; i++) { put('wild', 'wild'); put('wild', 'draw4'); }
  }
  return cards;
}
function event(m, kind, player, text, card = null) {
  const u = m.uno;
  u.event = { id: ++u.eventId, kind, player, text, card };
  m.log.push(text);
  if (m.log.length > 5) m.log.shift();
}
function draw(u, seat, amount) {
  const added = [];
  for (let i = 0; i < amount; i++) {
    if (!u.deck.length && u.discard.length > 1) {
      const top = u.discard.pop();
      u.deck = shuffle(u, u.discard);
      u.discard = [top];
    }
    const card = u.deck.pop();
    if (!card) break;
    u.hands[seat].push(card);
    added.push(card);
  }
  return added;
}
function setTurn(m, seat, now) {
  const u = m.uno;
  m.turn = u.turn = seat;
  m.turnDeadline = u.deadline = now + TURN_MS;
  u.thinkAt = now + 1000 + (seat * 173) % 500;
  u.drawn = null;
  u.turnId++;
  m.players.forEach((p, i) => { p.score = Math.max(0, 100 - u.hands[i].length); });
}
export function initUno(m, mode = 'classic', now = m.startedAt) {
  const count = m.players.length;
  if (count < 2 || count > 20) throw Error('أونو تحتاج لاعبين على الأقل');
  const u = m.uno = {
    mode: UNO_MODES.includes(mode) ? mode : 'classic', random: m.seed >>> 0,
    hands: Array.from({ length: count }, () => []), deck: [], discard: [], color: 'red',
    direction: 1, turn: 0, deadline: 0, turnId: 0, pending: 0, pendingFace: null,
    drawn: null, missed: null, eventId: 0, event: null, blocked: 0,
  };
  u.deck = shuffle(u, unoDeck(Math.ceil((count * 7 + 20) / 108)));
  const hand = u.mode === 'quick' ? 5 : 7;
  for (let i = 0; i < hand; i++) for (let seat = 0; seat < count; seat++) draw(u, seat, 1);
  const index = u.deck.findIndex(card => /^\d$/.test(card.face));
  u.discard.push(...u.deck.splice(index, 1));
  u.color = u.discard[0].color;
  m.endsAt = now + 900000;
  setTurn(m, 0, now);
  event(m, 'deal', null, 'وزّعنا الورق · البداية مع ' + m.players[0].name);
  return m;
}
export function unoLegal(u, seat) {
  if (seat !== u.turn) return [];
  const hand = u.hands[seat], top = u.discard.at(-1);
  return hand.filter(card => {
    if (u.drawn && card.id !== u.drawn) return false;
    if (u.pending) return card.face === u.pendingFace && (card.face !== 'draw4' || !hand.some(c => c.color === u.color));
    if (card.face === 'draw4') return !hand.some(c => c.color === u.color);
    return card.color === 'wild' || card.color === u.color || card.face === top.face;
  }).map(card => card.id);
}
const points = card => card.color === 'wild' ? 50 : /^\d$/.test(card.face) ? Number(card.face) : 20;
function finish(m, seat, now) {
  const u = m.uno;
  m.phase = 'finished'; m.finishedAt = now;
  const totals = u.hands.map(hand => hand.reduce((n, card) => n + points(card), 0));
  const minimum = Math.min(...totals);
  const winners = seat === null ? totals.flatMap((v, i) => v === minimum ? [i] : []) : [seat];
  m.winners = winners.map(i => m.players[i].id);
  const prize = totals.reduce((a,b) => a + b, 0);
  m.players.forEach((p, i) => { p.score = winners.includes(i) ? 1000 + prize : Math.max(0, 1000 - totals[i]); });
  event(m, 'finish', seat, seat === null ? 'انتهى الوقت · حُسمت الجولة بقيمة الأوراق' : m.players[seat].name + ' خلّص أوراقه!');
}
export function applyUno(m, p, action, now) {
  const u = m.uno, seat = p.slot;
  if (action.type === 'uno') {
    if (u.missed !== seat || u.hands[seat].length !== 1) throw Error('نادِ أونو مع ورقتك قبل الأخيرة');
    u.missed = null; event(m, 'uno', seat, p.name + ' · أونو!'); return;
  }
  if (action.type === 'catch') {
    if (u.missed === null || u.missed === seat) throw Error('ما فيه لاعب نسي أونو');
    const caught = u.missed;
    draw(u, caught, 2); u.missed = null;
    event(m, 'catch', seat, m.players[caught].name + ' نسي أونو وسحب ورقتين'); return;
  }
  if (seat !== u.turn) throw Error('انتظر دورك');
  const legal = unoLegal(u, seat);
  if (action.type === 'play') {
    const card = u.hands[seat].find(c => c.id === action.card);
    if (!card || !legal.includes(card.id)) throw Error('الورقة ما تطابق اللون أو الرمز');
    if (card.color === 'wild' && !UNO_COLORS.includes(action.color)) throw Error('اختر اللون');
    u.missed = null; u.blocked = 0;
    u.hands[seat].splice(u.hands[seat].indexOf(card), 1); u.discard.push(card);
    u.color = card.color === 'wild' ? action.color : card.color;
    if (u.hands[seat].length === 1 && action.uno !== true) u.missed = seat;
    const announced = u.hands[seat].length === 1 && action.uno === true;
    p.moves++;
    if (card.face === 'reverse') u.direction *= -1;
    const following = nextSeat(u, seat);
    let next = following;
    if (card.face === 'skip' || card.face === 'reverse' && u.hands.length === 2) next = nextSeat(u, seat, 2);
    if (card.face === 'draw2' || card.face === 'draw4') {
      const count = card.face === 'draw2' ? 2 : 4;
      if (u.mode === 'stack' && u.hands[seat].length) {
        u.pending += count; u.pendingFace = card.face;
      } else {
        draw(u, following, count + u.pending);
        u.pending = 0; u.pendingFace = null; next = nextSeat(u, seat, 2);
      }
    }
    event(m, 'play', seat, p.name + (announced ? ' · أونو!' : ' لعب ورقته'), card);
    if (!u.hands[seat].length) { finish(m, seat, now); return; }
    setTurn(m, next, now); return;
  }
  if (action.type === 'draw') {
    if (u.drawn) throw Error('تقدر تلعب المسحوبة أو تمرّر');
    u.missed = null;
    const penalty = u.pending, drawn = draw(u, seat, penalty || 1);
    u.pending = 0; u.pendingFace = null; u.drawn = drawn[0]?.id || null;
    if (drawn.length) u.blocked = 0; else u.blocked++;
    event(m, 'draw', seat, p.name + ' سحب ' + drawn.length + (penalty ? ' ورقة جزاء' : ' ورقة'));
    if (!penalty && u.drawn && unoLegal(u, seat).includes(u.drawn)) {
      u.deadline = m.turnDeadline = now + TURN_MS;
      p.score = Math.max(0, 100 - u.hands[seat].length); return;
    }
    if (u.blocked >= u.hands.length * 2) { finish(m, null, now); return; }
    setTurn(m, nextSeat(u, seat), now); return;
  }
  if (action.type === 'pass') {
    if (!u.drawn) throw Error('اسحب ورقة قبل التمرير');
    u.missed = null; setTurn(m, nextSeat(u, seat), now);
    event(m, 'pass', seat, p.name + ' مرّر الدور'); return;
  }
  throw Error('حركة أونو غير صالحة');
}
export function unoBotAction(m, seat) {
  const u = m.uno, hand = u.hands[seat];
  if (u.missed !== null && u.missed !== seat) return { type: 'catch' };
  const legal = unoLegal(u, seat), playable = hand.filter(c => legal.includes(c.id));
  playable.sort((a,b) => Number(a.color === 'wild') - Number(b.color === 'wild') || points(b) - points(a));
  if (!playable.length) return { type: u.drawn ? 'pass' : 'draw' };
  const card = playable[0], remainder = hand.filter(c => c !== card);
  const color = [...UNO_COLORS].sort((a,b) => remainder.filter(c => c.color === b).length - remainder.filter(c => c.color === a).length)[0];
  return { type: 'play', card: card.id, color, uno: true };
}
export function advanceUno(m, now) {
  if (now >= m.endsAt) { finish(m, null, now); m.version++; return; }
  const u = m.uno, player = m.players[u.turn];
  if (player.bot && now >= u.thinkAt) {
    applyUno(m, player, unoBotAction(m, u.turn), now);
    u.thinkAt = now + 1050; m.version++;
  } else if (now >= u.deadline) {
    // A matching draw leaves the turn open only to play that card or pass.
    // Expiring that choice must not charge the player for a second draw.
    const amount = u.drawn ? 0 : u.pending || 1; draw(u, u.turn, amount);
    u.pending = 0; u.pendingFace = null; u.missed = null;
    const previous = u.turn; setTurn(m, nextSeat(u, previous), now);
    event(m, 'timeout', previous, player.name + (amount ? ' انتهى وقته وسحب ' + amount : ' انتهى وقته ومرّر الدور')); m.version++;
  }
}
export function unoView(m, id) {
  const u = m.uno, seat = m.players.find(p => p.id === id).slot;
  return {
    mode: u.mode, turn: u.turn, turnId: u.turnId, deadline: u.deadline, direction: u.direction,
    color: u.color, top: structuredClone(u.discard.at(-1)), stock: u.deck.length,
    hand: structuredClone(u.hands[seat]), counts: u.hands.map(h => h.length),
    legal: m.phase === 'playing' ? unoLegal(u, seat) : [], drawn: u.turn === seat ? u.drawn : null,
    pending: u.pending, missed: u.missed, event: structuredClone(u.event),
  };
}
