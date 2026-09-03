(() => {
  const STALE_MS = 90_000;
  const HEARTBEAT_MS = 12_000;
  const CLAIM_MS = 1_200;

  function waitForFirebase(timeoutMs = 10_000) {
    if (window.TahdiaOnline?.db) return Promise.resolve(window.TahdiaOnline);
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        if (window.TahdiaOnline?.db) return resolve(window.TahdiaOnline);
        if (window.TahdiaOnlineError && Date.now() - started > 1200) return reject(new Error(window.TahdiaOnlineError));
        if (Date.now() - started >= timeoutMs) return reject(new Error("تعذر تشغيل Firebase"));
        setTimeout(tick, 180);
      };
      tick();
    });
  }

  function millis(value) {
    try { return value?.toMillis?.() || 0; } catch { return 0; }
  }

  function waitingSound() {
    let audio = null;
    let pulse = null;
    try {
      audio = new Audio("assets/sounds/duel.wav");
      audio.loop = true;
      audio.volume = 0.24;
      audio.play().catch(() => {
        try { window.BS_AUDIO?.play?.("duel"); } catch {}
        pulse = setInterval(() => { try { window.BS_AUDIO?.play?.("duel"); } catch {} }, 3200);
      });
    } catch {
      pulse = setInterval(() => { try { window.BS_AUDIO?.play?.("duel"); } catch {} }, 3200);
    }
    return () => {
      if (pulse) clearInterval(pulse);
      if (audio) { try { audio.pause(); audio.currentTime = 0; } catch {} }
    };
  }

  function makeOverlay() {
    document.getElementById("matchBox")?.remove();
    const box = document.createElement("div");
    box.id = "matchBox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.innerHTML = `
      <div class="mm-card">
        <div class="mm-radar" aria-hidden="true"><i></i><b>⚡</b></div>
        <span class="mm-kicker">مواجهة مباشرة</span>
        <h2>نبحث عن منافس مناسب</h2>
        <p id="matchText">جاري تجهيز اتصالك…</p>
        <div class="mm-dots" aria-hidden="true"><i></i><i></i><i></i></div>
        <button type="button" id="cancelMatch">إلغاء البحث</button>
      </div>`;
    const style = document.createElement("style");
    style.id = "matchBoxStyles";
    style.textContent = `
      #matchBox{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:18px;background:rgba(4,6,15,.82);backdrop-filter:blur(12px);direction:rtl;color:#fff}
      #matchBox .mm-card{width:min(430px,100%);padding:28px 22px;text-align:center;border:1px solid rgba(167,139,250,.35);border-radius:28px;background:linear-gradient(180deg,#17172b,#0b0f1d);box-shadow:0 24px 80px #0008}
      #matchBox .mm-kicker{display:inline-block;padding:6px 10px;border:1px solid #ffffff1f;border-radius:999px;color:#f2ca79;font-size:12px;font-weight:900}
      #matchBox h2{margin:12px 0 7px;font-size:clamp(24px,6vw,34px)}#matchBox p{margin:0;color:#b7bfd3;line-height:1.7}
      #matchBox .mm-radar{width:90px;height:90px;margin:0 auto 14px;border-radius:50%;display:grid;place-items:center;position:relative;background:radial-gradient(circle,#7c3aed55,#11152a 65%);border:1px solid #795fc5}
      #matchBox .mm-radar:before,#matchBox .mm-radar i{content:"";position:absolute;inset:8px;border:1px solid #a78bfa66;border-radius:50%;animation:mmPulse 1.8s infinite ease-out}#matchBox .mm-radar i{inset:20px;animation-delay:.6s}#matchBox .mm-radar b{font-size:34px;z-index:2}
      #matchBox .mm-dots{display:flex;justify-content:center;gap:6px;margin:18px 0}#matchBox .mm-dots i{width:8px;height:8px;border-radius:50%;background:#a78bfa;animation:mmDot 1s infinite alternate}#matchBox .mm-dots i:nth-child(2){animation-delay:.2s}#matchBox .mm-dots i:nth-child(3){animation-delay:.4s}
      #matchBox button{width:100%;min-height:48px;border:1px solid #3a4160;border-radius:14px;background:#090d18;color:#fff;font:inherit;font-weight:900}
      @keyframes mmPulse{0%{transform:scale(.75);opacity:1}100%{transform:scale(1.5);opacity:0}}@keyframes mmDot{to{transform:translateY(-5px);opacity:.45}}
      @media(prefers-reduced-motion:reduce){#matchBox *{animation:none!important}}
    `;
    document.head.appendChild(style);
    document.body.appendChild(box);
    return box;
  }

  const api = {
    active: false,
    ownRef: null,
    unsubscribe: null,
    heartbeat: null,
    claimTimer: null,
    stopSound: null,
    identity: null,
    redirecting: false,

    async join() {
      if (this.active) return;
      this.active = true;
      this.redirecting = false;
      const box = makeOverlay();
      const text = box.querySelector("#matchText");
      this.stopSound = waitingSound();
      box.querySelector("#cancelMatch").addEventListener("click", () => this.cancel());

      try {
        const fb = await waitForFirebase();
        text.textContent = "نسجل دخولك تلقائيًا…";
        const identity = await fb.ensureIdentity();
        this.identity = identity;
        text.textContent = `أهلًا ${identity.name} — نبحث عن منافس…`;

        const ownRef = fb.doc(fb.db, "match_queue", identity.id);
        this.ownRef = ownRef;
        await fb.setDoc(ownRef, {
          playerId: identity.id,
          name: identity.name,
          status: "waiting",
          createdAt: fb.serverTimestamp(),
          updatedAt: fb.serverTimestamp()
        }, { merge: true });

        this.unsubscribe = fb.onSnapshot(ownRef, (snap) => {
          if (!snap.exists() || !this.active || this.redirecting) return;
          const data = snap.data();
          if (data.status === "matched" && data.matchId) this.found(data.matchId, data.opponentName || "المنافس");
        }, (error) => this.fail(error));

        this.heartbeat = setInterval(() => {
          if (!this.active || !this.ownRef) return;
          fb.updateDoc(this.ownRef, { updatedAt: fb.serverTimestamp() }).catch(() => {});
        }, HEARTBEAT_MS);

        const claim = () => this.tryClaim(fb).catch((error) => {
          if (error?.message !== "taken" && error?.message !== "no_candidate") console.warn("matchmaking claim", error);
        });
        await claim();
        this.claimTimer = setInterval(claim, CLAIM_MS);
      } catch (error) {
        this.fail(error);
      }
    },

    async tryClaim(fb) {
      if (!this.active || !this.ownRef || !this.identity) throw new Error("inactive");
      const snapshot = await fb.getDocs(fb.collection(fb.db, "match_queue"));
      const now = Date.now();
      const candidates = [];
      snapshot.forEach((d) => {
        if (d.id === this.identity.id) return;
        const data = d.data() || {};
        if (data.status !== "waiting") return;
        const updated = millis(data.updatedAt) || millis(data.createdAt);
        if (updated && now - updated > STALE_MS) return;
        candidates.push({ ref: d.ref, id: d.id, data, ts: millis(data.createdAt) || updated || now });
      });
      candidates.sort((a, b) => a.ts - b.ts);
      const other = candidates[0];
      if (!other) throw new Error("no_candidate");

      const matchRef = fb.doc(fb.collection(fb.db, "matches"));
      await fb.runTransaction(fb.db, async (tx) => {
        const mineSnap = await tx.get(this.ownRef);
        const otherSnap = await tx.get(other.ref);
        if (!mineSnap.exists() || mineSnap.data()?.status !== "waiting") throw new Error("taken");
        if (!otherSnap.exists() || otherSnap.data()?.status !== "waiting") throw new Error("taken");
        const mine = mineSnap.data();
        const theirs = otherSnap.data();
        const players = [
          { id: this.identity.id, name: this.identity.name },
          { id: other.id, name: String(theirs.name || "منافس") }
        ];
        tx.set(matchRef, {
          status: "matched",
          phase: "setup",
          players,
          playerIds: players.map((p) => p.id),
          hostId: this.identity.id,
          createdAt: fb.serverTimestamp(),
          updatedAt: fb.serverTimestamp()
        });
        tx.update(this.ownRef, { status: "matched", matchId: matchRef.id, opponentId: other.id, opponentName: players[1].name, updatedAt: fb.serverTimestamp() });
        tx.update(other.ref, { status: "matched", matchId: matchRef.id, opponentId: this.identity.id, opponentName: this.identity.name, updatedAt: fb.serverTimestamp() });
      });
    },

    found(matchId, opponentName) {
      if (!this.active || this.redirecting) return;
      this.redirecting = true;
      this.stopTimers();
      this.stopSound?.();
      const text = document.querySelector("#matchBox #matchText");
      if (text) text.textContent = `تم العثور على ${opponentName} — تبدأ المواجهة الآن`;
      try { window.BS_AUDIO?.play?.("round"); } catch {}
      setTimeout(() => {
        const next = new URL("/online", location.origin);
        next.searchParams.set("quickMatch", matchId);
        location.href = next.href;
      }, 650);
    },

    stopTimers() {
      if (this.unsubscribe) { try { this.unsubscribe(); } catch {} this.unsubscribe = null; }
      if (this.heartbeat) clearInterval(this.heartbeat);
      if (this.claimTimer) clearInterval(this.claimTimer);
      this.heartbeat = null;
      this.claimTimer = null;
    },

    async cancel() {
      if (!this.active) return;
      this.active = false;
      this.stopTimers();
      this.stopSound?.();
      const ref = this.ownRef;
      this.ownRef = null;
      document.getElementById("matchBox")?.remove();
      document.getElementById("matchBoxStyles")?.remove();
      if (ref && window.TahdiaOnline) {
        try {
          const snap = await window.TahdiaOnline.getDoc(ref);
          if (snap.exists() && snap.data()?.status === "waiting") await window.TahdiaOnline.deleteDoc(ref);
        } catch {}
      }
    },

    fail(error) {
      console.error("Tahdia matchmaking failed", error);
      this.stopTimers();
      this.stopSound?.();
      this.active = false;
      const text = document.querySelector("#matchBox #matchText");
      const btn = document.querySelector("#matchBox #cancelMatch");
      if (text) text.textContent = "تعذر بدء البحث: " + (error?.message || "خطأ غير معروف");
      if (btn) btn.textContent = "إغلاق";
    }
  };

  window.TahdiaMatchmaking = api;
})();
