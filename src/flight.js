export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const lerp = (a, b, t) => a + (b - a) * t;
export const TOTAL_RINGS = 18;
export const DURATION = 90;
export function ringPosition(i) {
  return { x: Math.sin(i * .78) * 15, y: 15 + Math.sin(i * .57) * 6, z: -100 - i * 94 };
}
// Coordinates are from the unmirrored camera. Left landmarks are the user's left.
export function poseSignals(points) {
  if (!points || ![11,12,13,14,15,16].every(i => points[i] && (points[i].visibility ?? 0) > .55 && points[i].x > .015 && points[i].x < .985 && points[i].y > .015 && points[i].y < .985)) return null;
  const [ls,rs,lw,rw] = [points[11],points[12],points[15],points[16]];
  const width = Math.hypot(ls.x-rs.x, ls.y-rs.y);
  if (width < .07) return null;
  const left = (ls.y - lw.y) / width;
  const right = (rs.y - rw.y) / width;
  return { lift: clamp((left + right) / 2, -2, 2), turn: clamp((rs.y-ls.y)/width * 1.7 + (left-right)*.65, -1, 1), spread: Math.abs(lw.x-rw.x)/width };
}
export class FlapDetector {
  constructor(){this.reset();}
  reset(){this.armed=false;this.last=-Infinity;}
  update(lift, now){
    if(lift > .18) this.armed=true;
    if(this.armed && lift < -.22 && now-this.last > 420){ this.armed=false;this.last=now;return true; }
    return false;
  }
}
export function newFlight(){return {x:0,y:15,z:0,vx:0,vy:0,speed:20,time:0,score:0,checked:0,combo:0,flaps:0,finished:false};}
export function stepFlight(state, input, dt){
  if(state.finished) return [];
  const events=[];
  const old={x:state.x,y:state.y,z:state.z};
  state.time=Math.min(DURATION,state.time+dt);
  state.speed=lerp(state.speed, input.boost ? 27 : 21, 1-Math.exp(-dt*2));
  state.vx=lerp(state.vx,clamp(input.turn,-1,1)*17,1-Math.exp(-dt*4));
  if(input.flap){state.vy=Math.min(9,state.vy+6);state.flaps++;}
  state.vy += ((input.lift || 0)*6 - 1.1 - state.vy*1.6)*dt;
  state.x=clamp(state.x+state.vx*dt,-32,32);
  state.y=clamp(state.y+state.vy*dt,5,38);
  if(state.y===5) state.vy=Math.max(0,state.vy);
  if(state.y===38) state.vy=Math.min(0,state.vy);
  state.z-=state.speed*dt;
  while(state.checked<TOTAL_RINGS && state.z <= ringPosition(state.checked).z){
    const index=state.checked++,r=ringPosition(index);
    const t=clamp((r.z-old.z)/(state.z-old.z),0,1);
    const hit=Math.hypot(lerp(old.x,state.x,t)-r.x,lerp(old.y,state.y,t)-r.y)<5.2;
    if(hit){state.score++;state.combo++;}else state.combo=0;
    events.push({type:hit?'ring':'miss',index,combo:state.combo});
  }
  if(state.time>=DURATION || state.checked===TOTAL_RINGS){state.finished=true;events.push({type:'finish'});}
  return events;
}
