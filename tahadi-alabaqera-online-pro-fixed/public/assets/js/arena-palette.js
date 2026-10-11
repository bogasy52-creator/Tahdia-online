export const ARENA_HUES=Object.freeze({17:350,54:173,62:211,64:40,68:40,87:274,93:155,95:321,99:193});
export function cosmeticSnakeHue(id,from){
 if(id==='snake-plasma')return [193,274,310][Math.abs(Number(from)||0)%3];
 return {'snake-gold':40,'snake-aurora':274,'snake-ice':193,'snake-toxic':103}[id]??ARENA_HUES[from]??211;
}

// Recolor blue armor only. Keep the artist's purple mouth, ivory teeth,
// shadows and alpha edges instead of rotating every color in the picture.
export function recolorBluePixels(data,targetHue){
 for(let i=0;i<data.length;i+=4){
  if(!data[i+3])continue;
  const r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255,max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
  if(!max||delta/max<.22)continue;
  let h=max===r?((g-b)/delta)%6:max===g?(b-r)/delta+2:(r-g)/delta+4;h=(h*60+360)%360;
  if(h<175||h>255)continue;
  const hue=((targetHue+(h-211)*.24)%360+360)%360/60;
  const value=max*.96,saturation=Math.min(.96,delta/max*1.04),c=value*saturation,x=c*(1-Math.abs(hue%2-1)),m=value-c;
  const rgb=hue<1?[c,x,0]:hue<2?[x,c,0]:hue<3?[0,c,x]:hue<4?[0,x,c]:hue<5?[x,0,c]:[c,0,x];
  for(let k=0;k<3;k++)data[i+k]=Math.round((rgb[k]+m)*255);
 }
 return data;
}
