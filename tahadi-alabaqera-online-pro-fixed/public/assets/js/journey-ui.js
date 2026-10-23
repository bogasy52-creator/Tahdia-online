import {STAGE_COUNT,CHAPTERS,stageCount,totalStageCount,chaptersFor,restorePaths,restartPaths,COLORS,dayKey,createPaths,movePaths,clearPath,hintPaths,adjacent,starsFor,nextStage} from './engines/journey-engine.js?v=29.1.0';
import {createMatch3,moveMatch3,restoreMatch3,legalSwaps,BOOST_COST,MATCH3_VERSION} from './engines/match3-engine.js?v=29.1.0';
import * as progress from './journey-client.js?v=29.1.0';
import {BoardRenderer} from './match3-renderer.js?v=29.1.0';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),names={jewels:'ماستر الجواهر',paths:'مسارات الألوان'};
const play=$('journeyPlay'),canvas=$('stageCanvas'),workspace=document.querySelector('.stage-workspace'),topbar=document.querySelector('.stage-topbar');
let game=params.get('game')==='paths'?'paths':'jewels',chapter=Math.floor((nextStage(progress.get(),game)-1)/12),state=null,selected=[],pointer=null,cursor=0,saving=false,busy=false,boosting=false,lastDaily=progress.today(),initialAccount='',roundVersion=0,resumeTimer=0,hubDirty=false,dragStart=-1,lastCell=-1,dragMoved=false,pathGestureMoved=false,blocked=new Set(),endpoints=new Set();
const now=()=>window.BS_CAREER?.now?.()||Date.now(),account=()=>window.BS_CAREER?.account?.()||'guest';
const renderer=new BoardRenderer(canvas,{reduced:()=>!!$('stageFast').checked||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches});
try{$('stageFast').checked=localStorage.getItem('tahdia-quick-motion')==='1';}catch{}
$('stageFast').onchange=()=>{try{localStorage.setItem('tahdia-quick-motion',$('stageFast').checked?'1':'0');}catch{}if(busy)renderer.snap();};
const key=()=> 'tahdia-stage-resume-v17:'+account()+':'+game;
const message=text=>{$('stageMessage').textContent=text;};
const text=(id,value)=>{const el=$(id),next=String(value);if(el.textContent!==next)el.textContent=next;};
const sound=name=>window.BS_AUDIO?.play?.(name);
const proof=()=>({game:state.game,level:state.level,daily:state.daily,...(state.engineVersion?{engineVersion:state.engineVersion}:{}),log:state.log});
function storeResume(){clearTimeout(resumeTimer);resumeTimer=0;if(!state||account()!==initialAccount)return;try{localStorage.setItem(key(),JSON.stringify(proof()));}catch{message('مساحة الجهاز ممتلئة. اترك الجولة مفتوحة إلى أن تنتهي.');}}
function scheduleResume(){clearTimeout(resumeTimer);resumeTimer=setTimeout(storeResume,180);}
function removeResume(){clearTimeout(resumeTimer);resumeTimer=0;try{localStorage.removeItem(key());}catch{}}
function draw(){renderer.setState(state,selected,cursor);}
function render() {
  if(play.open){hubDirty=true;return;}hubDirty=false;
  const p=progress.get(),stats=progress.stats(),day=progress.today();
  $('journeyMilestoneCopy').textContent=stats.stars<30?'باقي '+(30-stats.stars)+' نجمة وتفتح لقب صائد النجوم':stats.stars<120?'فتحت صائد النجوم · باقي '+(120-stats.stars)+' نجمة للقب سيّد المسارات':'✓ فتحت لقبي صائد النجوم وسيّد المسارات · جهّز لقبك في المتجر';
  $('journeyStars').textContent=stats.stars;$('journeyCompleted').textContent=stats.completed+' / '+totalStageCount();$('journeyStreak').textContent=stats.streak;
  $('dailyDate').textContent=new Intl.DateTimeFormat('ar-SA',{weekday:'long',day:'numeric',month:'long',calendar:'gregory',timeZone:'Asia/Riyadh'}).format(new Date(now()));
  $('dailyJewelsStatus').textContent=p.daily[day]?.jewels?'✓ اكتمل · '+p.daily[day].jewels+' نجوم · تقدر تحسّنها':'بدّل وطابق واجمع الهدف · لوحة اليوم للجميع';
  $('sudokuCampaignProgress').textContent=Object.keys(p.stages.sudoku).length+' / 120 مرحلة';
  $('dailySudokuStatus').textContent=p.daily[day]?.sudoku?'✓ اكتمل · '+p.daily[day].sudoku+' نجوم':'لغز يتجدد يوميًا · حل واحد';
  $('dailyPathsStatus').textContent=p.daily[day]?.paths?'✓ اكتمل · '+p.daily[day].paths+' نجوم · تقدر تحسّنها':'وصّل كل الأزواج وغطّ اللوحة';
  const week=$('journeyWeek');week.replaceChildren();for(let i=6;i>=0;i--){const date=dayKey(now()-i*86400000),done=Object.keys(p.daily[date]||{}).length,el=document.createElement('span');el.className=done?'done':'';el.textContent=done?'✦':i===0?'اليوم':new Intl.DateTimeFormat('ar-SA',{weekday:'short',timeZone:'Asia/Riyadh'}).format(new Date(now()-i*86400000));el.title=date+' · '+done+' / 3';if(i===0)el.setAttribute('aria-current','date');week.appendChild(el);}
  for(const id of Object.keys(names))$(id+'Progress').textContent=Object.keys(p.stages[id]).length+' / '+stageCount(id)+' مرحلة';
  document.querySelectorAll('[data-game]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.game===game)));
  const chapterNames=chaptersFor(game);chapter=Math.min(chapter,chapterNames.length-1);$('chapterNumber').textContent='العالم '+(chapter+1)+' / '+chapterNames.length;$('chapterTitle').textContent=chapterNames[chapter];
  const chapters=$('journeyChapters');chapters.replaceChildren();chapterNames.forEach((name,i)=>{const button=document.createElement('button');button.textContent=(i+1)+' · '+name;button.disabled=i>Math.floor((nextStage(p,game)-1)/12);button.setAttribute('aria-pressed',String(i===chapter));button.onclick=()=>{chapter=i;render();};chapters.appendChild(button);});
  const map=$('journeyMap');map.replaceChildren();for(let level=chapter*12+1;level<=chapter*12+12;level++){const button=document.createElement('button'),stars=p.stages[game][level]||0,locked=level>nextStage(p,game);button.className='journey-stage'+(stars?' complete':'')+(level===nextStage(p,game)?' current':'');button.disabled=locked;button.innerHTML='<span class="stage-number"></span><span class="stage-node-stars" aria-hidden="true"></span>';button.firstChild.textContent=locked?'⌑':level;button.lastChild.textContent=stars?'★'.repeat(stars)+'☆'.repeat(3-stars):'☆☆☆';button.setAttribute('aria-label','المرحلة '+level+(locked?' مغلقة':stars?'، '+stars+' نجوم':'، متاحة'));button.onclick=()=>openStage(level);map.appendChild(button);}
  $('journeyContinue').textContent='كمّل المرحلة '+nextStage(p,game)+' ←';
  $('journeyGuide').textContent=game==='jewels'?'بدّل جوهرتين متجاورتين. طابق 3 أو أكثر؛ أربع تصنع سهمًا وخمس تصنع برقًا، وT أو L تصنع قنبلة.':'خطأ واحد يعيد المرحلة. وصّل الأرقام المتماثلة، وغطّ كل المربعات المتاحة. المراحل المتقدمة فيها حواجز ونقاط عبور.';
  $('journeySaveStatus').textContent=window.BS_CAREER?.account?.()?(progress.pendingCount()?'محفوظ على الجهاز · '+progress.pendingCount()+' نتائج تنتظر المزامنة':'محفوظ في حسابك وعلى هذا الجهاز'):'محفوظ على هذا الجهاز · سجّل دخولك للمزامنة';
}
function meters(){
  if(!state)return;
  const jewel=game==='jewels';
  text('meterOneLabel',jewel?'الحركات المتبقية':'مسارات مكتملة');text('stageMoves',jewel?state.limit-state.moves:Object.keys(state.paths).length+' / '+state.pairs.length);
  text('meterTwoLabel',jewel?'الجواهر المطلوبة':'تغطية اللوحة');text('stageGoal',jewel?Math.min(state.collected,state.goal)+' / '+state.goal:Math.round(new Set(Object.values(state.paths).flat()).size/((state.size*state.size-(state.walls?.length||0)))*100)+'%');
  text('meterThreeLabel',jewel?(state.iceGoal?'كسر الجليد':'النجوم الزرقاء'):'الإعادات');text('stageColor',jewel?(state.iceGoal?state.iceCleared+' / '+state.iceGoal:Math.min(state.colorCount,state.colorGoal)+' / '+state.colorGoal):state.restarts||0);
  text('stageScore',jewel?state.score:state.moves);text('stageScoreLabel',jewel?'نقطة':'حركة');
  $('stageBoosterWrap').classList.toggle('hidden',!jewel);$('stageCommit').classList.toggle('hidden',jewel);
  text('stageCommit','ثبّت المسار');text('stageHint',game==='paths'?'تلميح '+state.hints+' / 3':'تلميح');$('stageCommit').disabled=busy||selected.length<2;
  $('stageHint').disabled=busy||saving||state.over||state.won||(!jewel&&state.hints>=3);
  $('stageBoost').disabled=busy||saving||state.over||state.won||state.charge<BOOST_COST||state.boosterUses>=10;
  text('stageBoost',boosting?'اختر خانة للإطلاق':state.charge>=BOOST_COST?'✦ المعزّز جاهز':'✦ '+(state.charge||0)+' / '+BOOST_COST);
  $('boosterFill').style.width=(jewel?Math.min(100,state.charge/BOOST_COST*100):0)+'%';
  text('stageBoostCopy',boosting?'اضغط على خانة: انفجار وصاعقة متقاطعة.':'هدف النجوم الزرقاء: '+Math.min(state.colorCount||0,state.colorGoal||0)+' / '+(state.colorGoal||0)+' · اجمعها لشحن المعزّز.');
  if(jewel){$('stageGoalFill').style.width=Math.min(100,state.collected/state.goal*100)+'%';$('stageMoves').classList.toggle('low',state.limit-state.moves<=5);}
  canvas.setAttribute('aria-busy',String(busy));
}
function restore(saved){
  if(saved.game==='jewels')return restoreMatch3(saved);
  return restorePaths(saved);
}
function openStage(level,daily='',resume=true){
  roundVersion++;renderer.cancel();selected=[];pointer=null;cursor=-1;saving=false;busy=false;boosting=false;initialAccount=account();
  state=game==='jewels'?createMatch3(level,daily):createPaths(level,daily);
  let resumed=false,upgraded=false;
  if(resume)try{const saved=JSON.parse(localStorage.getItem(key())||'null');if(saved?.level===level&&saved?.daily===daily&&saved.game===game){if(game==='jewels'&&saved.engineVersion!==MATCH3_VERSION||game==='paths'&&saved.engineVersion!==3)upgraded=true;else {state=restore(saved);resumed=true;}}}catch{}
  const jewel=game==='jewels';play.dataset.game=game;
  text('stageGameName',names[game]);text('stageTitle',daily?'تحدّي اليوم':'المرحلة '+level+' · '+chaptersFor(game)[Math.floor((level-1)/12)]);
  text('stageTipTitle',jewel?'كل تبديلة تصنع فرصة.':'خطأ واحد… وترجع للبداية.');
  text('stageInstructions',jewel?'بدّل جوهرتين متجاورتين بالسحب أو بنقرتين. طابق 3 أو أكثر أفقيًا أو رأسيًا. أربع تصنع سهمًا، وخمس في خط تصنع برقًا؛ شكل T أو L يصنع قنبلة. بدّل القطعة الخاصة لتفعيلها، أو ادمج قطعتين خاصتين. حقق أهداف المرحلة قبل انتهاء الحركات.':'ابدأ من دائرة واسحب إلى الرقم نفسه أفقيًا أو رأسيًا. التقاطع أو الرقم الخطأ أو رفع الإصبع في منتصف سحب ناقص يعيد كل لوحة المرحلة. غطّ المربعات المتاحة كلها وتجنب الحواجز؛ مرّ بنقاط العبور الصغيرة بلون مسارك. لمس خلية دون سحب لا يحتسب خطأ.');
  text('stageStarGuide',jewel?'3 نجوم خلال 12 حركة، نجمتان خلال 17، ونجمة عند إكمال الأهداف. مطابقة أربع أو أكثر بحركتك تمنح حركة إضافية، حتى 10 في الجولة. النجوم الزرقاء تشحن المعزّز. الجليد يظهر من العالم الثاني.':'3 نجوم بلا إعادة أو تلميح. نجمتان حتى إعادتين وتلميح واحد، ونجمة عند الإكمال. التلميحات ثلاثة للمرحلة وقد تزيل مسارات متقاطعة. النجوم السابقة محفوظة.');
  $('stageResult').classList.add('hidden');$('stageHelpPanel').classList.add('hidden');workspace.inert=false;topbar.inert=false;$('stageClose').disabled=false;$('stageHelp').disabled=false;
  message(resumed?'رجعنا لنفس اللوحة. كمّل من آخر حركة.':upgraded?'المحرك تغيّر: بدأنا لوحة التبديل الجديدة، ونجوم المراحل السابقة محفوظة.':jewel?'بدّل قطعتين وراقب التساقط. التبديلة غير المطابقة ترجع بدون خصم حركة.':'خطأ واحد يعيد اللوحة. ابدأ بدائرة ووصل الرقم نفسه.');
  canvas.setAttribute('aria-label',jewel?'لوحة مطابقة الجواهر. بدّل قطعتين متجاورتين بالسحب أو بنقرتين. الأسهم للتنقل والمسافة للاختيار.':'لوحة المسارات. اسحب بين الرقمين المتماثلين. الأسهم مع Shift لمد المسار.');
  if(!play.open)play.showModal();meters();draw();storeResume();canvas.focus();if(state.over||state.won)finish();
}
function closeStage(){if(saving)return;storeResume();roundVersion++;busy=false;renderer.cancel();play.close();chapter=Math.floor((nextStage(progress.get(),game)-1)/12);render();$('journeyContinue').focus();}
function help(textValue,action){
  if(saving)return;if(busy)renderer.snap();pointer=null;selected=[];boosting=false;draw();
  $('stageHelpPanel').classList.remove('hidden');text('stageHelpText',textValue);text('stageHelpClose',action?'ابدأ من جديد':'فهمت، نلعب ←');workspace.inert=true;topbar.inert=true;
  $('stageHelpClose').onclick=()=>{if(action){action();return;}$('stageHelpPanel').classList.add('hidden');workspace.inert=false;topbar.inert=false;meters();canvas.focus();};$('stageHelpClose').focus();
}
async function finish(){
  if(saving||!state)return;const version=roundVersion,won=state.won;saving=true;busy=false;selected=[];renderer.snap();draw();meters();workspace.inert=true;topbar.inert=true;
  $('stageHelpPanel').classList.add('hidden');$('stageResult').classList.remove('hidden');text('resultEyebrow',state.daily?'تحدّي اليوم':chaptersFor(game)[state.chapter]);text('resultStars',won?'★'.repeat(starsFor(state))+'☆'.repeat(3-starsFor(state)):'✧');
  text('resultTitle',won?(game==='paths'?'حل يستاهل النجوم!':'مطابقة تستاهل النجوم!'):'باقي لك خطوة!');text('resultCopy',won?(game==='jewels'?state.score+' نقطة · '+state.moves+' حركات · '+state.extraMoves+' إضافية':state.moves+' مسارات مرسومة · تغطية كاملة'):'جرّب صناعة قطعة خاصة وشحن المعزّز. تقدر تعيد المرحلة فورًا.');
  text('resultSave',won?'جارٍ حفظ نجومك…':'إعادة المحاولة متاحة بدون انتظار.');$('resultNext').classList.toggle('hidden',!won||!!state.daily||state.level>=stageCount(game));text('resultRetry',won?'أعدها وحسّن نجومك':'حاول مرة ثانية');
  for(const id of ['resultRetry','resultNext','resultMap'])$(id).disabled=true;
  if(won){sound('win');window.BS_GAME_FX?.win?.(canvas);window.BS_GAME_FX?.celebrate?.(window.BS_CAREER?.get?.()?.name||'بطل المرحلة',{key:'journey:'+game+':'+state.level+':'+state.daily,subtitle:game==='paths'?'غطّيت اللوحة ووصلت كل الأرقام.':'صنعت سلسلة مطابقة تستحق النجوم.'});try{storeResume();const result=await progress.complete(proof());if(version!==roundVersion)return;removeResume();text('resultSave',result.pending?'نجومك محفوظة على الجهاز. تُزامن مع حسابك عند الاتصال.':result.first?'انحفظت نجومك. المكافأة حسب حد التدريب اليومي.':'انحفظت نجومك. مكافأة هذه المرحلة محسوبة سابقًا.');}catch(error){if(version!==roundVersion)return;text('resultSave','لم يُحفظ التقدم: '+error.message);text('resultRetry','أعد محاولة حفظ النتيجة');saving=false;$('resultRetry').disabled=false;$('resultRetry').onclick=()=>finish();$('resultRetry').focus();return;}}
  else removeResume();
  if(version!==roundVersion)return;saving=false;for(const id of ['resultRetry','resultNext','resultMap'])$(id).disabled=false;$('resultRetry').onclick=()=>openStage(state.level,state.daily,false);(won&&!state.daily&&state.level<stageCount(game)?$('resultNext'):$('resultRetry')).focus();render();
}
async function swapAction(action){
  if(!state||busy||saving||state.over||state.won)return;const version=roundVersion,initial=state,result=moveMatch3(state,action);selected=[];boosting=false;
  if(!result.accepted){if(action.swap&&adjacent(...action.swap,state.size)){busy=true;meters();const before=state.board.slice(),after=before.slice(),[a,b]=action.swap;[after[a],after[b]]=[after[b],after[a]];await renderer.animate([{type:'swap',before,after,swap:[a,b]},{type:'swap',before:after,after:before,swap:[a,b]}],state);}if(version!==roundVersion)return;busy=false;meters();draw();message('ما صار تطابق؛ رجعت القطعتان بدون خصم حركة.');return;}
  state=result.state;busy=true;storeResume();meters();sound('move');
  await renderer.animate(result.events,state,event=>{if(version!==roundVersion)return;if(event.type==='clear'){text('stageChain',event.cascade?'سلسلة × '+(event.cascade+1):event.activated.length?'انفجار خاص!':'مطابقة!');}});
  if(version!==roundVersion||state===initial)return;busy=false;text('stageChain',result.extraMove?'حركة إضافية!':result.cascades>1?'سلسلة × '+result.cascades:'');meters();draw();
  message(result.extraMove?'مطابقة قوية! كسبت حركة إضافية.':result.cascades>1?'تساقط متتابع × '+result.cascades+' · +'+(state.score-initial.score)+' نقطة':'+ '+(state.score-initial.score)+' نقطة · ابحث عن فرصة لقطعة خاصة.');
  if(state.over||state.won)finish();
}
function commitPath(){
  if(!state||busy||saving||state.won||game!=='paths')return;const color=state.pairs.findIndex(pair=>pair.includes(selected[0])),result=movePaths(state,color,selected);
  if(!result.accepted){mistake(result.fault||'incomplete');return;}const completed=selected.slice();state=result.state;selected=[];scheduleResume();sound('move');meters();draw();window.BS_GAME_FX?.path(canvas,state,completed,color);message(state.won?'تغطية كاملة!':Object.keys(state.paths).length===state.pairs.length?'الأزواج متصلة؛ عدّل مساراتك لتغطية بقية الخانات.':'مسار اكتمل. كمّل بقية الألوان.');if(state.won)finish();
}
function mistake(reason){if(game!=='paths'||!state||state.won||saving)return;const reasons={cross:'تقاطع مساران',wall:'دخلت في حاجز',endpoint:'وصلت رقمًا مختلفًا',gate:'تجاوزت نقطة عبور',coverage:'بقيت مربعات فارغة',incomplete:'التوصيلة ناقصة',jump:'الحركة خارج المسار'};state=restartPaths(state);selected=[];pointer=null;roundVersion++;renderer.cancel();storeResume();meters();draw();sound('wrong');window.BS_GAME_FX?.wrong?.(canvas);canvas.classList.add('path-mistake');clearTimeout(mistake.timer);mistake.timer=setTimeout(()=>canvas.classList.remove('path-mistake'),700);message('غلط: '+(reasons[reason]||'مسار غير صحيح')+' — رجعناك لبداية المرحلة. الإعادة '+state.restarts+'.');}
function setupPath(){const color=state.pairs.findIndex(pair=>pair.includes(selected[0]));blocked=new Set(Object.entries(state.paths).filter(([key])=>+key!==color).flatMap(([,value])=>value));for(const cell of state.walls||[])blocked.add(cell);endpoints=new Set(state.pairs.filter((_,i)=>i!==color).flat());}
function selectPath(cell,start=false){
  if(cell<0||!state||state.won||saving||busy)return;cursor=cell;
  if(start){const color=state.pairs.findIndex(pair=>pair.includes(cell)),closing=color>=0&&selected.length>1&&state.pairs[color].includes(selected[0])&&cell!==selected[0]&&adjacent(selected.at(-1),cell,state.size);if(color>=0&&!closing){selected=[cell];setupPath();}else if(!selected.length)return;}
  if(!selected.length)return;const color=state.pairs.findIndex(pair=>pair.includes(selected[0])),index=selected.indexOf(cell);
  if(index>=0){if(index<selected.length-1)selected=selected.slice(0,index+1);else if(!start)return;}
  else if(adjacent(selected.at(-1),cell,state.size)&&(blocked.has(cell)||endpoints.has(cell))){mistake(endpoints.has(cell)?'endpoint':state.walls.includes(cell)?'wall':'cross');return;}
  else if(adjacent(selected.at(-1),cell,state.size)&&!blocked.has(cell)&&!endpoints.has(cell)&&(selected.length===1||!state.pairs[color].includes(selected.at(-1))))selected.push(cell);else return;
  $('stageCommit').disabled=selected.length<2;draw();
}
function extendPath(cell){
  const version=roundVersion;
  if(cell<0||cell===selected.at(-1))return;
  // Fill sampled gaps only along a straight run: no guessed corners through blockers.
  const from=selected.at(-1);if(from==null)return;const sameRow=(from/state.size|0)===(cell/state.size|0),sameColumn=from%state.size===cell%state.size;
  if(!sameRow&&!sameColumn){selectPath(cell);return;}const step=sameRow?Math.sign(cell-from):Math.sign(cell-from)*state.size;
  for(let i=from+step,count=0;count<state.size;count++,i+=step){const previous=selected.at(-1);selectPath(i);if(version!==roundVersion)return;if(selected.at(-1)!==i||previous===i||i===cell)break;}
}
function cellAt(event){if(!state)return -1;const r=canvas.getBoundingClientRect(),x=event.clientX-r.left,y=event.clientY-r.top;if(x<0||y<0||x>=r.width||y>=r.height)return -1;return Math.floor(y/r.height*state.size)*state.size+Math.floor(x/r.width*state.size);}
function canInput(){return state&&!busy&&!saving&&!state.over&&!state.won&&$('stageHelpPanel').classList.contains('hidden');}
canvas.addEventListener('pointerdown',event=>{
  if(pointer!==null||!canInput()||event.button>0)return;const cell=cellAt(event);if(cell<0)return;event.preventDefault();canvas.focus();cursor=cell;pointer=event.pointerId;pathGestureMoved=false;canvas.setPointerCapture(pointer);dragStart=lastCell=cell;dragMoved=false;
  if(game==='paths')selectPath(cell,true);else if(boosting){pointer=null;swapAction({boost:cell});}else if(selected.length===1&&adjacent(selected[0],cell,state.size)){pointer=null;swapAction({swap:[selected[0],cell]});}else{selected=[cell];draw();}
});
canvas.addEventListener('pointermove',event=>{
  if(event.pointerId!==pointer||!canInput())return;
  const samples=event.getCoalescedEvents?.(),rows=samples?.length?samples:[event];
  for(const sample of rows){const cell=cellAt(sample);if(cell<0||cell===lastCell)continue;lastCell=cell;
    if(game==='paths'){pathGestureMoved=true;extendPath(cell);if(pointer===null)return;continue;}
    if(cell===dragStart)continue;const dx=cell%state.size-dragStart%state.size,dy=(cell/state.size|0)-(dragStart/state.size|0),next=dragStart+(Math.abs(dx)>=Math.abs(dy)?Math.sign(dx):Math.sign(dy)*state.size);
    if(adjacent(dragStart,next,state.size)){selected=[dragStart,next];dragMoved=true;cursor=next;draw();}
  }
});
function endPointer(event,cancel=false){
  if(event.pointerId!==pointer)return;pointer=null;canvas.releasePointerCapture?.(event.pointerId);
  if(cancel){selected=[];draw();return;}
  if(!canInput())return;
  const cell=cellAt(event);
  if(game==='paths'){if(cell!==dragStart)pathGestureMoved=true;if(cell>=0)extendPath(cell);if(selected.length>1&&state.pairs.some(pair=>pair.includes(selected[0])&&pair.includes(selected.at(-1))))commitPath();else if(pathGestureMoved&&selected.length>1)mistake('incomplete');}
  else if(dragMoved&&selected.length===2)swapAction({swap:selected.slice()});
  else if(cell>=0&&cell!==dragStart&&adjacent(dragStart,cell,state.size))swapAction({swap:[dragStart,cell]});
}
canvas.addEventListener('pointerup',event=>endPointer(event));canvas.addEventListener('pointercancel',event=>endPointer(event,true));canvas.addEventListener('lostpointercapture',event=>{if(event.pointerId===pointer)endPointer(event,true);});
canvas.addEventListener('keydown',event=>{
  if(!canInput())return;const arrows={ArrowLeft:-1,ArrowRight:1,ArrowUp:-state.size,ArrowDown:state.size};
  if(Object.hasOwn(arrows,event.key)){event.preventDefault();const from=cursor<0?0:cursor,next=from+arrows[event.key];cursor=adjacent(from,next,state.size)?next:from;if(game==='paths'&&event.shiftKey)selectPath(cursor,!selected.length);else draw();}
  else if(event.key===' '||event.key==='Enter'){event.preventDefault();const cell=cursor<0?0:cursor;if(game==='jewels'){if(boosting)swapAction({boost:cell});else if(selected.length===1&&adjacent(selected[0],cell,state.size))swapAction({swap:[selected[0],cell]});else{selected=[cell];draw();}}else if(event.key==='Enter')commitPath();else selectPath(cell,true);}
  else if(event.key==='Escape'&&(selected.length||boosting)){event.preventDefault();event.stopPropagation();selected=[];boosting=false;meters();draw();}
});
$('stageCommit').onclick=commitPath;$('stageClose').onclick=closeStage;$('resultMap').onclick=closeStage;
$('stageRestart').onclick=()=>help('تبدأ لوحة المرحلة من جديد. نجوم المراحل المكتملة محفوظة.',()=>openStage(state.level,state.daily,false));
$('stageHelp').onclick=()=>help($('stageInstructions').textContent+' الكمبيوتر: الأسهم للتنقل، المسافة للاختيار. للمسارات: Shift مع الأسهم لمد الخط، وEnter لتثبيته.');
$('stageBoost').onclick=()=>{if(!canInput()||state.charge<BOOST_COST)return;boosting=!boosting;selected=[];meters();draw();message(boosting?'اختر خانة للانفجار المتقاطع.':'تم إلغاء اختيار المعزّز.');};
$('stageHint').onclick=()=>{if(!canInput())return;if(game==='jewels'){selected=legalSwaps(state)[0]||[];cursor=-1;draw();message('القطعتان المحددتان تبديلة ممكنة. اسحب إحداهما إلى الثانية أو انقرهما.');}else{const result=hintPaths(state);if(!result.accepted)return;state=result.state;selected=[];scheduleResume();meters();draw();message('رسمنا مسارًا؛ قد تتغيّر المسارات المتقاطعة معه.');if(state.won)finish();}};
$('resultNext').onclick=()=>openStage(Math.min(stageCount(game),state.level+1),'',false);$('resultRetry').onclick=()=>openStage(state.level,state.daily,false);
$('journeyContinue').onclick=()=>openStage(nextStage(progress.get(),game));
document.querySelectorAll('[data-game]').forEach(button=>button.onclick=()=>{game=button.dataset.game;chapter=Math.floor((nextStage(progress.get(),game)-1)/12);history.replaceState(null,'','/journey?game='+game);render();});
document.querySelectorAll('[data-daily]').forEach(button=>button.onclick=()=>{game=button.dataset.daily;openStage(1,progress.today());});
play.addEventListener('cancel',event=>{event.preventDefault();if(saving)return;if(!$('stageHelpPanel').classList.contains('hidden')){$('stageHelpPanel').classList.add('hidden');workspace.inert=false;topbar.inert=false;canvas.focus();}else closeStage();});
window.addEventListener('tahdia-journey-change',render);window.addEventListener('bs-career-change',render);
window.addEventListener('bs-social-session',()=>{if(play.open&&account()!==initialAccount){roundVersion++;clearTimeout(resumeTimer);renderer.cancel();saving=busy=false;state=null;play.close();}render();});
window.addEventListener('pagehide',()=>{storeResume();renderer.snap();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){storeResume();renderer.snap();pointer=null;}else{if(play.open)draw();else render();countdown();}});
function countdown(){if(document.hidden)return;const date=new Date(now()+10800000),seconds=86400-(date.getUTCHours()*3600+date.getUTCMinutes()*60+date.getUTCSeconds());text('dailyCountdown',[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':'));if(lastDaily!==progress.today()){lastDaily=progress.today();render();}}
render();countdown();setInterval(countdown,1000);progress.ready.then(render);if(params.get('daily')==='1')openStage(1,progress.today());
