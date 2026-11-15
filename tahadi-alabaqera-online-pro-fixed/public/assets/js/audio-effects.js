export function createEffectsChannel(host=globalThis.window||globalThis){
 let context=null,output=null;
 const volume=()=>{const s=host.BS_AUDIO?.getSettings?.()||{},n=Number(s.volume??.72);return s.muted||s.effects===false?0:Number.isFinite(n)?Math.max(0,Math.min(1,n)):.72;};
 const sync=()=>{if(output)output.gain.setValueAtTime(volume(),context.currentTime);};
 host.addEventListener?.('bs-audio-change',sync);
 return {unlock(){try{const Audio=host.AudioContext||host.webkitAudioContext||globalThis.AudioContext;if(!Audio)return null;if(!context){context=new Audio();output=context.createGain();output.connect(context.destination);}sync();context.resume?.()?.catch?.(()=>{});}catch{return null;}return context;},get output(){sync();return output;},enabled(){sync();return Boolean(context&&context.state==='running'&&volume()>0);},suspend(){context?.suspend?.()?.catch?.(()=>{});},dispose(){host.removeEventListener?.('bs-audio-change',sync);context?.close?.()?.catch?.(()=>{});context=output=null;}};
}
