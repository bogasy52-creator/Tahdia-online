(() => {
  const KEY='bs_audio_v3';
  const defaults={muted:false,effects:true,timer:true,haptics:true,volume:.72,diceSound:'varied',music:true,musicVolume:.55};
  let settings={...defaults};
  try{settings={...defaults,...JSON.parse(localStorage.getItem(KEY)||localStorage.getItem('bs_audio_v2')||'{}')}}catch{}
  settings.volume=Number.isFinite(Number(settings.volume))?Math.min(1,Math.max(0,Number(settings.volume))):defaults.volume;
  let ctx=null, unlocked=false;
  const cues={tick:'click',round:'reward',reveal:'card',correct:'reward',wrong:'error',duel:'connect',launch:'connect',dice:'dice',diceImpact:'diceImpact',move:'step',step:'step',boardStep:'step',boardLand:'land',capture:'capture',snake:'hiss',snakeSlide:'swallow',snakeHiss:'hiss',snakeBite:'bite',snakeSwallow:'swallow',snakeGrow:'grow',snakeRelease:'release',ladder:'ladder',ladderClimb:'ladder',ladderIgnite:'ladder',ladderStep:'rung',ladderLand:'land',win:'win',click:'click',card:'card',select:'click',buzzer:'error',error:'error',pop:'click',turn:'card',join:'connect',connect:'connect',disconnect:'disconnect',shuffle:'shuffle',deal:'card',finish:'reward',entry:'reward',reward:'reward'};
  const samples=Object.fromEntries(Object.entries(cues).map(([key,file])=>[key,'assets/sounds/arena-v9/'+file+'.wav']));
  const audio={},samplePool={},contentPlayers=new Set();
  const quizFiles={round:'round',correct:'correct',wrong:'wrong',reveal:'reveal',buzzer:'buzzer',relay:'relay',quizTimeout:'timeout'};
  for(const [name,file] of Object.entries(quizFiles))samples[name]='assets/sounds/quiz-v28/'+file+'.wav';
  // 31.1.0: a clear crunch-and-gulp when a snake eats a stone.
  samples.snakeEat='assets/sounds/board-v31-1/snake-eat.wav';
  // 32.0.0: the Baloot table.
  for(const [name,file] of Object.entries({balootDeal:'deal',balootPlay:'play',balootTrick:'trick',balootShuffle:'shuffle',balootFlip:'flip',balootBid:'bid',balootBuy:'buy',balootDouble:'double',balootChime:'chime'}))samples[name]='assets/sounds/baloot-v32/'+file+'.wav';
  // 33.9.3: a richer effects kit for every game (turns, start, win, coins, taps).
  for(const name of ['tap','open','yourTurn','count','go','victory','defeat','coin','combo','whoosh','hit','send','levelUp'])samples[name]='assets/sounds/fx-v33-9-3/'+name+'.wav';
  samples.win=samples.victory;
  // 33.9.7: a softer «your turn»
  samples.yourTurn='assets/sounds/fx-v33-9-3/yourTurn-soft.wav';
  // 33.9.8: a marble knocked off the board
  samples.knock='assets/sounds/fx-v33-9-3/knock.wav';
  // Create/decode only a sound the player uses, sharing aliases of the same file.
  function sample(name){const src=samples[name]||samples.click;if(!samplePool[src]){const a=new Audio(src);a.preload='none';a.volume=settings.volume*.9;samplePool[src]=a;}return audio[name]=samplePool[src];}
  const diceSamples={soft:['soft-1','soft-2'],wood:['wood-1','wood-2'],crystal:['crystal-1','crystal-2']},diceAudio={},diceCursor={dice:-1,diceImpact:-1};
  function nextDice(name){const family=diceSamples[settings.diceSound]?settings.diceSound:null,pool=name==='diceImpact'?(family?['land-'+family]:['land-soft','land-wood','land-crystal']):(family?diceSamples[family]:Object.values(diceSamples).flat());diceCursor[name]=(diceCursor[name]+1)%pool.length;const id=pool[diceCursor[name]];if(!diceAudio[id]){const a=new Audio('assets/sounds/dice-v133/'+id+'.wav');a.preload='none';diceAudio[id]=a;}return diceAudio[id];}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(settings))}catch{};window.dispatchEvent(new CustomEvent('bs-audio-change',{detail:{...settings}}))}
  function ensure(){if(ctx)return ctx;const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;ctx=new C();return ctx}
  // 33.9.3: decoded buffers through one bus: every sound starts on time, overlaps, and plays
  // after the first tap even when it comes from the other player (iPhone blocks late <audio>).
  let bus=null;const buffers={};let lastCue=0;
  function graph(){const c=ensure();if(!c||bus||!c.createDynamicsCompressor)return bus;try{const comp=c.createDynamicsCompressor();comp.threshold.value=-14;comp.knee.value=12;comp.ratio.value=4;comp.attack.value=.003;comp.release.value=.2;const fx=c.createGain(),music=c.createGain();fx.connect(comp);music.connect(c.destination);comp.connect(c.destination);bus={fx,music};}catch{bus=null}return bus}
  function load(src){if(buffers[src]!==undefined||typeof fetch!=='function'||!ensure()?.decodeAudioData)return buffers[src];buffers[src]=null;fetch(src).then(r=>r.ok?r.arrayBuffer():Promise.reject()).then(b=>new Promise((ok,no)=>ctx.decodeAudioData(b,ok,no))).then(b=>{buffers[src]=b}).catch(()=>{buffers[src]=false});return null}
  function web(src,volume){const b=load(src);if(!b||!graph()||ctx.state!=='running')return false;try{const n=ctx.createBufferSource(),g=ctx.createGain();n.buffer=b;g.gain.value=volume;n.connect(g).connect(bus.fx);n.start();return true}catch{return false}}
  async function unlock(){const c=ensure();try{if(navigator.audioSession&&navigator.audioSession.type!=='playback')navigator.audioSession.type='playback'}catch{}if(c&&c.state==='suspended'){try{await c.resume()}catch{}}unlocked=true}
  function tone(freq=440,duration=.055,gain=.045,type='sine',delay=0,endFreq=null){if(settings.muted)return;const c=ensure();if(!c)return;const t=c.currentTime+delay;const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(endFreq&&o.frequency.exponentialRampToValueAtTime)o.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),t+duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain*settings.volume),t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(c.destination);o.start(t);o.stop(t+duration+.02)}
  function contentActive(){return [...contentPlayers].some(a=>!a.paused&&!a.ended);}
  function registerContent(player){contentPlayers.add(player);player.muted=Boolean(settings.muted);player.volume=Math.min(1,Math.max(0,settings.volume));return()=>contentPlayers.delete(player);}
  function applySettings(){for(const a of contentPlayers){a.muted=Boolean(settings.muted);a.volume=settings.volume;}if(settings.muted){for(const a of [...Object.values(samplePool),...Object.values(diceAudio)])try{a.pause();}catch{}}}
  function play(name,opts={}){
    if(settings.muted||!settings.effects||contentActive())return;
    unlock();const dice=name==='dice'||name==='diceImpact',a=dice?nextDice(name):sample(name);if(!a)return;lastCue=Date.now();
    if(web(a.src,Math.min(1.6,(opts.volume??(dice?.44:.7))*settings.volume*1.45)))return;
    try{if(dice)for(const sound of Object.values(diceAudio))sound.pause();a.pause();a.currentTime=0;a.volume=Math.min(1,Math.max(0,(opts.volume??(dice?.44:.7))*settings.volume));a.play().catch(()=>{})}catch{}
  }
  function timerSample(name,volume){const a=sample(name);if(!a)return;if(web(a.src,Math.min(1.4,volume*settings.volume*1.3)))return;try{a.pause();a.currentTime=0;a.volume=Math.min(1,volume*settings.volume);a.play().catch(()=>{})}catch{}}
  function timerTick(seconds){if(settings.muted||!settings.timer||Number(seconds)<=0||contentActive())return;unlock();timerSample('click',Number(seconds)<=5?.65:.28)}
  function timerEnd(){if(settings.muted||!settings.timer||contentActive())return;unlock();timerSample('quizTimeout',.7);vibrate([80,50,100])}
  function vibrate(pattern=18){if(!settings.haptics)return;try{navigator.vibrate?.(pattern)}catch{}}
  function setMuted(v){settings.muted=Boolean(v);applySettings();save();return settings.muted}function toggleMuted(){return setMuted(!settings.muted)}
  function update(next){const requested=Number(next.volume??settings.volume);settings={...settings,...next,volume:Number.isFinite(requested)?Math.min(1,Math.max(0,requested)):settings.volume};for(const a of Object.values(audio))a.volume=settings.volume*.9;applySettings();save();return {...settings}}
  function getSettings(){return {...settings}}function dispose(){try{ctx?.close()}catch{}ctx=null;}
    // Fetch the sounds a game is about to need so the first one is not late.
  function prime(names=[]){for(const name of names){try{const a=sample(name);load(a.src);if(a&&a.preload!=='auto'){a.preload='auto';a.load?.();}}catch{}}}
  const has=name=>Boolean(samples[name]);const context=()=>{graph();return ctx};const musicBus=()=>graph()?.music||null;const recent=(ms=400)=>Date.now()-lastCue<ms;
  window.BS_AUDIO={play,timerTick,timerEnd,vibrate,setMuted,toggleMuted,update,getSettings,unlock,dispose,tone,registerContent,contentActive,prime,has,context,musicBus,recent};
  // Music and the sounds of play load on their own, after the page.
  try{if(document&&!document.querySelector('script[data-bs-sound]')){const s=document.createElement('script');s.src='/assets/js/sound-v33-9-3.js?v=33.9.8';s.defer=true;s.dataset.bsSound='1';(document.head||document.documentElement).appendChild(s)}}catch{}
  const starter=()=>unlock();window.addEventListener('pointerdown',starter,{once:true,passive:true});window.addEventListener('keydown',starter,{once:true})
})();
