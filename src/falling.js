import * as THREE from 'three';

// Falling snow or leaves: square points (they read as voxels) inside a box that follows
// the camera's focus. Pieces that fall out of the box or drift past its sides wrap around,
// so a fixed number of them covers the view wherever the player walks.

const SIZE = 72; // box width and depth

export const SNOWFALL = {
  count: 4000, liteCount: 1600, height: 34, size: 0.2, maxPx: 7, opacity: 0.92,
  colors: ['#ffffff'], speed: [1.3, 2.5], drift: 0.35, sway: 0.45,
};

// Leaves fall from about treetop height, slowly, and swing from side to side.
export const LEAFFALL = {
  count: 650, liteCount: 300, height: 9, size: 0.3, maxPx: 9, opacity: 1,
  colors: ['#d94a2b', '#ea7d2c', '#f1bd2e', '#c9562e', '#e39a32'], speed: [0.55, 1.0], drift: 0.6, sway: 1.1,
};

// Cherry petals drift down slowly in spring.
export const PETALFALL = {
  count: 450, liteCount: 200, height: 8, size: 0.22, maxPx: 7, opacity: 1,
  colors: ['#f6b3c6', '#fbd0dc', '#f09ab4', '#fde8ee'], speed: [0.4, 0.75], drift: 0.5, sway: 1.2,
};

export class Falling {
  constructor(scene, opt) {
    this.opt = opt;
    const count = opt.count;
    this.max = count;
    this.pos = new Float32Array(count * 3);
    this.speed = new Float32Array(count);
    this.phase = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      this.pos[i * 3] = (Math.random() - 0.5) * SIZE;
      this.pos[i * 3 + 1] = Math.random() * opt.height;
      this.pos[i * 3 + 2] = (Math.random() - 0.5) * SIZE;
      this.speed[i] = opt.speed[0] + Math.random() * (opt.speed[1] - opt.speed[0]);
      this.phase[i] = Math.random() * Math.PI * 2;
      c.set(opt.colors[i % opt.colors.length]);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.pos, 3);
    this.attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.attr);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const transparent = opt.opacity < 1;
    const material = new THREE.PointsMaterial({
      vertexColors: true, size: opt.size, transparent, opacity: opt.opacity, depthWrite: !transparent,
    });
    // Pieces passing right in front of the camera would grow into big squares; cap their size.
    const maxSize = opt.maxPx * Math.min(window.devicePixelRatio || 1, 2);
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

  /** Lite mode shows fewer pieces. */
  setLite(lite) {
    this.count = Math.min(this.max, lite ? this.opt.liteCount : this.opt.count);
    this.points.geometry.setDrawRange(0, this.count);
  }

  update(dt, t, center) {
    const n = this.count ?? this.max;
    const { height, drift, sway } = this.opt;
    const p = this.pos;
    const half = SIZE / 2;
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      const s = Math.sin(t * 0.9 + this.phase[i]);
      p[k] += (drift + s * sway) * dt;
      p[k + 1] -= this.speed[i] * dt;
      p[k + 2] += Math.cos(t * 0.7 + this.phase[i]) * sway * 0.66 * dt;
      if (p[k + 1] < 0) p[k + 1] += height;
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

// Summer fireflies: glowing points that hover low over the grass, only after dark.
// Additive blending makes a darker point more see-through, so each one twinkles by its color.
export class Fireflies {
  constructor(scene, count = 150) {
    this.count = count;
    this.level = 0;
    this.pos = new Float32Array(count * 3);
    this.base = new Float32Array(count);
    this.phase = new Float32Array(count);
    this.colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.pos[i * 3] = (Math.random() - 0.5) * SIZE;
      this.pos[i * 3 + 2] = (Math.random() - 0.5) * SIZE;
      this.base[i] = 0.5 + Math.random() * 2.2;
      this.phase[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.pos, 3);
    this.attr.setUsage(THREE.DynamicDrawUsage);
    this.colorAttr = new THREE.BufferAttribute(this.colors, 3);
    this.colorAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.attr);
    geo.setAttribute('color', this.colorAttr);
    const material = new THREE.PointsMaterial({
      vertexColors: true, size: 0.42, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    const maxSize = 11 * Math.min(window.devicePixelRatio || 1, 2);
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <fog_vertex>',
        `#include <fog_vertex>\n\tgl_PointSize = min(gl_PointSize, ${maxSize.toFixed(1)});`,
      );
    };
    this.points = new THREE.Points(geo, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    this.points.visible = false;
    scene.add(this.points);
  }

  /** Lamp level of the time of day: 0 by day, about 0.6 in the evening, 1 at night. */
  setLevel(level) {
    this.level = level;
    this.points.visible = level > 0;
  }

  update(dt, t, center) {
    if (!this.points.visible) return;
    const p = this.pos;
    const c = this.colors;
    const half = SIZE / 2;
    for (let i = 0; i < this.count; i++) {
      const k = i * 3;
      const ph = this.phase[i];
      p[k] += Math.sin(t * 0.6 + ph) * 0.5 * dt;
      p[k + 2] += Math.cos(t * 0.5 + ph * 1.3) * 0.5 * dt;
      p[k + 1] = this.base[i] + Math.sin(t * 1.1 + ph) * 0.35;
      const dx = p[k] - center.x;
      if (dx > half) p[k] -= SIZE;
      else if (dx < -half) p[k] += SIZE;
      const dz = p[k + 2] - center.z;
      if (dz > half) p[k + 2] -= SIZE;
      else if (dz < -half) p[k + 2] += SIZE;
      const glow = this.level * Math.max(0, Math.sin(t * 1.7 + ph * 3)) ** 2;
      c[k] = glow * 0.85;
      c[k + 1] = glow;
      c[k + 2] = glow * 0.35;
    }
    this.attr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
  }
}
