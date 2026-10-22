/* Shared, deterministic progression and cosmetic catalogue. */
(function(root){
  'use strict';
  const RETIRED=new Set(['pawn-onyx','dice-midnight','dice-copper','dice-aurora','board-ocean','board-sand','board-twilight','table-slate','table-emerald','table-midnight','title-collector','title-champion']);
  const CATALOG=Object.freeze([
    {id:'character-fox',type:'character',name:'الثعلب',description:'شخصية البداية المجانية للثعابين والسلالم.',price:0,color:'#efa866',asset:'fox'},
    {id:'character-cat',type:'character',name:'القطة الوردية',description:'قطة وردية مرسومة على قاعدة ذهبية.',price:150,color:'#ed9ec5',asset:'cat'},
    {id:'character-robot',type:'character',name:'الروبوت',description:'روبوت صغير بتفاصيل معدنية مضيئة.',price:220,color:'#8bcbd6',asset:'robot'},
    {id:'character-princess',type:'character',name:'الأميرة البنفسجية',description:'أميرة بفستان بنفسجي وتاج ذهبي.',price:300,color:'#c3a1ef',asset:'princess'},
    {id:'character-fairy',type:'character',name:'جنيّة النعناع',description:'جنيّة بأجنحة وتفاصيل خضراء ناعمة.',price:380,color:'#9ee3c0',asset:'fairy'},
    {id:'character-astronaut',type:'character',name:'رائدة الفضاء',description:'رائدة فضاء بخوذة لامعة على قاعدة ذهبية.',price:450,color:'#95c4ec',asset:'astronaut'},
    {id:'pawn-classic',type:'pawn',name:'الحجر الكلاسيكي',description:'كريستال مضيء على قاعدة معدنية.',price:0,color:'#e8e5db'},
    {id:'pawn-jade',type:'pawn',name:'حجر اليشم',description:'أخضر هادئ بلمسة حجرية.',price:120,color:'#55ba98'},
    {id:'pawn-onyx',type:'pawn',name:'حجر الأونيكس',description:'أسود مصقول بحافة ذهبية.',price:180,color:'#28313e'},
    {id:'dice-ivory',type:'dice',name:'نرد العاج',description:'نقاط واضحة وحركة قصيرة.',price:0,color:'#f6f0e4'},
    {id:'dice-midnight',type:'dice',name:'نرد منتصف الليل',description:'لون داكن ونقاط عاجية.',price:140,color:'#202c40'},
    {id:'dice-copper',type:'dice',name:'نرد النحاس',description:'نحاس مطفي ونقاط داكنة.',price:220,color:'#ce9564'},
    {id:'board-forest',type:'board',name:'حلبة النيون',description:'معدن داكن وشقوق صخرية وخانات حيّة.',price:0,color:'#184c3b'},
    {id:'board-ocean',type:'board',name:'لوحة المحيط',description:'درجات زرقاء هادئة.',price:160,color:'#173f61'},
    {id:'board-sand',type:'board',name:'لوحة الرمال',description:'ألوان رملية دافئة.',price:160,color:'#62492c'},
    {id:'table-walnut',type:'table',name:'طاولة الجوز',description:'خشب دافئ ومسارات عاجية.',price:0,color:'#5b3928'},
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
    {id:'board-royal',type:'board',name:'لوحة القصر',description:'خانات عاجية وذهبية بلوحة الثعبان.',price:550,color:'#ab8050'},
    {id:'table-midnight',type:'table',name:'طاولة منتصف الليل',description:'طاولة جاكارو داكنة بأمان واضح.',price:380,color:'#1f273d'},
    {id:'table-royal',type:'table',name:'طاولة القصر',description:'طاولة جاكارو بنفسجية بإطار ذهبي.',price:580,color:'#4a3659'},
    {id:'snake-toxic',type:'snake',name:'أفاعي الزمرد الكهربائي',description:'دروع خضراء لامعة وعيون نيون مع حركة الافتراس الكاملة.',price:420,color:'#8aef48'},
    {id:'snake-plasma',type:'snake',name:'أفاعي البلازما',description:'ألوان سماوية وبنفسجية متدرجة بين الثعابين.',price:600,color:'#ca73ff'},
    {id:'dice-nebula',type:'dice',name:'نرد السديم',description:'أوجه زرقاء معدنية ونقاط عاجية كبيرة.',price:380,color:'#245797'},
    {id:'dice-ruby',type:'dice',name:'نرد الياقوت',description:'ياقوت أحمر مصقول ونقاط مضيئة.',price:460,color:'#a32f50'},
    {id:'board-cyber',type:'board',name:'حلبة المفاعل',description:'إطار أزرق كهربائي وخانات محفورة واضحة.',price:440,color:'#32ceef'},
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
    {id:'snake-sovereign',type:'snake',name:'سيّد الحلبة',description:'خاص بالمدير: درع أوبسيديان، عيون زمردية وأثر نجمي هادئ. المظهر لا يغيّر قوة اللعب.',price:0,color:'#e7c376',source:'owner'}
  ].map(i=>Object.freeze({...i,retired:RETIRED.has(i.id),rarity:i.source?'exclusive':i.price>=450?'legendary':i.price>=140?'rare':'common'})));
  const BUNDLES=Object.freeze([
    {id:'reactor-set',name:'مجموعة المفاعل',description:'ثعابين ونرد وحلبة وأثر حركة بهوية كهربائية واحدة.',color:'#57d9ff',items:['snake-toxic','dice-nebula','board-cyber','trail-comet']},
    {id:'aurora-set',name:'مجموعة الكريستال',description:'أفعى شفقية وحجر جمشت ونرد كريستالي مع احتفال خاص.',color:'#88daca',items:['snake-aurora','pawn-amethyst','dice-crystal','victory-aurora']},
    {id:'royal-set',name:'مجموعة التتويج',description:'حجر ونرد وحلبة وطاولة ملكية مع نجوم الفوز.',color:'#f4cb79',items:['pawn-gold','dice-gold','board-royal','table-royal','victory-royal']}
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
  const GAME_IDS=['snakes','jackaroo','quiz','memory','reaction','logic','puzzle','accuracy','dice','zahra','serpent','jewels','paths','sudoku'];
  const COSMETIC_STYLES=Object.freeze({
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
  function period(raw={}){raw=raw&&typeof raw==='object'?raw:{};return {key:String(raw.key||'').slice(0,10),games:finite(raw.games),wins:finite(raw.wins),online:finite(raw.online),variety:[...new Set(Array.isArray(raw.variety)?raw.variety:[])].filter(x=>GAME_IDS.includes(x)),claimed:[...new Set(Array.isArray(raw.claimed)?raw.claimed:[])].filter(x=>OBJECTIVES.some(o=>o.id===x))}}
  function normalize(raw={}){
    raw=raw&&typeof raw==='object'?raw:{};
    const free=CATALOG.filter(i=>i.price===0&&!i.source).map(i=>i.id);
    const owned=[...new Set([...free,...(Array.isArray(raw.owned)?raw.owned:[])])].filter(id=>CATALOG.some(i=>i.id===id));
    const equipped={character:'character-fox',pawn:'pawn-classic',dice:'dice-ivory',board:'board-forest',table:'table-walnut',snake:'snake-wild',trail:'trail-none',victory:'victory-classic',title:'title-player'};
    for(const [type,id] of Object.entries(raw.equipped||{}))if(owned.includes(id)&&CATALOG.some(i=>i.id===id&&i.type===type))equipped[type]=id;
    const xp=finite(raw.xp),rankedXP=finite(raw.rankedXP);
    return {version:12,dailyDay:String(raw.dailyDay||''),dailyStreak:Math.min(7,finite(raw.dailyStreak)),name:String(raw.name||'لاعب العباقرة').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,24)||'لاعب العباقرة',xp,rankedXP,coins:raw.coins==null?100:finite(raw.coins),wins:finite(raw.wins),losses:finite(raw.losses),games:finite(raw.games),rankedWins:finite(raw.rankedWins),rankedLosses:finite(raw.rankedLosses),level:Math.floor(xp/1000)+1,rank:rankedXP>=20000?'Diamond':rankedXP>=8000?'Gold':rankedXP>=2500?'Silver':'Bronze',owned,equipped,receipts:Array.isArray(raw.receipts)?raw.receipts.filter(x=>typeof x==='string').slice(-300):[],checkouts:Array.isArray(raw.checkouts)?raw.checkouts.slice(-60).filter(row=>row&&typeof row.id==='string'&&/^[a-zA-Z0-9_-]{16,80}$/.test(row.id)&&Array.isArray(row.ids)&&row.ids.length>0&&row.ids.length<=12&&row.ids.every(id=>CATALOG.some(item=>item.id===id))&&Number.isSafeInteger(row.price)&&row.price>=0).map(row=>({id:row.id,ids:[...row.ids],price:row.price})):[],practiceDay:String(raw.practiceDay||''),practiceCount:finite(raw.practiceCount),missions:{daily:period(raw.missions?.daily),weekly:period(raw.missions?.weekly)},achievements:[...new Set(Array.isArray(raw.achievements)?raw.achievements:[])].filter(x=>OBJECTIVES.some(o=>o.id===x&&o.kind==='achievement'))};
  }
  function reward(raw,{id,game,win=false,verified=false,now=Date.now()}={}){
    const p=normalize(raw),receipt=String(id||'').slice(0,160);
    if(!receipt||!GAME_IDS.includes(game))throw new Error('invalid_result');
    if(p.receipts.includes(receipt))return p;
    const day=riyadhDay(now);
    if(!verified){if(p.practiceDay!==day){p.practiceDay=day;p.practiceCount=0}if(p.practiceCount>=20)return p;p.practiceCount++}
    const gain=verified?(win?250:80):(win?100:40);
    p.xp+=gain;p.coins+=verified?(win?50:15):(win?20:8);p.games++;p[win?'wins':'losses']++;
    if(verified){p.rankedXP+=gain;p[win?'rankedWins':'rankedLosses']++}
    for(const kind of ['daily','weekly']){const key=kind==='daily'?riyadhDay(now):riyadhWeek(now);if(p.missions[kind].key!==key)p.missions[kind]=period({key});const m=p.missions[kind];m.games++;if(win)m.wins++;if(verified)m.online++;if(!m.variety.includes(game))m.variety.push(game)}
    p.receipts.push(receipt);return normalize(p);
  }
  function purchase(raw,id,{now=Date.now(),expectedPrice}={}){const p=normalize(raw),item=CATALOG.find(i=>i.id===id);if(!item)throw new Error('item_not_found');if(!p.owned.includes(id)){if(item.source)throw new Error('item_locked');if(item.retired)throw new Error('item_retired');const price=itemPrice(id,now);if(expectedPrice!=null&&expectedPrice!==price)throw new Error('price_changed');if(p.coins<price)throw new Error('insufficient_coins');p.coins-=price;p.owned.push(id)}p.equipped[item.type]=id;return normalize(p)}
  function equip(raw,id){const p=normalize(raw),item=CATALOG.find(i=>i.id===id);if(!item||!p.owned.includes(id))throw new Error('item_not_owned');p.equipped[item.type]=id;return normalize(p)}
  const DAILY_GIFTS=Object.freeze([30,40,50,60,75,90,120]);
  function riyadhDay(now=Date.now()){return new Date(now+10800000).toISOString().slice(0,10)}
  function riyadhWeek(now=Date.now()){const date=new Date(riyadhDay(now)+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);return date.toISOString().slice(0,10)}
  function dailyOffer(now=Date.now()){
    const items=CATALOG.filter(i=>i.price>=300&&!i.source&&!i.retired),day=riyadhDay(now),index=Math.floor(Date.parse(day)/86400000)%items.length,item=items[index];
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
    return OBJECTIVES.map(o=>{const key=o.kind==='daily'?riyadhDay(now):o.kind==='weekly'?riyadhWeek(now):'lifetime',stored=p.missions[o.kind],m=stored?.key===key?stored:period(),claimed=o.kind==='achievement'?p.achievements.includes(o.id):m.claimed.includes(o.id);const current=o.kind==='achievement'?(o.metric==='collection'?p.owned.filter(id=>CATALOG.find(i=>i.id===id)?.price>0).length:p[o.metric]||0):o.metric==='variety'?m.variety.length:m[o.metric]||0;return {...o,key,current,claimed,ready:current>=o.goal&&!claimed}});
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
    const p=normalize(raw),quote=bundleQuote(p,id,{now}),bundle=BUNDLES.find(b=>b.id===id);if(expectedPrice!=null&&expectedPrice!==quote.price)throw new Error('price_changed');if(p.coins<quote.price)throw new Error('insufficient_coins');p.coins-=quote.price;p.owned.push(...quote.missing);for(const id of bundle.items){const item=CATALOG.find(i=>i.id===id);p.equipped[item.type]=id}return normalize(p);
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
    for(const item of quote.items)p.equipped[item.type]=item.id;
    p.checkouts.push({id:requestId,ids:[...ids],price:quote.price});
    return normalize(p);
  }
  function unlockJourney(raw,stars){const p=normalize(raw);for(const item of CATALOG)if(item.source==='journey'&&Number.isSafeInteger(stars)&&stars>=item.unlockStars&&!p.owned.includes(item.id))p.owned.push(item.id);return normalize(p);}
  root.BS_CAREER_CORE=Object.freeze({unlockJourney,CATALOG,BUNDLES,OBJECTIVES,COSMETIC_STYLES,normalize,reward,purchase,equip,DAILY_GIFTS,riyadhDay,riyadhWeek,dailyOffer,itemPrice,dailyStatus,claimDaily,objectives,claimObjective,bundleQuote,purchaseBundle,cartQuote,purchaseCart});
})(globalThis);
