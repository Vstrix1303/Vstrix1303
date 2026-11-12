// Backwater surface: planar reflections, depth-tinted shallows, shore foam,
// sun glitter and rain ripples.
import * as THREE from 'three';
import { G, QUALITY } from './state.js';
import { TEX } from './textures.js';
import { heightTex, GLSL_HUV } from './terrain.js';
import { heights, N, CELL, HALF } from './heightfield.js';

const VERT = /* glsl */`
uniform mat4 uTexMat;
varying vec3 vW; varying vec4 vMirror;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vMirror = uTexMat * w;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */`
uniform sampler2D uMirror, uNormal, uHeight, uNoise;
uniform vec3 uCam, uSunDir, uSunCol, uAmb, uZenith, uHorizon, uFogCol;
uniform float uFogDen, uTime, uRain, uRefl;
varying vec3 vW; varying vec4 vMirror;
${GLSL_HUV}
vec3 SRGB(float r, float g, float b) { return pow(vec3(r, g, b), vec3(2.2)); }
void main(){
  vec2 p = vW.xz;
  float dist = length(uCam - vW);
  vec2 t = vec2(uTime * 0.021, uTime * 0.013);
  vec3 n1 = texture2D(uNormal, p * 0.043 + t).xyz * 2.0 - 1.0;
  vec3 n2 = texture2D(uNormal, p * 0.117 - t * 1.7 + 0.3).xyz * 2.0 - 1.0;
  vec3 n3 = texture2D(uNormal, p * 0.43 + t * 3.1).xyz * 2.0 - 1.0;
  vec3 n4 = texture2D(uNormal, p * 1.9 + vec2(uTime * 0.9, -uTime * 0.7)).xyz * 2.0 - 1.0;
  vec2 nn = n1.xy + n2.xy * 0.7 + n3.xy * 0.35 + n4.xy * uRain * 1.3;
  float chop = mix(0.3, 0.62, uRain);
  chop *= 1.0 - smoothstep(120.0, 900.0, dist) * 0.75;
  vec3 N = normalize(vec3(nn.x * chop, 1.0, nn.y * chop));
  vec3 V = normalize(uCam - vW);
  float ndv = max(dot(N, V), 0.0);
  float F = 0.025 + 0.975 * pow(1.0 - ndv, 5.0);

  vec2 hu = p / 1600.0 + 0.5;
  float inside = step(0.0, hu.x) * step(hu.x, 1.0) * step(0.0, hu.y) * step(hu.y, 1.0);
  float h = texture2D(uHeight, huv(p)).r;
  float depth = mix(9.0, max(-h, 0.0), inside);

  vec3 lightK = uAmb * 1.6 + uSunCol * 0.55 * max(uSunDir.y, 0.0);
  vec3 body = mix(SRGB(0.33, 0.43, 0.30), SRGB(0.06, 0.17, 0.17), smoothstep(0.0, 3.5, depth)) * lightK;

  vec3 refl;
  vec3 R = reflect(-V, N);
  vec3 skyR = mix(uHorizon, uZenith, pow(max(R.y, 0.0), 0.45));
  if (uRefl > 0.5) {
    vec2 ruv = vMirror.xy / vMirror.w + N.xz * 0.04;
    refl = texture2D(uMirror, clamp(ruv, 0.001, 0.999)).rgb;
  } else refl = skyR;
  vec3 col = mix(body, refl, F);

  vec3 Rs = reflect(-uSunDir, N);
  float spec = pow(max(dot(Rs, V), 0.0), 220.0);
  col += uSunCol * spec * 9.0 * (1.0 - uRain * 0.8);

  float wob = texture2D(uNoise, p * 0.21 + t * 2.0).r + 0.18 * sin(uTime * 1.2 + p.x * 0.5 + p.y * 0.3);
  float foam = smoothstep(0.42, 0.04, depth) * smoothstep(0.42, 0.7, wob);
  col = mix(col, vec3(0.92) * (uAmb * 2.2 + uSunCol * 0.6), foam * 0.7);

  float alpha = mix(0.5, 0.97, smoothstep(0.0, 2.4, depth)) * smoothstep(0.0, 0.1, depth);
  alpha = max(alpha, F * smoothstep(0.0, 0.1, depth));
  alpha = max(alpha, foam * 0.7);

  float fogF = 1.0 - exp(-uFogDen * uFogDen * dist * dist);
  col = mix(col, uFogCol, fogF);
  gl_FragColor = vec4(col, alpha);
}`;

export class Water {
  constructor(scene, env) {
    const q = QUALITY[G.quality];
    this.enabled = q.reflection > 0;
    this.scene = scene;
    this.rt = this.enabled ? new THREE.WebGLRenderTarget(q.reflection, q.reflection, { type: THREE.HalfFloatType }) : null;
    this.mirrorCam = new THREE.PerspectiveCamera();
    this.mirrorCam.layers.set(0);
    this.mirrorCam.layers.enable(2);
    this.texMat = new THREE.Matrix4();
    this.u = {
      uMirror: { value: this.rt ? this.rt.texture : null },
      uNormal: { value: TEX.waterNormal }, uHeight: { value: heightTex }, uNoise: { value: TEX.noise },
      uTexMat: { value: this.texMat },
      uCam: env.u.uCam, uSunDir: env.u.uSunDir, uSunCol: env.u.uSunCol, uAmb: env.u.uAmb,
      uZenith: env.u.uZenith, uHorizon: env.u.uHorizon, uFogCol: env.u.uFogCol, uFogDen: env.u.uFogDen,
      uTime: env.u.uTime, uRain: env.u.uRain, uRefl: { value: this.enabled ? 1 : 0 },
    };
    const geo = new THREE.PlaneGeometry(9000, 9000, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: false }));
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this._v = new THREE.Vector3(); this._t = new THREE.Vector3(); this._up = new THREE.Vector3();
    this._plane = new THREE.Plane(); this._clip = new THREE.Vector4(); this._q = new THREE.Vector4();
    // coarse list of water cells, used to skip the mirror pass when no water is on screen
    this.cells = [];
    const st = 8;
    for (let iz = 0; iz + st < N; iz += st) for (let ix = 0; ix + st < N; ix += st) {
      let wet = false;
      for (let a = 0; a <= st && !wet; a += 2) for (let b = 0; b <= st; b += 2) if (heights[(iz + a) * N + ix + b] < -0.15) { wet = true; break; }
      if (wet) this.cells.push(new THREE.Sphere(new THREE.Vector3(-HALF + (ix + st / 2) * CELL, 0, -HALF + (iz + st / 2) * CELL), st * CELL * 0.75));
    }
    this._fr = new THREE.Frustum(); this._pm = new THREE.Matrix4();
  }

  waterInView(camera) {
    this._fr.setFromProjectionMatrix(this._pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const cp = camera.position;
    if (cp.x < -640) return true;
    for (let i = 0; i < this.cells.length; i++) {
      const s = this.cells[i];
      const dx = s.center.x - cp.x, dz = s.center.z - cp.z;
      if (dx * dx + dz * dz < 480 * 480 && this._fr.intersectsSphere(s)) return true;
    }
    return false;
  }

  renderReflection(renderer, camera) {
    if (!this.enabled) return false;
    if (!this.waterInView(camera)) { this.u.uRefl.value = 0; return false; }
    this.u.uRefl.value = 1;
    const cam = this.mirrorCam;
    const cp = this._v.setFromMatrixPosition(camera.matrixWorld);
    if (cp.y < 0.05) { this.u.uRefl.value = 0; return false; }
    const dir = camera.getWorldDirection(this._t);
    const up = this._up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    cam.position.set(cp.x, -cp.y, cp.z);
    cam.up.set(up.x, -up.y, up.z);
    cam.lookAt(cp.x + dir.x, -(cp.y + dir.y), cp.z + dir.z);
    cam.far = camera.far; cam.near = camera.near; cam.fov = camera.fov; cam.aspect = camera.aspect;
    cam.updateMatrixWorld();
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    cam.projectionMatrix.copy(camera.projectionMatrix);
    this.texMat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.texMat.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);

    // oblique near plane so nothing below the surface is reflected
    const plane = this._plane.set(new THREE.Vector3(0, 1, 0), 0.02).applyMatrix4(cam.matrixWorldInverse);
    const clip = this._clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = cam.projectionMatrix, q = this._q;
    q.x = (Math.sign(clip.x) + pm.elements[8]) / pm.elements[0];
    q.y = (Math.sign(clip.y) + pm.elements[9]) / pm.elements[5];
    q.z = -1.0;
    q.w = (1.0 + pm.elements[10]) / pm.elements[14];
    clip.multiplyScalar(2.0 / clip.dot(q));
    pm.elements[2] = clip.x; pm.elements[6] = clip.y; pm.elements[10] = clip.z + 1.0; pm.elements[14] = clip.w;
    cam.projectionMatrixInverse.copy(pm).invert();

    this.mesh.visible = false;
    const cull = G.reflCull || [];
    for (let i = 0; i < cull.length; i++) {
      const m = cull[i], bs = m.boundingSphere;
      if (bs) m.visible = Math.hypot(bs.center.x - cp.x, bs.center.z - cp.z) - bs.radius < 330;
    }
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(this.scene, cam);
    renderer.setRenderTarget(prev);
    this.mesh.visible = true;
    for (let i = 0; i < cull.length; i++) cull[i].visible = true;
    return true;
  }
}
