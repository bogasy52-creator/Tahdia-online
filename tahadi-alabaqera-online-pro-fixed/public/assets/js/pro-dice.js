/* Tahdia 31.1.0 — one shared 3D die for every dice game (GPU die from
   dice-3d-v31-1.js when available, this CSS cube otherwise).
   A real cube: six rounded faces around a solid core (no see-through edges),
   a tumbling throw that lands on the exact face, and a short glow on a six. */
(function(){
  'use strict';
  const faces={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
  // Cube rotation that brings each face to the front.
  const rotations={1:[0,0],2:[0,-90],3:[90,0],4:[-90,0],5:[0,90],6:[0,180]};
  const running=new WeakMap();
  const bonusNames=['حماية واحدة','دوران إضافيان','نردان','تقدّم 3','تقدّم 5','تجميد الخصم'];
  const symbols=[
    '<path d="M24 5 40 11v14c0 10-9 16-16 20C17 41 8 35 8 25V11Z"/><path d="m16 24 6 6 11-13"/>',
    '<path d="M38 18a16 16 0 1 0 1 13M38 6v13H25"/><text x="24" y="31">2</text>',
    '<rect x="5" y="16" width="22" height="22" rx="5"/><rect x="21" y="6" width="22" height="22" rx="5"/><circle cx="14" cy="25" r="2"/><circle cx="23" cy="33" r="2"/><circle cx="30" cy="15" r="2"/><circle cx="36" cy="21" r="2"/>',
    '<path d="m6 20 8-8 8 8m-8-8v26"/><text x="34" y="31">3</text>',
    '<path d="m6 20 8-8 8 8m-8-8v26"/><text x="34" y="31">5</text>',
    '<path d="M24 4v40M7 14l34 20M7 34l34-20m-23-3 6 6 6-6m-12 26 6-6 6 6M9 20l8-3-1-8m16 31-1-8 8-3M9 28l8 3-1 8m16-31-1 8 8 3"/>'
  ];
  function transform(value){const [x,y]=rotations[value]||rotations[1];return `rotateX(${x}deg) rotateY(${y}deg)`;}
  const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch{return false}};
  function mount(el,bonus=false){
    if(!el||el.dataset.proDie)return;
    el.dataset.proDie='1';el.classList.add('pro-die','v31');el.innerHTML='';
    const cube=document.createElement('div');cube.className='pro-die-cube';
    // Three crossed planes fill the cube so rounded corners never show through.
    const core=document.createElement('div');core.className='pro-die-core';core.setAttribute('aria-hidden','true');
    for(const axis of ['x','y','z']){const plane=document.createElement('i');plane.className='core-'+axis;core.appendChild(plane);}
    cube.appendChild(core);
    for(let n=1;n<=6;n++){
      const face=document.createElement('div');face.className='pro-face face-'+n;
      const rim=document.createElement('span');rim.className='pro-face-rim';rim.setAttribute('aria-hidden','true');face.appendChild(rim);
      if(bonus){face.innerHTML=`<span class="pro-face-rim" aria-hidden="true"></span><svg viewBox="0 0 48 48" aria-hidden="true">${symbols[n-1]}</svg>`;}
      else for(const p of faces[n]){const pip=document.createElement('i');pip.className='pro-pip pos-'+p;face.appendChild(pip);}
      cube.appendChild(face);
    }
    if(bonus)el.dataset.bonus='true';
    const flight=document.createElement('div'),shadow=document.createElement('i'),glow=document.createElement('i');
    flight.className='pro-die-flight';shadow.className='pro-die-shadow';shadow.setAttribute('aria-hidden','true');glow.className='pro-die-glow';glow.setAttribute('aria-hidden','true');
    flight.appendChild(cube);el.append(shadow,glow,flight);
    set(el,Number(el.dataset.value)||1);
    // 31.1.0: a real 3D die drawn on the GPU when the device supports it.
    if(!bonus)try{window.BS_DIE3D?.attach?.(el);}catch{}
  }
  function mountBonus(el){mount(el,true);}
  function set(el,value){
    if(!rotations[value])return;
    const cube=el.querySelector('.pro-die-cube');if(cube)cube.style.transform=transform(value);
    el.__die3d?.set?.(value);
    el.dataset.value=value;el.setAttribute('role','img');
    el.setAttribute('aria-label',el.dataset.bonus?'نرد المكافآت: '+bonusNames[value-1]:'نتيجة النرد '+value);
  }
  function roll(el,value,{quiet=false}={}){
    if(!rotations[value])return Promise.reject(new Error('invalid_die_value'));
    mount(el);
    if(running.has(el))return running.get(el);
    const task=(async()=>{
      const cube=el.querySelector('.pro-die-cube'),reduce=reduced();
      el.setAttribute('aria-label','جاري رمي النرد');el.classList.remove('is-landed','is-six');el.classList.add('is-rolling');
      let anims=[];
      if(!quiet){window.BS_AUDIO?.play?.('dice');window.BS_AUDIO?.vibrate?.([10,30,10]);}
      try{
        if(el.__die3d){
          const duration=reduce?0:1040;
          if(!quiet&&!reduce)setTimeout(()=>window.BS_AUDIO?.play?.('diceImpact',{volume:.3}),Math.round(duration*.36));
          await el.__die3d.roll(value,duration);
        }else if(!reduce&&cube?.animate){
          const [x,y]=rotations[value],spinX=(Math.random()<.5?-1:1)*360,spinY=720;
          const final=`rotateX(${x+spinX*2}deg) rotateY(${y+spinY}deg)`;
          const from=cube.style.transform||transform(1),duration=1040;
          anims.push(cube.animate([
            {transform:from,offset:0},
            {transform:`rotateX(${spinX*.55}deg) rotateY(${spinY*.35}deg) rotateZ(-24deg)`,offset:.22},
            {transform:`rotateX(${spinX*1.15}deg) rotateY(${spinY*.7}deg) rotateZ(18deg)`,offset:.48},
            {transform:`rotateX(${x+spinX*1.75}deg) rotateY(${y+spinY*.93}deg) rotateZ(-6deg)`,offset:.72},
            {transform:`rotateX(${x+spinX*2}deg) rotateY(${y+spinY}deg) rotateZ(2deg)`,offset:.86},
            {transform:final,offset:1}
          ],{duration,easing:'cubic-bezier(.22,.62,.3,1)'}));
          const flight=el.querySelector('.pro-die-flight'),shadow=el.querySelector('.pro-die-shadow');
          if(flight?.animate)anims.push(flight.animate([
            {translate:'0 0',scale:'1',offset:0},
            {translate:'-6% -78%',scale:'1.06',offset:.2},
            {translate:'4% -18%',scale:'1',offset:.44},
            {translate:'6% 2%',scale:'1.08 .9',offset:.56},
            {translate:'2% -26%',scale:'.98 1.03',offset:.68},
            {translate:'0 1%',scale:'1.04 .95',offset:.8},
            {translate:'0 -6%',scale:'1',offset:.9},
            {translate:'0 0',scale:'1',offset:1}
          ],{duration,easing:'linear'}));
          if(shadow?.animate)anims.push(shadow.animate([
            {opacity:.75,scale:'1',offset:0},{opacity:.22,scale:'.5',offset:.2},{opacity:.7,scale:'1.05',offset:.56},{opacity:.4,scale:'.75',offset:.68},{opacity:.75,scale:'1',offset:1}
          ],{duration,easing:'linear'}));
          // The impact sound lands with the cube, not after the animation.
          if(!quiet)setTimeout(()=>window.BS_AUDIO?.play?.('diceImpact',{volume:.3}),Math.round(duration*.56));
          await anims[0].finished;
        }
      }catch{}
      finally{
        for(const a of anims){try{a.cancel()}catch{}}
        set(el,value);el.classList.remove('is-rolling');
        el.classList.add('is-landed');if(value===6&&!el.dataset.bonus)el.classList.add('is-six');
        setTimeout(()=>el.classList.remove('is-landed','is-six'),value===6?1100:600);
      }
      if(!quiet){window.BS_AUDIO?.vibrate?.(18);if(reduce)window.BS_AUDIO?.play?.('diceImpact',{volume:.3});}
      try{el.dispatchEvent(new CustomEvent('bs-die-landed',{bubbles:true,detail:{value}}));}catch{}
    })().finally(()=>running.delete(el));
    running.set(el,task);return task;
  }
  function random(){const limit=4294967292,arr=new Uint32Array(1);do{crypto.getRandomValues(arr)}while(arr[0]>=limit);return arr[0]%6+1;}
  function unit(){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/4294967296;}
  window.BS_DICE={mount,mountBonus,set,roll,random,unit};
  document.querySelectorAll('.die').forEach(el=>{if(!el.classList.contains('bonus-die'))mount(el);});
})();
