import {poseSignals} from './flight.js?v=1.2.0';
import {createVideoDetector,preferDirectVideo,openCamera} from './detector.js';

export class CameraControls {
  constructor(video,canvas,onPose,onStatus,onPreview=()=>{},onError=()=>{}){
    Object.assign(this,{video,canvas,onPose,onStatus,onPreview,onError});
    this.ctx=canvas.getContext('2d');this.active=false;this.busy=false;this.generation=0;
  }
  async start(){
    this.stop();const gen=this.generation;
    if(!isSecureContext || !navigator.mediaDevices?.getUserMedia)throw new Error('Abre el enlace HTTPS directamente en Chrome o Safari, fuera del navegador de otra aplicación.');
    let stage='camera';
    try{
      this.onStatus('Solicitando acceso a la cámara frontal…');
      const stream=await openCamera(navigator.mediaDevices);
      if(gen!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream;
      this.video.muted=true;this.video.defaultMuted=true;this.video.autoplay=true;this.video.playsInline=true;
      this.video.setAttribute('playsinline','');this.video.setAttribute('webkit-playsinline','');
      this.video.srcObject=stream;
      this.onPreview(true);
      await this.video.play();
      if(gen!==this.generation)return;
      stage='detector';this.onStatus('Cámara conectada. Cargando el reconocimiento de brazos…');
      if(preferDirectVideo()||typeof Worker==='undefined'||typeof createImageBitmap==='undefined')await this.loadDirect(gen);
      else{
        try{await this.loadWorker();}
        catch(error){
          if(gen!==this.generation)return;
          this.worker?.terminate();this.worker=null;
          this.onStatus('Cámara conectada. Activando el modo compatible…');
          await this.loadDirect(gen);
        }
      }
      if(gen!==this.generation)return;
      this.active=true;this.busy=false;this.lastFrame=-1;this.lastSent=0;this.frameErrors=0;this.frameStarted=0;
      if(this.worker){
        this.worker.onmessage=({data})=>{if(gen!==this.generation)return;this.busy=false;this.frameStarted=0;if(data.type==='pose')this.deliver(data.points);else if(data.type==='error')void this.fallback(gen);};
        this.worker.onerror=()=>{if(gen===this.generation)void this.fallback(gen);};
      }
      stream.getVideoTracks()[0].addEventListener('ended',()=>{if(gen===this.generation)this.fail('La cámara se desconectó. Pulsa «Volver a activar la cámara».');});
      this.loop();
    }catch(error){
      if(gen!==this.generation)return;
      this.stop();
      const messages={NotAllowedError:'No se pudo autorizar la cámara. En el iPad, revisa el permiso de Cámara de Chrome en Ajustes y el permiso de este sitio. También puedes abrir el enlace directamente en Safari.',NotFoundError:'No encontramos una cámara disponible. Abre el enlace directamente en Chrome o Safari.',NotReadableError:'La cámara está ocupada. Cierra otras apps que la usen y vuelve a intentarlo.',OverconstrainedError:'No pudimos iniciar la cámara con la configuración de este dispositivo.'};
      throw new Error(stage==='camera'?(messages[error.name]||`No pudimos reproducir la cámara: ${error.message}`):`La cámara funciona, pero no se pudo cargar el detector de brazos. Revisa Internet y vuelve a intentarlo. (${error.message})`);
    }
  }
  loadWorker(){
    this.worker=new Worker(new URL('./pose-worker.js',import.meta.url));
    return new Promise((resolve,reject)=>{
      const settle=(error)=>{clearTimeout(timer);this.cancelLoad=null;error?reject(error):resolve();};
      const timer=setTimeout(()=>settle(new Error('El detector en segundo plano no respondió.')),20000);
      this.cancelLoad=()=>settle(new Error('Inicio cancelado.'));
      this.worker.onerror=()=>settle(new Error('Detector en segundo plano no disponible.'));
      this.worker.onmessage=({data})=>{if(data.type==='ready')settle();else if(data.type==='error')settle(new Error(data.message));};
      this.worker.postMessage({type:'init'});
    });
  }
  async loadDirect(gen){
    let timer,settled=false;
    const pending=createVideoDetector();
    const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('La descarga del modelo tardó demasiado.')),60000);this.cancelLoad=()=>reject(new Error('Inicio cancelado.'));});
    // Release a model that finishes after cancellation or timeout.
    pending.then(detector=>{if(settled||gen!==this.generation)detector.close();},()=>{});
    try{const detector=await Promise.race([pending,deadline]);if(gen!==this.generation)return;this.detector=detector;}
    finally{settled=true;clearTimeout(timer);if(gen===this.generation)this.cancelLoad=null;}
  }
  async fallback(gen){
    if(this.switching||gen!==this.generation)return;
    this.switching=true;this.busy=true;this.worker?.terminate();this.worker=null;
    this.onPose(null,null);this.onStatus('Activando el modo compatible de cámara…');
    try{await this.loadDirect(gen);if(gen!==this.generation)return;this.busy=false;this.lastFrame=-1;this.frameErrors=0;this.onStatus('Modo compatible listo. Coloca ambos brazos dentro del encuadre.');}
    catch(error){if(gen===this.generation)this.fail(`No pudimos iniciar el reconocimiento compatible. ${error.message}`);}
    finally{if(gen===this.generation)this.switching=false;}
  }
  fail(message){this.stop();this.onPose(null,null);this.onError(message);}
  deliver(points){this.draw(points);this.onPose(poseSignals(points,this.video.videoWidth/this.video.videoHeight||1),points);}
  async loop(){
    if(!this.active)return;
    this.raf=requestAnimationFrame(()=>this.loop());
    if(this.worker&&this.busy&&this.frameStarted&&performance.now()-this.frameStarted>5000){void this.fallback(this.generation);return;}
    if(document.hidden||this.busy||this.video.readyState<2||!this.video.videoWidth||this.video.currentTime===this.lastFrame)return;
    const now=performance.now();if(now-this.lastSent<(this.detector?125:65))return;
    this.lastSent=now;this.lastFrame=this.video.currentTime;this.busy=true;const gen=this.generation;
    if(this.canvas.width!==this.video.videoWidth||this.canvas.height!==this.video.videoHeight){this.canvas.width=this.video.videoWidth;this.canvas.height=this.video.videoHeight;}
    try{
      if(this.detector){const result=this.detector.detectForVideo(this.video,now);this.deliver(result.landmarks[0]||null);this.busy=false;}
      else{const bitmap=await createImageBitmap(this.video);if(!this.active||gen!==this.generation){bitmap.close();return;}this.frameStarted=now;this.worker.postMessage({type:'frame',bitmap,time:now},[bitmap]);}
      this.frameErrors=0;
    }catch(error){
      if(gen!==this.generation)return;
      this.busy=false;this.onPose(null,null);
      if(++this.frameErrors>=3){if(this.detector)this.fail('La cámara está conectada, pero no podemos analizar el video. Actualiza el navegador o prueba abriendo el enlace en Safari.');else void this.fallback(gen);}
    }
  }
  draw(points){
    const c=this.ctx,w=this.canvas.width,h=this.canvas.height;c.clearRect(0,0,w,h);if(!points)return;
    c.strokeStyle='#cbe988';c.fillStyle='#fff1aa';c.lineWidth=4;
    for(const [a,b] of [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24]]){if(points[a]?.visibility>.5&&points[b]?.visibility>.5){c.beginPath();c.moveTo(points[a].x*w,points[a].y*h);c.lineTo(points[b].x*w,points[b].y*h);c.stroke();}}
    for(const i of [11,12,13,14,15,16,23,24]){const p=points[i];if(p?.visibility>.5){c.beginPath();c.arc(p.x*w,p.y*h,7,0,Math.PI*2);c.fill();}}
  }
  stop(){this.generation++;this.active=false;cancelAnimationFrame(this.raf);this.cancelLoad?.();this.cancelLoad=null;this.worker?.terminate();this.worker=null;this.detector?.close();this.detector=null;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.srcObject=null;this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);this.busy=false;this.switching=false;this.onPreview(false);}
}
