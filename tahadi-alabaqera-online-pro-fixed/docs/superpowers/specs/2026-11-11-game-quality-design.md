# Game quality upgrade

The user delegates improvements to the new games and specifically requests correct Jackaroo rules. Continue the recovered 33.9.10 project plus the verified 33.9.11 patch. Ship 33.9.12 as a cumulative, validated update.

## Design decisions

- Keep the existing vanilla JavaScript engines, Arabic interface, rooms, saved state, account data, cosmetics and board geometry.
- Fix demonstrated game-rule and input errors before presentation. Use Jackaroo World's published manual for normal track protection, capture, own-piece blocking and King movement. Retain the existing table's documented ten burn choice, deal direction and picture-board home gate rather than mix variants silently. Document the implemented rules in the game.
- Give the new games usable controls and clear player feedback: Carrom gains precision controls, UNO supports crowded hands and all advertised seat counts, billiards gains meaningful shot feedback. Refine existing artwork and layouts rather than replace the application.
- Preserve the online room authority and replay determinism. UI features must not reveal opponents' hands, generate purchases, or change account balances.
- Keep all changed executable assets cache coherent. Preserve Cloudflare bindings and migrations.

## Approaches considered

A full engine and UI rewrite risks breaking rooms and saved games. A purely cosmetic pass leaves the user's rule errors unfixed. The selected approach repairs the existing engines with regression cases and upgrades each game's own controls and presentation.

## Completion criteria

Regression tests reproduce each material rules/input fault before its repair. The complete suite, static/worker checks, mobile and desktop browser playtests, and sparse update simulation run before delivery. Report pre-existing failures and external publication restrictions accurately.
