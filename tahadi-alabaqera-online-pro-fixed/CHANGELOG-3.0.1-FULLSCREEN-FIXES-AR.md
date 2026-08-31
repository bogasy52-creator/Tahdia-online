# Busraj 3.0.1 — Fullscreen & Reliability Fixes

## معتمد في هذا الإصدار

- تحويل **الزهرة** و**سباق الـ100 (السلم والثعبان)** إلى Game Stage ممتدة على كامل مساحة الـviewport أثناء اللعب.
- إضافة زر Fullscreen اختياري مع fallback آمن للأجهزة التي لا تدعم Fullscreen API.
- تحسين التخطيط للهواتف العمودية، الهواتف الأفقية القصيرة، التابلت، والديسكتوب مع دعم safe-area وdynamic viewport.
- قياس ديناميكي لحجم اللوحة من المساحة الفعلية المتاحة باستخدام Visual Viewport وResizeObserver.
- إبقاء لوحة اللعب هي العنصر الرئيسي مع Dock مضغوط للاعبين والنرد والحالة.
- إصلاح قص/تداخل أحجار الزهرة والثعبان أثناء الحركة.
- إصلاح ظهور أحجار منطقة البداية في سباق الـ100 على الجوال والتابلت والديسكتوب داخل Dock مستقل لا يغطي مربع اللعب.
- إعادة رسم مسارات الثعابين والسلالم بعد تغيّر المقاس/الاتجاه/Fullscreen.
- تحديث PWA cache إلى `busraj-games-v16` وإضافة أصول الـfullscreen الجديدة إلى App Shell.
- إزالة Runtime قديم وغير مستخدم كان يشير إلى `/api/games/rooms` ويحتوي نمط WebSocket قديمًا.
- الإبقاء على `BoardOnlineClient` كمسار Runtime موحد للألعاب اللوحية الحالية.
- إصلاح updater ليطابق محتوى الإصدار الجديد ويحذف الملفات القديمة غير الموجودة في ZIP، مع إبقاء `wrangler.jsonc` محميًا ودمج migrations بطريقة append-only.
- الحفاظ على تاريخ Cloudflare Durable Object migrations بدون تعديل.

## التحقق

يجب تمرير:

```bash
node --test .github/test/*.test.js
cd tahadi-alabaqera-online-pro-fixed
npm test
npm run verify:static
npm run verify:worker
node scripts/refresh-checksums.mjs
sha256sum -c SHA256SUMS.txt
```
