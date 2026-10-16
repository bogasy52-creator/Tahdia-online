import {PICTURE_THEMES} from '../../public/assets/js/engines/image-puzzle.js';
export function imageGenerationConfig(env){return {enabled:Boolean(env.AI_IMAGE_API_KEY),model:env.AI_IMAGE_MODEL||'gpt-image-2',dailyLimit:Math.min(10,Math.max(1,Math.floor(Number(env.AI_IMAGE_DAILY_LIMIT)||3)))};}
export async function generatePuzzleImage(env,themeId,{description='',fetcher=fetch}={}){
  const cfg=imageGenerationConfig(env),theme=PICTURE_THEMES.find(x=>x.id===themeId);
  if(!cfg.enabled)throw new Error('not_configured');
  if(!theme)throw new Error('invalid_theme');
  const detail=String(description).normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,180);
  const prompt=`Original premium miniature 3D storybook game art: ${theme.scene}. ${detail?`Additional visual description: ${detail}.`:''} Square scene with rich distinct details in every quadrant for a tile swapping puzzle. Warm light, teal and brass accents, tactile materials. No text, letters, numbers, logos, watermark or UI. Family friendly.`;
  const res=await fetcher('https://api.openai.com/v1/images/generations',{method:'POST',headers:{authorization:'Bearer '+env.AI_IMAGE_API_KEY,'content-type':'application/json'},body:JSON.stringify({model:cfg.model,prompt,n:1,size:'1024x1024',quality:'medium',output_format:'webp',output_compression:80}),signal:AbortSignal.timeout(120000)});
  if(!res.ok||Number(res.headers.get('content-length'))>2500000)throw new Error('generation_failed');
  const raw=await res.text();if(raw.length>2500000)throw new Error('invalid_image');
  let data;try{data=JSON.parse(raw)}catch{throw new Error('invalid_image')}
  const b64=data?.data?.[0]?.b64_json;
  if(typeof b64!=='string'||b64.length<44||b64.length>2100000||!/^[A-Za-z0-9+/]*={0,2}$/.test(b64))throw new Error('invalid_image');
  let bytes;try{bytes=Uint8Array.from(atob(b64),x=>x.charCodeAt(0))}catch{throw new Error('invalid_image')}
  if(bytes.length<32||String.fromCharCode(...bytes.slice(0,4))!=='RIFF'||String.fromCharCode(...bytes.slice(8,12))!=='WEBP')throw new Error('invalid_image');
  return {bytes:bytes.buffer,contentType:'image/webp',theme:theme.id};
}
