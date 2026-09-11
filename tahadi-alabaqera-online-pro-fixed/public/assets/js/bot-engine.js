(function (global) {
  'use strict';

  const PROFILES = Object.freeze({
    medium: Object.freeze({
      id: 'medium',
      label: 'متوسط',
      quizAccuracy: 0.68,
      thinkMin: 720,
      thinkMax: 1450,
      reactionMin: 330,
      reactionMax: 520,
      diceBankAt: 14,
      scoreFactor: 0.72,
    }),
    pro: Object.freeze({
      id: 'pro',
      label: 'محترف',
      quizAccuracy: 0.87,
      thinkMin: 440,
      thinkMax: 980,
      reactionMin: 205,
      reactionMax: 350,
      diceBankAt: 20,
      scoreFactor: 0.9,
    }),
  });

  const LUDO_STARTS = [0, 13, 26, 39];
  const LUDO_SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
  const BOT_CONTROL_SELECTOR = '.bot-difficulty-control[data-bot-difficulty]';
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const randomBetween = (min, max, rng = Math.random) => Math.round(min + clamp(rng(), 0, 0.999999) * (max - min));

  function resolveDifficulty(requested = 'auto', level = 1) {
    if (requested === 'medium' || requested === 'pro') return requested;
    return Number(level || 1) >= 8 ? 'pro' : 'medium';
  }

  function storedDifficulty() {
    const progress = global.TAHADI_PROGRESS;
    const requested = progress?.botDifficulty?.() || progress?.read?.()?.botDifficulty || 'auto';
    const level = progress?.read?.()?.level || 1;
    return resolveDifficulty(requested, level);
  }

  function profile(difficulty = storedDifficulty()) {
    return PROFILES[resolveDifficulty(difficulty, global.TAHADI_PROGRESS?.read?.()?.level || 1)];
  }

  function quizWillAnswerCorrect(difficulty = storedDifficulty(), rng = Math.random) {
    return clamp(rng(), 0, 0.999999) < profile(difficulty).quizAccuracy;
  }

  function chooseQuizAnswer(correctIndex, optionCount, difficulty = storedDifficulty(), rng = Math.random) {
    const count = Math.max(1, Number(optionCount) || 1);
    if (quizWillAnswerCorrect(difficulty, rng) || count === 1) return clamp(correctIndex, 0, count - 1);
    const wrong = Array.from({ length: count }, (_, index) => index).filter((index) => index !== correctIndex);
    return wrong[Math.floor(clamp(rng(), 0, 0.999999) * wrong.length)] ?? 0;
  }

  function roll(rng = Math.random) {
    return 1 + Math.floor(clamp(rng(), 0, 0.999999) * 6);
  }

  function ludoGlobal(player, progress) {
    if (progress < 0 || progress > 51) return null;
    return (LUDO_STARTS[player] + progress) % 52;
  }

  function scoreLudoMove(state, tokenIndex, die, actor) {
    const tokens = state.players?.[actor]?.tokens || [];
    const from = Number(tokens[tokenIndex]);
    const to = from === -1 ? 0 : from + die;
    let score = to;
    if (to === 56) score += 5000;
    if (from === -1 && die === 6) score += 320;
    if (to > 51) score += 520 + to * 4;
    if (to <= 51) {
      const destination = ludoGlobal(actor, to);
      if (LUDO_SAFE.has(destination)) score += 90;
      (state.players || []).forEach((player, playerIndex) => {
        if (playerIndex === actor) return;
        (player.tokens || []).forEach((progress) => {
          if (progress >= 0 && progress <= 51 && ludoGlobal(playerIndex, progress) === destination && !LUDO_SAFE.has(destination)) score += 850;
        });
      });
      const exposed = (state.players || []).some((player, playerIndex) => playerIndex !== actor && (player.tokens || []).some((progress) => {
        if (progress < 0 || progress > 51) return false;
        const gap = (destination - ludoGlobal(playerIndex, progress) + 52) % 52;
        return gap >= 1 && gap <= 6;
      }));
      if (exposed && !LUDO_SAFE.has(destination)) score -= 75;
    }
    return score;
  }

  function chooseLudoMove(state, legalMoves, die, difficulty = storedDifficulty(), rng = Math.random) {
    const moves = Array.isArray(legalMoves) ? legalMoves.filter(Number.isInteger) : [];
    if (!moves.length) return null;
    const actor = Number.isInteger(state?.turn) ? state.turn : 0;
    const ranked = moves.map((move) => ({ move, score: scoreLudoMove(state, move, die, actor) }))
      .sort((a, b) => b.score - a.score || a.move - b.move);
    if (resolveDifficulty(difficulty, 1) === 'pro' || ranked.length === 1) return ranked[0].move;
    const pool = ranked.slice(0, Math.min(2, ranked.length));
    return pool[Math.floor(clamp(rng(), 0, 0.999999) * pool.length)].move;
  }

  function scoreJackarooAction(state, action) {
    if (!action) return -10000;
    if (action.type === 'discard') return -5000;
    if (action.type === 'enter') return 900;
    if (action.type === 'split7') return 580;
    if (action.type === 'swap') {
      const own = Number(state?.players?.[action.owner]?.marbles?.[action.marble] || 0);
      const other = Number(state?.players?.[action.otherOwner]?.marbles?.[action.otherMarble] || 0);
      return 420 + Math.max(0, other - own) * 8;
    }
    const owner = Number.isInteger(action.owner) ? action.owner : 0;
    const marble = Number.isInteger(action.marble) ? action.marble : 0;
    const from = Number(state?.players?.[owner]?.marbles?.[marble] ?? 0);
    const steps = Number(action.steps || 0);
    const to = action.backward ? (from - steps + 52) % 52 : from + steps;
    let score = 100 + steps * 7;
    if (to === 56) score += 4000;
    if (to > 51) score += 620;
    if (action.type === 'moveAny5') score += 80;
    return score;
  }

  function chooseJackarooAction(state, legalActions, difficulty = storedDifficulty(), rng = Math.random) {
    const actions = Array.isArray(legalActions) ? legalActions : [];
    if (!actions.length) return null;
    const ranked = actions.map((action, index) => ({ action, index, score: scoreJackarooAction(state, action) }))
      .sort((a, b) => b.score - a.score || a.index - b.index);
    if (resolveDifficulty(difficulty, 1) === 'pro' || ranked.length === 1) return ranked[0].action;
    const viable = ranked.filter((entry) => entry.action.type !== 'discard');
    const pool = (viable.length ? viable : ranked).slice(0, Math.min(3, viable.length || ranked.length));
    return pool[Math.floor(clamp(rng(), 0, 0.999999) * pool.length)].action;
  }

  function shouldBankDice(state, difficulty = storedDifficulty()) {
    const score = Number(state?.score || 0);
    const turnTotal = Number(state?.turnTotal || 0);
    const target = Number(state?.target || 50);
    if (score + turnTotal >= target) return true;
    const base = profile(difficulty).diceBankAt;
    const pressure = Math.max(0, Number(state?.opponentScore || 0) - score);
    const adjusted = pressure >= 12 ? base + 4 : base;
    return turnTotal >= adjusted;
  }

  function thinkDelay(difficulty = storedDifficulty(), rng = Math.random) {
    const current = profile(difficulty);
    return randomBetween(current.thinkMin, current.thinkMax, rng);
  }

  function reactionTime(difficulty = storedDifficulty(), rng = Math.random) {
    const current = profile(difficulty);
    return randomBetween(current.reactionMin, current.reactionMax, rng);
  }

  function arcadeScore(game, playerResult = {}, difficulty = storedDifficulty(), rng = Math.random) {
    const current = profile(difficulty);
    const bases = { memory: 112, reaction: 365, logic: 158, puzzle: 940, accuracy: 255, draw: 150, secret: 165, order: 170, auction: 120, cipher: 168 };
    const base = bases[game] || 150;
    const correctness = playerResult.correct === false ? 1.08 : 0.94;
    const noise = 0.84 + clamp(rng(), 0, 0.999999) * 0.32;
    return Math.max(1, Math.round(base * current.scoreFactor * correctness * noise));
  }

  function applyDifficulty(value) {
    const clean = ['auto', 'medium', 'pro'].includes(value) ? value : 'auto';
    global.TAHADI_PROGRESS?.setBotDifficulty?.(clean);
    if (typeof document !== 'undefined' && document?.documentElement) {
      document.documentElement.dataset.botDifficulty = resolveDifficulty(clean, global.TAHADI_PROGRESS?.read?.()?.level || 1);
    }
    return storedDifficulty();
  }

  function isGameActive(doc = document) {
    if (!doc?.body) return false;
    if (doc.body.classList?.contains?.('game-running') || doc.body.classList?.contains?.('tahadi-game-active')) return true;
    const screens = doc.querySelectorAll
      ? Array.from(doc.querySelectorAll('#game,#sdGame,#quickArena,#match,#lgGame'))
      : ['#game', '#sdGame', '#quickArena', '#match', '#lgGame'].map((selector) => doc.querySelector?.(selector)).filter(Boolean);
    return screens.some((screen) => !screen.classList?.contains?.('hidden'));
  }

  function syncDifficultyVisibility() {
    if (typeof document === 'undefined' || !document?.body) return false;
    const active = isGameActive(document);
    document.body.classList.toggle('tahadi-game-active', active);
    const control = document.querySelector(BOT_CONTROL_SELECTOR);
    if (control) {
      control.hidden = active;
      control.setAttribute('aria-hidden', String(active));
    }
    return active;
  }

  function mountDifficultyControl(target) {
    if (typeof document === 'undefined' || !document?.createElement) return null;
    if (document.querySelector(BOT_CONTROL_SELECTOR)) return document.querySelector(BOT_CONTROL_SELECTOR);
    const host = target || document.querySelector('#setup,#home,#entry,.arcade-hero-row,.game-setup,.lobby-panel,.online-card');
    if (!host) return null;
    const requested = global.TAHADI_PROGRESS?.botDifficulty?.() || 'auto';
    const wrap = document.createElement('label');
    wrap.className = 'bot-difficulty-control';
    wrap.dataset.botDifficulty = '';
    wrap.innerHTML = '<span><i aria-hidden="true">🤖</i><b>مستوى البوت</b><small>يتدخل تلقائيًا عند عدم وجود منافس</small></span><select aria-label="مستوى البوت"><option value="auto">تلقائي</option><option value="medium">متوسط</option><option value="pro">محترف</option></select>';
    const select = wrap.querySelector('select');
    select.value = ['auto', 'medium', 'pro'].includes(requested) ? requested : 'auto';
    select.addEventListener('change', () => {
      const resolved = applyDifficulty(select.value);
      global.BS_PLATFORM?.toast?.(`تم ضبط البوت: ${profile(resolved).label}`);
    });
    host.appendChild(wrap);
    applyDifficulty(select.value);
    syncDifficultyVisibility();
    return wrap;
  }

  const api = Object.freeze({
    WAIT_FOR_HUMAN_MS: 12000,
    PROFILES,
    profile,
    resolveDifficulty,
    difficulty: storedDifficulty,
    applyDifficulty,
    isGameActive,
    syncDifficultyVisibility,
    mountDifficultyControl,
    quizWillAnswerCorrect,
    chooseQuizAnswer,
    chooseLudoMove,
    chooseJackarooAction,
    shouldBankDice,
    thinkDelay,
    reactionTime,
    arcadeScore,
    roll,
  });
  global.TAHADI_BOT = api;

  try {
    const requestedDifficulty = new URLSearchParams(global.location?.search || '').get('difficulty');
    if (['medium', 'pro'].includes(requestedDifficulty)) applyDifficulty(requestedDifficulty);
  } catch {}

  if (typeof document !== 'undefined' && document?.addEventListener) {
    const ready = () => mountDifficultyControl();
    const boot = () => {
      ready();
      document.addEventListener('click', (event) => {
        const button = event.target?.closest?.('[data-start],#start,#startBot,#startBtn,#classicStartBtn,#sdNewLocal,#hostStart');
        if (button) {
          document.body?.classList.add('tahadi-game-active');
          syncDifficultyVisibility();
        }
      }, true);
      if (global.MutationObserver && document.body) {
        const observer = new MutationObserver(syncDifficultyVisibility);
        observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
      }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
  }
}(window));
