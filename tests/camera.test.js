import test from 'node:test';
import assert from 'node:assert/strict';
import {preferDirectVideo,openCamera} from '../src/detector.js';
import {CameraControls} from '../src/camera.js';

test('iPad Chrome and desktop-identifying iPadOS use direct video',()=>{
  assert.equal(preferDirectVideo({userAgent:'Mozilla iPad CriOS',maxTouchPoints:5}),true);
  assert.equal(preferDirectVideo({userAgent:'Mozilla Macintosh',maxTouchPoints:5}),true);
  assert.equal(preferDirectVideo({userAgent:'Mozilla Windows Chrome',maxTouchPoints:0}),false);
});
test('unsupported camera constraints retry without resolution/frame-rate limits',async()=>{
  const calls=[];const stream={};
  const result=await openCamera({getUserMedia:async options=>{calls.push(options);if(calls.length===1)throw Object.assign(new Error(),{name:'OverconstrainedError'});return stream;}});
  assert.equal(result,stream);assert.equal(calls.length,2);assert.equal(calls[1].video.frameRate,undefined);assert.equal(calls[1].audio,false);
});
test('permission denial does not request access a second time',async()=>{
  let calls=0;
  await assert.rejects(openCamera({getUserMedia:async()=>{calls++;throw Object.assign(new Error(),{name:'NotAllowedError'});}}));
  assert.equal(calls,1);
});
function fixture(t,touch=5){
  const original=new Map();
  const set=(key,value)=>{original.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});};
  let stopped=0,closed=0;
  const track={stop(){stopped++;},addEventListener(){}};
  const stream={getTracks:()=>[track],getVideoTracks:()=>[track]};
  set('navigator',{maxTouchPoints:touch,userAgent:'test',mediaDevices:{getUserMedia:async()=>stream}});
  set('isSecureContext',true);set('document',{hidden:false});set('requestAnimationFrame',()=>1);set('cancelAnimationFrame',()=>{});
  set('Worker',class{constructor(){throw new Error('worker unavailable');}});set('createImageBitmap',async()=>{throw new Error('bitmap unsupported');});
  const previews=[],errors=[],poses=[],attributes=[];
  const video={play:async()=>{},setAttribute:name=>attributes.push(name),readyState:2,videoWidth:640,videoHeight:480,currentTime:1};
  const canvas={width:0,height:0,getContext:()=>({clearRect(){}})};
  const camera=new CameraControls(video,canvas,p=>poses.push(p),()=>{},v=>previews.push(v),e=>errors.push(e));
  const frames=[];
  camera.loadDirect=async()=>{camera.detector={detectForVideo(frame){frames.push(frame);return {landmarks:[]};},close(){closed++;}};};
  t.after(()=>{camera.stop();for(const [key,value] of original){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}});
  return {camera,video,previews,attributes,errors,poses,frames,stopped:()=>stopped,closed:()=>closed};
}
test('tablet plays inline, previews before detection, and analyzes video without ImageBitmap',async t=>{
  const f=fixture(t);await f.camera.start();
  assert.equal(f.camera.active,true);assert.ok(f.previews.includes(true));assert.ok(f.attributes.includes('playsinline'));
  f.camera.lastSent=-Infinity;f.camera.lastFrame=-1;await f.camera.loop();
  assert.ok(f.frames.includes(f.video));assert.equal(f.camera.busy,false);
  f.camera.stop();assert.equal(f.stopped(),1);assert.equal(f.closed(),1);assert.equal(f.previews.at(-1),false);
});
test('desktop worker startup failure falls back to direct video',async t=>{
  const f=fixture(t,0);await f.camera.start();assert.equal(f.camera.active,true);assert.ok(f.camera.detector);assert.equal(f.camera.worker,null);
});
test('repeated inference errors release the camera and report a recoverable error',async t=>{
  const f=fixture(t);await f.camera.start();f.camera.detector.detectForVideo=()=>{throw new Error('bad frame');};
  for(let i=0;i<3;i++){f.video.currentTime++;f.camera.lastSent=-Infinity;await f.camera.loop();}
  assert.equal(f.camera.active,false);assert.equal(f.errors.length,1);assert.equal(f.stopped(),1);
});
