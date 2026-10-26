/* Tahdia 32.1.0 — table talk for Baloot: ready phrases and emoji.
   Shared by the table (offline and online) and the BoardRoom, which relays
   only these ids (no free text), so a room never carries anything else. */
export const BALOOT_PHRASES = Object.freeze([
  { id: 'p1', text: 'هلا والله 👋', say: 'هلا والله' },
  { id: 'p2', text: 'بالتوفيق 🤝', say: 'بالتوفيق' },
  { id: 'p3', text: 'يا حلو اللعب 🔥', say: 'يا حلو اللعب' },
  { id: 'p4', text: 'شريكي ذيب 🐺', say: 'شريكي ذيب' },
  { id: 'p5', text: 'ركّز يا شريك 👀', say: 'ركز يا شريك' },
  { id: 'p6', text: 'لا تطوّل 😅', say: 'لا تطول' },
  { id: 'p7', text: 'وش ذا الحظ! 😳', say: 'وش ذا الحظ' },
  { id: 'p8', text: 'صكّة ولا أحلى 😎', say: 'صكة ولا أحلى' },
  { id: 'p9', text: 'قهوة؟ ☕', say: 'قهوة؟' },
  { id: 'p10', text: 'خلها علينا 💪', say: 'خلها علينا' },
  { id: 'p11', text: 'قطعت؟ 🤨', say: 'قطعت؟' },
  { id: 'p12', text: 'حلال عليكم 👏', say: 'حلال عليكم' },
  { id: 'p13', text: 'يا ساتر 😬', say: 'يا ساتر' },
  { id: 'p14', text: 'كبوت يا حبيبي 🔥', say: 'كبوت يا حبيبي' },
  { id: 'p15', text: 'أبشر بالخير ✨', say: 'أبشر بالخير' },
  { id: 'p16', text: 'معليش، الجاية لنا 🙏', say: 'معليش، الجاية لنا' },
]);

export const BALOOT_EMOJI = Object.freeze([
  { id: 'e1', glyph: '😂' }, { id: 'e2', glyph: '🔥' }, { id: 'e3', glyph: '👏' }, { id: 'e4', glyph: '😎' },
  { id: 'e5', glyph: '😡' }, { id: 'e6', glyph: '🤔' }, { id: 'e7', glyph: '😱' }, { id: 'e8', glyph: '🥲' },
  { id: 'e9', glyph: '☕' }, { id: 'e10', glyph: '👑' }, { id: 'e11', glyph: '💪' }, { id: 'e12', glyph: '🙏' },
  { id: 'e13', glyph: '🤝' }, { id: 'e14', glyph: '😅' }, { id: 'e15', glyph: '🫡' }, { id: 'e16', glyph: '🤐' },
]);

const PHRASE = new Map(BALOOT_PHRASES.map((p) => [p.id, p]));
const EMOJI = new Map(BALOOT_EMOJI.map((e) => [e.id, e]));
export const talkPhrase = (id) => PHRASE.get(String(id)) || null;
export const talkEmoji = (id) => EMOJI.get(String(id)) || null;
export function validTalk(kind, id) { return kind === 'phrase' ? Boolean(talkPhrase(id)) : kind === 'emoji' ? Boolean(talkEmoji(id)) : false; }

// What bots say at the table (offline): a context → phrase or emoji ids.
export const BOT_TALK = Object.freeze({
  greet: ['p1', 'p2'],
  bigTrick: ['p3', 'p10', 'e2', 'e4'],
  lostTrick: ['p13', 'e8', 'e6'],
  kabootUs: ['p14', 'e10', 'e2'],
  kabootThem: ['p13', 'e7'],
  wonHand: ['p8', 'p12', 'e3'],
  lostHand: ['p16', 'e8'],
  caught: ['p11', 'e5'],
  reply: ['p15', 'e1', 'e3', 'p1'],
  gahwa: ['p9', 'e9'],
});
