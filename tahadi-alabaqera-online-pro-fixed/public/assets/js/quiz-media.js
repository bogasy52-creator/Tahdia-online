(() => {
  let current = null;
  let audioCtx = null;
  const qs = (s, root=document) => root.querySelector(s);
  function stopCurrent(){
    try{ current?.stop?.(); }catch{}
    current = null;
  }
  function ensureAudioContext(){
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return null;
    if(!audioCtx) audioCtx = new Ctx();
    if(audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
    return audioCtx;
  }
  function makeWave(container, bars=25){
    const wave=document.createElement('div'); wave.className='quiz-wave';
    const els=[];
    for(let i=0;i<bars;i++){const b=document.createElement('i');wave.appendChild(b);els.push(b)}
    container.appendChild(wave); return {wave,els};
  }
  function renderSound(container, media, opts){
    const card=document.createElement('div');card.className='quiz-sound-card quiz-media-shell';
    const top=document.createElement('div');top.className='quiz-sound-top';
    const title=document.createElement('div');title.className='quiz-sound-title';title.textContent='🎧 SOUND CHALLENGE';
    const badge=document.createElement('div');badge.className='quiz-sound-badge';badge.textContent='استماع محدود';
    top.append(title,badge);card.appendChild(top);
    const {wave,els}=makeWave(card,27);
    const btn=document.createElement('button');btn.type='button';btn.className='quiz-sound-play';btn.textContent='▶ تشغيل الصوت';card.appendChild(btn);
    const foot=document.createElement('div');foot.className='quiz-sound-foot';
    const hint=document.createElement('span');hint.textContent='استمع للتفاصيل، المقطع لا يكشف الإجابة';
    const dots=document.createElement('span');dots.className='quiz-listen-dots';foot.append(hint,dots);card.appendChild(foot);
    container.appendChild(card);
    const max=Math.max(1,Number(media.replays)||2);let plays=0,raf=0,source=null,analyser=null,data=null,ended=false;
    const audio=new Audio(media.src);audio.preload='auto';audio.crossOrigin = media.src.startsWith('http') ? 'anonymous' : '';
    function updateDots(){dots.innerHTML='';for(let i=0;i<max;i++){const d=document.createElement('span');d.textContent='●';if(i<plays)d.className='used';dots.appendChild(d)}badge.textContent=`${plays} / ${max} استماع`}
    function idleWave(){els.forEach((b,i)=>{b.style.height=`${7+(i%5)*2}px`;b.style.opacity='.38'})}
    function draw(){
      if(!analyser){return}
      analyser.getByteFrequencyData(data);
      const bins=data.length/els.length;
      els.forEach((b,i)=>{let sum=0;const a=Math.floor(i*bins),z=Math.max(a+1,Math.floor((i+1)*bins));for(let k=a;k<z;k++)sum+=data[k];const v=sum/(z-a)/255;b.style.height=`${8+v*56}px`;b.style.opacity=String(.5+v*.5)});
      if(!audio.paused&&!audio.ended)raf=requestAnimationFrame(draw);
    }
    function connectAnalyser(){
      const ctx=ensureAudioContext();if(!ctx||source)return;
      try{source=ctx.createMediaElementSource(audio);analyser=ctx.createAnalyser();analyser.fftSize=512;analyser.smoothingTimeConstant=.76;data=new Uint8Array(analyser.frequencyBinCount);source.connect(analyser);analyser.connect(ctx.destination)}catch{}
    }
    audio.addEventListener('play',()=>{connectAnalyser();wave.classList.add('playing');btn.textContent='◼ الصوت يعمل…';if(analyser){cancelAnimationFrame(raf);draw()}});
    audio.addEventListener('ended',()=>{wave.classList.remove('playing');idleWave();btn.textContent=plays>=max?'انتهت مرات الاستماع':'↻ تشغيل مرة أخرى';btn.disabled=plays>=max;ended=true});
    audio.addEventListener('error',()=>{btn.disabled=true;btn.textContent='تعذر تحميل المقطع';opts.toast?.('تعذر تشغيل الصوت')});
    btn.addEventListener('click',async()=>{
      if(plays>=max)return;
      try{connectAnalyser();audio.currentTime=0;plays++;updateDots();btn.disabled=false;ended=false;await audio.play();if(plays>=max && ended)btn.disabled=true}catch{plays=Math.max(0,plays-1);updateDots();opts.toast?.('تعذر تشغيل الصوت')}
    });
    updateDots();idleWave();
    return {stop(){cancelAnimationFrame(raf);try{audio.pause();audio.currentTime=0}catch{};wave.classList.remove('playing');idleWave()},reveal(){},audio};
  }
  function renderZoom(container, media, opts){
    const card=document.createElement('div');card.className='quiz-zoom-card quiz-media-shell';
    const frame=document.createElement('div');frame.className='quiz-zoom-frame';
    const img=document.createElement('img');img.alt='صورة فوتوغرافية للتحدي';img.decoding='async';img.loading='eager';img.className='loading';
    const fx=Number.isFinite(Number(media.focusX))?Number(media.focusX):50,fy=Number.isFinite(Number(media.focusY))?Number(media.focusY):50;
    img.style.transformOrigin=`${fx}% ${fy}%`;img.style.objectPosition=`${fx}% ${fy}%`;
    const initial=opts.full?1:(Number(media.zoom)||5);const hintZoom=Math.max(1,Number(media.hintZoom)||Math.max(2.2,initial*.62));
    img.style.transform=`scale(${initial})`;img.src=media.src;frame.appendChild(img);card.appendChild(frame);
    const hud=document.createElement('div');hud.className='quiz-zoom-hud';
    const label=document.createElement('div');label.className='quiz-zoom-label';label.textContent=opts.full?'الصورة الكاملة':'🔍 لقطة مقرّبة — دقق في التفاصيل';hud.appendChild(label);
    let hinted=false;let hintBtn=null;
    if(opts.allowHint&&!opts.full){hintBtn=document.createElement('button');hintBtn.type='button';hintBtn.className='quiz-hint-btn';hintBtn.textContent='تلميح بصري واحد';hintBtn.onclick=()=>{if(hinted)return;hinted=true;img.style.transform=`scale(${hintZoom})`;hintBtn.disabled=true;hintBtn.textContent='تم استخدام التلميح';label.textContent='🔎 زوم أقل — هذه آخر مساعدة بصرية';opts.onHint?.()};hud.appendChild(hintBtn)}
    card.appendChild(hud);
    if(media.credit){const cr=document.createElement('div');cr.className='quiz-credit';cr.textContent=media.credit;card.appendChild(cr)}
    img.addEventListener('load',()=>img.classList.remove('loading'),{once:true});img.addEventListener('error',()=>{img.classList.remove('loading');frame.innerHTML='<div class="quiz-media-error">تعذر تحميل الصورة.</div>';opts.toast?.('تعذر تحميل الصورة')},{once:true});
    container.appendChild(card);
    return {stop(){},reveal(){img.style.transform='scale(1)';label.textContent='✅ الصورة الكاملة';if(hintBtn)hintBtn.disabled=true},image:img};
  }
  function mount(container,media,opts={}){
    stopCurrent(); if(!container)return null;container.innerHTML='';
    if(!media)return null;
    current=media.type==='sound'?renderSound(container,media,opts):media.type==='zoom'?renderZoom(container,media,opts):null;
    return current;
  }
  window.BS_QUIZ_MEDIA={mount,stop:stopCurrent,reveal(){try{current?.reveal?.()}catch{}},current:()=>current};
})();
