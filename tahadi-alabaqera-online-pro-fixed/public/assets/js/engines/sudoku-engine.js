import {SUDOKU_STAGES}from'./sudoku-stages.js';
import {solveSudoku,sudokuConflicts,sudokuLogicalStep,validSudokuArray}from'./sudoku-core.js';
export const SUDOKU_VERSION=4,SUDOKU_STAGE_COUNT=120;
export const SUDOKU_TIERS=['بداية هادئة','تركيز','تفكير عميق','خبير','تحدي الماستر'];
const answers=new Map();
function seedOf(text){let n=2166136261;for(const c of String(text))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0||1;}
function transform(code,seed){const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;},shuffle=rows=>{rows=[...rows];for(let i=rows.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[rows[i],rows[j]]=[rows[j],rows[i]];}return rows;},groups=()=>shuffle([0,1,2]).flatMap(g=>shuffle([0,1,2]).map(i=>g*3+i)),rows=groups(),cols=groups(),digits=shuffle([1,2,3,4,5,6,7,8,9]);let board=rows.flatMap(r=>cols.map(c=>code[r*9+c]==='0'?0:digits[Number(code[r*9+c])-1]));if(random()<.5)board=board.map((_,i)=>board[i%9*9+Math.floor(i/9)]);return board;}
function answer(state){const key=state.initial.join('');if(!answers.has(key)){const result=solveSudoku(state.initial);if(result.count!==1||result.limited)throw Error('invalid_puzzle');answers.set(key,result.solution);if(answers.size>180)answers.delete(answers.keys().next().value);}return answers.get(key);}
export function createSudoku(level=1,daily=''){
  if(!Number.isInteger(level)||level<1||level>SUDOKU_STAGE_COUNT||daily&&!/^\d{4}-\d{2}-\d{2}$/.test(daily))throw Error('invalid_stage');
  const index=daily?72+seedOf(daily+'sudoku')%48:level-1,stage=SUDOKU_STAGES[index];if(!stage)throw Error('missing_puzzle');
  const initial=daily?transform(stage.code,seedOf('tahdia-sudoku:'+daily)):[...stage.code].map(Number);
  return {game:'sudoku',engineVersion:SUDOKU_VERSION,level,daily,tier:stage.tier,number:index+1,initial,board:[...initial],history:[],moves:0,hints:0,checks:0,won:false,log:[]};
}
export function sudokuHint(state){
  const solved=answer(state),wrong=state.board.findIndex((v,i)=>v&&v!==solved[i]);
  if(wrong>=0)return {cell:wrong,value:0,method:'مراجعة إدخال',reason:sudokuConflicts(state.board).includes(wrong)?'هذا الإدخال يكرر رقمًا في صف أو عمود أو مربع. امسحه ثم راجع الاحتمالات.':'هذا الإدخال يمنع اكتمال الحل الوحيد للمرحلة. نزيله لتعيد التفكير فيه.'};
  const logical=sudokuLogicalStep(state.board);if(logical)return logical;
  const cell=state.board.findIndex(v=>!v);return cell<0?null:{cell,value:solved[cell],method:'تحليل متقدم',reason:'بعد تحليل الفروع الممكنة ومقارنتها بالحل الوحيد، هذا الرقم ثابت في هذه الخانة.'};
}
export function moveSudoku(raw,action){
  if(!raw||raw.game!=='sudoku'||raw.won||!action||raw.log.length>=2000)return {state:raw,accepted:false};
  const state=structuredClone(raw);let row;
  if(action.undo===true){const old=state.history.pop();if(!old)return {state:raw,accepted:false};state.board[old.cell]=old.value;row={undo:true};}
  else if(action.check===true){state.checks++;row={check:true};}
  else{let cell=action.cell,value=action.value;if(action.hint===true){if(state.hints>=3)return {state:raw,accepted:false};const hint=sudokuHint(state);if(!hint)return {state:raw,accepted:false};({cell,value}=hint);state.hints++;row={hint:true};}
    if(!Number.isInteger(cell)||cell<0||cell>=81||!Number.isInteger(value)||value<0||value>9||state.initial[cell]||state.board[cell]===value)return {state:raw,accepted:false};
    state.history.push({cell,value:state.board[cell]});state.board[cell]=value;state.moves++;row||={cell,value};
  }
  state.log.push(row);state.won=!state.board.includes(0)&&sudokuConflicts(state.board).length===0;return {state,accepted:true};
}
export function sudokuWrongCells(state){const solved=answer(state);return state.board.flatMap((v,i)=>v&&v!==solved[i]?[i]:[]);}
export function sudokuStars(state){return !state?.won?0:state.hints===0&&state.checks===0?3:state.hints<=1&&state.checks<=2?2:1;}
export function restoreSudoku(proof,{requireWin=false}={}){
  if(proof?.engineVersion!==SUDOKU_VERSION||proof.game!=='sudoku'||!Number.isInteger(proof.level)||proof.level<1||proof.level>120||!Array.isArray(proof.log)||proof.log.length>2000)throw Error('invalid_proof');let state=createSudoku(proof.level,proof.daily||'');
  for(const row of proof.log){if(state.won)throw Error('moves_after_finish');const result=moveSudoku(state,row);if(!result.accepted)throw Error('invalid_move');state=result.state;}
  if(requireWin&&!state.won)throw Error('stage_incomplete');return state;
}
export function validSudokuNotes(notes){return Array.isArray(notes)&&notes.length===81&&notes.every(n=>Number.isInteger(n)&&n>=0&&n<=511);}
export {sudokuConflicts,validSudokuArray};
