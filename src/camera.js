import {poseSignals} from './flight.js';
export class CameraControls {
  constructor(video,canvas,onPose,onStatus){this.video=video;this.canvas=canvas;this.ctx=canvas.getContext('2d');this.onPose=onPose;this.onStatus=onStatus;this.active=false;this.busy=false;this.generation=0;}
  async start(){
    this.stop();const gen=this.generation;
    if(!isSecureContext || !navigator.mediaDevices?.getUserMedia)throw new Error('La cámara necesita HTTPS o localhost. Abre el enlace publicado o usa npm start.');
    try{
      this.onStatus('Solicitando acceso a la cámara…');
      const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});
      if(gen!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream;this.video.srcObject=stream;await this.video.play();
      this.canvas.width=this.video.videoWidth;this.canvas.height=this.video.videoHeight;
      this.onStatus('Cargando el reconocimiento de brazos…');
      // MediaPipe's WASM loader uses importScripts: it needs a classic worker.
      this.worker=new Worker(new URL('./pose-worker.js',import.meta.url));
      await new Promise((resolve,reject)=>{
        this.cancelLoad=()=>reject(new Error('Inicio de cámara cancelado.'));
        const timer=setTimeout(()=>reject(new Error('La descarga del detector tardó demasiado. Revisa tu conexión y vuelve a intentarlo.')),60000);
        this.worker.onerror=()=>{clearTimeout(timer);reject(new Error('No se pudo iniciar el detector. Prueba con Chrome o Edge actualizado.'));};
        this.worker.onmessage=({data})=>{if(data.type==='ready'){clearTimeout(timer);this.cancelLoad=null;resolve();}else if(data.type==='error'){clearTimeout(timer);reject(new Error(data.message));}};
        this.worker.postMessage({type:'init'});
      });
      if(gen!==this.generation)return;
      this.active=true;this.busy=false;this.lastFrame=-1;
      this.worker.onmessage=({data})=>{this.busy=false;if(data.type==='pose'){this.draw(data.points);this.onPose(poseSignals(data.points),data.points);}else if(data.type==='error'){this.onStatus('El detector se detuvo. Activa la cámara de nuevo.');this.stop();this.onPose(null,null);}};
      this.worker.onerror=()=>{this.onStatus('El detector se detuvo. Activa la cámara de nuevo.');this.stop();this.onPose(null,null);};
      stream.getVideoTracks()[0].addEventListener('ended',()=>{if(gen===this.generation){this.stop();this.onStatus('La cámara se desconectó. Vuelve a activarla.');this.onPose(null,null);}});
      this.loop();
    }catch(error){if(gen===this.generation)this.stop();const messages={NotAllowedError:'No se autorizó la cámara. Puedes permitirla en el navegador o jugar con teclado.',NotFoundError:'No encontramos una cámara. Conecta una o usa el teclado.',NotReadableError:'La cámara está ocupada. Cierra la otra aplicación y vuelve a intentar.'};throw new Error(messages[error.name]||error.message);}
  }
  async loop(){
    if(!this.active)return;
    this.raf=requestAnimationFrame(()=>this.loop());
    if(document.hidden||this.busy||this.video.readyState<2||this.video.currentTime===this.lastFrame)return;
    const now=performance.now();if(now-(this.lastSent||0)<65)return;
    this.lastSent=now;this.lastFrame=this.video.currentTime;this.busy=true;const gen=this.generation;
    try{const bitmap=await createImageBitmap(this.video);if(!this.active||gen!==this.generation){bitmap.close();return;}this.worker.postMessage({type:'frame',bitmap,time:now},[bitmap]);}
    catch{this.busy=false;this.onPose(null,null);}
  }
  draw(points){
    const c=this.ctx,w=this.canvas.width,h=this.canvas.height;c.clearRect(0,0,w,h);if(!points)return;
    c.strokeStyle='#cbe988';c.fillStyle='#fff1aa';c.lineWidth=4;
    for(const [a,b] of [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24]]){if(points[a]?.visibility>.5&&points[b]?.visibility>.5){c.beginPath();c.moveTo(points[a].x*w,points[a].y*h);c.lineTo(points[b].x*w,points[b].y*h);c.stroke();}}
    for(const i of [11,12,13,14,15,16,23,24]){const p=points[i];if(p?.visibility>.5){c.beginPath();c.arc(p.x*w,p.y*h,7,0,Math.PI*2);c.fill();}}
  }
  stop(){this.generation++;this.active=false;cancelAnimationFrame(this.raf);this.cancelLoad?.();this.cancelLoad=null;this.worker?.terminate();this.worker=null;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.srcObject=null;this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);this.busy=false;}
}
