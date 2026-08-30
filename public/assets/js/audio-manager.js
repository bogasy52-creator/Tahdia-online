(() => {
  const KEY='bs_audio_v2';
  const defaults={muted:false,effects:true,timer:true,haptics:true,volume:.72};
  let settings={...defaults};
  try{settings={...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{}
  let ctx=null, unlocked=false;
  const samples={
    round:'assets/sounds/round.wav',reveal:'assets/sounds/reveal.wav',correct:'assets/sounds/correct.wav',
    wrong:'assets/sounds/wrong.wav',duel:'assets/sounds/duel.wav',launch:'assets/sounds/launch.wav'
  };
  const audio={};
  for(const [k,src] of Object.entries(samples)){const a=new Audio(src);a.preload='auto';a.volume=settings.volume*.9;audio[k]=a}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(settings))}catch{};window.dispatchEvent(new CustomEvent('bs-audio-change',{detail:{...settings}}))}
  function ensure(){if(ctx)return ctx;const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;ctx=new C();return ctx}
  async function unlock(){const c=ensure();if(c&&c.state==='suspended'){try{await c.resume()}catch{}}unlocked=true}
  function tone(freq=440,duration=.055,gain=.045,type='sine',delay=0){if(settings.muted)return;const c=ensure();if(!c)return;const t=c.currentTime+delay;const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain*settings.volume),t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(c.destination);o.start(t);o.stop(t+duration+.02)}
  function play(name,opts={}){if(settings.muted||!settings.effects)return;unlock();const a=audio[name];if(a){try{a.pause();a.currentTime=0;a.volume=Math.min(1,(opts.volume??.9)*settings.volume);a.play().catch(()=>{})}catch{};return}const map={
    click:[520,.04,.025],move:[660,.045,.025],dice:[150,.12,.06,'triangle'],card:[420,.06,.035],ladder:[590,.15,.05],snake:[170,.22,.05,'sawtooth'],buzzer:[880,.16,.08,'square'],win:[784,.18,.07],error:[180,.15,.05],
    'ui-click':[540,.035,.024], 'room-join':[720,.07,.035], 'room-ready':[860,.055,.034], turn:[630,.07,.03],
    'dice-pickup':[210,.07,.04,'triangle'], 'dice-roll':[155,.12,.055,'triangle'], 'dice-land':[105,.08,.06,'square'], 'piece-step':[670,.04,.025],
    'ladder-up':[610,.14,.05], 'snake-hiss':[185,.16,.04,'sawtooth'], 'snake-slide':[145,.23,.052,'sawtooth'],
    'card-shuffle':[330,.1,.035,'triangle'], 'card-deal':[470,.055,.03], 'card-select':[560,.045,.03], 'card-play':[390,.075,.04],
    'marble-move':[690,.05,.03], capture:[165,.12,.065,'square'], swap:[420,.11,.05,'triangle'], 'safe-home':[820,.12,.05], victory:[790,.18,.07]
  };const v=map[name];if(v){tone(...v);if(name==='win'||name==='victory'){tone(988,.2,.065,'sine',.13);tone(1175,.28,.06,'sine',.27)}}}
  function timerTick(seconds){if(settings.muted||!settings.timer)return;unlock();const s=Math.ceil(Number(seconds)||0);if(s<=0)return;if(s<=5){tone(s===1?900:760,.07,.055,'square');tone(1040,.04,.025,'sine',.09)}else if(s<=10){tone(640,.055,.04,'square')}else{tone(420,.025,.014,'square')}}
  function timerEnd(){if(settings.muted||!settings.timer)return;unlock();tone(150,.22,.08,'sawtooth');tone(110,.25,.06,'square',.16);vibrate([120,70,160])}
  function vibrate(pattern=18){if(!settings.haptics)return;try{navigator.vibrate?.(pattern)}catch{}}
  function setMuted(v){settings.muted=Boolean(v);save();return settings.muted}
  function toggleMuted(){return setMuted(!settings.muted)}
  function update(next){settings={...settings,...next,volume:Math.min(1,Math.max(0,Number(next.volume??settings.volume)))};for(const a of Object.values(audio))a.volume=settings.volume*.9;save();return {...settings}}
  function getSettings(){return {...settings}}
  function dispose(){try{ctx?.close()}catch{}ctx=null}
  const api={play,timerTick,timerEnd,vibrate,setMuted,toggleMuted,update,getSettings,unlock,dispose,tone};
  window.BS_AUDIO=api;
  const starter=()=>unlock();
  window.addEventListener('pointerdown',starter,{once:true,passive:true});window.addEventListener('keydown',starter,{once:true});
})();
