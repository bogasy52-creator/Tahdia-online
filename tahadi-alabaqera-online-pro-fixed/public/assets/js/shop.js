(function(){
 'use strict';
 const api=window.BS_CAREER,core=window.BS_CAREER_CORE,$=id=>document.getElementById(id);
 const rarityNames={common:'أصلي',rare:'نادر',legendary:'أسطوري',exclusive:'حصري'};
 const typeNames={character:'شخصية',snake:'ثعبان',dice:'نرد',pawn:'حجر',board:'حلبة',table:'طاولة',trail:'أثر الحركة',victory:'احتفال',title:'لقب'};
 let filter=new URLSearchParams(location.search).get('filter')==='character'?'character':'all',view=new URLSearchParams(location.search).get('view')==='missions'?'missions':'shop',pending=false,query='',sort='featured',rarity='all',inspected=null,returnFocus=null;
 const now=()=>api.now?.()||Date.now(),catalog=()=>api.catalog||[],profile=()=>api.get();
 function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
 function message(text){$('storeMessage').textContent=text}
 function goalKey(){return 'busraj-store-goal-v11:'+(api.account?.()||'guest')}
 function goal(){try{return localStorage.getItem(goalKey())||''}catch{return ''}}
 function saveGoal(id){try{id?localStorage.setItem(goalKey(),id):localStorage.removeItem(goalKey())}catch{}}
 function price(item){return core?.itemPrice?.(item.id,now())??item.price}
 function searchable(value){return String(value).normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/\s+/g,' ').trim().toLowerCase();}
 function favoritesKey(){return 'busraj-store-favorites-v13:'+(api.account?.()||'guest');}
 function favorites(){try{const data=JSON.parse(localStorage.getItem(favoritesKey())||'[]');return new Set(Array.isArray(data)?data.filter(id=>typeof id==='string'):[]);}catch{return new Set();}}
 function toggleFavorite(item){const saved=favorites();saved.has(item.id)?saved.delete(item.id):saved.add(item.id);try{localStorage.setItem(favoritesKey(),JSON.stringify([...saved]));}catch{}renderItems(profile());message(saved.has(item.id)?'أضفت '+item.name+' إلى المفضلة':'أزلت '+item.name+' من المفضلة');}
 function style(e,id){for(const [key,value]of Object.entries(core?.COSMETIC_STYLES?.[id]||{}))e.style.setProperty(key,value)}
 function preview(item){
  const box=node('div','cosmetic-preview');box.style.setProperty('--item-color',item.color);box.dataset.previewItem=item.id;style(box,item.id);
  box.appendChild(previewImage(item));return box;
 }
 function previewImage(item){const image=node('img','item-static-image'+(item.type==='character'?' character-art':''));image.src=item.type==='character'?'assets/characters/'+item.asset+'.webp':'assets/previews/'+item.id+'.webp';image.alt=item.name;image.loading='lazy';image.decoding='async';image.width=item.type==='character'?300:840;image.height=item.type==='character'?380:504;return image;}
 async function operate(work,success){
  if(pending)return;const previousCharacter=profile().equipped.character;pending=true;message('جاري الحفظ…');render();
  try{await work();if(profile().equipped.character!==previousCharacter){try{localStorage.setItem('bs-piece-art','characters')}catch{}document.documentElement.dataset.pieceArt='characters';window.dispatchEvent(new CustomEvent('bs-piece-art-change'));}message(success);window.BS_AUDIO?.play?.('reward')}
  catch(error){if(error.message==='price_changed')try{await api.refresh?.()}catch{}const labels={price_changed:'تغيّر سعر العرض. تم تحديثه؛ راجع السعر الجديد قبل الشراء.',insufficient_coins:'رصيدك غير كافٍ. اجمع مكافآت المهمات أولًا.',item_not_owned:'هذه الإضافة غير مملوكة.',objective_incomplete:'المهمة لم تكتمل بعد.',item_locked:'هذه الإضافة تُفتح بالإنجاز.',unauthorized:'سجّل الدخول مجددًا لحفظ العملية.'};message(labels[error.message]||'لم تكتمل العملية: '+error.message)}
  finally{pending=false;render()}
 }
 function closeInspector(){$('itemDialog')?.classList.add('hidden');document.body.classList.remove('inspector-open');inspected=null;returnFocus?.focus?.();}
 function inspect(item,source){inspected=item.id;returnFocus=source||document.activeElement;renderInspector();$('itemDialog').classList.remove('hidden');document.body.classList.add('inspector-open');$('itemClose')?.focus();window.BS_AUDIO?.play?.('click');}
 function renderInspector(){
  if(!inspected)return;const item=catalog().find(i=>i.id===inspected);if(!item)return;const p=profile(),owned=p.owned.includes(item.id),equipped=p.equipped[item.type]===item.id,cost=price(item),locked=Boolean(item.source&&!owned);
  $('itemName').textContent=item.name;$('itemDescription').textContent=item.description;$('itemType').textContent=typeNames[item.type];$('itemRarity').textContent=rarityNames[item.rarity]||'أصلي';$('itemPrice').textContent=cost+' ◈';$('itemOwnership').textContent=equipped?'✓ مجهّز في ألعابك':owned?'✓ تملك هذه الإضافة':locked?'تُفتح بإنجاز':'جاهز للانضمام إلى مجموعتك';
  const art=$('itemArt');art.replaceChildren();art.style.setProperty('--item-color',item.color);const image=previewImage(item);image.loading='eager';art.appendChild(image);
  const action=$('itemAction');action.textContent=equipped?'مجهّز الآن':owned?'جهّز الإضافة':locked?'مكافأة إنجاز':p.coins<cost?'تحتاج '+(cost-p.coins)+' عملة':'شراء وتجهيز · '+cost;action.disabled=pending||equipped||locked||!owned&&p.coins<cost;
  const trial=$('itemTry');if(trial){trial.classList.toggle('hidden',item.type!=='snake'||item.source==='owner');trial.href='/serpent?preview='+encodeURIComponent(item.id);}
  action.onclick=()=>operate(()=>owned?api.equip(item.id):api.purchase(item.id),'تم تجهيز '+item.name+' — يظهر في اللعبة تلقائيًا');
  $('itemEarn').classList.toggle('hidden',owned||!locked&&p.coins>=cost);$('itemEarn').onclick=()=>{closeInspector();setView('missions');};
 }
 function setView(next){view=['shop','missions','inventory'].includes(next)?next:'shop';filter='all';render();window.BS_AUDIO?.play?.('click')}
 function renderGoal(p){
  const target=$('storeGoal');if(!target)return;const item=catalog().find(i=>i.id===goal()&&!i.source);
  target.replaceChildren();target.classList.toggle('hidden',!item);if(!item)return;
  const owned=p.owned.includes(item.id),cost=price(item),needed=Math.max(0,cost-p.coins),copy=node('div','goal-copy');copy.append(node('b',null,'هدفي: '+item.name),node('p',null,owned?'وصلت لهدفك! الإضافة صارت ضمن مقتنياتك.':needed?'باقي '+needed+' عملة وتفتحها.':'رصيدك يكفي — جاهز تفتحها؟'));
  const meter=node('div','vault-meter'),fill=node('i');fill.style.width=(owned?100:Math.min(100,p.coins/Math.max(1,cost)*100))+'%';meter.appendChild(fill);copy.appendChild(meter);target.append(copy,node('strong','goal-price',cost+' ◈'));
  const action=node('button','bs-btn',owned?'تجهيز الإضافة':needed?'اجمع مكافآت':'شراء وتجهيز');action.disabled=pending;action.onclick=()=>needed&&!owned?setView('missions'):operate(()=>owned?api.equip(item.id):api.purchase(item.id),'تم تجهيز '+item.name);target.appendChild(action);
  const clear=node('button','bs-btn','مسح الهدف');clear.disabled=pending;clear.onclick=()=>{saveGoal('');render()};target.appendChild(clear);
 }
 function renderBundles(p){
  const grid=$('bundleGrid');if(!grid)return;grid.replaceChildren();
  for(const bundle of core?.BUNDLES||[]){
   const quote=core.bundleQuote(p,bundle.id,{now:now()}),card=node('article','bundle-card');card.dataset.bundle=bundle.id;card.style.setProperty('--bundle-color',bundle.color);
   const art=node('div','bundle-art');const items=bundle.items.map(id=>catalog().find(i=>i.id===id)).filter(Boolean);
   const shown=items.filter(i=>['snake','pawn','dice'].includes(i.type)).slice(0,3);for(const item of shown)art.appendChild(preview(item));card.appendChild(art);
   card.append(node('span','bundle-tag',quote.missing.length?'وفّر '+quote.saving+' عملة':'✓ المجموعة مكتملة'),node('h3',null,bundle.name),node('p',null,bundle.description));
   const tags=node('div','bundle-tags');for(const item of items)tags.appendChild(node('span',null,typeNames[item.type]));card.appendChild(tags);
   const footer=node('div','bundle-footer');footer.append(node('b',null,quote.price+' ◈'),node('small',null,quote.missing.length?quote.missing.length+' قطع ناقصة':'كل القطع مملوكة'));card.appendChild(footer);
   const buy=node('button','bs-btn primary bundle-buy',quote.missing.length?(p.coins<quote.price?'تحتاج '+(quote.price-p.coins)+' عملة':'شراء وتجهيز المجموعة'):'تجهيز المجموعة');buy.disabled=pending||p.coins<quote.price;
   buy.onclick=()=>operate(()=>api.bundle(bundle.id),'تم تجهيز '+bundle.name+' — كل القطع جاهزة في ألعابها');card.appendChild(buy);
   if(quote.price>p.coins){const earn=node('button','bs-btn','ابدأ تجمع لها ←');earn.disabled=pending;earn.onclick=()=>setView('missions');card.appendChild(earn)}
   grid.appendChild(card);
  }
 }
 function renderMissions(p){
  for(const id of ['dailyMissions','weeklyMissions','achievementMissions'])$(id)?.replaceChildren();
  const rows=core?.objectives?.(p,{now:now()})||[],ready=rows.filter(o=>o.ready);if($('readyRewards'))$('readyRewards').textContent=ready.length;
  const daily=core?.dailyStatus?.(p,{now:now()});if($('earningSummary'))$('earningSummary').textContent=ready.length?ready.length+' مكافآت جاهزة · '+ready.reduce((n,o)=>n+o.coins,0)+' عملة':daily&&!daily.claimed?'هديتك اليوم '+daily.coins+' عملة + مهمات جديدة':'أكمل مهماتك وافتح كنزك التالي';
  if($('missionReset'))$('missionReset').textContent='التجديد عند منتصف الليل بتوقيت الرياض · الأسبوع يبدأ الاثنين';
  for(const o of rows){
   const target=$(o.kind==='daily'?'dailyMissions':o.kind==='weekly'?'weeklyMissions':'achievementMissions');if(!target)continue;
   const card=node('article','mission-card'+(o.ready?' ready':'')+(o.claimed?' claimed':''));card.dataset.objective=o.id;card.append(node('h4',null,o.name),node('p',null,o.description));
   const reward=node('div','mission-reward',o.coins+' ◈');if(o.item)reward.appendChild(node('small',null,'+ لقب حصري'));card.appendChild(reward);
   const meter=node('div','vault-meter'),fill=node('i');fill.style.width=Math.min(100,o.current/o.goal*100)+'%';meter.appendChild(fill);card.append(meter,node('span','mission-count',Math.min(o.current,o.goal)+' / '+o.goal));
   const button=node('button','bs-btn'+(o.ready?' primary':''),o.claimed?'✓ تم الاستلام':o.ready?'استلم '+o.coins+' عملة':'أكمل المهمة');button.disabled=pending||!o.ready;
   button.onclick=()=>operate(()=>api.claim(o.id),'وصلت مكافأة '+o.name+' إلى رصيدك'+(o.item?' وفتحت اللقب الحصري':''));card.appendChild(button);target.appendChild(card);
  }
 }
 function renderItems(p){
  const grid=$('storeGrid'),owner=api.access?.().role==='owner',saved=favorites(),terms=searchable(query).split(' ').filter(Boolean);grid.replaceChildren();
  const list=catalog().filter(item=>(item.source!=='owner'||owner)&&(view!=='inventory'||p.owned.includes(item.id))&&(filter==='all'||filter==='favorites'&&saved.has(item.id)||filter==='owned'&&p.owned.includes(item.id)||item.type===filter)&&(rarity==='all'||(item.rarity||'common')===rarity)&&terms.every(term=>searchable(item.name+' '+item.description+' '+typeNames[item.type]).includes(term)));
  list.sort((a,b)=>sort==='price-low'?price(a)-price(b):sort==='price-high'?price(b)-price(a):sort==='owned'?Number(p.owned.includes(b.id))-Number(p.owned.includes(a.id)):Number(b.price>=450)-Number(a.price>=450));
  for(const item of list){
   const owned=p.owned.includes(item.id),equipped=p.equipped[item.type]===item.id,cost=price(item),sale=cost<item.price,locked=Boolean(item.source&&!owned);
   const card=node('article','store-card');card.dataset.rarity=item.rarity||'common';card.dataset.item=item.id;card.dataset.equipped=equipped;card.appendChild(preview(item));card.appendChild(node('span','rarity '+item.rarity,rarityNames[item.rarity]||'أصلي'));
   const favorite=node('button','item-favorite',saved.has(item.id)?'★':'☆');favorite.type='button';favorite.setAttribute('aria-label',(saved.has(item.id)?'إزالة من المفضلة: ':'إضافة للمفضلة: ')+item.name);favorite.setAttribute('aria-pressed',String(saved.has(item.id)));favorite.onclick=()=>toggleFavorite(item);card.appendChild(favorite);
   if(sale&&!owned)card.appendChild(node('span','offer-tag','−20%'));card.append(node('h2',null,item.name),node('p',null,item.description));
   const label=node('span','owned-label store-price'+(owned?' is-owned':''),equipped?'✓ مُجهّز الآن':owned?'ضمن مقتنياتك':locked?'مكافأة إنجاز':cost+' ◈');if(sale&&!owned)label.appendChild(node('del',null,item.price));card.appendChild(label);
   const button=node('button','bs-btn'+(equipped?'':' primary'),equipped?'مُجهّز':owned?'تجهيز':locked?'تُفتح بإنجاز 50 جولة':p.coins<cost?'تحتاج '+(cost-p.coins)+' عملة إضافية':'شراء وتجهيز · '+cost);button.disabled=pending||equipped||locked||!owned&&p.coins<cost;
   button.onclick=()=>operate(()=>owned?api.equip(item.id):api.purchase(item.id),'تم تجهيز '+item.name+' — يظهر في اللعبة تلقائيًا');card.appendChild(button);
   const inspectButton=node('button','bs-btn item-inspect','استعرض الإضافة ↗');inspectButton.onclick=()=>inspect(item,inspectButton);card.appendChild(inspectButton);const art=card.querySelector('.cosmetic-preview');art.onclick=()=>inspect(item,inspectButton);art.tabIndex=0;art.setAttribute('role','button');art.setAttribute('aria-label','معاينة '+item.name);art.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect(item,art);}};
   if(!owned){const aim=node('button','bs-btn goal-button'+(goal()===item.id?' selected':''),locked?'شاهد الإنجاز ←':goal()===item.id?'✓ هدفك الحالي':'اجعله هدفي');aim.disabled=pending;aim.onclick=()=>locked?setView('missions'):(saveGoal(item.id),render());card.appendChild(aim)}
   grid.appendChild(card);
  }
  $('storeEmpty')?.classList.toggle('hidden',list.length>0);
  if($('storeResults'))$('storeResults').textContent=list.length+' إضافة'+(filter==='favorites'?' في مفضلتك':'');
 }
 function renderLoadout(p){const target=$('storeLoadout');if(!target)return;target.replaceChildren();for(const type of ['snake','character','board']){const item=catalog().find(i=>i.id===p.equipped[type]);if(!item)continue;const button=node('button','loadout-item');button.type='button';const image=previewImage(item),copy=node('span');image.loading='eager';copy.append(node('small',null,({snake:'ثعبانك الحالي',pawn:'حجرك الحالي',character:'شخصيتك الحالية',board:'حلبتك الحالية'})[type]),node('b',null,item.name));button.append(image,copy,node('span','loadout-arrow','←'));button.onclick=()=>{query='';rarity='all';if($('storeSearch'))$('storeSearch').value='';if($('storeRarity'))$('storeRarity').value='all';setView('inventory');filter=type;render();$('storeTabs')?.scrollIntoView?.({behavior:'smooth',block:'start'});};target.appendChild(button);}}
 function render(){
  const p=profile();if(!Array.isArray(p.owned))return;const offer=core?.dailyOffer?.(now());
  if($('offerName')&&offer)$('offerName').textContent=catalog().find(i=>i.id===offer.id)?.name||'';
  const available=catalog().filter(i=>i.source!=='owner'||api.access?.().role==='owner'),owned=available.filter(i=>p.owned.includes(i.id)).length;
  if($('collectionCount'))$('collectionCount').textContent=owned+' / '+available.length+' إضافة';
  if($('collectionProgress'))$('collectionProgress').style.width=owned/Math.max(1,available.length)*100+'%';
  if($('collectionNext'))$('collectionNext').textContent=owned===available.length?'خزانتك مكتملة — جرّب أسلوبًا جديدًا':'كل إضافة تملكها تقرّبك من إنجاز خزانة الكنوز';
  $('missionsView')?.classList.toggle('hidden',view!=='missions');$('shopView')?.classList.toggle('hidden',view==='missions');$('bundlesSection')?.classList.toggle('hidden',view==='inventory');
  if($('catalogueTitle'))$('catalogueTitle').textContent=view==='inventory'?'مقتنياتك — جهّز أسلوبك':'إضافات الحلبة';
  $('storeViews')?.querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',b.dataset.view===view?'true':'false')});
  $('storeTabs').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.filter===filter);b.setAttribute('aria-pressed',b.dataset.filter===filter?'true':'false')});
  renderGoal(p);renderBundles(p);renderMissions(p);renderItems(p);renderInspector();renderLoadout(p);
 }
 $('storeTabs').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;filter=b.dataset.filter;render()});
 $('storeViews')?.addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)setView(b.dataset.view)});
 if($('earnCoins'))$('earnCoins').onclick=()=>setView('missions');
 $('storeSearch')?.addEventListener('input',e=>{query=e.target.value.trim();renderItems(profile())});
 $('storeSort')?.addEventListener('change',e=>{sort=e.target.value;renderItems(profile())});
 $('storeRarity')?.addEventListener('change',e=>{rarity=e.target.value;renderItems(profile())});
 if($('itemClose'))$('itemClose').onclick=closeInspector;
 $('itemDialog')?.addEventListener('cancel',e=>{e.preventDefault();closeInspector();});
 $('itemDialog')?.addEventListener('click',e=>{if(e.target===$('itemDialog'))closeInspector();});
 document.addEventListener('keydown',e=>{if(!inspected)return;if(e.key==='Escape'){e.preventDefault();closeInspector();}else if(e.key==='Tab'){const buttons=[...$('itemDialog').querySelectorAll('button, a[href]')].filter(b=>!b.disabled&&!b.classList.contains('hidden')),first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
 const featured=catalog().find(i=>i.id==='snake-plasma');if(featured&&$('vaultFeatureArt'))$('vaultFeatureArt').appendChild(previewImage(featured));
 if($('featureInspect')&&featured)$('featureInspect').onclick=()=>inspect(featured,$('featureInspect'));
 window.addEventListener('bs-career-change',render);window.addEventListener('bs-arena-ready',render);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});setInterval(()=>render(),60000);render();
})();
