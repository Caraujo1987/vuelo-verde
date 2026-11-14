import {clamp,lerp,FlapDetector} from './flight.js?v=1.2.0';
export const TRACKING_PAUSE_MS=8000;
export class BodyControl {
  constructor(){this.reset();}
  reset(){this.filtered=null;this.lastSeen=-Infinity;this.lastUpdate=null;this.goodFrames=0;this.folded=false;this.foldSince=null;this.flap=false;this.flapUntil=0;this.lastRaw=null;this.flaps=new FlapDetector();}
  update(value,now,neutral){
    if(!value){this.goodFrames=0;this.flap=false;this.foldSince=null;this.flaps.reset();return;}
    const gap=now-this.lastSeen;
    if(gap>600){this.goodFrames=0;this.flaps.reset();}
    this.goodFrames++;this.lastSeen=now;this.lastRaw=value;
    const alpha=this.lastUpdate===null?1:1-Math.exp(-Math.max(1,now-this.lastUpdate)/95);
    if(!this.filtered)this.filtered={...value};
    else for(const key of ['turn','lift','left','right','spread'])this.filtered[key]=lerp(this.filtered[key],value[key],alpha);
    this.lastUpdate=now;
    const ratio=this.filtered.spread/Math.max(neutral.spread||3,1.5);
    // Hysteresis prevents repeated folding/unfolding close to the boundary.
    if(ratio<.55){this.foldSince??=now;if(now-this.foldSince>=350)this.folded=true;}
    else{this.foldSince=null;if(ratio>.72)this.folded=false;}
    if(this.folded||!value.complete){this.flaps.reset();this.flap=false;}
    else if(this.flaps.update(value.lift-neutral.lift,now)){this.flap=true;this.flapUntil=now+650;}
  }
  sample(now,neutral){
    const age=now-this.lastSeen;
    const weight=clamp(1-(age-250)/750,0,1);
    const v=this.filtered;
    const assisted=!v||age>350;
    const folded=!!v&&this.folded&&!assisted;
    let turn=v?clamp((v.turn-neutral.turn)*1.45,-1,1)*weight:0;
    if(Math.abs(turn)<.09)turn=0;
    const flap=this.flap&&!assisted&&!folded;this.flap=false;
    return {turn,lift:assisted?.183:clamp(.183+((v?.lift||0)-neutral.lift)*1.1,-1.3,1.5),flap,
      folded,assisted,boost:!assisted&&!folded&&now<this.flapUntil,
      leftWing:v?clamp((v.left-(neutral.lift||0))*.95,-1.15,1.15)*weight:0,
      rightWing:v?clamp((v.right-(neutral.lift||0))*.95,-1.15,1.15)*weight:0,
      foldAmount:folded?clamp(1-(v.spread/Math.max(neutral.spread||3,1.5)),0,1):0,
      shouldPause:age>TRACKING_PAUSE_MS,quality:assisted?'assisted':this.lastRaw?.complete?'full':'partial'};
  }
}
