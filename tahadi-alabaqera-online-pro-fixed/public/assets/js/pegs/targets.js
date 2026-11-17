// Voronoi selection around visible pawn heads: overlapping bodies never steal a tap.
export function nearestPegsTarget(x,y,points,pegs,radius=28){
 let best=-1,distance=radius*radius;
 for(let i=0;i<points.length;i++){
  if(pegs[i]?.taken!==null)continue;
  const p=points[i],d=(p.x-x)**2+(p.y-y)**2;
  if(d<distance){distance=d;best=i;}
 }
 return best;
}
