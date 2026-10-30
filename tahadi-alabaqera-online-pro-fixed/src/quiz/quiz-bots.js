// 33.0.0: the quiz is played online. Someone alone in a room, or with nobody to
// meet in «العب الحين», plays against bots — each with its own strength: an easy
// bot answers later and misses more, a hard one is quick and usually right.
export const QUIZ_BOT_NAMES = Object.freeze(['سهم', 'نجمة', 'فارس', 'غيمة', 'ليث', 'ريم', 'بدر', 'لمى', 'شهد', 'عزوز']);
const ACCURACY = Object.freeze({ easy: 0.45, medium: 0.65, hard: 0.82 });
const DELAY_MS = Object.freeze({ easy: [6000, 14000], medium: [4000, 10500], hard: [2500, 7500] });

const unit = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
export function pickQuizBotLevel(rng = unit) {
  const x = rng();
  return x < 0.35 ? 'easy' : x < 0.75 ? 'medium' : 'hard';
}

/** New bots for a room or a quick match, named apart from the people in it. */
export function makeQuizBots(count, takenNames = [], rng = unit) {
  const taken = new Set(takenNames), bots = [];
  for (let i = 0; i < count; i++) {
    const pool = QUIZ_BOT_NAMES.filter((name) => !taken.has(name));
    const name = pool.length ? pool[Math.floor(rng() * pool.length)] : 'لاعب ' + (i + 1);
    taken.add(name);
    bots.push({ id: 'bot-' + crypto.randomUUID(), name, bot: true, level: pickQuizBotLevel(rng) });
  }
  return bots;
}

/** When each bot answers this question, and with what: {botId: {at, choice}}. */
export function planBotAnswers({ opensAt, deadline, options, correct }, bots, rng = unit) {
  const plan = {};
  for (const bot of bots) {
    const level = ACCURACY[bot.level] ? bot.level : 'medium';
    const [min, max] = DELAY_MS[level];
    const at = Math.min(deadline - 600, opensAt + min + Math.floor(rng() * (max - min)));
    let choice = correct;
    if (rng() >= ACCURACY[level] && options > 1) {
      const wrong = Array.from({ length: options }, (_, i) => i).filter((i) => i !== correct);
      choice = wrong[Math.floor(rng() * wrong.length)];
    }
    plan[bot.id] = { at: Math.max(opensAt, at), choice };
  }
  return plan;
}

/** The bot answers that are due now (not given yet). */
export function dueBotAnswers(plan, answered, now) {
  return Object.entries(plan || {}).filter(([id, a]) => !answered[id] && a.at <= now).map(([id, a]) => ({ id, choice: a.choice, at: a.at }));
}

/** The next moment a bot still has to answer (Infinity when none). */
export function nextBotAnswer(plan, answered) {
  let next = Infinity;
  for (const [id, a] of Object.entries(plan || {})) if (!answered[id]) next = Math.min(next, a.at);
  return next;
}

/** Everyone else has answered: the bots answer within a second or two instead of
    keeping the people waiting for their slower moment. */
export function hurryBotAnswers(plan, answered, now, rng = unit) {
  for (const [id, a] of Object.entries(plan || {})) if (!answered[id]) a.at = Math.min(a.at, now + 800 + Math.floor(rng() * 1500));
  return nextBotAnswer(plan, answered);
}
