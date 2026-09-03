import { CATEGORIES } from "./questions-data.js";

const params = new URLSearchParams(location.search);
const matchId = params.get("quickMatch") || params.get("match") || "";
const byId = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function tsMillis(value) {
  try { return value?.toMillis?.() || 0; } catch { return 0; }
}
function waitForFirebase(timeout = 10_000) {
  if (window.TahdiaOnline?.db) return Promise.resolve(window.TahdiaOnline);
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (window.TahdiaOnline?.db) return resolve(window.TahdiaOnline);
      if (Date.now() - start > timeout) return reject(new Error(window.TahdiaOnlineError || "تعذر تشغيل Firebase"));
      setTimeout(tick, 160);
    };
    tick();
  });
}

const playable = [];
const categoryByQuestion = new Map();
for (const category of CATEGORIES) {
  for (const q of category.questions || []) {
    if (!q?.id || !q?.q || !q?.a || !Array.isArray(q.distractors) || q.distractors.length < 3) continue;
    if (q.media || q.memory) continue; // المواجهة السريعة تستخدم أسئلة نصية واضحة فقط.
    playable.push(q);
    categoryByQuestion.set(q.id, category);
  }
}
const questionMap = new Map(playable.map((q) => [q.id, q]));

function randomQuestionIds(count = 10) {
  const pool = [...playable];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length)).map((q) => q.id);
}
function seededChoices(q) {
  const list = [q.a, ...q.distractors.slice(0, 3)];
  let seed = 2166136261;
  for (const ch of q.id) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  for (let i = list.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function showToast(message) {
  const el = byId("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.add("hidden"), 3200);
}

async function updateIdentityLabel() {
  try {
    const fb = await waitForFirebase();
    const identity = await fb.ensureIdentity();
    const label = byId("quickIdentity");
    if (label) label.textContent = `ستدخل باسم: ${identity.name}`;
    const net = byId("net"), netText = byId("netText");
    if (net) net.className = "net ok";
    if (netText) netText.textContent = "اللعب السريع جاهز";
  } catch {
    const label = byId("quickIdentity");
    if (label) label.textContent = "الدخول تلقائي — لا يلزم كتابة اسم";
  }
}
updateIdentityLabel();

if (!matchId) {
  // الصفحة العادية للغرف واللعب السريع؛ لا نشغّل محرك المباراة هنا.
} else {
  startQuickMatch().catch((error) => {
    console.error("quick match failed", error);
    byId("entry")?.classList.add("hidden");
    byId("room")?.classList.add("hidden");
    byId("quickArena")?.classList.remove("hidden");
    const q = byId("qmQuestion");
    if (q) q.textContent = "تعذر فتح المواجهة";
    const status = byId("qmStatus");
    if (status) status.textContent = error?.message || "خطأ اتصال";
    byId("qmChoices")?.replaceChildren();
  });
}

async function startQuickMatch() {
  const fb = await waitForFirebase();
  const me = await fb.ensureIdentity();
  const matchRef = fb.doc(fb.db, "matches", matchId);
  const net = byId("net"), netText = byId("netText");
  if (net) net.className = "net ok";
  if (netText) netText.textContent = "مواجهة مباشرة";
  const first = await fb.getDoc(matchRef);
  if (!first.exists()) throw new Error("المواجهة غير موجودة أو انتهت");
  const firstData = first.data();
  if (!Array.isArray(firstData.players) || !firstData.players.some((p) => p.id === me.id)) {
    throw new Error("هذه المواجهة تخص لاعبين آخرين");
  }

  // إزالة سجل الانتظار بعد الوصول للمواجهة.
  fb.deleteDoc(fb.doc(fb.db, "match_queue", me.id)).catch(() => {});

  byId("entry")?.classList.add("hidden");
  byId("room")?.classList.add("hidden");
  byId("quickArena")?.classList.remove("hidden");

  const game = {
    fb, me, matchRef, data: firstData,
    unsubMatch: null, answerUnsubs: [], tick: null,
    lastQuestionIndex: -1, finalizing: false, advancing: false
  };

  await initializeIfNeeded(game);
  game.unsubMatch = fb.onSnapshot(matchRef, (snap) => {
    if (!snap.exists()) return failArena("تم إغلاق المواجهة");
    game.data = snap.data();
    renderGame(game);
  }, (error) => failArena(error?.message || "انقطع اتصال المباراة"));

  window.addEventListener("pagehide", () => {
    try { game.unsubMatch?.(); } catch {}
    clearInterval(game.tick);
    cleanupAnswerListeners(game);
  }, { once: true });
}

async function initializeIfNeeded(game) {
  const { fb, matchRef } = game;
  const ids = randomQuestionIds(10);
  const now = Date.now();
  await fb.runTransaction(fb.db, async (tx) => {
    const snap = await tx.get(matchRef);
    if (!snap.exists()) throw new Error("المواجهة غير موجودة");
    const data = snap.data();
    if (Array.isArray(data.questionIds) && data.questionIds.length) return;
    const scores = {};
    const correctCounts = {};
    for (const p of data.players || []) { scores[p.id] = 0; correctCounts[p.id] = 0; }
    tx.update(matchRef, {
      questionIds: ids,
      questionIndex: 0,
      status: "playing",
      phase: "question",
      scores,
      correctCounts,
      questionStartedAt: fb.serverTimestamp(),
      deadlineAt: fb.Timestamp.fromMillis(now + 15_000),
      lastResult: null,
      updatedAt: fb.serverTimestamp()
    });
  });
}

function cleanupAnswerListeners(game) {
  for (const fn of game.answerUnsubs.splice(0)) { try { fn(); } catch {} }
}

function renderPlayers(game) {
  const data = game.data;
  const players = data.players || [];
  const scores = data.scores || {};
  const box = byId("qmPlayers");
  if (!box) return;
  box.innerHTML = players.map((p) => `
    <div class="qm-player ${p.id === game.me.id ? "me" : ""}">
      <div><span class="qm-avatar">${escapeHtml((p.name || "؟").trim().slice(0,1) || "؟")}</span><b>${escapeHtml(p.name || "لاعب")}${p.id === game.me.id ? " • أنت" : ""}</b></div>
      <strong>${Number(scores[p.id] || 0)}</strong>
    </div>`).join("");
}

function renderGame(game) {
  const data = game.data;
  renderPlayers(game);
  const count = data.questionIds?.length || 10;
  const idx = Number(data.questionIndex || 0);
  const badge = byId("qmRound");
  if (badge) badge.textContent = data.status === "finished" ? "النتيجة" : `${Math.min(idx + 1, count)} / ${count}`;

  if (data.status === "finished" || data.phase === "finished") return renderFinished(game);
  if (!Array.isArray(data.questionIds) || !data.questionIds[idx]) {
    byId("qmStatus").textContent = "تجهيز أسئلة عشوائية…";
    return;
  }
  if (data.phase === "reveal") return renderReveal(game);
  return renderQuestion(game);
}

function currentQuestion(game) {
  const id = game.data.questionIds?.[Number(game.data.questionIndex || 0)];
  return questionMap.get(id) || null;
}

function renderQuestion(game) {
  const data = game.data;
  const idx = Number(data.questionIndex || 0);
  const q = currentQuestion(game);
  if (!q) return failArena("تعذر تحميل السؤال");
  const category = categoryByQuestion.get(q.id);
  byId("qmStatus").textContent = "اختر الإجابة قبل انتهاء الوقت";
  byId("qmMeta").innerHTML = `<span class="pill">${escapeHtml(category?.name || "عشوائي")}</span><span class="pill gold">${Number(q.v || 100)} نقطة</span>`;
  byId("qmQuestion").textContent = q.q;
  byId("qmReveal").classList.add("hidden");

  const choicesBox = byId("qmChoices");
  const choices = seededChoices(q);
  choicesBox.innerHTML = "";
  for (const choice of choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    button.textContent = choice;
    button.addEventListener("click", () => submitAnswer(game, choice, button));
    choicesBox.appendChild(button);
  }

  if (game.lastQuestionIndex !== idx) {
    game.lastQuestionIndex = idx;
    cleanupAnswerListeners(game);
    attachAnswerListeners(game, idx);
  }
  checkOwnAnswer(game, idx);
  startTimer(game);
}

async function checkOwnAnswer(game, idx) {
  const ref = game.fb.doc(game.fb.db, "matches", matchId, "answers", `${idx}_${game.me.id}`);
  try {
    const snap = await game.fb.getDoc(ref);
    if (snap.exists()) lockChoices(snap.data()?.choice);
  } catch {}
}

function lockChoices(selectedChoice) {
  const box = byId("qmChoices");
  if (!box) return;
  for (const b of box.querySelectorAll("button")) {
    b.disabled = true;
    if (selectedChoice && b.textContent === selectedChoice) b.classList.add("selected");
  }
  const status = byId("qmStatus");
  if (status) status.textContent = "تم تسجيل إجابتك — ننتظر المنافس";
}

async function submitAnswer(game, choice) {
  if (game.data.phase !== "question") return;
  const idx = Number(game.data.questionIndex || 0);
  lockChoices(choice);
  const answerRef = game.fb.doc(game.fb.db, "matches", matchId, "answers", `${idx}_${game.me.id}`);
  try {
    await game.fb.setDoc(answerRef, {
      playerId: game.me.id,
      playerName: game.me.name,
      questionIndex: idx,
      choice,
      answeredAt: game.fb.serverTimestamp()
    });
    await maybeFinalize(game, idx);
  } catch (error) {
    showToast("تعذر إرسال الإجابة: " + (error?.message || "خطأ"));
  }
}

function attachAnswerListeners(game, idx) {
  const players = game.data.players || [];
  for (const p of players) {
    const ref = game.fb.doc(game.fb.db, "matches", matchId, "answers", `${idx}_${p.id}`);
    const unsub = game.fb.onSnapshot(ref, () => maybeFinalize(game, idx).catch(() => {}));
    game.answerUnsubs.push(unsub);
  }
}

function startTimer(game) {
  clearInterval(game.tick);
  const tick = () => {
    if (game.data.phase !== "question") return;
    const deadline = tsMillis(game.data.deadlineAt) || (Date.now() + 15_000);
    const left = Math.max(0, deadline - Date.now());
    const seconds = Math.ceil(left / 1000);
    const timer = byId("qmTimer");
    const bar = byId("qmBar");
    if (timer) timer.textContent = String(seconds);
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, left / 15_000 * 100))}%`;
    if (left <= 0) maybeFinalize(game, Number(game.data.questionIndex || 0)).catch(() => {});
  };
  tick();
  game.tick = setInterval(tick, 180);
}

async function maybeFinalize(game, expectedIndex) {
  if (game.finalizing || game.data.phase !== "question" || Number(game.data.questionIndex || 0) !== expectedIndex) return;
  game.finalizing = true;
  try {
    const fb = game.fb;
    await fb.runTransaction(fb.db, async (tx) => {
      const matchSnap = await tx.get(game.matchRef);
      if (!matchSnap.exists()) return;
      const data = matchSnap.data();
      if (data.phase !== "question" || Number(data.questionIndex || 0) !== expectedIndex) return;
      const players = data.players || [];
      const answerRefs = players.map((p) => fb.doc(fb.db, "matches", matchId, "answers", `${expectedIndex}_${p.id}`));
      const answerSnaps = [];
      for (const ref of answerRefs) answerSnaps.push(await tx.get(ref));
      const deadline = tsMillis(data.deadlineAt);
      const timedOut = deadline > 0 && Date.now() >= deadline;
      const allAnswered = answerSnaps.every((s) => s.exists());
      if (!timedOut && !allAnswered) return;

      const qid = data.questionIds?.[expectedIndex];
      const q = questionMap.get(qid);
      if (!q) throw new Error("question_missing");
      const scores = { ...(data.scores || {}) };
      const correctCounts = { ...(data.correctCounts || {}) };
      const results = {};
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        const answer = answerSnaps[i].exists() ? answerSnaps[i].data() : null;
        const correct = answer?.choice === q.a;
        const answeredAt = tsMillis(answer?.answeredAt);
        const speed = correct && deadline && answeredAt ? Math.max(0, Math.min(50, Math.round((deadline - answeredAt) / 1000 * 2))) : 0;
        const gain = correct ? Number(q.v || 100) + speed : 0;
        scores[p.id] = Number(scores[p.id] || 0) + gain;
        correctCounts[p.id] = Number(correctCounts[p.id] || 0) + (correct ? 1 : 0);
        results[p.id] = { correct, gain, choice: answer?.choice || null };
      }
      tx.update(game.matchRef, {
        scores, correctCounts,
        phase: "reveal",
        lastResult: { questionIndex: expectedIndex, answer: q.a, results },
        revealUntil: fb.Timestamp.fromMillis(Date.now() + 2800),
        updatedAt: fb.serverTimestamp()
      });
    });
  } finally {
    game.finalizing = false;
  }
}

function renderReveal(game) {
  clearInterval(game.tick);
  const q = currentQuestion(game);
  if (!q) return failArena("تعذر عرض النتيجة");
  const result = game.data.lastResult || {};
  const category = categoryByQuestion.get(q.id);
  byId("qmMeta").innerHTML = `<span class="pill">${escapeHtml(category?.name || "عشوائي")}</span><span class="pill gold">كشف الإجابة</span>`;
  byId("qmQuestion").textContent = q.q;
  byId("qmTimer").textContent = "✓";
  byId("qmBar").style.width = "100%";
  const box = byId("qmChoices");
  box.innerHTML = "";
  for (const choice of seededChoices(q)) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "choice" + (choice === q.a ? " correct" : "");
    b.textContent = choice;
    b.disabled = true;
    box.appendChild(b);
  }
  const reveal = byId("qmReveal");
  reveal.classList.remove("hidden");
  const myResult = result.results?.[game.me.id];
  reveal.innerHTML = `<div class="answer">الإجابة: ${escapeHtml(result.answer || q.a)}</div><div class="qm-result-note">${myResult?.correct ? `✅ صحيح +${Number(myResult.gain || 0)}` : "❌ إجابة غير صحيحة"}</div>`;
  byId("qmStatus").textContent = "الجولة التالية تبدأ تلقائيًا";
  try { window.BS_AUDIO?.play?.(myResult?.correct ? "correct" : "wrong"); } catch {}
  scheduleAdvance(game);
}

function scheduleAdvance(game) {
  clearInterval(game.tick);
  const tick = () => {
    const until = tsMillis(game.data.revealUntil);
    if (!until || Date.now() >= until) advanceRound(game).catch(() => {});
  };
  tick();
  game.tick = setInterval(tick, 220);
}

async function advanceRound(game) {
  if (game.advancing) return;
  game.advancing = true;
  try {
    const fb = game.fb;
    await fb.runTransaction(fb.db, async (tx) => {
      const snap = await tx.get(game.matchRef);
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.phase !== "reveal") return;
      const until = tsMillis(data.revealUntil);
      if (until && Date.now() < until) return;
      const next = Number(data.questionIndex || 0) + 1;
      if (next >= (data.questionIds?.length || 0)) {
        const ranked = [...(data.players || [])].sort((a, b) => Number(data.scores?.[b.id] || 0) - Number(data.scores?.[a.id] || 0));
        const topScore = ranked.length ? Number(data.scores?.[ranked[0].id] || 0) : 0;
        const winners = ranked.filter((p) => Number(data.scores?.[p.id] || 0) === topScore).map((p) => p.id);
        tx.update(game.matchRef, {
          status: "finished", phase: "finished", winnerIds: winners,
          finishedAt: fb.serverTimestamp(), updatedAt: fb.serverTimestamp()
        });
      } else {
        tx.update(game.matchRef, {
          questionIndex: next,
          phase: "question",
          questionStartedAt: fb.serverTimestamp(),
          deadlineAt: fb.Timestamp.fromMillis(Date.now() + 15_000),
          lastResult: null,
          revealUntil: null,
          updatedAt: fb.serverTimestamp()
        });
      }
    });
  } finally {
    game.advancing = false;
  }
}

function renderFinished(game) {
  clearInterval(game.tick);
  cleanupAnswerListeners(game);
  const data = game.data;
  byId("qmGameCard")?.classList.add("hidden");
  const final = byId("qmFinished");
  final?.classList.remove("hidden");
  const ranked = [...(data.players || [])].sort((a, b) => Number(data.scores?.[b.id] || 0) - Number(data.scores?.[a.id] || 0));
  const top = ranked[0];
  const second = ranked[1];
  const topScore = top ? Number(data.scores?.[top.id] || 0) : 0;
  const tied = second && Number(data.scores?.[second.id] || 0) === topScore;
  byId("qmWinner").textContent = tied ? "🤝 تعادل" : top ? `🏆 ${top.name}` : "انتهت المباراة";
  const list = byId("qmFinalScores");
  if (list) list.innerHTML = ranked.map((p, i) => `
    <div class="qm-rank-row ${p.id === game.me.id ? "me" : ""}">
      <span><b>${i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"} ${escapeHtml(p.name)}</b><small>${Number(data.correctCounts?.[p.id] || 0)} إجابة صحيحة</small></span>
      <strong>${Number(data.scores?.[p.id] || 0)}</strong>
    </div>`).join("");
  try { window.BS_AUDIO?.play?.(tied ? "reveal" : "win"); } catch {}
}

function failArena(message) {
  clearInterval(window.__qmTick);
  const status = byId("qmStatus");
  if (status) status.textContent = message;
  const q = byId("qmQuestion");
  if (q) q.textContent = "تعذر متابعة المواجهة";
  byId("qmChoices")?.replaceChildren();
}

byId("qmPlayAgain")?.addEventListener("click", () => {
  byId("qmFinished")?.classList.add("hidden");
  byId("qmGameCard")?.classList.remove("hidden");
  window.TahdiaMatchmaking?.join?.();
});
byId("qmHome")?.addEventListener("click", () => { location.href = "/"; });
