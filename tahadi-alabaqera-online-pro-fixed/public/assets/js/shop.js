(function(){
 'use strict';
 const api=window.BS_CAREER,core=window.BS_CAREER_CORE,$=id=>document.getElementById(id),rarityNames={common:'عادي',rare:'نادر',legendary:'أسطوري'};
 let filter='all',pending=false;
 function preview(item){
  const box=document.createElement('div');box.className='cosmetic-preview';box.style.setProperty('--item-color',item.color);box.setAttribute('aria-hidden','true');
  const asset=document.createElement('div');asset.className='preview-'+item.type;
  const rotations={'snake-aurora':65,'snake-gold':-170,'snake-ice':0,'snake-wild':0,'board-ocean':-18,'board-sand':145,'board-twilight':35,'board-royal':150,'table-emerald':70,'table-midnight':170,'table-royal':260};
  if(item.type==='snake'||item.type==='board'||item.type==='table'){
   const img=document.createElement('img');img.alt='';img.src='assets/arena/'+(item.type==='snake'?'neon-cobra.png':item.type==='board'?'arena-plate.png':'jackaroo-table.png');
   img.style.filter='hue-rotate('+(rotations[item.id]??0)+'deg)';asset.appendChild(img);
  }else if(item.type==='pawn'){window.BS_ARENA?.crystal(asset,{'pawn-amethyst':1,'pawn-gold':2,'pawn-jade':3}[item.id]||0);}
  else if(item.type==='dice'){const die=document.createElement('div');die.className='die';die.dataset.value='5';die.style.setProperty('--die-color',item.color);asset.appendChild(die);window.BS_DICE?.mount?.(die);}
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
