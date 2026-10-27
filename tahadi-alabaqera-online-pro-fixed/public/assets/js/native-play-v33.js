// These controls are used by both the standalone games and the playlist room.
export function createPuzzleTiles(doc,tiles,{active=true,onMove}={}){
 const board=doc.createElement('div');board.className='arcade-arena puzzle-grid';board.dir='ltr';
 tiles.forEach((tile,index)=>{const b=doc.createElement('button');b.type='button';b.className='puzzle-tile'+(!tile?' empty':'');b.textContent=tile||'';b.disabled=!tile||!active;b.setAttribute('aria-label',tile?'تحريك '+tile:'الخانة الفارغة');b.onclick=()=>onMove?.(index);board.append(b);});return board;
}
export function createAnswerChoices(doc,options,{selected=-1,disabled=false,onChoose,className='choices'}={}){
 const grid=doc.createElement('div');grid.className=className;options.forEach((option,i)=>{const b=doc.createElement('button');b.type='button';b.className=(className==='logic-options'?'bs-btn':'choice')+(selected===i?' selected':'');b.textContent=option;b.disabled=disabled;b.onclick=()=>onChoose?.(i,grid);grid.append(b);});return grid;
}
export function createReactionPad(doc,{ready=false,pressed=false,disabled=false,onPress}={}){
 const b=doc.createElement('button');b.type='button';b.className='reaction-pad'+(ready?' ready':'');const title=doc.createElement('b'),note=doc.createElement('span');title.textContent=pressed?'تم تسجيل الضغط':ready?'اضغط الآن!':'انتظر اللون الأخضر';note.textContent=pressed?'استعد للمحاولة التالية':ready?'الحين وقتك':'لا تضغط الآن';b.append(title,note);b.disabled=disabled||pressed;b.onclick=onPress;return b;
}
export function createPlayingCard(doc,card,{selected=false,disabled=false,onSelect}={}){
 const b=doc.createElement(card==='?'?'div':'button');b.className='playing-card';if(card==='?'){b.classList.add('card-back');return b;}
 const rank=String(card).slice(0,-1),s=String(card).slice(-1),face=['J','Q','K'].includes(rank),symbol={S:'♠',H:'♥',D:'♦',C:'♣'}[s]||'◆';b.type='button';if(s==='H'||s==='D')b.classList.add('red');if(face)b.classList.add('face');if(selected)b.classList.add('selected');b.setAttribute('aria-label',rank+' '+({S:'بستوني',H:'كبة',D:'ديناري',C:'سباتي'}[s]||''));
 for(const [cls,value]of[['rank',rank],['suit-corner',symbol],['suit',symbol],['corner-flip',rank]]){const span=doc.createElement('span');span.className=cls;span.textContent=value;if(cls==='suit')span.dataset.face=face?rank:'';if(cls==='suit-corner'||cls==='corner-flip')span.setAttribute('aria-hidden','true');b.append(span);}b.disabled=disabled;b.onclick=onSelect;return b;
}
export function buildSnakesCells(board,{jumps={},bonusCells=[],inspect}={}){
 const doc=board.ownerDocument;board.replaceChildren();board.setAttribute('dir','ltr');for(let row=9;row>=0;row--)for(let x=0;x<10;x++){const n=row*10+(row%2?10-x:x+1),cell=doc.createElement('div'),jump=jumps[n];cell.className='snake-cell'+((row+x)%2?' tile-alt':'');cell.dataset.n=n;const label=doc.createElement('b'),stack=doc.createElement('div');label.textContent=n;stack.className='token-stack';cell.append(label,stack);if(jump){cell.classList.add(jump>n?'ladder-foot-cell':'snake-head-cell');const marker=doc.createElement('span');marker.className='jump-mark';marker.textContent=jump>n?'🪜':'🐍';cell.append(marker);}if(bonusCells.includes(n)){cell.classList.add('bonus-cell');const bonus=doc.createElement('span');bonus.className='bonus-marker';bonus.textContent='✦';bonus.setAttribute('aria-hidden','true');cell.append(bonus);}cell.tabIndex=0;cell.setAttribute('role','button');cell.setAttribute('aria-label','الخانة '+n+(jump?'، '+(jump>n?'سلم':'ثعبان')+' إلى '+jump:'')+(bonusCells.includes(n)?'، نرد مكافآت':''));cell.onclick=()=>inspect?.(n,jump,cell);cell.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();inspect?.(n,jump,cell);}};board.append(cell);}return board;
}
export function snakeCellPoint(n){const row=Math.floor((n-1)/10),index=(n-1)%10;return{x:((row%2?9-index:index)+.5)*100,y:(9-row+.5)*100};}

export function createMemoryChallenge(memory,area,opts={}){
  const document=area.ownerDocument,serverNow=opts.now||Date.now;
  const mem=memory||{},panel=document.createElement('div');panel.className='memoryPanel';
  const head=document.createElement('div');head.className='memoryHeader';const title=document.createElement('b');title.textContent='🧠 '+(mem.caption||'احفظ ما يظهر');const count=document.createElement('span');count.className='memoryCountdown';head.append(title,count);
  const stage=document.createElement('div');stage.className='memoryStage';
  const seq=(items,extra='')=>{const d=document.createElement('div');d.className='memorySequence '+extra;(items||[]).forEach(x=>{const s=document.createElement('span');s.textContent=typeof x==='string'?x:(x?.label||'');d.appendChild(s)});stage.appendChild(d)};
  if(mem.kind==='digits'){const d=document.createElement('div');d.className='memoryDigits';d.textContent=mem.value||'';stage.appendChild(d)}
  else if(mem.kind==='words')seq(mem.items,'memoryWords');
  else if(mem.kind==='colors'){const d=document.createElement('div');d.className='memorySequence memoryColors';(mem.items||[]).forEach(x=>{const s=document.createElement('span');s.style.background=x.color||'#777';s.title=x.label||'';d.appendChild(s)});stage.appendChild(d)}
  else if(mem.kind==='grid'){const d=document.createElement('div');d.className='memoryGrid';d.style.gridTemplateColumns='repeat('+Math.max(2,Math.min(4,Number(mem.cols)||3))+',1fr)';(mem.items||[]).forEach(x=>{const s=document.createElement('span');s.textContent=x;d.appendChild(s)});stage.appendChild(d)}
  else if(mem.kind==='photo'){const im=document.createElement('img');im.className='memoryPhoto';im.src=mem.src||'';im.alt='صورة تحدي الذاكرة';stage.appendChild(im)}
  else seq(mem.items,'');
  const note=document.createElement('div');note.className='memoryReadyNote';note.textContent='بعد اختفاء المحتوى يبدأ وقت الإجابة';panel.append(head,stage,note);area.appendChild(panel);
  if(opts.revealed){panel.classList.add('revealed');count.remove();note.textContent='المحتوى الذي ظهر في تحدي الذاكرة';return 0}
  const end=opts.endAt||serverNow()+Math.min(8000,Math.max(2500,Number(mem.previewMs)||4500));
  const tick=()=>{if(opts.current&&!opts.current())return;const ms=Math.max(0,end-serverNow());count.textContent='احفظ • '+Math.ceil(ms/1000)+'ث';if(ms<=0){const after=document.createElement('div');after.className='memoryAfter';after.innerHTML='<div><strong>اختفى المحتوى 👀</strong><span>جاوب الآن من ذاكرتك</span></div>';stage.replaceWith(after);count.textContent='وقت الإجابة';note.textContent='لا يمكن إعادة عرض التحدي';return}requestAnimationFrame(tick)};tick();return Math.max(0,end-serverNow())
}
