// ============================================================
//  NEURAL FIELD — morphing particle universe (three.js)
//  6 states driven by scroll: sphere / knot / galaxy / field /
//  helix / vortex. GPU-shader morphs + pointer repulsion.
// ============================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const IS_TOUCH  = matchMedia('(pointer:coarse)').matches;
const REDUCED   = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COUNT     = IS_TOUCH ? 16000 : 55000;
const USE_BLOOM = !IS_TOUCH && !REDUCED;

// ---------- morph targets ------------------------------------
function fibSphere(n, r, jitter) {
  const a = new Float32Array(n * 3), ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, rad = Math.sqrt(1 - y * y), t = ga * i;
    const jr = r * (1 - jitter * Math.random() * Math.random());
    a[i*3]   = Math.cos(t) * rad * jr;
    a[i*3+1] = y * jr;
    a[i*3+2] = Math.sin(t) * rad * jr;
  }
  return a;
}
function torusKnot(n, R, r, p, q) {
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2 * p + Math.random() * 0.12;
    const rr = R * (2 + Math.cos(q * t)) / 3;
    const tube = r * Math.cbrt(Math.random());
    const phi = Math.random() * Math.PI * 2;
    a[i*3]   = rr * Math.cos(t) + Math.cos(phi) * tube;
    a[i*3+1] = R * Math.sin(q * t) / 3 + Math.sin(phi) * tube;
    a[i*3+2] = rr * Math.sin(t) + Math.cos(phi + 1.3) * tube;
  }
  return a;
}
function galaxy(n, R, arms) {
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const rr = Math.pow(Math.random(), 0.62) * R;
    const arm = (i % arms) / arms * Math.PI * 2;
    const spin = rr * 0.32;
    const spread = (1 - rr / R) * 1.6 + 0.22;
    const ang = arm + spin + (Math.random() - 0.5) * spread;
    a[i*3]   = Math.cos(ang) * rr + (Math.random() - 0.5) * 0.7;
    a[i*3+1] = (Math.random() - 0.5) * (1.9 * (1 - rr / R) + 0.25);
    a[i*3+2] = Math.sin(ang) * rr + (Math.random() - 0.5) * 0.7;
  }
  return a;
}
function fieldPlane(n, W, H) {
  // tilted neural field — baked rotX(-1.02)
  const a = new Float32Array(n * 3), c = Math.cos(-1.02), s = Math.sin(-1.02);
  for (let i = 0; i < n; i++) {
    const gx = (Math.random() - 0.5) * W;
    const gz = (Math.random() - 0.5) * H;
    const gy = Math.sin(gx * 0.55) * Math.cos(gz * 0.55) * 0.8 + (Math.random() - 0.5) * 0.35;
    a[i*3] = gx; a[i*3+1] = gy * c - gz * s - 4; a[i*3+2] = gy * s + gz * c;
  }
  return a;
}
function helix(n, R, H) {
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = i / n, kind = Math.random();
    const t = u * Math.PI * 8, y = (u - 0.5) * H;
    let x, z;
    if (kind < 0.42)      { x = Math.cos(t) * R;            z = Math.sin(t) * R; }
    else if (kind < 0.84) { x = Math.cos(t + Math.PI) * R;  z = Math.sin(t + Math.PI) * R; }
    else { const r = Math.random() * R; x = Math.cos(t) * r; z = Math.sin(t) * r; } // rungs
    a[i*3] = x + (Math.random()-0.5)*0.28;
    a[i*3+1] = y + (Math.random()-0.5)*0.28;
    a[i*3+2] = z + (Math.random()-0.5)*0.28;
  }
  return a;
}
function vortex(n, R) {
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random();
    const ang = u * Math.PI * 14 + Math.random() * 0.6;
    const rr = (0.18 + u * u * 0.9) * R + (Math.random() - 0.5) * 1.4;
    a[i*3]   = Math.cos(ang) * rr;
    a[i*3+1] = (u - 0.5) * 22 + (Math.random() - 0.5) * 1.2;
    a[i*3+2] = Math.sin(ang) * rr;
  }
  return a;
}

// ---------- shaders ------------------------------------------
const VERT = /* glsl */`
  attribute vec3 aPos1; attribute vec3 aPos2; attribute vec3 aPos3;
  attribute vec3 aPos4; attribute vec3 aPos5;
  attribute float aRand; attribute float aMix; attribute float aSize;
  uniform float uTime, uMorph, uPx, uRepel, uDrift;
  uniform vec3 uPtr;
  uniform vec3 uColA, uColB, uColC;
  varying vec3 vC; varying float vA;

  vec3 pick(int i){
    if(i==0) return position;
    if(i==1) return aPos1;
    if(i==2) return aPos2;
    if(i==3) return aPos3;
    if(i==4) return aPos4;
    return aPos5;
  }

  void main(){
    float fr = fract(uMorph);
    int from = int(floor(uMorph));
    int to = min(from + 1, 5);
    float t = clamp(fr * 1.8 - aRand * 0.8, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);

    vec3 pos = mix(pick(from), pick(to), t);

    // organic drift
    float n1 = sin(pos.x * 0.55 + uTime * 0.65 + aRand * 6.28);
    float n2 = sin(pos.y * 0.62 + uTime * 0.85 + aRand * 4.10);
    float n3 = sin(pos.z * 0.50 + uTime * 0.55 + aRand * 5.30);
    pos += vec3(n1, n2, n3) * uDrift;

    // slow swirl around Y
    float sw = uTime * 0.045 + pos.y * 0.012;
    float cs = cos(sw), sn = sin(sw);
    pos.xz = mat2(cs, -sn, sn, cs) * pos.xz;

    // pointer repulsion
    vec3 d = pos - uPtr;
    float l = length(d);
    pos += normalize(d + 0.0001) * (1.0 - smoothstep(0.0, 7.0, l)) * uRepel;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPx * (30.0 / -mv.z);
    gl_PointSize = min(gl_PointSize, 26.0 * uPx);

    float m = aMix;
    vC = m < 0.5 ? mix(uColA, uColB, m * 2.0) : mix(uColB, uColC, m * 2.0 - 1.0);
    vA = 0.55 + 0.45 * sin(uTime * 2.1 + aRand * 40.0);
  }
`;
const FRAG = /* glsl */`
  varying vec3 vC; varying float vA;
  void main(){
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = (1.0 - smoothstep(0.04, 0.5, d));
    gl_FragColor = vec4(vC, a * vA);
  }
`;
const STAR_VERT = /* glsl */`
  attribute float aSize;
  uniform float uTime, uPx;
  varying float vA;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPx * (30.0 / -mv.z);
    vA = 0.25 + 0.55 * (0.5 + 0.5 * sin(uTime * 0.8 + position.x * 13.7));
  }
`;
const STAR_FRAG = /* glsl */`
  varying float vA;
  void main(){
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(0.75, 0.78, 0.9, (1.0 - smoothstep(0.1, 0.5, d)) * vA);
  }
`;

export function initGL(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { canvas.remove(); return { morphTo(){} }; }

  let dpr = Math.min(devicePixelRatio || 1, IS_TOUCH ? 1.5 : 1.8);
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 200);
  camera.position.set(0, 0, 34);

  const group = new THREE.Group();
  scene.add(group);
  const placeGroup = () => {
    const mobile = innerWidth <= 760;
    const distance = camera.position.z;
    group.position.set(mobile ? 0 : distance * camera.aspect * .19, mobile ? -distance * .17 : 0, 0);
    group.scale.setScalar(mobile ? .48 : .72);
  };
  placeGroup();

  // ----- particle cloud
  const geo = new THREE.BufferGeometry();
  const targets = [
    fibSphere(COUNT, 11.5, 0.07),
    torusKnot(COUNT, 12.5, 1.1, 2, 3),
    galaxy(COUNT, 17, 3),
    fieldPlane(COUNT, 34, 22),
    helix(COUNT, 4.6, 24),
    vortex(COUNT, 16),
  ];
  const rnd = new Float32Array(COUNT), mix = new Float32Array(COUNT), siz = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    rnd[i] = Math.random();
    mix[i] = Math.random();
    siz[i] = 0.35 + Math.pow(Math.random(), 2.2) * 1.5;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(targets[0], 3));
  geo.setAttribute('aPos1', new THREE.BufferAttribute(targets[1], 3));
  geo.setAttribute('aPos2', new THREE.BufferAttribute(targets[2], 3));
  geo.setAttribute('aPos3', new THREE.BufferAttribute(targets[3], 3));
  geo.setAttribute('aPos4', new THREE.BufferAttribute(targets[4], 3));
  geo.setAttribute('aPos5', new THREE.BufferAttribute(targets[5], 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
  geo.setAttribute('aMix', new THREE.BufferAttribute(mix, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));

  const uni = {
    uTime:  { value: 0 },
    uMorph: { value: 0 },
    uPx:    { value: dpr },
    uRepel: { value: 0 },
    uDrift: { value: REDUCED ? 0.06 : 0.42 },
    uPtr:   { value: new THREE.Vector3(999, 999, 0) },
    uColA:  { value: new THREE.Color('#d5ef8b') },
    uColB:  { value: new THREE.Color('#729580') },
    uColC:  { value: new THREE.Color('#e5e9d0') },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms: uni,
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  group.add(points);

  // ----- faint starfield
  const S = IS_TOUCH ? 500 : 1400;
  const sPos = new Float32Array(S * 3), sSize = new Float32Array(S);
  for (let i = 0; i < S; i++) {
    const r = 45 + Math.random() * 30, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    sPos[i*3] = r * Math.sin(ph) * Math.cos(th);
    sPos[i*3+1] = r * Math.sin(ph) * Math.sin(th);
    sPos[i*3+2] = r * Math.cos(ph) - 10;
    sSize[i] = 0.4 + Math.random() * 1.3;
  }
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('aSize', new THREE.BufferAttribute(sSize, 1));
  const sUni = { uTime: { value: 0 }, uPx: { value: dpr } };
  const stars = new THREE.Points(sGeo, new THREE.ShaderMaterial({
    vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, uniforms: sUni,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  }));
  stars.frustumCulled = false;
  scene.add(stars);

  // ----- post
  let composer = null, bloom = null;
  if (USE_BLOOM) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.6, 0.0);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  // ----- pointer
  const ndc = new THREE.Vector2(10, 10);
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  let ptrSeen = false, repelTarget = 0;
  addEventListener('pointermove', (e) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ptrSeen = true; repelTarget = 3.2;
  }, { passive: true });

  // ----- per-state camera distance
  const camZ = [34, 32, 37, 30, 31, 34];
  const api = {
    morphTo(i) {
      i = Math.max(0, Math.min(5, i));
      if (window.gsap && !REDUCED) {
        gsap.to(uni.uMorph, { value: i, duration: 2.2, ease: 'power3.inOut', overwrite: true });
        gsap.to(camera.position, { z: camZ[i], duration: 2.2, ease: 'power3.inOut', overwrite: true });
      } else { uni.uMorph.value = i; camera.position.z = camZ[i]; }
    },
    setVisible(v) { visible = v; },
  };

  // ----- loop with adaptive perf
  const clock = new THREE.Clock();
  let visible = true, running = true, frames = 0, tAcc = 0, level = 0;
  const tilt = { x: 0, y: 0 };

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!visible || document.hidden) { clock.getDelta(); return; }

    const dt = Math.min(clock.getDelta(), 0.05);
    const t = (uni.uTime.value += REDUCED ? 0 : dt);
    placeGroup();
    sUni.uTime.value = t;

    // adaptive quality
    tAcc += dt; frames++;
    if (tAcc > 2) {
      const avg = tAcc / frames; tAcc = 0; frames = 0;
      if (avg > 0.024 && level === 0) { level = 1; dpr = Math.min(dpr, 1.35); renderer.setPixelRatio(dpr); composer && composer.setPixelRatio(dpr); uni.uPx.value = dpr; sUni.uPx.value = dpr; onResize(); }
      else if (avg > 0.03 && level === 1 && bloom) { level = 2; bloom.enabled = false; }
    }

    // pointer → world repulsion + camera tilt
    repelTarget *= 0.92;
    uni.uRepel.value += ((ptrSeen ? 3.2 : 0) + repelTarget * 0.2 - uni.uRepel.value) * 0.07;
    if (ptrSeen && !REDUCED) {
      ray.setFromCamera(ndc, camera);
      group.updateMatrixWorld();
      if (ray.ray.intersectPlane(plane, hit)) uni.uPtr.value.lerp(group.worldToLocal(hit), 0.25);
      tilt.x += (ndc.y * 0.14 - tilt.x) * 0.04;
      tilt.y += (ndc.x * 0.2  - tilt.y) * 0.04;
      group.rotation.x = tilt.x;
      group.rotation.y = tilt.y;
    }
    stars.rotation.y = t * 0.008;

    composer ? composer.render() : renderer.render(scene, camera);
  }
  frame();

  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer && composer.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', () => { clock.getDelta(); });

  return api;
}
