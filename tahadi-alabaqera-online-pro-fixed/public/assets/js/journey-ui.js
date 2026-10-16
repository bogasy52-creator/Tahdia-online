import {STAGE_COUNT,CHAPTERS,COLORS,dayKey,createJewels,createPaths,moveJewels,movePaths,clearPath,hintPaths,jewelPaths,adjacent,starsFor,nextStage} from './engines/journey-engine.js?v=17.0.0';
import * as progress from './journey-client.js?v=17.0.0';
import {drawBoard} from './journey-renderer.js?v=17.0.0';
const $ = id => document.getElementById(id), params = new URLSearchParams(location.search), names = {jewels:'وصل الجواهر',paths:'مسارات الألوان'};
let game = params.get('game') === 'paths' ? 'paths' : 'jewels', chapter = Math.floor((nextStage(progress.get(),game)-1)/12), state = null, selected = [], pointer = null, cursor = 0, saving = false, lastDaily = progress.today(), initialAccount = '', roundVersion = 0;
const targetNames=['المربّع الأخضر','المثلّث الذهبي','النجمة البنفسجية','الدائرة الوردية','المعيّن الأزرق','السداسي الأصفر'];
const play = $('journeyPlay'), canvas = $('stageCanvas'), now = () => window.BS_CAREER?.now?.() || Date.now();
const key = () => 'tahdia-stage-resume-v17:' + (window.BS_CAREER?.account?.() || 'guest') + ':' + game;
const message = text => { $('stageMessage').textContent = text; };
function storeResume() { if(!state || state.won || state.over)return; try { localStorage.setItem(key(),JSON.stringify({game:state.game,level:state.level,daily:state.daily,log:state.log})); } catch { message('مساحة الجهاز ممتلئة. اترك الجولة مفتوحة إلى أن تنتهي.'); } }
function removeResume() { try { localStorage.removeItem(key()); } catch {} }
function draw() { let display=state;if(state?.game==='paths'&&selected.length){const color=state.pairs.findIndex(pair=>pair.includes(selected[0]));display={...state,paths:{...state.paths}};delete display.paths[color];}drawBoard(canvas,display,selected); }
function render() {
  const p=progress.get(),stats=progress.stats(),day=progress.today();
  $('journeyMilestoneCopy').textContent=stats.stars<30?'باقي '+(30-stats.stars)+' نجمة وتفتح لقب صائد النجوم':stats.stars<120?'فتحت صائد النجوم · باقي '+(120-stats.stars)+' نجمة للقب سيّد المسارات':'✓ فتحت لقبي صائد النجوم وسيّد المسارات · جهّز لقبك في المتجر';
  $('journeyStars').textContent=stats.stars;$('journeyCompleted').textContent=stats.completed+' / 120';$('journeyStreak').textContent=stats.streak;
  $('dailyDate').textContent=new Intl.DateTimeFormat('ar-SA',{weekday:'long',day:'numeric',month:'long',calendar:'gregory',timeZone:'Asia/Riyadh'}).format(new Date(now()));
  $('dailyJewelsStatus').textContent=p.daily[day]?.jewels?'✓ اكتمل · '+p.daily[day].jewels+' نجوم · تقدر تحسّنها':'وصّل واجمع الهدف · لوحة اليوم للجميع';
  $('dailyPathsStatus').textContent=p.daily[day]?.paths?'✓ اكتمل · '+p.daily[day].paths+' نجوم · تقدر تحسّنها':'وصّل كل الأزواج وغطّ اللوحة';
  const week=$('journeyWeek');week.replaceChildren();for(let i=6;i>=0;i--){const date=dayKey(now()-i*86400000),done=Object.keys(p.daily[date]||{}).length,el=document.createElement('span');el.className=done?'done':'';el.textContent=done?'✦':i===0?'اليوم':new Intl.DateTimeFormat('ar-SA',{weekday:'short',timeZone:'Asia/Riyadh'}).format(new Date(now()-i*86400000));el.title=date+' · '+done+' / 2';if(i===0)el.setAttribute('aria-current','date');week.appendChild(el);}
  for(const id of Object.keys(names))$(id+'Progress').textContent=Object.keys(p.stages[id]).length+' / 60 مرحلة';
  document.querySelectorAll('[data-game]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.game===game)));
  $('chapterNumber').textContent='العالم '+(chapter+1)+' / 5';$('chapterTitle').textContent=CHAPTERS[chapter];
  const chapters=$('journeyChapters');chapters.replaceChildren();CHAPTERS.forEach((name,i)=>{const button=document.createElement('button');button.textContent=(i+1)+' · '+name;button.disabled=i>Math.floor((nextStage(p,game)-1)/12);button.setAttribute('aria-pressed',String(i===chapter));button.onclick=()=>{chapter=i;render();};chapters.appendChild(button);});
  const map=$('journeyMap');map.replaceChildren();for(let level=chapter*12+1;level<=chapter*12+12;level++){const button=document.createElement('button'),stars=p.stages[game][level]||0,locked=level>nextStage(p,game);button.className='journey-stage'+(stars?' complete':'')+(level===nextStage(p,game)?' current':'');button.disabled=locked;button.innerHTML='<span class="stage-number"></span><span class="stage-node-stars" aria-hidden="true"></span>';button.firstChild.textContent=locked?'⌑':level;button.lastChild.textContent=stars?'★'.repeat(stars)+'☆'.repeat(3-stars):'☆☆☆';button.setAttribute('aria-label','المرحلة '+level+(locked?' مغلقة':stars?'، '+stars+' نجوم':'، متاحة'));button.onclick=()=>openStage(level);map.appendChild(button);}
  $('journeyContinue').textContent='كمّل المرحلة '+nextStage(p,game)+' ←';
  $('journeyGuide').textContent=game==='jewels'?'وصّل 3 جواهر متجاورة أو أكثر من اللون نفسه. سلسلة من 7 تفجّر صفًا كاملًا.':'وصّل الدوائر ذات الرقم نفسه، بدون تقاطع. لازم المسارات تغطي كل مربعات اللوحة.';
  $('journeySaveStatus').textContent=window.BS_CAREER?.account?.()?(progress.pendingCount()?'محفوظ على الجهاز · '+progress.pendingCount()+' نتائج تنتظر المزامنة':'محفوظ في حسابك وعلى هذا الجهاز'):'محفوظ على هذا الجهاز · سجّل دخولك للمزامنة';
}
function meters() {
  if(!state)return;
  if(game==='jewels'){$('meterOneLabel').textContent='الحركات المتبقية';$('stageMoves').textContent=state.limit-state.moves;$('meterTwoLabel').textContent='اجمع الجواهر';$('stageGoal').textContent=Math.min(state.collected,state.goal)+' / '+state.goal;$('meterThreeLabel').textContent=targetNames[state.targetColor];$('stageColor').textContent=Math.min(state.colorCount,state.colorGoal)+' / '+state.colorGoal;$('stageColor').style.color=COLORS[state.targetColor];}
  else{$('meterOneLabel').textContent='مسارات مكتملة';$('stageMoves').textContent=Object.keys(state.paths).length+' / '+state.pairs.length;$('meterTwoLabel').textContent='تغطية اللوحة';$('stageGoal').textContent=Math.round(new Set(Object.values(state.paths).flat()).size/(state.size*state.size)*100)+'%';$('meterThreeLabel').textContent='التلميحات';$('stageColor').textContent=state.hints+' / 3';$('stageColor').style.color='';}
  $('stageCommit').textContent=game==='jewels'&&selected.length>=3?'وصّل '+selected.length+' جواهر':game==='paths'&&selected.length>=2?'ثبّت المسار':'تأكيد التوصيل';
  $('stageCommit').disabled=game==='jewels'?selected.length<3:selected.length<2;$('stageHint').disabled=state.over||state.won||(game==='paths'&&state.hints>=3);
}
function restore(proof) {
  let value=proof.game==='jewels'?createJewels(proof.level,proof.daily||''):createPaths(proof.level,proof.daily||'');
  if(!Array.isArray(proof.log)||proof.log.length>180)return null;
  for(const row of proof.log){if(value.over||value.won)return null;const result=proof.game==='jewels'?moveJewels(value,row):Number.isInteger(row?.clear)?{state:clearPath(value,row.clear),accepted:true}:row?.hint?hintPaths(value):movePaths(value,row?.color,row?.path);if(!result.accepted)return null;value=result.state;}
  return value;
}
function openStage(level,daily='',resume=true) {
  roundVersion++;selected=[];pointer=null;cursor=0;saving=false;initialAccount=window.BS_CAREER?.account?.()||'guest';
  state=game==='jewels'?createJewels(level,daily):createPaths(level,daily);
  let resumed=false;if(resume)try{const saved=JSON.parse(localStorage.getItem(key())||'null');if(saved?.level===level&&saved?.daily===daily&&saved.game===game){const value=restore(saved);if(value){state=value;resumed=true;}}}catch{}
  $('stageGameName').textContent=names[game];$('stageTitle').textContent=daily?'تحدّي اليوم':'المرحلة '+level+' · '+CHAPTERS[Math.floor((level-1)/12)];
  $('stageTipTitle').textContent=game==='jewels'?'السلسلة الأطول، فرصتك الأكبر.':'كل مربع له مكان في الحل.';
  $('stageInstructions').textContent=game==='jewels'?'اسحب بين جواهر اللون نفسه. التوصيل أفقي أو رأسي أو قطري. حقق هدف المجموع واللون الخاص خلال 20 حركة. سلسلة 7 أو أكثر تمسح صفًا وتحتسب جواهره.':'ابدأ من دائرة، ثم اسحب إلى الدائرة ذات الرقم نفسه. الحركة أفقية أو رأسية. المسارات ما تتقاطع، والنجاح يحتاج توصيل كل الأزواج وتغطية اللوحة كاملة. ارسم اللون من جديد لتغيير مساره.';
  $('stageStarGuide').textContent=game==='jewels'?'3 نجوم خلال 10 حركات، نجمتان خلال 15، ونجمة عند إكمال الهدف خلال 20.':'3 نجوم دون تلميح وبحركتين إضافيتين كحد أقصى. نجمتان بتلميح واحد كحد أقصى. التلميح يرسم مسارًا وقد يزيل مسارات تتقاطع معه.';
  $('stageHelpText').textContent=$('stageInstructions').textContent+' على الكمبيوتر: الأسهم لتحريك المؤشر، المسافة للاختيار، Enter لتأكيد المسار، وEscape لإلغاء التحديد.';
  $('stageResult').classList.add('hidden');$('stageHelpPanel').classList.add('hidden');$('stageCommit').textContent='تأكيد التوصيل';
  message(resumed?'رجعنا لنفس اللوحة. كمّل من آخر حركة.':game==='jewels'?'راقب اللون المطلوب قبل أول حركة.':'ابدأ بالأزواج القريبة، واترك ممرًا للبقية.');
  $('stageClose').disabled=false;$('stageHelp').disabled=false;document.querySelector('.stage-workspace').inert=false;document.querySelector('.stage-topbar').inert=false;
  if(!play.open)play.showModal();meters();draw();storeResume();canvas.focus();
}
function closeStage(){if(saving)return;storeResume();play.close();chapter=Math.floor((nextStage(progress.get(),game)-1)/12);render();$('journeyContinue').focus();}
function sound(name){window.BS_AUDIO?.play?.(name);}
async function finish() {
  if(saving)return;const version=roundVersion;saving=true;selected=[];draw();meters();const won=state.won;
  document.querySelector('.stage-workspace').inert=true;$('stageHelp').disabled=true;$('stageClose').disabled=true;
  $('stageResult').classList.remove('hidden');$('resultEyebrow').textContent=state.daily?'تحدّي اليوم':CHAPTERS[state.chapter];$('resultStars').textContent=won?'★'.repeat(starsFor(state))+'☆'.repeat(3-starsFor(state)):'✧';
  $('resultTitle').textContent=won?'خطوة تستاهل نجمة.':'قريب من الهدف!';$('resultCopy').textContent=won?(game==='jewels'?state.score+' نقطة · '+state.moves+' حركات':state.moves+' مسارات مرسومة · تغطية كاملة'):'جرّب سلسلة أطول، وابدأ باللون الخاص. تقدر تعيد المرحلة فورًا.';
  $('resultSave').textContent=won?'جارٍ حفظ نتيجتك…':'إعادة المحاولة متاحة بدون انتظار.';$('resultNext').classList.toggle('hidden',!won||!!state.daily||state.level>=STAGE_COUNT);$('resultRetry').textContent=won?'أعدها وحسّن نجومك':'حاول مرة ثانية';$('resultRetry').disabled=true;$('resultNext').disabled=true;$('resultMap').disabled=true;
  if(won){sound('win');try{const result=await progress.complete({game,level:state.level,daily:state.daily,log:state.log});if(version!==roundVersion)return;removeResume();$('resultSave').textContent=result.pending?'انحفظت نجومك على الجهاز. المزامنة مع الحساب جارية وتُعاد عند رجوع الاتصال.':result.first?'انحفظت نجومك. مكافآت الجولة حسب حد التدريب اليومي.':'تحسّنت نجومك. مكافأة هذه المرحلة محسوبة سابقًا.';}catch(error){if(version!==roundVersion)return;$('resultSave').textContent='لم يُحفظ التقدم: '+error.message;$('resultRetry').textContent='أعد محاولة حفظ النتيجة';saving=false;$('stageClose').disabled=false;$('resultRetry').disabled=false;$('resultRetry').onclick=()=>finish();return;}}else removeResume();
  if(version!==roundVersion)return;saving=false;$('stageClose').disabled=false;$('resultRetry').disabled=false;$('resultNext').disabled=false;$('resultMap').disabled=false;$('resultRetry').onclick=()=>openStage(state.level,state.daily,false);(won&&!state.daily&&state.level<STAGE_COUNT?$('resultNext'):$('resultRetry')).focus();render();
}
function commit() {
  if(!state||state.won||state.over||saving)return;
  const result=game==='jewels'?moveJewels(state,selected):movePaths(state,state.pairs.findIndex(pair=>pair.includes(selected[0])),selected);
  if(!result.accepted){message(game==='jewels'?'وصّل 3 جواهر متجاورة من اللون نفسه.':'المسار يحتاج ينتهي عند الدائرة الثانية من نفس الرقم.');return;}
  state=result.state;selected=[];sound('move');const bubble=$('stageCelebration'),effectVersion=roundVersion;bubble.textContent=game==='jewels'?(result.bonus?'سلسلة قوية! ✦':'+ '+result.cleared.length+' جواهر'):'مسار اكتمل ✓';bubble.classList.remove('active');void bubble.offsetWidth;bubble.classList.add('active');setTimeout(()=>{if(effectVersion===roundVersion)bubble.classList.remove('active');},650);message(game==='jewels'?(result.bonus?'سلسلة قوية! انمسح الصف كاملًا.':'حركة موفقة. تابع هدف اللون الخاص.'):(state.won?'تغطية كاملة!':Object.keys(state.paths).length===state.pairs.length?'كل الأزواج متصلة. عدّل المسارات لتغطي الخانات المتبقية.':'مسار اكتمل. كمل بقية الألوان.'));storeResume();meters();draw();if(state.won||state.over)finish();
}
function select(cell,start=false) {
  if(!state||state.won||state.over||saving||cell<0||cell>=state.size*state.size)return;
  cursor=cell;
  if(game==='jewels'){
    const last=selected.at(-1),index=selected.indexOf(cell);
    if(index>=0)selected=selected.slice(0,index+1);
    else if(!selected.length||start&&(!adjacent(last,cell,state.size,true)||state.board[last]!==state.board[cell]))selected=[cell];
    else if(adjacent(last,cell,state.size,true)&&state.board[last]===state.board[cell])selected.push(cell);
  }else{
    if(start){const color=state.pairs.findIndex(pair=>pair.includes(cell)),closing=color>=0&&selected.length>1&&state.pairs[color].includes(selected[0])&&cell!==selected[0]&&adjacent(selected.at(-1),cell,state.size);if(color>=0&&!closing)selected=[cell];else if(!selected.length)return;}
    if(!selected.length)return;
    const color=state.pairs.findIndex(pair=>pair.includes(selected[0])),index=selected.indexOf(cell),blocked=new Set(Object.entries(state.paths).filter(([key])=>Number(key)!==color).flatMap(([,path])=>path));
    if(index>=0)selected=selected.slice(0,index+1);
    // An endpoint may start a path; the opposite endpoint ends it.
    if(index<0&&selected.length&&adjacent(selected.at(-1),cell,state.size)&&!blocked.has(cell)&&!state.pairs.some((pair,i)=>i!==color&&pair.includes(cell))&&(selected.length===1||!state.pairs[color].includes(selected.at(-1))))selected.push(cell);
  }
  meters();draw();
}
function cellAt(event){const r=canvas.getBoundingClientRect(),x=event.clientX-r.left,y=event.clientY-r.top;if(x<0||y<0||x>=r.width||y>=r.height)return -1;return Math.floor(y/r.height*state.size)*state.size+Math.floor(x/r.width*state.size);}
canvas.addEventListener('pointerdown',event=>{if(pointer!==null||saving||event.button>0)return;pointer=event.pointerId;canvas.setPointerCapture(pointer);select(cellAt(event),true);});
canvas.addEventListener('pointermove',event=>{if(event.pointerId!==pointer)return;const samples=event.getCoalescedEvents?.();for(const sample of samples?.length?samples:[event])select(cellAt(sample));});
canvas.addEventListener('pointerup',event=>{if(event.pointerId!==pointer)return;select(cellAt(event));pointer=null;if(game==='jewels'&&selected.length>=3||game==='paths'&&selected.length>=2&&state.pairs.some(pair=>pair.includes(selected[0])&&pair.includes(selected.at(-1))))commit();});
canvas.addEventListener('pointercancel',()=>{pointer=null;selected=[];meters();draw();});
canvas.addEventListener('keydown',event=>{if(!state||saving)return;const arrows={ArrowLeft:-1,ArrowRight:1,ArrowUp:-state.size,ArrowDown:state.size};if(Object.hasOwn(arrows,event.key)){event.preventDefault();const next=cursor+arrows[event.key];if(adjacent(cursor,next,state.size)){cursor=next;if(event.shiftKey)select(cursor);drawBoard(canvas,state,selected,{hover:cursor});}}else if(event.key===' '){event.preventDefault();select(cursor,selected.length===0);}else if(event.key==='Enter'){event.preventDefault();commit();}else if(event.key==='Escape'&&selected.length){event.preventDefault();event.stopPropagation();selected=[];meters();draw();}});
$('stageCommit').onclick=commit;$('stageClose').onclick=closeStage;$('resultMap').onclick=closeStage;
$('stageRestart').onclick=()=>{if(saving)return;$('stageHelpPanel').classList.remove('hidden');$('stageHelpText').textContent='تبدأ لوحة هذه المرحلة من جديد. تقدم المراحل السابقة ونجومك محفوظة.';$('stageHelpClose').textContent='ابدأ من جديد';$('stageHelpClose').onclick=()=>openStage(state.level,state.daily,false);$('stageHelpClose').focus();};
$('stageHelp').onclick=()=>{$('stageHelpPanel').classList.remove('hidden');$('stageHelpText').textContent=$('stageInstructions').textContent+' لوحة المفاتيح: الأسهم للتنقل، المسافة للاختيار، Enter للتأكيد. اضغط Shift مع الأسهم لمد المسار.';$('stageHelpClose').textContent='فهمت، نلعب ←';$('stageHelpClose').onclick=()=>{$('stageHelpPanel').classList.add('hidden');canvas.focus();};$('stageHelpClose').focus();};
$('stageHint').onclick=()=>{if(saving||!state)return;if(game==='jewels'){const choices=jewelPaths(state),path=choices.find(row=>state.board[row[0]]===state.targetColor)||choices[0];selected=path||[];message('هذا توصيل ممكن. اسحبه لتزيد السلسلة، أو أكّده.');meters();draw();}else{const result=hintPaths(state);if(!result.accepted)return;state=result.state;selected=[];message('رسمنا مسارًا. المسارات المتقاطعة معه أُزيلت؛ كمّل البقية.');storeResume();meters();draw();if(state.won)finish();}};
$('resultNext').onclick=()=>openStage(Math.min(STAGE_COUNT,state.level+1),'',false);$('resultRetry').onclick=()=>openStage(state.level,state.daily,false);
$('journeyContinue').onclick=()=>openStage(nextStage(progress.get(),game));
document.querySelectorAll('[data-game]').forEach(button=>button.onclick=()=>{game=button.dataset.game;chapter=Math.floor((nextStage(progress.get(),game)-1)/12);history.replaceState(null,'','/journey?game='+game);render();});
document.querySelectorAll('[data-daily]').forEach(button=>button.onclick=()=>{game=button.dataset.daily;openStage(1,progress.today());});
play.addEventListener('cancel',event=>{event.preventDefault();if(!$('stageHelpPanel').classList.contains('hidden')){$('stageHelpPanel').classList.add('hidden');canvas.focus();}else closeStage();});
window.addEventListener('tahdia-journey-change',render);window.addEventListener('bs-career-change',render);
window.addEventListener('bs-social-session',()=>{if(play.open&&(window.BS_CAREER?.account?.()||'guest')!==initialAccount){roundVersion++;saving=false;state=null;play.close();}render();});
window.addEventListener('pagehide',storeResume);document.addEventListener('visibilitychange',()=>{if(document.hidden)storeResume();else{render();countdown();}});
function countdown(){const date=new Date(now()+10800000),seconds=86400-(date.getUTCHours()*3600+date.getUTCMinutes()*60+date.getUTCSeconds());$('dailyCountdown').textContent=[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');if(lastDaily!==progress.today()){lastDaily=progress.today();render();}}
render();countdown();setInterval(countdown,1000);progress.ready.then(render);
if(params.get('daily')==='1')openStage(1,progress.today());
