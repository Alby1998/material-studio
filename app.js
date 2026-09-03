import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {TDSLoader} from 'three/addons/loaders/TDSLoader.js';
import {TGALoader} from 'three/addons/loaders/TGALoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {Sky} from 'three/addons/objects/Sky.js';
import {LANGS,lang,setLang,T,locale,applyI18n} from './i18n.js';

/* ---------- stato progetto ---------- */
const P = { modelName:'', textures:{}, materials:{}, assign:{}, modelRot:0, sections:[], hidden:[] }; // assign: meshKey -> matId
let curMat=null, meshes=[], sel=new Set(), matCache={}, texCache={}, matSrc={};
let hudInfo=null;   // ultimi dati della barra info, per ricomporla al cambio lingua
const MAPS=[['map','Albedo'],['normalMap','Normal'],['roughnessMap','Rough'],['metalnessMap','Metal'],['aoMap','AO'],['alphaMap','Alpha']];

/* ---------- three ---------- */
const vp=document.getElementById('viewport');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.outputColorSpace=THREE.SRGBColorSpace;
vp.appendChild(renderer.domElement);

const scene=new THREE.Scene(); scene.background=new THREE.Color(0x0d1014);
const camera=new THREE.PerspectiveCamera(45,1,.05,5000); camera.position.set(8,6,10);
const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true;
controls.mouseButtons={LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:null};
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());

/* --- mouselook: tasto destro ruota la visuale senza spostare la camera --- */
let look=null;
const LOOK_SENS=.0032;
renderer.domElement.addEventListener('pointerdown',e=>{
  if(e.button!==2) return;
  const d=new THREE.Vector3(); camera.getWorldDirection(d);
  look={x:e.clientX,y:e.clientY,
    yaw:Math.atan2(-d.x,-d.z), pitch:Math.asin(THREE.MathUtils.clamp(d.y,-1,1)),
    dist:camera.position.distanceTo(controls.target)};
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove',e=>{
  if(!look) return;
  look.yaw   -= (e.clientX-look.x)*LOOK_SENS;
  look.pitch -= (e.clientY-look.y)*LOOK_SENS;
  look.pitch = THREE.MathUtils.clamp(look.pitch,-1.5533,1.5533);
  look.x=e.clientX; look.y=e.clientY;
  const cp=Math.cos(look.pitch);
  const f=new THREE.Vector3(-Math.sin(look.yaw)*cp, Math.sin(look.pitch), -Math.cos(look.yaw)*cp);
  controls.target.copy(camera.position).addScaledVector(f,look.dist);  // camera ferma, pivot davanti
});
['pointerup','pointercancel'].forEach(t=>renderer.domElement.addEventListener(t,e=>{
  if(e.button===2||t==='pointercancel') look=null;
}));

const pmrem=new THREE.PMREMGenerator(renderer); pmrem.compileEquirectangularShader();
let envRT=null, hdriTex=null;
const skyScene=new THREE.Scene(); const skyMesh=new Sky(); skyMesh.scale.setScalar(45000); skyScene.add(skyMesh);
const skyDome=new Sky(); skyDome.scale.setScalar(45000); skyDome.visible=false; scene.add(skyDome);

const sun=new THREE.DirectionalLight(0xffffff,2.2); sun.position.set(12,18,8);
sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
const sc=sun.shadow.camera; sc.near=.5; sc.far=200; sc.left=sc.bottom=-40; sc.right=sc.top=40;
const hemi=new THREE.HemisphereLight(0xbfd4ff,0x30302c,.6);
scene.add(sun,hemi);

/* ================= AMBIENTE + SOLE GEOGRAFICO ================= */
const ENV={preset:'studio', lat:45.44, lon:10.99, month:6, day:21, hour:11, turbidity:4, rot:0, north:0};
const sunDir=new THREE.Vector3();
let sceneR=30;   // raggio scena, guida distanza sole e shadow camera

// posizione solare (NOAA semplificato) -> azimut/elevazione in radianti
function solarPos(lat,lon,month,day,hour){
  const doy=Math.floor(30.44*(month-1))+day;
  const g=2*Math.PI/365*(doy-1+(hour-12)/24);
  const decl=0.006918-0.399912*Math.cos(g)+0.070257*Math.sin(g)-0.006758*Math.cos(2*g)
    +0.000907*Math.sin(2*g)-0.002697*Math.cos(3*g)+0.00148*Math.sin(3*g);
  const eqt=229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)
    -0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));            // minuti
  const tz=Math.round(lon/15);
  const tst=hour*60+eqt+4*(lon-15*tz);                           // ora solare vera
  const ha=(tst/4-180)*Math.PI/180;                              // angolo orario
  const la=lat*Math.PI/180;
  const alt=Math.asin(THREE.MathUtils.clamp(Math.sin(la)*Math.sin(decl)+Math.cos(la)*Math.cos(decl)*Math.cos(ha),-1,1));
  let az=Math.atan2(-Math.sin(ha)*Math.cos(decl),
    Math.cos(la)*Math.sin(decl)-Math.sin(la)*Math.cos(decl)*Math.cos(ha));  // 0 = Nord, orario
  return {alt,az};
}
// colore/intensità del sole in funzione dell'altezza (estinzione atmosferica)
function sunTint(alt){
  const t=THREE.MathUtils.clamp(alt/(Math.PI/2),0,1);
  const c=new THREE.Color().setHSL(THREE.MathUtils.lerp(.075,.13,Math.pow(t,.4)),
    THREE.MathUtils.lerp(.85,.05,Math.pow(t,.5)),.5);
  return {color:c,int:THREE.MathUtils.clamp(Math.sin(Math.max(alt,0))*3.4,0,3.4)};
}
const PRESETS={
  studio:{name:'Studio neutro',turbidity:2.2,hemi:1.0,sun:.55,expo:1.0,sky:false},
  giorno:{name:'Mezzogiorno',turbidity:3,hemi:.45,sun:1.0,expo:.85,sky:true},
  velato:{name:'Cielo coperto',turbidity:12,hemi:1.1,sun:.18,expo:1.15,sky:true},
  tramonto:{name:'Tramonto',turbidity:6,hemi:.5,sun:1.0,expo:1.2,sky:true}
};
function updateEnv(){
  const pr=PRESETS[ENV.preset]||PRESETS.studio;
  const {alt,az}=solarPos(ENV.lat,ENV.lon,ENV.month,ENV.day,ENV.hour);
  // az misurato da Nord in senso orario -> assi three (X est, Z sud)
  const azw=az+ENV.north;   // nord del modello ruotato rispetto a -Z
  sunDir.set(Math.cos(alt)*Math.sin(azw),Math.sin(alt),-Math.cos(alt)*Math.cos(azw));
  northArrow.setDirection(new THREE.Vector3(Math.sin(ENV.north),0,-Math.cos(ENV.north)));
  const t=sunTint(alt);
  sun.position.copy(sunDir).multiplyScalar(sceneR*2.5);
  const sc=sun.shadow.camera,e=sceneR*.9;
  sc.left=sc.bottom=-e; sc.right=sc.top=e; sc.near=sceneR*.5; sc.far=sceneR*5; sc.updateProjectionMatrix();
  sun.color.copy(t.color); sun.intensity=t.int*pr.sun;
  sun.visible=alt>-.05;

  if(ENV.preset==='hdri'&&hdriTex){
    if(envRT) envRT.dispose();
    envRT=pmrem.fromEquirectangular(hdriTex);
    scene.environment=envRT.texture; scene.environmentRotation=new THREE.Euler(0,ENV.rot,0);
    skyDome.visible=false;
    if(E('cSky').checked){ scene.background=hdriTex; scene.backgroundRotation=new THREE.Euler(0,ENV.rot,0); }
    else scene.background=new THREE.Color(0x0d1014);
  } else if(pr.sky||ENV.preset!=='studio'){
    const u=skyMesh.material.uniforms;
    u.turbidity.value=pr.turbidity; u.rayleigh.value=ENV.preset==='velato'?.6:2.2;
    u.mieCoefficient.value=.005; u.mieDirectionalG.value=.8;
    u.sunPosition.value.copy(sunDir);
    Object.assign(skyDome.material.uniforms,{});
    ['turbidity','rayleigh','mieCoefficient','mieDirectionalG','sunPosition'].forEach(k=>
      skyDome.material.uniforms[k].value=u[k].value);
    if(envRT) envRT.dispose();
    envRT=pmrem.fromScene(skyScene);
    scene.environment=envRT.texture; scene.environmentRotation=new THREE.Euler(0,0,0);
    skyDome.visible=E('cSky').checked;
    scene.background=skyDome.visible?null:new THREE.Color(0x0d1014);
  } else {
    if(envRT) envRT.dispose();
    envRT=pmrem.fromScene(new RoomEnvironment(),0.04);
    scene.environment=envRT.texture; scene.environmentRotation=new THREE.Euler(0,0,0);
    skyDome.visible=false; scene.background=new THREE.Color(0x0d1014);
  }
  hemi.intensity=pr.hemi*(+E('envI').value);
  renderer.toneMappingExposure=pr.expo*(+E('expo').value);
  const h=Math.floor(ENV.hour), m=Math.round((ENV.hour-h)*60);
  touch();
  E('sunInfo').textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} · alt ${(alt*180/Math.PI).toFixed(0)}° · az ${((az*180/Math.PI+360)%360).toFixed(0)}°`;
}

const grid=new THREE.GridHelper(100,100,0x2c3542,0x1b2029);
grid.material.transparent=true; grid.material.opacity=.6; scene.add(grid);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.ShadowMaterial({opacity:.28}));
ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
// asse Nord (-Z) come riferimento per l'orientamento solare
const northArrow=new THREE.ArrowHelper(new THREE.Vector3(0,0,-1),new THREE.Vector3(0,.02,0),8,0x38bdf8,1.6,.9);
scene.add(northArrow);

let root=null;
/* --- evidenziazione selezione: rim outline + fresnel laterale, visibile attraverso i muri --- */
const HL=new THREE.Color(0x39ff14);
const hlGroup=new THREE.Group(); scene.add(hlGroup);
// 1. maschera: scrive la profondità della prop ignorando la scena (così il rim passa i muri)
const maskMat=new THREE.MeshBasicMaterial({colorWrite:false,depthTest:false,depthWrite:true});
// 2. guscio esteso lungo le normali, testato contro la maschera -> resta solo il bordo
const outlineMat=new THREE.ShaderMaterial({
  uniforms:{uThick:{value:.0035},uColor:{value:HL}},
  vertexShader:`uniform float uThick;
    void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0);
      vec3 n=normalize(normalMatrix*normal);
      mv.xyz+=n*uThick*max(-mv.z,0.01);
      gl_Position=projectionMatrix*mv; }`,
  fragmentShader:`uniform vec3 uColor; void main(){ gl_FragColor=vec4(uColor,1.0); }`,
  side:THREE.BackSide, depthTest:true, depthWrite:false, transparent:true
});
// 3. fresnel: alone tenue solo sui fianchi, centro della superficie intatto
const rimMat=new THREE.ShaderMaterial({
  uniforms:{uColor:{value:HL},uPow:{value:3.0},uInt:{value:.55}},
  vertexShader:`varying vec3 vN; varying vec3 vV;
    void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0);
      vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz);
      gl_Position=projectionMatrix*mv; }`,
  fragmentShader:`uniform vec3 uColor; uniform float uPow; uniform float uInt;
    varying vec3 vN; varying vec3 vV;
    void main(){ float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),uPow);
      gl_FragColor=vec4(uColor*f*uInt,f*uInt); }`,
  side:THREE.FrontSide, depthTest:true, depthWrite:false,
  transparent:true, blending:THREE.AdditiveBlending
});
const hoverGroup=new THREE.Group(); scene.add(hoverGroup);
const hoverMat=new THREE.MeshBasicMaterial({color:0x38bdf8,transparent:true,opacity:.22,
  depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
function highlight(){
  while(hlGroup.children.length) hlGroup.remove(hlGroup.children[0]);
  sel.forEach(o=>{
    if(!o.visible) return;
    o.updateWorldMatrix(true,false);
    [maskMat,outlineMat,rimMat].forEach((m,i)=>{
      const g=new THREE.Mesh(o.geometry,m);
      g.matrixAutoUpdate=false; g.matrix.copy(o.matrixWorld);
      g.renderOrder=1000+i; g.frustumCulled=false;
      hlGroup.add(g);
    });
  });
}

function resize(){const w=vp.clientWidth,h=vp.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(vp); resize();
const clock=new THREE.Clock();
let navBase=15;
const keys=new Set();
function moveNav(dt){
  if(!keys.size) return;
  const f=new THREE.Vector3(); camera.getWorldDirection(f).normalize();
  const r=new THREE.Vector3().crossVectors(f,camera.up).normalize();
  const mv=new THREE.Vector3();
  if(keys.has('w'))mv.add(f);      if(keys.has('s'))mv.sub(f);
  if(keys.has('d'))mv.add(r);      if(keys.has('a'))mv.sub(r);
  if(keys.has('e'))mv.y+=1;        if(keys.has('q'))mv.y-=1;
  if(!mv.lengthSq()) return;
  mv.normalize().multiplyScalar(navBase*dt);
  camera.position.add(mv); controls.target.add(mv);
}
function loop(){
  moveNav(Math.min(clock.getDelta(),.1));
  controls.update(); renderer.render(scene,camera);
}
/* setAnimationLoop (non un RAF auto-referenziale): puo' essere fermato dall'esterno.
   In un tab nascosto il loop si spegne — niente 60fps di GPU sprecati in background. */
renderer.setAnimationLoop(loop);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){ renderer.setAnimationLoop(null); keys.clear(); }
  else { clock.getDelta();            // scarta il delta accumulato: evita un salto di camera al rientro
         renderer.setAnimationLoop(loop); }
});

/* ---------- caricamento modello ---------- */
const gltf=new GLTFLoader();
const draco=new DRACOLoader(); draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/');
gltf.setDRACOLoader(draco);

function loadModel(file){
  const ext=file.name.split('.').pop().toLowerCase(), url=URL.createObjectURL(file);
  const done=obj=>{URL.revokeObjectURL(url);install(obj,file.name);};
  const err=e=>{toast(T('msg.loadErr',{ext:ext.toUpperCase()}));console.error(e);};
  if(ext==='glb'||ext==='gltf') gltf.load(url,g=>done(g.scene),null,err);
  else if(ext==='fbx') new FBXLoader().load(url,done,null,err);
  else if(ext==='obj') new OBJLoader().load(url,done,null,err);
  else if(ext==='3ds') new TDSLoader().load(url,done,null,err);
  else toast(T('msg.unsupported'));
}

function install(obj,name){
  if(root) scene.remove(root);
  root=obj; P.modelName=name; meshes=[]; sel.clear();
  let i=0, noUV=0;
  obj.traverse(o=>{
    if(!o.isMesh) return;
    o.castShadow=o.receiveShadow=true;
    o.userData.key=(o.name||'mesh')+'#'+(i++);
    o.userData.orig=o.material;
    if(!o.geometry.attributes.uv){ boxUV(o.geometry); noUV++; }
    if(!o.geometry.attributes.uv2 && o.geometry.attributes.uv)
      o.geometry.setAttribute('uv2',o.geometry.attributes.uv);
    meshes.push(o);
  });
  const grpCount={};
  meshes.forEach(o=>{ const b=baseOf(o.userData.key); grpCount[b]=(grpCount[b]||0)+1; });
  collapsedGroups=new Set(Object.keys(grpCount).filter(b=>grpCount[b]>1));   // gruppi chiusi di default: navigazione utile anche a 200 elementi
  // scala + centratura
  const box=new THREE.Box3().setFromObject(obj), size=box.getSize(new THREE.Vector3()), c=box.getCenter(new THREE.Vector3());
  if(size.length()>0){
    const s=size.length()>200?10/size.length()*20:1;
    obj.scale.multiplyScalar(s);
    const b2=new THREE.Box3().setFromObject(obj), c2=b2.getCenter(new THREE.Vector3());
    obj.position.sub(new THREE.Vector3(c2.x,b2.min.y,c2.z));
  }
  obj.rotation.y=P.modelRot*Math.PI/180;
  scene.add(obj); frame(obj);
  const n=harvest();
  applyAll(); refreshUI(); buildEditor(); buildTree();
  hudInfo={name,mesh:meshes.length,mats:n,nouv:noUV};
  document.getElementById('hud').textContent=T('hud',hudInfo);
  toast(T('msg.loaded',{n:meshes.length,m:n}));
}

/* importa i materiali già presenti nel modello dentro la libreria */
function texToData(tex,max=2048){
  const img=tex&&tex.image; if(!img) return null;
  const w=img.width||img.videoWidth, h=img.height||img.videoHeight; if(!w||!h) return null;
  const s=Math.min(1,max/Math.max(w,h));
  const c=document.createElement('canvas'); c.width=Math.round(w*s); c.height=Math.round(h*s);
  try{ c.getContext('2d').drawImage(img,0,0,c.width,c.height); return c.toDataURL('image/png'); }
  catch(e){ return null; }
}
function harvest(){
  // rimuovo gli importati del modello precedente, tengo i materiali creati/modificati
  for(const id in P.materials) if(P.materials[id].imported&&!P.materials[id].dirty){
    delete P.materials[id]; delete matSrc[id];
    for(const k in P.assign) if(P.assign[k]===id) delete P.assign[k];
  }
  const seen=new Map();
  meshes.forEach(o=>{
    const src=Array.isArray(o.material)?o.material[0]:o.material;
    if(!src) return;
    let id=seen.get(src.uuid);
    if(!id){
      id=uid('m_');
      const rough = src.roughness!==undefined ? src.roughness
                  : src.shininess!==undefined ? Math.max(.05,1-Math.min(1,src.shininess/120)) : .8;
      const d={ name:src.name||T('mat.default',{n:seen.size+1}),
        color:'#'+(src.color?src.color.getHexString():'cccccc'),
        metalness:src.metalness!==undefined?src.metalness:0, roughness:rough,
        opacity:src.opacity!==undefined?src.opacity:1, ru:1, rv:1,
        normalScale:src.normalScale?src.normalScale.x:1, maps:{}, imported:true, dirty:false };
      if(src.map&&src.map.repeat){ d.ru=src.map.repeat.x||1; d.rv=src.map.repeat.y||1; }
      MAPS.forEach(([slot])=>{
        const t=src[slot]; if(!t) return;
        const data=texToData(t); if(!data) return;   // se fallisce resta la texture originale (runtime)
        const tid=uid('t_');
        P.textures[tid]={name:(t.name||slot)+' · '+(src.name||'mat'),data};
        d.maps[slot]=tid;
      });
      P.materials[id]=d; matSrc[id]=src; seen.set(src.uuid,id);
    }
    P.assign[o.userData.key]=id;
  });
  if(seen.size) curMat=[...seen.values()][0];
  return seen.size;
}
function markDirty(id){ const d=P.materials[id]; if(d&&d.imported&&!d.dirty){ d.dirty=true; } }

// UV box-projection per mesh CAD senza coordinate texture (1 unità = 1 metro)
function boxUV(g){
  const p=g.attributes.position, n=g.attributes.normal||(g.computeVertexNormals(),g.attributes.normal);
  const uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));
    let u,v;
    if(ay>=ax&&ay>=az){u=x;v=z;} else if(ax>=az){u=z;v=y;} else {u=x;v=y;}
    uv[i*2]=u; uv[i*2+1]=v;
  }
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  g.setAttribute('uv2',new THREE.BufferAttribute(uv,2));
}

function frame(obj,tight){
  const box=new THREE.Box3().setFromObject(obj),c=box.getCenter(new THREE.Vector3()),s=box.getSize(new THREE.Vector3()).length();
  const k=tight?.34:1;
  controls.target.copy(c); camera.position.copy(c).add(new THREE.Vector3(s*.6*k,s*.45*k,s*.7*k));
  camera.near=Math.max(.01,s*k/500); camera.far=Math.max(s*20,200); camera.updateProjectionMatrix(); controls.update();
  if(!tight){ sceneR=Math.max(2,s*.7); northArrow.setLength(sceneR*.5,sceneR*.1,sceneR*.055); updateEnv(); }
}
function frameSel(){ if(!sel.size) return; const b=new THREE.Box3(); sel.forEach(o=>b.expandByObject(o));
  const g=new THREE.Object3D(); scene.add(g); const m=new THREE.Mesh(new THREE.BoxGeometry(
    Math.max(b.max.x-b.min.x,.01),Math.max(b.max.y-b.min.y,.01),Math.max(b.max.z-b.min.z,.01)));
  m.position.copy(b.getCenter(new THREE.Vector3())); g.add(m); frame(g,true); scene.remove(g); }

/* ---------- materiali ---------- */
const uid=p=>p+Math.random().toString(36).slice(2,9);
function newMat(base){
  const id=uid('m_');
  P.materials[id]=Object.assign({name:T('mat.default',{n:Object.keys(P.materials).length+1}),
    color:'#cccccc',metalness:0,roughness:.75,opacity:1,ru:1,rv:1,normalScale:1,maps:{}},
    base?JSON.parse(JSON.stringify({...base,name:T('mat.copy',{name:base.name})})):{});
  curMat=id; return id;
}
function getTex(texId,srgb){
  if(!texId||!P.textures[texId]) return null;
  const k=texId+(srgb?'_s':'_l');
  if(!texCache[k]){
    const t=new THREE.TextureLoader().load(P.textures[texId].data);
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;
    texCache[k]=t;
  }
  return texCache[k];
}
function buildMaterial(id){
  const d=P.materials[id]; if(!d) return null;
  const src=matSrc[id];
  const m=new THREE.MeshStandardMaterial({
    color:new THREE.Color(d.color),metalness:+d.metalness,roughness:+d.roughness,
    transparent:d.opacity<1,opacity:+d.opacity,
    side:src&&src.side!==undefined?src.side:THREE.DoubleSide
  });
  if(src){
    if(src.emissive) m.emissive.copy(src.emissive);
    if(src.emissiveMap) m.emissiveMap=src.emissiveMap;
    m.vertexColors=!!src.vertexColors; m.flatShading=!!src.flatShading;
    if(src.alphaTest) m.alphaTest=src.alphaTest;
    if(src.transparent) m.transparent=true;
  }
  for(const [slot] of MAPS){
    const srgb=(slot==='map');
    let t=null;
    if(d.maps[slot]) t=getTex(d.maps[slot],srgb);            // scelta dell'utente
    else if(d.maps[slot]!==null&&src&&src[slot]) t=src[slot]; // eredita dall'originale
    if(t){ const c=t.clone(); c.needsUpdate=true; c.wrapS=c.wrapT=THREE.RepeatWrapping; c.repeat.set(+d.ru,+d.rv); m[slot]=c; }
  }
  if(m.normalMap) m.normalScale=new THREE.Vector2(+d.normalScale,+d.normalScale);
  if(m.aoMap) m.aoMapIntensity=1;
  m.needsUpdate=true; return m;
}
function applyAll(){
  matCache={};
  meshes.forEach(o=>{
    const id=P.assign[o.userData.key], d=id&&P.materials[id];
    if(!d){ o.material=o.userData.orig; return; }
    if(d.imported&&!d.dirty&&matSrc[id]){ o.material=matSrc[id]; return; } // FBX intatto
    if(!matCache[id]) matCache[id]=buildMaterial(id);
    o.material=matCache[id];
  });
}
function refreshCur(){ markPending(); }
function markPending(){ const d=P.materials[curMat]; if(!d) return; d.pending=true; refreshUI(); updateApplyBtn(); }
function commit(id){
  const d=P.materials[id]; if(!d) return; touch();
  markDirty(id); d.pending=false;
  matCache[id]=buildMaterial(id);
  meshes.forEach(o=>{ if(P.assign[o.userData.key]===id) o.material=matCache[id]; });
}
function updateApplyBtn(){
  const d=curMat&&P.materials[curMat], b=E('bAssign');
  b.textContent = sel.size ? T('r.applySel',{n:sel.size}) : d&&d.pending ? T('r.applyChanges') : T('r.applySelEmpty');
  b.classList.toggle('pend', !!(d&&d.pending));
}
function revertCur(){
  const d=P.materials[curMat], src=matSrc[curMat]; if(!d||!src) return;
  const rough=src.roughness!==undefined?src.roughness:(src.shininess!==undefined?Math.max(.05,1-Math.min(1,src.shininess/120)):.8);
  Object.assign(d,{color:'#'+(src.color?src.color.getHexString():'cccccc'),
    metalness:src.metalness!==undefined?src.metalness:0, roughness:rough,
    opacity:src.opacity!==undefined?src.opacity:1, ru:src.map?src.map.repeat.x:1, rv:src.map?src.map.repeat.y:1,
    normalScale:src.normalScale?src.normalScale.x:1, dirty:false, pending:false});
  for(const s in d.maps) if(d.maps[s]===null) delete d.maps[s];
  applyAll(); refreshUI(); buildEditor(); updateApplyBtn(); toast(T('msg.reverted'));
}

/* ---------- UI: outliner ---------- */
const tree=document.getElementById('tree');
const baseOf=k=>k.split('#')[0].replace(/[\d_.]+$/,'');   // prefisso di raggruppamento, usato anche da "Seleziona simili"
let collapsedGroups=new Set();

function mkItemRow(o){
  const k=o.userData.key, hid=hidden.has(k);
  const d=document.createElement('div'); d.className='item'+(sel.has(o)?' sel':'')+(hid?' hid':'');
  d.dataset.key=k;
  /* raggiungibile da tastiera: le righe sono <div>, senza questo Tab le salta del tutto */
  d.tabIndex=0; d.setAttribute('role','option'); d.setAttribute('aria-selected',sel.has(o)?'true':'false');
  const id=P.assign[k], m=id?P.materials[id]:null;
  const col=m?m.color:'#3a4453', mn=m?m.name:'';   // il nome del materiale ora sta solo nel tooltip del pallino
  d.innerHTML=`<button class="eye" title="${hid?T('tree.show'):T('tree.hide')}">${hid?'○':'●'}</button>`+
    `<i class="dot" style="background:${col}"${mn?` title="${mn}"`:''}></i><span>${k}</span>`;
  const eye=d.querySelector('.eye');
  eye.setAttribute('aria-label',hid?T('tree.show'):T('tree.hide'));
  eye.onclick=e=>{ e.stopPropagation();
    pushUndo(T(hid?'undo.showProp':'undo.hideProp'));
    hid?hidden.delete(k):hidden.add(k); applyHidden(); };
  d.onclick=e=>{ if(!e.shiftKey) sel.clear(); sel.has(o)?sel.delete(o):sel.add(o); syncSel(); };
  /* Invio/Spazio = click, come ci si aspetta da un elemento a fuoco */
  d.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); d.click(); } };
  d.ondblclick=()=>{ sel=new Set([o]); syncSel(); frameSel(); };
  d.onmouseenter=()=>hoverMesh(o);
  d.onmouseleave=()=>hoverMesh(null);
  return d;
}
function scrollSelIntoView(){
  const k=[...sel][0]&&[...sel][0].userData.key; if(!k) return;
  const row=tree.querySelector(`.item[data-key="${CSS.escape(k)}"]`);
  if(row) row.scrollIntoView({block:'nearest'});
}
function buildTree(){
  const q=document.getElementById('filter').value.toLowerCase().trim();
  const toks=q?q.split(/\s+/):[];
  const visOnly=document.getElementById('cVisOnly').checked;
  tree.innerHTML='';
  const list=meshes.filter(o=>{
    if(toks.length&&!toks.every(t=>o.userData.key.toLowerCase().includes(t))) return false;
    if(visOnly&&hidden.has(o.userData.key)) return false;
    return true;
  });
  const groups=new Map();   // preserva l'ordine di comparsa
  list.forEach(o=>{ const b=baseOf(o.userData.key); if(!groups.has(b)) groups.set(b,[]); groups.get(b).push(o); });
  groups.forEach((arr,base)=>{
    if(arr.length<2){ tree.appendChild(mkItemRow(arr[0])); return; }   // prefisso unico: niente header
    const collapsed=!toks.length&&collapsedGroups.has(base);   // filtro attivo -> forza l'espansione, altrimenti i risultati restano nascosti
    const allHidden=arr.every(o=>hidden.has(o.userData.key));
    const hdr=document.createElement('div'); hdr.className='grp-hdr'+(arr.some(o=>sel.has(o))?' sel':'');
    hdr.innerHTML=`<span class="chev">${collapsed?'▸':'▾'}</span>`+
      `<button class="eye" title="${allHidden?T('tree.show'):T('tree.hide')}">${allHidden?'○':'●'}</button>`+
      `<span class="gname">${base}</span><span class="gcnt">${arr.length}</span>`;
    hdr.querySelector('.eye').onclick=e=>{ e.stopPropagation();
      pushUndo(T(allHidden?'undo.showGroup':'undo.hideGroup'));
      arr.forEach(o=>allHidden?hidden.delete(o.userData.key):hidden.add(o.userData.key)); applyHidden(); };
    hdr.onclick=e=>{ if(e.target.closest('.eye')) return;
      collapsed?collapsedGroups.delete(base):collapsedGroups.add(base); buildTree(); };
    tree.appendChild(hdr);
    if(!collapsed){
      const body=document.createElement('div'); body.className='grp-body';
      arr.forEach(o=>body.appendChild(mkItemRow(o)));
      tree.appendChild(body);
    }
  });
  const nh=hidden.size;
  document.getElementById('cnt').textContent=meshes.length
    ?`${sel.size}/${meshes.length}`+(nh?' · '+T('tree.hiddenCount',{n:nh}):''):'';
  scrollSelIntoView();
}
document.getElementById('cVisOnly').onchange=buildTree;
document.getElementById('bExpAll').onclick=()=>{ collapsedGroups.clear(); buildTree(); };
document.getElementById('bColAll').onclick=()=>{
  meshes.forEach(o=>collapsedGroups.add(baseOf(o.userData.key))); buildTree();
};

/* ---------- visibilità ---------- */
let hidden=new Set();
function applyHidden(){
  P.hidden=[...hidden]; touch();
  meshes.forEach(o=>o.visible=!hidden.has(o.userData.key));
  [...sel].forEach(o=>{ if(!o.visible) sel.delete(o); });
  highlight(); buildTree(); buildCurCard(); updateApplyBtn();
}
function hoverMesh(o){
  while(hoverGroup.children.length) hoverGroup.remove(hoverGroup.children[0]);
  if(!o||!o.visible||sel.has(o)) return;
  o.updateWorldMatrix(true,false);
  const g=new THREE.Mesh(o.geometry,hoverMat);
  g.matrixAutoUpdate=false; g.matrix.copy(o.matrixWorld); g.renderOrder=1010; g.frustumCulled=false;
  hoverGroup.add(g);
}
function syncSel(){
  highlight();
  const ids=new Set([...sel].map(o=>P.assign[o.userData.key]).filter(Boolean));
  if(ids.size===1) curMat=[...ids][0];
  buildEditor(); buildCurCard(); buildTree(); updateApplyBtn();
}
/* buildTree() ricostruisce tutto il DOM dell'outliner: su modelli da centinaia di mesh
   una ricostruzione per ogni tasto premuto e' sprecata. 120ms = sotto la soglia percepita. */
let filterTimer=null;
document.getElementById('filter').oninput=()=>{
  clearTimeout(filterTimer); filterTimer=setTimeout(buildTree,120);
};
document.getElementById('bAll').onclick=()=>{sel=new Set(meshes);syncSel();};
document.getElementById('bSimili').onclick=()=>{
  if(!sel.size) return;
  const bases=new Set([...sel].map(o=>baseOf(o.userData.key)));
  meshes.forEach(o=>{ if(bases.has(baseOf(o.userData.key))) sel.add(o); });
  syncSel();
};
document.getElementById('bHide').onclick=()=>{
  if(!sel.size) return;
  pushUndo(T('undo.hide'));
  sel.forEach(o=>hidden.add(o.userData.key));
  applyHidden();                       // svuota la selezione: le mesh nascoste ne escono
};
document.getElementById('bIso').onclick=()=>{
  if(!sel.size) return;
  pushUndo(T('undo.isolate'));
  hidden=new Set(meshes.filter(o=>!sel.has(o)).map(o=>o.userData.key));
  applyHidden(); frameSel();
};
document.getElementById('bShowAll').onclick=()=>{
  if(!hidden.size) return;
  pushUndo(T('undo.showAll')); hidden.clear(); applyHidden();
};

/* ---------- picking ---------- */
const ray=new THREE.Raycaster(), mouse=new THREE.Vector2(); let down=null;
renderer.domElement.addEventListener('pointerdown',e=>down=e.button===0?{x:e.clientX,y:e.clientY}:null);
renderer.domElement.addEventListener('pointerup',e=>{
  if(e.button!==0) return;
  if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>4) return;
  const r=renderer.domElement.getBoundingClientRect();
  mouse.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(mouse,camera);
  const hit=ray.intersectObjects(meshes.filter(o=>o.visible),false)[0];
  if(!e.shiftKey) sel.clear();
  if(hit) sel.has(hit.object)?sel.delete(hit.object):sel.add(hit.object);
  syncSel();
});
renderer.domElement.addEventListener('dblclick',()=>frameSel());

/* ---------- UI: materiale della prop + libreria ---------- */
const E=id=>document.getElementById(id);
const matlist=document.getElementById('matlist');

function matCardHTML(id,used){
  const d=P.materials[id], t=d.maps.map&&P.textures[d.maps.map];
  const tag=d.pending?` <b style="color:var(--accent-2);font-weight:400;font-size:10px">${T('card.pending')}</b>`
    :d.imported&&!d.dirty?` <b style="color:var(--dim);font-weight:400;font-size:10px">${T('card.original')}</b>`
    :d.dirty?` <b style="color:var(--warn);font-weight:400;font-size:10px">${T('card.modified')}</b>`:'';
  return `<i class="sw" style="background:${d.color} ${t?`url(${P.textures[d.maps.map].data})`:''} center/cover"></i>
    <span class="nm">${d.name}${tag}</span>`+
    (used!==undefined?`<button class="mini selUsers" title="${T('tree.selUsers.t')}" style="margin-left:auto">${used}</button>`:'');
}
function buildCurCard(){
  E('nosel').style.display=sel.size?'none':'block';
  E('propbox').style.display=sel.size?'block':'none';
  E('selinfo').textContent=sel.size?(sel.size===1?[...sel][0].userData.key:T('sel.props',{n:sel.size})):'';
  if(!sel.size) return;
  const ids=new Set([...sel].map(o=>P.assign[o.userData.key]));
  const el=document.createElement('div'); el.className='matcard sel';
  if(ids.size>1) el.innerHTML='<i class="sw" style="background:repeating-linear-gradient(45deg,#333,#333 4px,#555 4px,#555 8px)"></i><span class="nm">'+T('card.multiMat')+'</span>';
  else if(curMat&&P.materials[curMat]) el.innerHTML=matCardHTML(curMat);
  else el.innerHTML='<i class="sw" style="background:#333"></i><span class="nm">'+T('card.noMat')+'</span>';
  el.onclick=openMatPicker;
  E('curcard').innerHTML=''; E('curcard').appendChild(el);
}
function refreshUI(){ buildCurCard(); if(E('mpicker').classList.contains('on')) buildMatList(); }
function openMatPicker(){ E('mpicker').classList.add('on'); buildMatList(); setTimeout(()=>E('mfilter').focus(),0); }
function closeMatPicker(){ E('mpicker').classList.remove('on'); }
function chooseMat(id){
  curMat=id;
  if(sel.size){ pushUndo(T('undo.assign')); sel.forEach(o=>P.assign[o.userData.key]=id); commit(id); }
  closeMatPicker(); buildCurCard(); buildEditor(); buildTree(); updateApplyBtn();
  if(sel.size) toast(T('msg.matApplied',{name:P.materials[id].name,n:sel.size}),doUndo);
}
function buildMatList(){
  matlist.innerHTML='';
  const all=Object.keys(P.materials), q=E('mfilter').value.trim().toLowerCase();
  const ids=q?all.filter(i=>P.materials[i].name.toLowerCase().includes(q)):all;
  E('mcnt').textContent=all.length?(q?`${ids.length}/${all.length}`:all.length):'';
  if(!all.length){ matlist.innerHTML=`<div class="hint">${T('list.noMats')}</div>`; return; }
  if(!ids.length){ matlist.innerHTML=`<div class="hint">${T('list.noNameMatch',{q})}</div>`; return; }
  const used={}; for(const k in P.assign) used[P.assign[k]]=(used[P.assign[k]]||0)+1;
  ids.forEach(id=>{
    const el=document.createElement('div'); el.className='matcard'+(id===curMat?' sel':'');
    el.innerHTML=matCardHTML(id,used[id]||0);
    el.onclick=()=>chooseMat(id);
    const su=el.querySelector('.selUsers');
    if(su) su.onclick=e=>{ e.stopPropagation();
      sel=new Set(meshes.filter(o=>P.assign[o.userData.key]===id));
      closeMatPicker(); syncSel(); frameSel();
    };
    matlist.appendChild(el);
  });
}
E('mpClose').onclick=closeMatPicker;
E('mpicker').addEventListener('click',e=>{ if(e.target.id==='mpicker') closeMatPicker(); });
function buildEditor(){
  const d=P.materials[curMat]; E('editor').style.display=d?'block':'none'; if(!d) return;
  E('mName').value=d.name; E('mColor').value=d.color; E('mHex').value=d.color;
  E('mMetal').value=d.metalness; E('vMetal').textContent=(+d.metalness).toFixed(2);
  E('mRough').value=d.roughness; E('vRough').textContent=(+d.roughness).toFixed(2);
  E('mOpa').value=d.opacity; E('vOpa').textContent=(+d.opacity).toFixed(2);
  E('mRu').value=d.ru; E('mRv').value=d.rv;
  E('mNS').value=d.normalScale; E('vNS').textContent=(+d.normalScale).toFixed(2);
  const s=E('slots'); s.innerHTML='';
  const src=matSrc[curMat];
  MAPS.forEach(([slot,label])=>{
    const cur=d.maps[slot], inherit=src&&src[slot];
    const txt = cur&&P.textures[cur] ? P.textures[cur].name
              : cur===null ? T('slot.none') : inherit ? T('slot.origFbx') : T('slot.none');
    const row=document.createElement('div'); row.className='slot';
    row.innerHTML=`<i class="th" style="background-image:url(${cur&&P.textures[cur]?P.textures[cur].data:''})"></i>
      <span class="nmm">${label}</span>
      <button class="pick" title="${T('slot.choose.t')}">${txt}</button>
      ${inherit?`<button class="mini o" title="${T('slot.useOrig.t')}">↺</button>`:''}
      <button class="mini x" title="${T('slot.none.t')}">✕</button>`;
    row.querySelector('.pick').onclick=()=>openPicker(slot);
    const o=row.querySelector('.o'); if(o) o.onclick=()=>{ delete d.maps[slot]; buildEditor(); markPending(); };
    row.querySelector('.x').onclick=()=>{ d.maps[slot]=null; buildEditor(); markPending(); };
    s.appendChild(row);
  });
  E('tcnt').textContent=Object.keys(P.textures).length||'';
  E('bRevert').style.display=(d.imported&&d.dirty)?'block':'none';
  updateApplyBtn();
}
function syncReadouts(){
  const d=P.materials[curMat]; if(!d) return;
  E('vMetal').textContent=(+d.metalness).toFixed(2);
  E('vRough').textContent=(+d.roughness).toFixed(2);
  E('vOpa').textContent=(+d.opacity).toFixed(2);
  E('vNS').textContent=(+d.normalScale).toFixed(2);
  if(document.activeElement!==E('mHex')) E('mHex').value=d.color;
  if(document.activeElement!==E('mColor')) E('mColor').value=d.color;
}
const bind=(el,fn)=>E(el).addEventListener('input',()=>{const d=P.materials[curMat];if(!d)return;fn(d);syncReadouts();markPending();});
bind('mName',d=>d.name=E('mName').value);
bind('mColor',d=>d.color=E('mColor').value);
bind('mHex',d=>{const v=E('mHex').value.trim();if(/^#[0-9a-f]{6}$/i.test(v))d.color=v;});
bind('mMetal',d=>d.metalness=+E('mMetal').value);
bind('mRough',d=>d.roughness=+E('mRough').value);
bind('mOpa',d=>d.opacity=+E('mOpa').value);
bind('mRu',d=>d.ru=+E('mRu').value||1);
bind('mRv',d=>d.rv=+E('mRv').value||1);
bind('mNS',d=>d.normalScale=+E('mNS').value);
E('mfilter').oninput=buildMatList;
E('bRevert').onclick=revertCur;
E('bNewMat').onclick=()=>chooseMat(newMat());
E('bDupMat').onclick=()=>{ if(curMat) chooseMat(newMat(P.materials[curMat])); };
E('bDelMat').onclick=()=>{ if(!curMat)return; delete P.materials[curMat];
  for(const k in P.assign) if(P.assign[k]===curMat) delete P.assign[k];
  curMat=Object.keys(P.materials)[0]||null; applyAll(); refreshUI(); buildEditor(); buildTree(); };
E('bAssign').onclick=()=>{
  const d=curMat&&P.materials[curMat];
  if(!d) return toast(T('msg.noMat'));
  if(sel.size){ pushUndo(T('undo.assign')); sel.forEach(o=>P.assign[o.userData.key]=curMat); }
  else if(!d.pending) return toast(T('msg.selectMeshes'));
  const n=sel.size;
  commit(curMat);
  refreshUI(); buildTree(); buildEditor(); updateApplyBtn();
  toast(n?T('msg.appliedTo',{n}):T('msg.changesApplied'),n?doUndo:null);
};

/* ---------- texture ---------- */
const IMG_EXT=/\.(png|jpe?g|webp|bmp|gif|avif|ktx2?)$/i, RAW_EXT=/\.(tga)$/i, NOGO_EXT=/\.(tiff?|dds|exr|hdr|psd)$/i;
function addTexture(name,data){ const id=uid('t_'); P.textures[id]={name,data}; return id; }
function addTextures(files){
  const list=[...files]; let ok=0, skip=[];
  let pending=list.length;
  const done=()=>{ if(--pending>0) return;
    buildEditor(); if(E('picker').classList.contains('on')) buildPicker();
    E('tcnt').textContent=Object.keys(P.textures).length||'';
    if(ok){ toast(T('msg.texAdded',{n:ok})); touch(); }
    if(skip.length) toast(T('msg.texSkipped',{list:skip.join(', ')}));
  };
  list.forEach(f=>{
    const isImg=f.type.startsWith('image/')||IMG_EXT.test(f.name);
    if(isImg){
      const r=new FileReader();
      r.onload=()=>{ addTexture(f.name,r.result); ok++; done(); };
      r.onerror=()=>{ skip.push(f.name); done(); };
      r.readAsDataURL(f);
    } else if(RAW_EXT.test(f.name)){          // TGA: decodifica e converte in PNG
      const url=URL.createObjectURL(f);
      new TGALoader().load(url,tex=>{
        URL.revokeObjectURL(url);
        const im=tex.image, c=document.createElement('canvas');
        c.width=im.width; c.height=im.height;
        const ctx=c.getContext('2d'), d=ctx.createImageData(im.width,im.height);
        d.data.set(im.data); ctx.putImageData(d,0,0);
        addTexture(f.name,c.toDataURL('image/png')); ok++; done();
      },null,()=>{ URL.revokeObjectURL(url); skip.push(f.name); done(); });
    } else {
      skip.push(f.name+(NOGO_EXT.test(f.name)?T('tex.convert'):''));
      done();
    }
  });
  if(!list.length) return;
}
E('fTex').onchange=e=>addTextures(e.target.files);
E('fModel').onchange=e=>e.target.files[0]&&loadModel(e.target.files[0]);
E('fProj').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=()=>loadProject(JSON.parse(r.result));r.readAsText(f);};

/* drag & drop */
const drop=E('drop');
['dragenter','dragover'].forEach(t=>vp.addEventListener(t,e=>{e.preventDefault();drop.classList.add('on');}));
['dragleave','drop'].forEach(t=>vp.addEventListener(t,e=>{e.preventDefault();drop.classList.remove('on');}));
vp.addEventListener('drop',e=>{
  const fs=[...e.dataTransfer.files];
  const m=fs.find(f=>/\.(glb|gltf|fbx|obj|3ds)$/i.test(f.name));
  if(m) loadModel(m);
  const imgs=fs.filter(f=>f!==m); if(imgs.length) addTextures(imgs);
});

/* ---------- libreria texture con ricerca ---------- */
let pickSlot=null;
function openPicker(slot){
  pickSlot=slot||null; E('picker').classList.add('on');
  buildPicker(); setTimeout(()=>E('pkq').focus(),0);
}
function closePicker(){ E('picker').classList.remove('on'); pickSlot=null; }
function buildPicker(){
  const q=E('pkq').value.trim().toLowerCase(), g=E('pkgrid'), all=Object.keys(P.textures);
  const ids=all.filter(t=>P.textures[t].name.toLowerCase().includes(q));
  E('pkcnt').textContent=q?`${ids.length}/${all.length}`:all.length;
  g.innerHTML='';
  if(!all.length){ g.innerHTML=`<div class="hint">${T('pick.empty')}</div>`; return; }
  if(!ids.length){ g.innerHTML=`<div class="hint">${T('list.noNameMatch',{q})}</div>`; return; }
  const used={}; for(const m in P.materials) for(const s in P.materials[m].maps){
    const t=P.materials[m].maps[s]; if(t) used[t]=(used[t]||0)+1; }
  ids.forEach(t=>{
    const el=document.createElement('div'); el.className='tex';
    el.innerHTML=`<div class="im" style="background-image:url(${P.textures[t].data})"></div>
      <div class="lb" title="${P.textures[t].name}">${P.textures[t].name}${used[t]?` · ${used[t]}×`:''}</div>
      <button class="del" title="${T('pick.del.t')}">✕</button>`;
    el.onclick=e=>{
      if(e.target.classList.contains('del')){
        if(!confirm(T('confirm.delTexture',{name:P.textures[t].name}))) return;
        delete P.textures[t];
        for(const m in P.materials) for(const s in P.materials[m].maps)
          if(P.materials[m].maps[s]===t) delete P.materials[m].maps[s];
        buildPicker(); buildEditor(); return;
      }
      if(pickSlot&&curMat){ P.materials[curMat].maps[pickSlot]=t; buildEditor(); markPending(); }
      closePicker();
    };
    g.appendChild(el);
  });
}
E('pkq').addEventListener('input',buildPicker);
E('pkClose').onclick=closePicker;
E('pkAdd').onclick=()=>E('fTex').click();
E('bTexLib').onclick=()=>openPicker(null);
E('picker').addEventListener('click',e=>{ if(e.target.id==='picker') closePicker(); });

/* ---------- scena ---------- */
/* ---------- controlli ambiente ---------- */
function doyToDate(n){ const d=new Date(2025,0,1); d.setDate(n); return {m:d.getMonth()+1,d:d.getDate(),
  label:d.toLocaleDateString(locale(),{day:'2-digit',month:'short'})}; }
E('preset').onchange=e=>{
  ENV.preset=e.target.value;
  E('rowHdri').style.display=E('rowRot').style.display=(ENV.preset==='hdri')?'flex':'none';
  if(ENV.preset==='hdri'&&!hdriTex) toast(T('msg.needHdr'));
  updateEnv();
};
E('fHdri').onchange=e=>{
  const f=e.target.files[0]; if(!f) return;
  const url=URL.createObjectURL(f);
  new RGBELoader().load(url,t=>{
    URL.revokeObjectURL(url);
    if(hdriTex) hdriTex.dispose();
    t.mapping=THREE.EquirectangularReflectionMapping; hdriTex=t;
    ENV.preset='hdri'; E('preset').value='hdri';
    E('rowHdri').style.display=E('rowRot').style.display='flex';
    updateEnv(); toast(T('msg.hdrLoaded',{name:f.name}));
  },null,()=>{ URL.revokeObjectURL(url); toast(T('msg.hdrUnreadable')); });
};
E('envRot').oninput=e=>{ ENV.rot=+e.target.value*Math.PI/180; updateEnv(); };
E('place').onchange=e=>{
  const custom=e.target.value==='0,0';
  E('rowLat').style.display=custom?'flex':'none';
  if(!custom){ const [a,b]=e.target.value.split(',').map(Number); ENV.lat=a; ENV.lon=b; }
  E('lat').value=ENV.lat; E('lon').value=ENV.lon; updateEnv();
};
E('lat').oninput=e=>{ ENV.lat=+e.target.value||0; updateEnv(); };
E('lon').oninput=e=>{ ENV.lon=+e.target.value||0; updateEnv(); };
E('doy').oninput=e=>{ const d=doyToDate(+e.target.value); ENV.month=d.m; ENV.day=d.d;
  E('doyv').textContent=d.label; updateEnv(); };
E('hour').oninput=e=>{ ENV.hour=+e.target.value; updateEnv(); };
E('north').oninput=e=>{ ENV.north=+e.target.value*Math.PI/180; E('northv').textContent=e.target.value+'°'; updateEnv(); };
E('bNorth0').onclick=()=>{ E('north').value=0; E('north').oninput({target:E('north')}); };
E('bNorth90').onclick=()=>{ const v=(+E('north').value+90)%360; E('north').value=v; E('north').oninput({target:E('north')}); };
E('mrot').oninput=e=>{
  E('mrotv').textContent=e.target.value+'°';
  if(!root) return;
  P.modelRot=+e.target.value; root.rotation.y=P.modelRot*Math.PI/180; root.updateMatrixWorld(true);
  highlight();   // le mesh di evidenziazione usano matrici congelate
};
E('cSky').onchange=updateEnv;

E('nav').oninput=e=>{ navBase=+e.target.value; E('navv').textContent=navBase.toFixed(1)+' m/s'; };
E('expo').oninput=updateEnv;
E('envI').oninput=e=>{ scene.environmentIntensity=+e.target.value; updateEnv(); };
E('cShadow').onchange=e=>{renderer.shadowMap.enabled=e.target.checked;meshes.forEach(o=>o.material&&(o.material.needsUpdate=true));};
E('cGrid').onchange=e=>{ grid.visible=northArrow.visible=e.target.checked; };
E('bShot').onclick=()=>{renderer.render(scene,camera);
  const a=document.createElement('a');a.download=(P.modelName||T('file.render'))+'.png';a.href=renderer.domElement.toDataURL('image/png');a.click();};

/* ---------- salva / carica ---------- */
function dateToDoy(m,d){ return Math.floor((new Date(2025,m-1,d)-new Date(2025,0,0))/864e5); }
function snapshot(){
  return JSON.parse(JSON.stringify({v:2,...P,env:{...ENV,
    expo:+E('expo').value, envI:+E('envI').value, nav:+E('nav').value,
    sky:E('cSky').checked, grid:E('cGrid').checked, shadow:E('cShadow').checked,
    cam:{p:camera.position.toArray(),t:controls.target.toArray()}}}));
}
function restoreEnv(e){
  if(!e) return;
  Object.assign(ENV,{preset:e.preset??ENV.preset, lat:e.lat??ENV.lat, lon:e.lon??ENV.lon,
    month:e.month??ENV.month, day:e.day??ENV.day, hour:e.hour??ENV.hour,
    rot:e.rot??0, north:e.north??0});
  E('preset').value=ENV.preset==='hdri'&&!hdriTex?'studio':ENV.preset;
  if(ENV.preset==='hdri'&&!hdriTex) ENV.preset='studio';
  E('rowHdri').style.display=E('rowRot').style.display=(ENV.preset==='hdri')?'flex':'none';
  E('lat').value=ENV.lat; E('lon').value=ENV.lon;
  const pv=`${ENV.lat.toFixed(2)},${ENV.lon.toFixed(2)}`;
  E('place').value=[...E('place').options].some(o=>o.value===pv)?pv:'0,0';
  E('rowLat').style.display=E('place').value==='0,0'?'flex':'none';
  E('doy').value=dateToDoy(ENV.month,ENV.day); E('doyv').textContent=doyToDate(+E('doy').value).label;
  E('hour').value=ENV.hour;
  E('north').value=Math.round(ENV.north*180/Math.PI); E('northv').textContent=E('north').value+'°';
  E('envRot').value=Math.round(ENV.rot*180/Math.PI);
  if(e.expo!==undefined) E('expo').value=e.expo;
  if(e.envI!==undefined){ E('envI').value=e.envI; scene.environmentIntensity=+e.envI; }
  if(e.nav!==undefined){ E('nav').value=e.nav; navBase=+e.nav; E('navv').textContent=navBase.toFixed(1)+' m/s'; }
  if(e.sky!==undefined) E('cSky').checked=e.sky;
  if(e.grid!==undefined){ E('cGrid').checked=e.grid; grid.visible=northArrow.visible=e.grid; }
  if(e.shadow!==undefined){ E('cShadow').checked=e.shadow; renderer.shadowMap.enabled=e.shadow; }
  if(e.cam){ camera.position.fromArray(e.cam.p); controls.target.fromArray(e.cam.t); controls.update(); }
  updateEnv();
}
function loadProject(d){
  Object.assign(P,{modelName:d.modelName||'',textures:d.textures||{},materials:d.materials||{},assign:d.assign||{},modelRot:d.modelRot||0,sections:d.sections||[],hidden:d.hidden||[]});
  hidden=new Set(P.hidden); applyHidden();
  E('mrot').value=P.modelRot; E('mrotv').textContent=P.modelRot+'°'; buildSecList();
  if(root){ root.rotation.y=P.modelRot*Math.PI/180; root.updateMatrixWorld(true); highlight(); }
  texCache={}; curMat=Object.keys(P.materials)[0]||null;
  applyAll(); refreshUI(); buildEditor(); buildTree();
  E('tcnt').textContent=Object.keys(P.textures).length||'';
  restoreEnv(d.env);
  toast(P.modelName?T('msg.projLoadedWith',{name:P.modelName}):T('msg.projLoaded'));
}
E('bExport').onclick=()=>{
  const b=new Blob([JSON.stringify(snapshot())],{type:'application/json'});
  const a=document.createElement('a');a.download=(P.modelName||T('file.project'))+'.materials.json';
  a.href=URL.createObjectURL(b);a.click();
};
// IndexedDB
const DB=()=>new Promise((res,rej)=>{const r=indexedDB.open('matstudio',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
const idbPut=async(v,k)=>{ const db=await DB(); return new Promise((res,rej)=>{
  const t=db.transaction('projects','readwrite'); t.objectStore('projects').put(v,k);
  t.oncomplete=res; t.onerror=()=>rej(t.error); }); };
const idbGet=async k=>{ const db=await DB(); return new Promise((res,rej)=>{
  const r=db.transaction('projects').objectStore('projects').get(k);
  r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); };

/* ---------- autosalvataggio ---------- */
let fileHandle=null, saveTimer=null, idbOK=true, ready=false;
let lastStat=null;   // {k,c,p} dell'ultimo messaggio di stato, per ritradurlo
const hhmm=()=>new Date().toLocaleTimeString(locale()).slice(0,5);
function stat(k,c,p){ lastStat={k,c,p}; const e=E('savest'); e.textContent=T(k,p); e.style.color=c||'var(--dim)'; }
function touch(){ if(!ready) return; clearTimeout(saveTimer); saveTimer=setTimeout(autosave,1200); }
async function autosave(){
  const data=snapshot();
  try{ await idbPut(data,'__autosave'); }catch(e){ idbOK=false; }
  if(fileHandle){
    try{ const w=await fileHandle.createWritable(); await w.write(JSON.stringify(data)); await w.close();
      stat('stat.savedFile','var(--accent)',{time:hhmm()}); return;
    }catch(e){ stat('stat.fileNotWritable','var(--warn)'); }
  }
  if(idbOK) stat('stat.savedBrowser','var(--dim)',{time:hhmm()});
  else stat('stat.saveUnavailable','var(--warn)');
}
addEventListener('beforeunload',()=>{ if(saveTimer){ clearTimeout(saveTimer); autosave(); } });

E('bLink').onclick=async()=>{
  if(!window.showSaveFilePicker) return toast(T('msg.needChrome'));
  try{
    fileHandle=await window.showSaveFilePicker({suggestedName:(P.modelName||T('file.project'))+'.materials.json',
      types:[{description:T('file.projDesc'),accept:{'application/json':['.json']}}]});
    try{ await idbPut(fileHandle,'__handle'); }catch(e){}
    await autosave(); toast(T('msg.linked'));
  }catch(e){}
};

/* ---------- scena demo ---------- */
/* Generata via codice invece che distribuita come .glb: nessun problema di licenza
   e nessun binario nel repo. Serve solo a far vedere il flusso completo (selezione ->
   materiale -> sezione -> brief) a chi apre la demo online senza avere un modello proprio.
   I nomi seguono la convenzione di un export ArchiCAD ("Muro_01", "Serramento_02"...):
   e' cosi' che il raggruppamento per prefisso dell'outliner ha senso da mostrare. */
function buildDemoScene(){
  const g=new THREE.Group(); g.name='Demo';
  const M=()=>new THREE.MeshStandardMaterial({color:0xcfcfcf,roughness:.9,metalness:0});
  const add=(name,w,h,d,x,y,z)=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),M());
    m.name=name; m.position.set(x,y+h/2,z); g.add(m); return m;
  };
  const W=8, D=6, H=2.9, t=.2;                 // stanza 8x6, altezza 2.9m

  add('Solaio_01',W,t,D,0,-t,0);               // pavimento
  add('Solaio_02',W,t,D,0,H,0);                // soffitto

  /* perimetro: due muri pieni, due spezzati per lasciare le aperture */
  add('Muro_01',W,H,t,0,0,-D/2);               // nord (pieno)
  add('Muro_02',t,H,D,-W/2,0,0);               // ovest (pieno)
  // sud: due tratti + fascia sopra la finestra
  add('Muro_03',2.4,H,t,-2.8,0,D/2);
  add('Muro_04',2.4,H,t,2.8,0,D/2);
  add('Muro_05',3.2,.9,t,0,H-.9,D/2);          // fascia sopra la finestra: y 2.00..2.90
  add('Muro_09',3.2,.9,t,0,0,D/2);             // parapetto sotto la finestra: y 0..0.90
  // est: due tratti + fascia sopra la porta
  add('Muro_06',t,H,1.9,W/2,0,-2.05);
  add('Muro_07',t,H,1.9,W/2,0,2.05);
  add('Muro_08',t,.8,2.2,W/2,H-.8,0);

  /* aperture: pannelli sottili, cosi' si vede il senso di un materiale trasparente */
  add('Serramento_01',3.2,1.1,.06,0,.9,D/2);   // finestra a sud: riempie il vano y 0.90..2.00
  add('Serramento_02',.06,2.1,2.2,W/2,0,0);    // porta a est

  /* arredo minimo: da' scala alla stanza e qualcosa su cui provare i materiali */
  add('Arredo_Tavolo',1.8,.08,.9,-1.4,.74,-.6);
  add('Arredo_Gamba_01',.08,.74,.08,-2.2,0,-1.0);
  add('Arredo_Gamba_02',.08,.74,.08,-.6,0,-1.0);
  add('Arredo_Gamba_03',.08,.74,.08,-2.2,0,-.2);
  add('Arredo_Gamba_04',.08,.74,.08,-.6,0,-.2);
  add('Arredo_Cucina',2.6,.9,.65,2.6,0,-D/2+.45);
  add('Arredo_Divano',2.0,.75,.85,-2.0,0,1.8);
  return g;
}
/* Materiali di partenza della demo. Non e' solo estetica: senza assegnazioni la scena
   e' tutta grigia, il brief .md esce con una sola voce e il grafico delle superfici per
   materiale non mostra nulla. Assegnando per prefisso ArchiCAD si vede subito a cosa
   serve il raggruppamento dell'outliner. */
const DEMO_MATS=[
  // key i18n           prefisso mesh   colore   metal rough opacity
  ['demo.mat.plaster', ['Muro'],       '#e8e4dc', 0,   .92,  1],
  ['demo.mat.screed',  ['Solaio'],     '#b9b2a6', 0,   .85,  1],
  ['demo.mat.glass',   ['Serramento'], '#bcd4dc', 0,   .10, .28],
  ['demo.mat.oak',     ['Arredo_Tavolo','Arredo_Gamba'], '#a9784b', 0, .55, 1],
  ['demo.mat.lacquer', ['Arredo_Cucina'], '#3d4a52', .15, .35, 1],
  ['demo.mat.fabric',  ['Arredo_Divano'], '#8a7f74', 0,  .95,  1]
];
function assignDemoMaterials(){
  DEMO_MATS.forEach(([key,prefixes,color,metalness,roughness,opacity])=>{
    const id=uid('m_');
    P.materials[id]={name:T(key),color,metalness,roughness,opacity,
                     ru:1,rv:1,normalScale:1,maps:{}};
    meshes.forEach(o=>{
      const n=o.name||'';
      if(prefixes.some(pre=>n.startsWith(pre))) P.assign[o.userData.key]=id;
    });
  });
  curMat=Object.keys(P.materials)[0]||null;
  applyAll();
}
function loadDemoScene(){
  install(buildDemoScene(),T('demo.name'));
  assignDemoMaterials();
  /* una sezione gia' pronta: il brief .md e' la parte che distingue il tool,
     ma richiede una selezione — cosi' e' esportabile al primo click. */
  P.sections=[{name:T('demo.section'),keys:meshes.map(o=>o.userData.key)}];
  refreshUI(); buildEditor(); buildTree(); buildSecList(); updateApplyBtn();
  toast(T('msg.demoLoaded'));
}

E('bSaveLocal').onclick=async()=>{
  const n=prompt(T('prompt.projName'),P.modelName||T('file.project')); if(!n)return;
  const db=await DB(); db.transaction('projects','readwrite').objectStore('projects').put(snapshot(),n);
  toast(T('msg.savedAs',{name:n}));
};
E('bLoadLocal').onclick=async()=>{
  const db=await DB(), st=db.transaction('projects').objectStore('projects');
  st.getAllKeys().onsuccess=e=>{
    const ks=e.target.result; if(!ks.length) return toast(T('msg.noSaved'));
    const n=prompt(T('prompt.open')+'\n'+ks.join('\n'),ks[ks.length-1]); if(!n)return;
    db.transaction('projects').objectStore('projects').get(n).onsuccess=ev=>
      ev.target.result?loadProject(ev.target.result):toast(T('msg.notFound'));
  };
};

/* ================= SEZIONI ESPORTABILI PER CHAT AI ================= */
const seclist=E('seclist');
function secBBox(sec){
  const b=new THREE.Box3(); let n=0;
  meshes.forEach(o=>{ if(sec.keys.includes(o.userData.key)){ b.expandByObject(o); n++; } });
  return n?b:null;
}
function meshArea(o){
  const g=o.geometry,p=g.attributes.position,idx=g.index; if(!p) return 0;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
  const n=idx?idx.count:p.count; let tot=0;
  const step=n>60000?3*Math.ceil(n/60000):3;          // campionamento su mesh molto dense
  for(let i=0;i+2<n;i+=step){
    const i0=idx?idx.getX(i):i,i1=idx?idx.getX(i+1):i+1,i2=idx?idx.getX(i+2):i+2;
    a.fromBufferAttribute(p,i0).applyMatrix4(o.matrixWorld);
    b.fromBufferAttribute(p,i1).applyMatrix4(o.matrixWorld);
    c.fromBufferAttribute(p,i2).applyMatrix4(o.matrixWorld);
    tot+=.5*ab.subVectors(b,a).cross(ac.subVectors(c,a)).length();
  }
  return tot*(step/3);
}
function secStats(sec){
  const box=secBBox(sec); if(!box) return null;
  const sz=box.getSize(new THREE.Vector3()), mats={};
  let props=0;
  meshes.forEach(o=>{
    if(!sec.keys.includes(o.userData.key)) return; props++;
    const id=P.assign[o.userData.key], nm=id&&P.materials[id]?P.materials[id].name:T('brief.unassigned');
    mats[nm]=(mats[nm]||0)+meshArea(o);
  });
  const tot=Object.values(mats).reduce((a,b)=>a+b,0)||1;
  return {box,sz,props,
    mats:Object.entries(mats).sort((a,b)=>b[1]-a[1]).map(([n,a])=>({n,a,pct:a/tot*100}))};
}
/* rende una vista e ritorna il canvas */
function renderView(box,dir,up,W,H,ortho,cutY){
  const c=box.getCenter(new THREE.Vector3()), sz=box.getSize(new THREE.Vector3());
  const r=Math.max(sz.x,sz.y,sz.z)*.5||1, d=r*4;
  let cam;
  if(ortho){
    const w=(dir.y!==0?sz.x:Math.abs(dir.z)>.5?sz.x:sz.z)*.62+r*.12;
    const h=(dir.y!==0?sz.z:sz.y)*.62+r*.12;
    const asp=W/H, ww=Math.max(w,h*asp), hh=ww/asp;
    cam=new THREE.OrthographicCamera(-ww,ww,hh,-hh,.01,d*4);
  } else cam=new THREE.PerspectiveCamera(38,W/H,r*.02,d*6);
  cam.up.copy(up); cam.position.copy(c).addScaledVector(dir,d); cam.lookAt(c); cam.updateProjectionMatrix();
  if(cutY!==undefined) renderer.clippingPlanes=[new THREE.Plane(new THREE.Vector3(0,-1,0),cutY)];
  const old={w:vp.clientWidth,h:vp.clientHeight,bg:scene.background};
  renderer.setSize(W,H,false); renderer.render(scene,cam);
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  cv.getContext('2d').drawImage(renderer.domElement,0,0,W,H);
  renderer.clippingPlanes=[]; renderer.setSize(old.w,old.h,false);
  return cv;
}
async function exportSection(sec){
  const st=secStats(sec);
  if(!st) return toast(T('msg.secEmptyModel'));
  const keep=new Map();
  meshes.forEach(o=>{ keep.set(o,o.visible); o.visible=sec.keys.includes(o.userData.key); });
  const hidden=[grid,northArrow,hlGroup,ground]; const hv=hidden.map(o=>o.visible); hidden.forEach(o=>o.visible=false);
  const bg=scene.background; scene.background=new THREE.Color(0xf2f4f7);
  const localClip=renderer.localClippingEnabled; renderer.localClippingEnabled=true;

  const c=st.box.getCenter(new THREE.Vector3());
  const cutY=st.box.min.y+Math.min(st.sz.y*.75,st.box.min.y+1.6<st.box.max.y?1.6:st.sz.y*.75);
  const V=[
    [T('views.plan'),  new THREE.Vector3(0,1,0),  new THREE.Vector3(0,0,-1), true,  cutY],
    [T('views.north'), new THREE.Vector3(0,0,-1), new THREE.Vector3(0,1,0),  true,  undefined],
    [T('views.south'), new THREE.Vector3(0,0,1),  new THREE.Vector3(0,1,0),  true,  undefined],
    [T('views.east'),  new THREE.Vector3(1,0,0),  new THREE.Vector3(0,1,0),  true,  undefined],
    [T('views.west'),  new THREE.Vector3(-1,0,0), new THREE.Vector3(0,1,0),  true,  undefined],
    [T('views.persp'), new THREE.Vector3(.8,.55,.8).normalize(), new THREE.Vector3(0,1,0), false, undefined]
  ];
  const TW=880,TH=660,COLS=3,PAD=10,LBL=26;
  const sheet=document.createElement('canvas');
  sheet.width=COLS*TW+PAD*(COLS+1); sheet.height=2*(TH+LBL)+PAD*3;
  const g=sheet.getContext('2d');
  g.fillStyle='#ffffff'; g.fillRect(0,0,sheet.width,sheet.height);
  V.forEach(([label,dir,up,ortho,cut],i)=>{
    const cv=renderView(st.box,dir,up,TW,TH,ortho,cut);
    const x=PAD+(i%COLS)*(TW+PAD), y=PAD+Math.floor(i/COLS)*(TH+LBL+PAD);
    g.drawImage(cv,x,y+LBL);
    g.fillStyle='#111'; g.font='600 19px system-ui,sans-serif';
    g.fillText(label,x+2,y+19);
    g.strokeStyle='#c9d1da'; g.strokeRect(x,y+LBL,TW,TH);
  });
  // scala grafica sulla pianta
  g.fillStyle='#111'; g.font='15px system-ui,sans-serif';
  g.fillText(T('sheet.footprint',{x:st.sz.x.toFixed(2),z:st.sz.z.toFixed(2),y:st.sz.y.toFixed(2)}),PAD+2,sheet.height-8);

  meshes.forEach(o=>o.visible=keep.get(o));
  hidden.forEach((o,i)=>o.visible=hv[i]);
  scene.background=bg; renderer.localClippingEnabled=localClip;

  const base=secBase(sec), png=base+T('file.viewsSuffix'), md=base+T('file.briefSuffix');
  dl(sheet.toDataURL('image/png'),png);
  dl('data:text/markdown;charset=utf-8,'+encodeURIComponent(brief(sec,st)),md);
  toast(T('msg.exported',{views:png,brief:md}));
}
function secBase(sec){ return (sec.name||T('file.section')).replace(/[^\w\-]+/g,'_'); }
function brief(sec,st){
  const N=(ENV.north*180/Math.PI).toFixed(0);
  const hh=Math.floor(ENV.hour), mm=Math.round((ENV.hour-hh)*60);
  const hourTxt=String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');
  const L=[];
  L.push(T('brief.title',{name:sec.name}),'');
  L.push(T('brief.intro',{model:P.modelName||T('brief.noName'),file:secBase(sec)+T('file.viewsSuffix')}),'');
  L.push(T('brief.dimsH'),'',
    `| ${T('brief.thQty')} | ${T('brief.thVal')} |`,'|---|---|',
    `| ${T('brief.width')} | ${st.sz.x.toFixed(2)} m |`,
    `| ${T('brief.depth')} | ${st.sz.z.toFixed(2)} m |`,
    `| ${T('brief.height')} | ${st.sz.y.toFixed(2)} m |`,
    `| ${T('brief.floorArea')} | ${(st.sz.x*st.sz.z).toFixed(2)} m\u00b2 |`,
    `| ${T('brief.volume')} | ${(st.sz.x*st.sz.y*st.sz.z).toFixed(2)} m\u00b3 |`,
    `| ${T('brief.elements')} | ${st.props} |`,'');
  L.push(T('brief.matsH'),'',T('brief.matsNote',{n:N}),'',
    `| ${T('brief.thMat')} | ${T('brief.thArea')} | ${T('brief.thShare')} |`,'|---|---|---|');
  st.mats.forEach(m=>L.push(`| ${m.n} | ${m.a.toFixed(1)} m\u00b2 | ${m.pct.toFixed(0)}% |`));
  L.push('',T('brief.ctxH'),'',
    T('brief.loc',{lat:ENV.lat,lon:ENV.lon}),
    T('brief.solar',{d:String(ENV.day).padStart(2,'0'),m:String(ENV.month).padStart(2,'0'),h:hourTxt}),
    T('brief.northRot',{n:N}),'');
  L.push(T('brief.reqH'),'',T('brief.req'));
  return L.join('\n');
}
function dl(href,name){ const a=document.createElement('a'); a.href=href; a.download=name; a.click(); }

async function exportSectionGLB(sec){
  const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');
  const g=new THREE.Group();
  meshes.forEach(o=>{ if(sec.keys.includes(o.userData.key)){ const m=o.clone(); m.matrixAutoUpdate=false; m.matrix.copy(o.matrixWorld); g.add(m); } });
  if(!g.children.length) return toast(T('msg.secEmpty'));
  new GLTFExporter().parse(g,r=>{
    dl(URL.createObjectURL(new Blob([r],{type:'model/gltf-binary'})),secBase(sec)+'.glb');
    toast(T('msg.glbExported'));
  },e=>toast(T('msg.glbFailed')),{binary:true});
}
function buildSecList(){
  seclist.innerHTML='';
  E('seccnt').textContent=P.sections.length||'';
  if(!P.sections.length){ seclist.innerHTML=`<div class="hint">${T('sec.hint')}</div>`; return; }
  P.sections.forEach((sec,i)=>{
    const el=document.createElement('div'); el.className='item';
    el.innerHTML=`<span>${sec.name}</span><span class="tag">${sec.keys.length}</span>`;
    el.onclick=()=>{ sel=new Set(meshes.filter(o=>sec.keys.includes(o.userData.key))); syncSel(); frameSel(); };
    const row=document.createElement('div'); row.className='row'; row.style.margin='2px 0 8px';
    const mk=(t,fn,ti)=>{ const b=document.createElement('button'); b.textContent=t; b.title=ti||''; b.style.cssText='flex:1;font-size:11px;padding:3px 4px'; b.onclick=fn; return b; };
    row.append(
      mk(T('sec.viewsBrief'),()=>exportSection(sec),T('sec.viewsBrief.t')),
      mk(T('sec.glb'),()=>exportSectionGLB(sec)),
      /* niente confirm() bloccante: si cancella subito e si offre Annulla nel toast */
      mk('✕',()=>{ pushUndo(T('undo.delSection'));
        P.sections.splice(i,1); buildSecList(); touch();
        toast(T('msg.secDeleted',{name:sec.name}),doUndo); })
    );
    seclist.append(el,row);
  });
}
E('bSecNew').onclick=()=>{
  if(!sel.size) return toast(T('msg.selectPropsFirst'));
  const n=prompt(T('prompt.secName'),T('file.room')+' '+(P.sections.length+1)); if(!n) return;
  P.sections.push({name:n,keys:[...sel].map(o=>o.userData.key)});
  buildSecList(); touch(); toast(T('msg.secCreated',{name:n,n:sel.size}));
};

/* ---------- undo / redo ---------- */
/* Registra solo lo stato *mutabile a colpi rapidi*: assegnazioni mesh->materiale,
   prop nascoste, sezioni. Non i materiali/texture: sono oggetti grossi (dataURL) e
   le loro modifiche passano dal flusso "applicazione differita", non da click ripetuti.
   Ogni voce e' un JSON piccolo (poche decine di KB anche con 1000 mesh). */
const UNDO_MAX=50;
let undoStack=[], redoStack=[], undoBusy=false;

function undoSnap(){
  return JSON.stringify({assign:P.assign,hidden:[...hidden],sections:P.sections});
}
/* Da chiamare PRIMA di mutare lo stato. label = testo mostrato nel toast di annullamento. */
function pushUndo(label){
  if(undoBusy) return;
  undoStack.push({snap:undoSnap(),label});
  if(undoStack.length>UNDO_MAX) undoStack.shift();
  redoStack.length=0;              // un'azione nuova invalida il ramo di redo
}
function applyUndoState(raw){
  const s=JSON.parse(raw);
  P.assign=s.assign; P.sections=s.sections;
  hidden=new Set(s.hidden); P.hidden=[...hidden];
  meshes.forEach(o=>o.visible=!hidden.has(o.userData.key));
  [...sel].forEach(o=>{ if(!o.visible) sel.delete(o); });
  applyAll(); highlight(); buildTree(); buildCurCard(); buildEditor();
  buildSecList(); updateApplyBtn(); touch();
}
function doUndo(){
  if(!undoStack.length) return toast(T('msg.nothingUndo'));
  undoBusy=true;
  const e=undoStack.pop();
  redoStack.push({snap:undoSnap(),label:e.label});
  applyUndoState(e.snap);
  undoBusy=false;
  toast(T('msg.undone',{what:e.label}));
}
function doRedo(){
  if(!redoStack.length) return toast(T('msg.nothingRedo'));
  undoBusy=true;
  const e=redoStack.pop();
  undoStack.push({snap:undoSnap(),label:e.label});
  applyUndoState(e.snap);
  undoBusy=false;
  toast(T('msg.redone',{what:e.label}));
}

/* ---------- util ---------- */
let tt;
function toast(m,undoFn){
  const t=document.getElementById('toast');
  t.textContent=m; t.classList.toggle('act',!!undoFn); t.classList.add('on');
  if(undoFn){
    const b=document.createElement('button');
    b.className='undo'; b.textContent=T('btn.undo');
    b.onclick=()=>{ t.classList.remove('on','act'); clearTimeout(tt); undoFn(); };
    t.appendChild(b);
  }
  clearTimeout(tt);
  tt=setTimeout(()=>t.classList.remove('on','act'),undoFn?5000:2200);   // piu' tempo se c'e' da decidere
}
const typing=e=>e.target.tagName==='INPUT'||e.target.tagName==='SELECT';
addEventListener('keydown',e=>{
  /* Undo/redo prima di ogni altro controllo: deve funzionare anche con un campo a fuoco
     o un overlay aperto. Ctrl+Z / Ctrl+Y, piu' Ctrl+Shift+Z (convenzione mac/Adobe). */
  if((e.ctrlKey||e.metaKey)&&!e.altKey){
    const k=e.key.toLowerCase();
    if(k==='z'&&!e.shiftKey){ e.preventDefault(); return doUndo(); }
    if(k==='y'||(k==='z'&&e.shiftKey)){ e.preventDefault(); return doRedo(); }
  }
  if(e.key==='Escape'){ if(E('mpicker').classList.contains('on')) return closeMatPicker();
    if(E('picker').classList.contains('on')) return closePicker(); sel.clear(); syncSel(); return; }
  if(typing(e)||E('picker').classList.contains('on')||E('mpicker').classList.contains('on')) return;
  const k=e.key.toLowerCase();
  if('wasdqe'.includes(k)){ keys.add(k); e.preventDefault(); return; }
  if(k==='h'&&sel.size) E('bHide').click();
  if(k==='i'&&sel.size) E('bIso').click();
  if(k==='u') E('bShowAll').click();
  if(k==='t') openPicker(null);
  if(k==='m'&&sel.size) openMatPicker();
  if(k==='f'&&sel.size) frameSel();
  if(e.key==='Enter') E('bAssign').click();
});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>keys.clear());
renderer.domElement.addEventListener('pointerdown',()=>renderer.domElement.focus());
buildCurCard();
E('navv').textContent=navBase.toFixed(1)+' m/s';
buildSecList();
E('lat').value=ENV.lat; E('lon').value=ENV.lon;
E('doyv').textContent=doyToDate(+E('doy').value).label;
E('northv').textContent='0°';
updateEnv();

/* ---------- selettore lingua ---------- */
/* ridisegna tutto cio' che contiene testo: markup statico + liste costruite a runtime */
function applyLang(){
  applyI18n();
  E('navv').textContent=navBase.toFixed(1)+' m/s';
  E('doyv').textContent=doyToDate(+E('doy').value).label;
  if(hudInfo) E('hud').textContent=T('hud',hudInfo);
  if(lastStat) stat(lastStat.k,lastStat.c,lastStat.p);
  buildTree(); buildCurCard(); buildEditor(); buildSecList(); updateApplyBtn();
  if(E('mpicker').classList.contains('on')) buildMatList();
  if(E('picker').classList.contains('on')) buildPicker();
}
const langSel=E('lang');
for(const code in LANGS){
  const o=document.createElement('option'); o.value=code; o.textContent=LANGS[code]; langSel.appendChild(o);
}
langSel.value=lang;
langSel.onchange=e=>{ if(setLang(e.target.value)) applyLang(); };
applyLang();

/* ---------- ripresa automatica all'avvio ---------- */
/* Deve stare in fondo al file: e' l'unico percorso che chiama install() DURANTE la
   valutazione dello script (i caricamenti da drag & drop avvengono dopo, a script gia'
   valutato). Piu' in alto, install() -> baseOf (const arrow, definito sotto) finirebbe
   in temporal dead zone: il ReferenceError verrebbe inghiottito dal catch qui sotto e
   la scena demo non comparirebbe, senza alcun errore visibile. */
(async()=>{
  try{
    const h=await idbGet('__handle');
    if(h&&h.queryPermission){
      const p=await h.queryPermission({mode:'readwrite'});
      if(p==='granted') fileHandle=h;
      else if(p==='prompt') stat('stat.fileLinked','var(--warn)');
    }
    const a=await idbGet('__autosave');
    if(a&&(Object.keys(a.materials||{}).length||a.sections?.length)){
      loadProject(a); stat('stat.resumed','var(--accent)');
    } else {
      stat(location.protocol==='file:'?'stat.warnFile':'stat.ready');
      loadDemoScene();          // nessun lavoro salvato: parte la demo, non una scena vuota
    }
    ready=true;
  }catch(e){
    idbOK=false;
    stat('stat.noMemory','var(--warn)');
    loadDemoScene();            // IndexedDB non disponibile: niente da ripristinare comunque
    ready=true;
    if(location.protocol==='file:') setTimeout(()=>toast(T('msg.fileProtocol')),1500);
  }
})();
