// Post: scene pass → GTAO (contact shadows) → bloom → tone map (AgX) →
// colour grade + vignette → FXAA.
import * as THREE from 'three/webgpu';
import { sample, pass, mrt, output, normalView, packNormalToRGB, unpackRGBToNormal, uniform, vec3, vec4, float, uv, mix, smoothstep, length, dot, clamp, renderOutput, Fn, pow } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { G, U } from '../state.js';

export class Post {
  constructor(renderer, scene, camera) {
    this.pipeline = new THREE.RenderPipeline(renderer);
    this.sat = uniform(1.1);
    this.warm = uniform(0.0);
    this.vig = uniform(0.32);
    this.exposure = uniform(1); // per-frame exposure lives here: changing renderer.toneMappingExposure rebuilds pipelines
    const sp = pass(scene, camera);
    let col = sp.getTextureNode('output');
    if (G.Q.ao) {
      try {
        sp.setMRT(mrt({ output, normal: packNormalToRGB(normalView) }));
        const nTex = sp.getTextureNode('normal');
        const nrm = sample((u) => unpackRGBToNormal(nTex.sample(u)));
        const aoPass = ao(sp.getTextureNode('depth'), nrm, camera);
        aoPass.resolutionScale = 0.5;
        aoPass.radius.value = 1.2;
        aoPass.distanceExponent.value = 1.6;
        aoPass.thickness.value = 1.2;
        this.aoPass = aoPass;
        col = col.mul(vec4(vec3(aoPass.getTextureNode().r.mul(0.85).add(0.15)), 1));
      } catch (e) { console.warn('GTAO disabled', e); }
    }
    let hdr = col;
    if (G.Q.bloom) {
      const b = bloom(col, 0.12, 0.5, 1.1);
      this.bloomPass = b;
      hdr = col.add(b);
    }
    hdr = hdr.mul(vec4(vec3(this.exposure), 1));
    const ldr = renderOutput(hdr);
    const sat = this.sat, warm = this.warm, vig = this.vig;
    const graded = Fn(() => {
      const c = ldr.rgb.toVar();
      const l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c.assign(mix(vec3(l), c, sat));
      // gentle filmic split-tone: warm highlights, teal-ish shadows
      c.assign(c.add(vec3(0.03, 0.012, -0.02).mul(smoothstep(0.4, 1.0, l)).mul(warm.add(0.6))));
      c.assign(c.mul(mix(vec3(1), vec3(1.06, 0.98, 0.86), warm.mul(0.35))));
      c.assign(c.add(vec3(-0.008, 0.004, 0.012).mul(smoothstep(0.4, 0.0, l))));
      const d = length(uv().sub(0.5).mul(vec3(1.3, 1, 1).xy));
      c.assign(c.mul(mix(float(1), float(1).sub(vig), smoothstep(0.35, 0.95, d))));
      return vec4(clamp(c, 0, 1), 1);
    })();
    this.pipeline.outputColorTransform = false;
    this.pipeline.outputNode = fxaa(graded);
  }

  render() { this.pipeline.render(); }
}
