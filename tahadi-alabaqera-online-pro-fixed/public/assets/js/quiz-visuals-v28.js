(() => {
 let viewer=null,restoreFocus=null;
 function close(){if(!viewer)return;const old=viewer;viewer=null;old.close?.();old.remove();restoreFocus?.focus?.();restoreFocus=null;}
 function inspect(source){
  close();restoreFocus=document.activeElement;
  const dialog=document.createElement('dialog');dialog.className='quiz-image-viewer';dialog.setAttribute('aria-label','استكشاف الصورة الكاملة');
  const toolbar=document.createElement('div');toolbar.className='image-viewer-tools';
  const stage=document.createElement('div');stage.className='image-viewer-stage';
  const image=document.createElement('img');image.src=source.currentSrc||source.src;image.alt='الصورة الكاملة بعد كشف التحدي';image.draggable=false;stage.append(image);
  let scale=1,x=0,y=0,drag=null;const pointers=new Map();let pinch=0;
  const paint=()=>{const boundX=stage.clientWidth*(scale-1)/2,boundY=stage.clientHeight*(scale-1)/2;x=Math.max(-boundX,Math.min(boundX,x));y=Math.max(-boundY,Math.min(boundY,y));image.style.transform=`translate(${x}px,${y}px) scale(${scale})`;};
  const zoom=change=>{scale=Math.max(1,Math.min(4,scale+change));paint();};
  const button=(text,action)=>{const node=document.createElement('button');node.type='button';node.textContent=text;node.onclick=action;toolbar.append(node);return node;};
  button('＋ تكبير',()=>zoom(.5));button('− تصغير',()=>zoom(-.5));button('إعادة ضبط',()=>{scale=1;x=y=0;paint();});const dismiss=button('إغلاق ✕',close);
  const note=document.createElement('p');note.textContent='اسحب للتنقل بعد التكبير، أو استخدم إصبعين.';
  stage.addEventListener('pointerdown',event=>{pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});stage.setPointerCapture?.(event.pointerId);drag={x:event.clientX,y:event.clientY};if(pointers.size===2){const [a,b]=[...pointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);}});
  stage.addEventListener('pointermove',event=>{if(!pointers.has(event.pointerId))return;const before=pointers.get(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinch>0)scale=Math.max(1,Math.min(4,scale*distance/pinch));pinch=distance;}else if(drag){x+=event.clientX-before.x;y+=event.clientY-before.y;}paint();});
  const release=event=>{pointers.delete(event.pointerId);pinch=0;drag=null;};stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',release);
  stage.addEventListener('wheel',event=>{event.preventDefault();zoom(event.deltaY<0?.2:-.2);},{passive:false});
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.append(toolbar,stage,note);document.body.append(dialog);viewer=dialog;
  if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');dismiss.focus();
 }
 function attach(image,frame){
  frame.classList.add('quiz-image-stage','is-loading');image.loading='eager';image.decoding='async';
  const status=document.createElement('span');status.className='quiz-image-status';status.textContent='تحميل الصورة…';status.setAttribute('role','status');frame.append(status);
  const loaded=()=>{frame.classList.remove('is-loading','is-error');status.remove();frame.querySelector('.quiz-image-retry')?.remove();};
  image.addEventListener('load',loaded);image.addEventListener('error',()=>{frame.classList.remove('is-loading');frame.classList.add('is-error');status.textContent='تعذر تحميل الصورة. تحقق من الاتصال.';if(!status.parentElement)frame.append(status);if(!frame.querySelector('.quiz-image-retry')){const retry=document.createElement('button');retry.type='button';retry.className='quiz-image-retry';retry.textContent='إعادة تحميل الصورة';retry.onclick=()=>{frame.classList.add('is-loading');image.src=image.src;};frame.append(retry);}});
  if(image.complete&&image.naturalWidth>0)loaded();
 }
 function reveal(image){
  const frame=image.parentElement;if(!frame)return;frame.classList.add('is-revealed');image.style.transform='scale(1)';image.style.objectFit='contain';
  const badge=frame.querySelector('.zoomStage');if(badge)badge.textContent='الصورة الكاملة';
  if(!frame.querySelector('.quiz-image-inspect')){const button=document.createElement('button');button.type='button';button.className='quiz-image-inspect';button.textContent='توسيع الصورة ⤢';button.onclick=()=>inspect(image);frame.append(button);}
 }
 window.BS_QUIZ_VISUALS=Object.freeze({attach,reveal,close});window.addEventListener('pagehide',close);
})();
