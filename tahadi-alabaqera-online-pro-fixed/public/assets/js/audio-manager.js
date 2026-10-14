(() => {
  const KEY='bs_audio_v3';
  const defaults={muted:false,effects:true,timer:true,haptics:true,volume:.72,diceSound:'varied'};
  let settings={...defaults};
  try{settings={...defaults,...JSON.parse(localStorage.getItem(KEY)||localStorage.getItem('bs_audio_v2')||'{}')}}catch{}
  let ctx=null, unlocked=false;
  const cues={round:'reward',reveal:'card',correct:'reward',wrong:'error',duel:'connect',launch:'connect',dice:'dice',diceImpact:'diceImpact',move:'step',step:'step',boardStep:'step',boardLand:'land',capture:'capture',snake:'hiss',snakeSlide:'swallow',snakeHiss:'hiss',snakeBite:'bite',snakeSwallow:'swallow',snakeGrow:'grow',snakeRelease:'release',ladder:'ladder',ladderClimb:'ladder',ladderIgnite:'ladder',ladderStep:'rung',ladderLand:'land',win:'win',click:'click',card:'card',select:'click',buzzer:'error',error:'error',pop:'click',turn:'card',join:'connect',connect:'connect',disconnect:'disconnect',shuffle:'shuffle',deal:'card',finish:'reward',entry:'reward',reward:'reward'};
  const samples=Object.fromEntries(Object.entries(cues).map(([key,file])=>[key,'assets/sounds/arena-v9/'+file+'.wav']));
  const audio={};
  for(const [k,src] of Object.entries(samples)){const a=new Audio(src);a.preload='auto';a.volume=settings.volume*.9;audio[k]=a}
  const diceSamples={soft:['soft-1','soft-2'],wood:['wood-1','wood-2'],crystal:['crystal-1','crystal-2']},diceAudio={},diceCursor={dice:-1,diceImpact:-1};
  for(const id of [...Object.values(diceSamples).flat(),'land-soft','land-wood','land-crystal']){const a=new Audio('assets/sounds/dice-v133/'+id+'.wav');a.preload='auto';diceAudio[id]=a;}
  function nextDice(name){const family=diceSamples[settings.diceSound]?settings.diceSound:null,pool=name==='diceImpact'?(family?['land-'+family]:['land-soft','land-wood','land-crystal']):(family?diceSamples[family]:Object.values(diceSamples).flat());diceCursor[name]=(diceCursor[name]+1)%pool.length;return diceAudio[pool[diceCursor[name]]];}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(settings))}catch{};window.dispatchEvent(new CustomEvent('bs-audio-change',{detail:{...settings}}))}
  function ensure(){if(ctx)return ctx;const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;ctx=new C();return ctx}
  async function unlock(){const c=ensure();if(c&&c.state==='suspended'){try{await c.resume()}catch{}}unlocked=true}
  function tone(freq=440,duration=.055,gain=.045,type='sine',delay=0,endFreq=null){if(settings.muted)return;const c=ensure();if(!c)return;const t=c.currentTime+delay;const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(endFreq&&o.frequency.exponentialRampToValueAtTime)o.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),t+duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain*settings.volume),t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(c.destination);o.start(t);o.stop(t+duration+.02)}
  function play(name,opts={}){
    if(settings.muted||!settings.effects)return;
    unlock();const dice=name==='dice'||name==='diceImpact',a=dice?nextDice(name):audio[name]||audio.click;if(!a)return;
    try{if(dice)for(const sound of Object.values(diceAudio))sound.pause();a.pause();a.currentTime=0;a.volume=Math.min(1,Math.max(0,(opts.volume??(dice?.44:.7))*settings.volume));a.play().catch(()=>{})}catch{}
  }
  function timerSample(name,volume){const a=audio[name];if(!a)return;try{a.pause();a.currentTime=0;a.volume=Math.min(1,volume*settings.volume);a.play().catch(()=>{})}catch{}}
  function timerTick(seconds){if(settings.muted||!settings.timer||Number(seconds)<=0)return;unlock();timerSample('click',Number(seconds)<=5?.65:.28)}
  function timerEnd(){if(settings.muted||!settings.timer)return;unlock();timerSample('error',.7);vibrate([80,50,100])}
  function vibrate(pattern=18){if(!settings.haptics)return;try{navigator.vibrate?.(pattern)}catch{}}
  function setMuted(v){settings.muted=Boolean(v);save();return settings.muted}function toggleMuted(){return setMuted(!settings.muted)}
  function update(next){settings={...settings,...next,volume:Math.min(1,Math.max(0,Number(next.volume??settings.volume)))};for(const a of Object.values(audio))a.volume=settings.volume*.9;save();return {...settings}}
  function getSettings(){return {...settings}}function dispose(){try{ctx?.close()}catch{}ctx=null;}
  window.BS_AUDIO={play,timerTick,timerEnd,vibrate,setMuted,toggleMuted,update,getSettings,unlock,dispose,tone};
  const starter=()=>unlock();window.addEventListener('pointerdown',starter,{once:true,passive:true});window.addEventListener('keydown',starter,{once:true})
})();
