import {createJewels, jewelPaths, moveJewels, adjacent} from '../public/assets/js/engines/journey-engine.js';
export function solveJewels(level=1,daily='') {
  let state=createJewels(level,daily);
  while(!state.over){
    let best=null,bestValue=-Infinity,budget=12000;
    const needsColor=state.colorCount<state.colorGoal;
    const visit=path=>{
      if(--budget<0)return;
      if(path.length>=3){const value=path.length+(path.length>=7?5:0)+(needsColor&&state.board[path[0]]===state.targetColor?11:0);if(value>bestValue){bestValue=value;best=[...path];}}
      if(path.length>=10)return;
      const last=path.at(-1);
      for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){const cell=last+y*state.size+x;if(!path.includes(cell)&&adjacent(last,cell,state.size,true)&&state.board[cell]===state.board[last])visit([...path,cell]);}
    };
    for(let i=0;i<state.board.length;i++)visit([i]);
    if(!best)best=jewelPaths(state)[0];
    state=moveJewels(state,best).state;
  }
  return state;
}
