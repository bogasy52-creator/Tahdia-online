(() => {
  const pipPositions={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
  function makeFace(value){
    const face=document.createElement('div');face.className=`lux-die-face f${value}`;face.setAttribute('aria-hidden','true');
    for(const pos of pipPositions[value]){const p=document.createElement('i');p.className=`lux-pip c${pos}`;face.appendChild(p)}
    return face;
  }
  function sizeDie(el){const r=el.getBoundingClientRect();if(r.width)el.style.setProperty('--die-half',`${Math.max(1,r.width/2-1)}px`)}
  function upgradeDie(el){
    if(!el||el.dataset.luxuryDie==='1')return;
    el.dataset.luxuryDie='1';el.setAttribute('role','img');el.setAttribute('aria-label',`نتيجة النرد ${el.dataset.value||1}`);
    el.textContent='';const cube=document.createElement('div');cube.className='luxury-die-cube';for(let i=1;i<=6;i++)cube.appendChild(makeFace(i));el.appendChild(cube);sizeDie(el);
    const obs=new MutationObserver(()=>el.setAttribute('aria-label',`نتيجة النرد ${el.dataset.value||1}`));obs.observe(el,{attributes:true,attributeFilter:['data-value']});
    if('ResizeObserver' in window)new ResizeObserver(()=>sizeDie(el)).observe(el);else window.addEventListener('resize',()=>sizeDie(el),{passive:true});
  }
  function scan(root=document){root.querySelectorAll?.('.die').forEach(upgradeDie)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>scan());else scan();
  new MutationObserver(m=>{for(const x of m)for(const n of x.addedNodes)if(n.nodeType===1){if(n.matches?.('.die'))upgradeDie(n);scan(n)}}).observe(document.documentElement,{childList:true,subtree:true});
  window.BS_LUXURY_UI={upgradeDie,scan};
})();
