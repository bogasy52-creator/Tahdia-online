/* Shared, deterministic progression and cosmetic catalogue. */
(function(root){
  'use strict';
  const CATALOG=Object.freeze([
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
    {id:'table-royal',type:'table',name:'طاولة القصر',description:'طاولة جاكارو بنفسجية بإطار ذهبي.',price:580,color:'#4a3659'}
  ].map(i=>Object.freeze({...i,rarity:i.price>=450?'legendary':i.price>=140?'rare':'common'})));
  const finite=n=>Math.max(0,Math.min(100000000,Math.floor(Number(n)||0)));
  function normalize(raw={}){
    const free=CATALOG.filter(i=>i.price===0).map(i=>i.id);
    const owned=[...new Set([...free,...(Array.isArray(raw.owned)?raw.owned:[])])].filter(id=>CATALOG.some(i=>i.id===id));
    const equipped={pawn:'pawn-classic',dice:'dice-ivory',board:'board-forest',table:'table-walnut',snake:'snake-wild'};
    for(const [type,id] of Object.entries(raw.equipped||{}))if(owned.includes(id)&&CATALOG.some(i=>i.id===id&&i.type===type))equipped[type]=id;
    const xp=finite(raw.xp),rankedXP=finite(raw.rankedXP);
    return {version:7,dailyDay:String(raw.dailyDay||''),dailyStreak:Math.min(7,finite(raw.dailyStreak)),name:String(raw.name||'لاعب العباقرة').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,24)||'لاعب العباقرة',xp,rankedXP,coins:raw.coins==null?100:finite(raw.coins),wins:finite(raw.wins),losses:finite(raw.losses),games:finite(raw.games),rankedWins:finite(raw.rankedWins),rankedLosses:finite(raw.rankedLosses),level:Math.floor(xp/1000)+1,rank:rankedXP>=20000?'Diamond':rankedXP>=8000?'Gold':rankedXP>=2500?'Silver':'Bronze',owned,equipped,receipts:Array.isArray(raw.receipts)?raw.receipts.filter(x=>typeof x==='string').slice(-300):[],practiceDay:String(raw.practiceDay||''),practiceCount:finite(raw.practiceCount)};
  }
  function reward(raw,{id,game,win=false,verified=false,now=Date.now()}={}){
    const p=normalize(raw),receipt=String(id||'').slice(0,160);
    if(!receipt||!['snakes','jackaroo','quiz','memory','reaction','logic','puzzle','accuracy','dice','zahra'].includes(game))throw new Error('invalid_result');
    if(p.receipts.includes(receipt))return p;
    const day=new Date(now).toISOString().slice(0,10);
    if(!verified){if(p.practiceDay!==day){p.practiceDay=day;p.practiceCount=0}if(p.practiceCount>=20)return p;p.practiceCount++}
    const gain=verified?(win?250:80):(win?100:40);
    p.xp+=gain;p.coins+=verified?(win?50:15):(win?20:8);p.games++;p[win?'wins':'losses']++;
    if(verified){p.rankedXP+=gain;p[win?'rankedWins':'rankedLosses']++}
    p.receipts.push(receipt);return normalize(p);
  }
  function purchase(raw,id,{now=Date.now()}={}){const p=normalize(raw),item=CATALOG.find(i=>i.id===id);if(!item)throw new Error('item_not_found');if(!p.owned.includes(id)){const price=itemPrice(id,now);if(p.coins<price)throw new Error('insufficient_coins');p.coins-=price;p.owned.push(id)}p.equipped[item.type]=id;return normalize(p)}
  function equip(raw,id){const p=normalize(raw),item=CATALOG.find(i=>i.id===id);if(!item||!p.owned.includes(id))throw new Error('item_not_owned');p.equipped[item.type]=id;return normalize(p)}
  const DAILY_GIFTS=Object.freeze([30,40,50,60,75,90,120]);
  function riyadhDay(now=Date.now()){return new Date(now+10800000).toISOString().slice(0,10)}
  function dailyOffer(now=Date.now()){
    const items=CATALOG.filter(i=>i.price>=300),day=riyadhDay(now),index=Math.floor(Date.parse(day)/86400000)%items.length,item=items[index];
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
  root.BS_CAREER_CORE=Object.freeze({CATALOG,normalize,reward,purchase,equip,DAILY_GIFTS,riyadhDay,dailyOffer,itemPrice,dailyStatus,claimDaily});
})(globalThis);
