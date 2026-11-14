import * as THREE from 'three';
import { Voxels } from './voxel.js';
import { makeRng } from './rng.js';
import { GAMES, createCritterRig, critterDef, FLOWER_COLORS } from './models.js';
import { addPad } from './world.js';

// The inside of a farm's house: one room in a scene of its own. The room is larger than the
// house looks from outside, and its front wall is cut low so the camera can see in.
// The room is built from the owner's name alone, so it never touches the farm's own sequence.

const W = 11;
const D = 9;
const WALL = 4.2;
const DOOR = 1.0; // half width of the doorway in the front wall

const WOOD = '#b98657';
const WOOD_DARK = '#8a6040';

const mix = (a, b, t) => `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;

/** How each kind of house looks inside. `accent` colors the rug, the blanket and the curtains. */
function theme(st) {
  const base = {
    wall: mix(st.wall, '#ffffff', 0.25), wallAlt: mix(st.wall, '#ffffff', 0.55), pattern: 'stripes',
    floor: '#c99b68', floorAlt: '#b3855a', trim: '#fbf6ee', accent: st.roof, feature: 'fireplace',
    hearth: '#b0645a', korean: false,
  };
  switch (st.kind) {
    case 'barn':
      return { ...base, wall: '#d6ae80', wallAlt: '#b08457', pattern: 'planks', floor: '#a47d54', floorAlt: '#8c6841', trim: WOOD_DARK, accent: st.wall, feature: 'loft' };
    case 'log':
      return { ...base, wall: '#b07a4e', wallAlt: '#9a683f', pattern: 'logs', trim: '#5f4129', hearth: '#9a958c' };
    case 'stone':
      return { ...base, wall: '#c2bcae', wallAlt: '#a8a296', pattern: 'stones', floor: '#a9a297', floorAlt: '#938c81', trim: WOOD_DARK, accent: st.roof === '#d9b65a' ? '#c0563f' : st.roof, hearth: '#8f8a80' };
    case 'mushroom':
      return { ...base, wall: '#fbf3df', wallAlt: mix(st.roof, '#ffffff', 0.55), pattern: 'dots', floor: '#d9b98a', floorAlt: '#c4a273', feature: 'mushrooms' };
    case 'twostory':
      return { ...base, feature: 'stairs' };
    case 'hanok':
      return { ...base, wall: '#f5edd6', wallAlt: '#6b4a32', pattern: 'lattice', floor: '#e2c98a', floorAlt: '#cdb173', trim: '#6b4a32', accent: '#c0563f', feature: 'wardrobe', korean: true };
    default:
      return base;
  }
}

// Light inside the room for each time of day. `lamp` is how bright the lamp and the fire are.
const LIGHT = {
  morning: { hemi: '#fff1dc', ground: '#b79f84', hemiI: 1.55, sun: '#ffe2bd', sunI: 1.7, glass: '#cfeaf7', lamp: 0, bg: '#3a3140' },
  day: { hemi: '#ffffff', ground: '#b79f84', hemiI: 1.7, sun: '#ffffff', sunI: 1.9, glass: '#bfe3f2', lamp: 0, bg: '#3a3140' },
  evening: { hemi: '#ffd9b8', ground: '#a08872', hemiI: 1.25, sun: '#ffb47e', sunI: 1.3, glass: '#ffb98a', lamp: 0.6, bg: '#2f2636' },
  night: { hemi: '#8f9cd0', ground: '#3a3040', hemiI: 0.8, sun: '#a9bcff', sunI: 0.4, glass: '#1c2a55', lamp: 1, bg: '#1b1524' },
};

/**
 * Builds the room for `farm`. The result works like the town for the player: it has
 * `colliders`, `animals`, `bounds` and `interactables`, plus its own `scene`.
 */
export function buildHome(farm) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(LIGHT.day.bg);
  const rng = makeRng(`${farm.owner}|home`);
  const th = theme(farm.style);
  const s = rng.sign(); // the bed's side; everything else is laid out around it
  const v = new Voxels();
  const glass = new Voxels();
  const glow = new Voxels();
  const fire = new Voxels();
  const colliders = [];
  const interactables = [];
  const add = (cx, cz, w, d, h = 10) => colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, h });

  // --- floor ---
  v.box(0, -0.4, 0.5, W + 0.8, 0.4, D + 1.8, th.floor);
  if (th.korean) {
    // oiled paper floor, laid in large sheets
    for (let x = -W / 2 + 1.83; x < W / 2 - 0.1; x += 1.83) v.box(x, 0, 0, 0.04, 0.012, D, th.floorAlt);
    for (let z = -D / 2 + 1.5; z < D / 2 - 0.1; z += 1.5) v.box(0, 0, z, W, 0.012, 0.04, th.floorAlt);
  } else {
    for (let i = 0; i * 0.75 < D; i++) {
      const z = -D / 2 + i * 0.75;
      if (i) v.box(0, 0, z, W, 0.012, 0.05, th.floorAlt);
      for (let x = -W / 2 + (i % 2 ? 1.4 : 2.9); x < W / 2; x += 3) v.box(x, 0, z + 0.375, 0.05, 0.012, 0.75, th.floorAlt);
    }
  }

  // --- walls: full height at the back, stepping down to a low front wall ---
  v.box(0, 0, -D / 2 - 0.2, W + 0.8, WALL, 0.4, th.wall);
  for (const sx of [-1, 1]) {
    const x = sx * (W / 2 + 0.2);
    v.box(x, 0, -1, 0.4, WALL, 7, th.wall);
    v.box(x, 0, 3, 0.4, 2.4, 1, th.wall);
    v.box(x, 0, 4.2, 0.4, 1.2, 1.4, th.wall);
    // front wall beside the doorway
    v.box(sx * (DOOR + (W / 2 - DOOR) / 2 + 0.2), 0, D / 2 + 0.2, W / 2 - DOOR + 0.4, 0.55, 0.4, th.wall);
    v.box(sx * (DOOR + 0.12), 0, D / 2 + 0.2, 0.3, 1.0, 0.46, th.trim);
    v.box(sx * (DOOR + 0.12), 1.0, D / 2 + 0.2, 0.4, 0.12, 0.56, th.trim);
    add(sx * (DOOR + (W / 2 - DOOR) / 2 + 0.25), D / 2 + 0.25, W / 2 - DOOR + 0.5, 0.5);
    add(sx * (W / 2 + 0.25), 0, 0.5, D + 2);
  }
  add(0, -D / 2 - 0.25, W + 1, 0.5);
  // wall caps
  v.box(0, WALL, -D / 2 - 0.2, W + 0.9, 0.1, 0.5, th.trim);
  mirror((sx) => v.box(sx * (W / 2 + 0.2), WALL, -1, 0.5, 0.1, 7.1, th.trim));

  // Wall decoration goes on the back wall and on the tall part of both side walls.
  // `put(u, y, w, h, color)` places a thin tile at `u` along the wall.
  const faces = [
    { from: -W / 2, to: W / 2, put: (u, y, w, h, color, t = 0.03) => v.box(u, y, -D / 2 + t / 2, w, h, t, color) },
    ...[-1, 1].map((sx) => ({ from: -D / 2, to: 2.5, put: (u, y, w, h, color, t = 0.03) => v.box(sx * (W / 2 - t / 2), y, u, t, h, w, color) })),
  ];
  for (const f of faces) wallPattern(f, th, rng);

  // --- windows: one on the back wall, one on each side wall ---
  const pane = (place, u, y, w, h) => {
    place(v, u, y - 0.12, w + 0.3, 0.12, th.trim, 0.14);
    place(v, u, y, w + 0.24, h + 0.12, th.trim, 0.06);
    place(glass, u, y + 0.06, w, h, '#ffffff', 0.08);
    place(v, u, y + 0.06, 0.08, h, th.trim, 0.1);
    place(v, u, y + 0.06 + h / 2 - 0.04, w, 0.08, th.trim, 0.1);
    if (!th.korean && th.pattern !== 'planks') {
      // curtains
      place(v, u - w / 2 - 0.05, y - 0.05, 0.3, h + 0.3, th.accent, 0.12);
      place(v, u + w / 2 + 0.05, y - 0.05, 0.3, h + 0.3, th.accent, 0.12);
      place(v, u, y + h + 0.18, w + 0.7, 0.1, WOOD_DARK, 0.14);
    }
  };
  const onBack = (vox, u, y, w, h, color, t) => vox.box(u, y, -D / 2 + t / 2, w, h, t, color);
  const onSide = (sx) => (vox, u, y, w, h, color, t) => vox.box(sx * (W / 2 - t / 2), y, u, t, h, w, color);
  pane(onBack, s * 1.55, 1.55, 1.3, 1.3);
  pane(onSide(-1), -0.9, 1.55, 1.5, 1.3);
  pane(onSide(1), -0.9, 1.55, 1.5, 1.3);

  // --- bed ---
  const bedX = s * 4.3;
  if (th.korean) {
    // bedding laid on the warm floor
    v.box(bedX, 0, -2.6, 2.0, 0.14, 3.1, '#fbf6ee');
    v.box(bedX, 0.14, -2.2, 2.04, 0.12, 2.1, th.accent);
    v.box(bedX, 0.26, -2.2, 2.04, 0.02, 0.5, '#f2c12e');
    v.box(bedX, 0.14, -3.75, 1.1, 0.2, 0.42, '#3f6f7a');
    mirror((e) => v.box(bedX + e * 0.6, 0.16, -3.75, 0.1, 0.16, 0.44, '#f2c12e'));
  } else {
    v.box(bedX, 0, -2.85, 2.2, 0.45, 3.1, WOOD);
    v.box(bedX, 0, -4.35, 2.2, 1.35, 0.22, WOOD_DARK);
    v.box(bedX, 0, -1.33, 2.2, 0.7, 0.16, WOOD_DARK);
    v.box(bedX, 0.45, -2.85, 2.0, 0.25, 2.9, '#fbf6ee');
    v.box(bedX, 0.7, -2.35, 2.04, 0.12, 1.9, th.accent);
    v.box(bedX, 0.82, -3.2, 2.04, 0.02, 0.2, mix(th.accent, '#ffffff', 0.5));
    v.box(bedX, 0.7, -3.85, 1.3, 0.2, 0.6, '#ffffff');
    add(bedX, -2.85, 2.2, 3.1, 1.2);
  }

  // --- bedside table and lamp ---
  const lampX = s * 2.85;
  const lampZ = -4.05;
  v.box(lampX, 0, lampZ, 0.7, th.korean ? 0.4 : 0.7, 0.7, WOOD_DARK);
  const lampY = th.korean ? 0.4 : 0.7;
  v.box(lampX, lampY, lampZ, 0.22, 0.08, 0.22, '#5c5148');
  v.box(lampX, lampY + 0.08, lampZ, 0.07, 0.34, 0.07, '#5c5148');
  if (th.korean) {
    // paper lantern
    glow.box(lampX, lampY + 0.36, lampZ, 0.4, 0.5, 0.4, '#ffffff');
    v.box(lampX, lampY + 0.86, lampZ, 0.46, 0.05, 0.46, '#6b4a32');
  } else {
    glow.box(lampX, lampY + 0.4, lampZ, 0.5, 0.2, 0.5, '#ffffff');
    glow.box(lampX, lampY + 0.6, lampZ, 0.36, 0.18, 0.36, '#ffffff');
  }
  add(lampX, lampZ, 0.7, 0.7, 1.4);

  // --- shelf with the games played together ---
  const shelfX = -s * 0.75;
  const shelfZ = -4.18;
  const shelfWood = th.korean ? '#6b4a32' : WOOD_DARK;
  v.box(shelfX, 0, shelfZ - 0.28, 2.6, 2.6, 0.06, mix(shelfWood, '#000000', 0.2));
  mirror((e) => v.box(shelfX + e * 1.27, 0, shelfZ, 0.12, 2.6, 0.6, shelfWood));
  const rows = [1.72, 0.92, 0.12];
  for (const y of [0, 0.8, 1.6, 2.5]) v.box(shelfX, y, shelfZ, 2.6, 0.12, 0.6, shelfWood);
  add(shelfX, shelfZ, 2.6, 0.6);
  const figures = new THREE.Group();
  const slots = [];
  for (const y of rows) for (const dx of [-0.9, -0.3, 0.3, 0.9]) slots.push({ x: shelfX + dx, y });
  let used = 0;
  for (const g of farm.games) {
    const variants = Object.keys(GAMES[g.type].variants);
    for (let k = 0; k < g.count && used < slots.length; k++) {
      // The same pick as on the pasture, so the shelf shows the farm's own characters.
      const variant = makeRng(`${farm.owner}|${g.type}|${k}`).pick(variants);
      const rig = createCritterRig(g.type, variant).root;
      const def = critterDef(g.type);
      rig.scale.setScalar(Math.min(0.58 / (def.bubbleY || 2), 0.22 / def.radius));
      rig.position.set(slots[used].x, slots[used].y, shelfZ + 0.02);
      rig.rotation.y = rng.range(-0.25, 0.25);
      figures.add(rig);
      used += 1;
    }
  }
  // Plain game boxes fill what is left of the bottom row.
  const boxColors = ['#d9573f', '#4e7fc4', '#5a9b56', '#f2c12e', '#8c62b8'];
  for (let i = Math.max(used, 8); i < slots.length; i++) {
    const n = rng.int(1, 3);
    for (let k = 0; k < n; k++) v.box(slots[i].x, slots[i].y + k * 0.15, shelfZ, rng.range(0.38, 0.48), 0.14, 0.42, rng.pick(boxColors));
  }
  scene.add(figures);

  // --- the feature of this kind of house, in the back corner away from the bed ---
  const fx = -s * 3.95;
  const lights = [];
  FEATURES[th.feature]({ v, glow, fire, add, lights, th, st: farm.style, rng, fx, dir: -s });

  // --- table with the guestbook ---
  const tx = -s * 2.6;
  const tz = 1.25;
  const topY = th.korean ? 0.36 : 0.74;
  v.box(tx, topY, tz, 1.9, 0.12, 1.15, th.korean ? '#6b4a32' : WOOD);
  for (const ex of [-1, 1]) for (const ez of [-1, 1]) v.box(tx + ex * 0.8, 0, tz + ez * 0.44, 0.14, topY, 0.14, th.korean ? '#573a26' : WOOD_DARK);
  add(tx, tz, 1.9, 1.15, topY + 0.2);
  const seat = (x, z) => {
    if (th.korean) v.box(x, 0, z, 0.7, 0.1, 0.7, rng.pick(['#c0563f', '#3f6f7a', '#f2c12e']));
    else {
      v.box(x, 0.38, z, 0.52, 0.1, 0.52, WOOD);
      for (const ex of [-1, 1]) for (const ez of [-1, 1]) v.box(x + ex * 0.18, 0, z + ez * 0.18, 0.1, 0.38, 0.1, WOOD_DARK);
      add(x, z, 0.5, 0.5, 0.5);
    }
  };
  seat(tx - 0.45, tz + 1.05);
  seat(tx + 0.5, tz - 1.05);
  // the guestbook, open on the table
  const by = topY + 0.12;
  const bookX = tx + s * 0.25;
  v.box(bookX, by, tz, 0.78, 0.05, 0.54, th.accent);
  mirror((e) => v.box(bookX + e * 0.19, by + 0.05, tz, 0.35, 0.05, 0.48, '#fffdf5'));
  for (let k = 0; k < 3; k++) v.box(bookX - 0.19, by + 0.1, tz - 0.12 + k * 0.12, 0.24, 0.006, 0.03, '#b9b1a3');
  v.box(bookX + 0.3, by + 0.1, tz + 0.05, 0.05, 0.012, 0.36, '#d9573f');
  // a small vase at the other end
  v.box(tx - s * 0.62, by, tz - 0.2, 0.2, 0.24, 0.2, '#8ecae6');
  v.box(tx - s * 0.62, by + 0.24, tz - 0.2, 0.05, 0.2, 0.05, '#5fae4f');
  v.box(tx - s * 0.62, by + 0.42, tz - 0.2, 0.2, 0.16, 0.2, rng.pick(FLOWER_COLORS));
  interactables.push({ kind: 'book', x: bookX, z: tz, r: 1.9 });

  // --- rug ---
  const rx = s * 1.5;
  const rz = 0.9;
  v.box(rx, 0, rz, 4.2, 0.03, 2.8, th.accent);
  v.box(rx, 0.03, rz, 3.7, 0.012, 2.3, mix(th.accent, '#ffffff', 0.72));
  if (th.pattern === 'dots') {
    for (let k = 0; k < 9; k++) v.box(rx + rng.range(-1.5, 1.5), 0.042, rz + rng.range(-0.9, 0.9), 0.4, 0.008, 0.4, th.accent);
  } else {
    v.box(rx, 0.042, rz, 3.1, 0.008, 1.7, mix(th.accent, '#ffffff', 0.35));
    v.box(rx, 0.05, rz, 2.6, 0.008, 1.2, mix(th.accent, '#ffffff', 0.72));
  }

  // --- plants ---
  const plant = (x, z, tall) => {
    v.box(x, 0, z, 0.5, 0.42, 0.5, '#c7714f');
    v.box(x, 0.42, z, 0.56, 0.08, 0.56, '#b0603f');
    const h = tall ? 1.0 : 0.5;
    v.box(x, 0.5, z, 0.1, h, 0.1, '#4f8f45');
    for (let k = 0; k < (tall ? 7 : 5); k++) {
      v.box(x + rng.range(-0.28, 0.28), 0.6 + rng.range(0, h), z + rng.range(-0.28, 0.28), 0.3, 0.26, 0.3, rng.pick(['#5fae4f', '#6dbb58', '#55a449']));
    }
    if (!tall) v.box(x, 0.5 + h + 0.1, z, 0.22, 0.2, 0.22, rng.pick(FLOWER_COLORS));
    add(x, z, 0.5, 0.5, 1.2);
  };
  plant(s * 5.05, -0.85, true);
  plant(-s * 5.0, 3.3, false);
  if (th.feature === 'loft') {
    // a couple of hay bales by the door
    hayBale(v, s * 4.7, 3.4);
    hayBale(v, s * 4.6, 3.38, 0.72);
    add(s * 4.7, 3.4, 1.2, 0.9, 1.5);
  } else {
    plant(s * 5.0, 3.5, rng.chance(0.5));
  }

  // --- doormat and the way out ---
  v.box(0, 0, D / 2 + 0.1, DOOR * 2, 0.02, 1.9, th.floorAlt);
  const pad = new Voxels();
  addPad(pad, 0, D / 2 - 1.0, 0.02);

  // --- meshes ---
  scene.add(v.mesh());
  const glassMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  scene.add(glass.mesh(glassMat, { cast: false, receive: false }));
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const glowMesh = glow.mesh(glowMat, { cast: false, receive: false });
  if (glowMesh) scene.add(glowMesh);
  const fireMesh = fire.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }), { cast: false, receive: false });
  if (fireMesh) scene.add(fireMesh);
  const padMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  scene.add(pad.mesh(padMat, { cast: false, receive: false }));
  const sparkles = [];
  for (let k = 0; k < 5; k++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: '#fffbe0' }));
    scene.add(m);
    sparkles.push(m);
  }

  // --- lights ---
  const hemi = new THREE.HemisphereLight('#ffffff', '#b79f84', 1.7);
  const sun = new THREE.DirectionalLight('#ffffff', 1.9);
  sun.position.set(5, 13, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.camera.updateProjectionMatrix();
  const lamp = new THREE.PointLight('#ffcf8a', 0, 15, 1.4);
  lamp.position.set(lampX, 2.1, lampZ + 0.8);
  scene.add(hemi, sun, sun.target, lamp);
  const fireLights = lights.map(({ x, y, z, color = '#ff9d4a' }) => {
    const l = new THREE.PointLight(color, 0, 11, 1.4);
    l.position.set(x, y, z);
    scene.add(l);
    return l;
  });
  let level = 0;

  return {
    scene, colliders, interactables, animals: [],
    bounds: { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2 + 1.3 },
    /** Where the player stands after walking in. */
    spawn: { x: 0, z: D / 2 - 0.2 },
    /** Walking past this line through the doorway leaves the house. */
    exitZ: D / 2 + 0.55,
    setTime(key) {
      const p = LIGHT[key] || LIGHT.day;
      scene.background.set(p.bg);
      hemi.color.set(p.hemi);
      hemi.groundColor.set(p.ground);
      hemi.intensity = p.hemiI;
      sun.color.set(p.sun);
      sun.intensity = p.sunI;
      glassMat.color.set(p.glass);
      glowMat.color.set('#ffe2a0').multiplyScalar(0.72 + 0.28 * p.lamp);
      lamp.intensity = p.lamp * 18;
      if (fireMesh) fireMesh.visible = p.lamp > 0;
      level = p.lamp;
    },
    update(dt, t) {
      padMat.color.setScalar(0.9 + 0.1 * Math.sin(t * 2.2));
      sparkles.forEach((m, k) => {
        const phase = (t * 0.45 + k / sparkles.length) % 1;
        m.position.set(Math.cos(k * 2.4) * 0.5, 0.1 + phase * 1.5, D / 2 - 1.0 + Math.sin(k * 2.4) * 0.5);
        m.scale.setScalar(Math.sin(phase * Math.PI));
      });
      const flicker = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3);
      if (fireMesh) fireMesh.scale.y = 0.9 + 0.2 * Math.sin(t * 7);
      for (const l of fireLights) l.intensity = level * 11 * flicker;
    },
  };
}

function mirror(fn) {
  fn(-1);
  fn(1);
}

function hayBale(v, x, z, y = 0) {
  v.box(x, y, z, 1.1, 0.72, 0.8, '#e2c15a', { jitter: 0.03 });
  for (const e of [-0.3, 0.3]) v.box(x + e, y, z, 0.07, 0.74, 0.82, '#b99a3e');
}

/** Wallpaper, planks, logs, stones, dots or paper lattice on one wall face. */
function wallPattern({ from, to, put }, th, rng) {
  const len = to - from;
  const mid = (from + to) / 2;
  if (th.pattern === 'stripes') {
    for (let u = from + 0.4; u < to; u += 0.8) put(u, 1.15, 0.3, WALL - 1.15, th.wallAlt);
    put(mid, 0, len, 1.05, th.trim, 0.05);
    put(mid, 1.05, len, 0.1, mix(th.trim, '#8a6040', 0.25), 0.08);
  } else if (th.pattern === 'planks') {
    for (let u = from + 0.55; u < to; u += 0.55) put(u, 0, 0.05, WALL, th.wallAlt);
    put(mid, 2.3, len, 0.22, th.trim, 0.1);
    put(mid, 0, len, 0.25, th.trim, 0.06);
  } else if (th.pattern === 'logs') {
    for (let y = 0.42; y < WALL; y += 0.84) put(mid, y, len, 0.42, th.wallAlt);
    for (let y = 0.4; y < WALL; y += 0.42) put(mid, y, len, 0.03, '#7d5231', 0.04);
  } else if (th.pattern === 'stones') {
    const n = Math.round(len * 4.5);
    for (let k = 0; k < n; k++) {
      put(rng.range(from + 0.4, to - 0.4), rng.range(0.1, WALL - 0.45), rng.range(0.45, 0.85), rng.range(0.25, 0.4), rng.pick([th.wallAlt, '#d0cabd', '#b3ad9f']));
    }
  } else if (th.pattern === 'dots') {
    const n = Math.round(len * 1.6);
    for (let k = 0; k < n; k++) {
      const d = rng.range(0.22, 0.4);
      put(rng.range(from + 0.4, to - 0.4), rng.range(1.3, WALL - 0.5), d, d, th.wallAlt);
    }
    put(mid, 0, len, 1.05, th.wallAlt, 0.05);
    put(mid, 1.05, len, 0.1, th.trim, 0.08);
  } else if (th.pattern === 'lattice') {
    // wooden posts and rails with paper between them
    for (let u = from; u <= to + 0.01; u += len / Math.round(len / 2.75)) put(Math.min(to - 0.14, Math.max(from + 0.14, u)), 0, 0.28, WALL, th.wallAlt, 0.1);
    put(mid, 0, len, 0.3, th.wallAlt, 0.08);
    put(mid, 3.2, len, 0.2, th.wallAlt, 0.08);
    put(mid, WALL - 0.22, len, 0.22, th.wallAlt, 0.08);
    for (let u = from + 0.46; u < to; u += 0.46) put(u, 3.4, 0.04, WALL - 3.62, th.wallAlt);
  }
}

// Each feature fills the back corner around x = fx: about 2.4 wide and 1.2 deep.
// `dir` points from the corner toward the nearest side wall (-1 or 1).
const FEATURES = {
  fireplace({ v, fire, add, lights, th, fx }) {
    const c = th.hearth;
    const dark = mix(c, '#000000', 0.25);
    v.box(fx, 0, -4.1, 2.3, 2.0, 0.8, c, { jitter: 0.03 });
    v.box(fx, 2.0, -4.28, 1.5, WALL - 2.0, 0.44, c, { jitter: 0.03 });
    v.box(fx, 2.0, -4.02, 2.6, 0.16, 1.0, WOOD_DARK);
    v.box(fx, 0, -3.72, 1.3, 1.15, 0.06, '#241a18');
    v.box(fx, 0, -3.45, 2.3, 0.1, 0.6, dark);
    for (let i = 0; i < 5; i++) v.box(fx - 0.92 + i * 0.46, 1.4 + (i % 2) * 0.3, -3.69, 0.4, 0.24, 0.03, dark);
    // logs and fire
    v.box(fx - 0.2, 0.1, -3.6, 0.7, 0.16, 0.18, '#6b4a32');
    v.box(fx + 0.2, 0.1, -3.5, 0.7, 0.16, 0.18, '#7a5334');
    fire.box(fx, 0.24, -3.56, 0.5, 0.4, 0.14, '#ff8a2b');
    fire.box(fx - 0.08, 0.3, -3.52, 0.26, 0.5, 0.1, '#ffd34d');
    fire.box(fx + 0.2, 0.26, -3.58, 0.18, 0.3, 0.1, '#ffb03a');
    // things on the mantel
    v.box(fx - 0.8, 2.16, -4.0, 0.2, 0.42, 0.2, '#8ecae6');
    v.box(fx + 0.7, 2.16, -4.0, 0.5, 0.36, 0.08, '#fbf6ee');
    v.box(fx + 0.7, 2.2, -3.95, 0.4, 0.28, 0.02, th.accent);
    add(fx, -3.95, 2.3, 1.1);
    lights.push({ x: fx, y: 0.7, z: -3.0 });
  },

  // Barn: a hayloft on posts with a ladder, and a big beam across the room.
  loft({ v, add, fx, dir }) {
    v.box(fx, 2.0, -3.55, 2.7, 0.18, 1.9, WOOD);
    for (const e of [-1, 1]) v.box(fx + e * 1.22, 0, -2.72, 0.2, 2.0, 0.2, WOOD_DARK);
    v.box(fx, 2.18, -2.66, 2.7, 0.5, 0.08, WOOD_DARK);
    hayBale(v, fx - 0.6, -3.8, 2.18);
    hayBale(v, fx + 0.65, -3.75, 2.18);
    hayBale(v, fx + 0.1, -3.8, 2.9);
    // under the loft: hay and a barrel
    hayBale(v, fx + dir * 0.6, -3.9);
    v.box(fx - dir * 0.7, 0, -3.9, 0.7, 0.9, 0.7, '#9a683f');
    for (const y of [0.15, 0.65]) v.box(fx - dir * 0.7, y, -3.9, 0.74, 0.08, 0.74, '#5c5148');
    // ladder leaning on the loft
    const lx = fx - dir * 0.75;
    for (const e of [-0.24, 0.24]) v.box(lx + e, 1.1, -2.35, 0.08, 2.35, 0.08, WOOD_DARK, { rx: 0.2, center: true });
    for (let k = 0; k < 5; k++) v.box(lx, 0.3 + k * 0.42, -2.13 - k * 0.085, 0.5, 0.06, 0.06, WOOD_DARK);
    add(fx, -3.5, 2.7, 2.0);
    // the beam
    v.box(0, WALL - 0.4, -3.0, W, 0.3, 0.3, WOOD_DARK);
  },

  // Two-story house: stairs going up along the back wall.
  stairs({ v, add, th, fx, dir }) {
    for (let i = 0; i < 7; i++) {
      const x = fx - dir * 1.2 + dir * i * 0.4;
      v.box(x, 0, -3.95, 0.4, (i + 1) * 0.32, 1.1, WOOD);
      v.box(x, (i + 1) * 0.32, -3.95, 0.44, 0.05, 1.14, WOOD_DARK);
      if (i % 2 === 0) v.box(x, (i + 1) * 0.32, -3.44, 0.08, 0.8, 0.08, th.trim);
    }
    v.box(fx, 1.72, -3.44, 2.9, 0.08, 0.1, th.trim, { rz: dir * Math.atan2(0.32, 0.4), center: true });
    // the doorway upstairs
    v.box(fx + dir * 1.25, 2.3, -4.47, 1.0, 1.9, 0.05, '#3b2a20');
    v.box(fx + dir * 1.25, 2.24, -4.3, 0.9, 0.08, 0.4, WOOD_DARK);
    add(fx, -3.95, 2.9, 1.1);
  },

  // Tiled house: a lacquered wardrobe inlaid with mother-of-pearl.
  wardrobe({ v, add, rng, fx }) {
    const black = '#2b1f24';
    v.box(fx, 0.12, -4.1, 2.3, 2.3, 0.8, black);
    for (const e of [-1, 1]) v.box(fx + e * 1.0, 0, -4.1, 0.2, 0.12, 0.7, black);
    v.box(fx, 2.42, -4.1, 2.44, 0.1, 0.9, '#3b2a30');
    v.box(fx, 0.2, -3.69, 0.03, 2.1, 0.02, '#5c4a50');
    v.box(fx, 1.2, -3.69, 2.2, 0.03, 0.02, '#5c4a50');
    const pearl = ['#cfeee6', '#f3d9ee', '#fff6c9', '#bfe3f2'];
    for (const e of [-1, 1]) {
      for (const y0 of [0.35, 1.35]) {
        for (let k = 0; k < 7; k++) {
          v.box(fx + e * 0.56 + rng.range(-0.34, 0.34), y0 + rng.range(0, 0.75), -3.69, 0.12, 0.12, 0.02, rng.pick(pearl));
        }
      }
      v.box(fx + e * 0.1, 1.5, -3.68, 0.07, 0.2, 0.04, '#d9b65a');
    }
    add(fx, -4.1, 2.3, 0.85);
  },

  // Mushroom house: mushrooms growing in the corner, with caps that glow after dark.
  mushrooms({ v, glow, add, lights, st, fx }) {
    const stalk = (x, z, h, r) => {
      v.box(x, 0, z, r * 0.7, h, r * 0.7, '#f6ecd6');
      v.box(x, h, z, r * 2, 0.22, r * 2, st.roof);
      v.box(x, h + 0.22, z, r * 1.4, 0.2, r * 1.4, st.roof);
      glow.box(x - r * 0.45, h + 0.42, z + r * 0.2, r * 0.4, 0.05, r * 0.4, '#ffffff');
      glow.box(x + r * 0.5, h + 0.22, z + r * 0.75, r * 0.36, 0.05, r * 0.36, '#ffffff');
      glow.box(x + r * 0.1, h + 0.06, z + r + 0.01, r * 0.5, 0.12, 0.03, '#ffffff');
    };
    stalk(fx, -3.9, 1.5, 0.7);
    stalk(fx - 0.95, -3.5, 0.8, 0.45);
    stalk(fx + 0.9, -3.6, 0.5, 0.36);
    v.box(fx, 0, -3.8, 2.6, 0.08, 1.3, '#7fae5c');
    add(fx, -3.8, 2.4, 1.2);
    lights.push({ x: fx, y: 1.4, z: -2.9, color: '#ffe2a0' });
  },
};
