(function(){
 'use strict';
 const api=window.BS_CAREER,core=window.BS_CAREER_CORE,$=id=>document.getElementById(id),rarityNames={common:'عادي',rare:'نادر',legendary:'أسطوري'};
 let filter='all',pending=false;
 function preview(item){
  const box=document.createElement('div');box.className='cosmetic-preview';box.style.setProperty('--item-color',item.color);box.setAttribute('aria-hidden','true');
  const asset=document.createElement('div');asset.className='preview-'+item.type;
  if(item.type==='board')for(let i=0;i<16;i++)asset.appendChild(document.createElement('i'));
  if(item.type==='dice'){if(item.id==='dice-midnight')asset.style.setProperty('--preview-pip','#f7ecda');for(let i=0;i<5;i++)asset.appendChild(document.createElement('i'))}
  if(item.type==='snake')asset.innerHTML=`<svg viewBox="0 0 150 100" width="100%" height="100%"><path d="M120 26C87 6 48 16 54 44S130 59 102 76S31 80 28 51" fill="none" stroke="#182838" stroke-width="21" stroke-linecap="round"/><path d="M120 26C87 6 48 16 54 44S130 59 102 76S31 80 28 51" fill="none" stroke="${item.color}" stroke-width="17" stroke-linecap="round"/><path d="M115 25C87 10 48 18 58 43S127 60 100 72" fill="none" stroke="#ffffff66" stroke-width="3"/><ellipse cx="121" cy="28" rx="17" ry="13" fill="${item.color}"/><circle cx="129" cy="22" r="4" fill="#fff3b9"/><circle cx="129" cy="22" r="1.8" fill="#14243c"/><path d="M133 32l12 3m-3 0l4 4m-4-4l4-3" fill="none" stroke="#ed93a2" stroke-width="2"/></svg>`;
  box.appendChild(asset);return box;
 }
 function render(){
  const profile=api.get(),offer=core?.dailyOffer?.();$('storeGrid').replaceChildren();
  if($('offerName')&&offer)$('offerName').textContent=api.catalog.find(i=>i.id===offer.id)?.name||'';
  for(const item of api.catalog){
   const owned=profile.owned.includes(item.id),equipped=profile.equipped[item.type]===item.id,price=core?.itemPrice?.(item.id)??item.price,sale=price<item.price;
   if(filter==='owned'&&!owned||filter!=='all'&&filter!=='owned'&&filter!==item.type)continue;
   const card=document.createElement('article');card.className='store-card';card.dataset.rarity=item.rarity||'common';card.dataset.item=item.id;card.appendChild(preview(item));
   const rarity=document.createElement('span');rarity.className='rarity '+(item.rarity||'common');rarity.textContent=rarityNames[item.rarity]||'عادي';card.appendChild(rarity);
   if(sale){const tag=document.createElement('span');tag.className='offer-tag';tag.textContent='−20%';card.appendChild(tag)}
   const title=document.createElement('h2');title.textContent=item.name;card.appendChild(title);
   const desc=document.createElement('p');desc.textContent=item.description;card.appendChild(desc);
   const label=document.createElement('span');label.className='owned-label store-price';label.textContent=equipped?'✓ مُجهّز الآن':owned?'ضمن مقتنياتك':price+' ◈';
   if(sale&&!owned){const old=document.createElement('del');old.textContent=item.price;label.appendChild(old)}card.appendChild(label);
   const button=document.createElement('button');button.className='bs-btn'+(equipped?'':' primary');button.disabled=pending||equipped||!owned&&profile.coins<price;button.textContent=equipped?'مُجهّز':owned?'تجهيز':profile.coins<price?'تحتاج '+(price-profile.coins)+' عملة إضافية':'شراء وتجهيز · '+price;
   button.onclick=async()=>{if(pending)return;pending=true;$('storeMessage').textContent='جاري الحفظ…';render();try{if(owned)await api.equip(item.id);else await api.purchase(item.id);$('storeMessage').textContent='تم تجهيز '+item.name+' — يظهر في اللعبة تلقائيًا';window.BS_AUDIO?.play?.('finish')}catch(e){$('storeMessage').textContent=e.message==='insufficient_coins'?'رصيدك غير كافٍ':e.message==='item_not_owned'?'هذا العنصر غير مملوك':'لم تكتمل العملية: '+e.message}finally{pending=false;render()}};
   card.appendChild(button);$('storeGrid').appendChild(card);
  }
 }
 $('storeTabs').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;filter=b.dataset.filter;$('storeTabs').querySelectorAll('button').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b?'true':'false')});render()});
 window.addEventListener('bs-career-change',render);render();
})();
