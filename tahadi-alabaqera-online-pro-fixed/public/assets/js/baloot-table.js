/* Tahdia 32.0.0 — the Baloot table.
   One renderer for both ways to play: offline against bots (the engine runs
   here) and online (the BoardRoom runs the engine and sends this seat's view
   plus the events since the last update). Events are animated one by one:
   deal, bids, the contract, cards flying to the middle, the trick sweeping to
   its winner, projects, Baloot and the hand result.
   32.1.0: open play (any card; the other team may claim a cut — «سجّل»),
   Arabic voices for the calls, table talk (phrases and emoji) and effects. */
import { balootActions, teamOf, legalCards, canClaim, selectProjects } from './engines/baloot-engine.js?v=33.0.0-gameplay3';
import { BoardOnlineClient } from './board-online.js?v=33.0.0';
import { BALOOT_PHRASES, BALOOT_EMOJI, BOT_TALK, talkPhrase, talkEmoji } from './engines/baloot-talk.js?v=33.0.0';
import { BalootVoice } from './baloot-voice.js?v=33.0.0-baloot2';

const $ = (id) => document.getElementById(id);
// 32.0.1: signed in, you sit at every table under your account's name.
const accountName = () => String(window.BS_SOCIAL?.accountName?.() || '').trim().slice(0, 20);
const POS = ['bottom', 'right', 'top', 'left'];
const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RED = { H: true, D: true };
const PROJECT_NAME = { sira: 'سرا', fifty: 'خمسين', hundred: 'مية', fourHundred: 'أربعمية' };
// the suits as they are called at a Saudi table
const SUIT_SAY = { S: 'سبيت', H: 'هاص', D: 'ديمن', C: 'شريا' };
// why a card was a cut: [about another player, about you]
const CUT_WHY = { follow: ['وهو عنده من الشكل', 'وأنت عندك من الشكل'], trump: ['وعنده حكم وما دقّ', 'وعندك حكم وما دقّيت'], higher: ['وهو يقدر يكبّر بالحكم', 'وأنت تقدر تكبّر بالحكم'], lead: ['والحكم مقفول', 'والحكم مقفول'] };
const BOT_NAMES = ['أبو فهد', 'سلطان', 'نايف', 'بندر', 'مشعل', 'تركي', 'فيصل', 'ريان'];
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reduce() ? Math.min(ms, 120) : ms / ui.speed));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const play = (name, opts) => { try { window.BS_AUDIO?.play?.(name, opts); } catch {} };

const ui = {
  mode: 'online', me: 0, match: null, view: null, busy: false, picked: null, level: 'hard', target: 152,
  deck: 'deck-classic', speed: 1, receipt: '', rewarded: false, client: null, room: null, eventSeq: 0,
  pending: Promise.resolve(), lastHandShown: 0, botTimer: null, sending: false,
  open: true, claimArmed: 0, talkTab: 'phrase', lastTalk: 0, botTalkAt: 0, session: 0, handClosed:false, botTalkTimers:new Set(),
};
/* ---------- Voices ---------- */
const relPos = (seat) => ((seat - ui.me) % 4 + 4) % 4;
function speak(text, seat, opts) { if ($('table').hidden || ui.handClosed || ['scored','finished'].includes(ui.room?.state?.phase)) return false; if (seat === null || seat === undefined) seat = ui.me; return BalootVoice.say(text, relPos(seat), opts); }
function endHandAudio() {
  ui.handClosed=true;
  for(const timer of ui.botTalkTimers)clearTimeout(timer);
  ui.botTalkTimers.clear();BalootVoice.stop();closeTalk();
}
function resetVoiceSession() {
  ui.session++; ui.pending = Promise.resolve(); ui.busy = false; ui.queued = null;
  publicReviewKey = '';
  ui.handClosed=false;
  for(const timer of ui.botTalkTimers)clearTimeout(timer);
  ui.botTalkTimers.clear();projectChoiceKey='';projectChoices=[];projectDraft=null;
  BalootVoice.stop();
}

/* ---------- Cosmetics ---------- */
function equipped(type) {
  try { return window.BS_CAREER?.get?.()?.equipped?.[type] || ''; } catch { return ''; }
}
function applyCosmetics() {
  const deck = equipped('deck');
  ui.deck = window.BS_CARDS?.DECKS?.[deck] ? deck : 'deck-classic';
  const table = equipped('table');
  const felt = { 'table-gallery': 'ivory', 'table-nocturne': 'carbon', 'table-midnight': 'carbon', 'table-cyber': 'carbon', 'table-slate': 'carbon', 'table-botanic': 'jade', 'table-emerald': 'jade', 'table-royal': 'royal', 'table-majlis': 'majlis' }[table] || '';
  if (felt) document.body.dataset.felt = felt; else delete document.body.dataset.felt;
}
const cardUrl = (card) => window.BS_CARDS.url(card === '??' ? 'back' : card, ui.deck);
function cardEl(card, extra = '') {
  const el = document.createElement('div');
  el.className = 'bl-card ' + extra;
  el.dataset.card = card;
  const img = document.createElement('img');
  img.alt = card === '??' ? 'ورقة مقلوبة' : cardName(card);
  img.src = cardUrl(card);
  img.draggable = false;
  el.appendChild(img);
  return el;
}
function cardName(card) {
  const rank = { A: 'إكة', K: 'شايب', Q: 'بنت', J: 'ولد', T: '10', 9: '9', 8: '8', 7: '7' }[card[0]];
  return rank + ' ' + SUIT[card[1]];
}
function suitHtml(suit) { return `<span class="suit ${RED[suit] ? 'red suit-red' : 'suit-black'}">${SUIT[suit]}</span>`; }

/* ---------- Seats ---------- */
const posOf = (seat) => POS[(seat - ui.me + 4) % 4];
const seatEl = (seat) => document.querySelector(`.bl-seat[data-pos="${posOf(seat)}"]`);
const slotEl = (seat) => document.querySelector(`.bl-slot[data-pos="${posOf(seat)}"]`);
function seatName(view, seat) { return view?.names?.[seat] || 'لاعب'; }
const playerAt = (seat) => ui.room?.players?.find((p) => p.index === seat) || null;
function isBot(seat) {
  return Boolean(playerAt(seat)?.bot);
}

function renderSeats(view) {
  for (let seat = 0; seat < 4; seat++) {
    const el = seatEl(seat);
    el.dataset.team = String(teamOf(seat));
    el.querySelector('.bl-name b').textContent = seat === ui.me ? 'أنت' : seatName(view, seat);
    const tags = [];
    if (view.dealer === seat) tags.push('الموزّع');
    if (view.contract && view.contract.buyer === seat) tags.push(view.contract.ashkal ? 'أشكل' : 'المشتري');
    const online = playerAt(seat);
    if (online && !online.bot && !online.connected) tags.push('منقطع');
    el.querySelector('.bl-name small').textContent = tags.join(' · ');
    const face = el.querySelector('.bl-face');
    const art = avatarFor(view, seat);
    if (face.dataset.key !== art.key) {
      face.dataset.key = art.key;
      face.innerHTML = art.html;
      face.classList.toggle('letter', Boolean(art.letter));
    }
    el.classList.toggle('is-turn', view.turn === seat && ['bidding', 'doubling', 'playing'].includes(view.phase));
    if (seat !== ui.me) {
      const backs = el.querySelector('.bl-backs');
      const count = view.hands?.[seat]?.length || 0;
      if (Number(backs.dataset.count) !== count) {
        backs.dataset.count = String(count);
        backs.innerHTML = '';
        const vertical = posOf(seat) !== 'top';
        const spread = vertical ? 4.5 : 8;
        const width = vertical ? 70 : 96;
        for (let i = 0; i < count; i++) {
          const img = document.createElement('img');
          img.src = cardUrl('??');
          img.alt = '';
          img.style.left = (width / 2 - 15 + (i - (count - 1) / 2) * spread) + 'px';
          img.style.transform = `rotate(${(i - (count - 1) / 2) * (vertical ? 3 : 4)}deg)`;
          backs.appendChild(img);
        }
      }
    }
  }
}

function avatarFor(view, seat) {
  // Heroes from the shop: yours, the other players' (sent by the room), and
  // a hero for each bot by seat. A player without one gets the free hero.
  const core = window.BS_CAREER_CORE;
  // online, everyone (you included) wears the hero the room accepted
  const character = seat === ui.me && ui.mode !== 'online' ? equipped('character') : (playerAt(seat)?.character || '');
  const src = core?.heroFace?.(character) || (isBot(seat) ? core?.botHeroFace?.(seat) : core?.heroFace?.('fox')) || '';
  if (src) return { key: 'img:' + src, html: `<img src="${esc(src)}" alt="">` };
  const name = seat === ui.me ? seatName(view, seat) : seatName(view, seat);
  const letter = esc(name.trim().slice(0, 1) || '؟');
  return { key: 'txt:' + letter + isBot(seat), html: letter, letter: true };
}

/* ---------- Hand ---------- */
function legalSet(view) {
  if (view.review || view.phase !== 'playing' || view.turn !== ui.me || ui.busy) return null;
  return new Set(balootActions(view, ui.me).map((a) => a.card));
}
// The cards the rules allow (in open play the others are cuts).
function ruleSet(view) {
  if (view.phase !== 'playing' || view.turn !== ui.me) return null;
  try { return new Set(legalCards(view, ui.me)); } catch { return null; }
}

function renderHand(view) {
  const hand = $('hand');
  const cards = view.hands?.[ui.me] || [];
  const legal = legalSet(view);
  hand.classList.toggle('waiting', !legal);hand.classList.toggle('open-play',Boolean(view.open));
  const width = hand.clientWidth || 360;
  const cw = parseFloat(getComputedStyle(document.body).getPropertyValue('--bl-card-w')) || Math.min(92, width * 0.175);
  const n = cards.length;
  const step = n > 1 ? Math.min(cw * 0.86, (width - cw - 28) / (n - 1)) : 0;
  const total = cw + step * (n - 1);
  const start = (width - total) / 2;
  const existing = new Map([...hand.children].map((el) => [el.dataset.card, el]));
  const keep = new Set();
  cards.forEach((card, i) => {
    let el = existing.get(card);
    if (!el) { el = cardEl(card); el.addEventListener('click', () => onCardTap(card)); hand.appendChild(el); }
    keep.add(card);
    const t = n > 1 ? i / (n - 1) - 0.5 : 0;
    const fan = `rotate(${(t * 16).toFixed(2)}deg) translateY(${(Math.abs(t) * 14).toFixed(1)}px)`;
    el.style.left = (start + i * step).toFixed(1) + 'px';
    el.style.zIndex = String(10 + i);
    el.style.setProperty('--fan', fan);
    if (!el.classList.contains('picked')) el.style.transform = fan;
    el.classList.toggle('legal',Boolean(!view.open&&legal?.has(card)));
    el.classList.remove('cuttable','dim','cut');
    el.classList.toggle('project-selected',Boolean(projectDraft?.cards.includes(card)));
    el.setAttribute('aria-pressed',String(Boolean(projectDraft?.cards.includes(card))));
    if (!legal || !legal.has(card)) el.classList.remove('picked');
  });
  for (const [card, el] of existing) if (!keep.has(card)) el.remove();
  if (ui.picked && !keep.has(ui.picked)) ui.picked = null;
}

// The cards left in the hand slide together as soon as one leaves it.
function closeHandGap() {
  const hand = $('hand');
  const els = [...hand.children];
  const width = hand.clientWidth || 360;
  const cw = parseFloat(getComputedStyle(document.body).getPropertyValue('--bl-card-w')) || Math.min(92, width * 0.175);
  const n = els.length;
  const step = n > 1 ? Math.min(cw * 0.86, (width - cw - 28) / (n - 1)) : 0;
  const start = (width - (cw + step * (n - 1))) / 2;
  els.forEach((el, i) => {
    const t = n > 1 ? i / (n - 1) - 0.5 : 0;
    const fan = `rotate(${(t * 16).toFixed(2)}deg) translateY(${(Math.abs(t) * 14).toFixed(1)}px)`;
    el.style.left = (start + i * step).toFixed(1) + 'px';
    el.style.setProperty('--fan', fan);
    if (!el.classList.contains('picked')) el.style.transform = fan;
  });
}

let projectChoiceKey='', projectChoices=[], projectDraft=null;
function playHumanCard(card){
  const first=ui.view?.tricks?.length===0;
  act({type:'play',card,projectCards:first?projectChoices.map(p=>({type:p.type,cards:[...p.cards]})):[]});
}
function renderProjectPicker(view){
  const box=$('projectPicker');if(!box)return;
  const mine=view?.phase==='playing'&&view.turn===ui.me&&!view.review;
  const key=ui.session+':'+String(view?.handNo)+':'+ui.me;
  if(key!==projectChoiceKey){projectChoiceKey=key;projectChoices=[];projectDraft=null;}
  box.replaceChildren();box.hidden=!mine;
  if(!mine)return;
  const button=(text,action,cls='')=>{const b=document.createElement('button');b.type='button';b.className='bl-project-button '+cls;b.textContent=text;b.onclick=action;b.disabled=ui.sending||ui.busy;box.append(b);return b;};
  if(view.tricks.length===0&&view.hands[ui.me].length===8){
    for(const [index,p]of projectChoices.entries())button(PROJECT_NAME[p.type]+' ×',()=>{projectChoices.splice(index,1);renderProjectPicker(view);},'chosen');
    if(!projectDraft){
      if(projectChoices.length<2)button(projectChoices.length?'مشروع ثانٍ':'مشروع',()=>{projectDraft={type:'sira',cards:[]};renderProjectPicker(view);renderHand(view);});
    }else{
      for(const type of ['sira','fifty','hundred',...(view.contract.type==='sun'?['fourHundred']:[])]){
        const b=button(PROJECT_NAME[type],()=>{projectDraft={type,cards:[]};renderProjectPicker(view);renderHand(view);},projectDraft.type===type?'chosen':'');
        b.setAttribute('aria-pressed',String(projectDraft.type===type));
      }
      const count=document.createElement('span');count.className='bl-project-count';count.textContent=projectDraft.cards.length+' / '+({sira:3,fifty:4,hundred:'4 أو 5',fourHundred:4}[projectDraft.type]);box.append(count);
      let valid=false;try{selectProjects(view.hands[ui.me],view.contract.type,[...projectChoices,projectDraft]);valid=true;}catch{}
      const commit=button('اعتمد',()=>{try{const selected=selectProjects(view.hands[ui.me],view.contract.type,[...projectChoices,projectDraft]);projectChoices=selected;projectDraft=null;renderProjectPicker(view);renderHand(view);}catch{toast('الأوراق ما تطابق المشروع');}},'confirm');commit.disabled ||= !valid;
      button('إلغاء',()=>{projectDraft=null;renderProjectPicker(view);renderHand(view);});
    }
  }else if(view.tricks.length===1&&view.declared?.[ui.me]?.length&&!view.projectShows?.[ui.me]){
    button('نزّل '+view.declared[ui.me].map(p=>PROJECT_NAME[p.type]).join(' + '),()=>act({type:'show_projects'}),'confirm');
  }else box.hidden=true;
  $('hand').classList.toggle('choosing-project',Boolean(projectDraft));
}
function onCardTap(card) {
  const view=ui.view;if(!view||view.phase!=='playing'||view.review)return;
  if(view.turn!==ui.me){toast('انتظر دورك');return;}
  if(projectDraft){
    if(projectChoices.some(p=>p.cards.includes(card)))return;
    projectDraft.cards=projectDraft.cards.includes(card)?projectDraft.cards.filter(c=>c!==card):[...projectDraft.cards,card];
    renderProjectPicker(view);renderHand(view);return;
  }
  if(ui.busy){ui.queued=card;return;}
  const allowed=legalSet(view);if(!allowed?.has(card)){toast('الورقة غير مسموحة في اللعب المقيّد');return;}
  ui.picked=null;playHumanCard(card);
}

/* ---------- Centre ---------- */
function renderCenter(view) {
  const bidding = view.phase === 'bidding' || (view.phase === 'doubling' && false);
  const exposed = $('exposed');
  if (view.phase === 'bidding' && view.exposed) {
    exposed.hidden = false;
    if (exposed.dataset.card !== view.exposed) {
      exposed.dataset.card = view.exposed;
      exposed.innerHTML = '';
      exposed.appendChild(cardEl(view.exposed));
    }
  } else { exposed.hidden = true; exposed.dataset.card = ''; }
  const deck = $('deck');
  deck.hidden = !bidding;
  if (bidding && !deck.childElementCount) {
    for (let i = 0; i < 4; i++) { const img = document.createElement('img'); img.src = cardUrl('??'); img.alt = ''; img.style.transform = `translate(${-i * 1.2}px,${-i * 1.2}px)`; deck.appendChild(img); }
  }
  // Cards on the table for the current trick.
  const trick = view.phase === 'playing' ? view.trick?.cards || [] : [];
  for (let seat = 0; seat < 4; seat++) {
    const slot = slotEl(seat);
    const entry = trick.find((x) => x.seat === seat);
    if (!entry) { if (!slot.dataset.hold) slot.innerHTML = ''; slot.dataset.card = ''; continue; }
    if (slot.dataset.card !== entry.card) {
      slot.dataset.card = entry.card;
      slot.innerHTML = '';
      slot.appendChild(cardEl(entry.card));
    }
  }
}

/* ---------- HUD ---------- */
function teamLabel(team) { return team === teamOf(ui.me) ? 'لنا' : 'لهم'; }
function contractText(view) {
  const c = view.contract;
  if (!c) return '';
  const who = c.buyer === ui.me ? 'أنت' : seatName(view, c.buyer);
  let text = c.type === 'sun' ? `${c.ashkal ? 'أشكل' : 'صن'} · ${esc(who)}` : `حكم ${suitHtml(c.trump)} · ${esc(who)}`;
  if (c.gahwa) text += ' · قهوة ☕';
  else if (c.multiplier > 1) text += ` · ${['', '', 'دبل', 'ثري', 'فور'][c.multiplier]}${c.locked ? ' مقفول' : ''}`;
  return text;
}
function renderHud(view) {
  const us = teamOf(ui.me);
  setScore($('scoreUs'), view.scores[us]);
  setScore($('scoreThem'), view.scores[1 - us]);
  $('scoreTarget').textContent = String(view.target);
  const chip = $('contractChip');
  const text = contractText(view);
  chip.hidden = !text;
  chip.innerHTML = text;
  const tricks = [0, 0];
  for (const t of view.tricks || []) tricks[teamOf(t.winner)] += 1;
  const tc = $('trickCount');
  tc.hidden = view.phase !== 'playing' && view.phase !== 'scored';
  tc.textContent = `الأكلات · لنا ${tricks[us]} · لهم ${tricks[1 - us]}`;
}
function setScore(el, value) {
  if (el.textContent !== String(value)) {
    el.textContent = String(value);
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }
}

/* ---------- Actions & prompt ---------- */
function bidLabel(o, view) {
  if (o.bid === 'pass') return { text: 'بس', cls: 'pass' };
  if (o.bid === 'sun') return { text: view.bidding?.confirm === ui.me ? 'أحوّلها صن' : 'صن', cls: 'sun' };
  if (o.bid === 'ashkal') return { text: 'أشكل', cls: 'sun' };
  const second = view.bidding?.round === 2;
  return { html: `${view.bidding?.confirm === ui.me ? 'أثبّت حكم' : second ? 'ثاني' : 'حكم'}${suitHtml(o.suit)}`, cls: 'hokm' };
}
function doubleLabel(o) {
  const names = { double: 'دبل', triple: 'ثري', four: 'فور', gahwa: 'قهوة ☕', pass: 'بس' };
  return { text: names[o.call] + (o.locked ? ' مقفول' : ''), cls: o.call === 'pass' ? 'pass' : 'hot' };
}
function renderActions(view) {
  const box = $('actions');
  box.innerHTML = '';
  if (ui.busy || view.turn !== ui.me || !['bidding', 'doubling'].includes(view.phase)) return;
  for (const o of balootActions(view, ui.me)) {
    const label = o.type === 'bid' ? bidLabel(o, view) : doubleLabel(o);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bl-act ' + label.cls;
    if (label.html) b.innerHTML = label.html; else b.textContent = label.text;
    b.addEventListener('click', () => act(o));
    box.appendChild(b);
  }
}
function renderPrompt(view) {
  const p = $('prompt');
  if (view.phase === 'finished') { p.textContent = ''; return; }
  if (view.phase === 'scored') { p.textContent = 'انتهت الجولة'; return; }
  const mine = view.turn === ui.me;
  if (view.phase === 'bidding') {
    if (mine) p.innerHTML = view.bidding?.confirm === ui.me ? 'ثبّت الحكم أو حوّلها صن' : view.bidding?.round === 2 ? '<b>الجولة الثانية</b>: ثاني بشكل آخر، أو صن، أو بس' : 'دورك في الشراء';
    else p.textContent = `${seatName(view, view.turn)} يقرر…`;
    return;
  }
  if (view.phase === 'doubling') {
    p.innerHTML = mine ? '<b>الدبل</b>: ترفع المخاطرة أو تمرّر' : `${esc(seatName(view, view.turn))} يفكر في الدبل…`;
    return;
  }
  if (view.phase === 'playing') {
    if (mine) p.textContent = view.review?'اللعب متوقف للمراجعة':'دورك · اختر أي ورقة في اللعب المفتوح';
    else p.textContent = `دور ${seatName(view, view.turn)}`;
  }
}

function render(view = ui.view) {
  if (!view) return;
  ui.view = view;
  renderSeats(view);
  renderCenter(view);
  renderHud(view);
  renderHand(view);
  renderActions(view);
  renderPrompt(view);
  renderClaim(view);
  renderProjectPicker(view);
  renderPublicReview(view);
}

/* ---------- Open play: claims ---------- */
function claimable(view) { return Boolean(view?.open) && canClaim(view, ui.me) && !ui.sending; }
function renderClaim(view) {
  const b = $('claimBtn');
  if (!b) return;
  const on = claimable(view);
  b.hidden = !on;
  if (!on) { ui.claimArmed = 0; b.classList.remove('armed'); $('claimConfirm').hidden = true; }
  $('openBadge').hidden = !view?.open;
}
function armClaim() {
  if (!claimable(ui.view)) return;
  ui.claimArmed = Date.now();
  $('claimBtn').classList.add('armed');
  $('claimConfirm').hidden = false;
  $('claimTarget').replaceChildren();
  for(let seat=0;seat<4;seat++)if(teamOf(seat)!==teamOf(ui.me)){const o=document.createElement('option');o.value=String(seat);o.textContent=seatName(ui.view,seat);$('claimTarget').append(o);}
  $('claimReason').value='cut';$('claimProjectLabel').hidden=true;renderClaimEvidence();
  BalootVoice.unlock();
}
function cancelClaim() { ui.claimArmed = 0; $('claimBtn').classList.remove('armed'); $('claimConfirm').hidden = true; }
function sendClaim() {
  if (!claimable(ui.view)) return cancelClaim();
  if(!selectedClaimTricks().length){toast('اختر أكلة واحدة على الأقل لعرضها للجميع');return;}
  cancelClaim();
  act({ type: 'review_claim',tricks:selectedClaimTricks(),card:($('claimCard').value||'').split(':')[1]||'',target:Number($('claimTarget').value),reason:$('claimReason').value,...($('claimReason').value==='unshown_project'?{project:$('claimProject').value}:{}) });
}
function publicTricks(view){const rows=(view.tricks||[]).map((t,index)=>({...t,index}));if(view.trick?.cards?.length)rows.push({...view.trick,index:rows.length});return rows;}
function selectedClaimTricks(){return [...$('claimEvidence').querySelectorAll('input:checked')].map(x=>Number(x.dataset.trick));}
function refreshClaimCards(){
 const ids=selectedClaimTricks(),target=Number($('claimTarget').value),select=$('claimCard');select.replaceChildren();
 for(const t of publicTricks(ui.view).filter(t=>ids.includes(t.index)))for(const entry of t.cards)if(entry.seat===target){const o=document.createElement('option');o.value=t.index+':'+entry.card;o.textContent='الأكلة '+(t.index+1)+' · '+cardName(entry.card);select.append(o);}
 $('claimCardLabel').hidden=$('claimReason').value!=='cut';
}
function renderClaimEvidence(){
 const box=$('claimEvidence');box.replaceChildren();
 for(const t of publicTricks(ui.view)){const row=document.createElement('label'),check=document.createElement('input'),title=document.createElement('span'),cards=document.createElement('div');row.className='bl-evidence-choice';check.type='checkbox';check.dataset.trick=t.index;check.onchange=refreshClaimCards;title.textContent='الأكلة '+(t.index+1)+(t.winner===undefined?' · جارية':'');cards.className='bl-evidence-mini';for(const entry of t.cards){const img=document.createElement('img');img.src=cardUrl(entry.card);img.alt=seatName(ui.view,entry.seat)+' · '+cardName(entry.card);cards.append(img);}row.append(check,title,cards);box.append(row);}
 refreshClaimCards();
}
let publicReviewKey='';
function renderPublicReview(view){
 const sheet=$('reviewSheet'),review=view.review;if(!sheet)return;
 if(!review){sheet.hidden=true;publicReviewKey='';return;}
 sheet.hidden=false;if(publicReviewKey===review.id)return;publicReviewKey=review.id;
 $('reviewTitle').textContent=(review.kind==='claim'?'مراجعة تسجيل':'مراجعة مشروع')+' · '+seatName(view,review.seat);
 $('reviewDescription').textContent=review.kind==='claim'?'على '+seatName(view,review.target)+' · '+(review.reason==='cut'?'قطع / مخالفة لعب':'مشروع لم ينزل: '+PROJECT_NAME[review.project]):'أوراق المشروع معروضة للجميع قبل تثبيته.';
 const body=$('reviewEvidence');body.replaceChildren();
 if(review.kind==='claim')for(const t of review.tricks){const group=document.createElement('section'),title=document.createElement('h3');title.textContent='الأكلة '+(t.index+1);group.append(title);const row=document.createElement('div');row.className='bl-review-cards';for(const entry of t.cards){const figure=document.createElement('figure'),img=document.createElement('img'),label=document.createElement('figcaption');img.src=cardUrl(entry.card);img.alt=cardName(entry.card);label.textContent=seatName(view,entry.seat);if(entry.seat===review.target&&(!review.card||entry.card===review.card))figure.className='accused';figure.append(img,label);row.append(figure);}group.append(row);body.append(group);}
 else for(const project of review.projects){const group=document.createElement('section'),title=document.createElement('h3'),cards=document.createElement('div');title.textContent=PROJECT_NAME[project.type];cards.className='bl-review-cards';for(const card of project.cards){const img=document.createElement('img');img.src=cardUrl(card);img.alt=cardName(card);cards.append(img);}group.append(title,cards);body.append(group);}
 const owner=review.seat===ui.me; $('reviewControls').hidden=!owner;$('reviewWaiting').hidden=owner;$('reviewWaiting').textContent='بانتظار '+seatName(view,review.seat)+' يؤكد أو يتراجع. اللعب متوقف مؤقتًا.';
 $('reviewConfirm').textContent=review.kind==='claim'?'تأكيد التسجيل واحتساب النتيجة':'تأكيد إنزال المشروع';
 $('reviewConfirm').onclick=()=>act({type:'confirm_review',reviewId:review.id});$('reviewCancel').onclick=()=>act({type:'cancel_review',reviewId:review.id});
 speak(review.kind==='claim'?'review_claim':'review_projects',review.seat,{urgent:true,key:`review:${ui.session}:${review.id}`});
}

function cutLine(proof, view) {
  if (!proof) return '';
  if(proof.reason==='unshown_project')return esc(seatName(view,proof.seat))+' أعلن '+(proof.projects||[]).map(p=>PROJECT_NAME[p]).join(' + ')+' ولم ينزل المشروع قبل ورقته الثانية.';
  const mine = proof.seat === ui.me, who = mine ? 'أنت' : seatName(view, proof.seat);
  const should = (proof.should || []).slice(0, 1).map((c) => cardName(c)).join('');
  const why = (CUT_WHY[proof.reason] || ['وخالف القانون', 'وخالفت القانون'])[mine ? 1 : 0];
  return `${esc(who)} ${mine ? 'لعبت' : 'لعب'} ${cardName(proof.card)} في الأكلة ${proof.trick + 1} ${why}${should ? ` (مثل ${should})` : ''}`;
}

/* ---------- Animation helpers ---------- */
function rectOf(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }
async function fly(card, from, to, { duration = 420, rotate = 0, fromScale = 1, toScale = 1, fade = false } = {}) {
  if (!from || !to) return;
  const el = document.createElement('div');
  el.className = 'bl-flying';
  const img = document.createElement('img');
  img.src = cardUrl(card);
  img.alt = '';
  el.appendChild(img);
  document.body.appendChild(el);
  const w = el.getBoundingClientRect().width || 70;
  const h = w * 1.4;
  el.style.left = (from.x - w / 2) + 'px';
  el.style.top = (from.y - h / 2) + 'px';
  const dx = to.x - from.x, dy = to.y - from.y;
  const frames = [
    { transform: `translate(0,0) rotate(${rotate * 0.3}deg) scale(${fromScale})`, opacity: 1 },
    { transform: `translate(${dx}px,${dy}px) rotate(${rotate}deg) scale(${toScale})`, opacity: fade ? 0 : 1 },
  ];
  try { await el.animate(frames, { duration: reduce() ? 80 : duration / ui.speed, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'forwards' }).finished; } catch {}
  el.remove();
}
function bubble(seat, text, cls = '', ms = 1500) {
  const b = seatEl(seat).querySelector('.bl-bubble');
  b.className = 'bl-bubble ' + cls;
  b.innerHTML = text;
  b.hidden = false;
  void b.offsetWidth;
  b.classList.add('show');
  clearTimeout(b._t);
  b._t = setTimeout(() => { b.hidden = true; }, ms / ui.speed);
}
async function banner(html, ms = 1300) {
  const el = $('banner');
  el.innerHTML = html;
  el.hidden = false;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  await wait(ms);
  el.hidden = true;
}
function toast(text, ms = 2200) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.hidden = true; }, ms);
}
const deckPoint = () => rectOf($('felt').querySelector('.bl-felt-inner'));
function seatPoint(seat) {
  if (seat === ui.me) return rectOf($('hand'));
  const backs = seatEl(seat).querySelector('.bl-backs');
  return rectOf(backs || seatEl(seat));
}

async function animateDeal(view) {
  play('balootShuffle', { volume: 0.7 });
  const center = deckPoint();
  const order = [0, 1, 2, 3].map((i) => (view.dealer + 1 + i) % 4);
  const jobs = [];
  let k = 0;
  for (const count of [3, 2]) for (const seat of order) {
    for (let c = 0; c < count; c++) {
      const delay = k++ * 28;
      jobs.push(wait(delay).then(() => { play('balootDeal', { volume: 0.32 }); return fly('??', center, seatPoint(seat), { duration: 300, rotate: 10, toScale: seat === ui.me ? 1 : 0.5, fade: seat !== ui.me }); }));
    }
  }
  await Promise.all(jobs);
}

async function animateSecondDeal(view, contract) {
  const center = deckPoint();
  const ex = $('exposed');
  const from = !ex.hidden ? rectOf(ex) : center;
  await fly(view.exposed || contract.exposed || '??', from, seatPoint(contract.taker), { duration: 420, toScale: contract.taker === ui.me ? 1 : 0.5, fade: contract.taker !== ui.me });
  const order = [0, 1, 2, 3].map((i) => (view.dealer + 1 + i) % 4);
  const jobs = [];
  let k = 0;
  for (const seat of order) {
    const count = seat === contract.taker ? 2 : 3;
    for (let c = 0; c < count; c++) {
      const delay = k++ * 40;
      jobs.push(wait(delay).then(() => { play('balootDeal', { volume: 0.3 }); return fly('??', center, seatPoint(seat), { duration: 280, rotate: 8, toScale: seat === ui.me ? 1 : 0.5, fade: seat !== ui.me }); }));
    }
  }
  await Promise.all(jobs);
}

async function animatePlay(seat, card) {
  const slot = slotEl(seat);
  let from;
  if (seat === ui.me) {
    const el = [...$('hand').children].find((x) => x.dataset.card === card);
    from = el ? rectOf(el) : rectOf($('hand'));
    el?.remove();
    closeHandGap();
  } else from = seatPoint(seat);
  play('balootPlay', { volume: 0.8 });
  slot.dataset.hold = '1';
  await fly(card, from, rectOf(slot), { duration: 340, rotate: { bottom: 2, top: -3, left: -8, right: 7 }[posOf(seat)], fromScale: seat === ui.me ? 1 : 0.55 });
  slot.innerHTML = '';
  slot.appendChild(cardEl(card));
  slot.dataset.card = card;
}

async function animateTrick(event) {
  const winSlot = slotEl(event.winner);
  winSlot.querySelector('.bl-card')?.classList.add('win');
  await wait(650);
  play('balootTrick', { volume: 0.6 });
  const target = rectOf(seatEl(event.winner).querySelector('.bl-avatar'));
  const jobs = [];
  for (const { seat, card } of event.cards) {
    const slot = slotEl(seat);
    const from = rectOf(slot);
    slot.innerHTML = '';
    slot.dataset.card = '';
    delete slot.dataset.hold;
    jobs.push(fly(card, from, target, { duration: 380, toScale: 0.35, fade: true }));
  }
  await Promise.all(jobs);
}

async function showProjects(event) {
  document.querySelectorAll('.bl-projects').forEach(el=>el.remove());
  const shown = event.shown || [];
  const layer = $('felt').querySelector('.bl-center');
  const boxes = [];
  const bySeat = new Map();
  for (const p of shown) { if (!bySeat.has(p.seat)) bySeat.set(p.seat, []); bySeat.get(p.seat).push(p); }
  for (const [seat, list] of bySeat) {
    const box = document.createElement('div');
    box.className = 'bl-projects';
    box.setAttribute('aria-label',list.map(p=>PROJECT_NAME[p.type]).join(' + '));
    box.innerHTML = list.flatMap((p) => p.cards).map((c) => `<img src="${cardUrl(c)}" alt="${cardName(c)}">`).join('');
    const spot = { bottom: 'left:50%;bottom:24%;transform:translateX(-50%)', top: 'left:50%;top:21%;transform:translateX(-50%)', left: 'left:4%;top:38%', right: 'right:4%;top:38%' }[posOf(seat)];
    box.setAttribute('style', spot);
    layer.appendChild(box);
    boxes.push(box);
  }
  const session=ui.session;
  setTimeout(()=>{if(session===ui.session)boxes.forEach(b=>b.remove());},1800);
}
function bubbleTeam(team) {
  for (let seat = 0; seat < 4; seat++) if (teamOf(seat) === team) bubble(seat, 'مشروعنا الأعلى ✨', 'hot', 1800);
}

/* A short burst of confetti in the team colours. */
function celebrate() {
  if (reduce()) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'bl-confetti';
  document.body.appendChild(canvas);
  const dpr = Math.min(2, devicePixelRatio || 1), w = innerWidth, h = innerHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const c = canvas.getContext('2d');
  c.scale(dpr, dpr);
  const colors = ['#f1cf7e', '#5fe0c0', '#ff9a66', '#fff3d6', '#c4253a'];
  const bits = Array.from({ length: 140 }, () => ({ x: w / 2 + (Math.random() - 0.5) * w * 0.3, y: h * 0.42, vx: (Math.random() - 0.5) * 11, vy: -6 - Math.random() * 9, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, s: 5 + Math.random() * 6, col: colors[Math.floor(Math.random() * colors.length)] }));
  const t0 = performance.now();
  const frame = (now) => {
    const t = now - t0;
    c.clearRect(0, 0, w, h);
    for (const b of bits) {
      b.vy += 0.32; b.x += b.vx; b.y += b.vy; b.r += b.vr; b.vx *= 0.99;
      c.save(); c.translate(b.x, b.y); c.rotate(b.r); c.globalAlpha = Math.max(0, 1 - t / 2400); c.fillStyle = b.col; c.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); c.restore();
    }
    if (t < 2400) requestAnimationFrame(frame); else canvas.remove();
  };
  requestAnimationFrame(frame);
}

function bidText(e) {
  if (e.bid === 'pass') return ['بس', 'pass'];
  if (e.bid === 'sun') return ['صن ☀️', 'hot'];
  if (e.bid === 'ashkal') return ['أشكل', 'hot'];
  return [`${e.round === 2 ? 'ثاني' : 'حكم'} ${suitHtml(e.suit)}`, 'hot'];
}

// Animate one batch of events; `after` is the view once the batch is done.
async function playEvents(events, after, session = ui.session, delivery = {}) {
  for (const [index, e] of events.entries()) {
    if (session !== ui.session) return;
    // Catch up to the authoritative view after a slow animation or reconnect.
    // Old calls must not be presented as if somebody just made them.
    if (delivery.createdAt != null && Date.now() - delivery.createdAt > 4000) return;
    const voiceOptions = { urgent:true, createdAt:delivery.createdAt,
      key:delivery.key == null ? undefined : `${delivery.key}:${index}` };
    if (e.type === 'deal') {
      ui.handClosed=false;BalootVoice.stop();
      render({ ...after, phase: 'dealing', hands: after.hands.map(() => []), trick: null, tricks: [], contract: null });
      $('exposed').hidden = true;
      await animateDeal(after);
      render(after);
      play('balootFlip', { volume: 0.5 });
      await wait(300);
    } else if (e.type === 'bid') {
      const [text, cls] = bidText(e);
      bubble(e.seat, text, cls);
      play(e.bid === 'pass' ? 'click' : 'balootBid', { volume: e.bid === 'pass' ? 0.35 : 0.7 });
      speak(e.bid === 'pass' ? 'بَسْ' : e.bid === 'sun' ? 'صن' : e.bid === 'ashkal' ? 'أشكل' : (e.round === 2 ? 'ثاني ' : 'حكم ') + SUIT_SAY[e.suit], e.seat, voiceOptions);
      await wait(e.bid === 'pass' ? 520 : 820);
    } else if (e.type === 'second_round') {
      await banner('الجولة الثانية<small>ثاني بشكل آخر، أو صن</small>', 1100);
    } else if (e.type === 'redeal') {
      await banner('ما أحد اشترى<small>توزيع جديد</small>', 1200);
    } else if (e.type === 'contract') {
      const c = e.contract;
      const who = c.buyer === ui.me ? 'أنت' : seatName(after, c.buyer);
      play('balootBuy', { volume: 0.8 });
      await banner(c.type === 'sun' ? `${c.ashkal ? 'أشكل' : 'صن'}<small>${esc(who)} اشترى</small>` : `حكم ${suitHtml(c.trump)}<small>${esc(who)} اشترى</small>`, 1100);
      await animateSecondDeal({ ...after, exposed: e.exposed }, { ...c, exposed: e.exposed });
      render(after);
    } else if (e.type === 'double') {
      const names = { double: 'دبل', triple: 'ثري', four: 'فور', gahwa: 'قهوة ☕', pass: 'بس' };
      bubble(e.seat, names[e.call] + (e.locked ? ' مقفول' : ''), e.call === 'pass' ? 'pass' : 'hot');
      if (e.call !== 'pass') {
        play('balootDouble', { volume: 0.9 });
        speak({ double: 'دبل', triple: 'ثري', four: 'فور', gahwa: 'قهوة' }[e.call] + (e.locked ? ' مقفول' : ''), e.seat, voiceOptions);
        flashFelt(e.call === 'gahwa' ? 'gahwa' : 'hot');
        if (e.call === 'gahwa') steam();
        await banner(names[e.call] + (e.call === 'gahwa' ? '<small>الفائز بالجولة يربح الصكّة</small>' : ''), 900);
      } else { speak('بَسْ', e.seat, voiceOptions); await wait(480); }
    } else if (e.type === 'declare') {
      bubble(e.seat, e.projects.map((p) => PROJECT_NAME[p]).join(' + '), 'hot', 1800);
      play('balootChime', { volume: 0.4 });
      speak(e.projects.map((p) => PROJECT_NAME[p]).join(' و '), e.seat, voiceOptions);
    } else if (e.type === 'play') {
      await animatePlay(e.seat, e.card);
    } else if (e.type === 'baloot') {
      bubble(e.seat, 'بلوت 👑', 'hot', 2000);
      play('balootChime', { volume: 0.8 });
      speak('بلوت', e.seat, voiceOptions);
      crown(e.seat);
      await wait(500);
    } else if (e.type === 'trick') {
      await animateTrick(e);
      glow(e.winner);
      if (e.points >= 20) botTalk(teamOf(e.winner) === teamOf(ui.me) ? 'lostTrick' : 'bigTrick', [1, 3]);
    } else if (e.type === 'claim') {
      await showClaim(e, after, session, voiceOptions);
    } else if (e.type === 'projects') {
      await showProjects(e);
    } else if (e.type === 'hand_scored') {
      endHandAudio();
      renderHud({ ...after, scores: e.scores });
      if (e.result.kaboot !== null && e.result.kaboot !== undefined) await kaboot(e.result.kaboot, voiceOptions);
      botTalk(e.result.winnerTeam === teamOf(ui.me) ? 'lostHand' : 'wonHand', [1, 3]);
      await showResult(e.result, e.scores, after);
    } else if (e.type === 'match_finished') {
      showMatchEnd(e.winner, e.scores);
    }
  }
}

/* ---------- Claims & effects ---------- */
async function showClaim(e, view, session = ui.session, voiceOptions = { urgent:true }) {
  const who = e.seat === ui.me ? 'أنت' : seatName(view, e.seat);
  bubble(e.seat, 'سجّل! ⚖️', 'hot claim', 2400);
  speak('سجّل', e.seat, voiceOptions);
  play('balootDouble', { volume: 0.8 });
  for (const slot of document.querySelectorAll('.bl-slot')) { slot.innerHTML = ''; slot.dataset.card = ''; delete slot.dataset.hold; }
  await wait(900);
  if (session !== ui.session) return;
  const ours = e.team === teamOf(ui.me);
  if (e.correct) {
    const p = e.proof;
    seatEl(p.seat)?.classList.add('caught');
    setTimeout(() => seatEl(p.seat)?.classList.remove('caught'), 2600);
    stamp(`<b>${e.reason==='unshown_project'?'لم ينزل المشروع':'قطع'} ✔</b><small>${cutLine(p, view)}</small>`, 'good', p.card);
    speak(e.reason==='unshown_project'?'claim_ok':'صح، قطع', e.seat, voiceOptions);
    play(ours ? 'win' : 'wrong', { volume: 0.6 });
    if (!ours) botTalk('caught', [e.seat]);
  } else {
    stamp(`<b>تسجيل غلط ✘</b><small>${e.seat === ui.me ? 'سجّلت' : esc(who) + ' سجّل'} وما ثبت السبب المختار، فراحت اليد للفريق الثاني</small>`, 'bad');
    speak('غلط', e.seat, voiceOptions);
    play(ours ? 'wrong' : 'win', { volume: 0.6 });
  }
  await wait(2000);
  document.querySelector('.bl-stamp')?.remove();
}
function stamp(html, cls = '', card = '') {
  document.querySelector('.bl-stamp')?.remove();
  const el = document.createElement('div');
  el.className = 'bl-stamp ' + cls;
  el.innerHTML = (card ? `<img src="${cardUrl(card)}" alt="${cardName(card)}">` : '') + `<div>${html}</div>`;
  $('felt').querySelector('.bl-center').appendChild(el);
  return el;
}
function flashFelt(kind) {
  if (reduce()) return;
  const felt = $('felt');
  felt.classList.remove('flash-hot', 'flash-gahwa'); void felt.offsetWidth; felt.classList.add('flash-' + kind);
  setTimeout(() => felt.classList.remove('flash-' + kind), 900);
}
function steam() {
  if (reduce()) return;
  const layer = $('felt').querySelector('.bl-center');
  const cup = document.createElement('div');
  cup.className = 'bl-gahwa';
  cup.innerHTML = '<span>☕</span><i></i><i></i><i></i>';
  layer.appendChild(cup);
  setTimeout(() => cup.remove(), 2600);
}
function crown(seat) {
  const av = seatEl(seat)?.querySelector('.bl-avatar');
  if (!av) return;
  av.classList.remove('crowned'); void av.offsetWidth; av.classList.add('crowned');
  setTimeout(() => av.classList.remove('crowned'), 2200);
}
function glow(seat) {
  const av = seatEl(seat)?.querySelector('.bl-avatar');
  if (!av || reduce()) return;
  av.classList.remove('won'); void av.offsetWidth; av.classList.add('won');
  setTimeout(() => av.classList.remove('won'), 900);
}
async function kaboot(team, voiceOptions = { urgent:true }) {
  const ours = team === teamOf(ui.me);
  speak('كبوت', ours ? ui.me : (ui.me + 1) % 4, voiceOptions);
  if (!reduce()) { const felt = $('felt'); felt.classList.remove('shake'); void felt.offsetWidth; felt.classList.add('shake'); setTimeout(() => felt.classList.remove('shake'), 700); }
  if (ours) celebrate();
  botTalk(ours ? 'kabootThem' : 'kabootUs', [1, 3]);
  await banner(ours ? 'كبوت! 🔥<small>كل الأكلات لكم</small>' : 'كبوت عليكم 😱<small>كل الأكلات لهم</small>', 1300);
}

/* ---------- Table talk: phrases & emoji ---------- */
function showTalk(seat, kind, id, options = {}) {
  if (kind === 'phrase') {
    const p = talkPhrase(id); if (!p) return;
    bubble(seat, esc(p.text), 'talk', 2600);
    speak(p.id, seat, { maxAge:1800, ...options });
  } else if (kind === 'emoji') {
    const em = talkEmoji(id); if (!em) return;
    floatEmoji(seat, em.glyph);
    play('click', { volume: 0.3 });
  }
}
function floatEmoji(seat, glyph) {
  const av = seatEl(seat)?.querySelector('.bl-avatar');
  if (!av) return;
  const r = av.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'bl-emoji-float';
  el.textContent = glyph;
  el.style.left = (r.left + r.width / 2) + 'px';
  el.style.top = (r.top + r.height / 2) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), reduce() ? 900 : 1900);
}
function sendTalk(kind, id) {
  if (Date.now() - ui.lastTalk < 1500) { toast('شوي شوي 😄'); return; }
  ui.lastTalk = Date.now();
  closeTalk();
  BalootVoice.unlock();
  if (ui.mode === 'online') { if (!ui.client?.talk?.(kind, id)) toast('الاتصال غير جاهز'); return; }
  showTalk(ui.me, kind, id);
  if (Math.random() < 0.45) setTimeout(() => botTalk('reply', [1, 2, 3], true), 900 + Math.random() * 900);
}
// Bots (offline) answer at the table now and then, never too often.
function botTalk(context, seats, force = false) {
  if(ui.handClosed||!['bidding','doubling','playing'].includes(ui.room?.state?.phase))return;
  seats = seats.filter((seat) => isBot(seat));
  if (!seats.length) return;
  const now = Date.now();
  if (!force && (now - ui.botTalkAt < 9000 || Math.random() > 0.35)) return;
  const ids = BOT_TALK[context];
  if (!ids?.length) return;
  ui.botTalkAt = now;
  const seat = seats[Math.floor(Math.random() * seats.length)];
  const id = ids[Math.floor(Math.random() * ids.length)];
  const session = ui.session, hand=ui.room.state.handNo;
  const timer=setTimeout(() => {
    ui.botTalkTimers.delete(timer);
    if(session===ui.session&&!ui.handClosed&&ui.room?.state?.handNo===hand&&ui.room.state.phase==='playing')showTalk(seat,id.startsWith('e')?'emoji':'phrase',id,{key:`bot:${session}:${hand}:${now}:${seat}`,createdAt:now});
  },350);
  ui.botTalkTimers.add(timer);
}
function renderTalk() {
  const tab = ui.talkTab;
  for (const b of document.querySelectorAll('.bl-talk-tab')) { const on = b.dataset.tab === tab; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on)); }
  const grid = $('talkGrid');
  grid.className = 'bl-talk-grid ' + tab;
  grid.innerHTML = '';
  for (const it of tab === 'phrase' ? BALOOT_PHRASES : BALOOT_EMOJI) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bl-talk-item';
    b.textContent = tab === 'phrase' ? it.text : it.glyph;
    b.addEventListener('click', () => sendTalk(tab, it.id));
    grid.appendChild(b);
  }
  renderVoiceStatus();
}
function renderVoiceStatus() {
  const status = BalootVoice.getStatus(), toggle = $('voiceToggle');
  toggle.disabled = !status.available;
  toggle.setAttribute('aria-pressed', String(status.available && status.enabled));
  toggle.textContent = !status.available ? 'النداءات مكتوبة' : status.enabled ? '🗣️ الأصوات تعمل' : '🔇 الأصوات مطفأة';
  const messages = {
    'awaiting-recordings':'التسجيلات البشرية الجديدة قيد التجهيز. تظل النداءات مكتوبة أثناء اللعب.',
    unsupported:'متصفحك لا يدعم تشغيل النداءات. تظل العبارات مكتوبة.',
    disabled:'النداءات الصوتية مطفأة.', muted:'الصوت مكتوم من إعدادات اللعبة.',
    locked:'اضغط «جرّب النداء» لتشغيل الصوت.', loading:'جارٍ تحميل النداء…',
    playing:'النداء يُشغّل كاملًا.', error:'تعذر تحميل النداء. تقدر تعيد المحاولة من «جرّب النداء».'
  };
  $('voiceNote').hidden = false;
  $('voiceNote').textContent = messages[status.state] || 'الصوت جاهز.';
  const canPlay = status.available && status.enabled && !['muted','loading','playing'].includes(status.state);
  $('voicePreview').disabled = !canPlay;
  $('voiceReplay').disabled = !canPlay || !status.last;
  $('voiceLast').hidden = !status.lastText;
  $('voiceLast').textContent = status.lastText ? 'آخر نداء: ' + status.lastText : '';
}
function openTalk() { renderTalk(); $('talkSheet').hidden = false; BalootVoice.unlock(); }
function closeTalk() { $('talkSheet').hidden = true; }

/* ---------- Results ---------- */
function showResult(result, scores, view) {
  endHandAudio();
  const us = teamOf(ui.me), them = 1 - us;
  const c = result.contract;
  const buyerTeam = teamOf(c.buyer);
  const ours = buyerTeam === us;
  let title;
  if (result.claim) title = result.winnerTeam === us ? (result.claim.team === us ? 'صدناهم! اليد لنا ⚖️' : 'سجّلوا غلط، اليد لنا') : (result.claim.team === us ? 'تسجيل غلط، اليد لهم' : 'صادوا القطع، اليد لهم');
  else if (result.kaboot !== null) title = result.kaboot === us ? 'كبوت لكم! 🔥' : 'كبوت عليكم';
  else title = result.declWins ? (ours ? 'نجحت شريتكم' : 'نجح الخصم') : (ours ? 'خسرتم الشرية — النقاط للخصم' : 'خسر الخصم الشرية — النقاط لكم');
  $('resultTitle').textContent = title;
  const who = c.buyer === ui.me ? 'أنت' : seatName(view, c.buyer);
  $('resultLine').innerHTML = `${c.type === 'sun' ? (c.ashkal ? 'أشكل' : 'صن') : 'حكم ' + suitHtml(c.trump)} · المشتري ${esc(who)}${c.multiplier > 1 ? ' · ×' + c.multiplier : ''}${c.gahwa ? ' · قهوة' : ''}`;
  const row = (label, a, b, cls = '') => `<tr class="${cls}"><td>${label}</td><td>${a}</td><td>${b}</td></tr>`;
  const rows = [
    row('الأكلات', result.tricks[us], result.tricks[them]),
    row('الأبناط', result.abnat[us], result.abnat[them]),
    row('المشاريع', result.projects[us] || '—', result.projects[them] || '—'),
    row('البلوت', result.baloot[us] || '—', result.baloot[them] || '—'),
    row('نقاط الجولة', result.score[us], result.score[them], 'total'),
  ];
  $('resultRows').innerHTML = rows.join('');
  const note = $('resultClaim');
  if (result.claim) {
    const self = result.claim.seat === ui.me, by = self ? '' : esc(seatName(view, result.claim.seat)) + ' ';
    note.innerHTML = result.claim.correct ? `⚖️ ${by}${self ? 'سجّلت وصدقت' : 'سجّل وصدق'}: ${cutLine(result.claim.proof, view)}` : `⚖️ ${by}${self ? 'سجّلت' : 'سجّل'} وما ثبت السبب المختار، فراحت اليد للفريق الثاني`;
    note.className = 'bl-claim-note ' + (result.claim.team === us ? (result.claim.correct ? 'good' : 'bad') : (result.claim.correct ? 'bad' : 'good'));
    note.hidden = false;
  } else if (result.cuts?.length) {
    note.innerHTML = '👀 ما أحد سجّل: ' + result.cuts.slice(0, 2).map((p) => cutLine(p, view)).join('، ');
    note.className = 'bl-claim-note quiet';
    note.hidden = false;
  } else { note.hidden = true; note.textContent = ''; }
  $('resultTotals').textContent = `لنا ${scores[us]} · لهم ${scores[them]}`;
  const won = result.winnerTeam === us;
  play(won ? 'win' : 'wrong', { volume: 0.6 });
  if (result.kaboot === us) celebrate();
  const sheet = $('resultSheet');
  const finished = view.phase === 'finished';
  $('nextHand').textContent = finished ? 'النتيجة النهائية' : 'الجولة التالية';
  $('nextHand').disabled = !finished;
  sheet.hidden = false;
  return new Promise((resolve) => {
    let done = false;
    const close = () => { if (done) return; done = true; sheet.hidden = true; resolve(); };
    $('nextHand').onclick = close;
    // Online the room deals the next hand by itself.
    if (!finished) setTimeout(close, 5200);
  });
}

function showMatchEnd(winner, scores) {
  const actor=teamOf(ui.me)===winner?ui.me:[0,1,2,3].find(seat=>teamOf(seat)===winner);const signature=window.BS_HERO_FX?.victory(actor===ui.me?window.BS_HERO_FX.current():playerAt(actor)?.character||'fox',{container:$('matchEnd').querySelector('.bl-end-card')||$('matchEnd'),key:'baloot:'+ui.session+':'+winner});
  const us = teamOf(ui.me);
  const won = winner === us;
  $('matchTitle').textContent = won ? 'فزتم بالصكّة! 🏆' : 'راحت الصكّة عليكم';
  $('matchLine').textContent = `لنا ${scores[us]} · لهم ${scores[1 - us]}`;
  const fan = document.querySelector('.bl-end-fan');
  fan.innerHTML = '';
  ['AS', 'KH', 'QD', 'JC', 'TS'].forEach((card, i) => { const img = document.createElement('img'); img.src = cardUrl(card); img.alt = ''; img.style.transform = `translateX(-50%) rotate(${(i - 2) * 11}deg)`; fan.appendChild(img); });
  $('matchEnd').hidden = false;
  if(signature?.dataset.soundPlayed!=='true')play(won ? 'win' : 'wrong');
  if (won) celebrate();
  if (!ui.rewarded) {
    ui.rewarded = true;
    // an account's result is kept by the room; a guest keeps it on this device
    try { if (window.BS_SOCIAL?.isLoggedIn?.()) window.BS_CAREER?.refresh?.(); else window.BS_CAREER?.record?.({ id: 'baloot:' + (ui.room?.code || '') + ':' + (ui.room?.startedAt || ''), game: 'baloot', win: won }); } catch {}
  }
  $('playAgain').textContent = ui.room?.publicMatch ? 'صكّة جديدة' : 'إعادة';
  $('playAgain').hidden = !ui.room?.publicMatch && ui.room?.me?.role !== 'host';
}

function queue(task) {
  const session = ui.session;
  ui.pending = ui.pending.then(async () => {
    if (session !== ui.session) return;
    ui.busy = true;
    try { await task(); } catch (error) { console.error(error); }
    finally {
      if (session !== ui.session) return;
      ui.busy = false; render();
      const card = ui.queued; ui.queued = null;
      if (card && ui.view?.phase === 'playing' && ui.view.turn === ui.me && ui.view.hands?.[ui.me]?.includes(card)) onCardTap(card);
    }
  });
  return ui.pending;
}

/* ---------- Acting ---------- */
function act(action) {
  if (['review_claim','review_projects','confirm_review','cancel_review'].includes(action?.type)) {
    // a claim may come at any moment of the hand, even between the bots' cards
    if (!ui.client) return;
    ui.client.send('baloot', { action });
    return;
  }
  if (ui.busy) return;
  if (!ui.client || ui.sending) return;
  ui.sending = true;
  $('actions').innerHTML = '';
  const ok = ui.client.send('baloot', { action });
  if (!ok) ui.sending = false;
  setTimeout(() => { ui.sending = false; }, 1500);
}

/* ---------- Online ---------- */
function onRoomState(room) {
  ui.room = room;
  ui.sending = false;
  ui.me = room.me?.index ?? 0;
  window.BS_GAME_MENU?.remember('baloot', room.code, { status: room.status === 'finished' ? 'finished' : room.status });
  if (room.status === 'lobby') { if (!$('table').hidden) resetVoiceSession(); ui.batchId = 0; ui.matchStart = null; ui.rewarded = false; showLobby(room); return; }
  const view = room.state;
  if (!view) return;
  if (ui.matchStart !== room.startedAt) { resetVoiceSession(); ui.matchStart = room.startedAt; ui.batchId = 0; ui.seenBatch = false; }
  if(['scored','finished'].includes(view.phase))endHandAudio();
  if ($('table').hidden) showTable();
  // Animate a new batch; on (re)connect only a batch that just happened.
  let events = [];
  const batch = room.batch;
  let createdAt = Date.now();
  if (batch && batch.id > (ui.batchId || 0)) {
    const age = Math.max(0, (room.serverNow || Date.now()) - batch.at);
    const fresh = Number.isFinite(age) && age < 4000;
    if (fresh) { events = batch.events || []; createdAt -= age; }
    ui.batchId = batch.id;
  }
  ui.seenBatch = true;
  queue(async () => {
    const session = ui.session;
    if (events.length) await playEvents(events, view, session, { createdAt, key:`batch:${session}:${room.code}:${room.startedAt}:${batch.id}` });
    if (session !== ui.session) return;
    ui.view = view;
    render(view);
    paintTimer();
  });
}

function showLobby(room) {
  $('setup').hidden = false;
  $('table').hidden = true;
  document.body.classList.remove('bl-playing');
  $('gameMenu').hidden = true;
  $('lobby').hidden = false;
  // your friends who are online, one tap to invite (a friends' room)
  const friends = $('lobbyFriends');
  if (room.publicMatch) { friends.hidden = true; friends.replaceChildren(); friends.dataset.code = ''; }
  else if (friends.dataset.code !== room.code && window.BS_GAME_MENU?.onlineFriends) { friends.dataset.code = room.code; friends.replaceChildren(window.BS_GAME_MENU.onlineFriends('baloot', room.code)); friends.hidden = false; }
  $('lobbyKind').textContent = room.publicMatch ? 'لعب سريع' : 'غرفة خاصة';
  $('lobbyTitle').textContent = room.publicMatch ? 'نجمع اللاعبين…' : 'بانتظار أصحابك';
  $('lobbyCode').textContent = room.code || '——————';
  $('copyCode').hidden = Boolean(room.publicMatch);
  $('inviteFriends').hidden = Boolean(room.publicMatch);
  try { window.BS_INVITES?.set?.({ game: 'baloot', code: room.code, joinable: !room.publicMatch }); } catch {}
  const seats = $('lobbySeats');
  seats.innerHTML = '';
  for (let seat = 0; seat < 4; seat++) {
    const p = room.players.find((x) => x.index === seat);
    const card = document.createElement('div');
    card.className = 'bl-seat-card' + (p ? '' : ' empty');
    card.dataset.team = String(seat % 2);
    const face = p ? (window.BS_CAREER_CORE?.heroFace?.(p.character) || '') : '';
    card.innerHTML = p ? `<span class="bl-mini-face">${face ? `<img src="${esc(face)}" alt="">` : esc((p.name || '؟').slice(0, 1))}</span><span><b>${esc(p.name)}${p.id === room.me?.id ? ' (أنت)' : ''}</b><small>${seat % 2 === 0 ? 'الفريق الأول' : 'الفريق الثاني'} · ${p.connected ? 'متصل' : 'يعيد الاتصال'}</small></span>` : `<span class="bl-mini-face">🤖</span><span><b>مقعد فاضي</b><small>لاعب أو بوت يكمله عند البداية</small></span>`;
    seats.appendChild(card);
  }
  const me = room.players.find((p) => p.id === room.me?.id);
  $('readyBtn').hidden = true;
  $('hostStart').hidden = room.publicMatch || room.me?.role !== 'host';
  $('hostStart').textContent = room.players.length > 1 ? 'ابدأ الآن' : 'ابدأ مع البوتات';
  $('lobbyNote').textContent = room.publicMatch ? 'تبدأ الطاولة تلقائيًا، والمقاعد الفاضية تكملها بوتات بمستويات مختلفة.' : room.me?.role === 'host' ? 'أرسل الرمز لأصحابك. أول لاعبين شركاء، وابدأ متى ما بغيت؛ البوتات تكمل الناقص.' : 'أول لاعبين شركاء. بانتظار المضيف يبدأ.';
  $('lobbyCountdown').hidden = !room.publicMatch || !room.lobbyDeadline;
  paintLobbyRing();
}

function paintLobbyRing() {
  const room = ui.room;
  if (!room || room.status !== 'lobby' || !room.publicMatch || !room.lobbyDeadline) return;
  const left = Math.max(0, room.lobbyDeadline - (room.serverNow + Date.now() - room.clientReceivedAt));
  $('lobbySeconds').textContent = String(Math.ceil(left / 1000));
  const canvas = $('lobbyRing');
  const c = canvas.getContext('2d');
  const css = canvas.clientWidth || 72, dpr = Math.min(3, devicePixelRatio || 1);
  if (canvas.width !== Math.round(css * dpr)) { canvas.width = Math.round(css * dpr); canvas.height = canvas.width; }
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, css, css);
  c.lineWidth = 6; c.lineCap = 'round';
  c.strokeStyle = '#ffffff1c'; c.beginPath(); c.arc(css / 2, css / 2, css / 2 - 5, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = '#f1cf7e'; c.beginPath(); c.arc(css / 2, css / 2, css / 2 - 5, -Math.PI / 2, -Math.PI / 2 + Math.min(1, left / 10000) * Math.PI * 2); c.stroke();
  if (left > 0) requestAnimationFrame(paintLobbyRing);
}

function paintTimer() {
  const room = ui.room;
  for (const el of document.querySelectorAll('.bl-seat')) el.querySelector('.bl-timer').style.setProperty('--t', '1');
  if (!room || room.status !== 'playing' || !room.turnDeadline || !ui.view) return;
  const seat = ui.view.turn;
  if (seat === null || seat === undefined) return;
  const total = room.turnTotal || 30000;
  const left = Math.max(0, room.turnDeadline - (room.serverNow + Date.now() - room.clientReceivedAt));
  seatEl(seat).querySelector('.bl-timer').style.setProperty('--t', String(Math.min(1, left / total)));
  if (left > 0 && ui.room === room) requestAnimationFrame(paintTimer);
}

async function startOnline(kind, code = '') {
  resetVoiceSession();
  applyCosmetics();
  ui.mode = 'online';
  const name = window.BS_GAME_MENU?.playerName?.() || accountName() || 'لاعب';
  const open = (ui.menu?.mode || 'open') !== 'strict';
  message('');
  ui.client?.close?.();
  ui.client = new BoardOnlineClient('baloot', {
    onState: onRoomState,
    onStatus: (s) => { const n = $('netState'); n.hidden = s.online; n.className = 'bl-net' + (s.online ? '' : ' off'); n.textContent = s.text || ''; },
    onError: (text) => { toast(text); ui.sending = false; },
  });
  BalootVoice.unlock();
  try {
    if (kind === 'quick') {
      const res = await fetch('/api/baloot/quick', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, open }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'تعذر إيجاد طاولة الآن');
      await ui.client.join(data.code, name);
    } else if (kind === 'create') await ui.client.create(name, 4, { open });
    else await ui.client.join(code, name);
  } catch (error) {
    ui.client?.close?.();
    ui.client = null;
    throw error;
  }
}

/* ---------- Screens ---------- */
function showTable() {
  $('setup').hidden = true;
  $('table').hidden = false;
  document.body.classList.add('bl-playing');
  $('resultSheet').hidden = true;
  $('matchEnd').hidden = true;
  for (const slot of document.querySelectorAll('.bl-slot')) { slot.innerHTML = ''; slot.dataset.card = ''; delete slot.dataset.hold; }
  for (const backs of document.querySelectorAll('.bl-backs')) { backs.innerHTML = ''; backs.dataset.count = ''; }
  $('hand').innerHTML = '';
  try { window.scrollTo(0, 0); } catch {}
}
function showSetup() {
  resetVoiceSession();
  closeTalk();
  if (ui.room?.code) window.BS_GAME_MENU?.forget('baloot', ui.room.code);
  ui.view = null;
  ui.client?.close?.();
  ui.client = null;
  ui.room = null;
  try { window.BS_INVITES?.set?.(null); } catch {}
  $('table').hidden = true;
  $('setup').hidden = false;
  $('lobby').hidden = true;
  $('matchEnd').hidden = true;
  $('resultSheet').hidden = true;
  document.body.classList.remove('bl-playing');
  $('gameMenu').hidden = false;
  ui.menu?.menu();
}
function message(text) { $('setupMessage').textContent = text; }
function heroFan() {
  const fan = $('heroFan');
  fan.innerHTML = '';
  ['JS', '9S', 'AH', 'KD', 'QD'].forEach((card, i) => {
    const img = document.createElement('img');
    img.src = cardUrl(card);
    img.alt = '';
    img.style.transform = `translateX(-50%) rotate(${(i - 2) * 12}deg) translateY(${Math.abs(i - 2) * 6}px)`;
    img.style.zIndex = String(i);
    fan.appendChild(img);
  });
}

function showLog() {
  const history = (ui.view?.history || []).filter((h) => !h.redeal);
  const us = teamOf(ui.me);
  $('logRows').innerHTML = history.length ? history.map((h, i) => `<tr><td>${i + 1} · ${h.contract.type === 'sun' ? 'صن' : 'حكم ' + suitHtml(h.contract.trump)}</td><td>${h.score[us]}</td><td>${h.score[1 - us]}</td></tr>`).join('') : '<tr><td colspan="3">ما في جولات بعد</td></tr>';
  // the tricks of this hand, card by card: what you need to prove a cut
  const view = ui.view, tricks = [...(view?.tricks || [])];
  if (view?.phase === 'playing' && view.trick?.cards?.length) tricks.push({ ...view.trick, open: true });
  const box = $('logTricks');
  box.hidden = !tricks.length;
  box.innerHTML = tricks.length ? '<h3>أكلات هذي الجولة</h3>' + tricks.map((t, i) => `<div class="bl-log-trick${t.open ? ' open' : ''}"><span>${i + 1}</span>${t.cards.map((x) => `<figure class="${x.seat === t.winner ? 'won' : ''}"><img src="${cardUrl(x.card)}" alt="${cardName(x.card)}"><figcaption>${esc(x.seat === ui.me ? 'أنت' : seatName(view, x.seat))}</figcaption></figure>`).join('')}</div>`).join('') : '';
  $('logSheet').hidden = false;
}

function init() {
  applyCosmetics();
  heroFan();
  // 33.0.0: one menu like every game: open or strict, «العب الحين», or a room with friends
  ui.menu = window.BS_GAME_MENU.mount($('gameMenu'), {
    game: 'baloot',
    modes: [
      { id: 'open', label: 'مفتوح', hint: 'تقدر تقطع، والخصم يسجّل', note: 'اللعب المفتوح: تقدر تلعب أي ورقة، والفريق الثاني يسجّل عليك إذا قطعت. كل الأوراق ظاهرة بدون تلميح للقطع. اختر الورقة التي تريد، والتسجيل يبدأ بعرض الأكلات ثم التأكيد.' },
      { id: 'strict', label: 'مقيّد', hint: 'القانون يمنع الغلط', note: 'المقيّد: ما تقدر تلعب إلا الورقة اللي يسمح فيها القانون، فما فيه قطع ولا تسجيل.' },
    ],
    modesLabel: 'طريقة اللعب',
    quickNote: 'نجمع لاعبين خلال 10 ثوانٍ، والبوتات تكمل الطاولة',
    roomNote: 'أول لاعبين يدخلون شركاء. تبدأ متى ما بغيت، والبوتات تكمل المقاعد.',
    loadout: 'cards', loadoutHref: '/shop?filter=deck', loadoutLabel: 'ورقك من المتجر',
    onQuick: () => startOnline('quick'),
    onCreate: () => startOnline('create'),
    onJoin: ({ code }) => startOnline('join', code),
    onResume: ({ code }) => startOnline('join', code),
  });
  $('hostStart').addEventListener('click', () => ui.client?.send('start'));
  $('leaveLobby').addEventListener('click', showSetup);
  addEventListener('pointerdown', () => BalootVoice.unlock(), { once: true, passive: true });
  $('inviteFriends').addEventListener('click', () => { if (window.BS_INVITES?.open) window.BS_INVITES.open(); else $('copyCode').click(); });
  $('copyCode').addEventListener('click', async () => { try { await navigator.clipboard.writeText(ui.room?.code || ''); toast('نسخنا الرمز'); } catch { toast('الرمز: ' + (ui.room?.code || '')); } });
  $('leaveTable').addEventListener('click', () => { if (ui.room?.status === 'playing' && !confirmLeave()) return; showSetup(); });
  $('openLog').addEventListener('click', showLog);
  $('claimBtn').addEventListener('click', () => (ui.claimArmed ? cancelClaim() : armClaim()));
  $('claimReason').addEventListener('change',()=>{$('claimProjectLabel').hidden=$('claimReason').value!=='unshown_project';refreshClaimCards();});
  $('claimTarget').addEventListener('change',refreshClaimCards);
  $('claimYes').addEventListener('click', sendClaim);
  $('claimNo').addEventListener('click', cancelClaim);
  $('talkBtn').addEventListener('click', () => ($('talkSheet').hidden ? openTalk() : closeTalk()));
  $('talkClose').addEventListener('click', closeTalk);
  for (const b of document.querySelectorAll('.bl-talk-tab')) b.addEventListener('click', () => { ui.talkTab = b.dataset.tab; renderTalk(); });
  $('voiceToggle').addEventListener('click', () => { BalootVoice.setEnabled(!BalootVoice.enabled); renderTalk(); if (BalootVoice.enabled) speak('هلا والله', ui.me, { urgent: true }); });
  $('voicePreview').addEventListener('click', () => BalootVoice.preview());
  $('voiceReplay').addEventListener('click', () => { void BalootVoice.unlock(); BalootVoice.replay(); });
  addEventListener('bs-baloot-voice-change', renderVoiceStatus);
  renderVoiceStatus();
  addEventListener('bs-board-talk', (event) => { const d = event.detail || {}; if (ui.mode === 'online' && Number.isInteger(d.seat)) showTalk(d.seat, d.kind, d.id,
    { key:d.at == null ? undefined : `talk:${ui.session}:${d.from}:${d.at}:${d.id}` }); });
  $('closeLog').addEventListener('click', () => { $('logSheet').hidden = true; });
  $('playAgain').addEventListener('click', () => {
    $('matchEnd').hidden = true;
    // a public table is over after its match: the next one is a new table
    if (ui.room?.publicMatch) { const was = ui.room; showSetup(); ui.menu?.setMode(was.open === false ? 'strict' : 'open'); startOnline('quick').catch((error) => toast(error.message)); }
    else ui.client?.send('rematch');
  });
  $('endExit').addEventListener('click', showSetup);
  $('felt').addEventListener('click', (e) => { if (ui.picked && !e.target.closest('.bl-hand')) { const card = ui.picked; if (legalSet(ui.view)?.has(card)) { ui.picked = null; playHumanCard(card); } } });
  addEventListener('resize', () => render());
  addEventListener('bs-career-change', () => { applyCosmetics(); heroFan(); });
  const params = new URLSearchParams(location.search);
  const code = params.get('room') || params.get('code');
  if (code && /^\d{6}$/.test(code)) startOnline('join', code).catch((error) => { message(error.message || 'تعذر الاتصال'); toast(error.message || 'تعذر الاتصال'); });
  window.BS_AUDIO?.prime?.(['balootDeal', 'balootPlay', 'balootTrick', 'balootShuffle', 'balootBid', 'balootBuy', 'balootDouble', 'balootChime', 'balootFlip']);
}
let leaveArmed = 0;
function confirmLeave() {
  if (Date.now() - leaveArmed < 2500) return true;
  leaveArmed = Date.now();
  toast('اضغط ✕ مرة ثانية للخروج من الصكّة');
  return false;
}

window.BS_BALOOT = { ui, render, act, startOnline };
init();
