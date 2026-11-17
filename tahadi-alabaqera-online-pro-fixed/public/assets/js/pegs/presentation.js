// Keep the familiar table perspective. The eight-color game uses a color-changing
// cube: its appearance is presentation only; the server chooses the result.
export function pegsCameraElevation(aspect,showcase=false){
 return showcase?32:aspect<.75?55:aspect<1.1?50:42;
}
export const pegsPawnScale=large=>large?.82:1;
export function pegsDieFace(color){
 if(!Number.isInteger(color)||color<0||color>7)throw Error('invalid die color');
 return color%6;
}
export function pegsDiePalette(color){
 const faces=[0,1,2,3,4,5];faces[pegsDieFace(color)]=color;return faces;
}
