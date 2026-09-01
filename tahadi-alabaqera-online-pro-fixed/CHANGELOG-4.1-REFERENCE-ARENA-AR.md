# بوسراج 4.1 — Neon Creature Arena

تم اعتماد صورة **Neon Creature Arena** المرفقة كإطار اللعب الأساسي للثعبان.

- حفظ الإطار بصيغة PNG سليمة بأبعاد 709×1536 داخل `public/assets`.
- إضافة طبقة CSS أخيرة تمنع أنماط اللوحة العامة من تغطية الصورة المرجعية.
- ضبط مساحة اللوحة المستطيلة وخطوط الصفوف لتطابق الخانات في الصورة.
- إبقاء النرد، القطع، النقاط، زر الرمية، حالة الدور، والحركات عناصر تفاعلية فوق الصورة.
- إضافة صوت وحركة للرمية، الحركة، السلم، الثعبان، الفوز، والاهتزاز عند دعم الجهاز.
- إضافة رمية من لوحة المفاتيح (Space / Enter) ومعالجة أخطاء تمنع تجمد الدور.
- تحديث Service Worker ليخزن طبقة المرجع الجديدة ضمن App Shell.

## النشر على Cloudflare

هذا المشروع Worker + Static Assets لـ Cloudflare، وليس خادم Node للإنتاج:

```bash
npm install --include=dev
npm run verify
npm run check:cloudflare
npm run deploy
```

حافظ على `wrangler.jsonc` وDurable Object migrations كما هي، وانشر مجلد المشروع كاملًا.
