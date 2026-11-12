// Post-processing: HDR bloom, crepuscular rays, filmic tone-map, colour
// grade, vignette and grain — the "cinematic western" look.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { G, QUALITY } from './state.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSun: { value: new THREE.Vector2(0.5, 0.5) },
    uGod: { value: 0 },
    uGodCol: { value: new THREE.Color(1, 0.9, 0.7) },
    uTime: { value: 0 },
    uExposure: { value: 1 },
    uSat: { value: 1.06 },
    uWarm: { value: 0 },
    uNight: { value: 0 },
    uVig: { value: 0.9 },
    uHurt: { value: 0 },
    uAspect: { value: 1.7 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 uSun; uniform vec3 uGodCol;
    uniform float uGod, uTime, uExposure, uSat, uWarm, uNight, uVig, uHurt, uAspect;
    varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      if (uGod > 0.003) {
        vec2 d = (uSun - vUv);
        float jitter = hash(vUv * 731.0 + uTime) ;
        vec2 stp = d / 22.0 * 0.92;
        vec2 p = vUv + stp * jitter;
        float illum = 1.0, acc = 0.0;
        for (int i = 0; i < 22; i++) {
          vec3 s = texture2D(tDiffuse, clamp(p, 0.0, 1.0)).rgb;
          float l = max(max(s.r, s.g), s.b);
          acc += smoothstep(1.1, 3.2, l) * illum;
          illum *= 0.94; p += stp;
        }
        float fall = 1.0 - smoothstep(0.0, 1.1, length(d * vec2(uAspect, 1.0)));
        c += uGodCol * acc / 22.0 * uGod * 1.5 * fall;
      }
      c *= uExposure;
      c = aces(c);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSat);
      // split-tone: cool shadows, warm highlights
      vec3 shadowTint = mix(vec3(1.0, 0.98, 1.02), vec3(0.86, 0.96, 1.16), uNight);
      vec3 hiTint = mix(vec3(1.04, 1.0, 0.94), vec3(1.08, 1.0, 0.88), uWarm);
      c *= mix(shadowTint, hiTint, smoothstep(0.05, 0.65, l));
      c = pow(c, vec3(1.0 / 2.2));
      // the era's look: a warm colour filter over everything, blacks lifted into haze
      vec3 filt = mix(vec3(1.0, 0.97, 0.9), vec3(1.0, 0.92, 0.78), uWarm);
      c = mix(c, c * filt + vec3(0.046, 0.038, 0.026), 0.75 * (1.0 - uNight * 0.75));
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.10);
      vec2 q = vUv - 0.5;
      float vig = smoothstep(0.85, 0.2, length(q * vec2(1.0, 0.85)) );
      c *= mix(1.0, vig, uVig * 0.35);
      c = mix(c, vec3(0.5, 0.03, 0.02), uHurt * smoothstep(0.25, 0.75, length(q)) * 0.75);
      c += (hash(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 100.0) - 0.5) * 0.034;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export class Post {
  constructor(renderer, scene, camera) {
    const q = QUALITY[G.quality];
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: q.msaa });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    if (q.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.36, 0.95, 0.9);
      this.composer.addPass(this.bloom);
    }
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.u = this.grade.uniforms;
  }
  setSize(w, h) { this.composer.setSize(w, h); this.u.uAspect.value = w / h; }
  render(dt) { this.composer.render(dt); }
}
