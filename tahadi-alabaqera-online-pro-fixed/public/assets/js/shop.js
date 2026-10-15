(function(){
 'use strict';
 const api=window.BS_CAREER,core=window.BS_CAREER_CORE,$=id=>document.getElementById(id);
 const rarityNames={common:'أصلي',rare:'نادر',legendary:'أسطوري',exclusive:'حصري'};
 const typeNames={character:'شخصية',snake:'ثعبان',dice:'نرد',pawn:'حجر',board:'حلبة',table:'طاولة',trail:'أثر الحركة',victory:'احتفال',title:'لقب'};
 const params=new URLSearchParams(location.search),types=Object.keys(typeNames),filters=['all',...types,'favorites','owned'];
 let filter=filters.includes(params.get('filter'))?params.get('filter'):'all',view=['shop','missions','inventory'].includes(params.get('view'))?params.get('view'):'shop',pending=false,query='',sort='featured',rarity='all',inspected=null,returnFocus=null,focusMark=null,lastAccount=api.account?.();
 const now=()=>api.now?.()||Date.now(),catalog=()=>api.catalog||[],profile=()=>api.get();
 function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
 function message(text,tone='info'){$('storeMessage').textContent=text;$('storeMessage').dataset.tone=tone;if($('cartError'))$('cartError').textContent=cartShown&&tone==='error'?text:'';}
 function goalKey(){return 'busraj-store-goal-v11:'+(api.account?.()||'guest')}
 function goal(){try{return localStorage.getItem(goalKey())||''}catch{return ''}}
 function saveGoal(id){try{id?localStorage.setItem(goalKey(),id):localStorage.removeItem(goalKey())}catch{}}
 function price(item){return core?.itemPrice?.(item.id,now())??item.price}
 function searchable(value){return String(value).normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/\s+/g,' ').trim().toLowerCase();}
 function favoritesKey(){return 'busraj-store-favorites-v13:'+(api.account?.()||'guest');}
 function favorites(){try{const data=JSON.parse(localStorage.getItem(favoritesKey())||'[]');return new Set(Array.isArray(data)?data.filter(id=>typeof id==='string'):[]);}catch{return new Set();}}
 function toggleFavorite(item){const saved=favorites();saved.has(item.id)?saved.delete(item.id):saved.add(item.id);try{localStorage.setItem(favoritesKey(),JSON.stringify([...saved]));}catch{}renderItems(profile());message(saved.has(item.id)?'أضفت '+item.name+' إلى المفضلة':'أزلت '+item.name+' من المفضلة');}
 function cartKey(){return 'tahdia-cart-v15:'+(api.account?.()||'guest');}
 function newCheckout(){return window.BS_UUID?.()||crypto.randomUUID();}
 function loadCart(){try{const stored=JSON.parse(localStorage.getItem(cartKey())||'null');return {ids:Array.isArray(stored?.ids)?[...new Set(stored.ids)].filter(id=>catalog().some(item=>item.id===id&&!item.source)).slice(0,12):[],requestId:typeof stored?.requestId==='string'&&/^[a-zA-Z0-9_-]{16,80}$/.test(stored.requestId)?stored.requestId:newCheckout()};}catch{return {ids:[],requestId:newCheckout()};}}
 let basket=loadCart(),cartShown=false,cartReturnFocus=null;
 function saveCart(){try{localStorage.setItem(cartKey(),JSON.stringify(basket))}catch{}}
 function toggleCart(item){if(pending)return;if(basket.ids.includes(item.id))basket.ids=basket.ids.filter(id=>id!==item.id);else{if(basket.ids.length>=12){message('سلتك تستوعب 12 إضافة في العملية الواحدة.');return}basket.ids.push(item.id);}basket.requestId=newCheckout();saveCart();render();message(basket.ids.includes(item.id)?'أضفت '+item.name+' إلى السلة. راجع إجمالي اختياراتك قبل التأكيد.':'أزلت '+item.name+' من السلة.');}
 function closeCart(){if(!cartShown)return;cartShown=false;$('cartDialog')?.classList.add('hidden');document.body.classList.remove('cart-open');modalBackground(Boolean(inspected));if(!inspected)cartReturnFocus?.focus?.();}
 function openCart(){if(inspected)closeInspector();cartReturnFocus=document.activeElement;cartShown=true;renderCart(profile());$('cartDialog')?.classList.remove('hidden');document.body.classList.add('cart-open');modalBackground(true);$('cartDialog').inert=false;$('cartClose')?.focus();}
 function renderCart(p){
  if(!$('cartItems'))return;$('cartItems').replaceChildren();$('cartCount').textContent=basket.ids.length;$('cartEmpty').classList.toggle('hidden',basket.ids.length>0);
  const quote=basket.ids.length?core.cartQuote(p,basket.ids,{now:now()}):{items:[],price:0,missing:[]};
  for(const selected of quote.items){const item=catalog().find(item=>item.id===selected.id),row=node('article','cart-row-v15'),info=node('div');row.appendChild(previewImage(item));const title=node('button','cart-item-name-v15',item.name);title.type='button';title.onclick=()=>{closeCart();inspect(item,$('cartOpen'));};info.append(title,node('small',null,typeNames[item.type]+' · '+(selected.owned?'مملوك':selected.price+' ◈')));row.append(info);const remove=node('button','cart-remove-v15','×');remove.type='button';remove.disabled=pending;remove.setAttribute('aria-label','أزل '+item.name+' من السلة');remove.onclick=()=>{const hadFocus=document.activeElement===remove;toggleCart(item);if(hadFocus)($('cartItems').querySelector('.cart-remove-v15')||$('cartClose'))?.focus();};row.appendChild(remove);$('cartItems').appendChild(row);}
  $('cartTotal').textContent=quote.price;$('cartCheckout').disabled=pending||!basket.ids.length||p.coins<quote.price;$('cartClear').disabled=pending||!basket.ids.length;
  $('cartCheckout').textContent=pending?'جاري إتمام الشراء…':'تأكيد الشراء والتجهيز · '+quote.price+' ◈';$('cartNote').textContent=!basket.ids.length?'':p.coins<quote.price?'تحتاج '+(quote.price-p.coins)+' عملة إضافية لإكمال اختياراتك.':'تُشترى الإضافات كلها معًا. راجع الاختيارات والإجمالي قبل التأكيد.';
  $('cartEarn').classList.toggle('hidden',p.coins>=quote.price);$('cartEarn').onclick=()=>{closeCart();setView('missions');};
  $('cartCheckout').onclick=()=>{const ids=[...basket.ids],requestId=basket.requestId,expectedPrice=quote.price;return operate(async()=>{if(!api.cart)throw new Error('cart_server_update');await api.cart(ids,{expectedPrice,requestId});basket={ids:[],requestId:newCheckout()};saveCart();renderCart(profile());closeCart();},'اشتريت '+ids.length+' إضافة وتم تجهيز اختياراتك في ألعابها.');};
 }
 function style(e,id){for(const [key,value]of Object.entries(core?.COSMETIC_STYLES?.[id]||{}))e.style.setProperty(key,value)}
 function preview(item){
  const box=node('div','cosmetic-preview');box.style.setProperty('--item-color',item.color);box.dataset.previewItem=item.id;style(box,item.id);
  if(window.BS_COSMETIC_ART&&item.type!=='character')window.BS_COSMETIC_ART.mount(box,item,{width:420});else box.appendChild(previewImage(item));return box;
 }
 function previewImage(item){const image=node('img','item-static-image'+(item.type==='character'?' character-art':''));image.src=item.type==='character'?'assets/characters/'+item.asset+'.webp':'assets/previews/'+item.id+'.webp';image.alt=item.name;image.loading='lazy';image.decoding='async';image.width=item.type==='character'?300:840;image.height=item.type==='character'?380:504;return image;}
 function session(){try{return localStorage.getItem('bs_social_session')||''}catch{return ''}}
 function bookmark(element){const card=element?.closest?.('[data-item]');return card?{item:card.dataset.item,control:element.dataset?.control||'inspect'}:null;}
 function restoreFocus(element,mark){const candidate=element?.isConnected?element:mark?$('storeGrid').querySelector('[data-item="'+mark.item+'"] [data-control="'+mark.control+'"]'):null;(candidate||$('storeSearch')||$('storeTabs').querySelector('.active'))?.focus?.();}
 function modalBackground(active){document.querySelectorAll('main.bs-shell,.mobile-dock').forEach(element=>{element.inert=active;});if($('cartDialog'))$('cartDialog').inert=active&&Boolean(inspected);}
 async function operate(work,success){
  if(pending)return;const previousCharacter=profile().equipped.character,account=api.account?.(),currentSession=session();pending=true;message('جاري الحفظ…');$('storeViews')?.setAttribute('aria-busy','true');render();
  try{await work();if(account!==api.account?.()||currentSession!==session())throw new Error('account_changed');if(profile().equipped.character!==previousCharacter){try{localStorage.setItem('bs-piece-art','characters')}catch{}document.documentElement.dataset.pieceArt='characters';window.dispatchEvent(new CustomEvent('bs-piece-art-change'));}message(success,'success');window.BS_AUDIO?.play?.('reward')}
  catch(error){if(error.message==='price_changed')try{await api.refresh?.()}catch{}const labels={checkout_conflict:'تغيّرت اختيارات السلة أثناء المحاولة. أعد فتح السلة وراجعها قبل التأكيد.',cart_server_update:'ارفع ملفات السيرفر والواجهة من الباتش معًا لتفعيل شراء السلة.',invalid_cart:'سلة الاختيارات غير صالحة. راجع الإضافات وأعد المحاولة.',account_changed:'تغيّر الحساب أثناء العملية. راجع مقتنيات الحساب الحالي قبل المحاولة.',price_changed:'تغيّر سعر العرض. تم تحديثه؛ راجع السعر الجديد قبل الشراء.',insufficient_coins:'رصيدك غير كافٍ. اجمع مكافآت المهمات أولًا.',item_not_owned:'هذه الإضافة غير مملوكة.',objective_incomplete:'المهمة لم تكتمل بعد.',item_locked:'هذه الإضافة تُفتح بالإنجاز.',unauthorized:'سجّل الدخول مجددًا لحفظ العملية.',QuotaExceededError:'مساحة التخزين ممتلئة. حرّر مساحة ثم أعد المحاولة.'};message(labels[error.message]||labels[error.name]||'لم تكتمل العملية: '+error.message,'error')}
  finally{pending=false;$('storeViews')?.setAttribute('aria-busy','false');render()}
 }
 function closeInspector(){$('itemDialog')?.classList.add('hidden');document.body.classList.remove('inspector-open');inspected=null;modalBackground(false);restoreFocus(returnFocus,focusMark);returnFocus=null;focusMark=null;}
 function inspect(item,source){if(cartShown)closeCart();inspected=item.id;returnFocus=source||document.activeElement;focusMark=bookmark(returnFocus);renderInspector();$('itemDialog').classList.remove('hidden');document.body.classList.add('inspector-open');modalBackground(true);$('itemClose')?.focus();window.BS_AUDIO?.play?.('click');}
 function renderInspector(){
  if(!inspected)return;const item=catalog().find(i=>i.id===inspected);if(!item)return;const p=profile(),owned=p.owned.includes(item.id),equipped=p.equipped[item.type]===item.id,cost=price(item),locked=Boolean(item.source&&!owned);
  $('itemName').textContent=item.name;$('itemDescription').textContent=item.description;$('itemType').textContent=typeNames[item.type];$('itemRarity').textContent=rarityNames[item.rarity]||'أصلي';$('itemPrice').textContent=cost+' ◈';$('itemOwnership').textContent=equipped?'✓ مجهّز في ألعابك':owned?'✓ تملك هذه الإضافة':locked?'تُفتح بإنجاز':'جاهز للانضمام إلى مجموعتك';
  const art=$('itemArt');art.replaceChildren();art.style.setProperty('--item-color',item.color);const viewport=node('div','studio-viewport-v16');art.appendChild(viewport);if(window.BS_COSMETIC_ART&&item.type!=='character'){const canvas=window.BS_COSMETIC_ART.mount(viewport,item,{live:true,width:840}),controls=node('div','studio-controls-v16');let turn=0,zoom=1;for(const [label,title,act]of [['↶','تدوير لليسار',()=>turn-=15],['↷','تدوير لليمين',()=>turn+=15],['−','تصغير',()=>zoom=Math.max(.6,zoom-.15)],['+','تكبير',()=>zoom=Math.min(1.6,zoom+.15)],['↺','إعادة المعاينة',()=>{turn=0;zoom=1;}]]){const button=node('button',null,label);button.type='button';button.setAttribute('aria-label',title);button.onclick=()=>{act();canvas.style.transform='rotate('+turn+'deg) scale('+zoom+')';};controls.appendChild(button);}art.appendChild(controls);}else{const image=previewImage(item);image.loading='eager';viewport.appendChild(image);}
  const action=$('itemAction');action.textContent=equipped?'مجهّز الآن':owned?'جهّز الإضافة':locked?'مكافأة إنجاز':p.coins<cost?'تحتاج '+(cost-p.coins)+' عملة':'شراء وتجهيز · '+cost;action.disabled=pending||equipped||locked||!owned&&p.coins<cost;
  const trial=$('itemTry');if(trial){trial.classList.toggle('hidden',item.type!=='snake'||item.source==='owner');trial.href='/serpent?preview='+encodeURIComponent(item.id);}
  action.onclick=()=>operate(()=>owned?api.equip(item.id):api.purchase(item.id,{expectedPrice:cost}),'تم تجهيز '+item.name+' — يظهر في اللعبة تلقائيًا');
  const target=$('itemGoal');if(target){target.classList.toggle('hidden',owned||locked);target.textContent=goal()===item.id?'✓ هدفك الحالي':'اجعله هدفي واجمع له';target.onclick=()=>{saveGoal(item.id);closeInspector();setView('missions');};}
  $('itemEarn').classList.toggle('hidden',owned||!locked&&p.coins>=cost);$('itemEarn').onclick=()=>{closeInspector();setView('missions');};
 }
 function resetFilters(){query='';rarity='all';sort='featured';filter='all';if($('storeSearch'))$('storeSearch').value='';if($('storeRarity'))$('storeRarity').value='all';if($('storeSort'))$('storeSort').value='featured';}
 function syncURL(){try{const url=new URL(location.href);url.searchParams.set('view',view);filter==='all'?url.searchParams.delete('filter'):url.searchParams.set('filter',filter);history.replaceState(null,'',url.pathname+url.search)}catch{}}
 function setView(next){view=['shop','missions','inventory'].includes(next)?next:'shop';resetFilters();syncURL();render();window.BS_AUDIO?.play?.('click')}
 function renderGoal(p){
  const target=$('storeGoal');if(!target)return;const item=catalog().find(i=>i.id===goal()&&!i.source);
  target.replaceChildren();target.classList.toggle('hidden',!item);if(!item)return;
  const owned=p.owned.includes(item.id),cost=price(item),needed=Math.max(0,cost-p.coins),copy=node('div','goal-copy');copy.append(node('b',null,'هدفي: '+item.name),node('p',null,owned?'وصلت لهدفك! الإضافة صارت ضمن مقتنياتك.':needed?'باقي '+needed+' عملة وتفتحها.':'رصيدك يكفي — جاهز تفتحها؟'));
  const meter=node('div','vault-meter'),fill=node('i');fill.style.width=(owned?100:Math.min(100,p.coins/Math.max(1,cost)*100))+'%';meter.appendChild(fill);copy.appendChild(meter);target.append(copy,node('strong','goal-price',cost+' ◈'));
  const action=node('button','bs-btn',owned?'تجهيز الإضافة':needed?'اجمع مكافآت':'شراء وتجهيز');action.disabled=pending;action.onclick=()=>needed&&!owned?setView('missions'):operate(()=>owned?api.equip(item.id):api.purchase(item.id,{expectedPrice:cost}),'تم تجهيز '+item.name);target.appendChild(action);
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
   buy.onclick=()=>operate(()=>api.bundle(bundle.id,{expectedPrice:quote.price}),'تم تجهيز '+bundle.name+' — كل القطع جاهزة في ألعابها');card.appendChild(buy);
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
  const focused=document.activeElement,mark=bookmark(focused),grid=$('storeGrid'),owner=api.access?.().role==='owner',saved=favorites(),terms=searchable(query).split(' ').filter(Boolean);grid.replaceChildren();
  const list=catalog().filter(item=>(item.source!=='owner'||owner)&&(view!=='inventory'||p.owned.includes(item.id))&&(filter==='all'||filter==='favorites'&&saved.has(item.id)||filter==='owned'&&p.owned.includes(item.id)||item.type===filter)&&(rarity==='all'||(item.rarity||'common')===rarity)&&terms.every(term=>searchable(item.name+' '+item.description+' '+typeNames[item.type]).includes(term)));
  list.sort((a,b)=>sort==='price-low'?price(a)-price(b):sort==='price-high'?price(b)-price(a):sort==='owned'?Number(p.owned.includes(b.id))-Number(p.owned.includes(a.id)):Number(b.price>=450)-Number(a.price>=450));
  for(const item of list){
   const owned=p.owned.includes(item.id),equipped=p.equipped[item.type]===item.id,cost=price(item),sale=cost<item.price,locked=Boolean(item.source&&!owned);
   const card=node('article','store-card');card.dataset.rarity=item.rarity||'common';card.dataset.item=item.id;card.dataset.equipped=equipped;card.appendChild(preview(item));card.appendChild(node('span','rarity '+item.rarity,rarityNames[item.rarity]||'أصلي'));
   const favorite=node('button','item-favorite',saved.has(item.id)?'★':'☆');favorite.type='button';favorite.dataset.control='favorite';favorite.setAttribute('aria-label',(saved.has(item.id)?'إزالة من المفضلة: ':'إضافة للمفضلة: ')+item.name);favorite.setAttribute('aria-pressed',String(saved.has(item.id)));favorite.onclick=()=>toggleFavorite(item);card.appendChild(favorite);
   if(sale&&!owned)card.appendChild(node('span','offer-tag','−20%'));card.append(node('h2',null,item.name),node('p',null,item.description));
   const label=node('span','owned-label store-price'+(owned?' is-owned':''),equipped?'✓ مُجهّز الآن':owned?'ضمن مقتنياتك':locked?'مكافأة إنجاز':cost+' ◈');if(sale&&!owned)label.appendChild(node('del',null,item.price));card.appendChild(label);
   const button=node('button','bs-btn'+(equipped?'':' primary'),equipped?'مُجهّز':owned?'تجهيز':locked?'تُفتح بإنجاز 50 جولة':p.coins<cost?'تحتاج '+(cost-p.coins)+' عملة إضافية':'شراء وتجهيز · '+cost);button.disabled=pending||equipped||locked||!owned&&p.coins<cost;
   button.dataset.control='buy';button.onclick=()=>operate(()=>owned?api.equip(item.id):api.purchase(item.id,{expectedPrice:cost}),'تم تجهيز '+item.name+' — يظهر في اللعبة تلقائيًا');card.appendChild(button);
   if(!owned&&!locked){const add=node('button','bs-btn primary cart-add-v15',basket.ids.includes(item.id)?'✓ في السلة · إزالة':'أضف إلى السلة');add.type='button';add.disabled=pending;add.dataset.control='cart';add.setAttribute('aria-pressed',String(basket.ids.includes(item.id)));add.onclick=()=>toggleCart(item);card.appendChild(add);}
   const inspectButton=node('button','bs-btn item-inspect','معاينة الإضافة ↗');inspectButton.dataset.control='inspect';inspectButton.onclick=()=>inspect(item,inspectButton);card.appendChild(inspectButton);const art=card.querySelector('.cosmetic-preview');art.onclick=()=>inspect(item,inspectButton);art.dataset.control='art';art.tabIndex=0;art.setAttribute('role','button');art.setAttribute('aria-label','معاينة '+item.name);art.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect(item,art);}};
   if(!owned){const aim=node('button','bs-btn goal-button'+(goal()===item.id?' selected':''),locked?'شاهد الإنجاز ←':goal()===item.id?'✓ هدفك الحالي':'اجعله هدفي');aim.dataset.control='goal';aim.disabled=pending;aim.onclick=()=>locked?setView('missions'):(saveGoal(item.id),render());card.appendChild(aim)}
   grid.appendChild(card);
  }
  $('storeEmpty')?.classList.toggle('hidden',list.length>0);
  if($('storeResults'))$('storeResults').textContent=list.length+' إضافة'+(view==='inventory'?' في مقتنياتك':filter==='favorites'?' في مفضلتك':'');
  if(mark&&!inspected)restoreFocus(focused,mark);
 }
 function renderLoadout(p){const target=$('storeLoadout');if(!target)return;target.replaceChildren();for(const type of ['snake','character','pawn','dice','board','table','trail','victory','title']){const item=catalog().find(i=>i.id===p.equipped[type]);if(!item)continue;const button=node('button','loadout-item');button.type='button';button.dataset.loadout=type;button.setAttribute('aria-label','مقتنيات '+typeNames[type]+': '+item.name);const image=previewImage(item),copy=node('span');copy.append(node('small',null,typeNames[type]+' · مجهّز'),node('b',null,item.name));button.append(image,copy,node('span','loadout-arrow','←'));button.onclick=()=>{setView('inventory');filter=type;syncURL();render();$('storeTabs')?.scrollIntoView?.({behavior:'smooth',block:'start'});};target.appendChild(button);}}
 function render(){
  const account=api.account?.();if(account!==lastAccount){if(cartShown)closeCart();lastAccount=account;basket=loadCart();if(inspected)closeInspector();message('');}const p=profile();if(!Array.isArray(p.owned))return;const offer=core?.dailyOffer?.(now());
  if($('offerName')&&offer)$('offerName').textContent=catalog().find(i=>i.id===offer.id)?.name||'';
  const available=catalog().filter(i=>i.source!=='owner'||api.access?.().role==='owner'),owned=available.filter(i=>p.owned.includes(i.id)).length;
  if($('collectionCount'))$('collectionCount').textContent=owned+' / '+available.length+' إضافة';
  if($('collectionProgress'))$('collectionProgress').style.width=owned/Math.max(1,available.length)*100+'%';
  if($('collectionNext'))$('collectionNext').textContent=owned===available.length?'خزانتك مكتملة — جرّب أسلوبًا جديدًا':'المجموعة تشمل الإضافات المجانية. إنجاز الجامع يحتسب المقتنيات المدفوعة فقط.';
  $('missionsView')?.classList.toggle('hidden',view!=='missions');$('shopView')?.classList.toggle('hidden',view==='missions');$('bundlesSection')?.classList.toggle('hidden',view==='inventory');
  if($('catalogueTitle'))$('catalogueTitle').textContent=view==='inventory'?'مقتنياتك — جهّز أسلوبك':'إضافات الحلبة';
  $('storeViews')?.querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',b.dataset.view===view?'true':'false')});
  $('storeTabs').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.filter===filter);b.setAttribute('aria-pressed',b.dataset.filter===filter?'true':'false')});
  renderGoal(p);renderBundles(p);renderMissions(p);renderItems(p);renderInspector();renderLoadout(p);renderCart(p);
 }
 $('storeTabs').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;filter=b.dataset.filter;syncURL();render()});
 $('storeViews')?.addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)setView(b.dataset.view)});
 if($('earnCoins'))$('earnCoins').onclick=()=>setView('missions');
 $('storeSearch')?.addEventListener('input',e=>{query=e.target.value.trim();renderItems(profile())});
 $('storeSort')?.addEventListener('change',e=>{sort=e.target.value;renderItems(profile())});
 $('storeRarity')?.addEventListener('change',e=>{rarity=e.target.value;renderItems(profile())});
 if($('cartOpen'))$('cartOpen').onclick=openCart;
 if($('cartClose'))$('cartClose').onclick=closeCart;
 if($('cartClear'))$('cartClear').onclick=()=>{if(pending)return;basket={ids:[],requestId:newCheckout()};saveCart();render();};
 $('cartDialog')?.addEventListener('click',event=>{if(event.target===$('cartDialog'))closeCart();});
 document.addEventListener('keydown',event=>{if(!cartShown)return;if(event.key==='Escape'){event.preventDefault();closeCart();}else if(event.key==='Tab'){const buttons=[...$('cartDialog').querySelectorAll('button')].filter(button=>!button.disabled&&!button.classList.contains('hidden')),first=buttons[0],last=buttons.at(-1);if(!buttons.includes(document.activeElement)){event.preventDefault();first?.focus();}else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}});
 if($('storeReset'))$('storeReset').onclick=()=>{resetFilters();syncURL();render();$('storeSearch')?.focus();};
 if($('itemClose'))$('itemClose').onclick=closeInspector;
 $('itemDialog')?.addEventListener('cancel',e=>{e.preventDefault();closeInspector();});
 $('itemDialog')?.addEventListener('click',e=>{if(e.target===$('itemDialog'))closeInspector();});
 document.addEventListener('keydown',e=>{if(!inspected)return;if(e.key==='Escape'){e.preventDefault();closeInspector();}else if(e.key==='Tab'){const buttons=[...$('itemDialog').querySelectorAll('button, a[href]')].filter(b=>!b.disabled&&!b.classList.contains('hidden')),first=buttons[0],last=buttons.at(-1);if(!buttons.includes(document.activeElement)){e.preventDefault();first?.focus();}else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
 let featuredId='snake-plasma';
 function feature(id){const item=catalog().find(i=>i.id===id&&i.type==='snake'&&!i.source);if(!item)return;featuredId=id;const target=$('vaultFeatureArt');if(target){target.querySelector('canvas')?.remove();target.querySelector('img')?.remove();if(window.BS_COSMETIC_ART)window.BS_COSMETIC_ART.mount(target,item,{live:true,width:840});else target.appendChild(previewImage(item));}if($('featureInspect')){$('featureInspect').textContent='عاين '+item.name+' ↗';$('featureInspect').onclick=()=>inspect(item,$('featureInspect'));}$('featureSkins')?.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.featureItem===id)));}
 if($('featureSkins'))for(const item of catalog().filter(i=>i.type==='snake'&&!i.source)){const button=node('button',null,item.name);button.type='button';button.dataset.featureItem=item.id;button.setAttribute('aria-pressed',String(item.id===featuredId));button.onclick=()=>feature(item.id);$('featureSkins').appendChild(button);}feature(featuredId);
 window.addEventListener('bs-career-change',render);window.addEventListener('bs-arena-ready',render);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});setInterval(()=>render(),60000);render();
})();
