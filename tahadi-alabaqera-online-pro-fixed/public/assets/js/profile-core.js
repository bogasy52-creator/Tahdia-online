/* Shared, deterministic progression and cosmetic catalogue. */
(function(root){
  'use strict';
  const RETIRED=new Set(['pawn-onyx','dice-midnight','dice-copper','dice-aurora','board-ocean','board-sand','board-twilight','table-slate','table-emerald','table-midnight','title-collector','title-champion']);
  const LEGACY_CATALOG=Object.freeze([
    // 32.0.0: the characters are heroes in helmets and masks, rendered in 3D.
    // The ids stay, so everything already bought keeps working.
    {id:'character-fox',type:'character',name:'الملثّم',description:'شماغ أحمر وعقال أسود وبشت بحواف ذهبية. شخصية البداية المجانية.',price:0,color:'#c0303a',asset:'desert'},
    {id:'character-cat',type:'character',name:'النينجا',description:'قناع قماشي وعصابة حمراء وسيف على الكتف.',price:150,color:'#3b4256',asset:'ninja'},
    {id:'character-robot',type:'character',name:'الروبوت',description:'خوذة معدنية بشاشة عيون مضيئة وهوائي.',price:220,color:'#4dd9ff',asset:'robot'},
    {id:'character-princess',type:'character',name:'الفارس',description:'خوذة فولاذية بشق للرؤية وريشة حمراء وحواف ذهبية.',price:300,color:'#9aa3ad',asset:'knight'},
    {id:'character-fairy',type:'character',name:'الصقر الذهبي',description:'خوذة على هيئة صقر بمنقار وأجنحة وعيون متوهجة.',price:380,color:'#e8b04a',asset:'falcon'},
    {id:'character-astronaut',type:'character',name:'رائد الفضاء',description:'خوذة فضاء بزجاج ذهبي عاكس وبدلة بيضاء.',price:450,color:'#e9edf2',asset:'astronaut'},
    {id:'character-racer',type:'character',name:'المتسابق',description:'خوذة سباق حمراء بخطوط بيضاء وزجاج داكن.',price:260,color:'#e23a2c',asset:'racer'},
    {id:'character-diver',type:'character',name:'الغوّاص',description:'خوذة غوص نحاسية بنوافذ زجاجية ومسامير.',price:280,color:'#c98a3a',asset:'diver'},
    {id:'character-viking',type:'character',name:'الفايكنج',description:'خوذة بقرنين ولحية مضفورة وفرو على الكتفين.',price:320,color:'#b9c2cc',asset:'viking'},
    {id:'character-gladiator',type:'character',name:'المصارع',description:'خوذة برونزية بشبكة للوجه وريشة حمراء ودرع كتف.',price:340,color:'#b8794a',asset:'gladiator'},
    {id:'character-cyber',type:'character',name:'سايبر',description:'خوذة سوداء لامعة بخطوط نيون زرقاء ووردية.',price:520,color:'#21e6ff',asset:'cyber'},
    {id:'character-samurai',type:'character',name:'الساموراي',description:'خوذة مطلية بالأسود يعلوها هلال ذهبي، مع قناع ودروع كتف.',price:600,color:'#d9b25a',asset:'samurai'},
    {id:'pawn-classic',type:'pawn',name:'الحجر الكلاسيكي',description:'حجر لامع بلون اللاعب، بطوق فضي وقاعدة مدرّجة.',price:0,color:'#e8e5db'},
    {id:'pawn-jade',type:'pawn',name:'حجر اليشم',description:'أخضر هادئ بلمسة حجرية.',price:120,color:'#55ba98'},
    {id:'pawn-onyx',type:'pawn',name:'حجر الأونيكس',description:'أسود مصقول بحافة ذهبية.',price:180,color:'#28313e'},
    {id:'dice-ivory',type:'dice',name:'نرد العاج',description:'نقاط واضحة وحركة قصيرة.',price:0,color:'#f6f0e4'},
    {id:'dice-midnight',type:'dice',name:'نرد منتصف الليل',description:'لون داكن ونقاط عاجية.',price:140,color:'#202c40'},
    {id:'dice-copper',type:'dice',name:'نرد النحاس',description:'نحاس مطفي ونقاط داكنة.',price:220,color:'#ce9564'},
    {id:'board-forest',type:'board',name:'لوحة النيون',description:'خانات كحلية هادئة متبادلة، وإطار معدني مع ثعابين مفصّلة وسلالم نيون رفيعة. اللوحة المجانية.',price:0,color:'#21434e'},
    {id:'board-ocean',type:'board',name:'لوحة المحيط',description:'درجات زرقاء هادئة.',price:160,color:'#173f61'},
    {id:'board-sand',type:'board',name:'لوحة الرمال',description:'ألوان رملية دافئة.',price:160,color:'#62492c'},
    {id:'table-walnut',type:'table',name:'طاولة الجوز',description:'ديوانية البلوت: جوز وسدو أحمر وجوخ أخضر. وتلبس لوحة الزهرة.',price:0,color:'#5b3928'},
    {id:'table-slate',type:'table',name:'طاولة الأردواز',description:'سطح داكن وحواف معدنية.',price:240,color:'#344454'},
    {id:'table-emerald',type:'table',name:'طاولة الزمرد',description:'سطح أخضر بإطار جوزي.',price:260,color:'#184c3b'},
    {id:'snake-wild',type:'snake',name:'وحوش النيون',description:'ثعابين معدنية متنوعة تتحرك وتتفاعل مع الأحجار.',price:0,color:'#77b38a'},
    {id:'snake-aurora',type:'snake',name:'الأفعى الشفقية',description:'جسم بنفسجي وأصداف مضيئة على لوحة الثعبان.',price:300,color:'#b9a2f2'},
    {id:'snake-gold',type:'snake',name:'أفعى الشمس',description:'ثعابين ذهبية بلمعة دافئة.',price:480,color:'#eec56d'},
    {id:'snake-ice',type:'snake',name:'الأفعى الجليدية',description:'جسم أزرق وعيون بلون الثلج.',price:350,color:'#8ed5ed'},
    {id:'pawn-amethyst',type:'pawn',name:'حجر الجمشت',description:'حواف بنفسجية ولمعة بلورية للأحجار.',price:320,color:'#bca5fb'},
    {id:'pawn-gold',type:'pawn',name:'الحجر الملكي',description:'إطار ذهبي للأحجار في الألعاب الثلاث.',price:500,color:'#e5be73'},
    {id:'dice-aurora',type:'dice',name:'نرد الشفق',description:'نرد بنفسجي بأوجه ونقاط واضحة.',price:340,color:'#b6a0ee'},
    {id:'dice-gold',type:'dice',name:'نرد الملك',description:'ذهب عميق ونقاط سوداء مصقولة.',price:520,color:'#e3b65e'},
    {id:'board-twilight',type:'board',name:'لوحة الغسق',description:'خانات بنفسجية وإطار داكن.',price:360,color:'#68608e'},
    {id:'board-royal',type:'board',name:'لوحة القصر',description:'رخام أسود بعروق ذهبية على فواصل من الذهب، بإطار ملكي وسلالم ذهبية.',price:550,color:'#c8a159'},
    {id:'table-midnight',type:'table',name:'طاولة منتصف الليل',description:'طاولة جاكارو داكنة بأمان واضح.',price:380,color:'#1f273d'},
    {id:'table-royal',type:'table',name:'طاولة القصر',description:'طاولة بلوت بإطار ذهب ومخمل بنفسجي مزخرف. وتلبس لوحة الزهرة.',price:580,color:'#4a3659'},
    {id:'snake-toxic',type:'snake',name:'أفاعي الزمرد الكهربائي',description:'دروع خضراء لامعة وعيون نيون مع حركة الافتراس الكاملة.',price:420,color:'#8aef48'},
    {id:'snake-plasma',type:'snake',name:'أفاعي البلازما',description:'ألوان سماوية وبنفسجية متدرجة بين الثعابين.',price:600,color:'#ca73ff'},
    {id:'dice-nebula',type:'dice',name:'نرد السديم',description:'أوجه زرقاء معدنية ونقاط عاجية كبيرة.',price:380,color:'#245797'},
    {id:'dice-ruby',type:'dice',name:'نرد الياقوت',description:'ياقوت أحمر مصقول ونقاط مضيئة.',price:460,color:'#a32f50'},
    {id:'board-cyber',type:'board',name:'حلبة المفاعل',description:'لوحة ليلية بخانات داكنة وإطار نيون أزرق.',price:440,color:'#32ceef'},
    {id:'board-lava',type:'board',name:'لوحة البركان',description:'بازلت داكن فوق شقوق تتوهج بالحمم، وسلالم من جمر.',price:480,color:'#ff6a1f'},
    {id:'board-galaxy',type:'board',name:'لوحة المجرّة',description:'خانات ليلية مرصّعة بالنجوم تحت سديم بنفسجي، وسلالم من ضوء.',price:520,color:'#8f7cf0'},
    // 32.0.0: playing cards for the Baloot table (face and back)
    {id:'deck-classic',type:'deck',name:'كلاسيك بوسراج',description:'ورق عاجي بصور ملكية مرسومة وظهر بنقش السدو الأحمر. الورق المجاني.',price:0,color:'#c4253a'},
    {id:'deck-four',type:'deck',name:'أربعة ألوان',description:'لكل شكل لونه: أحمر وأسود وأزرق وأخضر، فتقرأ يدك أسرع.',price:220,color:'#1f6fd6'},
    {id:'deck-night',type:'deck',name:'ليل المجلس',description:'وجه كحلي برموز فاتحة وظهر ليلي بزخرفة ذهبية.',price:300,color:'#3c4b70'},
    {id:'deck-emerald',type:'deck',name:'الزمرد',description:'ورق عاجي بصور ملكية خضراء وظهر زمردي.',price:360,color:'#178a6a'},
    {id:'deck-royal',type:'deck',name:'الذهب الأسود',description:'ورق أسود برموز ووجوه ذهبية لامعة وظهر ملكي.',price:560,color:'#e3b450'},
    {id:'table-cyber',type:'table',name:'طاولة المفاعل',description:'جاكارو بسطح أزرق معدني وأحجار واضحة.',price:460,color:'#4c91db'},
    {id:'pawn-prism',type:'pawn',name:'كريستال الطيف',description:'لمعة طيفية تتحرك بهدوء حول الحجر.',price:600,color:'#b7f8ff'},
    {id:'pawn-orb',type:'pawn',name:'كرة المفاعل',description:'كرة كريستال سماوية معلّقة في مخالب معدنية على قاعدة مضيئة.',price:360,color:'#56e5ec'},
    {id:'pawn-crown',type:'pawn',name:'تاج الجمشت',description:'تاج من بلورات الجمشت في إطار ذهبي وقاعدة معدنية.',price:540,color:'#cf89f5'},
    {id:'trail-none',type:'trail',name:'أثر الحركة الأصلي',description:'ومضة اللوحة الأصلية أثناء انتقال الحجر.',price:0,color:'#33baff'},
    {id:'trail-comet',type:'trail',name:'ذيل المذنب',description:'أثر سماوي مضيء تحت الحجر أثناء الحركة.',price:180,color:'#4ce6ff'},
    {id:'trail-plasma',type:'trail',name:'أثر البلازما',description:'وهج بنفسجي ووردي يرافق الحركة على اللوحة.',price:350,color:'#eb79ff'},
    {id:'victory-classic',type:'victory',name:'احتفال الفوز الأصلي',description:'قصاصات ملونة عند انتهاء الجولة بالفوز.',price:0,color:'#bdaaf4'},
    {id:'victory-aurora',type:'victory',name:'شلال الشفق',description:'شرائط سماوية وبنفسجية في شاشة الفوز.',price:280,color:'#94d9ff'},
    {id:'victory-royal',type:'victory',name:'نجوم التتويج',description:'نجوم ذهبية واحتفال ملكي عند فوزك.',price:450,color:'#f4d88e'},
    {id:'title-player',type:'title',name:'لاعب الحلبة',description:'لقبك الأصلي بجانب ملفك وفي شاشة الفوز.',price:0,color:'#a8c6df'},
    {id:'title-collector',type:'title',name:'جامع الكنوز',description:'لقب بلون الزمرد لمقتنياتك المميزة.',price:240,color:'#78dbb7'},
    {id:'title-champion',type:'title',name:'بطل الحلبة',description:'لقب ذهبي يظهر بجانب ملفك وفي شاشة الفوز.',price:480,color:'#f4cd7a'},
    {id:'title-legend',type:'title',name:'أسطورة النيون',description:'لقب حصري يُفتح بإنجاز 50 جولة.',price:0,color:'#c79aff',source:'achievement',objective:'fifty-games'},
    {id:'title-starfinder',type:'title',name:'صائد النجوم',description:'لقب حصري لرحلة النجوم. اجمع 30 نجمة من المراحل لفتحه.',price:0,color:'#efd29b',source:'journey',unlockStars:30},
    {id:'title-pathmaster',type:'title',name:'سيّد المسارات',description:'لقب إنجاز حصري. اجمع 120 نجمة من مراحل المغامرة.',price:0,color:'#a5dfca',source:'journey',unlockStars:120},
    {id:'title-manager',type:'title',name:'مدير الحلبة',description:'هوية المدير الموثّقة لحساب bosrag.',price:0,color:'#f2ce87',source:'owner'},
    {id:'dice-porcelain',type:'dice',design:'porcelain',name:'نرد البورسلان',description:'سيراميك عاجي بحواف ذهبية ونقاط محفورة. أناقة الطاولة الأصلية.',price:280,color:'#eee8d9'},
    {id:'dice-crystal',type:'dice',design:'crystal',name:'نرد الكريستال',description:'حواف مشطوفة ونقاط ماسية مضيئة داخل زجاج زمردي.',price:480,color:'#3da99a'},
    {id:'dice-obsidian',type:'dice',design:'obsidian',name:'نرد الأوبسيديان',description:'حجر أسود مصقول، زوايا نحاسية ونقاط ذهبية مربّعة.',price:520,color:'#17212b'},
    {id:'snake-sovereign',type:'snake',name:'سيّد الحلبة',description:'خاص بالمدير: حراشف زمردية بنقوش ذهبية، رأس متوّج بعيون زمردية، وهالة ذهبية تتنفّس حوله مع شرر. المظهر لا يغيّر قوة اللعب.',price:0,color:'#e7c376',source:'owner'}
  ].map(i=>Object.freeze({...i,retired:RETIRED.has(i.id),rarity:i.source?'exclusive':i.price>=450?'legendary':i.price>=140?'rare':'common'})));
  // The previous catalogue remains readable for existing purchases and older
  // game clients. The new storefront exposes COLLECTION only.
  const COLLECTION=Object.freeze([
    {id:'stage-club',type:'stage',name:'هوية النادي',subtitle:'كحلي ولمسات نعناع',design:'club',price:0,color:'#78d6bf'},
    {id:'stage-aurora',type:'stage',name:'هوية الشفق',subtitle:'بنفسجي وسماوي',design:'aurora',price:280,color:'#bda0f4'},
    {id:'stage-oasis',type:'stage',name:'هوية الواحة',subtitle:'زمرد ونحاس',design:'oasis',price:320,color:'#7ed6ac'},
    {id:'stage-solar',type:'stage',name:'هوية الشمس',subtitle:'أسود وذهب دافئ',design:'solar',price:380,color:'#e7bd78'},

    {id:'pawn-atlas',type:'pawn',name:'أطلس',subtitle:'تيتانيوم مصقول',design:'spire',price:0,color:'#a5b5bb',collection:'atelier-30'},
    // 33.0.0: your hero walks the snakes & ladders board instead of a stone
    {id:'pawn-character',type:'pawn',name:'شخصيتي',subtitle:'شخصيتك المفعّلة',design:'character',price:0,color:'#d9b45a',collection:'atelier-30'},
    {id:'pawn-rook',type:'pawn',name:'الحصن',subtitle:'هندسة معمارية',design:'rook',price:240,color:'#cc9d68',collection:'atelier-30'},
    {id:'pawn-orbit',type:'pawn',name:'المدار',subtitle:'نواة داخل حلقة',design:'orbit',price:380,color:'#d4ad68',collection:'atelier-30'},
    {id:'pawn-lance',type:'pawn',name:'الرمح',subtitle:'كربون ومعدن',design:'lance',price:320,color:'#7e969c',collection:'atelier-30'},
    {id:'pawn-lotus',type:'pawn',name:'اللوتس',subtitle:'زجاج منحوت',design:'lotus',price:460,color:'#e49f9e',collection:'atelier-30'},
    {id:'pawn-monolith',type:'pawn',name:'المونوليث',subtitle:'بلورة هندسية',design:'monolith',price:580,color:'#b4d8ce',collection:'atelier-30'},
    {id:'dice-studio',type:'dice',name:'ستوديو',subtitle:'بورسلان ونقاط حبرية',design:'porcelain',price:0,color:'#eee8da',collection:'atelier-30'},
    {id:'dice-smoke',type:'dice',name:'الدخان',subtitle:'زجاج داكن وحواف معدنية',design:'smoke',price:320,color:'#59646b',collection:'atelier-30'},
    {id:'dice-oxblood',type:'dice',name:'العقيق',subtitle:'راتنج خمري عميق',design:'resin',price:380,color:'#8f3543',collection:'atelier-30'},
    {id:'dice-milled',type:'dice',name:'المشغول',subtitle:'ألمنيوم مشطوف',design:'milled',price:480,color:'#9ba9ae',collection:'atelier-30'},
    {id:'table-club',type:'table',name:'النادي',subtitle:'جوز داكن وتطعيم نحاسي',design:'walnut',price:0,color:'#9f7550',collection:'atelier-30'},
    {id:'table-gallery',type:'table',name:'المعرض',subtitle:'عاج وحبر فحمي',design:'ivory',price:280,color:'#d5cbb7',collection:'atelier-30'},
    {id:'table-nocturne',type:'table',name:'نوكترن',subtitle:'كربون ومسارات مضيئة',design:'carbon',price:420,color:'#657b85',collection:'atelier-30'},
    {id:'table-botanic',type:'table',name:'الحديقة',subtitle:'يشم وتطعيم نباتي',design:'jade',price:460,color:'#5eaa91',collection:'atelier-30'},
    {id:'table-majlis',type:'table',name:'المجلس',subtitle:'سدو أحمر ودلّة نحاس',design:'majlis',price:380,color:'#8e1526'},
    // 33.7.0: the Jackaroo boards — one board (the cross of the picture), dressed seven ways
    {id:'jboard-neon',type:'jboard',name:'لوحة النيون',subtitle:'كحلي وإطار نيون أزرق',design:'neon',price:0,color:'#1d3378'},
    {id:'jboard-gold',type:'jboard',name:'لوحة الذهب',subtitle:'جوخ أسود وإطار ذهب وشعار الجاكارو',design:'gold',price:650,color:'#c9a24f'},
    {id:'jboard-emerald',type:'jboard',name:'لوحة الزمرد',subtitle:'جوخ أخضر وإطار جوز ونحاس',design:'emerald',price:420,color:'#226a4a'},
    {id:'jboard-marble',type:'jboard',name:'لوحة الرخام',subtitle:'رخام أبيض وخطوط ذهب',design:'marble',price:480,color:'#e8e2d6'},
    {id:'jboard-carbon',type:'jboard',name:'لوحة الكربون',subtitle:'كربون وإطار نيون سماوي',design:'carbon',price:450,color:'#16222e'},
    {id:'jboard-royal',type:'jboard',name:'لوحة القصر',subtitle:'مخمل بنفسجي وإطار ذهب',design:'royal',price:750,color:'#3e2263'},
    {id:'jboard-majlis',type:'jboard',name:'لوحة المجلس',subtitle:'سدو أحمر وإطار خشب',design:'majlis',price:550,color:'#741c29'},
    {id:'trail-pencil',type:'trail',name:'خط الضوء',subtitle:'مسار رفيع وهادئ',design:'line',price:0,color:'#e5d6b8',collection:'atelier-30'},
    {id:'trail-ripple',type:'trail',name:'تموّج',subtitle:'حلقات عند الوصول',design:'ripple',price:160,color:'#7bd0be',collection:'atelier-30'},
    {id:'trail-meteor',type:'trail',name:'شهاب',subtitle:'ذيل من شرارات قصيرة',design:'meteor',price:240,color:'#f4b36c',collection:'atelier-30'},
    {id:'trail-echo',type:'trail',name:'صدى',subtitle:'أثر هندسي متتابع',design:'echo',price:320,color:'#94b4e5',collection:'atelier-30'},
    {id:'victory-studio',type:'victory',name:'لحظة الفوز',subtitle:'حلقة ضوء وقصاصات',design:'studio',price:0,color:'#d6b77e',collection:'atelier-30'},
    {id:'victory-nova',type:'victory',name:'نوفا',subtitle:'انفجار نجمي محدود',design:'nova',price:360,color:'#e5bc76',collection:'atelier-30'},
    {id:'victory-bloom',type:'victory',name:'تفتّح',subtitle:'بتلات مضيئة',design:'bloom',price:380,color:'#e2a5b3',collection:'atelier-30'},
    {id:'victory-orbit',type:'victory',name:'احتفال المدار',subtitle:'حلقات متقاطعة',design:'orbit',price:480,color:'#8dd8c5',collection:'atelier-30'},
    {id:'title-tactician',type:'title',name:'صانع الخطط',subtitle:'توقيعك على الطاولة',design:'signature',price:180,color:'#c9b38e',collection:'atelier-30'},
    {id:'title-virtuoso',type:'title',name:'مايسترو',subtitle:'هوية المجموعات',design:'signature',price:420,color:'#e5b7a4',collection:'atelier-30'}
  ].map(item=>Object.freeze({...item,description:item.type==='stage'?'هوية ألوان لقوائم الألعاب وحواف الساحات وشريط معلوماتك، تعمل في الألعاب كلها.':item.id==='pawn-character'?'في الثعبان والسلالم تمشي شخصيتك المفعّلة من المتجر بدل الحجر، ويشوفها كل اللاعبين. في الزهرة والجاكارو يبقى الحجر الكلاسيكي.':item.type==='pawn'?'حجر مجسّم بتصميم '+item.name+'؛ يتلوّن بلون اللاعب ويظهر في الجاكارو والزهرة.':item.type==='table'?'طاولة بلوت كاملة: '+item.subtitle+'. وتلبس لوحة الزهرة.':item.type==='dice'?'نرد '+item.subtitle+' يظهر في ألعاب النرد واللوحات.':item.type==='trail'?'مؤثر '+item.subtitle+' لحركة الأحجار في الجاكارو والزهرة.':item.type==='victory'?'احتفال '+item.subtitle+' عند فوزك، يحترم الكتم وتقليل الحركة.':'لقب '+item.name+' يظهر في ملفك وشاشة الفوز.',rarity:item.price>=450?'legendary':item.price>=180?'rare':'common',retired:false})));
  // 31.0.0 — reactions bought with game coins: animated emoji, ready-made
  // phrases and board-wide moves. They are owned, never equipped, and the
  // first eight keep the ids older rooms already relay (`legacy`).
  const REACTION_TYPES=Object.freeze(['emote','phrase','move']);
  const REACTIONS=Object.freeze([
    {"id": "move-tomato", "type": "move", "name": "خذ طماطم", "glyph": "✦", "fx": "cinema-tomato", "price": 320, "color": "#f17d69"},
    {"id": "move-live-wave", "type": "move", "name": "يا هلا باللي وصل", "glyph": "✦", "fx": "cinema-wave", "price": 0, "color": "#8adccf"},
    {"id": "move-live-laugh", "type": "move", "name": "ضحك من القلب", "glyph": "✦", "fx": "cinema-laugh", "price": 280, "color": "#ffd38c"},
    {"id": "move-slow-motion", "type": "move", "name": "صحّوني إذا خلّص", "glyph": "✦", "fx": "cinema-slow", "price": 240, "color": "#a6c8f3"},
    {"id": "move-slow-clap", "type": "move", "name": "تصفيق على مهلك", "glyph": "✦", "fx": "cinema-clap", "price": 300, "color": "#8dd9bf"},
    {"id": "move-peekaboo", "type": "move", "name": "شايفك يا بطل", "glyph": "✦", "fx": "cinema-peek", "price": 260, "color": "#eeb9df"},
    {"id": "move-mic-drop", "type": "move", "name": "انتهى الكلام", "glyph": "✦", "fx": "cinema-micdrop", "price": 480, "color": "#c4a6ec"},
    {"id": "move-crocodile-tears", "type": "move", "name": "يا خسارة", "glyph": "✦", "fx": "cinema-cry", "price": 260, "color": "#8dd9ee"},
    {"id": "move-cup-parade", "type": "move", "name": "الكأس عندي", "glyph": "✦", "fx": "cinema-trophy", "price": 420, "color": "#f6d189"},
    {"id": "move-popcorn", "type": "move", "name": "كمل أنا أتابع", "glyph": "✦", "fx": "cinema-popcorn", "price": 360, "color": "#f4c9a3"},
    {"id": "phrase-club-1", "type": "phrase", "name": "حظ ولا مهارة؟", "text": "حظ ولا مهارة؟ خلنا نشوف الرمية الجاية!", "glyph": "✦", "price": 90, "color": "#b6d6cb"},
    {"id": "phrase-club-2", "type": "phrase", "name": "خذ راحتك", "text": "خذ راحتك… الفشار معي", "glyph": "✦", "price": 100, "color": "#b6d6cb"},
    {"id": "phrase-club-3", "type": "phrase", "name": "تسخين", "text": "لا تستعجل، توّي أسخّن", "glyph": "✦", "price": 110, "color": "#b6d6cb"},
    {"id": "phrase-club-4", "type": "phrase", "name": "على مهلك", "text": "على مهلك يا أسطورة", "glyph": "✦", "price": 120, "color": "#b6d6cb"},
    {"id": "phrase-club-5", "type": "phrase", "name": "سجّلها", "text": "سجّل هاللقطة عندك", "glyph": "✦", "price": 130, "color": "#b6d6cb"},
    {"id": "phrase-club-6", "type": "phrase", "name": "مفاجأة", "text": "قدّامك مفاجأة صغيرة", "glyph": "✦", "price": 140, "color": "#b6d6cb"},

    {id:'emote-wheeze',type:'emote',name:'ميت ضحك',glyph:'🤣',fx:'face-laugh',price:180,color:'#ffd166'},
    {id:'emote-smirk',type:'emote',name:'قلتها لك',glyph:'😏',fx:'face-smirk',price:220,color:'#ffd166'},
    {id:'emote-troll',type:'emote',name:'طقطقة',glyph:'😜',fx:'face-tongue',price:260,color:'#f8b35a'},
    {id:'emote-sus',type:'emote',name:'متأكد؟',glyph:'🤨',fx:'face-sus',price:180,color:'#ffc56a'},
    {id:'emote-sleepy',type:'emote',name:'خذ وقتك',glyph:'🥱',fx:'face-yawn',price:180,color:'#ffca72'},
    {id:'emote-evilgrin',type:'emote',name:'الخطة ماشية',glyph:'😈',fx:'face-evil',price:280,color:'#ba91ed'},
    {id:'phrase-nice-try',type:'phrase',name:'كانت قريبة',text:'كانت قريبة… حاول مرة ثانية 😏',glyph:'😏',price:120,color:'#b7e1d2'},
    {id:'phrase-where',type:'phrase',name:'وين رحت؟',text:'وين رحت؟ أدورك على اللوحة 👀',glyph:'👀',price:140,color:'#b7e1d2'},
    {id:'phrase-back',type:'phrase',name:'راجع لك',text:'راجع لك… خلك جاهز 🔥',glyph:'🔥',price:140,color:'#f6bd82'},
    {id:'phrase-wave',type:'phrase',name:'هلا والله',text:'هلا والله 👋',glyph:'👋',price:0,color:'#91dcc8',voice:'p1'},
    {id:'move-wave',type:'move',name:'تحية الحلبة',glyph:'👋',fx:'performer-wave',price:220,color:'#78d6bf'},
    {id:'move-salute',type:'move',name:'سلام يا بطل',glyph:'🫡',fx:'performer-salute',price:280,color:'#91bfea'},
    {id:'move-laugh-roll',type:'move',name:'ضحكة الفوز',glyph:'🤣',fx:'performer-laugh',price:320,color:'#ffd166'},
    {id:'move-spotlight',type:'move',name:'تحت الأضواء',glyph:'🌟',fx:'performer-spotlight',price:380,color:'#dbbaff'},

    {id:'emote-clap',type:'emote',name:'برافو',glyph:'👏',fx:'clap',price:0,color:'#f4c95d',legacy:'clap'},
    {id:'emote-fire',type:'emote',name:'نار',glyph:'🔥',fx:'flame',price:0,color:'#ff7a3d',legacy:'fire'},
    {id:'emote-laugh',type:'emote',name:'ضحكتني',glyph:'😂',fx:'shake',price:0,color:'#ffd54a',legacy:'laugh'},
    {id:'emote-wow',type:'emote',name:'واو',glyph:'😮',fx:'pop',price:0,color:'#8fd3ff',legacy:'wow'},
    {id:'emote-angry',type:'emote',name:'قهر',glyph:'😤',fx:'steam',price:0,color:'#ff6b6b',legacy:'angry'},
    {id:'emote-please',type:'emote',name:'تكفى',glyph:'🙏',fx:'plead',price:140,color:'#ffcf8a'},
    {id:'emote-cool',type:'emote',name:'رايق',glyph:'😎',fx:'shine',price:160,color:'#5ec8ff'},
    {id:'emote-cry',type:'emote',name:'دموع',glyph:'😭',fx:'tears',price:160,color:'#7cc4ff'},
    {id:'emote-shh',type:'emote',name:'اسكت',glyph:'🤫',fx:'hush',price:180,color:'#c3a6ff'},
    {id:'emote-freeze',type:'emote',name:'تجمّدت',glyph:'🥶',fx:'frost',price:200,color:'#8fe3ff'},
    {id:'emote-dice',type:'emote',name:'حظ النرد',glyph:'🎲',fx:'spin',price:200,color:'#f2efe6'},
    {id:'emote-mind',type:'emote',name:'انفجر مخي',glyph:'🤯',fx:'blast',price:220,color:'#ff9a3c'},
    {id:'emote-devil',type:'emote',name:'شرير',glyph:'😈',fx:'devil',price:260,color:'#b16bff'},
    {id:'emote-snake',type:'emote',name:'لدغة',glyph:'🐍',fx:'slither',price:260,color:'#6cd88f'},
    {id:'emote-genius',type:'emote',name:'عبقري',glyph:'🧠',fx:'sparkle',price:320,color:'#ff9ec7'},
    {id:'emote-rocket',type:'emote',name:'طيران',glyph:'🚀',fx:'launch',price:340,color:'#ff8a5c'},
    {id:'emote-crown',type:'emote',name:'الملك',glyph:'👑',fx:'royal',price:480,color:'#ffd36b'},
    {id:'emote-diamond',type:'emote',name:'ألماسة',glyph:'💎',fx:'prism',price:520,color:'#7ff0ff'},
    // 33.9.0: faces that laugh and faces that rage, and moves thrown at a player you pick (target)
    {id:'emote-cackle',type:'emote',name:'هههههه',glyph:'😆',fx:'face-cackle',price:0,color:'#ffd54a'},
    {id:'emote-giggle',type:'emote',name:'ضحكة مكتومة',glyph:'🤭',fx:'face-giggle',price:0,color:'#ffd54a'},
    {id:'emote-rage',type:'emote',name:'معصّب',glyph:'😡',fx:'face-rage',price:0,color:'#ff5a4a'},
    {id:'emote-grumpy',type:'emote',name:'زعلان',glyph:'😒',fx:'face-grumpy',price:0,color:'#ffc35a'},
    {id:'emote-pointlaugh',type:'emote',name:'أضحك عليك',glyph:'🫵',fx:'face-point',price:200,color:'#ffd166'},
    {id:'emote-fume',type:'emote',name:'يغلي',glyph:'🥵',fx:'face-fume',price:180,color:'#ff7a4a'},
    {id:'emote-explode',type:'emote',name:'يتفجّر',glyph:'🤬',fx:'face-explode',price:240,color:'#ff4a3a'},
    {id:'move-hit-tomato',type:'move',name:'طماطم عليه',glyph:'🍅',fx:'duel-tomato',price:0,color:'#f17d69',target:true},
    {id:'move-hit-slipper',type:'move',name:'نعال طاير',glyph:'🩴',fx:'duel-slipper',price:0,color:'#5ab8ff',target:true},
    {id:'move-hit-kiss',type:'move',name:'بوسة',glyph:'💋',fx:'duel-kiss',price:0,color:'#ff6f93',target:true},
    {id:'move-hit-water',type:'move',name:'بالون ماي',glyph:'💦',fx:'duel-water',price:180,color:'#5ec8ff',target:true},
    {id:'move-hit-snow',type:'move',name:'كرة ثلج',glyph:'⛄',fx:'duel-snow',price:200,color:'#cfe6ff',target:true},
    {id:'move-hit-cake',type:'move',name:'كيكة بوجهه',glyph:'🥧',fx:'duel-cake',price:240,color:'#fff1d6',target:true},
    {id:'move-hit-roses',type:'move',name:'ورد له',glyph:'💐',fx:'duel-roses',price:260,color:'#ff5f7a',target:true},
    {id:'move-hit-punch',type:'move',name:'بوكس',glyph:'🥊',fx:'duel-punch',price:300,color:'#e3242c',target:true},
    {id:'phrase-hello',type:'phrase',name:'السلام عليكم',glyph:'👋',text:'السلام عليكم 👋',price:0,color:'#9fd8c7',voice:'p17'},
    {id:'phrase-gg',type:'phrase',name:'لعب نظيف',glyph:'🤝',text:'لعب نظيف 🤝',price:0,color:'#9fd8c7',legacy:'gg',voice:'p20'},
    {id:'phrase-luck',type:'phrase',name:'حظ أوفر',glyph:'🍀',text:'حظ أوفر 🍀',price:0,color:'#9fd8c7',legacy:'luck',voice:'p21'},
    {id:'phrase-fast',type:'phrase',name:'بسرعة شوي',glyph:'⚡',text:'بسرعة شوي ⚡',price:0,color:'#9fd8c7',legacy:'fast',voice:'p22'},
    // 33.8.0: the talk of the Baloot table in every room — free, and spoken in the voice of the voice studio
    {id:'phrase-salam-back',type:'phrase',name:'وعليكم السلام',glyph:'🤝',text:'وعليكم السلام 🤝',price:0,color:'#9fd8c7',voice:'p18'},
    {id:'phrase-kafu',type:'phrase',name:'كفو',glyph:'💪',text:'كفو! 💪',price:0,color:'#9fd8c7',voice:'p19'},
    {id:'phrase-tawfeeq',type:'phrase',name:'بالتوفيق',glyph:'🤝',text:'بالتوفيق 🤝',price:0,color:'#9fd8c7',voice:'p2'},
    {id:'phrase-hilw',type:'phrase',name:'يا حلو اللعب',glyph:'🔥',text:'يا حلو اللعب 🔥',price:0,color:'#9fd8c7',voice:'p3'},
    {id:'phrase-tatawwil',type:'phrase',name:'لا تطوّل',glyph:'😅',text:'لا تطوّل 😅',price:0,color:'#9fd8c7',voice:'p6'},
    {id:'phrase-hadh',type:'phrase',name:'وش ذا الحظ',glyph:'😳',text:'وش ذا الحظ! 😳',price:0,color:'#9fd8c7',voice:'p7'},
    {id:'phrase-gahwa',type:'phrase',name:'قهوة',glyph:'☕',text:'قهوة؟ ☕',price:0,color:'#9fd8c7',voice:'p9'},
    {id:'phrase-alaina',type:'phrase',name:'خلها علينا',glyph:'💪',text:'خلها علينا 💪',price:0,color:'#9fd8c7',voice:'p10'},
    {id:'phrase-halal',type:'phrase',name:'حلال عليكم',glyph:'👏',text:'حلال عليكم 👏',price:0,color:'#9fd8c7',voice:'p12'},
    {id:'phrase-sater',type:'phrase',name:'يا ساتر',glyph:'😬',text:'يا ساتر 😬',price:0,color:'#9fd8c7',voice:'p13'},
    {id:'phrase-abshir',type:'phrase',name:'أبشر بالخير',glyph:'✨',text:'أبشر بالخير ✨',price:0,color:'#9fd8c7',voice:'p15'},
    {id:'phrase-maalesh',type:'phrase',name:'الجاية لنا',glyph:'🙏',text:'معليش، الجاية لنا 🙏',price:0,color:'#9fd8c7',voice:'p16'},
    {id:'phrase-lucky',type:'phrase',name:'يا حظك',glyph:'😏',text:'يا حظك! 😏',price:120,color:'#86c8ff'},
    {id:'phrase-help',type:'phrase',name:'الله يعين',glyph:'😂',text:'الله يعين 😂',price:120,color:'#86c8ff'},
    {id:'phrase-mine',type:'phrase',name:'خلها علي',glyph:'😎',text:'خلها علي 😎',price:140,color:'#86c8ff'},
    {id:'phrase-pro',type:'phrase',name:'ضربة معلّم',glyph:'🎯',text:'ضربة معلّم 🎯',price:160,color:'#8fb4ff'},
    {id:'phrase-focus',type:'phrase',name:'ركّز معي',glyph:'🧠',text:'ركّز معي 🧠',price:160,color:'#8fb4ff'},
    {id:'phrase-wait',type:'phrase',name:'الحلو للآخر',glyph:'⏳',text:'الحلو للآخر ⏳',price:180,color:'#8fb4ff'},
    {id:'phrase-next',type:'phrase',name:'انتظر رميتي',glyph:'🎲',text:'انتظر رميتي الجاية 🎲',price:180,color:'#8fb4ff'},
    {id:'phrase-trap',type:'phrase',name:'ورّطت نفسك',glyph:'😅',text:'تراك ورّطت نفسك 😅',price:200,color:'#a99bff'},
    {id:'phrase-shock',type:'phrase',name:'يا ساتر',glyph:'😳',text:'يا ساتر من حظك 😳',price:200,color:'#a99bff'},
    {id:'phrase-nomercy',type:'phrase',name:'ما فيه رحمة',glyph:'😈',text:'ما فيه رحمة 😈',price:240,color:'#c58bff'},
    {id:'phrase-round',type:'phrase',name:'الجولة لي',glyph:'👑',text:'هذي الجولة لي 👑',price:300,color:'#e3a3ff'},
    {id:'phrase-congrats',type:'phrase',name:'مبروك مقدمًا',glyph:'🏆',text:'مبروك مقدمًا 🏆',price:300,color:'#e3a3ff'},
    {id:'phrase-genius',type:'phrase',name:'أنا العبقري',glyph:'✨',text:'أنا العبقري هنا 🧠✨',price:480,color:'#ffd36b'},
    {id:'move-confetti',type:'move',name:'قصاصات',glyph:'🎉',fx:'confetti',price:0,color:'#ffcf5a'},
    {id:'move-snow',type:'move',name:'ثلج',glyph:'❄️',fx:'snow',price:220,color:'#bfeaff'},
    {id:'move-hearts',type:'move',name:'قلوب',glyph:'💞',fx:'hearts',price:240,color:'#ff7eb6'},
    {id:'move-roses',type:'move',name:'ورد',glyph:'🌹',fx:'roses',price:280,color:'#ff5f7a'},
    {id:'move-lightning',type:'move',name:'صاعقة',glyph:'⚡',fx:'lightning',price:320,color:'#ffe55c'},
    {id:'move-quake',type:'move',name:'زلزال',glyph:'💥',fx:'quake',price:320,color:'#ff9a52'},
    {id:'move-fireworks',type:'move',name:'ألعاب نارية',glyph:'🎆',fx:'fireworks',price:380,color:'#ff6bd6'},
    {id:'move-rocket',type:'move',name:'صاروخ',glyph:'🚀',fx:'rocket',price:420,color:'#ff8a5c'},
    {id:'move-goldrain',type:'move',name:'مطر ذهبي',glyph:'💰',fx:'gold',price:520,color:'#ffd36b'},
    {id:'move-crown',type:'move',name:'تتويج',glyph:'👑',fx:'crown',price:600,color:'#ffc94d'},
    {id:'move-sovereign',type:'move',name:'هيبة المدير',glyph:'🐍',fx:'sovereign',price:0,color:'#e7c376',source:'owner'}
  ].map(item=>Object.freeze({...item,collection:'reactions-31',description:item.type==='emote'?'إيموجي متحرك يظهر فوق اللوحة لكل اللاعبين، مع صوت خفيف.':item.type==='phrase'?'عبارة جاهزة تظهر باسمك في فقاعة داخل الغرفة.':item.source==='owner'?'حركة المدير: هالة ذهبية وثعبان ملكي يلتف حول اللوحة.':item.target?'ترميها على لاعب تختاره: تطير له وتنزل عليه، ووجهه يرد عليك، ويقدر يرد لك.':'حركة استعراضية تملأ اللوحة بمؤثرات وأصوات لكل اللاعبين.',rarity:item.source?'exclusive':item.price>=450?'legendary':item.price>=300?'epic':item.price>=150?'rare':'common',retired:false})));
  const LEGACY_REACTIONS=Object.freeze(Object.fromEntries(REACTIONS.filter(item=>item.legacy).map(item=>[item.legacy,item.id])));
  const CATALOG=Object.freeze([...LEGACY_CATALOG,...COLLECTION,...REACTIONS]);
  // What the 31.0.0 storefront shows: every design with its own look, no
  // retired pieces and no second copy of an identical shape or material.
  const STOREFRONT=Object.freeze([
    'stage-club','stage-aurora','stage-oasis','stage-solar',
    'pawn-classic','pawn-character','pawn-atlas','pawn-rook','pawn-lance','pawn-amethyst','pawn-orb','pawn-orbit','pawn-lotus','pawn-crown','pawn-monolith',
    'character-fox','character-cat','character-racer','character-robot','character-diver','character-princess','character-viking','character-gladiator','character-fairy','character-astronaut','character-cyber','character-samurai',
    'deck-classic','deck-four','deck-night','deck-emerald','deck-royal',
    'dice-studio','dice-porcelain','dice-smoke','dice-nebula','dice-oxblood','dice-milled','dice-crystal','dice-obsidian','dice-gold',
    'table-club','table-gallery','table-nocturne','table-botanic','table-royal','table-majlis',
    'jboard-neon','jboard-gold','jboard-emerald','jboard-marble','jboard-carbon','jboard-royal','jboard-majlis',
    'board-forest','board-cyber','board-lava','board-galaxy','board-royal',
    'snake-wild','snake-aurora','snake-ice','snake-toxic','snake-gold','snake-plasma','snake-sovereign',
    ...REACTIONS.map(item=>item.id),
    'trail-pencil','trail-ripple','trail-comet','trail-meteor','trail-echo','trail-plasma',
    'victory-studio','victory-aurora','victory-nova','victory-bloom','victory-royal','victory-orbit',
    'title-player','title-tactician','title-virtuoso','title-legend','title-starfinder','title-pathmaster','title-manager'
  ]);
  const isReaction=item=>Boolean(item)&&REACTION_TYPES.includes(item.type);
  const reactionOf=value=>{const id=LEGACY_REACTIONS[value]||value;return REACTIONS.find(item=>item.id===id)||null;};
  const SLOTS=['character','pawn','dice','board','table','jboard','deck','snake','trail','victory','title','stage'];
  const BUNDLES=Object.freeze([
    {id:'club-banter',name:'جلسة طقطقة',description:'ميت ضحك، طقطقة، كانت قريبة وتحية الحلبة.',color:'#ffd166',items:['emote-wheeze','emote-troll','phrase-nice-try','move-wave']},
    {id:'club-spotlight',name:'دخول البطل',description:'هوية الشفق، تحت الأضواء وسلام يا بطل.',color:'#bda0f4',items:['stage-aurora','move-spotlight','move-salute']},

    {id:'atelier-club',name:'مجموعة النادي',description:'جوز داكن، حجر الحصن، نرد العقيق وأثر الشهاب.',color:'#bb865a',collection:'atelier-30',items:['pawn-rook','dice-oxblood','table-club','trail-meteor']},
    {id:'atelier-gallery',name:'مجموعة المعرض',description:'لوحة عاجية، حجر المدار، نرد مشغول واحتفال نوفا.',color:'#d4c4a3',collection:'atelier-30',items:['pawn-orbit','dice-milled','table-gallery','victory-nova']},
    {id:'atelier-botanic',name:'مجموعة الحديقة',description:'يشم وزجاج اللوتس وتموّج الضوء وبتلات الفوز.',color:'#77b7a1',collection:'atelier-30',items:['pawn-lotus','table-botanic','trail-ripple','victory-bloom']},
    {id:'reactor-set',name:'مجموعة المفاعل',description:'ثعابين ونرد وحلبة وأثر حركة بهوية كهربائية واحدة.',color:'#57d9ff',items:['snake-toxic','dice-nebula','board-cyber','trail-comet']},
    {id:'aurora-set',name:'مجموعة الكريستال',description:'أفعى شفقية وحجر جمشت ونرد كريستالي مع احتفال خاص.',color:'#88daca',items:['snake-aurora','pawn-amethyst','dice-crystal','victory-aurora']},
    {id:'royal-set',name:'مجموعة التتويج',description:'حجر ونرد وحلبة وطاولة ملكية مع نجوم الفوز.',color:'#f4cb79',items:['pawn-gold','dice-gold','board-royal','table-royal','victory-royal']},
    {id:'react-fans',name:'باقة المشجّع',description:'رايق، انفجر مخي، طيران وعبارة ضربة معلّم.',color:'#5ec8ff',collection:'reactions-31',items:['emote-cool','emote-mind','emote-rocket','phrase-pro']},
    {id:'react-banter',name:'باقة الطقطقة',description:'يا حظك، ورّطت نفسك، ما فيه رحمة مع اسكت وشرير.',color:'#b16bff',collection:'reactions-31',items:['phrase-lucky','phrase-trap','phrase-nomercy','emote-shh','emote-devil']},
    {id:'heroes-set',name:'مجموعة المحاربين',description:'الساموراي والفايكنج والمصارع: ثلاث خوذ أسطورية للسلم والثعبان والبلوت.',color:'#d9b25a',collection:'heroes-32',items:['character-samurai','character-viking','character-gladiator']},
    {id:'baloot-set',name:'مجموعة المجلس',description:'ورق الذهب الأسود والزمرد وأربعة ألوان لطاولة البلوت.',color:'#e3b450',collection:'baloot-32',items:['deck-royal','deck-emerald','deck-four']},
    {id:'react-show',name:'باقة الاستعراض',description:'ألعاب نارية وصاعقة ومطر ذهبي مع إيموجي الملك.',color:'#ffc94d',collection:'reactions-31',items:['move-fireworks','move-lightning','move-goldrain','emote-crown']}
  ].map(b=>Object.freeze({...b,items:Object.freeze(b.items),discount:.25})));
  const OBJECTIVES=Object.freeze([
    {id:'daily-play',kind:'daily',name:'ثلاث جولات اليوم',description:'أكمل 3 جولات من أي لعبة.',metric:'games',goal:3,coins:30},
    {id:'daily-win',kind:'daily',name:'ثلاث انتصارات',description:'اربح 3 جولات اليوم.',metric:'wins',goal:3,coins:40},
    {id:'daily-variety',kind:'daily',name:'غيّر الحلبة',description:'أكمل جولة في لعبتين مختلفتين اليوم.',metric:'variety',goal:2,coins:40},
    {id:'weekly-play',kind:'weekly',name:'أسبوع من التحدّي',description:'أكمل 12 جولة هذا الأسبوع.',metric:'games',goal:12,coins:130},
    {id:'weekly-win',kind:'weekly',name:'سلسلة الانتصارات',description:'اربح 8 جولات هذا الأسبوع.',metric:'wins',goal:8,coins:120},
    {id:'weekly-online',kind:'weekly',name:'خصوم حقيقيون',description:'أكمل 3 مباريات أونلاين بنتائج موثّقة.',metric:'online',goal:3,coins:160},
    {id:'first-win',kind:'achievement',name:'الانتصار الأول',description:'حقق أول فوز لك.',metric:'wins',goal:1,coins:25},
    {id:'ten-games',kind:'achievement',name:'بداية المشوار',description:'أكمل 10 جولات.',metric:'games',goal:10,coins:60},
    {id:'fifty-games',kind:'achievement',name:'أسطورة النيون',description:'أكمل 50 جولة وافتح اللقب الحصري.',metric:'games',goal:50,coins:180,item:'title-legend'},
    {id:'hundred-games',kind:'achievement',name:'مئة تحدٍّ',description:'أكمل 100 جولة.',metric:'games',goal:100,coins:350},
    {id:'collector',kind:'achievement',name:'خزانة الكنوز',description:'امتلك 10 إضافات مدفوعة مختلفة.',metric:'collection',goal:10,coins:150},
    {id:'online-winner',kind:'achievement',name:'بطل المنافسة',description:'اربح 5 مباريات أونلاين موثّقة.',metric:'rankedWins',goal:5,coins:150}
  ].map(Object.freeze));
  const GAME_IDS=['snakes','jackaroo','quiz','memory','reaction','logic','puzzle','accuracy','dice','zahra','serpent','jewels','paths','sudoku','baloot','focus','cipher','wordbomb','chaos','hockey','billiards'];
  // 33.2.0: a Baloot mission every day and one more game that changes daily
  const GAME_MISSIONS=Object.freeze([
    ['baloot','games',2,60,'جلسة بلوت','العب صكّتين بلوت كاملة اليوم.'],['baloot','wins',1,80,'صكّة لك','اربح صكّة بلوت اليوم.'],
    ['snakes','games',2,50,'الثعبان والسلالم','العب جولتين في الثعبان والسلالم اليوم.'],['zahra','games',2,50,'طاولة الزهرة','العب جولتين زهرة اليوم.'],
    ['quiz','games',2,50,'تحدي الأسئلة','العب مباراتين في تحدي الأسئلة اليوم.'],['jackaroo','games',2,50,'جاكارو','العب جولتين جاكارو اليوم.'],
    ['dice','wins',1,70,'سباق النرد','اربح جولة في تحدي النرد اليوم.'],['serpent','games',3,50,'حلبة الثعابين','العب 3 جولات في حلبة الثعابين اليوم.'],
    ['snakes','wins',1,70,'أول من يوصل','اربح جولة في الثعبان والسلالم اليوم.'],['sudoku','games',1,50,'سودوكو أونلاين','العب مباراة سودوكو أونلاين اليوم.'],
    // 33.6.0: the new games have missions too
    ['chaos','games',2,50,'طاولة أونو','أكمل مباراتين أونو اليوم.'],['wordbomb','games',2,50,'صيد الكلمات','العب مباراتين في صيد الكلمات اليوم.'],['cipher','wins',1,70,'فك الشفرة','افُز بمباراة في ساحة الشفرات اليوم.']
    ,['hockey','games',2,50,'موعد الهوكي','أكمل مواجهتي هوكي اليوم.'],['focus','games',2,50,'تركيزك يصنع الفارق','أكمل مواجهتي تركيز اليوم.']
    // 33.9.0: billiards
    ,['billiards','games',2,50,'طاولة البلياردو','العب مباراتين بلياردو اليوم.']
  ].map(([game,metric,goal,coins,name,description])=>Object.freeze({id:'day-'+game+(metric==='wins'?'-win':'-play'),game,metric,goal,coins,name,description})));
  function gameMissionsFor(day){
    const n=Math.floor(Date.parse(day+'T00:00:00Z')/86400000)||0,baloot=GAME_MISSIONS.filter(m=>m.game==='baloot'),others=GAME_MISSIONS.filter(m=>m.game!=='baloot');
    return [baloot[n%baloot.length],others[n%others.length]];
  }
  const COSMETIC_STYLES=Object.freeze({
    'stage-club':{'--club-accent':'#78d6bf','--club-surface':'#112c35'},
    'stage-aurora':{'--club-accent':'#bda0f4','--club-surface':'#292043'},
    'stage-oasis':{'--club-accent':'#7ed6ac','--club-surface':'#143b31'},
    'stage-solar':{'--club-accent':'#e7bd78','--club-surface':'#382d1b'},

    'dice-studio':{'--die-color':'#eee8da','--die-highlight':'#fffdf4','--die-shade':'#b9aa8f','--die-pip':'#182027','--die-pip-light':'#465158','--die-edge':'#b8a484','--die-radius':'18%','--die-pip-radius':'50%'},
    'dice-smoke':{'--die-color':'#39454c','--die-highlight':'#a8b8ba','--die-shade':'#10191f','--die-pip':'#f2dfb9','--die-pip-light':'#fff9e9','--die-edge':'#94a9ae','--die-radius':'12%','--die-pip-radius':'50%'},
    'dice-oxblood':{'--die-color':'#842c39','--die-highlight':'#d98489','--die-shade':'#300f1b','--die-pip':'#fff3dc','--die-pip-light':'#fff','--die-edge':'#d29b78','--die-radius':'21%','--die-pip-radius':'50%'},
    'dice-milled':{'--die-color':'#aab7bb','--die-highlight':'#f5fbf9','--die-shade':'#3f535b','--die-pip':'#1b252b','--die-pip-light':'#56686d','--die-edge':'#d0d7d3','--die-radius':'7%','--die-pip-radius':'20%'},
    'table-club':{'--table-look':'none'},'table-majlis':{'--table-look':'none'},'table-gallery':{'--table-look':'none'},'table-nocturne':{'--table-look':'none'},'table-botanic':{'--table-look':'none'},
    'trail-pencil':{'--trail-color':'#e5d6b8'},'trail-ripple':{'--trail-color':'#7bd0be'},'trail-meteor':{'--trail-color':'#f4b36c'},'trail-echo':{'--trail-color':'#94b4e5'},
    'dice-porcelain':{'--die-color':'#eee8d9','--die-highlight':'#fffef9','--die-shade':'#b7a37c','--die-pip':'#24313b','--die-pip-light':'#546575','--die-edge':'#d8bd82','--die-radius':'21%','--die-pip-radius':'50%'},
    'dice-crystal':{'--die-color':'#208b7b','--die-highlight':'#a5f1d9','--die-shade':'#0b3b3b','--die-pip':'#d6fff1','--die-pip-light':'#ffffff','--die-edge':'#85ebd0','--die-radius':'7%','--die-pip-radius':'12%'},
    'dice-obsidian':{'--die-color':'#17212b','--die-highlight':'#566573','--die-shade':'#080d14','--die-pip':'#ebc677','--die-pip-light':'#fff0bb','--die-edge':'#bd9860','--die-radius':'11%','--die-pip-radius':'22%'},
    'dice-ivory':{'--die-color':'#f3eee3','--die-highlight':'#ffffff','--die-shade':'#c7bda8','--die-pip':'#08101f','--die-pip-light':'#344257'},
    'dice-midnight':{'--die-color':'#202c40','--die-highlight':'#526982','--die-shade':'#101a2a','--die-pip':'#f6ecd9','--die-pip-light':'#ffffff'},
    'dice-copper':{'--die-color':'#ce9564','--die-highlight':'#ffe0b5','--die-shade':'#744122','--die-pip':'#23150c','--die-pip-light':'#50331d'},
    'dice-aurora':{'--die-color':'#a78bdd','--die-highlight':'#eadfff','--die-shade':'#68528e','--die-pip':'#241537','--die-pip-light':'#463255'},
    'dice-gold':{'--die-color':'#e3b65e','--die-highlight':'#fff2bc','--die-shade':'#8c611f','--die-pip':'#291c05','--die-pip-light':'#4e3b0d'},
    'dice-nebula':{'--die-color':'#245797','--die-highlight':'#73b8eb','--die-shade':'#123353','--die-pip':'#f3f4e7','--die-pip-light':'#ffffff'},
    'dice-ruby':{'--die-color':'#a32f50','--die-highlight':'#ef94af','--die-shade':'#542036','--die-pip':'#fff3e0','--die-pip-light':'#ffffff'},
    'board-forest':{'--arena-board-filter':'none'},'board-ocean':{'--arena-board-filter':'hue-rotate(-18deg) saturate(1.4)'},
    'board-sand':{'--arena-board-filter':'hue-rotate(145deg) saturate(.7) sepia(.22)'},'board-twilight':{'--arena-board-filter':'hue-rotate(35deg) saturate(1.35)'},
    'board-royal':{'--arena-board-filter':'hue-rotate(150deg) saturate(.75) brightness(1.12)'},'board-cyber':{'--arena-board-filter':'hue-rotate(-32deg) saturate(1.7)'},
    'table-walnut':{'--table-look':'none'},'table-slate':{'--table-look':'saturate(.25) brightness(.85)'},'table-emerald':{'--table-look':'hue-rotate(70deg)'},
    'table-midnight':{'--table-look':'hue-rotate(170deg) brightness(.72)'},'table-royal':{'--table-look':'hue-rotate(260deg) saturate(1.15)'},'table-cyber':{'--table-look':'hue-rotate(195deg) saturate(.8)'},
    'pawn-classic':{'--pawn-look':'none'},'pawn-jade':{'--pawn-look':'drop-shadow(0 0 7px #55ffbc) brightness(1.15)'},
    'pawn-amethyst':{'--pawn-look':'drop-shadow(0 0 7px #d17cff) brightness(1.22)'},'pawn-gold':{'--pawn-look':'drop-shadow(0 0 7px #ffd15a) brightness(1.3)'},
    'pawn-onyx':{'--pawn-look':'drop-shadow(0 0 5px #e7b363) brightness(.7)'},'pawn-prism':{'--pawn-look':'drop-shadow(0 0 7px #b7f8ff) hue-rotate(32deg) brightness(1.25)'},
    'pawn-orb':{'--pawn-look':'none'},'pawn-crown':{'--pawn-look':'none'},
    'trail-none':{'--trail-color':'#20ccff'},'trail-comet':{'--trail-color':'#4ce6ff'},'trail-plasma':{'--trail-color':'#e777ff'}
  });
  const finite=n=>Math.max(0,Math.min(100000000,Math.floor(Number(n)||0)));
  function period(raw={}){raw=raw&&typeof raw==='object'?raw:{};const byGame={};for(const game of GAME_IDS){const row=raw.byGame?.[game];if(row&&typeof row==='object'&&(row.g||row.w))byGame[game]={g:finite(row.g),w:finite(row.w)}}return {key:String(raw.key||'').slice(0,10),games:finite(raw.games),wins:finite(raw.wins),online:finite(raw.online),variety:[...new Set(Array.isArray(raw.variety)?raw.variety:[])].filter(x=>GAME_IDS.includes(x)),byGame,claimed:[...new Set(Array.isArray(raw.claimed)?raw.claimed:[])].filter(x=>OBJECTIVES.some(o=>o.id===x)||GAME_MISSIONS.some(o=>o.id===x))}}
  // 33.9.4: games and wins of each game, for the trophies
  function cleanStats(raw){const out={};if(raw&&typeof raw==='object')for(const id of GAME_IDS){const r=raw[id];if(Array.isArray(r))out[id]=[finite(r[0]),Math.min(finite(r[0]),finite(r[1]))]}return out}
  function normalize(raw={}){
    raw=raw&&typeof raw==='object'?raw:{};
    const free=CATALOG.filter(i=>i.price===0&&!i.source).map(i=>i.id);
    const owned=[...new Set([...free,...(Array.isArray(raw.owned)?raw.owned:[])])].filter(id=>CATALOG.some(i=>i.id===id));
    const equipped={character:'character-fox',pawn:'pawn-classic',dice:'dice-ivory',board:'board-forest',table:'table-walnut',jboard:'jboard-neon',deck:'deck-classic',snake:'snake-wild',trail:'trail-none',victory:'victory-classic',title:'title-player',stage:'stage-club'};
    // 33.7.0: a table that used to dress the Jackaroo board brings its Jackaroo board along
    for(const [table,board] of [['table-royal','jboard-royal'],['table-majlis','jboard-majlis'],['table-cyber','jboard-carbon']])if(owned.includes(table)&&!owned.includes(board))owned.push(board);
    for(const [type,id] of Object.entries(raw.equipped||{}))if(SLOTS.includes(type)&&owned.includes(id)&&CATALOG.some(i=>i.id===id&&i.type===type))equipped[type]=id;
    const xp=finite(raw.xp),rankedXP=finite(raw.rankedXP);
    return {version:12,dailyDay:String(raw.dailyDay||''),dailyStreak:Math.min(7,finite(raw.dailyStreak)),name:String(raw.name||'لاعب العباقرة').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,24)||'لاعب العباقرة',xp,rankedXP,coins:raw.coins==null?100:finite(raw.coins),wins:finite(raw.wins),losses:finite(raw.losses),games:finite(raw.games),stats:cleanStats(raw.stats),rankedWins:finite(raw.rankedWins),rankedLosses:finite(raw.rankedLosses),level:Math.floor(xp/1000)+1,rank:rankedXP>=20000?'Diamond':rankedXP>=8000?'Gold':rankedXP>=2500?'Silver':'Bronze',owned,equipped,receipts:Array.isArray(raw.receipts)?raw.receipts.filter(x=>typeof x==='string').slice(-300):[],checkouts:Array.isArray(raw.checkouts)?raw.checkouts.slice(-60).filter(row=>row&&typeof row.id==='string'&&/^[a-zA-Z0-9_-]{16,80}$/.test(row.id)&&Array.isArray(row.ids)&&row.ids.length>0&&row.ids.length<=12&&row.ids.every(id=>CATALOG.some(item=>item.id===id))&&Number.isSafeInteger(row.price)&&row.price>=0).map(row=>({id:row.id,ids:[...row.ids],price:row.price})):[],practiceDay:String(raw.practiceDay||''),practiceCount:finite(raw.practiceCount),missions:{daily:period(raw.missions?.daily),weekly:period(raw.missions?.weekly)},achievements:[...new Set(Array.isArray(raw.achievements)?raw.achievements:[])].filter(x=>OBJECTIVES.some(o=>o.id===x&&o.kind==='achievement'))};
  }
  function reward(raw,{id,game,win=false,verified=false,now=Date.now()}={}){
    const p=normalize(raw),receipt=String(id||'').slice(0,160);
    if(!receipt||!GAME_IDS.includes(game))throw new Error('invalid_result');
    if(p.receipts.includes(receipt))return p;
    const day=riyadhDay(now);
    if(!verified){if(p.practiceDay!==day){p.practiceDay=day;p.practiceCount=0}if(p.practiceCount>=20)return p;p.practiceCount++}
    const gain=verified?(win?250:80):(win?100:40);
    {const r=p.stats[game]||(p.stats[game]=[0,0]);r[0]++;if(win)r[1]++}p.xp+=gain;p.coins+=verified?(win?50:15):(win?20:8);p.games++;p[win?'wins':'losses']++;
    if(verified){p.rankedXP+=gain;p[win?'rankedWins':'rankedLosses']++}
    for(const kind of ['daily','weekly']){const key=kind==='daily'?riyadhDay(now):riyadhWeek(now);if(p.missions[kind].key!==key)p.missions[kind]=period({key});const m=p.missions[kind];m.games++;if(win)m.wins++;if(verified)m.online++;if(!m.variety.includes(game))m.variety.push(game);const row=m.byGame[game]||(m.byGame[game]={g:0,w:0});row.g++;if(win)row.w++}
    p.receipts.push(receipt);return normalize(p);
  }
  // 33.2.0: a server prize (the weekly Baloot cup), paid once per receipt
  function grant(raw,{id,coins=0,item=null}={}){
    const p=normalize(raw),receipt=String(id||'').slice(0,160),amount=finite(coins);
    if(!/^prize:[a-z0-9:_-]{3,150}$/.test(receipt)||amount>100000)throw new Error('invalid_prize');
    if(p.receipts.includes(receipt))return p;
    p.coins+=amount;if(item&&CATALOG.some(i=>i.id===item)&&!p.owned.includes(item))p.owned.push(item);
    p.receipts.push(receipt);return normalize(p);
  }
  function purchase(raw,id,{now=Date.now(),expectedPrice}={}){const p=normalize(raw),item=CATALOG.find(i=>i.id===id);if(!item)throw new Error('item_not_found');if(!p.owned.includes(id)){if(item.source)throw new Error('item_locked');if(item.retired)throw new Error('item_retired');const price=itemPrice(id,now);if(expectedPrice!=null&&expectedPrice!==price)throw new Error('price_changed');if(p.coins<price)throw new Error('insufficient_coins');p.coins-=price;p.owned.push(id)}if(!isReaction(item))p.equipped[item.type]=id;return normalize(p)}
  function equip(raw,id){const p=normalize(raw),item=CATALOG.find(i=>i.id===id);if(!item||!p.owned.includes(id))throw new Error('item_not_owned');if(!isReaction(item))p.equipped[item.type]=id;return normalize(p)}
  const DAILY_GIFTS=Object.freeze([30,40,50,60,75,90,120]);
  function riyadhDay(now=Date.now()){return new Date(now+10800000).toISOString().slice(0,10)}
  function riyadhWeek(now=Date.now()){const date=new Date(riyadhDay(now)+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);return date.toISOString().slice(0,10)}
  function dailyOffer(now=Date.now()){
    const items=CATALOG.filter(i=>STOREFRONT.includes(i.id)&&i.price>=300&&!i.source&&!i.retired),day=riyadhDay(now),index=Math.floor(Date.parse(day)/86400000)%items.length,item=items[index];
    return {id:item.id,price:Math.floor(item.price*.8),originalPrice:item.price,day};
  }
  function itemPrice(id,now=Date.now()){const item=CATALOG.find(i=>i.id===id);if(!item)throw new Error('item_not_found');const offer=dailyOffer(now);return offer.id===id?offer.price:item.price}
  function dailyStatus(raw,{now=Date.now()}={}){
    const p=normalize(raw),day=riyadhDay(now),claimed=p.dailyDay===day,consecutive=Date.parse(day)-Date.parse(p.dailyDay)===86400000;
    const streak=claimed?p.dailyStreak:consecutive?Math.min(7,p.dailyStreak+1):1;
    return {day,claimed,streak,coins:DAILY_GIFTS[streak-1],gifts:DAILY_GIFTS};
  }
  function claimDaily(raw,{now=Date.now()}={}){
    const p=normalize(raw),status=dailyStatus(p,{now});if(status.claimed)return p;
    return normalize({...p,coins:p.coins+status.coins,dailyDay:status.day,dailyStreak:status.streak});
  }
  function objectives(raw,{now=Date.now()}={}){
    const p=normalize(raw);
    const rows=OBJECTIVES.map(o=>{const key=o.kind==='daily'?riyadhDay(now):o.kind==='weekly'?riyadhWeek(now):'lifetime',stored=p.missions[o.kind],m=stored?.key===key?stored:period(),claimed=o.kind==='achievement'?p.achievements.includes(o.id):m.claimed.includes(o.id);const current=o.kind==='achievement'?(o.metric==='collection'?p.owned.filter(id=>CATALOG.find(i=>i.id===id)?.price>0).length:p[o.metric]||0):o.metric==='variety'?m.variety.length:m[o.metric]||0;return {...o,key,current,claimed,ready:current>=o.goal&&!claimed}});
    const day=riyadhDay(now),today=p.missions.daily?.key===day?p.missions.daily:period();
    const games=gameMissionsFor(day).map(o=>{const row=today.byGame[o.game]||{g:0,w:0},current=o.metric==='wins'?row.w:row.g,claimed=today.claimed.includes(o.id);return {...o,kind:'daily',key:day,current,claimed,ready:current>=o.goal&&!claimed}});
    const at=rows.findIndex(o=>o.kind!=='daily');rows.splice(at<0?rows.length:at,0,...games);return rows;
  }
  function claimObjective(raw,id,{now=Date.now()}={}){
    const p=normalize(raw),o=objectives(p,{now}).find(o=>o.id===id);if(!o)throw new Error('objective_not_found');if(o.claimed)return p;if(!o.ready)throw new Error('objective_incomplete');
    if(o.kind==='achievement')p.achievements.push(id);else{if(p.missions[o.kind].key!==o.key)p.missions[o.kind]=period({key:o.key});p.missions[o.kind].claimed.push(id)}
    p.coins+=o.coins;if(o.item&&!p.owned.includes(o.item))p.owned.push(o.item);return normalize(p);
  }
  function bundleQuote(raw,id,{now=Date.now()}={}){
    const p=normalize(raw),bundle=BUNDLES.find(b=>b.id===id);if(!bundle)throw new Error('bundle_not_found');
    const missing=bundle.items.filter(id=>!p.owned.includes(id)),originalPrice=missing.reduce((total,id)=>total+itemPrice(id,now),0),price=Math.floor(originalPrice*(1-bundle.discount));
    return {id,missing,price,originalPrice,saving:originalPrice-price};
  }
  function purchaseBundle(raw,id,{now=Date.now(),expectedPrice}={}){
    const p=normalize(raw),quote=bundleQuote(p,id,{now}),bundle=BUNDLES.find(b=>b.id===id);if(expectedPrice!=null&&expectedPrice!==quote.price)throw new Error('price_changed');if(p.coins<quote.price)throw new Error('insufficient_coins');p.coins-=quote.price;p.owned.push(...quote.missing);for(const id of bundle.items){const item=CATALOG.find(i=>i.id===id);if(!isReaction(item))p.equipped[item.type]=id}return normalize(p);
  }
  function cartQuote(raw,ids,{now=Date.now()}={}){
    const p=normalize(raw);
    if(!Array.isArray(ids)||ids.length<1||ids.length>12||new Set(ids).size!==ids.length)throw new Error('invalid_cart');
    const items=ids.map(id=>{const item=CATALOG.find(item=>item.id===id);if(!item)throw new Error('item_not_found');const owned=p.owned.includes(id);if(item.source&&!owned)throw new Error('item_locked');if(item.retired&&!owned)throw new Error('item_retired');return {id,type:item.type,price:owned?0:itemPrice(id,now),owned};});
    return {items,price:items.reduce((sum,item)=>sum+item.price,0),missing:items.filter(item=>!item.owned).map(item=>item.id)};
  }
  function purchaseCart(raw,ids,{now=Date.now(),expectedPrice,requestId}={}){
    const p=normalize(raw);
    if(typeof requestId!=='string'||!/^[a-zA-Z0-9_-]{16,80}$/.test(requestId))throw new Error('invalid_checkout_id');
    const previous=p.checkouts.find(row=>row.id===requestId);
    if(previous){if(JSON.stringify(previous.ids)!==JSON.stringify(ids)||previous.price!==expectedPrice)throw new Error('checkout_conflict');return p;}
    const quote=cartQuote(p,ids,{now});
    if(!Number.isSafeInteger(expectedPrice)||expectedPrice<0||expectedPrice!==quote.price)throw new Error('price_changed');
    if(p.coins<quote.price)throw new Error('insufficient_coins');
    p.coins-=quote.price;p.owned.push(...quote.missing);
    for(const item of quote.items)if(!REACTION_TYPES.includes(item.type))p.equipped[item.type]=item.id;
    p.checkouts.push({id:requestId,ids:[...ids],price:quote.price});
    return normalize(p);
  }
  function unlockJourney(raw,stars){const p=normalize(raw);for(const item of CATALOG)if(item.source==='journey'&&Number.isSafeInteger(stars)&&stars>=item.unlockStars&&!p.owned.includes(item.id))p.owned.push(item.id);return normalize(p);}
  // Hero characters by their short id (the value rooms exchange), the picture
  // in assets/heroes and the small face used as an avatar at card tables.
  const HERO_SIGNATURES=Object.freeze({"fox":{"id":"fox","entry":"السدو الذهبي","trail":"رمال المجلس","victory":"تحية الملثّم","effect":"dust","color":"#e8ba67","notes":[196,247,294,392],"cashPrice":0},"cat":{"id":"cat","entry":"ظل النينجا","trail":"شفرات الظل","victory":"تحية الظل","effect":"shuriken","color":"#e66e7c","notes":[440,330,660,880],"cashPrice":499},"robot":{"id":"robot","entry":"نبض المفاعل","trail":"دوائر كهربائية","victory":"نبض الانتصار","effect":"circuit","color":"#69e7ff","notes":[220,440,554,880],"cashPrice":699},"princess":{"id":"princess","entry":"قسم الفارس","trail":"بريق الدرع","victory":"رفعة النصر","effect":"shield","color":"#b9d5ea","notes":[262,330,392,523],"cashPrice":799},"fairy":{"id":"fairy","entry":"جناح الشمس","trail":"ريش ذهبي","victory":"تحليق الصقر","effect":"feather","color":"#ffce66","notes":[392,494,587,784],"cashPrice":999},"astronaut":{"id":"astronaut","entry":"بوابة النجوم","trail":"مدارات نجمية","victory":"مدار النصر","effect":"orbit","color":"#c8dbff","notes":[196,294,440,587],"cashPrice":1199},"racer":{"id":"racer","entry":"خط الانطلاق","trail":"شرر السرعة","victory":"احتفال خط النهاية","effect":"streak","color":"#ff756d","notes":[147,220,330,440],"cashPrice":699},"diver":{"id":"diver","entry":"لؤلؤ الأعماق","trail":"فقاعات مضيئة","victory":"موجة الأعماق","effect":"bubble","color":"#79ead7","notes":[330,494,659,988],"cashPrice":699},"viking":{"id":"viking","entry":"صاعقة الشمال","trail":"شرر البرق","victory":"ضربة الاحتفال","effect":"thunder","color":"#bed9f2","notes":[110,165,220,330],"cashPrice":899},"gladiator":{"id":"gladiator","entry":"دائرة المجد","trail":"شرارات برونزية","victory":"تحية المصارع","effect":"ember","color":"#ffbc7c","notes":[196,262,392,523],"cashPrice":899},"cyber":{"id":"cyber","entry":"اختراق النيون","trail":"أطياف رقمية","victory":"موجة النصر","effect":"prism","color":"#9fe5ff","notes":[277,415,554,831],"cashPrice":1499},"samurai":{"id":"samurai","entry":"قمر الساموراي","trail":"قوس القمر","victory":"قوس الانتصار","effect":"slash","color":"#ffe1a0","notes":[294,440,587,880],"cashPrice":1799}});
  const HEROES=Object.freeze(CATALOG.filter(i=>i.type==='character').map(i=>Object.freeze({id:i.id.slice(10),item:i.id,name:i.name,art:i.asset})));
  const heroOf=value=>{const id=String(value||'').replace(/^character-/,'');return HEROES.find(h=>h.id===id)||null;};
  const heroArt=value=>{const h=heroOf(value);return h?'/assets/heroes/'+h.art+'.webp':'';};
  const heroPoster=value=>{const h=heroOf(value);return h?'/assets/characters-v33/portraits/'+h.id+'.webp?v=33.9.9-full1':'';};
  const heroFace=value=>{const h=heroOf(value);return h?'/assets/heroes/face/'+h.art+'.webp':'';};
  const BOT_HEROES=['robot','princess','samurai','viking','cyber','diver','racer','gladiator'];
  const botHeroFace=seat=>heroFace(BOT_HEROES[Math.abs(Math.floor(Number(seat)||0))%BOT_HEROES.length]);
  root.BS_CAREER_CORE=Object.freeze({HERO_SIGNATURES,HEROES,heroOf,heroArt,heroPoster,heroFace,botHeroFace,unlockJourney,CATALOG,COLLECTION,REACTIONS,REACTION_TYPES,LEGACY_REACTIONS,STOREFRONT,SLOTS,isReaction,reactionOf,BUNDLES,OBJECTIVES,COSMETIC_STYLES,normalize,reward,purchase,equip,DAILY_GIFTS,riyadhDay,riyadhWeek,dailyOffer,itemPrice,dailyStatus,claimDaily,objectives,claimObjective,GAME_MISSIONS,gameMissionsFor,grant,bundleQuote,purchaseBundle,cartQuote,purchaseCart});
})(globalThis);
