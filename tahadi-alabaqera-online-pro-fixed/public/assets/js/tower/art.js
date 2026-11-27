// Decorative geometry follows the course coordinates. It never changes collision bounds.
import * as T from '../../vendor/three-r187-pegs.js';

const THEMES = {
  forest: {base:'#244c4f', trim:'#e5b667', light:'#a3f2bf', sun:'#fff5b5', halo:'#f4d28b', dir:[-.5,.44,.72]},
  ice:    {base:'#353c68', trim:'#c4ddff', light:'#98f1ff', sun:'#f4f7ff', halo:'#ada5ff', dir:[.48,.38,.78]},
  candy:  {base:'#643d72', trim:'#ffe3aa', light:'#bcf9e9', sun:'#fff3df', halo:'#feabd2', dir:[-.48,.45,.75]},
  desert: {base:'#75464d', trim:'#f3cb79', light:'#7ae8d4', sun:'#ffe59c', halo:'#ffae68', dir:[-.58,.32,.76]},
  space:  {base:'#241d57', trim:'#bda5f4', light:'#7cf8ee', sun:'#f0d5ff', halo:'#ac82f7', dir:[-.38,.4,.84]},
  lava:   {base:'#352438', trim:'#edaf71', light:'#ffb35f', sun:'#fff0be', halo:'#e77577', dir:[.45,.32,.78]},
};
export const worldArt = id => THEMES[id] || THEMES.forest;

const basic = (color, extra={}) => new T.MeshBasicMaterial({color, ...extra});
const surface = (color, extra={}) => new T.MeshStandardMaterial({color,roughness:.48,metalness:.24,...extra});
const mesh = (geometry, material, x=0,y=0,z=0) => {
  const object = new T.Mesh(geometry, material);
  object.position.set(x,y,z);
  return object;
};

export function crystalGeometry(radius) {
  const points=[[0,-1],[.64,-.16],[.83,.22],[.4,.72],[0,.73]];
  return new T.LatheGeometry(points.map(([x,y])=>new T.Vector2(x*radius,y*radius)),6);
}

export function paintTiles(ctx, size, world, checkpoint=false) {
  const theme = worldArt(world.id);
  const fill = ctx.createLinearGradient(0,0,size,size);
  fill.addColorStop(0, checkpoint ? theme.base : world.floor);
  fill.addColorStop(1, checkpoint ? '#24143d' : new T.Color(world.floor).multiplyScalar(.88).getStyle());
  ctx.fillStyle = fill;
  ctx.fillRect(0,0,size,size);
  ctx.strokeStyle = checkpoint ? theme.trim : theme.base;
  ctx.globalAlpha = checkpoint ? .85 : .23;
  ctx.lineWidth = 1.8;
  ctx.strokeRect(3,3,size-6,size-6);
  ctx.strokeRect(8,8,size-16,size-16);
  ctx.globalAlpha = checkpoint ? .62 : .19;
  for (const corner of [[14,14],[size-14,14],[14,size-14],[size-14,size-14]]) {
    const [x,y] = corner;
    ctx.beginPath();
    ctx.moveTo(x,y-4);ctx.lineTo(x+4,y);ctx.lineTo(x,y+4);ctx.lineTo(x-4,y);ctx.closePath();
    ctx.stroke();
  }
  ctx.translate(size/2,size/2);
  ctx.rotate(Math.PI/4);
  ctx.strokeRect(-size*.16,-size*.16,size*.32,size*.32);
  ctx.strokeRect(-size*.10,-size*.10,size*.20,size*.20);
  ctx.globalAlpha = 1;
}

export function addAtmosphere(group, world) {
  const colors = worldArt(world.id);
  const geometry = new T.SphereGeometry(580,64,36);
  const positions = geometry.attributes.position, colorsByVertex = new Float32Array(positions.count*3);
  const top = new T.Color(world.sky[0]), horizon = new T.Color(world.sky[1]);
  const sun = new T.Color(colors.sun), halo = new T.Color(colors.halo), sunDir = new T.Vector3(...colors.dir).normalize();
  const ray = new T.Vector3(), color = new T.Color(), strength = world.id==='space' ? .34 : .76;
  for (let i=0;i<positions.count;i++) {
    ray.fromBufferAttribute(positions,i).normalize();
    const h=Math.max(0,Math.min(1,(ray.y+.19)/1.02)), side=Math.max(0,ray.dot(sunDir));
    color.copy(horizon).lerp(top,h*h*(3-2*h))
      .lerp(halo,side**6*strength*.48).lerp(sun,side**38*strength*.66);
    color.toArray(colorsByVertex,i*3);
  }
  geometry.setAttribute('color',new T.BufferAttribute(colorsByVertex,3));
  const sky=new T.Mesh(geometry,basic('#fff',{vertexColors:true,side:T.BackSide,fog:false,depthWrite:false,toneMapped:false}));
  const disk=mesh(new T.SphereGeometry(world.id==='space'?6:13,16,10),basic(colors.sun,{fog:false,toneMapped:false}));
  disk.position.copy(sunDir.multiplyScalar(490));
  sky.add(disk);
  sky.renderOrder=-1;
  group.add(sky);
  return sky;
}

export function installLandmarks(group,course,world,low) {
  const art=worldArt(world.id);
  const metal=surface(art.trim,{metalness:.56,roughness:.3});
  const frame=surface(art.base);
  const light=basic(art.light);
  const rune=basic(art.light,{transparent:true,opacity:.68,depthWrite:false});
  const geometry={
    post:new T.CylinderGeometry(.16,.28,1.44,8),
    foot:new T.CylinderGeometry(.32,.40,.18,8),
    jewel:crystalGeometry(.31),
    stripe:new T.RoundedBoxGeometry(1,.035,.095,1,.006),
    chevron:new T.RoundedBoxGeometry(.54,.025,.085,1,.005)
  };
  const checkpoints = [];
  for (const [index, point] of course.checkpoints.entries()) {
    const platform=course.pieces.find(piece => piece.k==='box' && Math.abs(piece.y-point.y)<.12 && Math.abs(piece.z-point.z)<3 && piece.w>=4 && !piece.mv);
    if (!platform) continue;
    const offset=Math.min(5.6,platform.w/2-.4), direction=point.z+Math.min(1.05,platform.d/4);
    const gate=new T.Group(); gate.position.set(point.x,point.y,direction);
    const gems=[];
    for (const side of [-1,1]) {
      const x=side*offset;
      gate.add(mesh(geometry.foot,metal,x,.09),mesh(geometry.post,frame,x,.82));
      const stone=mesh(geometry.jewel,light,x,1.62);stone.rotation.z=Math.PI/12;gate.add(stone);gems.push(stone);
    }
    const line=mesh(geometry.stripe,metal,0,.033);line.scale.x=offset*2;gate.add(line);
    for (const x of [-.22,.22]) {
      const arrow=mesh(geometry.chevron,rune,x,.037,-.48);arrow.rotation.y=x<0?-.72:.72;gate.add(arrow);
    }
    group.add(gate);
    checkpoints.push({index,gems});
  }

  const finish=course.finish;
  // Large decorative shapes sit beyond the runway. Checkpoints stay clear for touch controls.
  if (finish) {
    const portal = new T.Group();
    portal.position.set(finish.x,finish.y,finish.z + .35);
    const width=finish.w/2+.34;
    const arch = mesh(new T.TorusGeometry(width,.085,6,36,Math.PI),light);
    arch.position.y=.035;portal.add(arch);
    for (const side of [-1,1]) {
      const base=mesh(new T.CylinderGeometry(.46,.65,.38,8),metal,width*side,.18);
      const obelisk=mesh(new T.CylinderGeometry(.22,.39,2.6,8),frame,width*side,1.48);
      const jewel=mesh(crystalGeometry(.42),light,width*side,3.1);
      portal.add(base,obelisk,jewel);
    }
    group.add(portal);
  }
  const distant=[];
  if (!low) {
    const towers = new T.InstancedMesh(new T.CylinderGeometry(.64,1,1,7),frame,8);
    const caps = new T.InstancedMesh(new T.CylinderGeometry(.12,.92,1,7),metal,8);
    const object=new T.Object3D();
    for (let i=0;i<8;i++) {
      const side=i%2?1:-1, z=7+i*course.length/8, h=7+(i%3)*3, y=course.kill+6 + i*1.25;
      object.position.set(side*(12+i%3*3),y,z);object.scale.set(2.25,h,2.25);object.rotation.y=i*.7;object.updateMatrix();
      towers.setMatrixAt(i,object.matrix);
      object.position.y+=h/2+1.1;object.scale.set(1.78,2.3,1.78);object.updateMatrix();
      caps.setMatrixAt(i,object.matrix);
    }
    group.add(towers,caps);distant.push(towers,caps);
  }
  // Geometry can be unused on tiny courses. Attach a resource list for clean unloads.
  return {checkpoints,distant,resources:[...Object.values(geometry),metal,frame,light,rune]};
}

export function disposeArt(node, extra=[], retained=[]) {
  const resources=new Set(extra), skip=new Set(retained);
  const addMaterial=material=>{
    if (!material) return;
    resources.add(material);
    for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
  };
  node?.traverse(object=>{
    if (object.isInstancedMesh) resources.add(object);
    if (object.geometry) resources.add(object.geometry);
    for (const material of [].concat(object.material||[])) addMaterial(material);
  });
  for(const item of resources) if(!skip.has(item))item.dispose?.();
}
