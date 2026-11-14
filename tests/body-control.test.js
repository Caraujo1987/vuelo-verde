import test from 'node:test';
import assert from 'node:assert/strict';
import {BodyControl,TRACKING_PAUSE_MS} from '../src/body-control.js';
import {newFlight,stepFlight,poseSignals} from '../src/flight.js';
const neutral={turn:0,lift:0,spread:4};
const pose=(overrides={})=>({turn:0,lift:0,left:0,right:0,spread:4,complete:true,quality:1,...overrides});
test('brief lost tracking fades steering into assisted glide without pausing',()=>{
  const b=new BodyControl();b.update(pose({turn:1}),0,neutral);b.update(null,200,neutral);
  assert.equal(b.sample(1000,neutral).turn,0);assert.equal(b.sample(1000,neutral).assisted,true);assert.equal(b.sample(2500,neutral).shouldPause,false);
  assert.equal(b.sample(TRACKING_PAUSE_MS+1,neutral).shouldPause,true);
  b.update(pose(),9000,neutral);assert.equal(b.sample(9000,neutral).shouldPause,false);
});
test('held closed arms trigger descent and reopening clears the gesture',()=>{
  const b=new BodyControl();b.update(pose(),0,neutral);
  for(let t=125;t<=875;t+=125)b.update(pose({spread:1}),t,neutral);
  const control=b.sample(875,neutral);assert.equal(control.folded,true);
  const s=newFlight();s.vy=8;for(let i=0;i<60;i++)stepFlight(s,control,1/60);
  assert.ok(s.vy< -6);assert.ok(s.y<15);
  for(let t=1000;t<=1500;t+=125)b.update(pose(),t,neutral);
  assert.equal(b.sample(1500,neutral).folded,false);
});
test('a short downstroke gives one impulse without becoming held closed arms',()=>{
  const b=new BodyControl();b.update(pose({lift:.25,left:.25,right:.25}),0,neutral);
  b.update(pose({lift:-.3,left:-.3,right:-.3,spread:2}),125,neutral);
  assert.equal(b.sample(125,neutral).flap,true);assert.equal(b.sample(126,neutral).flap,false);assert.equal(b.sample(126,neutral).folded,false);
});
test('partial elbow estimates cannot generate false flaps',()=>{
  const b=new BodyControl();b.update(pose({lift:.5}),0,neutral);
  b.update(pose({lift:-.8,complete:false}),150,neutral);assert.equal(b.sample(150,neutral).flap,false);
});
test('lost-frame recovery cannot generate an old downstroke impulse',()=>{
  const b=new BodyControl();b.update(pose({lift:.7}),0,neutral);b.update(null,150,neutral);
  b.update(pose({lift:-.7}),300,neutral);assert.equal(b.sample(300,neutral).flap,false);
});
test('assisted glide cancels vertical drift instead of continuing to fall',()=>{
  const s=newFlight();s.vy=-7;for(let i=0;i<120;i++)stepFlight(s,{turn:0,assisted:true},1/60);
  assert.ok(Math.abs(s.vy)<.01);assert.ok(s.y>13);
});
test('tracking smoothing reduces jitter but wings still cover a broad range',()=>{
  const b=new BodyControl();b.update(pose(),0,neutral);b.update(pose({turn:.2}),20,neutral);
  assert.ok(b.sample(20,neutral).turn<.2);
  for(let t=100;t<=500;t+=100)b.update(pose({left:1.5,right:1.5,lift:1.5}),t,neutral);
  assert.ok(b.sample(500,neutral).leftWing>1);
});
test('portrait/landscape coordinates yield the same physical arm signal',()=>{
  const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));
  p[11]={x:.6,y:.4,visibility:1};p[12]={x:.4,y:.4,visibility:1};p[15]={x:.9,y:.2,visibility:1};p[16]={x:.1,y:.2,visibility:1};
  const a=poseSignals(p,1);const wide=p.map(v=>({...v,x:.5+(v.x-.5)/2}));const b=poseSignals(wide,2);
  assert.ok(Math.abs(a.lift-b.lift)<1e-9);assert.ok(Math.abs(a.spread-b.spread)<1e-9);
});
