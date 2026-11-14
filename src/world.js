import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { ringPosition, TOTAL_RINGS, lerp } from './flight.js?v=1.2.0';

const palette={leaf:0x478e55,light:0x79ad5d,dark:0x23664b,sand:0xe5d9a5,rock:0x849c86};
function material(color,extra={}){return new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true,...extra});}
function mesh(geo,mat,parent,x=0,y=0,z=0,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
export class World {
  constructor(canvas){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,navigator.maxTouchPoints>1?1.15:1.75));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.22;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0xc8e2d7);this.scene.fog=new THREE.Fog(0xc8e2d7,100,420);
    this.camera=new THREE.PerspectiveCamera(52,1,.3,700);
    this.scene.add(new THREE.HemisphereLight(0xf6ffe3,0x466d60,2.5));
    const sun=new THREE.DirectionalLight(0xffefca,3.2);sun.position.set(-80,120,60);this.scene.add(sun);
    this.water=mesh(new THREE.PlaneGeometry(2600,3300,1,1),material(0x76bcb0,{metalness:.15,roughness:.45}),this.scene,0,-3,-800);
    this.water.rotation.x=-Math.PI/2;
    this.makeTerrain();this.makeParrot();this.makeRings();this.makeClouds();
    this.look=new THREE.Vector3();this.position=new THREE.Vector3();
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas.parentElement);this.resize();
    this.particles=[];this.particleGeo=new THREE.IcosahedronGeometry(.18,0);this.particleMat=material(0xffd874,{emissive:0xf3af30,emissiveIntensity:.5});
  }
  resize(){const c=this.renderer.domElement;const w=c.clientWidth,h=c.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  makeTerrain(){
    let seed=1987;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const ico=new THREE.IcosahedronGeometry(1,1),trunkGeo=new THREE.CylinderGeometry(.25,.5,1,5);
    const sand=material(palette.sand),green=material(0x83ab65),rock=material(palette.rock);
    this.tiles=[];
    for(let tile=0;tile<8;tile++){
      const group=new THREE.Group();group.position.z=-tile*260;this.scene.add(group);this.tiles.push(group);
      for(const side of [-1,1]){
        mesh(ico,sand,group,side*91,-11,-100,88,19,155);
        mesh(ico,green,group,side*100,-7,-100,84,23,142);
        for(let j=0;j<6;j++){
          const x=side*(60+rnd()*85),z=-rnd()*260;
          mesh(ico,rock,group,x,5,z,12+rnd()*25,14+rnd()*35,20+rnd()*20);
        }
      }
      const trees=54;
      const crowns=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),material(palette.leaf),trees*2);
      const trunks=new THREE.InstancedMesh(trunkGeo,material(0x665e3e),trees);
      const dummy=new THREE.Object3D(),color=new THREE.Color();
      for(let i=0;i<trees;i++){
        const side=i%2?1:-1,x=side*(43+rnd()*105),z=-100+(rnd()-.5)*190,h=5+rnd()*10;
        const y=-7+23*Math.sqrt(Math.max(0,1-((Math.abs(x)-100)/84)**2-((z+100)/142)**2))-2;
        dummy.position.set(x,y+h*.5,z);dummy.scale.set(1,h,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
        for(let k=0;k<2;k++){
          dummy.position.set(x+(k?2:0),y+h+(k?-1:2),z);dummy.scale.set(3+h*.25,3+h*.18,3+h*.25);dummy.rotation.set(rnd(),rnd(),rnd());dummy.updateMatrix();crowns.setMatrixAt(i*2+k,dummy.matrix);color.setHex([0x3e8050,0x629d51,0x8ab35f,0x286d4e][Math.floor(rnd()*4)]);crowns.setColorAt(i*2+k,color);
        }
      }
      group.add(crowns,trunks);
      // Pale sand bars and small green islands frame a continuous navigable river.
      for(let j=0;j<4;j++){
        const side=j%2?1:-1,z=-j*65;
        mesh(ico,sand,group,side*(30+rnd()*9),-2,z,12,4,22);
        mesh(ico,green,group,side*(33+rnd()*9),0,z,9,3,16);
      }
    }
    const waveGeo=new THREE.PlaneGeometry(3,.12),waveMat=new THREE.MeshBasicMaterial({color:0xc7e7cf,transparent:true,opacity:.38});
    this.waves=new THREE.InstancedMesh(waveGeo,waveMat,500);const d=new THREE.Object3D();
    for(let i=0;i<500;i++){d.position.set((rnd()-.5)*64,-2.85,-rnd()*2100);d.rotation.x=-Math.PI/2;d.scale.set(.5+rnd()*2,1,1);d.updateMatrix();this.waves.setMatrixAt(i,d.matrix);}this.scene.add(this.waves);
  }
  makeParrot(){
    this.bird=new THREE.Group();this.scene.add(this.bird);
    const body=material(0x48a936),breast=material(0x8fcf46),dark=material(0x238950),lime=material(0xc4db4d),blue=material(0x258f99),beak=material(0xe4ac53),black=material(0x142e29),white=material(0xf7efd5);
    const ico=new THREE.IcosahedronGeometry(1,2);
    mesh(ico,body,this.bird,0,0,0,.7,.63,1.22);
    mesh(ico,breast,this.bird,0,-.24,-.37,.55,.44,.7);
    mesh(ico,body,this.bird,0,.42,-.91,.59,.59,.62);
    mesh(ico,lime,this.bird,0,.75,-1.02,.44,.23,.4);
    // Curved parrot bill and pale eye patches, visible when banking.
    mesh(ico,beak,this.bird,0,.3,-1.45,.28,.32,.28);
    const tip=mesh(new THREE.ConeGeometry(.17,.4,6),black,this.bird,0,.08,-1.51);tip.rotation.x=.3;tip.rotation.z=Math.PI;
    for(const s of [-1,1]){
      mesh(ico,white,this.bird,s*.48,.51,-1.13,.1,.17,.2);
      mesh(ico,black,this.bird,s*.56,.53,-1.18,.055,.085,.085);
      mesh(ico,beak,this.bird,s*.28,-.55,.22,.09,.12,.25);
    }
    this.wings=[];
    for(const side of [-1,1]){
      const wing=new THREE.Group();wing.position.set(side*.45,.13,-.1);this.bird.add(wing);this.wings.push(wing);
      mesh(ico,body,wing,side*.65,0,.06,1,.17,.55);
      mesh(ico,breast,wing,side*1.4,-.01,.22,.85,.12,.46);
      for(let f=0;f<7;f++){
        const feather=mesh(ico,f<3?dark:blue,wing,side*(1.05+f*.22),-.04,.43+f*.07,.21,.08,.71-f*.025);feather.rotation.y=side*(-.25-f*.07);
      }
    }
    for(let i=-2;i<=2;i++){const tail=mesh(ico,i%2?dark:blue,this.bird,i*.16,-.08,1.34,.16,.08,1.05-Math.abs(i)*.13);tail.rotation.y=i*.09;tail.rotation.x=-.13;}
    this.bird.scale.setScalar(1.4);
  }
  makeRings(){
    this.rings=[];const geo=new THREE.TorusGeometry(5.5,.2,8,56);
    for(let i=0;i<TOTAL_RINGS;i++){
      const p=ringPosition(i),g=new THREE.Group();g.position.set(p.x,p.y,p.z);this.scene.add(g);
      const torus=mesh(geo,material(0xf9d06b,{emissive:0xe8a834,emissiveIntensity:.35,metalness:.25}),g);
      const inner=mesh(new THREE.TorusGeometry(5.1,.045,5,56),material(0xfff6ca,{emissive:0xffffb0,emissiveIntensity:.6}),g);inner.rotation.z=.4;
      const marker=mesh(new THREE.OctahedronGeometry(.65),material(0xffd572),g,0,7,0);
      this.rings.push({g,torus,marker,done:false});
    }
  }
  makeClouds(){
    this.clouds=new THREE.Group();this.scene.add(this.clouds);const geo=new THREE.IcosahedronGeometry(1,2),mat=material(0xf2f7e7);
    for(let i=0;i<36;i++){const x=Math.sin(i*9)*210,z=-i*65;for(let j=0;j<3;j++)mesh(geo,mat,this.clouds,x+j*9,65+Math.sin(i)*10,z,14,4+j,7);}
  }
  reset(){for(const r of this.rings){r.g.visible=true;r.g.scale.setScalar(1);r.done=false;r.torus.material.color.setHex(0xf9d06b);}for(const p of this.particles)this.scene.remove(p.mesh);this.particles=[];}
  ringEvent(event){const r=this.rings[event.index];r.done=true;r.torus.material.color.setHex(event.type==='ring'?0xbbeb76:0xc4b89a);if(event.type==='ring'){for(let i=0;i<24;i++){const m=mesh(this.particleGeo,this.particleMat,this.scene,r.g.position.x,r.g.position.y,r.g.position.z);this.particles.push({mesh:m,life:1.2,v:new THREE.Vector3((Math.random()-.5)*15,(Math.random()-.5)*15,(Math.random()-.5)*12)});}}}
  render(state,input,time,dt,playing){
    const bob=playing?0:Math.sin(time*1.2)*.45;
    this.bird.position.set(state.x,state.y+bob,state.z);
    this.bird.rotation.z=lerp(this.bird.rotation.z,-input.turn*.55,Math.min(1,dt*5));
    this.bird.rotation.x=lerp(this.bird.rotation.x,state.vy*.025,Math.min(1,dt*5));
    this.bird.rotation.y=lerp(this.bird.rotation.y,-input.turn*.2,Math.min(1,dt*4));
    const flap=Math.sin(time*(input.boost?11:5.8))*(input.boost?.85:playing?.42:.23);
    const tracked=playing&&Number.isFinite(input.leftWing);
    const a=1-Math.exp(-dt*12),fold=playing?(input.foldAmount||0):0;
    this.wings[0].rotation.z=lerp(this.wings[0].rotation.z,tracked?-input.leftWing:flap,a);
    this.wings[1].rotation.z=lerp(this.wings[1].rotation.z,tracked?input.rightWing:-flap,a);
    this.wings[0].rotation.y=lerp(this.wings[0].rotation.y,fold*1.1,a);
    this.wings[1].rotation.y=lerp(this.wings[1].rotation.y,-fold*1.1,a);
    const aspect=this.camera.aspect;
    const offset=playing?new THREE.Vector3(0,6.5,18):new THREE.Vector3(10,7,18);
    this.position.set(state.x*.72+offset.x,state.y+offset.y,state.z+offset.z);
    this.camera.position.lerp(this.position,1-Math.exp(-dt*4));
    this.look.set(state.x*.8+(playing?0:-3),state.y+(playing?0:1),state.z-(playing?21:12));this.camera.lookAt(this.look);
    this.camera.fov=lerp(this.camera.fov,playing?55+(state.speed-21)*.65:(aspect<.8?63:52),dt*2);this.camera.updateProjectionMatrix();
    for(const r of this.rings){r.marker.rotation.y=time;r.marker.position.y=7+Math.sin(time*2)*.25;if(r.done){r.g.scale.multiplyScalar(1+dt*.6);if(r.g.position.z>state.z+20)r.g.visible=false;}}
    for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.life-=dt;p.mesh.position.addScaledVector(p.v,dt);p.mesh.scale.setScalar(Math.max(0,p.life));if(p.life<=0){this.scene.remove(p.mesh);this.particles.splice(i,1);}}
    this.renderer.render(this.scene,this.camera);
  }
}
