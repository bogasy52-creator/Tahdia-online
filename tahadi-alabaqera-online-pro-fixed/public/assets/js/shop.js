(function(){
 'use strict';
 const api=window.BS_CAREER,core=window.BS_CAREER_CORE,$=id=>document.getElementById(id);
 const rarityNames={common:'أصلي',rare:'نادر',legendary:'أسطوري',exclusive:'حصري'};
 const typeNames={snake:'ثعبان',dice:'نرد',pawn:'حجر',board:'حلبة',table:'طاولة',trail:'أثر الحركة',victory:'احتفال',title:'لقب'};
 let filter='all',view=new URLSearchParams(location.search).get('view')==='missions'?'missions':'shop',pending=false,query='',sort='featured',inspected=null,returnFocus=null;
 const now=()=>api.now?.()||Date.now(),catalog=()=>api.catalog||[],profile=()=>api.get();
 function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
 function message(text){$('storeMessage').textContent=text}
 function goalKey(){return 'busraj-store-goal-v11:'+(api.account?.()||'guest')}
 function goal(){try{return localStorage.getItem(goalKey())||''}catch{return ''}}
 function saveGoal(id){try{id?localStorage.setItem(goalKey(),id):localStorage.removeItem(goalKey())}catch{}}
 function price(item){return core?.itemPrice?.(item.id,now())??item.price}
 function style(e,id){for(const [key,value]of Object.entries(core?.COSMETIC_STYLES?.[id]||{}))e.style.setProperty(key,value)}
 function preview(item){
  const box=node('div','cosmetic-preview');box.style.setProperty('--item-color',item.color);box.setAttribute('aria-hidden','true');box.dataset.previewItem=item.id;style(box,item.id);
  if(window.BS_COSMETIC_ART){window.BS_COSMETIC_ART.mount(box,item);return box;}
  const asset=node('div','preview-'+item.type);
  if(item.type==='snake'&&window.BS_ARENA?.portrait)window.BS_ARENA.portrait(asset,item.id);
  else if(['snake','board','table'].includes(item.type)){
   const img=node('img');img.alt='';img.loading='lazy';img.src='assets/arena/'+(item.type==='snake'?'neon-cobra.webp':item.type==='board'?'arena-plate.webp':'jackaroo-table.webp');
   img.style.filter=core?.COSMETIC_STYLES?.[item.id]?.[item.type==='board'?'--arena-board-filter':'--table-look']||'none';asset.appendChild(img);
  }else if(item.type==='pawn'){
   if(window.BS_ARENA?.crystal){const c=window.BS_ARENA.crystal(asset,{'pawn-amethyst':1,'pawn-gold':2,'pawn-jade':3}[item.id]||0);c.style.filter=core?.COSMETIC_STYLES?.[item.id]?.['--pawn-look']||'none'}
   else{const crystal=node('b','preview-crystal','◈');crystal.style.color=item.color;asset.appendChild(crystal)}
  }else if(item.type==='dice'){const die=node('div','die');die.dataset.value='5';style(die,item.id);asset.appendChild(die);window.BS_DICE?.mount?.(die)}
  else if(item.type==='trail'){asset.append(node('i'),node('b'))}
  else if(item.type==='victory')asset.textContent=item.id==='victory-royal'?'✦ ✧ ✦':item.id==='victory-aurora'?'✧ ✦ ✧':'✦';
  else if(item.type==='title')asset.textContent=item.name;
  box.appendChild(asset);return box;
 }
 async function operate(work,success){
  if(pending)return;pending=true;message('جاري الحفظ…');render();
  try{await work();message(success);window.BS_AUDIO?.play?.('reward')}
  catch(error){if(error.message==='price_changed')try{await api.refresh?.()}catch{}const labels={price_changed:'تغيّر سعر العرض. تم تحديثه؛ راجع السعر الجديد قبل الشراء.',insufficient_coins:'رصيدك غير كافٍ. اجمع مكافآت المهمات أولًا.',item_not_owned:'هذه الإضافة غير مملوكة.',objective_incomplete:'المهمة لم تكتمل بعد.',item_locked:'هذه الإضافة تُفتح بالإنجاز.',unauthorized:'سجّل الدخول مجددًا لحفظ العملية.'};message(labels[error.message]||'لم تكتمل العملية: '+error.message)}
  finally{pending=false;render()}
 }
 function closeInspector(){const dialog=$('itemDialog');dialog?.close?.();dialog?.classList.add('hidden');inspected=null;returnFocus?.focus?.();}
 function inspect(item,source){inspected=item.id;returnFocus=source||document.activeElement;renderInspector();const dialog=$('itemDialog');dialog.classList.remove('hidden');if(dialog.showModal&&!dialog.open)dialog.showModal();$('itemClose')?.focus();window.BS_AUDIO?.play?.('click');}
 function renderInspector(){
  if(!inspected)return;const item=catalog().find(i=>i.id===inspected);if(!item)return;const p=profile(),owned=p.owned.includes(item.id),equipped=p.equipped[item.type]===item.id,cost=price(item),locked=Boolean(item.source&&!owned);
  $('itemName').textContent=item.name;$('itemDescription').textContent=item.description;$('itemType').textContent=typeNames[item.type];$('itemRarity').textContent=rarityNames[item.rarity]||'أصلي';$('itemPrice').textContent=cost+' ◈';$('itemOwnership').textContent=equipped?'✓ مجهّز في ألعابك':owned?'✓ تملك هذه الإضافة':locked?'تُفتح بإنجاز':'جاهز للانضمام إلى مجموعتك';
  const art=$('itemArt');art.replaceChildren();art.style.setProperty('--item-color',item.color);if(window.BS_COSMETIC_ART)window.BS_COSMETIC_ART.mount(art,item,{live:true});else art.appendChild(preview(item));
  const action=$('itemAction');action.textContent=equipped?'مجهّز الآن':owned?'جهّز الإضافة':locked?'مكافأة إنجاز':p.coins<cost?'تحتاج '+(cost-p.coins)+' عملة':'شراء وتجهيز · '+cost;action.disabled=pending||equipped||locked||!owned&&p.coins<cost;
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
  const grid=$('storeGrid'),owner=api.access?.().role==='owner';grid.replaceChildren();
  const list=catalog().filter(item=>(item.source!=='owner'||owner)&&(view!=='inventory'||p.owned.includes(item.id))&&(filter==='all'||filter==='owned'&&p.owned.includes(item.id)||item.type===filter)&&(!query||(item.name+' '+item.description).includes(query)));
  list.sort((a,b)=>sort==='price-low'?price(a)-price(b):sort==='price-high'?price(b)-price(a):sort==='owned'?Number(p.owned.includes(b.id))-Number(p.owned.includes(a.id)):Number(b.price>=450)-Number(a.price>=450));
  for(const item of list){
   const owned=p.owned.includes(item.id),equipped=p.equipped[item.type]===item.id,cost=price(item),sale=cost<item.price,locked=Boolean(item.source&&!owned);
   const card=node('article','store-card');card.dataset.rarity=item.rarity||'common';card.dataset.item=item.id;card.dataset.equipped=equipped;card.appendChild(preview(item));card.appendChild(node('span','rarity '+item.rarity,rarityNames[item.rarity]||'أصلي'));
   if(sale&&!owned)card.appendChild(node('span','offer-tag','−20%'));card.append(node('h2',null,item.name),node('p',null,item.description));
   const label=node('span','owned-label store-price'+(owned?' is-owned':''),equipped?'✓ مُجهّز الآن':owned?'ضمن مقتنياتك':locked?'مكافأة إنجاز':cost+' ◈');if(sale&&!owned)label.appendChild(node('del',null,item.price));card.appendChild(label);
   const button=node('button','bs-btn'+(equipped?'':' primary'),equipped?'مُجهّز':owned?'تجهيز':locked?'تُفتح بإنجاز 50 جولة':p.coins<cost?'تحتاج '+(cost-p.coins)+' عملة إضافية':'شراء وتجهيز · '+cost);button.disabled=pending||equipped||locked||!owned&&p.coins<cost;
   button.onclick=()=>operate(()=>owned?api.equip(item.id):api.purchase(item.id),'تم تجهيز '+item.name+' — يظهر في اللعبة تلقائيًا');card.appendChild(button);
   const inspectButton=node('button','bs-btn item-inspect','استعرض الإضافة ↗');inspectButton.onclick=()=>inspect(item,inspectButton);card.appendChild(inspectButton);card.querySelector('.cosmetic-preview').onclick=()=>inspect(item,inspectButton);
   if(!owned){const aim=node('button','bs-btn goal-button'+(goal()===item.id?' selected':''),locked?'شاهد الإنجاز ←':goal()===item.id?'✓ هدفك الحالي':'اجعله هدفي');aim.disabled=pending;aim.onclick=()=>locked?setView('missions'):(saveGoal(item.id),render());card.appendChild(aim)}
   grid.appendChild(card);
  }
  $('storeEmpty')?.classList.toggle('hidden',list.length>0);
 }
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
  renderGoal(p);renderBundles(p);renderMissions(p);renderItems(p);renderInspector();
 }
 $('storeTabs').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;filter=b.dataset.filter;render()});
 $('storeViews')?.addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)setView(b.dataset.view)});
 if($('earnCoins'))$('earnCoins').onclick=()=>setView('missions');
 $('storeSearch')?.addEventListener('input',e=>{query=e.target.value.trim();renderItems(profile())});
 $('storeSort')?.addEventListener('change',e=>{sort=e.target.value;renderItems(profile())});
 if($('itemClose'))$('itemClose').onclick=closeInspector;
 $('itemDialog')?.addEventListener('cancel',e=>{e.preventDefault();closeInspector();});
 $('itemDialog')?.addEventListener('click',e=>{if(e.target===$('itemDialog'))closeInspector();});
 const featured=catalog().find(i=>i.id==='snake-plasma');if(featured&&$('vaultFeatureArt')&&window.BS_COSMETIC_ART)window.BS_COSMETIC_ART.mount($('vaultFeatureArt'),featured,{live:true});
 if($('featureInspect')&&featured)$('featureInspect').onclick=()=>inspect(featured,$('featureInspect'));
 window.addEventListener('bs-career-change',render);window.addEventListener('bs-arena-ready',render);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});setInterval(()=>render(),60000);render();
})();
