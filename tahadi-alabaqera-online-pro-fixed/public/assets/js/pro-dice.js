/* Physical six-face cube, unbiased values, and one in-flight roll per die. */
(function(){
 'use strict';
 const faces={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]},rotations={1:[0,0],2:[0,-90],3:[90,0],4:[-90,0],5:[0,90],6:[0,180]},running=new WeakMap();
 function transform(value){const [x,y]=rotations[value]||rotations[1];return `rotateX(${x}deg) rotateY(${y}deg)`}
 const bonusNames=['حماية واحدة','دوران إضافيان','نردان','تقدّم 3','تقدّم 5','تجميد الخصم'];
 const symbols=[
 '<path d="M24 5 40 11v14c0 10-9 16-16 20C17 41 8 35 8 25V11Z"/><path d="m16 24 6 6 11-13"/>',
 '<path d="M38 18a16 16 0 1 0 1 13M38 6v13H25"/><text x="24" y="31">2</text>',
 '<rect x="5" y="16" width="22" height="22" rx="5"/><rect x="21" y="6" width="22" height="22" rx="5"/><circle cx="14" cy="25" r="2"/><circle cx="23" cy="33" r="2"/><circle cx="30" cy="15" r="2"/><circle cx="36" cy="21" r="2"/>',
 '<path d="m6 20 8-8 8 8m-8-8v26"/><text x="34" y="31">3</text>',
 '<path d="m6 20 8-8 8 8m-8-8v26"/><text x="34" y="31">5</text>',
 '<path d="M24 4v40M7 14l34 20M7 34l34-20m-23-3 6 6 6-6m-12 26 6-6 6 6M9 20l8-3-1-8m16 31-1-8 8-3M9 28l8 3-1 8m16-31-1 8 8 3"/>'
 ];
 function mount(el,bonus=false){
  if(!el||el.dataset.proDie)return;el.dataset.proDie='1';el.classList.add('pro-die');el.innerHTML='';
  const cube=document.createElement('div');cube.className='pro-die-cube';
  for(let n=1;n<=6;n++){const face=document.createElement('div');face.className='pro-face face-'+n;const rim=document.createElement('span');rim.className='pro-face-rim';rim.setAttribute('aria-hidden','true');face.appendChild(rim);if(bonus){face.innerHTML=`<svg viewBox="0 0 48 48" aria-hidden="true">${symbols[n-1]}</svg>`;}else for(const p of faces[n]){const pip=document.createElement('i');pip.className='pro-pip pos-'+p;face.appendChild(pip)}cube.appendChild(face)}
  if(bonus)el.dataset.bonus='true';
  const flight=document.createElement('div'),shadow=document.createElement('i');flight.className='pro-die-flight';shadow.className='pro-die-shadow';shadow.setAttribute('aria-hidden','true');flight.appendChild(cube);el.append(shadow,flight);set(el,Number(el.dataset.value)||1);
 }
 function mountBonus(el){mount(el,true)}
 function set(el,value){if(!rotations[value])return;const cube=el.querySelector('.pro-die-cube');if(cube)cube.style.transform=transform(value);el.dataset.value=value;el.setAttribute('role','img');el.setAttribute('aria-label',el.dataset.bonus?'نرد المكافآت: '+bonusNames[value-1]:'نتيجة النرد '+value)}
 function roll(el,value,{quiet=false}={}){
  if(!rotations[value])return Promise.reject(new Error('invalid_die_value'));mount(el);if(running.has(el))return running.get(el);
  const task=(async()=>{
   const cube=el.querySelector('.pro-die-cube'),reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
   el.setAttribute('aria-label','جاري رمي النرد');el.classList.add('is-rolling');let anim,lift,shadow;
   if(!quiet){window.BS_AUDIO?.play?.('dice');window.BS_AUDIO?.vibrate?.([12,35,12])}
   try{if(!reduce&&cube.animate){const [x,y]=rotations[value];
    const final=`rotateX(${720+x}deg) rotateY(${720+y}deg)`;
    anim=cube.animate([{transform:cube.style.transform,offset:0},{transform:'rotateX(155deg) rotateY(115deg) rotateZ(-18deg)',offset:.18},{transform:'rotateX(385deg) rotateY(325deg) rotateZ(22deg)',offset:.42},{transform:'rotateX(605deg) rotateY(560deg) rotateZ(-9deg)',offset:.63},{transform:final,offset:.77},{transform:final,offset:1}],{duration:1180,easing:'linear'});
    lift=el.querySelector('.pro-die-flight').animate([{translate:'0 0',scale:'1',offset:0},{translate:'-10px -18px',scale:'1.02',offset:.10},{translate:'-15px -42px',scale:'1.02',offset:.26},{translate:'4px -24px',scale:'1',offset:.44},{translate:'11px 3px',scale:'1.07 .92',offset:.62},{translate:'5px -14px',scale:'.99 1.02',offset:.73},{translate:'0 2px',scale:'1.03 .97',offset:.83},{translate:'0 -4px',scale:'1',offset:.90},{translate:'0 0',scale:'1',offset:1}],{duration:1180,easing:'linear'});
    shadow=el.querySelector('.pro-die-shadow').animate([{opacity:.8,scale:'1',offset:0},{opacity:.2,scale:'.55',offset:.26},{opacity:.8,scale:'1.08',offset:.62},{opacity:.5,scale:'.8',offset:.73},{opacity:.8,scale:'1',offset:1}],{duration:1180,easing:'linear'});
    await anim.finished;
   }}catch{}finally{anim?.cancel();lift?.cancel();shadow?.cancel();set(el,value);el.classList.remove('is-rolling')}
   if(!quiet){window.BS_AUDIO?.play?.('diceImpact',{volume:.35});window.BS_AUDIO?.vibrate?.(22)}
  })().finally(()=>running.delete(el));running.set(el,task);return task;
 }
 function random(){const limit=4294967292,arr=new Uint32Array(1);do{crypto.getRandomValues(arr)}while(arr[0]>=limit);return arr[0]%6+1}
 function unit(){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/4294967296}
 window.BS_DICE={mount,mountBonus,set,roll,random,unit};document.querySelectorAll('.die').forEach(el=>{if(!el.classList.contains('bonus-die'))mount(el)});
})();
