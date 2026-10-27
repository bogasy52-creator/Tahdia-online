import {previewJackarooAction} from './engines/jackaroo-engine.js?v=33.0.0';
import {applyLudoMove} from './engines/ludo-engine.js?v=33.0.0';
import {boardGeometry} from './engines/board-geometry-v29.js?v=33.0.0';
import {paintBoardPreview,clearBoardPreview} from './board-petals-v29.js?v=33.0.0';
export function previewBoardAction(game,state,action,{card='',roll=0}={}){
 const next=game==='jackaroo'?previewJackarooAction(state,action,card):applyLudoMove(state,action.token,roll),key=game==='jackaroo'?'marbles':'tokens',g=boardGeometry(state),changes=[];
 state.players.forEach((p,seat)=>p[key].forEach((from,index)=>{const to=next.players[seat][key][index];if(from!==to)changes.push({seat,index,from,to});}));
 const moving=changes.filter(x=>x.to>=0),captures=changes.filter(x=>x.to<0),finish=moving.filter(x=>x.to===g.finish).length;
 const kind=action.type==='discard'?'حرق الورقة لعدم وجود حركة قانونية':action.type==='split7'?'تقسيم السبعة: '+action.first.steps+' + '+action.second.steps:action.type==='swap'?'تبديل حجرين':action.type==='enter'||moving.some(x=>x.from<0)?'إخراج حجر إلى البداية':action.backward?'الرجوع للخلف '+action.steps+' خانات':'تحريك '+moving.length+' '+(moving.length===1?'حجر':'أحجار');
 const description=kind+(captures.length?' · أكل '+captures.length+' حجر':'')+(finish?' · وصول '+finish+' للنهاية':'');
 return {next,changes,description};
}
const boardPreviewPending=new WeakMap();
export function requestBoardPreview({board,container=board.parentElement,state,game,action,card='',roll=0,valid=()=>true,commit,toast=()=>{}}){
 boardPreviewPending.get(board)?.();const preview=previewBoardAction(game,state,action,{card,roll}),doc=board.ownerDocument,panel=doc.createElement('section');panel.className='board-preview-v34';panel.setAttribute('aria-label','معاينة الحركة');
 const previousFocus=doc.activeElement;const text=doc.createElement('p');text.textContent=preview.description+(preview.changes.length?'؛ راجع المسار المرسوم ثم أكّد.':'؛ أكّد إنهاء الدور أو ألغِ.');const buttons=doc.createElement('div');buttons.className='preview-actions';
 const confirm=doc.createElement('button'),cancel=doc.createElement('button');confirm.type=cancel.type='button';confirm.className='bs-btn primary';cancel.className='bs-btn';confirm.textContent='تأكيد الحركة';cancel.textContent='إلغاء';buttons.append(confirm,cancel);panel.append(text,buttons);
 const syncHost=()=>{const host=doc.fullscreenElement||doc.webkitFullscreenElement||doc.body||container;if(panel.parentElement!==host)host.append(panel);};
 const cleanup=()=>{clearBoardPreview(board);panel.remove();board.removeEventListener('bs-board-render',cleanup);doc.removeEventListener('fullscreenchange',syncHost);doc.removeEventListener('webkitfullscreenchange',syncHost);if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});if(boardPreviewPending.get(board)===cleanup)boardPreviewPending.delete(board);};
 cancel.onclick=cleanup;confirm.onclick=()=>{const allowed=valid();cleanup();if(allowed)commit?.();else toast('تغير الدور أو الاختيار؛ اختر حركتك من جديد.');};
 panel.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();cleanup();}};boardPreviewPending.set(board,cleanup);paintBoardPreview(board,state,preview.next,{game,action});syncHost();doc.addEventListener('fullscreenchange',syncHost);doc.addEventListener('webkitfullscreenchange',syncHost);board.addEventListener('bs-board-render',cleanup,{once:true});confirm.focus({preventScroll:true});return cleanup;
}
