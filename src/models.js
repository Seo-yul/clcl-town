import * as THREE from 'three';
import { Voxels, voxelMaterial } from './voxel.js';

// ---------------------------------------------------------------------------
// Rig helpers. Every animated model is a root group with a body, a head pivot
// and leg pivots. Geometry is cached per (type, variant) and shared by clones.
// ---------------------------------------------------------------------------

const geoCache = new Map();

function geo(key, build) {
  let g = geoCache.get(key);
  if (!g) {
    const v = new Voxels();
    build(v);
    g = v.geometry();
    geoCache.set(key, g);
  }
  return g;
}

function mesh(g) {
  const m = new THREE.Mesh(g, voxelMaterial);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function pivot(parent, [x, y, z], g) {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  if (g) p.add(mesh(g));
  parent.add(p);
  return p;
}

function buildRig(key, spec) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(mesh(geo(`${key}:body`, spec.body)));
  const head = pivot(body, spec.headAt, geo(`${key}:head`, spec.head));
  const legGeo = geo(`${key}:leg`, spec.leg);
  const legs = spec.legsAt.map((p) => pivot(root, p, legGeo));
  return { root, body, head, legs };
}

const EYE = '#1f1b1a';
const mirror = (fn) => [-1, 1].forEach(fn);

// ---------------------------------------------------------------------------
// Animal catalogue. Names, sounds and emoji are what the UI shows.
// ---------------------------------------------------------------------------

export const ANIMALS = {
  cow: {
    name: '소', emoji: '🐮', sound: '음메~', speed: 0.9, radius: 0.95,
    gait: 'walk', grazes: true,
    variants: {
      holstein: { body: '#f7f5f0', spot: '#2d2a28', hoof: '#3b2f2a', nose: '#f0b2ae', horn: '#efe3c4' },
      hanwoo: { body: '#b8733c', spot: null, hoof: '#4a3222', nose: '#e2a98a', horn: '#efe3c4' },
    },
  },
  pig: {
    name: '돼지', emoji: '🐷', sound: '꿀꿀!', speed: 1.1, radius: 0.7,
    gait: 'walk', grazes: true,
    variants: {
      pink: { body: '#f5adb9', dark: '#e3889b', nostril: '#b5566f', spot: null },
      spotted: { body: '#f5b8c2', dark: '#e3889b', nostril: '#b5566f', spot: '#4a3a3a' },
    },
  },
  chicken: {
    name: '닭', emoji: '🐔', sound: '꼬꼬댁!', speed: 1.3, radius: 0.35,
    gait: 'walk', pecks: true,
    variants: {
      white: { body: '#fbfaf3', wing: '#e9e4d6' },
      brown: { body: '#c97e43', wing: '#a8622e' },
    },
  },
  sheep: {
    name: '양', emoji: '🐑', sound: '메에~', speed: 0.9, radius: 0.8,
    gait: 'walk', grazes: true,
    variants: {
      white: { wool: '#f8f5ee', face: '#3d3532' },
      black: { wool: '#5f5752', face: '#2b2523' },
    },
  },
  duck: {
    name: '오리', emoji: '🦆', sound: '꽥꽥!', speed: 1.0, radius: 0.35,
    gait: 'walk', pecks: true,
    variants: {
      white: { body: '#fbfbf8', wing: '#ebe9e2', head: '#fbfbf8' },
      mallard: { body: '#a3866a', wing: '#86694f', head: '#2f7a4d' },
    },
  },
  horse: {
    name: '말', emoji: '🐴', sound: '히히힝!', speed: 1.5, radius: 1.0,
    gait: 'walk', grazes: true,
    variants: {
      brown: { body: '#8f5a2e', mane: '#3b2414', muzzle: '#6e4421' },
      white: { body: '#efe9df', mane: '#b9ad9c', muzzle: '#d6cbbb' },
      black: { body: '#3e3534', mane: '#1e1a19', muzzle: '#2e2726' },
    },
  },
  rabbit: {
    name: '토끼', emoji: '🐰', sound: '깡총깡총', speed: 1.7, radius: 0.35,
    gait: 'hop',
    variants: {
      white: { fur: '#fbf9f4', inner: '#f6b7c4' },
      brown: { fur: '#b98a62', inner: '#f2b3a8' },
      gray: { fur: '#a9a39c', inner: '#f2b3bd' },
    },
  },
};

const SPECS = {
  cow: (c) => ({
    legsAt: [[-0.3, 0.68, 0.58], [0.3, 0.68, 0.58], [-0.3, 0.68, -0.58], [0.3, 0.68, -0.58]],
    leg: (v) => {
      v.box(0, -0.68, 0, 0.26, 0.13, 0.26, c.hoof);
      v.box(0, -0.55, 0, 0.26, 0.55, 0.26, c.body);
    },
    body: (v) => {
      v.box(0, 0.68, 0, 1.0, 0.82, 1.7, c.body);
      if (c.spot) {
        v.box(0.3, 0.9, 0.25, 0.42, 0.42, 0.5, c.spot);
        v.box(-0.32, 0.8, -0.35, 0.38, 0.5, 0.55, c.spot);
        v.box(-0.05, 1.2, -0.1, 0.5, 0.31, 0.45, c.spot);
      }
      v.box(0, 0.56, -0.45, 0.34, 0.14, 0.34, c.nose);
      v.box(0, 0.9, -0.88, 0.08, 0.55, 0.06, c.body);
      v.box(0, 0.78, -0.88, 0.12, 0.14, 0.1, c.spot || c.hoof);
    },
    headAt: [0, 1.32, 0.8],
    head: (v) => {
      v.box(0, -0.32, 0.28, 0.6, 0.6, 0.56, c.body);
      v.box(0, -0.34, 0.6, 0.62, 0.26, 0.14, c.nose);
      mirror((s) => {
        v.box(s * 0.13, -0.24, 0.672, 0.08, 0.06, 0.02, '#8a5552');
        v.box(s * 0.17, -0.04, 0.565, 0.09, 0.11, 0.02, EYE);
        v.box(s * 0.36, 0.12, 0.25, 0.14, 0.09, 0.12, c.horn);
        v.box(s * 0.41, 0.21, 0.25, 0.07, 0.12, 0.08, c.horn);
        v.box(s * 0.39, -0.06, 0.18, 0.2, 0.1, 0.14, c.body);
      });
      if (c.spot) v.box(0, 0.2, 0.3, 0.3, 0.09, 0.3, c.spot);
    },
  }),

  pig: (c) => ({
    legsAt: [[-0.24, 0.36, 0.38], [0.24, 0.36, 0.38], [-0.24, 0.36, -0.38], [0.24, 0.36, -0.38]],
    leg: (v) => {
      v.box(0, -0.36, 0, 0.21, 0.08, 0.21, c.dark);
      v.box(0, -0.28, 0, 0.2, 0.28, 0.2, c.body);
    },
    body: (v) => {
      v.box(0, 0.32, 0, 0.78, 0.62, 1.15, c.body);
      if (c.spot) {
        v.box(0.25, 0.55, 0.1, 0.3, 0.3, 0.4, c.spot);
        v.box(-0.2, 0.6, -0.25, 0.4, 0.35, 0.4, c.spot);
      }
      v.box(0, 0.75, -0.62, 0.08, 0.08, 0.1, c.dark);
      v.box(0, 0.83, -0.67, 0.08, 0.1, 0.08, c.dark);
    },
    headAt: [0, 0.72, 0.56],
    head: (v) => {
      v.box(0, -0.3, 0.2, 0.6, 0.54, 0.42, c.body);
      v.box(0, -0.2, 0.46, 0.32, 0.22, 0.12, c.dark);
      mirror((s) => {
        v.box(s * 0.07, -0.13, 0.522, 0.06, 0.07, 0.01, c.nostril);
        v.box(s * 0.17, 0.0, 0.415, 0.08, 0.1, 0.02, EYE);
        v.box(s * 0.2, 0.2, 0.28, 0.18, 0.07, 0.2, c.dark);
      });
    },
  }),

  chicken: (c) => ({
    legsAt: [[-0.1, 0.24, 0.02], [0.1, 0.24, 0.02]],
    leg: (v) => {
      v.box(0, -0.24, 0.04, 0.14, 0.03, 0.18, '#f0a23a');
      v.box(0, -0.21, 0, 0.06, 0.21, 0.06, '#f0a23a');
    },
    body: (v) => {
      v.box(0, 0.22, -0.02, 0.42, 0.38, 0.52, c.body);
      mirror((s) => v.box(s * 0.23, 0.3, -0.04, 0.05, 0.22, 0.34, c.wing));
      v.box(0, 0.48, -0.31, 0.26, 0.28, 0.12, c.wing);
    },
    headAt: [0, 0.56, 0.16],
    head: (v) => {
      v.box(0, 0, 0.06, 0.28, 0.32, 0.26, c.body);
      v.box(0, 0.32, 0.06, 0.06, 0.1, 0.2, '#e23b3b');
      v.box(0, 0.14, 0.24, 0.12, 0.08, 0.1, '#f5b521');
      v.box(0, 0.04, 0.21, 0.06, 0.1, 0.05, '#e23b3b');
      mirror((s) => v.box(s * 0.142, 0.18, 0.1, 0.02, 0.07, 0.06, EYE));
    },
  }),

  sheep: (c) => ({
    legsAt: [[-0.27, 0.5, 0.4], [0.27, 0.5, 0.4], [-0.27, 0.5, -0.4], [0.27, 0.5, -0.4]],
    leg: (v) => v.box(0, -0.5, 0, 0.18, 0.5, 0.18, c.face),
    body: (v) => {
      v.box(0, 0.45, 0, 0.92, 0.72, 1.2, c.wool);
      v.box(0, 0.5, 0, 1.0, 0.56, 1.08, c.wool);
      v.box(0, 0.62, 0, 0.84, 0.62, 1.3, c.wool);
      v.box(0, 0.85, -0.7, 0.16, 0.16, 0.1, c.wool);
    },
    headAt: [0, 1.0, 0.62],
    head: (v) => {
      v.box(0, -0.42, 0.2, 0.4, 0.5, 0.36, c.face);
      v.box(0, -0.02, 0.18, 0.5, 0.2, 0.36, c.wool);
      mirror((s) => {
        v.box(s * 0.3, -0.1, 0.16, 0.2, 0.08, 0.12, c.face);
        v.box(s * 0.1, -0.15, 0.385, 0.1, 0.09, 0.02, '#ffffff');
        v.box(s * 0.1, -0.14, 0.4, 0.05, 0.07, 0.02, '#111111');
      });
      v.box(0, -0.36, 0.385, 0.12, 0.05, 0.02, '#e9a3a3');
    },
  }),

  duck: (c) => ({
    legsAt: [[-0.09, 0.14, 0], [0.09, 0.14, 0]],
    leg: (v) => {
      v.box(0, -0.14, 0.05, 0.13, 0.03, 0.17, '#f39a1f');
      v.box(0, -0.11, 0, 0.05, 0.11, 0.05, '#f39a1f');
    },
    body: (v) => {
      v.box(0, 0.13, -0.02, 0.4, 0.3, 0.56, c.body);
      v.box(0, 0.33, -0.3, 0.2, 0.14, 0.12, c.wing);
      mirror((s) => v.box(s * 0.215, 0.2, -0.05, 0.04, 0.18, 0.36, c.wing));
    },
    headAt: [0, 0.38, 0.2],
    head: (v) => {
      v.box(0, 0, 0, 0.18, 0.14, 0.16, c.head);
      v.box(0, 0.12, 0.02, 0.26, 0.26, 0.26, c.head);
      v.box(0, 0.16, 0.2, 0.18, 0.07, 0.16, '#f39a1f');
      mirror((s) => v.box(s * 0.132, 0.27, 0.06, 0.02, 0.06, 0.06, EYE));
    },
  }),

  horse: (c) => ({
    legsAt: [[-0.24, 0.92, 0.6], [0.24, 0.92, 0.6], [-0.24, 0.92, -0.6], [0.24, 0.92, -0.6]],
    leg: (v) => {
      v.box(0, -0.92, 0, 0.22, 0.12, 0.22, '#2c2420');
      v.box(0, -0.8, 0, 0.2, 0.8, 0.2, c.body);
    },
    body: (v) => {
      v.box(0, 0.9, 0, 0.78, 0.74, 1.6, c.body);
      v.box(0, 1.05, -0.86, 0.16, 0.56, 0.14, c.mane);
    },
    headAt: [0, 1.5, 0.7],
    head: (v) => {
      v.box(0, 0, 0.05, 0.38, 0.62, 0.42, c.body);
      v.box(0, 0.1, -0.17, 0.14, 0.62, 0.08, c.mane);
      v.box(0, 0.62, -0.05, 0.14, 0.08, 0.3, c.mane);
      v.box(0, 0.36, 0.38, 0.38, 0.36, 0.62, c.body);
      v.box(0, 0.36, 0.66, 0.36, 0.26, 0.1, c.muzzle);
      mirror((s) => {
        v.box(s * 0.1, 0.48, 0.712, 0.06, 0.05, 0.01, '#1e1a19');
        v.box(s * 0.192, 0.6, 0.38, 0.02, 0.08, 0.08, EYE);
        v.box(s * 0.12, 0.72, 0.18, 0.08, 0.14, 0.08, c.body);
      });
    },
  }),

  rabbit: (c) => ({
    legsAt: [[-0.12, 0.1, 0.15], [0.12, 0.1, 0.15], [-0.12, 0.1, -0.15], [0.12, 0.1, -0.15]],
    leg: (v) => v.box(0, -0.1, 0.02, 0.1, 0.1, 0.14, c.fur),
    body: (v) => {
      v.box(0, 0.08, -0.02, 0.36, 0.32, 0.46, c.fur);
      v.box(0, 0.24, -0.29, 0.14, 0.14, 0.08, '#ffffff');
    },
    headAt: [0, 0.36, 0.2],
    head: (v) => {
      v.box(0, -0.06, 0.05, 0.3, 0.28, 0.28, c.fur);
      mirror((s) => {
        v.box(s * 0.07, 0.22, 0, 0.08, 0.34, 0.06, c.fur);
        v.box(s * 0.07, 0.25, 0.031, 0.04, 0.24, 0.01, c.inner);
        v.box(s * 0.1, 0.07, 0.195, 0.06, 0.07, 0.02, EYE);
      });
      v.box(0, 0.0, 0.195, 0.06, 0.04, 0.02, c.inner);
    },
  }),
};

export function createAnimalRig(type, variant) {
  const colors = ANIMALS[type].variants[variant];
  return buildRig(`${type}/${variant}`, SPECS[type](colors));
}

// ---------------------------------------------------------------------------
// Player: a little farmer with a straw hat and overalls.
// ---------------------------------------------------------------------------

export function createPlayer() {
  const C = {
    skin: '#f7d2b0', hair: '#5a3a28', shirt: '#fff6e8', overall: '#4b7bd1', boot: '#6b4430',
    straw: '#ecc96d', band: '#e0574f', blush: '#f4a0a0', button: '#ffd34d',
  };
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  body.add(mesh(geo('player:torso', (v) => {
    v.box(0, 0.7, 0, 0.56, 0.62, 0.34, C.shirt);
    v.box(0, 0.68, 0, 0.58, 0.32, 0.36, C.overall);
    v.box(0, 0.98, 0.0, 0.34, 0.24, 0.37, C.overall);
    mirror((s) => {
      v.box(s * 0.19, 1.0, 0, 0.07, 0.32, 0.37, C.overall);
      v.box(s * 0.12, 1.12, 0.186, 0.06, 0.06, 0.01, C.button);
    });
  })));

  const head = pivot(body, [0, 1.3, 0], geo('player:head', (v) => {
    v.box(0, 0, 0, 0.52, 0.48, 0.46, C.skin);
    v.box(0, 0.3, -0.02, 0.56, 0.16, 0.5, C.hair);
    v.box(0, 0.04, -0.22, 0.56, 0.36, 0.08, C.hair);
    mirror((s) => {
      v.box(s * 0.27, 0.16, -0.06, 0.04, 0.2, 0.3, C.hair);
      v.box(s * 0.12, 0.16, 0.231, 0.07, 0.11, 0.02, '#2b2b2b');
      v.box(s * 0.19, 0.07, 0.231, 0.08, 0.05, 0.02, C.blush);
    });
    v.box(0, 0.07, 0.231, 0.08, 0.03, 0.02, '#c0705f');
    v.box(0, 0.42, 0, 0.92, 0.06, 0.88, C.straw);
    v.box(0, 0.48, 0, 0.56, 0.24, 0.52, C.straw);
    v.box(0, 0.5, 0, 0.58, 0.07, 0.54, C.band);
  }));

  const armGeo = geo('player:arm', (v) => {
    v.box(0, -0.3, 0, 0.16, 0.32, 0.2, C.shirt);
    v.box(0, -0.48, 0, 0.15, 0.18, 0.18, C.skin);
  });
  const arms = [pivot(body, [-0.36, 1.26, 0], armGeo), pivot(body, [0.36, 1.26, 0], armGeo)];

  const legGeo = geo('player:leg', (v) => {
    v.box(0, -0.7, 0.03, 0.24, 0.16, 0.3, C.boot);
    v.box(0, -0.54, 0, 0.22, 0.54, 0.24, C.overall);
  });
  const legs = [pivot(root, [-0.14, 0.7, 0], legGeo), pivot(root, [0.14, 0.7, 0], legGeo)];

  return { root, body, head, arms, legs };
}

// ---------------------------------------------------------------------------
// Static props, merged into a Voxels builder.
// ---------------------------------------------------------------------------

const LEAVES = ['#5fae4f', '#6dbb58', '#55a449', '#78c25e'];

export function addTree(v, x, z, rng, kind = 'round', scale = 1) {
  const s = scale;
  const trunk = '#8a5a34';
  if (kind === 'pine') {
    const leaf = rng.pick(['#3f8f4f', '#4a9a55', '#38854a']);
    v.box(x, 0, z, 0.5 * s, 1.2 * s, 0.5 * s, trunk);
    [[2.6, 0.9], [2.0, 0.9], [1.4, 0.9], [0.8, 0.8]].forEach(([w, h], i) => {
      v.box(x, (1.0 + i * 0.85) * s, z, w * s, h * s, w * s, leaf, { jitter: 0.06 });
    });
    return;
  }
  const leaf = rng.pick(LEAVES);
  v.box(x, 0, z, 0.6 * s, 1.6 * s, 0.6 * s, trunk);
  v.box(x, 1.4 * s, z, 2.4 * s, 1.4 * s, 2.4 * s, leaf, { jitter: 0.05 });
  v.box(x, 1.7 * s, z, 2.8 * s, 0.8 * s, 1.8 * s, leaf, { jitter: 0.05 });
  v.box(x, 1.7 * s, z, 1.8 * s, 0.8 * s, 2.8 * s, leaf, { jitter: 0.05 });
  v.box(x, 2.8 * s, z, 1.6 * s, 0.7 * s, 1.6 * s, leaf, { jitter: 0.08 });
  if (kind === 'apple') {
    for (let i = 0; i < 5; i++) {
      const a = rng.range(0, Math.PI * 2);
      v.box(x + Math.cos(a) * 1.22 * s, rng.range(1.6, 2.5) * s, z + Math.sin(a) * 1.22 * s, 0.22, 0.22, 0.22, '#e8433a');
    }
  }
}

export function addFlower(v, x, z, color) {
  v.box(x, 0, z, 0.06, 0.28, 0.06, '#4f9a3c');
  v.box(x, 0.28, z, 0.2, 0.14, 0.2, color);
  v.box(x, 0.3, z, 0.08, 0.15, 0.08, '#ffe066');
}

export const FLOWER_COLORS = ['#ff8fab', '#ffd166', '#ffffff', '#c39bff', '#ff6b6b', '#8ecae6'];

/** Puffy sky cloud made of a few boxes. */
export function addCloud(v, rng, ox = 0, oy = 0, oz = 0, s = 1) {
  const white = '#ffffff';
  const shade = '#e8f1fb';
  v.box(ox, oy, oz, 6 * s, 1.6 * s, 3.2 * s, white);
  v.box(ox - 2.6 * s, oy, oz + rng.range(-0.4, 0.4) * s, 3.2 * s, 2.2 * s, 2.6 * s, white);
  v.box(ox + 2.4 * s, oy, oz + rng.range(-0.4, 0.4) * s, 3.4 * s, 2.6 * s, 2.8 * s, white);
  v.box(ox + rng.range(-0.8, 0.8) * s, oy + 1.4 * s, oz, 3.2 * s, 2.0 * s, 2.4 * s, white);
  v.box(ox, oy - 0.2 * s, oz, 7.4 * s, 0.4 * s, 2.6 * s, shade);
}

/** "클클이", the cloud mascot floating above the plaza fountain. */
export function createMascot() {
  const v = new Voxels();
  const W = '#ffffff';
  const S = '#dfeaf8';
  const INK = '#2e4a7d';
  v.box(0, -0.9, 0, 3.2, 1.8, 1.8, W);
  v.box(-1.7, -0.9, 0, 1.6, 1.3, 1.5, W);
  v.box(1.7, -0.9, 0, 1.6, 1.5, 1.5, W);
  v.box(-0.5, 0.6, 0, 1.6, 0.9, 1.4, W);
  v.box(0.6, 0.6, 0, 1.2, 0.6, 1.3, W);
  v.box(0, -1.05, 0, 4.6, 0.3, 1.4, S);
  mirror((s) => {
    v.box(s * 0.62, -0.25, 0.905, 0.22, 0.42, 0.02, INK);
    v.box(s * 1.05, -0.62, 0.905, 0.36, 0.16, 0.02, '#f7a8b8');
  });
  v.box(0, -0.6, 0.905, 0.4, 0.1, 0.02, INK);
  const m = v.mesh();
  const g = new THREE.Group();
  g.add(m);
  return g;
}
