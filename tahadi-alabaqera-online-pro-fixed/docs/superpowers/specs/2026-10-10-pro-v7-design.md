# PRO V7 design

Upgrade the supplied games into a coherent Arabic mobile experience with real local play, honest bot decisions, animated pieces, earned cosmetics and persistent progress. Keep the existing Worker, social accounts, online rooms and authoritative rewards.

Use the existing dependency-free DOM/SVG rendering and pure JavaScript rules; no engine migration is needed for turn-based boards. The shared UI uses ink backgrounds, ivory playfields, lavender accents, amber rewards and large touch targets. During play the board gets the available mobile width; secondary rules and settings stay collapsed. Respect reduced motion.

Snakes supports local friends, one human versus bot and two humans versus bot, plus classic and adventure rules. Adventure awards shield and double-dice inventory, speed boosts, freeze and shortcuts. A six grants an extra turn; a one can trigger an adventure challenge. All die values use the existing unbiased crypto rejection sampler. Bot difficulty changes inventory strategy, never rolls. Online rooms keep classic rules.

Jackaroo supports four humans, one human with three bots and two human teammates versus two bots. Bots evaluate only their own legal cards and public board. Zahra retains the Ludo rules and adds the same local bot configurations. Easy chooses legal moves randomly, medium prioritizes entrance/capture/finish, hard evaluates progress and exposure. Preserve private hands when passing the device.

Progress continues through BS_CAREER_CORE and the account API: a daily streak gift, cosmetic rarity, a daily 20% offer on premium items and actual equip appearance. Daily gift and offer use the Riyadh calendar on both client and server. No payment or fabricated opponents. Resume local games with receipts to avoid double rewards.

Acceptance: rule tests for powers, bots and rewards; original regression suite; Chromium playtests at 390x844 and desktop; navigation, repeated clicks, privacy, pause/resume, store purchases/equip, terminal states, cached offline boot and account API simulation. Deliver the updated source ZIP, run instructions and factual verification report. External deployment requires the user's Cloudflare account and is outside this requested ZIP upgrade.
