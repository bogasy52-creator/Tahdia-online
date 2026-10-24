/* V25 unified game chrome, visual feedback and explicit friend invitations. */
(() => {
  const root = window, doc = document;
  const colors = ['#62f4c8', '#53b7ff', '#c98cff', '#ffd166', '#ff6e91', '#ffffff'];
  const gameRoutes = new Set(['dice', 'jackaroo', 'journey', 'local', 'logic', 'memory', 'online', 'paths-online', 'picture', 'puzzle', 'quiz', 'reaction', 'serpent', 'snakes', 'sudoku', 'zahra']);
  const titles = {dice:'تحدي النرد',jackaroo:'جاكارو',journey:'رحلة النجوم',local:'تحدي العباقرة',logic:'تحدي المنطق',memory:'تحدي الذاكرة',online:'العباقرة أونلاين','paths-online':'توصيل الأرقام',picture:'سباق الصور',puzzle:'ترتيب الأرقام',quiz:'تحدي العباقرة',reaction:'سرعة الاستجابة',serpent:'حلبة الثعبان',snakes:'سلم وثعبان',sudoku:'سودوكو',zahra:'الزهرة'};
  const inviteGames = {'paths-online':'paths',online:'quiz'};
  const route = new URL(location.href).pathname.replace(/\.html$/, '').replace(/^\//, '') || 'index';
  const enabled = () => root.BS_AUDIO?.getSettings?.().effects !== false;
  const reduced = () => Boolean(root.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const effectHost = () => doc.querySelector('dialog[open]') || doc.fullscreenElement || doc.querySelector('body.serpent-active #arenaPlay') || doc.body;
  let layer = null, context = null, socialLoader = null, celebrationKey = '';

  const css = doc.createElement('link'); css.rel = 'stylesheet'; css.href = '/assets/css/play-experience-v25.css?v=30.1.0'; doc.head?.appendChild(css);

  function effectLayer() {
    const parent = effectHost();
    if (!layer || layer.parentNode !== parent) { layer?.remove(); layer = doc.createElement('div'); layer.className = 'bs-fx-layer'; layer.setAttribute('aria-hidden', 'true'); parent.appendChild(layer); }
    return layer;
  }
  function restartClass(node, className, ms = 850) { if (!node || !enabled()) return; node.classList.remove(className); void node.offsetWidth; node.classList.add(className); setTimeout(() => node.classList.remove(className), ms); }
  function burst(node, count = 10, strong = false) {
    if (!node || !enabled() || reduced()) return;
    const rect = node.getBoundingClientRect(); if (!rect.width || !rect.height) return; const target = effectLayer();
    for (let i = 0; i < Math.min(strong ? 24 : 14, count); i++) {
      while (target.querySelectorAll('.bs-fx-dot').length >= 18) target.querySelector('.bs-fx-dot')?.remove();
      const particle = doc.createElement('i'), angle = i * Math.PI * 2 / count; particle.className = 'bs-fx-dot'; particle.style.left = rect.left + rect.width / 2 + 'px'; particle.style.top = rect.top + rect.height / 2 + 'px';
      particle.style.setProperty('--fx-color', colors[i % colors.length]); particle.style.setProperty('--fx-x', Math.cos(angle) * (strong ? 100 + i % 4 * 22 : 38 + i % 3 * 15) + 'px'); particle.style.setProperty('--fx-y', Math.sin(angle) * (strong ? 85 : 45) - (strong ? 40 : 22) + 'px');
      target.appendChild(particle); setTimeout(() => particle.remove(), 950);
    }
  }
  function feedbackBadge(node, kind) {
    if (!node || !enabled()) return; const rect = node.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    const host=effectLayer();while(host.querySelectorAll('.bs-fx-badge').length>=6)host.querySelector('.bs-fx-badge')?.remove();const badge = doc.createElement('b'); badge.className = 'bs-fx-badge is-' + kind; badge.textContent = kind === 'right' ? '✓ صحيح' : kind === 'wrong' ? '× حاول ثانية' : '✦ تقدّم';
    badge.style.left = Math.max(12, Math.min((root.innerWidth || 1024) - 150, rect.left + rect.width / 2 - 58)) + 'px'; badge.style.top = Math.max(72, rect.top - 12) + 'px'; host.appendChild(badge); setTimeout(() => badge.remove(), 950);
  }
  function cell(node, kind = 'right') { restartClass(node, 'bs-fx-' + kind); if (kind === 'right') burst(node, 8); feedbackBadge(node, kind); }
  function sudoku(cells, board, index, kind = 'right') {
    cell(cells[index]?.el || cells[index], kind); if (kind !== 'right') return; const row = Math.floor(index / 9), col = index % 9;
    const units = [Array.from({length:9},(_,i)=>row*9+i),Array.from({length:9},(_,i)=>i*9+col),Array.from({length:9},(_,i)=>(Math.floor(row/3)*3+Math.floor(i/3))*9+Math.floor(col/3)*3+i%3)];
    for (const unit of units) if (unit.every(i=>board[i]) && new Set(unit.map(i=>board[i])).size === 9) { for (const i of unit) restartClass(cells[i]?.el || cells[i], 'bs-fx-unit'); burst(cells[index]?.el || cells[index], 16, true); }
    progress(cells[index]?.el || cells[index], board.filter(Boolean).length, 81, 'تقدم اللوحة');
  }
  function path(canvas, puzzle, points, color = 0) {
    if (!enabled() || !canvas || !points?.length) return; restartClass(canvas, 'bs-fx-right'); if (reduced()) return; const rect = canvas.getBoundingClientRect(), size = puzzle.size; if (!size || !rect.width || !rect.height) return;
    const svg = doc.createElementNS('http://www.w3.org/2000/svg','svg'), line = doc.createElementNS('http://www.w3.org/2000/svg','polyline'); svg.classList.add('bs-fx-line'); svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`); Object.assign(svg.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',color:colors[color%colors.length]});
    line.setAttribute('points',points.map(i=>`${(i%size+.5)*rect.width/size},${(Math.floor(i/size)+.5)*rect.height/size}`).join(' ')); svg.appendChild(line); effectLayer().appendChild(svg); setTimeout(()=>svg.remove(),900); burst(canvas,10);
  }
  function progress(node, current, total, label = 'التقدم') {
    if (!enabled() || !Number.isFinite(current) || !Number.isFinite(total) || total <= 0) return; let meter = doc.getElementById('bsProgressFx');
    if (!meter) { meter = doc.createElement('div'); meter.id = 'bsProgressFx'; meter.className = 'bs-progress-fx'; meter.innerHTML = '<span></span><b></b><i></i>'; effectLayer().appendChild(meter); }
    meter.querySelector('span').textContent = label; meter.querySelector('b').textContent = `${Math.max(0,current)} / ${total}`; meter.querySelector('i').style.width = Math.max(0,Math.min(100,current/total*100))+'%'; meter.classList.remove('show'); void meter.offsetWidth; meter.classList.add('show');
    clearTimeout(progress.timer); progress.timer = setTimeout(()=>meter?.remove(),1600); if (current >= total) burst(node || meter,22,true);
  }
  function celebrate(name = 'فوز مستحق!', options = {}) {
    const cleanName = String(name || 'فوز مستحق!').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,48) || 'فوز مستحق!', key = (options.key || cleanName)+':'+(options.round || '');
    if (celebrationKey === key) return; celebrationKey = key; doc.getElementById('bsVictory')?.remove();
    const source=doc.activeElement,wrap=doc.createElement('div'); wrap.id='bsVictory'; wrap.className='bs-victory'+(options.self===false?' is-rival':''); wrap.setAttribute('role','dialog'); wrap.setAttribute('aria-modal','true'); wrap.setAttribute('aria-label','نتيجة الجولة');
    const collectible=root.BS_CAREER_CORE?.COLLECTION?.find(item=>item.id===(options.design||root.BS_CAREER?.get?.()?.equipped?.victory));if(collectible){wrap.dataset.design=collectible.id;wrap.style.setProperty('--celebration-color',collectible.color);}
    const rays=doc.createElement('div'); rays.className='bs-victory-rays'; rays.setAttribute('aria-hidden','true'); const card=doc.createElement('section'); card.className='bs-victory-card';
    const crown=doc.createElement('div'); crown.className='bs-victory-crown'; crown.textContent=options.tie?'◆':collectible?.design==='bloom'?'❋':collectible?.design==='orbit'?'◎':collectible?'✧':'♛'; const eyebrow=doc.createElement('span'); eyebrow.textContent=options.tie?'نهاية متعادلة':options.self===false?'بطل الجولة':'انتصار أسطوري'; const title=doc.createElement('h2'); title.textContent=cleanName;
    const dismiss=()=>{const restore=wrap.contains(doc.activeElement);wrap.remove();if(restore)source?.focus?.();};
    const subtitle=doc.createElement('p'); subtitle.textContent=options.subtitle||(options.tie?'جولة قوية تستحق الإعادة.':options.self===false?'حسم الجولة بجدارة.':'هذا الفوز لك. احتفل به!'); const close=doc.createElement('button'); close.type='button'; close.textContent='متابعة ←'; close.onclick=dismiss; card.append(crown,eyebrow,title,subtitle,close); wrap.append(rays,card);
    wrap.addEventListener('keydown',event=>{event.stopPropagation?.();if(event.key==='Escape'){event.preventDefault();dismiss();}else if(event.key==='Tab'){event.preventDefault();close.focus();}});
    if (!reduced()) for(let i=0;i<46;i++){const bit=doc.createElement('i');bit.className='bs-victory-confetti';bit.style.setProperty('--x',(2+i*47%96)+'vw');bit.style.setProperty('--delay',(i%9*.07)+'s');bit.style.setProperty('--spin',(i%2?1:-1)*(240+i*19)+'deg');bit.style.setProperty('--color',colors[i%colors.length]);wrap.appendChild(bit);}
    effectHost().appendChild(wrap); root.BS_AUDIO?.play?.('win'); root.BS_AUDIO?.vibrate?.([90,45,130,45,220]); setTimeout(()=>card.classList.add('is-ready'),20); close.focus(); clearTimeout(celebrate.timer); celebrate.timer=setTimeout(dismiss,options.hold?9000:5200);
  }
  function win(node, options={}) { restartClass(node,'bs-fx-unit',1100); burst(node,24,true); if(options.name||options.celebrate)celebrate(options.name,options); }
  root.BS_GAME_FX=Object.freeze({cell,sudoku,path,progress,celebrate,win,wrong:node=>cell(node,'wrong')});

  function inviteData(){
    const url=new URL(location.href),cleanRoute=url.pathname.replace(/\.html$/,'').replace(/^\//,'')||'index';let game=context?.game||inviteGames[cleanRoute]||cleanRoute,code=context?.code||url.searchParams.get('room')||'';
    if(!/^\d{6}$/.test(code))for(const id of['soCode','pathRoomCode','roomCode','code','gameRoomCode']){const element=doc.getElementById(id),value=element?.textContent?.trim();if(element?.tagName!=='INPUT'&&/^\d{6}$/.test(value||'')&&!element.closest('[hidden],.hidden')){code=value;break;}}
    const journeyGame=context?.journeyGame||url.searchParams.get('game')||'jewels';
    const joinable=context?.joinable!==false&&/^\d{6}$/.test(code);url.search='';url.hash='';if(joinable)url.searchParams.set('room',code);if(cleanRoute==='journey')url.searchParams.set('game',journeyGame==='paths'?'paths':'jewels');return{game,variant:cleanRoute==='journey'?(journeyGame==='paths'?'paths':'jewels'):undefined,code:joinable?code:'',roundClosed:context?.joinable===false&&!!context?.code,url:url.href,joinable,title:cleanRoute==='journey'?(journeyGame==='paths'?'مسارات الألوان':'ماستر الجواهر'):titles[cleanRoute]||'تحدي العباقرة'};
  }
  function loadSocial(){if(root.BS_SOCIAL?.openInvitePicker)return Promise.resolve(root.BS_SOCIAL);if(socialLoader)return socialLoader;socialLoader=new Promise((resolve,reject)=>{const script=doc.createElement('script');script.src='/assets/js/social-client.js?v=30.1.0';script.onload=()=>root.BS_SOCIAL?.openInvitePicker?resolve(root.BS_SOCIAL):reject(Error('تعذر تشغيل قائمة الأصدقاء'));script.onerror=()=>reject(Error('تعذر تحميل قائمة الأصدقاء'));doc.head.appendChild(script);}).catch(error=>{socialLoader=null;throw error;});return socialLoader;}
  let inviteOpening=false;
  async function openInvite(){
    if(inviteOpening)return;inviteOpening=true;
    try{doc.dispatchEvent(new Event('bs-ui-overlay'));const social=await loadSocial(),data=inviteData();doc.getElementById('bsInvitePanel')?.remove();await social.openInvitePicker({game:data.game,roomCode:data.code,variant:data.variant,title:data.title,roundClosed:data.roundClosed,share:()=>{doc.getElementById('bsInviteFriendsModal')?.classList.remove('open');openShareMenu();}});}
    catch(error){root.BS_PLATFORM?.toast?.(error.message||'تعذر فتح الأصدقاء؛ تقدر تشارك الرابط');openShareMenu();}
    finally{inviteOpening=false;}
  }
  function openShareMenu(){
    if(doc.getElementById('bsInvitePanel'))return;const source=doc.activeElement,data=inviteData(),shade=doc.createElement('div'),card=doc.createElement('section');shade.id='bsInvitePanel';shade.className='bs-invite-shade';card.className='bs-invite-card';card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-labelledby','bsInviteTitle');
    const icon=doc.createElement('span');icon.className='bs-invite-icon';icon.textContent='♟+';const title=doc.createElement('h2');title.id='bsInviteTitle';title.textContent=data.joinable?'ادعُ صديقك إلى الغرفة':'تحدَّ صديقًا الآن';const note=doc.createElement('p');note.textContent=data.joinable?`الغرفة ${data.code} جاهزة. أرسل دعوة من حسابك أو شاركها مباشرة.`:`إذا بدأت المباراة فلا يمكن الانضمام إلى الجولة الجارية. ستصل دعوة لتحدٍّ جديد في ${data.title}، أو شارك رابط اللعبة.`;card.append(icon,title,note);
    const close=()=>{shade.remove();source?.focus?.();};const button=(label,className,action)=>{const b=doc.createElement('button');b.type='button';b.className=className;b.textContent=label;b.onclick=action;card.appendChild(b);return b;};let sending=false;
    button('اختر صديقًا من حسابي','bs-invite-friends',async event=>{if(sending)return;sending=true;event.currentTarget.disabled=true;note.textContent='نجهّز قائمة أصدقائك…';try{const social=await loadSocial();if(!social.isLoggedIn?.()){location.href='/social?auth=1&next='+encodeURIComponent(location.pathname+location.search);return;}close();await social.openInvitePicker({game:data.game,roomCode:data.code,variant:data.variant,title:data.title,roundClosed:data.roundClosed});}catch(error){note.textContent=error.message||'تعذر فتح قائمة الأصدقاء';sending=false;event.currentTarget.disabled=false;}});
    const fallback=()=>{let input=card.querySelector('input');if(!input){input=doc.createElement('input');input.readOnly=true;input.setAttribute('aria-label','رابط الدعوة');card.appendChild(input);}input.value=data.url;input.focus();input.select?.();note.textContent='الرابط جاهز. انسخه وأرسله لصديقك.';};const copy=async()=>{try{await navigator.clipboard.writeText(data.url);note.textContent='تم نسخ الدعوة ✓';}catch{fallback();}};
    button('مشاركة عبر واتساب والتطبيقات','bs-invite-share',async()=>{try{if(navigator.share){await navigator.share({title:data.title,text:data.joinable?`تعال نلعب في الغرفة ${data.code}`:`أتحداك في ${data.title}`,url:data.url});close();}else await copy();}catch(error){if(error?.name!=='AbortError')fallback();}});button('نسخ الرابط','bs-invite-copy',copy);const done=button('إغلاق','bs-invite-close',close);shade.appendChild(card);effectHost().appendChild(shade);shade.onclick=event=>{if(event.target===shade)close();};shade.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}if(event.key!=='Tab')return;const controls=[...card.querySelectorAll('button,input')].filter(item=>!item.disabled),first=controls[0],last=controls.at(-1);if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first.focus();}});done.focus();doc.dispatchEvent(new Event('bs-ui-overlay'));
  }
  root.BS_INVITES=Object.freeze({open:openInvite,share:openShareMenu,data:inviteData,set:value=>{context=value;updateCommand();}});
  function back(){const sameOrigin=(()=>{try{return doc.referrer&&new URL(doc.referrer).origin===location.origin;}catch{return false;}})();if(sameOrigin&&history.length>1)history.back();else location.href=route==='sudoku'||route==='paths-online'?'/journey':route==='picture'||route==='online'||route==='local'?'/quiz':'/';}
  function updateCommand(){const bar=doc.getElementById('bsGameCommand');if(!bar)return;const data=inviteData(),invite=bar.querySelector('[data-command-invite]'),status=bar.querySelector('[data-command-status]');invite.textContent='دعوة صديق';invite.setAttribute('aria-label','دعوة صديق لهذه اللعبة');invite.classList.toggle('is-live',data.joinable);status.textContent=data.joinable?`غرفة ${data.code}`:data.roundClosed?'الجولة بدأت · تحدٍ جديد':'جاهز للتحدي';}
  function mountCommand(){
    if(!gameRoutes.has(route)||doc.getElementById('bsGameCommand'))return;doc.body.classList.add('bs-ui-v25');const bar=doc.createElement('nav');bar.id='bsGameCommand';bar.className='bs-game-command';bar.setAttribute('aria-label','أدوات اللعبة');
    const start=doc.createElement('div');start.className='bs-command-start';const backButton=doc.createElement('button');backButton.type='button';backButton.className='bs-command-back';backButton.innerHTML='<span aria-hidden="true">→</span><b>رجوع</b>';backButton.onclick=back;const home=doc.createElement('a');home.href='/';home.className='bs-command-home';home.setAttribute('aria-label','كل الألعاب');home.textContent='⌂';start.append(backButton,home);
    const identity=doc.createElement('div');identity.className='bs-command-identity';const mark=doc.createElement('span');mark.textContent='BS';const copy=doc.createElement('div'),title=doc.createElement('b'),status=doc.createElement('small');title.textContent=titles[route]||'تحدي العباقرة';status.dataset.commandStatus='';copy.append(title,status);identity.append(mark,copy);const invite=doc.createElement('button');invite.type='button';invite.className='bs-command-invite';invite.dataset.commandInvite='';invite.onclick=openInvite;bar.append(start,identity,invite);doc.body.prepend(bar);
    const header=doc.querySelector('.bs-topbar,.serpent-nav,.picture-header');
    if(header){const utilities=doc.createElement('div');utilities.className='v26-command-utilities';for(const control of header.querySelectorAll('button,.coin-chip')){if(control.getAttribute('data-audio-toggle')!==null)control.setAttribute('aria-label','تبديل الصوت');if(control.getAttribute('data-settings-open')!==null)control.setAttribute('aria-label','إعدادات اللعب');utilities.appendChild(control);}bar.appendChild(utilities);header.classList.add('v26-replaced-header');}
    updateCommand();
  }
  function observeFeedback(){
    if(typeof root.MutationObserver!=='function'||typeof root.Element!=='function')return;
    const seen=new WeakMap(),winnerSeen=new WeakMap();let resultSequence=0;
    const inspect=node=>{
      if(!(node instanceof root.Element))return;
      if(node.id==='winnerOverlay'||node.classList.contains('winner-overlay')){
        if(!node.classList.contains('show')){winnerSeen.delete(node);return;}
        const raw=node.querySelector('#winnerName,#winner,.winner')?.textContent?.trim();
        if(raw&&winnerSeen.get(node)!==raw){winnerSeen.set(node,raw);celebrate(raw.replace(/^[^\p{L}\p{N}]+/u,''),{key:route+':board-result:'+ ++resultSequence});}
        return;
      }
      const now=Date.now(),prior=seen.get(node)||0;if(now-prior<900)return;
      if(node.matches('.choice.correct,.correct-answer,.is-correct')||node.classList.contains('right')){seen.set(node,now);cell(node,'right');}
      else if(node.matches('.choice.wrong,.wrong-answer,.is-wrong')){seen.set(node,now);cell(node,'wrong');}
    };
    const observer=new root.MutationObserver(records=>{for(const record of records){inspect(record.target);for(const node of record.addedNodes)inspect(node);}});
    observer.observe(doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
  }
  mountCommand();observeFeedback();
})();
