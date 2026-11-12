import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// One shared material for every static voxel mesh. Colors live in vertex colors,
// so a whole farm (fence, barn, crops, trees) renders in a single draw call.
export const voxelMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });

const tmp = new THREE.Color();

export class Voxels {
  constructor() {
    this.list = [];
  }

  /**
   * Adds a colored box. (x, z) is the center; y is the bottom of the box,
   * or the center when opt.center is true (useful for rotated boxes).
   */
  box(x, y, z, w, h, d, color, opt = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.deleteAttribute('uv');
    if (opt.rx) g.rotateX(opt.rx);
    if (opt.rz) g.rotateZ(opt.rz);
    if (opt.ry) g.rotateY(opt.ry);
    g.translate(x, opt.center ? y : y + h / 2, z);
    tmp.set(color);
    if (opt.jitter) tmp.offsetHSL(0, 0, (Math.random() - 0.5) * opt.jitter);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = tmp.r;
      arr[i * 3 + 1] = tmp.g;
      arr[i * 3 + 2] = tmp.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.list.push(g);
    return this;
  }

  geometry() {
    if (!this.list.length) return null;
    const merged = mergeGeometries(this.list, false);
    for (const g of this.list) g.dispose();
    this.list = [];
    merged.computeBoundingSphere();
    return merged;
  }

  mesh(material = voxelMaterial, { cast = true, receive = true } = {}) {
    const geo = this.geometry();
    if (!geo) return null;
    const m = new THREE.Mesh(geo, material);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
  }
}

/** Canvas texture with centered text, used for wooden signs. */
export function textTexture(text, { width = 512, height = 128, font = 'bold 64px Galmuri11', color = '#3b2a1e', bg = null } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font;
  let size = parseInt(font.match(/(\d+)px/)[1], 10);
  while (ctx.measureText(text).width > width * 0.9 && size > 12) {
    size -= 2;
    ctx.font = font.replace(/\d+px/, `${size}px`);
  }
  ctx.fillText(text, width / 2, height / 2 + size * 0.06);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
