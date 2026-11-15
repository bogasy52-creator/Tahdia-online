(()=>{
 const $=id=>document.getElementById(id),q=new URLSearchParams(location.search),node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
 let code=/^06\d{4}$/.test(q.get('room')||'')?q.get('room'):'',state=null,busy=false,poll=null,epoch=0;
 const me=()=>window.BS_SOCIAL?.profile?.()?.username||'',tell=text=>{$('cupMessage').textContent=text||'';};
 async function api(path,body){let token='';try{token=localStorage.getItem('bs_social_session')||'';}catch{}const r=await fetch('/api/tournament/rooms'+path,{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json'}:{}),...(body&&token?{authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(12000)}),data=await r.json().catch(()=>({}));if(!r.ok||!data.ok)throw Error(data.error||'تعذّر الاتصال بالبطولة. حاول مجددًا.');return data;}
 function show(data){
  state=data;code=data.code;const url=new URL(location.href);url.searchParams.set('room',code);history.replaceState(null,'',url);$('cupEntry').hidden=true;$('cupRoom').hidden=false;$('cupRoomCode').textContent=code;
  const name=u=>data.players.find(p=>p.username===u)?.name||u,sport=data.sport==='tanks'?'معركة الدبابات':'البلياردو';$('cupSport').textContent=sport+' · '+data.capacity+' لاعبين';$('cupStatus').textContent=data.status==='lobby'?'بانتظار المشاركين · '+data.players.length+' من '+data.capacity:data.status==='finished'?'اكتملت البطولة':'البطولة شغالة · ادخل مواجهتك عندما تجهز';
  $('cupPlayers').replaceChildren(...data.players.map(p=>node('span','cup-player',p.name+(p.username===me()?' · أنت':''))));$('cupEnter').hidden=data.status!=='lobby'||data.players.some(p=>p.username===me());$('cupEnter').textContent=me()?'احجز مقعدك':'سجّل دخولك للمشاركة';$('cupStart').hidden=data.status!=='lobby'||data.owner!==me();$('cupStart').disabled=data.players.length!==data.capacity||busy;
  $('cupChampion').hidden=data.status!=='finished';$('cupChampion').textContent=data.winner?'بطل البطولة · '+name(data.winner):'';const bracket=$('cupBracket');bracket.replaceChildren();const count=Math.log2(data.capacity);
  for(let round=0;round<count;round++){const section=node('section','cup-round');section.append(node('h3',null,round===count-1?'النهائي':round===count-2?'نصف النهائي':'ربع النهائي'));
   for(let i=0;i<data.capacity/2**(round+1);i++){const match=data.rounds[round]?.[i],card=node('article','cup-match'+(match?.winner?' is-finished':''));for(let seat=0;seat<2;seat++){const user=match?.players[seat],line=node('div','cup-seat'+(match?.winner&&match.winner===user?' is-winner':''));line.append(node('span',null,user?name(user):'بانتظار المتأهل'),node('small',null,user&&user===me()?'أنت':match?.winner&&match.winner===user?'تأهل':''));card.append(line);}
    if(match?.status==='ready'&&match.players.includes(me())){const link=node('a','bs-btn primary','ادخل مواجهتك');link.href='/'+data.sport+'?room='+match.roomCode+'&cup='+code;card.append(link);}else card.append(node('small','cup-match-status',match?.status==='finished'?'حُسمت المواجهة':match?.status==='ready'?'المواجهة جاهزة':match?.status==='opening'?'جاري تجهيز الساحة…':'مواجهة قادمة'));if(match?.draws)card.append(node('small','cup-match-status','إعادة بعد التعادل · '+match.draws));section.append(card);
   }bracket.append(section);
  }
 }
 function schedule(){clearTimeout(poll);if(code&&!document.hidden&&state?.status!=='finished')poll=setTimeout(refresh,8000);}
 async function refresh(){if(!code||document.hidden||busy)return;const run=++epoch;try{const data=await api('/'+code);if(run===epoch){show(data);tell('');}}catch(e){if(run===epoch)tell(e.message);}finally{schedule();}}
 function lock(){for(const b of document.querySelectorAll('button'))b.disabled=busy;if(state)$('cupStart').disabled=busy||state.players.length!==state.capacity;}
 async function action(fn){if(busy)return;busy=true;lock();try{const data=await fn();epoch++;show(data);tell('');}catch(e){tell(e.message);}finally{busy=false;lock();schedule();}}
 $('cupCreate').onsubmit=e=>{e.preventDefault();action(()=>api('',{game:$('cupGame').value,capacity:Number($('cupCapacity').value)}));};
 $('cupJoin').onsubmit=e=>{e.preventDefault();const value=$('cupCode').value.normalize('NFKC').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632));if(!/^06\d{4}$/.test(value)){tell('رمز البطولة 6 أرقام ويبدأ بـ06.');return;}code=value;state=null;refresh();};
 $('cupEnter').onclick=()=>{if(!me()){location.href='/social?next='+encodeURIComponent('/tournament?room='+code);return;}action(()=>api('/'+code+'/join',{}));};$('cupStart').onclick=()=>action(()=>api('/'+code+'/start',{}));$('cupRefresh').onclick=refresh;
 $('cupCopy').onclick=async()=>{try{await navigator.clipboard.writeText(new URL('/tournament?room='+code,location.origin).href);tell('تم نسخ رابط البطولة.');}catch{tell('رمز البطولة '+code);}};
 document.addEventListener('visibilitychange',()=>{clearTimeout(poll);if(!document.hidden)refresh();});addEventListener('pagehide',()=>{epoch++;clearTimeout(poll);});addEventListener('pageshow',e=>{if(e.persisted)refresh();});if(code)refresh();
})();
