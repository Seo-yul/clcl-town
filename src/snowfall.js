import * as THREE from 'three';

// Falling snow: square points (they read as voxels) inside a box that follows the
// camera's focus. Flakes that fall out of the box or drift past its sides wrap around,
// so a fixed number of flakes covers the view wherever the player walks.

const SIZE = 72; // box width and depth
const HEIGHT = 34; // flakes fall from here to the ground

export class Snowfall {
  constructor(scene, count) {
    this.max = count;
    this.pos = new Float32Array(count * 3);
    this.speed = new Float32Array(count);
    this.phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.pos[i * 3] = (Math.random() - 0.5) * SIZE;
      this.pos[i * 3 + 1] = Math.random() * HEIGHT;
      this.pos[i * 3 + 2] = (Math.random() - 0.5) * SIZE;
      this.speed[i] = 1.3 + Math.random() * 1.2;
      this.phase[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.pos, 3);
    this.attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.attr);
    const material = new THREE.PointsMaterial({ color: '#ffffff', size: 0.2, transparent: true, opacity: 0.92, depthWrite: false });
    // Flakes passing right in front of the camera would grow into big squares; cap their size.
    const maxSize = 7 * Math.min(window.devicePixelRatio || 1, 2);
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <fog_vertex>',
        `#include <fog_vertex>\n\tgl_PointSize = min(gl_PointSize, ${maxSize.toFixed(1)});`,
      );
    };
    // The box moves with the player, so skip frustum culling instead of tracking bounds.
    this.points = new THREE.Points(geo, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    scene.add(this.points);
  }

  /** Lite mode shows fewer flakes. */
  setCount(n) {
    this.count = Math.min(this.max, n);
    this.points.geometry.setDrawRange(0, this.count);
  }

  update(dt, t, center) {
    const n = this.count ?? this.max;
    const p = this.pos;
    const half = SIZE / 2;
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      const sway = Math.sin(t * 0.9 + this.phase[i]);
      p[k] += (0.35 + sway * 0.45) * dt;
      p[k + 1] -= this.speed[i] * dt;
      p[k + 2] += Math.cos(t * 0.7 + this.phase[i]) * 0.3 * dt;
      if (p[k + 1] < 0) p[k + 1] += HEIGHT;
      const dx = p[k] - center.x;
      if (dx > half) p[k] -= SIZE;
      else if (dx < -half) p[k] += SIZE;
      const dz = p[k + 2] - center.z;
      if (dz > half) p[k + 2] -= SIZE;
      else if (dz < -half) p[k + 2] += SIZE;
    }
    this.attr.needsUpdate = true;
  }
}
