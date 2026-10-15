(function(root){
 'use strict';
 const count=value=>Math.max(0,Math.min(100000,Math.floor(Number(value)||0)));
 class BoardJournal{
  constructor(){this.reset();}
  reset(state){this.lastMove=0;this.rows=[];this.players=[];this.partial=Boolean(state?.moveCount);}
  observe(state){
   if(!state)return;const move=count(state.moveCount);if(move<this.lastMove)this.reset(state);if(!move||move===this.lastMove)return;
   if(move>this.lastMove+1)this.partial=true;this.lastMove=move;
   const event=state.lastEvent||{},index=count(event.player),player=state.players[index];if(!player)return;
   const rolls=(event.rolls||[state.lastRoll]).filter(value=>Number.isInteger(value)&&value>=1&&value<=6),stats=this.players[index]||{rolls:0,ladders:0,snakes:0,bonuses:0};
   stats.rolls+=rolls.length;stats.ladders+=Number(event.jumpType==='ladder'||event.bonusJumpType==='ladder');stats.snakes+=Number(event.jumpType==='snake'||event.bonusJumpType==='snake');stats.bonuses+=Number(Boolean(event.bonusRoll));this.players[index]=stats;
   const kind=event.blocked?'blocked':event.waitingEntry?'entry':event.bonusRoll?'bonus':event.jumpType||'move';
   const descriptions={blocked:'رقم زائد · تحتاج الوصول الدقيق',entry:'بانتظار رمية ٦',ladder:'سلم! صعود إلى ',snake:'ثعبان! نزول إلى ',bonus:'مكافأة · الوصول إلى ',move:'وصل إلى '};
   this.rows.unshift({move,index,name:player.name,rolls,position:count(player.position),kind,text:descriptions[kind]+(['entry','blocked'].includes(kind)?'':count(player.position))});this.rows=this.rows.slice(0,12);
  }
  snapshot(){return {lastMove:this.lastMove,players:this.players.map(value=>value?{...value}:null),rows:this.rows.map(row=>({...row,rolls:[...row.rolls]})),partial:this.partial};}
  restore(value){
   if(!value||typeof value!=='object')return;this.lastMove=count(value.lastMove);this.partial=value.partial===true;
   this.players=Array.isArray(value.players)?value.players.slice(0,4).map(value=>value?Object.fromEntries(['rolls','ladders','snakes','bonuses'].map(key=>[key,count(value[key])])):null):[];
   this.rows=Array.isArray(value.rows)?value.rows.slice(0,12).filter(row=>row&&typeof row.name==='string'&&typeof row.text==='string').map(row=>({...row,move:count(row.move),index:count(row.index),name:row.name.slice(0,24),text:row.text.slice(0,100),rolls:Array.isArray(row.rolls)?row.rolls.filter(value=>Number.isInteger(value)&&value>=1&&value<=6):[]})):[];
  }
 }
 class ArenaJournal{
  constructor(){this.reset();}
  reset(game,ids=[]){this.ids=[...ids];this.start=Number(game?.elapsed)||0;this.lastTick=-1;this.players=new Map();this.samples=[];this.lastSample=-1;}
  observe(game,ids=this.ids){
   if(!game)return;if(game.tick<this.lastTick)this.reset(game,ids);if(game.tick===this.lastTick)return;this.lastTick=game.tick;this.ids=[...ids];
   for(const id of ids){const snake=game.snakes.find(snake=>snake.id===id);if(!snake)continue;const value=this.players.get(id)||{id,name:snake.name,peak:0,score:0,kills:0,gathered:0,boosted:false,death:null};value.peak=Math.max(value.peak,count(snake.score));value.score=count(snake.score);value.kills=count(snake.kills);value.gathered=Math.max(0,value.score-value.kills*10);value.boosted=value.boosted||snake.boost===true;if(!snake.alive&&value.death===null)value.death=Math.max(0,game.elapsed-this.start);this.players.set(id,value);}
   if(game.elapsed-this.lastSample>=.5||game.status==='finished'){const own=game.snakes.find(snake=>snake.id===ids[0]);if(own){this.samples.push({time:Math.max(0,game.elapsed-this.start),score:count(own.score)});this.samples=this.samples.slice(-360);this.lastSample=game.elapsed;}}
  }
  summary(game){return [...this.players.values()].map(value=>({...value,survival:Math.max(0,Math.round(value.death??((game?.elapsed||0)-this.start)))}));}
  curve(){const max=Math.max(1,...this.samples.map(value=>value.score)),end=Math.max(1,...this.samples.map(value=>value.time));return this.samples.map(value=>(8+value.time/end*264).toFixed(1)+','+(68-value.score/max*56).toFixed(1)).join(' ');}
 }
 function boardRender(journal,state){
  const target=root.document?.getElementById('boardHistory');if(!target||!journal)return;target.replaceChildren();
  for(const row of journal.rows){const item=root.document.createElement('li'),name=root.document.createElement('b'),copy=root.document.createElement('span');item.dataset.kind=row.kind;name.textContent=row.name+' · '+row.rolls.join(' + ');copy.textContent=row.text;item.append(name,copy);target.appendChild(item);}
  const note=root.document.getElementById('boardHistoryNote');if(note)note.textContent=journal.partial?'السجل من اللحظة التي تابعت فيها هذه الجولة.':journal.rows.length?'آخر 12 حدثًا من الجولة.':'ابدأ الجولة لتظهر الرميات والحركات هنا.';
  const stats=root.document.getElementById('boardRoundStats');if(!stats)return;stats.replaceChildren();for(const [index,player]of state.players.entries()){const value=journal.players[index]||{rolls:0,ladders:0,snakes:0,bonuses:0},row=root.document.createElement('div'),name=root.document.createElement('b'),copy=root.document.createElement('span');name.textContent=player.name;copy.textContent=value.rolls+' رميات · '+value.ladders+' سلالم · '+value.snakes+' ثعابين · '+value.bonuses+' مكافآت';row.append(name,copy);stats.appendChild(row);}
 }
 let tempo='normal';try{tempo=root.localStorage.getItem('tahdia-board-tempo-v15')||'normal'}catch{}
 root.BS_PLAY_INSIGHTS=Object.freeze({board:()=>new BoardJournal(),arena:()=>new ArenaJournal(),boardRender,motionScale:()=>tempo==='fast'?.45:1,setTempo(value){tempo=value==='fast'?'fast':'normal';try{root.localStorage.setItem('tahdia-board-tempo-v15',tempo)}catch{}}});
})(globalThis);
