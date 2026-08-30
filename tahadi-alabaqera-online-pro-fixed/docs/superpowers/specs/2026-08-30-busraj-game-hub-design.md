# Busraj Game Hub Design

## Goal
Turn the existing Tahadi Alabaqera Cloudflare Worker/PWA into a polished Arabic RTL game hub while preserving the current local quiz and authoritative WebSocket online quiz.

## Product structure
- Home becomes **بوسراج للألعاب**, a real game launcher rather than a mode picker.
- Existing **تحدي العباقرة** remains available in both local and online modes.
- Add four complete pass-and-play games: **جاكارو**, **الزهرة (لودو)**, **السلم والثعبان**, and **تحدي النرد**.
- All pages share one dark violet/gold Busraj design system, audio settings, motion language, PWA install behavior, and mobile-first layout.

## Audio system
A shared browser audio manager owns master mute, music/effects/timer levels, haptics, Web Audio synthesized cues, and existing WAV effects. Quiz timers emit a soft cue each second, become more urgent in the final 10 seconds, and use a stronger final-5 countdown and time-up cue. Reveal/correct/wrong/buzzer/round/win/move/dice/card cues are consistent across the app.

## Game rules
### Snakes & Ladders
2–4 players, 1–100 board, fixed snake/ladder layout, exact finish, extra roll on six, animated token movement, winner state and restart.

### Zahra / Ludo
2–4 players, four pieces each, six required to enter, captures on non-safe cells, extra roll on six or capture, exact entry into a four-cell home lane, first player to home all four pieces wins.

### Dice Challenge
Two polished modes: Highest Roll over a configurable number of rounds, and a push-your-luck Race to 50 where rolling 1 loses unbanked turn points.

### Jackaroo
Four players in two opposing teams, four marbles per player, 52-card deck, track and 4-cell safety lanes. Ace/King can enter a marble, Ace supports 1 or 11, 4 moves backward, 5 can move any eligible track marble, 7 supports split movement, Jack swaps eligible track marbles, Queen moves 12, King moves 13. First team to place all eight team marbles in safety wins. Rules are implemented as a deterministic engine so future online synchronization can reuse it.

## Architecture
- Keep `src/index.js` and `src/questions.js` as the authoritative online quiz backend/data.
- Add reusable browser primitives under `public/assets/js` and `public/assets/css`.
- Put deterministic game rules under `public/assets/js/engines` so they can be unit-tested with Node and reused by UI controllers.
- Keep each new game in its own HTML page to match the existing static-assets Cloudflare architecture and avoid introducing a framework migration risk.
- Update the service worker cache and manifest to make the expanded game hub installable/offline-friendly.

## Compatibility and safeguards
- Existing online room protocol and Durable Object behavior remain unchanged.
- No external runtime dependencies or CDNs are required for core gameplay.
- All new controls are touch-friendly, keyboard-focusable where practical, and respect `prefers-reduced-motion`.
- Audio only starts after user interaction to comply with iOS/Android browser autoplay restrictions.
