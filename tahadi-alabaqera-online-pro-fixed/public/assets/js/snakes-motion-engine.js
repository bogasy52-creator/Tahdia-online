/*
 * Snake & Ladders motion core.
 *
 * All board reactions share one requestAnimationFrame clock.  Older versions
 * scheduled a timer for every traversed square, every ladder rung and every
 * visual cleanup.  On a phone those timers could wake up together and make a
 * pawn jump, sound effects overlap and remote state updates queue behind stale
 * animations.  This small scheduler keeps one clock, supports cancellation,
 * and lets the board animate only the state that is still current.
 */

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const easeOutCubic = (value) => {
  const t = clamp(Number(value) || 0);
  return 1 - ((1 - t) ** 3);
};

export const easeInOutCubic = (value) => {
  const t = clamp(Number(value) || 0);
  return t < .5 ? 4 * t * t * t : 1 - (((-2 * t + 2) ** 3) / 2);
};

const defaultNow = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

/**
 * Create a cancellable, single-clock motion scheduler.
 *
 * `animate` calls `onFrame(progress, elapsed)` once per rendered frame and
 * resolves when the timeline is complete.  Returning the promise makes it
 * straightforward to sequence a walk, a ladder climb, and a snake reaction.
 */
export function createMotionScheduler({reducedMotion = false, now = defaultNow} = {}) {
  const request = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : (callback) => setTimeout(() => callback(now()), 16);
  const cancel = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout;
  const jobs = new Map();
  let rafId = 0;
  let nextId = 1;

  const schedule = () => {
    if (!rafId && jobs.size) rafId = request(tick);
  };

  const finish = (job, error = null) => {
    jobs.delete(job.id);
    if (error) job.reject(error);
    else job.resolve();
  };

  function tick(timestamp) {
    rafId = 0;
    const current = Number(timestamp) || now();
    for (const job of [...jobs.values()]) {
      if (!jobs.has(job.id)) continue;
      const elapsed = Math.max(0, current - job.startedAt);
      const progress = job.duration === 0 ? 1 : clamp(elapsed / job.duration);
      try {
        job.onFrame(job.easing(progress), elapsed, progress);
      } catch (error) {
        finish(job, error);
        continue;
      }
      if (progress >= 1) finish(job);
    }
    schedule();
  }

  function animate({duration = 0, easing = (value) => value, onFrame = () => {}} = {}) {
    const safeDuration = reducedMotion ? Math.min(90, Math.max(0, Number(duration) || 0)) : Math.max(0, Number(duration) || 0);
    return new Promise((resolve, reject) => {
      const job = {id: nextId++, duration: safeDuration, easing, onFrame, resolve, reject, startedAt: now()};
      jobs.set(job.id, job);
      if (safeDuration === 0) {
        try { onFrame(1, 0, 1); finish(job); } catch (error) { finish(job, error); }
      } else schedule();
    });
  }

  function delay(duration = 0) {
    return animate({duration, onFrame: () => {}});
  }

  function cancelAll(reason = 'motion_cancelled') {
    const error = new Error(reason);
    error.code = reason;
    for (const job of [...jobs.values()]) finish(job, error);
    if (rafId) {
      cancel(rafId);
      rafId = 0;
    }
  }

  return Object.freeze({
    animate,
    delay,
    cancelAll,
    activeCount: () => jobs.size,
  });
}

/**
 * Drive a list of effects from the same timeline.  The callback is called
 * whenever an event threshold is crossed, never more than once per event.
 */
export function animateTimeline(scheduler, duration, events = [], onFrame = () => {}) {
  const ordered = [...events]
    .map((event) => ({...event, at: clamp(Number(event.at) || 0, 0, Number(duration) || 0)}))
    .sort((a, b) => a.at - b.at);
  let index = 0;
  return scheduler.animate({
    duration,
    easing: (value) => value,
    onFrame: (progress, elapsed) => {
      onFrame(progress, elapsed);
      while (index < ordered.length && elapsed >= ordered[index].at) {
        ordered[index].run?.(ordered[index]);
        index += 1;
      }
    },
  });
}

export function disposeAnimation(animation) {
  try { animation?.cancel?.(); } catch {}
}
