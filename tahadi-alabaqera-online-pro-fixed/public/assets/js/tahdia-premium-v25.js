/* One navigation system and one feedback engine. No polling or duplicate FX. */
(() => {
  'use strict';
  if (window.__TAHDIA_INTERFACE_25_1__) return;
  window.__TAHDIA_INTERFACE_25_1__ = true;
  const doc = document;
  const route = new URL(location.href).pathname.replace(/\/$/,'').replace(/\.html$/,'').split('/').at(-1)||'index';
  const shellRoutes = new Set(['index','shop','social']);
  const icons = {
    home:'<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/>',
    games:'<path d="M7 6h10c3 0 4 10 4 12s-3 2-6-2H9c-3 4-6 4-6 2S4 6 7 6ZM8 9v6m-3-3h6m5-2h.01m3 4h.01"/>',
    journey:'<path d="m12 3 3 6 6 1-4.5 4.5 1 6.5-5.5-3-5.5 3 1-6.5L3 10l6-1z"/>',
    shop:'<path d="M4 8h16l-1 13H5zM8 8V6a4 4 0 0 1 8 0v2"/>',
    friends:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-16a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/>'
  };
  const links = [
    ['home','الرئيسية','/','index'],['games','كل الألعاب','/#games','games'],
    ['journey','رحلة النجوم','/journey','journey'],['shop','المتجر','/shop','shop'],['friends','الأصدقاء','/social','social']
  ];
  function icon(name){return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+icons[name]+'</svg>';}
  function mountShell(){
    if(!shellRoutes.has(route)||doc.body.classList.contains('atelier-shop-v30'))return;
    doc.body.classList.add('hub-page','hub-'+route);
    if(!doc.getElementById('hubRail')){
      const nav=doc.createElement('nav');nav.id='hubRail';nav.className='hub-rail';nav.setAttribute('aria-label','التنقل الرئيسي');
      for(const [key,label,url,id]of links){const a=doc.createElement('a');a.href=url;a.innerHTML=icon(key)+'<span>'+label+'</span>';if(route===id)a.setAttribute('aria-current','page');nav.append(a);}
      const header=doc.querySelector('.bs-topbar');if(header){const actions=header.querySelector('.bs-actions');header.append(nav);if(actions)header.append(actions);}
    }
    const bar=doc.querySelector('.bs-topbar');
    if(bar&&route!=='index'&&!bar.querySelector('[data-hub-back]')){
      const back=doc.createElement('a');back.href='/';back.className='hub-back';back.dataset.hubBack='';back.setAttribute('aria-label','الرجوع للرئيسية');back.textContent='→';bar.prepend(back);
    }
    if(!doc.querySelector('.mobile-dock')){
      const dock=doc.createElement('nav');dock.className='mobile-dock';dock.setAttribute('aria-label','التنقل السريع');
      for(const [key,label,url,id]of links.filter(row=>row[0]!=='journey')){const a=doc.createElement('a');a.href=url;a.innerHTML=icon(key)+'<span>'+label+'</span>';if(route===id)a.setAttribute('aria-current','page');dock.append(a);}doc.body.append(dock);
    }
  }
  function toast(message){window.BS_PLATFORM?.toast?.(String(message));}
  window.TAHDIA_PREMIUM=Object.freeze({
    openInvite:()=>window.BS_INVITES?.open?.(),toast,
    room:()=>window.BS_INVITES?.data?.(),
    victory:(name,options={})=>window.BS_GAME_FX?.celebrate?.(name,options)
  });
  function setup(){mountShell();if(route==='dice'){for(const el of doc.querySelectorAll('[data-die-catalog]')){const item=window.BS_CAREER_CORE?.CATALOG.find(i=>i.id===el.dataset.dieCatalog);if(item)window.BS_COSMETIC_ART?.mount(el,item,{width:420});}};for(const control of doc.querySelectorAll('[data-hub-invite]'))control.addEventListener('click',()=>window.BS_INVITES?.open?.());}
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
