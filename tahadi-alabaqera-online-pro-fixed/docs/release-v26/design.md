# Tahdia 26 — implementation brief

User intent: a material upgrade of the supplied platform, including every game's presentation, removal of shooting, a smaller useful shop, redesigned dice, an exclusive manager serpent with effects, and reliable invitations and multiplayer recovery. Preserve accounts, balances, progress, game rules and deployed Durable Object identities.

## Product direction

Midnight navy, amber and jade; Arabic RTL; quiet readable controls. A single launcher with a clear game library, compact room entry and friends access. Retain all existing playable games except accuracy. Use real account data and real connection state. Do not invent activity counts or report a server as online before its welcome arrives.

## Catalog and art

Retire redundant color-only items from new purchases while retaining historical ownership and equipping. Keep default essentials free. Add three distinct dice materials (porcelain, crystal and obsidian) with visible bevel, pip and ornament differences; fix global CSS that overwrites selected materials. Add snake-sovereign, with an obsidian/gold body, a crown and bounded animated particles. Server authenticated bosrag ownership is required; cosmetic effects never change multiplayer physics.

## Online

Normalize six-digit Arabic/Persian room codes without silently truncating overlong input. Add HTTP deadlines, welcome deadlines, heartbeats, stale-socket detection and explicit terminal states to social and board clients. Reconnect after network and foreground restoration; dispose timers and old sockets. Ignore responses from a previous signed-in account. Store invitations durably, deduplicate rapid repeats, expire visible invitations, and validate same-origin join destinations.

## Release

Keep the current Worker bindings and migrations. One release number in UI, Worker, HTML resource references and service-worker cache. HTML navigations remain network-first, API requests are never cached. Removed game URLs redirect to the library. Provide a reproducible release command and an Arabic change/verification note. No production deployment is part of the uploaded-file edit.

## Verification

Behavioral regression tests for entitlements, catalog compatibility, HTTP/session races, terminal and half-open connections. Existing game engine tests plus actual workerd SQLite/WebSocket tests for rooms and invitations. Browser review at desktop and mobile, exercising game starts, dice results, shop previews, search, Arabic room code entry and two-client multiplayer where runtime permits. Report any untested production/long-run/device behavior explicitly.
