(() => {
  const KEY='bs_audio_v3';
  const defaults={muted:false,effects:true,timer:true,haptics:true,volume:.72};
  let settings={...defaults};
  try{settings={...defaults,...JSON.parse(localStorage.getItem(KEY)||localStorage.getItem('bs_audio_v2')||'{}')}}catch{}
  let ctx=null, unlocked=false, noiseCache=null;
  const samples={round:'assets/sounds/round.wav',reveal:'assets/sounds/reveal.wav',correct:'assets/sounds/correct.wav',wrong:'assets/sounds/wrong.wav',duel:'assets/sounds/duel.wav',launch:'assets/sounds/launch.wav'};
  const audio={};
  for(const [k,src] of Object.entries(samples)){const a=new Audio(src);a.preload='auto';a.volume=settings.volume*.9;audio[k]=a}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(settings))}catch{};window.dispatchEvent(new CustomEvent('bs-audio-change',{detail:{...settings}}))}
  function ensure(){if(ctx)return ctx;const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;ctx=new C();return ctx}
  async function unlock(){const c=ensure();if(c&&c.state==='suspended'){try{await c.resume()}catch{}}unlocked=true}
  function tone(freq=440,duration=.055,gain=.045,type='sine',delay=0,endFreq=null){if(settings.muted)return;const c=ensure();if(!c)return;const t=c.currentTime+delay;const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(endFreq&&o.frequency.exponentialRampToValueAtTime)o.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),t+duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain*settings.volume),t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(c.destination);o.start(t);o.stop(t+duration+.02)}
  function sequence(notes=[]){for(const n of notes)tone(...n)}
  function noise(duration=.08,gain=.035,delay=0,highpass=500){
    const c=ensure();if(!c||!c.createBuffer||!c.createBufferSource)return;const sr=c.sampleRate||44100;
    if(!noiseCache||noiseCache.sampleRate!==sr){const b=c.createBuffer(1,Math.ceil(sr*.45),sr),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length*.38);noiseCache=b;noiseCache.sampleRate=sr}
    const t=c.currentTime+delay,src=c.createBufferSource(),g=c.createGain();src.buffer=noiseCache;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain*settings.volume),t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    if(c.createBiquadFilter){const f=c.createBiquadFilter();f.type='highpass';f.frequency.setValueAtTime(highpass,t);src.connect(f).connect(g).connect(c.destination)}else src.connect(g).connect(c.destination);src.start(t);src.stop(t+duration+.02)
  }
  function luxuryDice(){/* porcelain roll: small tumbles, weighty landing, tiny final bounce */noise(.055,.024,0,1700);tone(410,.028,.018,'triangle',0,285);noise(.04,.020,.16,1900);tone(350,.026,.016,'triangle',.16,245);noise(.04,.018,.32,1800);tone(305,.025,.015,'triangle',.32,220);noise(.065,.046,.56,850);tone(168,.085,.064,'triangle',.56,96);tone(510,.038,.025,'sine',.565,340);noise(.035,.022,.72,1250);tone(235,.052,.032,'triangle',.72,150)}
  function luxuryMove(){tone(360,.055,.022,'sine',0,520);noise(.035,.014,.018,1400);tone(650,.07,.02,'sine',.045,780)}
  function luxuryCapture(){noise(.12,.055,0,500);tone(210,.10,.06,'triangle',0,95);tone(92,.17,.075,'sine',.055,54);tone(840,.055,.025,'sine',.16,620)}
  function luxurySnake(){noise(.30,.035,0,1000);tone(310,.28,.045,'sawtooth',0,105);tone(245,.25,.028,'triangle',.08,82);noise(.10,.028,.24,450)}
  function luxuryLadder(){noise(.20,.022,0,1500);sequence([[380,.06,.022,'sine',0,520],[520,.06,.026,'sine',.055,710],[700,.07,.03,'sine',.11,940],[930,.11,.034,'sine',.18,1240]])}
  function luxuryWin(){noise(.20,.02,0,1800);sequence([[523,.10,.035,'sine',0,659],[659,.11,.045,'sine',.08,784],[784,.14,.05,'sine',.18,1046],[1046,.24,.055,'sine',.31,1318],[1568,.30,.03,'sine',.43,1760]])}
  function boardStep(){tone(510,.032,.016,'triangle',0,690);noise(.025,.008,.006,1850)}
  function boardLand(){noise(.07,.034,0,720);tone(190,.09,.046,'triangle',0,92);tone(720,.045,.016,'sine',.07,540)}
  function diceImpact(){noise(.095,.06,0,520);tone(145,.12,.07,'triangle',0,68);tone(440,.05,.025,'sine',.018,270)}
  function ladderIgnite(){sequence([[330,.06,.018,'triangle',0,510],[520,.08,.025,'sine',.045,780]]);noise(.08,.014,0,1600)}
  function ladderStep(){tone(620,.045,.022,'triangle',0,810);tone(980,.035,.012,'sine',.026,1180)}
  function ladderLand(){noise(.07,.035,0,820);sequence([[470,.06,.028,'triangle',0,640],[760,.09,.032,'sine',.045,960]])}
  function snakeHiss(){noise(.30,.04,0,2400);tone(270,.28,.025,'sawtooth',0,86)}
  function snakeBite(){noise(.105,.062,0,650);tone(180,.095,.072,'square',0,62);tone(95,.14,.05,'triangle',.035,48)}
  function snakeSwallow(){sequence([[240,.11,.032,'sine',0,165],[185,.13,.038,'triangle',.11,118],[130,.16,.044,'sine',.24,76]]);noise(.24,.022,.02,380)}
  function snakeGrow(){sequence([[92,.22,.045,'sine',0,68],[118,.25,.04,'triangle',.12,82],[158,.22,.027,'sine',.26,112]])}
  function snakeRelease(){noise(.08,.025,0,900);sequence([[210,.07,.025,'triangle',0,360],[420,.10,.026,'sine',.06,640]])}
  function play(name,opts={}){if(settings.muted||!settings.effects)return;unlock();const a=audio[name];if(a){try{a.pause();a.currentTime=0;a.volume=Math.min(1,(opts.volume??.9)*settings.volume);a.play().catch(()=>{})}catch{};return}
    const v4={boardStep,boardLand,diceImpact,ladderIgnite,ladderStep,ladderLand,snakeHiss,snakeBite,snakeSwallow,snakeGrow,snakeRelease};if(v4[name])return v4[name]();
    if(name==='dice')return luxuryDice();if(name==='move'||name==='step')return luxuryMove();if(name==='capture')return luxuryCapture();if(name==='snake'||name==='snakeSlide')return luxurySnake();if(name==='ladder'||name==='ladderClimb')return luxuryLadder();if(name==='win')return luxuryWin();
    const map={click:[560,.04,.02,'sine'],card:[430,.065,.028,'triangle'],select:[820,.055,.025,'sine'],buzzer:[170,.18,.06,'sawtooth'],error:[145,.16,.045,'triangle'],pop:[1040,.055,.022,'sine']};
    if(name==='turn')return sequence([[470,.045,.02,'sine',0,560],[690,.08,.027,'sine',.055,780]]);
    if(name==='join'||name==='connect')return sequence([[520,.055,.022,'sine',0,620],[660,.07,.026,'sine',.055,760],[840,.095,.027,'sine',.12,930]]);
    if(name==='disconnect')return sequence([[500,.06,.02,'triangle',0,390],[340,.13,.032,'triangle',.06,230]]);
    if(name==='shuffle')return sequence([[210,.032,.018,'triangle',0,250],[320,.032,.018,'triangle',.035,270],[240,.035,.018,'triangle',.07,350],[410,.045,.02,'triangle',.105,330]]);
    if(name==='deal')return sequence([[410,.035,.018,'triangle',0,480],[520,.035,.017,'triangle',.045,610],[650,.05,.018,'sine',.09,760]]);
    if(name==='finish')return sequence([[920,.07,.03,'sine',0,1060],[1180,.12,.036,'sine',.07,1420]]);
    const v=map[name];if(v)tone(...v)
  }
  function timerTick(seconds){if(settings.muted||!settings.timer)return;unlock();const s=Math.ceil(Number(seconds)||0);if(s<=0)return;if(s<=5){tone(s===1?940:790,.065,.045,'sine');tone(1120,.035,.018,'sine',.075)}else if(s<=10){tone(680,.05,.028,'sine')}else{tone(450,.022,.011,'sine')}}
  function timerEnd(){if(settings.muted||!settings.timer)return;unlock();tone(160,.20,.065,'triangle',0,95);tone(105,.22,.05,'sine',.13,62);vibrate([120,70,160])}
  function vibrate(pattern=18){if(!settings.haptics)return;try{navigator.vibrate?.(pattern)}catch{}}
  function setMuted(v){settings.muted=Boolean(v);save();return settings.muted}function toggleMuted(){return setMuted(!settings.muted)}
  function update(next){settings={...settings,...next,volume:Math.min(1,Math.max(0,Number(next.volume??settings.volume)))};for(const a of Object.values(audio))a.volume=settings.volume*.9;save();return {...settings}}
  function getSettings(){return {...settings}}function dispose(){try{ctx?.close()}catch{}ctx=null;noiseCache=null}
  window.BS_AUDIO={play,timerTick,timerEnd,vibrate,setMuted,toggleMuted,update,getSettings,unlock,dispose,tone};
  const starter=()=>unlock();window.addEventListener('pointerdown',starter,{once:true,passive:true});window.addEventListener('keydown',starter,{once:true})
})();
