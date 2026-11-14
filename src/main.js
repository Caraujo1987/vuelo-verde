import {clamp,lerp,newFlight,stepFlight,DURATION,TOTAL_RINGS} from './flight.js?v=1.2.0';
import {BodyControl} from './body-control.js?v=1.2.0';
import {CameraControls} from './camera.js?v=1.2.0';
const $=id=>document.getElementById(id);
const ui={start:$('start'),status:$('tracking-status'),overlay:$('overlay')};
let world,flight=newFlight(),mode='camera',phase='idle',calibration=null,neutral={turn:0,lift:0,spread:3},signals=null,lastSeen=0,flapPending=false,startBusy=false,sound=false,audio,trackingPaused=false;
let input={turn:0,lift:.183,boost:false,flap:false},preview=newFlight(),last=performance.now(),simTime=0,toastUntil=0;
const keys=new Set(),bodyControl=new BodyControl();
const tracker=new CameraControls($('webcam'),$('skeleton'),onPose,setStatus,cameraUI,message=>{home();cameraUI(false);signals=null;setStatus(message,true);setStart('Volver a activar la cámara');});
function setStatus(text,error=false){if(ui.status.textContent!==text)ui.status.textContent=text;ui.status.classList.toggle('error',error);}
function setStart(text,disabled=false){ui.start.innerHTML=`${text} <span>↗</span>`;ui.start.disabled=disabled;}
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');toastUntil=performance.now()+2200;}
function tone(freq,duration=.16){if(!sound||!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*1.4,audio.currentTime+duration);g.gain.setValueAtTime(.06,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}
function cameraUI(on){$('camera-placeholder').hidden=on;$('stop-camera').hidden=!on;$('calibrate').hidden=!on;$('camera-badge').textContent=on?'CÁMARA LOCAL · EN VIVO':'CÁMARA APAGADA';}
function beginCalibration(){calibration={start:0,last:0,samples:[],duration:0};signals=null;bodyControl.reset();phase='calibrating';setStart('Calibrando postura…',true);setStatus('Aléjate hasta ver ambas manos. Abre los brazos a los lados durante 2 segundos.');}
function onPose(value){
  const now=performance.now();
  bodyControl.update(value,now,neutral);
  if(!value){if(phase==='calibrating'&&calibration){if(now-calibration.last>700){calibration.duration=0;calibration.samples=[];}setStatus('Busca el encuadre: hombros y brazos visibles. Conservamos las pérdidas breves.');}return;}
  signals=value;lastSeen=now;
  if(phase==='calibrating'){
    if(!value.complete||value.spread<2.2||Math.abs(value.turn)>.45||Math.abs(value.lift)>.6){if(now-calibration.last>700){calibration.duration=0;calibration.samples=[];}setStatus('Extiende ambos brazos a la altura de los hombros, como una T.');return;}
    if(calibration.last&&now-calibration.last<700)calibration.duration+=Math.min(180,now-calibration.last);
    calibration.last=now;
    calibration.samples.push(value);
    const remaining=Math.max(0,2-calibration.duration/1000);setStatus(`Mantén tus alas abiertas… ${remaining.toFixed(1)} s`);
    if(remaining===0){const list=calibration.samples;neutral={turn:list.reduce((a,b)=>a+b.turn,0)/list.length,lift:list.reduce((a,b)=>a+b.lift,0)/list.length,spread:list.reduce((a,b)=>a+b.spread,0)/list.length};phase='ready';calibration=null;bodyControl.reset();setStatus('¡Postura lista! Aletea para subir; recoge los brazos para bajar.');setStart('Comenzar mi vuelo');tone(660);}
  }else if(phase==='paused'&&trackingPaused&&bodyControl.goodFrames>=3){resume();toast('Seguimiento recuperado. ¡Seguimos volando!');}
}
function chooseMode(next){
  if(startBusy)return;
  if(['playing','paused','finished'].includes(phase))home();
  mode=next;tracker.stop();cameraUI(false);calibration=null;signals=null;bodyControl.reset();phase='idle';
  $('camera-mode').classList.toggle('selected',next==='camera');$('keyboard-mode').classList.toggle('selected',next==='keyboard');
  $('camera-mode').setAttribute('aria-pressed',String(next==='camera'));$('keyboard-mode').setAttribute('aria-pressed',String(next==='keyboard'));
  $('camera-box').hidden=next==='keyboard';
  setStatus(next==='keyboard'?'← → para girar · ↑ ↓ para altura · Espacio para aletear · P para pausar.':'Activa la cámara y deja espacio para tus brazos.');
  setStart(next==='keyboard'?'Comenzar con teclado':'Activar cámara y preparar vuelo',!world);
}
function startGame(){
  if(mode==='camera'&&(!tracker.active||!signals||performance.now()-lastSeen>1200)){setStatus('Ponte frente a la cámara con ambas manos visibles.');return;}
  flight=newFlight();flapPending=false;input={turn:0,lift:.183,boost:false,flap:false};bodyControl.reset();if(mode==='camera')bodyControl.update(signals,performance.now(),neutral);keys.clear();world.reset();phase='playing';document.body.classList.add('playing');ui.overlay.hidden=true;$('hud').hidden=false;$('welcome-label').hidden=true;$('flight-label').textContent=mode==='camera'?'TUS BRAZOS TIENEN EL CONTROL':'VUELO CON TECLADO';setStart('Pausar vuelo');setStatus(mode==='camera'?'Abre las alas para planear. Aletea para subir. Recoge los brazos para bajar.':'← → gira · ↑ ↓ sube/baja · Espacio aletea · P pausa.');toast('Tu aventura comienza. Sigue los aros dorados.');tone(440);
}
function pause(reason='El bosque puede esperar.',automatic=false){
  if(phase!=='playing')return;trackingPaused=automatic;phase='paused';keys.clear();flapPending=false;$('overlay-kicker').textContent='RESPIRA UN MOMENTO';$('overlay-title').textContent='Vuelo en pausa';$('overlay-copy').textContent=reason;$('resume').innerHTML='Seguir volando <span>↗</span>';ui.overlay.hidden=false;setStart('Continuar vuelo');
}
function resume(){
  if(mode==='camera'&&(!tracker.active||!signals||performance.now()-lastSeen>1000)){setStatus('Vuelve al encuadre para continuar; deben verse ambas manos.');return;}
  phase='playing';trackingPaused=false;bodyControl.flaps.reset();bodyControl.flap=false;flapPending=false;ui.overlay.hidden=true;setStart('Pausar vuelo');
}
function finish(){
  phase='finished';keys.clear();$('overlay-kicker').textContent='CADA VUELO ES UN NUEVO COMIENZO';$('overlay-title').textContent=flight.score>=14?'¡Alas extraordinarias!':'Tu cielo, tu ritmo.';
  let best=flight.score;try{best=Math.max(Number(localStorage.getItem('vuelo-verde-best')||0),flight.score);localStorage.setItem('vuelo-verde-best',String(best));}catch{}
  $('overlay-copy').textContent=`${flight.score} de ${TOTAL_RINGS} aros · ${Math.round(-flight.z)} metros\nMejor vuelo en este navegador: ${best} aros`;
  $('resume').innerHTML='Volar otra vez <span>↗</span>';ui.overlay.hidden=false;setStart('Volar otra vez');tone(880,.35);
}
function home(){phase='idle';flight=newFlight();preview=newFlight();world?.reset();document.body.classList.remove('playing');ui.overlay.hidden=true;$('hud').hidden=true;$('welcome-label').hidden=false;$('progress').firstElementChild.style.width='0%';$('flight-label').textContent='LISTO PARA DESCUBRIR';$('speed').textContent='VUELO LIBRE · 3D';keys.clear();setStart(mode==='keyboard'?'Comenzar con teclado':tracker.active?'Comenzar mi vuelo':'Activar cámara y preparar vuelo');}
ui.start.addEventListener('click',async()=>{
  if(!world||startBusy)return;
  if(phase==='playing'){pause();return;}if(phase==='paused'){resume();return;}
  if(mode==='keyboard'||phase==='ready'||phase==='finished'||tracker.active){startGame();return;}
  startBusy=true;setStart('Preparando la cámara…',true);
  try{await tracker.start();if(tracker.active){cameraUI(true);beginCalibration();}}
  catch(error){setStatus(error.message,true);setStart('Volver a activar la cámara');cameraUI(false);phase='idle';}
  finally{startBusy=false;}
});
$('camera-mode').onclick=()=>chooseMode('camera');$('keyboard-mode').onclick=()=>chooseMode('keyboard');
$('stop-camera').onclick=()=>{home();tracker.stop();cameraUI(false);signals=null;setStatus('Cámara apagada. Puedes activarla de nuevo o usar el teclado.');setStart('Activar cámara y preparar vuelo');};
$('calibrate').onclick=()=>{home();beginCalibration();};
$('pause').onclick=()=>pause();$('resume').onclick=()=>phase==='finished'?startGame():resume();$('restart').onclick=home;
$('sound').onclick=()=>{sound=!sound;if(sound){audio??=new AudioContext();audio.resume();tone(660);}$('sound').setAttribute('aria-pressed',String(sound));$('sound').setAttribute('aria-label',sound?'Desactivar sonido':'Activar sonido');$('sound').title=sound?'Desactivar sonido':'Activar sonido';$('sound').textContent=sound?'♪':'♫';};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('La pantalla completa no está disponible en este navegador.');}};
window.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
  if((e.code==='KeyP'||e.code==='Escape')&&!e.repeat){if(phase==='playing')pause();else if(phase==='paused')resume();return;}
  if(mode==='keyboard'&&phase==='playing'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyW','KeyA','KeyS','KeyD'].includes(e.code)){e.preventDefault();keys.add(e.code);if(e.code==='Space'&&!e.repeat)flapPending=true;}
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();pause('Pausamos el vuelo mientras miras otra ventana.');});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('Pausamos el vuelo mientras miras otra pestaña.');});window.addEventListener('pagehide',()=>tracker.stop());
function animate(now){
  requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;simTime+=dt;
  if(now>toastUntil)$('toast').classList.remove('visible');
  if(!world)return;
  if(phase==='playing'){
    let turn=0,lift=.183,boost=false,body=null;
    if(mode==='camera'){
      body=bodyControl.sample(now,neutral);
      if(body.shouldPause||!tracker.active){pause('No vemos tu postura desde hace varios segundos. Vuelve al encuadre: el vuelo continuará automáticamente.',true);setStatus('Esperando tu postura para continuar automáticamente.');}
      else{turn=body.turn;lift=body.lift;boost=body.boost;setStatus(body.assisted?'Planeo asistido: recuperando tus brazos…':body.folded?'Alas recogidas · descendiendo':body.quality==='partial'?'Seguimiento con apoyo en los codos':body.boost?'¡Aleteo! Ganando altura':'Seguimiento estable · abre para planear, recoge para bajar');}
    }else{
      turn=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));
      lift=.183+Number(keys.has('ArrowUp')||keys.has('KeyW'))-Number(keys.has('ArrowDown')||keys.has('KeyS'));boost=keys.has('Space');
    }
    input.turn=lerp(input.turn,turn,1-Math.exp(-dt*7));input.lift=lift;input.boost=boost;input.flap=body?body.flap:flapPending;flapPending=false;
    input.folded=body?.folded||false;input.assisted=body?.assisted||false;input.leftWing=body?.leftWing;input.rightWing=body?.rightWing;input.foldAmount=body?.foldAmount||0;
    if(phase==='playing')for(const event of stepFlight(flight,input,dt)){
      if(event.type==='finish')finish();else{world.ringEvent(event);if(event.type==='ring'){toast(event.combo>1?`¡${event.combo} aros seguidos! Sigue así.`:'¡Un aro más! Buen vuelo.');tone(500+event.combo*50);}else toast('El próximo aro te espera.');}
    }
    $('score').innerHTML=`${flight.score} <small>/ ${TOTAL_RINGS}</small>`;
    const remaining=Math.max(0,Math.ceil(DURATION-flight.time));$('time').textContent=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
    $('altitude').innerHTML=`${Math.round(flight.y)} <small>m</small>`;$('speed').textContent=`${Math.round(flight.speed*3.6)} KM/H · ${Math.round(-flight.z)} M RECORRIDOS`;$('progress').firstElementChild.style.width=`${flight.checked/TOTAL_RINGS*100}%`;
  }
  const inFlight=['playing','paused','finished'].includes(phase);
  if(!inFlight){preview.y=16;preview.z=-15;preview.x=5;input.turn=Math.sin(simTime*.5)*.12;input.boost=false;}
  world.render(inFlight?flight:preview,input,simTime,dt,inFlight);
}
requestAnimationFrame(animate);
try{const {World}=await import('./world.js?v=1.2.0');world=new World($('game'));setStart(mode==='keyboard'?'Comenzar con teclado':'Activar cámara y preparar vuelo');}
catch(error){console.error(error);setStatus('No pudimos cargar el escenario 3D. Revisa Internet y que WebGL esté activo; después recarga la página.',true);setStart('Escenario no disponible',true);$('welcome-label').querySelector('p').textContent='No pudimos cargar el bosque. Revisa tu conexión y recarga.';}
