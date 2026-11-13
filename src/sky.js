import * as THREE from 'three';
import { Voxels } from './voxel.js';
import { addCloud } from './models.js';
import { makeRng } from './rng.js';
import { SEASON } from './season.js';

// Light bounced off snow is brighter and cooler than off grass.
const SNOW_BOUNCE = new THREE.Color('#dfe7ef');
// In autumn, light bounced off golden grass and leaves is warmer.
const AUTUMN_BOUNCE = new THREE.Color('#c9a55a');

export const TIMES = {
  morning: {
    label: '아침', icon: '🌅', top: '#8fcdf4', bottom: '#fde6c6', fog: '#f3e5d0',
    sun: '#ffe2bd', sunI: 2.4, hemiSky: '#d6ebff', hemiGround: '#a6c27f', hemiI: 1.7, dir: [45, 38, 30], lamps: 0,
  },
  day: {
    label: '낮', icon: '☀️', top: '#6cbcf2', bottom: '#d5efff', fog: '#d5efff',
    sun: '#ffffff', sunI: 2.7, hemiSky: '#e2f1ff', hemiGround: '#9cc27a', hemiI: 1.9, dir: [22, 55, 30], lamps: 0,
  },
  evening: {
    label: '저녁', icon: '🌇', top: '#7d86cf', bottom: '#ffc08e', fog: '#f5c39c',
    sun: '#ffb47e', sunI: 2.2, hemiSky: '#ffd6b8', hemiGround: '#8f9c6c', hemiI: 1.45, dir: [-45, 30, 25], lamps: 0.6,
  },
  night: {
    label: '밤', icon: '🌙', top: '#0f1838', bottom: '#2c3c70', fog: '#24325c',
    sun: '#a9bcff', sunI: 1.0, hemiSky: '#6a7fc0', hemiGround: '#2a3540', hemiI: 1.05, dir: [-25, 50, 35], lamps: 1,
  },
};

export const TIME_ORDER = ['morning', 'day', 'evening', 'night'];

// New Year's Day opens at dawn. Over SUNRISE seconds the light turns into morning
// while a big sun climbs out of the forest in the east.
const DAWN = {
  top: '#26305c', bottom: '#f3a07c', fog: '#e8a58c',
  sun: '#ff9a62', sunI: 1.3, hemiSky: '#9a92c4', hemiGround: '#8c7a76', hemiI: 1.15, dir: [80, 6, 8], lamps: 0.5,
};
const SUNRISE = 30;
const SUN_X = 360; // far east, just inside the ground's edge, so the ground hides the sun below the horizon
const SUN_FROM = -32;
const SUN_TO = 76;

const lerpColor = (a, b, t) => `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;

/** Palette between a and b. */
function mixPalette(a, b, t) {
  const out = {};
  for (const k of Object.keys(b)) {
    if (typeof b[k] === 'number') out[k] = a[k] + (b[k] - a[k]) * t;
    else if (Array.isArray(b[k])) out[k] = b[k].map((v, i) => a[k][i] + (v - a[k][i]) * t);
    else if (typeof b[k] === 'string' && b[k].startsWith('#')) out[k] = lerpColor(a[k], b[k], t);
    else out[k] = b[k];
  }
  return out;
}

/** A voxel sun facing west: rows of boxes in a disc, red at the bottom and gold at the top, with a soft halo. */
function buildSun() {
  const g = new THREE.Group();
  const R = 26;
  const px = 4;
  const v = new Voxels();
  for (let y = -R + px / 2; y < R; y += px) {
    const w = Math.round((2 * Math.sqrt(R * R - y * y)) / px) * px;
    if (w <= 0) continue;
    v.box(0, y, 0, w, px, 2, lerpColor('#ff4a2a', '#ffc35a', (y + R) / (2 * R)), { center: true });
  }
  const disc = v.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), { cast: false, receive: false });
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(R * 1.7, 40),
    new THREE.MeshBasicMaterial({
      color: '#ff9a50', transparent: true, opacity: 0.38, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    }),
  );
  halo.position.z = -6;
  g.add(halo, disc);
  g.rotation.y = -Math.PI / 2;
  return g;
}

export function timeForHour(h) {
  if (h >= 5 && h < 9) return 'morning';
  if (h >= 9 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'evening';
  return 'night';
}

const smooth = (t) => t * t * (3 - 2 * t);

export class Sky {
  constructor(scene, world) {
    this.scene = scene;
    this.hemi = new THREE.HemisphereLight('#ffffff', '#88aa66', 1.8);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffffff', 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    const cam = this.sun.shadow.camera;
    cam.near = 1;
    cam.far = 160;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.dir = new THREE.Vector3(22, 55, 30);
    scene.fog = new THREE.Fog('#d5efff', 70, 170);
    this.world = world;
    this.setShadowSpan(34);
    this.lamps = 0;

    // 0 at dawn, 1 once the sun is up. Only New Year's Day starts below 1.
    this.sunrise = SEASON.newyear ? 0 : 1;
    if (SEASON.newyear) {
      this.sunDisc = buildSun();
      this.sunDisc.position.set(SUN_X, SUN_FROM, 0);
      scene.add(this.sunDisc);
    }

    // drifting voxel clouds
    const rng = makeRng('clcl-sky');
    this.clouds = [];
    this.spanX = world.W / 2 + 90;
    const spanZ = world.D / 2 + 60;
    for (let i = 0; i < 16; i++) {
      const v = new Voxels();
      addCloud(v, rng, 0, 0, 0, rng.range(0.9, 1.7));
      const m = v.mesh(undefined, { cast: true, receive: false });
      m.position.set(rng.range(-this.spanX, this.spanX), rng.range(24, 34), rng.range(-spanZ, spanZ));
      m.userData.speed = rng.range(0.8, 1.6);
      scene.add(m);
      this.clouds.push(m);
    }
  }

  setShadowSpan(span) {
    const cam = this.sun.shadow.camera;
    cam.left = -span;
    cam.right = span;
    cam.top = span;
    cam.bottom = -span;
    cam.updateProjectionMatrix();
  }

  apply(key) {
    this.key = key;
    // Picking another time of day ends the sunrise.
    if (key !== 'morning') this.sunrise = 1;
    this.setPalette(this.sunrise < 1 ? mixPalette(DAWN, TIMES.morning, smooth(this.sunrise)) : TIMES[key], key);
    return TIMES[key];
  }

  setPalette(p, key) {
    this.hemi.color.set(p.hemiSky);
    this.hemi.groundColor.set(p.hemiGround);
    if (SEASON.snow) this.hemi.groundColor.lerp(SNOW_BOUNCE, key === 'night' ? 0.3 : 0.6);
    else if (SEASON.autumn) this.hemi.groundColor.lerp(AUTUMN_BOUNCE, key === 'night' ? 0.15 : 0.45);
    this.hemi.intensity = p.hemiI;
    this.sun.color.set(p.sun);
    this.sun.intensity = p.sunI;
    this.dir.set(...p.dir);
    this.scene.fog.color.set(p.fog);
    const root = document.documentElement.style;
    root.setProperty('--sky-top', p.top);
    root.setProperty('--sky-bottom', p.bottom);
    document.documentElement.dataset.time = key;
    this.world.lampMaterial.emissive.set('#ffcf6e').multiplyScalar(p.lamps);
    this.world.setLights(p.lamps);
    this.lamps = p.lamps;
  }

  follow(target) {
    this.sun.position.copy(target).add(this.dir);
    this.sun.target.position.copy(target);
  }

  update(dt) {
    if (this.sunDisc) {
      if (this.sunrise < 1 && this.key === 'morning') {
        this.sunrise = Math.min(1, this.sunrise + dt / SUNRISE);
        this.setPalette(mixPalette(DAWN, TIMES.morning, smooth(this.sunrise)), 'morning');
      }
      // The sun is up in the first half of the sunrise; the light keeps warming after that.
      const up = 1 - (1 - Math.min(1, this.sunrise * 2)) ** 3;
      this.sunDisc.position.y = SUN_FROM + (SUN_TO - SUN_FROM) * up;
      this.sunDisc.visible = this.key === 'morning';
    }
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > this.spanX) c.position.x = -this.spanX;
    }
  }
}
