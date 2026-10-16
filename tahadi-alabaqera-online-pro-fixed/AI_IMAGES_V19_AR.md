# الصور والتوليد داخل اللعبة — V19

توليد فعلي في الكود عبر واجهة إنشاء الصور الرسمية. لم يُفعّل على موقع الإنتاج؛ يتطلب السر `AI_IMAGE_API_KEY`. يُرسل الوصف من اللوبي إلى الخادم، والخادم فقط يتصل بـ OpenAI. النموذج الافتراضي `gpt-image-2`، صورة مربعة 1024×1024، WebP بجودة medium. محاولات الحساب اليومية 3 افتراضيًا بتوقيت الرياض، ويمكن ضبطها من 1 إلى 10. تحتسب المحاولة حتى إذا فشل المزود. المدة القصوى للاتصال 120 ثانية، وطلب متوقف يُفتح بعد 150 ثانية. تبقى الصورة السابقة عند الفشل.

الصور الثلاث المرفقة أُنشئت بأداة imagegen المدمجة في 16 أكتوبر 2026، ثم صُغرت وضُغطت إلى WebP للمشروع. المسارات:

- `public/assets/ai-v19/hero.webp`: مرصد وكتاب مضيء، للواجهة العامة والعباقرة.
- `public/assets/ai-v19/garden.webp`: الحديقة السرية، صورة جاهزة للتركيب.
- `public/assets/ai-v19/space.webp`: ميناء الفضاء، صورة جاهزة للتركيب.

صور الأسئلة الفوتوغرافية السابقة لم تُستبدل بصور مولدة حتى تبقى الإجابات متوافقة مع محتواها. مواضيع المحيط والجبال والتراث تُولد عند طلب المضيف، وليست صورًا جاهزة في الحزمة.

## مجموعة الأوامر المستخدمة — built-in imagegen

### hero

Use case: stylized-concept. Asset type: Arabic multiplayer knowledge game website hero. Primary request: a premium original miniature floating observatory and open luminous book on terraced islands, with a small brass telescope, stone arches and botanical details. Style: rich hand-crafted 3D game illustration with fine textured stone, warm brass and luminous teal glass, deep midnight teal environment. Composition: landscape, main architecture on left two thirds, uncluttered dark negative space on right for RTL website title. No letters, numbers, logos, watermarks or characters. Sophisticated, inviting and playful. Finished production illustration.

### garden

Use case: stylized-concept. Asset type: square image for a tile-swap multiplayer jigsaw puzzle. Primary request: a secret botanical conservatory garden with a glass dome, stone arched footbridge over a clear pond, terracotta pots, a winding path and hanging lamps. Premium original miniature 3D storybook game art, rich emerald, warm golden light, tactile detail. Composition: perfectly square entire scene, distinct interesting details in all quadrants so every tile can be identified. No text, letters, numerals, logos or watermark.

### space

Use case: stylized-concept. Asset type: square image for a tile-swap multiplayer jigsaw puzzle. Primary request: a whimsical space harbour on a little moon, a white and teal rocket, domed observatory and greenhouse, winding illuminated paths, tiny satellite and luminous planet above. Premium original miniature 3D storybook game art, indigo sky, teal and copper details. Composition: square entire scene, distinct interesting details in all quadrants so every tile can be identified. No text, letters, numerals, logos or watermark.

## التحقق والحدود

فُحص شكل الطلب والترويسات وWebP والحد اليومي، وجرّب الخادم المحلي مسار التوليد بتزييف استجابة مزود OpenAI وإرجاع بايتات صورة الحديقة الحقيقية. لم يحدث طلب مدفوع بمفتاح المستخدم، ولا يثبت ذلك عمل صلاحيات مفتاح إنتاج لم يُضبط. الصور الجاهزة تعمل دون تفعيل التوليد.

[توثيق إنشاء الصور الرسمي](https://developers.openai.com/api/reference/resources/images/methods/generate)

