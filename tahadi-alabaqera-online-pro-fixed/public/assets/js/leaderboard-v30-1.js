/* Tahdia 30.1.0 — weekly and season leaderboard page. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const points=new Intl.NumberFormat('en-US');
  const NUMERALS=['','1','2','3'];
  const COPY={
    week:{tab:'tabWeek',ends:'يتجدد الترتيب بعد',previous:'أبطال الأسبوع الماضي',empty:'لا توجد نتائج موثّقة هذا الأسبوع حتى الآن. أول فوز أونلاين يضعك في المركز الأول.',none:'لم تلعب مباراة موثّقة هذا الأسبوع.'},
    season:{tab:'tabSeason',ends:'ينتهي الموسم بعد',previous:'أبطال الموسم الماضي',empty:'لا توجد نتائج موثّقة في هذا الموسم حتى الآن. أول فوز أونلاين يضعك في المركز الأول.',none:'لم تلعب مباراة موثّقة في هذا الموسم.'}
  };
  let period=new URLSearchParams(location.search).get('period')==='season'?'season':'week';
  let view=null,controller=null,clock=null,offset=0;

  function player(){
    // The account session is "username.secret"; only the public name is read.
    try{const name=String(localStorage.getItem('bs_social_session')||'').split('.')[0].toLowerCase();return /^[a-z0-9_]{3,20}$/.test(name)?name:'';}catch{return '';}
  }
  // Arabic counting: 1 and 2 have their own forms, 3–10 take the plural, 11+ the singular accusative.
  function count(n,[one,two,few,many]){return n===1?one:n===2?two:n>=3&&n<=10?`${n} ${few}`:`${n} ${many}`;}
  const days=n=>count(n,['يوم','يومين','أيام','يومًا']),hours=n=>count(n,['ساعة','ساعتين','ساعات','ساعة']),minutes=n=>count(n,['دقيقة','دقيقتين','دقائق','دقيقة']);
  function remaining(ms){
    const total=Math.max(0,Math.floor(ms/60000)),d=Math.floor(total/1440),h=Math.floor(total%1440/60),m=total%60;
    if(d)return h?`${days(d)} و${hours(h)}`:days(d);
    if(h)return m?`${hours(h)} و${minutes(m)}`:hours(h);
    return m?minutes(m):'أقل من دقيقة';
  }
  function record(w,g){return g?`فاز في ${points.format(w)} من ${points.format(g)}`:'لم يلعب بعد';}
  function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
  function initial(name){return Array.from(String(name||'').trim())[0]||'؟';}
  function crown(){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 28 20');svg.setAttribute('class','lb-crown');svg.setAttribute('aria-hidden','true');svg.innerHTML='<path fill="currentColor" d="M2 6l6 5 6-10 6 10 6-5-3 14H5z"/>';return svg;}
  function avatar(row){const a=node('span','lb-avatar',initial(row?.name));a.setAttribute('aria-hidden','true');if(row?.owner)a.append(crown());return a;}
  function pointsLabel(value){const p=node('span','lb-points',points.format(value));p.append(node('small',null,' نقطة'));return p;}

  function step(rank,row,me){
    const card=node('div','lb-step'+(row?'':' is-empty')+(row&&row.username===me?' is-me':''));card.dataset.rank=rank;
    const person=node('div','lb-person'),block=node('div','lb-block'),numeral=node('span','lb-numeral',NUMERALS[rank]);
    numeral.setAttribute('aria-hidden','true');block.append(numeral);person.append(avatar(row));card.append(person,block);
    if(!row){person.append(node('span','lb-name','بانتظار بطل'));card.setAttribute('aria-label',`المركز ${rank} شاغر`);return card;}
    person.append(node('span','lb-name',row.name),pointsLabel(row.points));
    if(row.owner)person.append(node('span','lb-tag','المدير'));else if(row.username===me)person.append(node('span','lb-tag me','أنت'));
    card.setAttribute('aria-label',`المركز ${rank}: ${row.name}، ${points.format(row.points)} نقطة، ${record(row.wins,row.games)}`);
    return card;
  }
  function line(row,me){
    const li=node('li','lb-row'+(row.username===me?' is-me':'')+(row.owner?' is-owner':''));
    if(row.username===me)li.setAttribute('aria-current','true');
    const rank=node('span','lb-rank',String(row.rank));rank.setAttribute('aria-hidden','true');
    const who=node('span','lb-who'),name=node('b');name.append(node('span',null,row.name));if(row.owner)name.append(crown());
    who.append(name,node('small',null,record(row.wins,row.games)));
    li.append(rank,avatar(row),who,pointsLabel(row.points));return li;
  }
  function standing(data,me){
    const box=$('lbMe');box.replaceChildren();
    if(!me){
      box.append(node('span','lb-me-rank is-out','؟'));const copy=node('span','lb-me-copy');copy.append(node('b',null,'سجّل دخولك ليظهر اسمك في اللوحة'),node('span',null,'النقاط تُحفظ في حسابك وتُحسب من مباريات الأونلاين.'));
      const go=node('a','bs-btn primary','سجّل الدخول');go.href='/social?next='+encodeURIComponent('/leaderboard'+(period==='season'?'?period=season':''));box.append(copy,go);box.hidden=false;return;
    }
    const mine=data.me||{points:0,wins:0,games:0,rank:null},copy=node('span','lb-me-copy');
    if(mine.rank){
      box.append(node('span','lb-me-rank',String(mine.rank)));
      copy.append(node('b',null,mine.rank===1?'أنت في الصدارة. حافظ عليها.':`مركزك ${mine.rank}`),node('span',null,`${points.format(mine.points)} نقطة. ${record(mine.wins,mine.games)}.`));
      box.append(copy);
    }else if(!mine.games){
      box.append(node('span','lb-me-rank is-out','—'));copy.append(node('b',null,COPY[period].none),node('span',null,'فوز واحد يضيف 250 نقطة، وإكمال المباراة 80.'));
      const go=node('a','bs-btn primary','العب أونلاين');go.href='/online';box.append(copy,go);
    }else{
      const last=data.players.at(-1),gap=last?Math.max(0,last.points-mine.points)+1:0;
      box.append(node('span','lb-me-rank is-out','+100'));copy.append(node('b',null,'خارج أول 100'),node('span',null,`${points.format(mine.points)} نقطة. تحتاج ${points.format(gap)} نقطة لدخول القائمة.`));
      box.append(copy);
    }
    box.hidden=false;
  }
  function previous(data){
    const section=$('lbPrevious'),list=$('lbPrevList'),rows=data.previous?.players||[];list.replaceChildren();
    $('lbPrevTitle').textContent=COPY[period].previous;section.hidden=!rows.length;
    for(const row of rows){const li=node('li');li.style.setProperty('--medal',['var(--lb-gold)','var(--lb-silver)','var(--lb-bronze)'][row.rank-1]);li.append(node('b',null,row.name),node('span',null,`${points.format(row.points)} نقطة`));list.append(li);}
  }
  function countdown(){
    if(!view)return;
    const left=view.endsAt-(Date.now()+offset),target=$('lbCountdown');target.textContent=COPY[period].ends+' ';target.append(node('b',null,remaining(left)));
    if(left<=0){clearInterval(clock);clock=null;load();}
  }
  function render(data){
    const me=player(),podium=$('lbPodium'),list=$('lbList'),rows=data.players||[];view=data;offset=(data.serverNow||Date.now())-Date.now();
    podium.replaceChildren();podium.append(...[1,2,3].map(rank=>step(rank,rows[rank-1],me)));
    list.replaceChildren();list.append(...rows.slice(3).map(row=>line(row,me)));
    $('lbEmpty').hidden=rows.length>0;$('lbEmptyText').textContent=COPY[period].empty;
    standing(data,me);previous(data);countdown();
    clearInterval(clock);clock=setInterval(countdown,30000);
  }
  function fail(message){
    $('lbPodium').replaceChildren();$('lbList').replaceChildren();$('lbEmpty').hidden=true;$('lbMe').hidden=true;$('lbPrevious').hidden=true;
    $('lbErrorText').textContent=message||'تعذر تحميل اللوحة. تحقق من اتصالك ثم حاول مرة ثانية.';$('lbError').hidden=false;
  }
  async function load(){
    controller?.abort();controller=new AbortController();const signal=controller.signal,panel=$('lbPanel'),me=player();
    panel.setAttribute('aria-busy','true');$('lbError').hidden=true;$('lbPodium').replaceChildren();$('lbList').replaceChildren();
    try{
      const res=await fetch('/api/leaderboard?period='+period+(me?'&player='+encodeURIComponent(me):''),{signal,cache:'no-store'});
      const data=await res.json().catch(()=>({}));
      if(signal.aborted)return;
      if(!res.ok||!data.ok)return fail(data.error);
      render(data);
    }catch(error){if(error?.name!=='AbortError')fail();}
    finally{if(!signal.aborted)panel.setAttribute('aria-busy','false');}
  }
  function select(next,focus=false){
    if(next!==period||!view){period=next;}
    for(const key of ['week','season']){const tab=$(COPY[key].tab),on=key===period;tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;if(on&&focus)tab.focus();}
    $('lbPanel').setAttribute('aria-labelledby',COPY[period].tab);
    const url=new URL(location.href);if(period==='season')url.searchParams.set('period','season');else url.searchParams.delete('period');history.replaceState(null,'',url);
    load();
  }
  for(const tab of document.querySelectorAll('.lb-tabs [role="tab"]')){
    tab.addEventListener('click',()=>{if(tab.dataset.period!==period)select(tab.dataset.period);});
    // In a right-to-left tab list the left arrow moves forward.
    tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?'week':event.key==='End'?'season':period==='week'?'season':'week';select(next,true);});
  }
  $('lbRetry').addEventListener('click',load);
  addEventListener('storage',event=>{if(event.key==='bs_social_session')load();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&view&&view.endsAt<=Date.now()+offset)load();});
  select(period);
})();
