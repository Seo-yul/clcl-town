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
  return { root, body, head, legs, bodyBase: 0 };
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
// Games the owners played together. Each game is a voxel character that lives
// on the farm like an animal. Names, emoji, the E action and the speech lines
// are what the UI shows. `react` is what the character does when the player
// presses E: flip (card), flail (kraken), glance (agent), roll (die).
// ---------------------------------------------------------------------------

export const GAMES = {
  holdem: {
    name: '홀덤', emoji: '🃏', action: '홀덤 카드 뒤집기',
    lines: ['체크', '콜!', '레이즈!', '올인!'],
    speed: 1.0, radius: 0.5, bubbleY: 2.2, gait: 'waddle', react: 'flip',
    variants: { spade: {} },
  },
  kraken: {
    name: '노 터치 크라켄', emoji: '🐙', action: '크라켄 건드리기',
    lines: ['건드리지 마!', '크아앙!', '보물은 없어~'],
    speed: 0.7, radius: 0.9, bubbleY: 2.1, gait: 'tentacle', react: 'flail',
    variants: { deep: {} },
  },
  codenames: {
    name: '코드네임', emoji: '🕵️', action: '요원에게 말 걸기',
    lines: ['쉿! 일급 비밀이야', '힌트는 한 단어뿐!', '암살자만은 안 돼!'],
    speed: 1.2, radius: 0.4, bubbleY: 2.3, gait: 'walk', react: 'glance',
    variants: { red: { tie: '#d63c3c' }, blue: { tie: '#2f6fd6' } },
  },
  lasvegas: {
    name: '라스베가스', emoji: '🎲', action: '주사위 굴리기',
    lines: ['잭팟!', '6 나와라!', '카지노로 가자!'],
    speed: 1.3, radius: 0.45, bubbleY: 1.6, gait: 'bounce', react: 'roll',
    variants: { red: {} },
  },
  // Murder mystery series: silent strangers. They only ever answer "...".
  wendy: { name: '웬디, 어른이 되렴', emoji: '🤖', ...mystery(0.35, 2.0) },
  bluemoon: { name: '몇 번이고 푸른 달에 불을 붙였다', emoji: '🌙', ...mystery(0.35, 2.1) },
  werewolf: { name: '늑대인간 마을의 축제', emoji: '🐺', ...mystery(0.45, 2.2) },
  eida: { name: '에이다', emoji: '👑', ...mystery(0.42, 2.35) },
  giantbird: { name: '괴조는 깊은 탄식의 끝에', emoji: '🦅', ...mystery(0.55, 2.4) },
  hero: { name: '용사가 죽었다', emoji: '⚔️', ...mystery(0.42, 2.3) },
  suspect: { name: '서스펙트 게임: 클로즈드 서클 미스터리', emoji: '🔍', ...mystery(0.42, 2.25) },
};

function mystery(radius, bubbleY) {
  return {
    series: 'mystery', action: '수상한 인물에게 말 걸기', lines: ['...'],
    speed: 0.9, radius, bubbleY, gait: 'walk', react: 'glance', variants: { one: {} },
  };
}

// The club's own character: every owner is a member of 클라우드 클럽 (CLCL) and
// gets one little cloud on their farm. It is not a game, so it is listed apart.
export const CLUB = {
  cloud: {
    name: '클라우드 클럽', emoji: '☁️', action: '구름 쓰다듬기',
    lines: [
      'git push --force',
      'git commit -m "fix"',
      'rm -rf node_modules',
      '제 컴퓨터에선 되는데요?',
      '금요일엔 배포 안 해요',
      '버그가 아니라 기능이에요',
      '왜 되는지 모르겠는데 돼요',
      'LGTM!',
    ],
    speed: 0.8, radius: 0.6, bubbleY: 1.9, gait: 'float', react: 'puff',
    variants: { white: {} },
  },
};

/** Animal, game or club definition for a critter type. */
export function critterDef(type) {
  return ANIMALS[type] || GAMES[type] || CLUB[type];
}

/** Draws pixel art rows ('#' = filled) as thin boxes on the z plane, one box per run. */
function pixels(v, rows, left, top, z, size, color, depth = 0.02) {
  rows.forEach((row, r) => {
    let start = -1;
    for (let c = 0; c <= row.length; c++) {
      const on = row[c] === '#';
      if (on && start < 0) start = c;
      if (!on && start >= 0) {
        const w = (c - start) * size;
        v.box(left + start * size + w / 2, top - (r + 1) * size, z, w, size, depth, color);
        start = -1;
      }
    }
  });
}

const SPADE = [
  '....#....',
  '...###...',
  '..#####..',
  '.#######.',
  '#########',
  '#########',
  '.##.#.##.',
  '....#....',
  '...###...',
];
const LETTER_A = ['.#.', '#.#', '###', '#.#'];

function rigOf(body, head, legs, bodyBase = 0) {
  const root = new THREE.Group();
  root.add(body);
  body.position.y = bodyBase;
  for (const leg of legs) if (!leg.parent) root.add(leg);
  return { root, body, head, legs, bodyBase };
}

/** 홀덤: a standing playing card (ace of spades) with a face, stick arms and red shoes. */
function holdemRig() {
  const C = {
    face: '#fbf8ef', back: '#c83a3f', backLine: '#f6e7d2', ink: '#24212c',
    blush: '#f4a3a3', glove: '#ffffff', shoe: '#d2423f', shine: '#ffffff',
  };
  const body = new THREE.Group();
  body.add(mesh(geo('game:holdem:body', (v) => {
    // the card, with clipped corners
    v.box(0, 0.32, 0, 0.9, 1.22, 0.1, C.face);
    v.box(0, 0.28, 0, 0.8, 1.3, 0.1, C.face);
    // red back with a white frame and a diamond
    const bz = -0.061;
    v.box(0, 0.36, bz, 0.78, 1.14, 0.02, C.back);
    v.box(0, 1.42, bz - 0.012, 0.64, 0.04, 0.02, C.backLine);
    v.box(0, 0.42, bz - 0.012, 0.64, 0.04, 0.02, C.backLine);
    mirror((s) => v.box(s * 0.3, 0.42, bz - 0.012, 0.04, 1.04, 0.02, C.backLine));
    v.box(0, 0.93, bz - 0.012, 0.28, 0.28, 0.02, C.backLine, { rz: Math.PI / 4, center: true });
    v.box(0, 0.93, bz - 0.022, 0.15, 0.15, 0.02, C.back, { rz: Math.PI / 4, center: true });
    // front: corner indices, the big spade, and a face
    const fz = 0.061;
    pixels(v, LETTER_A, -0.37, 1.52, fz, 0.045, C.ink);
    v.box(-0.305, 1.27, fz, 0.08, 0.08, 0.02, C.ink, { rz: Math.PI / 4, center: true });
    v.box(-0.305, 1.18, fz, 0.03, 0.06, 0.02, C.ink);
    pixels(v, [...LETTER_A].reverse(), 0.235, 0.52, fz, 0.045, C.ink);
    v.box(0.305, 0.6, fz, 0.08, 0.08, 0.02, C.ink, { rz: Math.PI / 4, center: true });
    v.box(0.305, 0.64, fz, 0.03, 0.06, 0.02, C.ink);
    pixels(v, SPADE, -0.2475, 0.98, fz, 0.055, C.ink);
    mirror((s) => {
      v.box(s * 0.15, 1.08, fz, 0.09, 0.13, 0.02, C.ink);
      v.box(s * 0.15 + 0.02, 1.16, fz + 0.012, 0.03, 0.03, 0.01, C.shine);
      v.box(s * 0.27, 1.05, fz, 0.1, 0.05, 0.02, C.blush);
      // stick arms with white gloves
      v.box(s * 0.53, 0.84, 0, 0.06, 0.3, 0.06, C.ink, { rz: s * 0.58, center: true });
      v.box(s * 0.61, 0.71, 0, 0.13, 0.12, 0.12, C.glove, { center: true });
    });
    v.box(0, 1.02, fz, 0.08, 0.03, 0.02, C.ink);
  })));
  const head = new THREE.Group();
  head.position.set(0, 1.2, 0);
  body.add(head);
  const legGeo = geo('game:holdem:leg', (v) => {
    v.box(0, -0.28, 0, 0.07, 0.3, 0.07, C.ink);
    v.box(0, -0.3, 0.03, 0.14, 0.08, 0.2, C.shoe);
  });
  const legs = [-1, 1].map((s) => {
    const p = new THREE.Group();
    p.position.set(s * 0.18, 0.3, 0);
    p.add(mesh(legGeo));
    return p;
  });
  return rigOf(body, head, legs);
}

/** 노 터치 크라켄: a spotted teal kraken with big orange slit eyes and six curling tentacles. */
function krakenRig() {
  const K = {
    skin: '#4fae9b', dark: '#3f9786', spot: '#2e7d6e', arm: '#57a462', sucker: '#cfe39a',
    eye: '#f39a2b', rim: '#c75a1a', pupil: '#3a160c', shine: '#fff4d6', brow: '#1f4a40',
  };
  const body = new THREE.Group();
  body.add(mesh(geo('game:kraken:base', (v) => {
    v.box(0, 0.14, 0, 0.8, 0.34, 0.76, K.dark);
  })));
  const head = new THREE.Group();
  head.position.set(0, 0.46, 0);
  body.add(head);
  head.add(mesh(geo('game:kraken:head', (v) => {
    // mantle, leaning back like an octopus
    v.box(0, 0, 0, 0.92, 0.5, 0.86, K.skin);
    v.box(0, 0.5, -0.06, 0.8, 0.26, 0.74, K.skin);
    v.box(0, 0.76, -0.12, 0.6, 0.16, 0.56, K.skin);
    v.box(0, 0.92, -0.16, 0.36, 0.08, 0.34, K.skin);
    // spots
    v.box(0.22, 0.92, 0.05, 0.1, 0.02, 0.1, K.spot);
    v.box(-0.2, 0.92, -0.3, 0.12, 0.02, 0.1, K.spot);
    v.box(0.1, 0.76, 0.24, 0.12, 0.02, 0.08, K.spot);
    v.box(0.35, 0.76, -0.1, 0.08, 0.02, 0.12, K.spot);
    v.box(-0.33, 0.76, 0.0, 0.06, 0.02, 0.1, K.spot);
    mirror((s) => {
      v.box(s * 0.465, 0.12, -0.1, 0.02, 0.12, 0.14, K.spot);
      v.box(s * 0.465, 0.3, 0.2, 0.02, 0.1, 0.1, K.spot);
      v.box(s * 0.405, 0.58, -0.2, 0.02, 0.1, 0.12, K.spot);
      // big orange eyes with slit pupils and grumpy brows
      v.box(s * 0.21, 0.06, 0.435, 0.34, 0.32, 0.02, K.rim);
      v.box(s * 0.21, 0.09, 0.445, 0.28, 0.27, 0.02, K.eye);
      v.box(s * 0.21, 0.11, 0.455, 0.06, 0.23, 0.02, K.pupil);
      v.box(s * 0.21 + 0.08, 0.28, 0.462, 0.06, 0.06, 0.02, K.shine);
      v.box(s * 0.21, 0.43, 0.445, 0.3, 0.05, 0.03, K.brow, { rz: s * 0.3, center: true });
    });
  })));
  const armGeo = geo('game:kraken:arm', (v) => {
    v.box(0, -0.2, 0.12, 0.2, 0.2, 0.3, K.arm);
    v.box(0, -0.24, 0.38, 0.17, 0.17, 0.26, K.arm);
    v.box(0, -0.25, 0.6, 0.14, 0.14, 0.2, K.arm);
    v.box(0, -0.16, 0.74, 0.12, 0.22, 0.12, K.arm);
    v.box(0, 0.0, 0.66, 0.1, 0.1, 0.12, K.arm);
    v.box(0, -0.005, 0.12, 0.08, 0.02, 0.08, K.sucker);
    v.box(0, -0.075, 0.4, 0.07, 0.02, 0.07, K.sucker);
    v.box(0, -0.115, 0.6, 0.06, 0.02, 0.06, K.sucker);
    v.box(0, -0.12, 0.675, 0.08, 0.14, 0.02, K.sucker);
  });
  const legs = [];
  const roots = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const o = new THREE.Group();
    o.position.set(Math.sin(a) * 0.3, 0.26, Math.cos(a) * 0.3);
    o.rotation.y = a;
    const p = new THREE.Group();
    p.add(mesh(armGeo));
    o.add(p);
    roots.push(o);
    legs.push(p);
  }
  const rig = rigOf(body, head, roots);
  rig.legs = legs;
  return rig;
}

/** 코드네임: a secret agent in a black suit and sunglasses, with a red or blue team tie. */
function codenamesRig(c) {
  const A = {
    suit: '#26252d', shirt: '#f4f1ea', skin: '#f2c9a5', hair: '#1d1a1f',
    glasses: '#121116', lens: '#5b6070', shoe: '#141318', mouth: '#9a5a4a', tie: c.tie,
  };
  const key = `game:codenames:${c.tie}`;
  const body = new THREE.Group();
  body.add(mesh(geo(`${key}:body`, (v) => {
    v.box(0, 0.5, 0, 0.5, 0.62, 0.3, A.suit);
    v.box(0, 0.88, 0.151, 0.16, 0.24, 0.01, A.shirt);
    v.box(0, 0.74, 0.158, 0.06, 0.34, 0.01, A.tie);
    mirror((s) => {
      v.box(s * 0.07, 1.05, 0.158, 0.06, 0.06, 0.01, A.shirt);
      v.box(s * 0.3, 0.78, 0, 0.12, 0.34, 0.22, A.suit);
      v.box(s * 0.22, 0.8, 0.27, 0.08, 0.1, 0.04, A.skin);
    });
    // arms crossed over the chest, like the agents on the box
    v.box(0, 0.78, 0.2, 0.54, 0.14, 0.12, A.suit);
  })));
  const head = new THREE.Group();
  head.position.set(0, 1.12, 0);
  body.add(head);
  head.add(mesh(geo(`${key}:head`, (v) => {
    v.box(0, 0, 0, 0.4, 0.4, 0.36, A.skin);
    v.box(0, 0.34, -0.02, 0.42, 0.1, 0.4, A.hair);
    v.box(0, 0.12, -0.18, 0.42, 0.28, 0.06, A.hair);
    mirror((s) => {
      v.box(s * 0.205, 0.2, -0.05, 0.03, 0.18, 0.26, A.hair);
      v.box(s * 0.1, 0.22, 0.197, 0.04, 0.02, 0.01, A.lens);
    });
    v.box(0, 0.16, 0.185, 0.38, 0.1, 0.02, A.glasses);
    v.box(0, 0.06, 0.185, 0.09, 0.025, 0.01, A.mouth);
  })));
  const legGeo = geo(`${key}:leg`, (v) => {
    v.box(0, -0.5, 0.03, 0.18, 0.08, 0.26, A.shoe);
    v.box(0, -0.44, 0, 0.16, 0.44, 0.18, A.suit);
  });
  const legs = [-1, 1].map((s) => {
    const p = new THREE.Group();
    p.position.set(s * 0.12, 0.5, 0);
    p.add(mesh(legGeo));
    return p;
  });
  return rigOf(body, head, legs);
}

/** 라스베가스: a red casino die with white pips and a face, hopping around. */
function lasvegasRig() {
  const D = { die: '#d8303a', pip: '#fdf6ec', pupil: '#2a1a1e', mouth: '#7a1a22' };
  const body = new THREE.Group();
  const s = 0.35;
  body.add(mesh(geo('game:lasvegas:die', (v) => {
    const C = { center: true };
    v.box(0, 0, 0, 0.7, 0.62, 0.62, D.die, C);
    v.box(0, 0, 0, 0.62, 0.7, 0.62, D.die, C);
    v.box(0, 0, 0, 0.62, 0.62, 0.7, D.die, C);
    const pip = (x, y, z, axis) => {
      const size = [0.11, 0.11, 0.11];
      size['xyz'.indexOf(axis)] = 0.02;
      v.box(x, y, z, size[0], size[1], size[2], D.pip, C);
    };
    // top: five
    for (const [x, z] of [[-0.17, -0.17], [0.17, -0.17], [0, 0], [-0.17, 0.17], [0.17, 0.17]]) pip(x, s + 0.005, z, 'y');
    // right: three, left: four, back: six, bottom: two
    for (const [y, z] of [[0.17, -0.17], [0, 0], [-0.17, 0.17]]) pip(s + 0.005, y, z, 'x');
    for (const [y, z] of [[0.17, -0.17], [0.17, 0.17], [-0.17, -0.17], [-0.17, 0.17]]) pip(-s - 0.005, y, z, 'x');
    for (const [x, y] of [[-0.17, 0.17], [0.17, 0.17], [-0.17, 0], [0.17, 0], [-0.17, -0.17], [0.17, -0.17]]) pip(x, y, -s - 0.005, 'z');
    for (const [x, z] of [[-0.17, -0.17], [0.17, 0.17]]) pip(x, -s - 0.005, z, 'y');
    // front: a face, two pips for eyes
    mirror((m) => {
      v.box(m * 0.15, 0.08, s + 0.005, 0.13, 0.13, 0.02, D.pip, C);
      v.box(m * 0.15, 0.06, s + 0.017, 0.06, 0.08, 0.01, D.pupil, C);
    });
    v.box(0, -0.13, s + 0.005, 0.14, 0.04, 0.02, D.mouth, C);
  })));
  const head = new THREE.Group();
  body.add(head);
  return rigOf(body, head, [], s);
}

/** 클라우드 클럽: a small floating version of the plaza mascot 클클이. */
function cloudRig() {
  const W = '#ffffff';
  const S = '#dfeaf8';
  const INK = '#2e4a7d';
  const body = new THREE.Group();
  body.add(mesh(geo('club:cloud', (v) => {
    v.box(0, 0, 0, 1.0, 0.5, 0.6, W);
    v.box(-0.52, 0, 0, 0.5, 0.38, 0.5, W);
    v.box(0.52, 0, 0, 0.5, 0.44, 0.5, W);
    v.box(-0.15, 0.5, 0, 0.5, 0.26, 0.46, W);
    v.box(0.2, 0.5, 0, 0.36, 0.18, 0.42, W);
    v.box(0, -0.05, 0, 1.4, 0.1, 0.46, S);
    mirror((s) => {
      v.box(s * 0.19, 0.2, 0.305, 0.07, 0.13, 0.02, INK);
      v.box(s * 0.33, 0.1, 0.305, 0.11, 0.05, 0.02, '#f7a8b8');
    });
    v.box(0, 0.11, 0.305, 0.12, 0.03, 0.02, INK);
  })));
  const head = new THREE.Group();
  body.add(head);
  return rigOf(body, head, [], 0.45);
}

// ---------------------------------------------------------------------------
// Murder mystery characters, each based on its game's cover art.
// ---------------------------------------------------------------------------

const twoLegs = (x, y) => [[-x, y, 0], [x, y, 0]];

/** 웬디, 어른이 되렴: an android girl with blunt black bangs over her eyes and a red drip from the missing left eye. */
function wendyRig() {
  const C = {
    hair: '#141012', skin: '#f6e6d6', dress: '#1d1411', crimson: '#c5072f', lime: '#a2c489',
    drip: '#d01f3c', mouth: '#9b3a3a',
  };
  return buildRig('mystery:wendy', {
    legsAt: twoLegs(0.1, 0.4),
    leg: (v) => {
      v.box(0, -0.4, 0, 0.12, 0.4, 0.14, C.dress);
      v.box(0, -0.4, 0.03, 0.14, 0.08, 0.2, C.crimson);
    },
    body: (v) => {
      v.box(0, 0.36, 0, 0.5, 0.26, 0.38, C.dress);
      v.box(-0.13, 0.355, 0, 0.255, 0.27, 0.39, C.crimson);
      v.box(0, 0.6, 0, 0.38, 0.36, 0.26, C.dress);
      v.box(0, 0.9, 0.135, 0.2, 0.06, 0.02, C.crimson);
      v.box(0, 0.8, 0.135, 0.06, 0.06, 0.02, C.lime);
      mirror((s) => {
        v.box(s * 0.24, 0.62, 0, 0.1, 0.3, 0.12, C.dress);
        v.box(s * 0.24, 0.55, 0, 0.09, 0.07, 0.1, C.skin);
      });
    },
    headAt: [0, 0.96, 0],
    head: (v) => {
      v.box(0, 0, 0, 0.44, 0.42, 0.4, C.skin);
      v.box(0, 0.36, -0.02, 0.48, 0.12, 0.44, C.hair);
      v.box(0, -0.06, -0.21, 0.48, 0.5, 0.06, C.hair);
      v.box(0, 0.2, 0.205, 0.46, 0.18, 0.04, C.hair);
      mirror((s) => {
        v.box(s * 0.225, 0.02, -0.03, 0.04, 0.4, 0.36, C.hair);
        v.box(s * 0.27, -0.3, -0.02, 0.1, 0.42, 0.1, C.hair);
        v.box(s * 0.27, 0.04, -0.02, 0.12, 0.05, 0.12, C.crimson);
      });
      v.box(0, 0.08, 0.205, 0.1, 0.025, 0.01, C.mouth);
      v.box(0.1, 0.06, 0.205, 0.035, 0.14, 0.01, C.drip);
      v.box(0.1, 0.01, 0.205, 0.05, 0.05, 0.01, C.drip);
      v.box(0.1, -0.06, 0.205, 0.045, 0.045, 0.01, C.lime);
    },
  });
}

/** 몇 번이고 푸른 달에 불을 붙였다: the navy woodcut rose from the cover, walking on its stem. */
function bluemoonRig() {
  const C = { navy: '#13244b', light: '#506185', hatch: '#dfe4f0', stem: '#1b2d55' };
  return buildRig('mystery:bluemoon', {
    legsAt: twoLegs(0.09, 0.3),
    leg: (v) => {
      v.box(0, -0.3, 0, 0.08, 0.3, 0.08, C.stem);
      v.box(0, -0.3, 0.02, 0.14, 0.06, 0.18, C.navy);
    },
    body: (v) => {
      v.box(0, 0.28, 0, 0.12, 0.8, 0.12, C.stem);
      mirror((s) => {
        v.box(s * 0.2, 0.62, 0, 0.32, 0.12, 0.06, C.navy, { rz: s * 0.5, center: true });
        v.box(s * 0.33, 0.74, 0, 0.16, 0.08, 0.05, C.light, { rz: s * 0.8, center: true });
        v.box(s * 0.2, 0.62, 0.035, 0.22, 0.02, 0.01, C.hatch, { rz: s * 0.5, center: true });
      });
      v.box(0.08, 0.44, 0, 0.06, 0.04, 0.04, C.navy);
      v.box(-0.08, 0.86, 0, 0.06, 0.04, 0.04, C.navy);
      v.box(0.08, 0.98, 0, 0.05, 0.04, 0.04, C.navy);
    },
    headAt: [0, 1.06, 0],
    head: (v) => {
      v.box(0, 0, 0, 0.64, 0.34, 0.64, C.navy);
      v.box(0, 0.04, 0, 0.62, 0.32, 0.62, C.light, { ry: Math.PI / 4 });
      v.box(0, 0.3, 0, 0.46, 0.14, 0.46, C.navy, { ry: 0.3 });
      v.box(0, 0.4, 0, 0.28, 0.12, 0.28, C.light, { ry: 1.0 });
      v.box(0, 0.5, 0, 0.12, 0.08, 0.12, C.navy);
      // white woodcut scratches
      mirror((s) => {
        v.box(s * 0.325, 0.1, 0.08, 0.02, 0.16, 0.03, C.hatch);
        v.box(0.12 * s, 0.1, 0.325, 0.03, 0.18, 0.02, C.hatch);
        v.box(s * 0.16, 0.44, 0.1, 0.12, 0.02, 0.02, C.hatch);
      });
      v.box(0, 0.12, -0.325, 0.2, 0.02, 0.02, C.hatch);
    },
  });
}

/** 늑대인간 마을의 축제: a cream werewolf in a crimson cape, holding the cover's faceted red decanter. */
function werewolfRig() {
  const C = {
    fur: '#efe6cf', shade: '#d8cba9', pale: '#fbf6e6', crimson: '#a93631', dark: '#6d100d',
    nose: '#2a1a18', eye: '#c8323c',
  };
  return buildRig('mystery:werewolf', {
    legsAt: twoLegs(0.13, 0.42),
    leg: (v) => {
      v.box(0, -0.42, 0, 0.16, 0.42, 0.18, C.fur);
      v.box(0, -0.42, 0.04, 0.18, 0.08, 0.24, C.shade);
    },
    body: (v) => {
      v.box(0, 0.42, 0, 0.5, 0.56, 0.34, C.fur);
      v.box(0, 0.62, 0.171, 0.24, 0.24, 0.02, C.pale);
      v.box(0, 0.4, -0.19, 0.56, 0.62, 0.04, C.crimson);
      v.box(0, 0.86, 0, 0.58, 0.14, 0.38, C.crimson);
      v.box(0, 0.55, -0.32, 0.16, 0.16, 0.3, C.fur, { rx: 0.6, center: true });
      mirror((s) => {
        v.box(s * 0.31, 0.5, 0, 0.12, 0.4, 0.16, C.fur);
        v.box(s * 0.31, 0.46, 0.02, 0.13, 0.05, 0.17, C.shade);
      });
      // faceted red decanter in the right paw
      v.box(-0.33, 0.3, 0.16, 0.16, 0.14, 0.16, C.crimson, { ry: Math.PI / 4 });
      v.box(-0.33, 0.44, 0.16, 0.06, 0.09, 0.06, C.crimson);
      v.box(-0.33, 0.53, 0.16, 0.09, 0.08, 0.09, C.dark);
    },
    headAt: [0, 0.98, 0.02],
    head: (v) => {
      v.box(0, -0.06, -0.02, 0.52, 0.14, 0.46, C.shade);
      v.box(0, 0, 0, 0.46, 0.4, 0.42, C.fur);
      v.box(0, 0.02, 0.26, 0.24, 0.16, 0.18, C.pale);
      v.box(0, 0.14, 0.35, 0.08, 0.05, 0.03, C.nose);
      mirror((s) => {
        v.box(s * 0.14, 0.38, -0.04, 0.1, 0.2, 0.08, C.fur);
        v.box(s * 0.14, 0.41, 0.0, 0.05, 0.12, 0.01, C.crimson);
        v.box(s * 0.11, 0.22, 0.212, 0.07, 0.05, 0.02, C.eye);
      });
    },
  });
}

/** 에이다: the gentle smiling king from the portrait, long blond hair, red ermine cape and a gold scepter. */
function eidaRig() {
  const C = {
    skin: '#f6d7b8', hair: '#f0d58a', gold: '#d4a53a', red: '#b3262e', gem: '#d6283a',
    ermine: '#fbf8f2', fleck: '#222222', tunic: '#3f8f5a', hose: '#f2ebdc', boot: '#6b4430',
    eye: '#5a3b2a', mouth: '#b5564a', blush: '#f2a7a0',
  };
  return buildRig('mystery:eida', {
    legsAt: twoLegs(0.12, 0.42),
    leg: (v) => {
      v.box(0, -0.42, 0.03, 0.18, 0.14, 0.24, C.boot);
      v.box(0, -0.28, 0, 0.16, 0.28, 0.18, C.hose);
    },
    body: (v) => {
      v.box(0, 0.42, 0, 0.5, 0.58, 0.32, C.tunic);
      v.box(0, 0.56, 0, 0.52, 0.06, 0.34, C.gold);
      v.box(0, 0.36, -0.18, 0.6, 0.66, 0.05, C.red);
      v.box(0, 0.34, -0.18, 0.62, 0.06, 0.07, C.ermine);
      v.box(0, 0.92, 0, 0.62, 0.12, 0.4, C.ermine);
      for (const x of [-0.18, 0, 0.18]) v.box(x, 0.96, 0.201, 0.03, 0.04, 0.01, C.fleck);
      mirror((s) => {
        v.box(s * 0.29, 0.36, -0.02, 0.05, 0.64, 0.3, C.red);
        v.box(s * 0.3, 0.6, 0.02, 0.12, 0.36, 0.16, C.tunic);
        v.box(s * 0.3, 0.53, 0.03, 0.11, 0.08, 0.12, C.skin);
      });
      // scepter in the right hand
      v.box(-0.34, 0.3, 0.16, 0.05, 0.75, 0.05, C.gold);
      v.box(-0.34, 1.05, 0.16, 0.12, 0.12, 0.12, C.gold);
      v.box(-0.34, 1.08, 0.16, 0.06, 0.06, 0.13, C.gem);
    },
    headAt: [0, 1.0, 0],
    head: (v) => {
      v.box(0, 0, 0, 0.44, 0.42, 0.4, C.skin);
      v.box(0, 0.36, -0.02, 0.48, 0.12, 0.44, C.hair);
      v.box(0, -0.3, -0.21, 0.5, 0.72, 0.08, C.hair);
      v.box(0, 0.3, 0.205, 0.44, 0.08, 0.03, C.hair);
      mirror((s) => {
        v.box(s * 0.23, -0.2, -0.04, 0.05, 0.58, 0.34, C.hair);
        v.box(s * 0.1, 0.17, 0.205, 0.08, 0.025, 0.01, C.eye);
        v.box(s * 0.16, 0.1, 0.205, 0.07, 0.04, 0.01, C.blush);
        v.box(s * 0.16, 0.52, 0.17, 0.06, 0.1, 0.04, C.gold);
      });
      v.box(0, 0.07, 0.205, 0.08, 0.025, 0.01, C.mouth);
      // crown
      v.box(0, 0.48, 0, 0.34, 0.1, 0.3, C.red);
      v.box(0, 0.44, 0, 0.42, 0.08, 0.38, C.gold);
      v.box(0, 0.52, 0.17, 0.06, 0.14, 0.04, C.gold);
      v.box(0, 0.46, 0.195, 0.06, 0.05, 0.01, C.gem);
    },
  });
}

/** 괴조는 깊은 탄식의 끝에: the pale grey giant bird of the cover, long feathers drooping to the ground. */
function giantbirdRig() {
  const C = {
    feather: '#d6d2cf', light: '#ece9e6', shadow: '#8f8a86', dark: '#4a4644', talon: '#2a2826',
    teal: '#3d5c4c',
  };
  return buildRig('mystery:giantbird', {
    legsAt: twoLegs(0.14, 0.5),
    leg: (v) => {
      v.box(0, -0.5, 0, 0.08, 0.5, 0.08, C.talon);
      v.box(0, -0.5, 0.06, 0.22, 0.05, 0.24, C.talon);
      v.box(0, -0.5, -0.1, 0.06, 0.05, 0.12, C.talon);
    },
    body: (v) => {
      v.box(0, 0.5, 0, 0.62, 0.6, 0.7, C.feather);
      v.box(0, 0.62, -0.05, 0.7, 0.4, 0.62, C.feather);
      v.box(0, 0.6, 0.351, 0.4, 0.42, 0.02, C.light);
      v.box(0, 0.4, -0.5, 0.36, 0.08, 0.5, C.shadow, { rx: 0.4, center: true });
      mirror((s) => {
        v.box(s * 0.38, 0.32, -0.05, 0.1, 0.8, 0.6, C.feather);
        v.box(s * 0.38, 0.12, -0.12, 0.08, 0.3, 0.42, C.shadow);
        v.box(s * 0.38, 0.02, -0.24, 0.06, 0.2, 0.2, C.dark);
        v.box(s * 0.381, 0.4, 0.12, 0.1, 0.5, 0.02, C.light);
      });
    },
    headAt: [0, 1.1, 0.12],
    head: (v) => {
      v.box(0, 0, 0, 0.26, 0.3, 0.26, C.light);
      v.box(0, 0.26, 0.04, 0.34, 0.3, 0.38, C.feather);
      v.box(0, 0.5, -0.14, 0.12, 0.12, 0.3, C.shadow, { rx: -0.5, center: true });
      v.box(0, 0.3, 0.3, 0.12, 0.1, 0.2, C.dark);
      v.box(0, 0.24, 0.39, 0.08, 0.08, 0.06, C.dark);
      mirror((s) => v.box(s * 0.171, 0.38, 0.12, 0.02, 0.07, 0.07, C.teal));
    },
  });
}

/** 용사가 죽었다: the cover's sepia hero, sword still stuck in his back, X for eyes. */
function heroRig() {
  const C = {
    skin: '#e6dcc6', hair: '#2b2117', tunic: '#6e5a40', armor: '#8a7656', cloak: '#3a2e21',
    pants: '#4a3b2a', boot: '#2a2018', steel: '#9c8f7a', hilt: '#2b2117', drip: '#1e0908', ink: '#2b2117',
  };
  const sword = { rx: -0.7, rz: -0.3, center: true };
  return buildRig('mystery:hero', {
    legsAt: twoLegs(0.12, 0.45),
    leg: (v) => {
      v.box(0, -0.45, 0, 0.16, 0.45, 0.18, C.pants);
      v.box(0, -0.45, 0.03, 0.18, 0.16, 0.24, C.boot);
    },
    body: (v) => {
      v.box(0, 0.45, 0, 0.5, 0.58, 0.32, C.tunic);
      v.box(0, 0.58, 0, 0.52, 0.06, 0.34, C.boot);
      v.box(0, 0.72, 0.161, 0.34, 0.26, 0.02, C.armor);
      v.box(0, 0.32, -0.19, 0.58, 0.74, 0.05, C.cloak);
      v.box(0, 0.94, -0.02, 0.6, 0.12, 0.38, C.cloak);
      mirror((s) => {
        v.box(s * 0.3, 0.6, 0, 0.12, 0.38, 0.16, C.tunic);
        v.box(s * 0.3, 0.53, 0.01, 0.11, 0.08, 0.12, C.skin);
      });
      // the sword in his back, and what drips from it
      v.box(0.12, 0.98, -0.36, 0.05, 0.5, 0.03, C.steel, sword);
      v.box(0.177, 1.163, -0.521, 0.22, 0.05, 0.05, C.hilt, sword);
      v.box(0.195, 1.221, -0.572, 0.05, 0.14, 0.05, C.hilt, sword);
      v.box(0.215, 1.287, -0.63, 0.08, 0.08, 0.08, C.hilt, sword);
      v.box(0.06, 0.55, -0.216, 0.04, 0.22, 0.01, C.drip);
      v.box(0.12, 0.62, -0.216, 0.03, 0.14, 0.01, C.drip);
    },
    headAt: [0, 1.03, 0],
    head: (v) => {
      v.box(0, 0, 0, 0.44, 0.42, 0.4, C.skin);
      v.box(0, 0.34, -0.02, 0.48, 0.14, 0.44, C.hair);
      v.box(-0.12, 0.44, 0.05, 0.1, 0.08, 0.1, C.hair);
      v.box(0.1, 0.46, -0.05, 0.1, 0.06, 0.1, C.hair);
      v.box(0, 0.08, -0.21, 0.46, 0.3, 0.05, C.hair);
      mirror((s) => {
        v.box(s * 0.1, 0.19, 0.205, 0.1, 0.025, 0.01, C.ink, { rz: Math.PI / 4, center: true });
        v.box(s * 0.1, 0.19, 0.205, 0.1, 0.025, 0.01, C.ink, { rz: -Math.PI / 4, center: true });
      });
      v.box(0, 0.07, 0.205, 0.1, 0.02, 0.01, C.ink);
    },
  });
}

/** 서스펙트 게임: a hooded suspect, face lost in shadow, edges lit by the cover's red and cyan neon. */
function suspectRig() {
  const C = {
    hood: '#1d1e24', darker: '#121317', shadow: '#0b0b0e', jeans: '#24252c', shoe: '#111111',
    string: '#d9d9df', eye: '#e9e6f0', red: '#d0402a', cyan: '#3fa0d8',
  };
  const neon = (s) => (s < 0 ? C.red : C.cyan);
  return buildRig('mystery:suspect', {
    legsAt: twoLegs(0.12, 0.45),
    leg: (v) => {
      v.box(0, -0.45, 0, 0.16, 0.45, 0.18, C.jeans);
      v.box(0, -0.45, 0.03, 0.18, 0.1, 0.24, C.shoe);
    },
    body: (v) => {
      v.box(0, 0.42, 0, 0.52, 0.62, 0.34, C.hood);
      v.box(0, 0.5, 0.171, 0.32, 0.14, 0.02, C.darker);
      mirror((s) => {
        v.box(s * 0.262, 0.44, 0, 0.01, 0.58, 0.3, neon(s));
        v.box(s * 0.3, 0.52, 0.02, 0.12, 0.46, 0.16, C.hood);
        v.box(s * 0.361, 0.54, 0.02, 0.01, 0.42, 0.14, neon(s));
        v.box(s * 0.06, 0.82, 0.171, 0.025, 0.16, 0.01, C.string);
      });
    },
    headAt: [0, 1.04, 0],
    head: (v) => {
      v.box(0, 0, -0.06, 0.5, 0.5, 0.38, C.hood);
      v.box(0, 0.05, 0.135, 0.4, 0.38, 0.01, C.shadow);
      v.box(0, 0.43, 0.18, 0.5, 0.07, 0.1, C.hood);
      v.box(0, 0, 0.18, 0.5, 0.05, 0.1, C.hood);
      mirror((s) => {
        v.box(s * 0.225, 0, 0.18, 0.05, 0.5, 0.1, C.hood);
        v.box(s * 0.08, 0.22, 0.142, 0.06, 0.03, 0.01, C.eye);
        v.box(s * 0.252, 0.05, -0.02, 0.01, 0.4, 0.4, neon(s));
      });
    },
  });
}

const RIGS = {
  holdem: holdemRig, kraken: krakenRig, codenames: codenamesRig, lasvegas: lasvegasRig, cloud: cloudRig,
  wendy: wendyRig, bluemoon: bluemoonRig, werewolf: werewolfRig, eida: eidaRig,
  giantbird: giantbirdRig, hero: heroRig, suspect: suspectRig,
};

/** Rig for an animal, a game character or the club cloud. Non-animals ignore missing variants. */
export function createCritterRig(type, variant) {
  if (RIGS[type]) {
    const variants = critterDef(type).variants;
    return RIGS[type](variants[variant] || Object.values(variants)[0]);
  }
  return createAnimalRig(type, variant);
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
