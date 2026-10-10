/* Physical six-face cube, unbiased values, and one in-flight roll per die. */
(function(){
 'use strict';
 const faces={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]},rotations={1:[0,0],2:[0,-90],3:[90,0],4:[-90,0],5:[0,90],6:[0,180]},running=new WeakMap();
 function transform(value){const [x,y]=rotations[value]||rotations[1];return `rotateX(${x}deg) rotateY(${y}deg)`}
 function mount(el){
  if(!el||el.dataset.proDie)return;el.dataset.proDie='1';el.classList.add('pro-die');el.innerHTML='';
  const cube=document.createElement('div');cube.className='pro-die-cube';
  for(let n=1;n<=6;n++){const face=document.createElement('div');face.className='pro-face face-'+n;for(const p of faces[n]){const pip=document.createElement('i');pip.className='pro-pip pos-'+p;face.appendChild(pip)}cube.appendChild(face)}
  el.appendChild(cube);set(el,Number(el.dataset.value)||1);
 }
 function set(el,value){if(!rotations[value])return;const cube=el.querySelector('.pro-die-cube');if(cube)cube.style.transform=transform(value);el.dataset.value=value;el.setAttribute('role','img');el.setAttribute('aria-label','نتيجة النرد '+value)}
 function roll(el,value,{quiet=false}={}){
  if(!rotations[value])return Promise.reject(new Error('invalid_die_value'));mount(el);if(running.has(el))return running.get(el);
  const task=(async()=>{
   const cube=el.querySelector('.pro-die-cube'),reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
   el.setAttribute('aria-label','جاري رمي النرد');el.classList.add('is-rolling');let anim;
   if(!quiet){window.BS_AUDIO?.play?.('dice');window.BS_AUDIO?.vibrate?.([12,35,12])}
   try{if(!reduce&&cube.animate){const [x,y]=rotations[value];
    anim=cube.animate([{transform:cube.style.transform,translate:'0 0',scale:'1'},{transform:'rotateX(280deg) rotateY(190deg)',translate:'8px -22px',scale:'1.06',offset:.32},{transform:'rotateX(610deg) rotateY(580deg)',translate:'-6px -7px',offset:.68},{transform:`rotateX(${720+x}deg) rotateY(${720+y}deg)`,translate:'0 2px',scale:'.94',offset:.9},{transform:`rotateX(${720+x}deg) rotateY(${720+y}deg)`,translate:'0 0',scale:'1'}],{duration:920,easing:'cubic-bezier(.2,.62,.28,1)'});
    await anim.finished;
   }}catch{}finally{anim?.cancel();set(el,value);el.classList.remove('is-rolling')}
   if(!quiet){window.BS_AUDIO?.play?.('diceImpact',{volume:.35});window.BS_AUDIO?.vibrate?.(22)}
  })().finally(()=>running.delete(el));running.set(el,task);return task;
 }
 function random(){const limit=4294967292,arr=new Uint32Array(1);do{crypto.getRandomValues(arr)}while(arr[0]>=limit);return arr[0]%6+1}
 function unit(){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/4294967296}
 window.BS_DICE={mount,set,roll,random,unit};document.querySelectorAll('.die').forEach(mount);
})();
