// Display order only: the room's seat indexes and turn authority never change.
export function diceStandings(state){
 const rows=(state?.players||[]).map((player,seat)=>({player,seat,score:Number(player.score)||0}));
 rows.sort((a,b)=>b.score-a.score||a.seat-b.seat);
 return rows.map((row,i)=>({...row,rank:rows.findIndex(p=>p.score===row.score)+1,tied:rows.some(p=>p.seat!==row.seat&&p.score===row.score)}));
}
export function renderDiceLeaderboard({box,state,me,playerAt,botTag,colors}){
 if(!box||!state)return;
 const doc=box.ownerDocument, make=(tag,cls,text)=>{const el=doc.createElement(tag);el.className=cls;if(text!==undefined)el.textContent=text;return el;};
 const labels=['','الأول','الثاني','الثالث'];
 box.replaceChildren();box.setAttribute('role','list');box.setAttribute('aria-label','ترتيب اللاعبين حسب النقاط المثبّتة');
 for(const {player:p,seat,score,rank,tied} of diceStandings(state)){
  const active=state.turn===seat&&state.winner===null,row=make('div','player-row dice-ranked-row'+(active?' turn':'')+(seat===me?' is-me':''));
  row.dataset.seat=seat;row.dataset.rank=rank;row.setAttribute('role','listitem');
  const medal=make('span','dice-rank',rank<=3?['','١','٢','٣'][rank]:String(rank));medal.setAttribute('aria-label',labels[rank]||'المركز '+rank);
  const dot=make('i','player-dot');dot.style.background=colors[seat%colors.length];
  const copy=make('div','dice-ranked-copy'),name=make('b','',String(p.name)+(seat===me?' · أنت':'')),tag=botTag?.(playerAt?.(seat));if(tag)name.append(tag);
  globalThis.BS_LEGEND_FRAMES?.decorateName?.(name,playerAt?.(seat)?.look?.frame);
  const position=labels[rank]||'المركز '+rank;
  copy.append(name,make('div','mini-note',position+(tied?' · تعادل':'')+(active&&state.turnTotal?' · +'+state.turnTotal+' غير مثبّتة':'')));
  const points=make('span','score',score),bar=make('i','dice-progress-v33');bar.style.setProperty('--p',Math.min(100,Math.round(score/(state.target||50)*100))+'%');bar.style.setProperty('--c',colors[seat%colors.length]);
  row.append(medal,dot,copy,points,bar);box.append(row);
 }
}
