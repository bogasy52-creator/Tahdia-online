/* Shared, deterministic progression and cosmetic catalogue. */
(function(root){
  'use strict';
  const CATALOG=Object.freeze([
    {id:'pawn-classic',type:'pawn',name:'الحجر الكلاسيكي',description:'حجر عاجي بحافة ملونة.',price:0,color:'#e8e5db'},
    {id:'pawn-jade',type:'pawn',name:'حجر اليشم',description:'أخضر هادئ بلمسة حجرية.',price:120,color:'#55ba98'},
    {id:'pawn-onyx',type:'pawn',name:'حجر الأونيكس',description:'أسود مصقول بحافة ذهبية.',price:180,color:'#28313e'},
    {id:'dice-ivory',type:'dice',name:'نرد العاج',description:'نقاط واضحة وحركة قصيرة.',price:0,color:'#f6f0e4'},
    {id:'dice-midnight',type:'dice',name:'نرد منتصف الليل',description:'لون داكن ونقاط عاجية.',price:140,color:'#202c40'},
    {id:'dice-copper',type:'dice',name:'نرد النحاس',description:'نحاس مطفي ونقاط داكنة.',price:220,color:'#ce9564'},
    {id:'board-forest',type:'board',name:'لوحة الغابة',description:'ألوان خضراء وخانات واضحة.',price:0,color:'#184c3b'},
    {id:'board-ocean',type:'board',name:'لوحة المحيط',description:'درجات زرقاء هادئة.',price:160,color:'#173f61'},
    {id:'board-sand',type:'board',name:'لوحة الرمال',description:'ألوان رملية دافئة.',price:160,color:'#62492c'},
    {id:'table-walnut',type:'table',name:'طاولة الجوز',description:'خشب دافئ ومسارات عاجية.',price:0,color:'#5b3928'},
    {id:'table-slate',type:'table',name:'طاولة الأردواز',description:'سطح داكن وحواف معدنية.',price:240,color:'#344454'},
    {id:'table-emerald',type:'table',name:'طاولة الزمرد',description:'سطح أخضر بإطار جوزي.',price:260,color:'#184c3b'}
  ].map(Object.freeze));
  const finite=n=>Math.max(0,Math.min(100000000,Math.floor(Number(n)||0)));
  function normalize(raw={}){
    const free=CATALOG.filter(i=>i.price===0).map(i=>i.id);
    const owned=[...new Set([...free,...(Array.isArray(raw.owned)?raw.owned:[])])].filter(id=>CATALOG.some(i=>i.id===id));
    const equipped={pawn:'pawn-classic',dice:'dice-ivory',board:'board-forest',table:'table-walnut'};
    for(const [type,id] of Object.entries(raw.equipped||{}))if(owned.includes(id)&&CATALOG.some(i=>i.id===id&&i.type===type))equipped[type]=id;
    const xp=finite(raw.xp),rankedXP=finite(raw.rankedXP);
    return {version:6,name:String(raw.name||'لاعب العباقرة').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,24)||'لاعب العباقرة',xp,rankedXP,coins:raw.coins==null?100:finite(raw.coins),wins:finite(raw.wins),losses:finite(raw.losses),games:finite(raw.games),rankedWins:finite(raw.rankedWins),rankedLosses:finite(raw.rankedLosses),level:Math.floor(xp/1000)+1,rank:rankedXP>=20000?'Diamond':rankedXP>=8000?'Gold':rankedXP>=2500?'Silver':'Bronze',owned,equipped,receipts:Array.isArray(raw.receipts)?raw.receipts.filter(x=>typeof x==='string').slice(-300):[],practiceDay:String(raw.practiceDay||''),practiceCount:finite(raw.practiceCount)};
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
  function purchase(raw,id){const p=normalize(raw),item=CATALOG.find(i=>i.id===id);if(!item)throw new Error('item_not_found');if(!p.owned.includes(id)){if(p.coins<item.price)throw new Error('insufficient_coins');p.coins-=item.price;p.owned.push(id)}p.equipped[item.type]=id;return normalize(p)}
  function equip(raw,id){const p=normalize(raw),item=CATALOG.find(i=>i.id===id);if(!item||!p.owned.includes(id))throw new Error('item_not_owned');p.equipped[item.type]=id;return normalize(p)}
  root.BS_CAREER_CORE=Object.freeze({CATALOG,normalize,reward,purchase,equip});
})(globalThis);
