import * as THREE from 'three';
import { Voxels, textTexture, voxelMaterial } from './voxel.js';
import { makeRng } from './rng.js';
import { ANIMALS, GAMES, addTree, addFlower, FLOWER_COLORS, createMascot, SNOW, AUTUMN_LEAVES, bloom } from './models.js';
import { Animal, separate } from './animals.js';
import { SEASON } from './season.js';

export const CELL = 30; // one grid cell: plot + half a road on each side
const PLOT = 22; // fenced farm size
const H = PLOT / 2;
const ROAD = 5;

const COLOR = {
  grass: '#8cc866',
  plotGrass: '#9bd170',
  road: '#dcc396',
  pebble: '#bfa883',
  path: '#e6cc9c',
  soil: '#8a5a36',
  soilRidge: '#74492b',
  wood: '#b98657',
  woodDark: '#8a6040',
  stone: '#cfc7b6',
  water: '#6cc4e8',
  waterDeep: '#58b3dd',
  sand: '#ead9a6',
};

// Snow season: the same town under snow. Fields and verges are covered, roads are
// trodden snow, and the water is ice. buildWorld swaps these in before building.
const WINTER = {
  grass: '#e2e9ef',
  plotGrass: '#ecf1f5',
  road: '#cdc2ad',
  pebble: '#b3a893',
  path: '#d8cebe',
  soil: '#e6ecf1',
  soilRidge: '#f3f6f9',
  water: '#cde6f0',
  waterDeep: '#bcdcea',
  sand: '#e8edf1',
};

// Autumn: the grass turns golden. Only colors change, so the layout stays the same.
const AUTUMN = {
  grass: '#a9b95c',
  plotGrass: '#b7c46a',
};
const DRY_GRASS = '#c4a64e';
// Spring grass is fresh and light; summer grass is deep and lush.
const SPRING = { grass: '#9fd36c', plotGrass: '#acdb79' };
const SUMMER = { grass: '#7cbf55', plotGrass: '#89c95f' };

// The GitHub mark (Primer Octicons mark-github-16), drawn on the plaza's contribute sign.
const GITHUB_MARK = 'M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656';

/** A texture with an SVG path (16 by 16 units) filled in one color on a clear background. */
function pathTexture(path, color, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.scale(size / 16, size / 16);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(path));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Christmas lights. Bulbs go into two meshes that twinkle in turn.
const BULB_COLORS = ['#ff5252', '#ffd54a', '#4fc3ff', '#7ee86a', '#ff8ad8'];

/**
 * Seeded random calls decide each farm's look, so the winter build must make exactly the
 * same calls as the normal one. Things hidden in winter (crops, lily pads) are still built,
 * into this throwaway builder, so the random sequence does not shift.
 */
const discard = () => new Voxels();

export const CROPS = {
  carrot: { name: '당근', emoji: '🥕' },
  cabbage: { name: '양배추', emoji: '🥬' },
  wheat: { name: '밀', emoji: '🌾' },
  pumpkin: { name: '호박', emoji: '🎃' },
  strawberry: { name: '딸기', emoji: '🍓' },
  corn: { name: '옥수수', emoji: '🌽' },
};

const STYLES = [
  { kind: 'barn', label: '빨간 헛간', wall: '#cc4b3f', trim: '#fbf6ee', roof: '#5b5866', door: '#a33a31' },
  { kind: 'barn', label: '파란 헛간', wall: '#4f86c6', trim: '#fbf6ee', roof: '#3d4a63', door: '#3d6aa0' },
  { kind: 'barn', label: '초록 헛간', wall: '#62a65a', trim: '#fbf6ee', roof: '#4b5744', door: '#4a8543' },
  { kind: 'barn', label: '귤색 헛간', wall: '#e0913a', trim: '#fff7e8', roof: '#7a4b35', door: '#b8702a' },
  { kind: 'cottage', label: '빨간 지붕 집', wall: '#f4e6c8', trim: '#ffffff', roof: '#d9573f', door: '#8a5a36' },
  { kind: 'cottage', label: '파란 지붕 집', wall: '#f7dcd6', trim: '#ffffff', roof: '#4e7fc4', door: '#7d5a44' },
  { kind: 'cottage', label: '보라 지붕 집', wall: '#e9eef3', trim: '#ffffff', roof: '#8c62b8', door: '#6d4c35' },
  { kind: 'cottage', label: '초록 지붕 집', wall: '#f1ecd2', trim: '#ffffff', roof: '#5a9b56', door: '#8a5a36' },
  { kind: 'log', label: '초록 지붕 통나무집', wall: '#a9744a', trim: '#5f4129', roof: '#4f6b52', door: '#7a5334' },
  { kind: 'log', label: '빨간 지붕 통나무집', wall: '#a9744a', trim: '#5f4129', roof: '#a04a3c', door: '#7a5334' },
  { kind: 'stone', label: '볏짚 지붕 돌집', wall: '#b9b3a6', trim: '#d6d0c2', roof: '#d9b65a', door: '#7a5334' },
  { kind: 'stone', label: '파란 지붕 돌집', wall: '#b9b3a6', trim: '#d6d0c2', roof: '#5b6d84', door: '#7a5334' },
  { kind: 'mushroom', label: '빨간 버섯 집', wall: '#f6ecd6', trim: '#e3d6b8', roof: '#d9483b', door: '#8a5a36' },
  { kind: 'mushroom', label: '파란 버섯 집', wall: '#f6ecd6', trim: '#e3d6b8', roof: '#4e9fc4', door: '#8a5a36' },
  { kind: 'twostory', label: '노란 이층집', wall: '#f6e3a1', trim: '#ffffff', roof: '#3f8f8a', door: '#7d5a44' },
  { kind: 'twostory', label: '민트 이층집', wall: '#cfe8d8', trim: '#ffffff', roof: '#e07a5f', door: '#7d5a44' },
  { kind: 'hanok', label: '기와집', wall: '#f3efe4', trim: '#6b4a32', roof: '#4a4f58', door: '#f5edd6', accent: '#6f7682' },
  { kind: 'hanok', label: '청기와집', wall: '#f3efe4', trim: '#6b4a32', roof: '#3f6f7a', door: '#f5edd6' },
];

// The first eight styles are the original ones. Each farm's seeded sequence still starts with a
// pick among them (see buildFarm), so adding styles never moves a farm's crops or flowers.
const CLASSIC = 8;
const KINDS = ['barn', 'cottage', 'log', 'stone', 'mushroom', 'twostory', 'hanok'];

/**
 * The building kind of every farm. Kinds are dealt like cards, one full deck after another,
 * so the town gets an even mix; the color comes from the owner's name.
 */
function dealStyles(owners, seed, shuffle) {
  const salt = shuffle ? `|${Math.random()}` : '';
  let deck = [];
  return owners.map((owner, i) => {
    if (!deck.length) {
      const r = makeRng(`${seed}|houses|${Math.floor(i / KINDS.length)}${salt}`);
      deck = [...KINDS];
      for (let k = deck.length - 1; k > 0; k--) {
        const j = Math.floor(r.next() * (k + 1));
        [deck[k], deck[j]] = [deck[j], deck[k]];
      }
    }
    const kind = deck.pop();
    return makeRng(`${seed}|${owner}|house${salt}`).pick(STYLES.filter((st) => st.kind === kind));
  });
}

// ---------------------------------------------------------------------------
// Layout: a grid of cells. The plaza takes the middle cell; farms fill the
// cells closest to it; leftover cells become pond meadows.
// ---------------------------------------------------------------------------

function layout(n) {
  const total = n + 1;
  let cols = Math.ceil(Math.sqrt(total));
  if (cols % 2 === 0) cols += 1;
  const rows = Math.max(1, Math.ceil(total / cols));
  const pc = Math.floor((cols - 1) / 2);
  const pr = Math.floor((rows - 1) / 2);
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        c, r,
        x: (c - (cols - 1) / 2) * CELL,
        z: (r - (rows - 1) / 2) * CELL,
        d: Math.hypot(c - pc, (r - pr) * 1.05),
        a: Math.atan2(r - pr, c - pc),
      });
    }
  }
  const plaza = cells.find((cl) => cl.c === pc && cl.r === pr);
  const others = cells.filter((cl) => cl !== plaza).sort((a, b) => a.d - b.d || b.a - a.a);
  return { cols, rows, plaza, farmCells: others.slice(0, n), spare: others.slice(n) };
}

// ---------------------------------------------------------------------------

/**
 * Counts each owner's games from the play records: owner -> [{ type, count }],
 * in the order of the GAMES catalogue. Unknown games or names are reported once.
 */
function gamesByOwner(plays, owners) {
  const known = new Set(owners);
  const byOwner = new Map();
  for (const { game, players } of plays) {
    if (!GAMES[game]) {
      console.warn(`[클클 타운] 모르는 게임: ${game}`);
      continue;
    }
    for (const name of players) {
      if (!known.has(name)) console.warn(`[클클 타운] ${game} 기록의 '${name}' 은 농장 주인 명단에 없다.`);
      if (!byOwner.has(name)) byOwner.set(name, new Map());
      const counts = byOwner.get(name);
      counts.set(game, (counts.get(game) || 0) + 1);
    }
  }
  const order = Object.keys(GAMES);
  const result = new Map();
  for (const [name, counts] of byOwner) {
    result.set(name, order.filter((k) => counts.has(k)).map((type) => ({ type, count: counts.get(type) })));
  }
  return result;
}

export function buildWorld(scene, owners, { seed, shuffle, animalsPerFarm = 1, plays = [], roaming = [], contribute = '' }) {
  if (SEASON.snow) Object.assign(COLOR, WINTER);
  else if (SEASON.autumn) Object.assign(COLOR, AUTUMN);
  else if (SEASON.spring) Object.assign(COLOR, SPRING);
  else if (SEASON.summer) Object.assign(COLOR, SUMMER);
  const L = layout(owners.length);
  const ownerGames = gamesByOwner(plays, owners);
  const W = L.cols * CELL;
  const D = L.rows * CELL;
  const colliders = [];
  const interactables = [];
  const areas = [];
  const farms = [];
  const animals = [];
  const herds = [];
  const updaters = [];
  const statics = new Voxels();
  const worldRng = makeRng(`${seed}|world`);
  const lampHeads = new Voxels();
  const decor = SEASON.christmas ? { bulbs: [new Voxels(), new Voxels()] } : null;
  const styles = dealStyles(owners, seed, shuffle);
  const pads = new Voxels();

  const addCollider = (cx, cz, w, d, h = 10) => {
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, h });
  };

  // --- ground ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(W + 600, D + 600),
    new THREE.MeshLambertMaterial({ color: COLOR.grass }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // --- roads on every cell boundary ---
  for (let k = 0; k <= L.cols; k++) {
    const x = -W / 2 + k * CELL;
    statics.box(x, 0, 0, ROAD, 0.05, D + ROAD, COLOR.road);
  }
  for (let k = 0; k <= L.rows; k++) {
    const z = -D / 2 + k * CELL;
    statics.box(0, 0, z, W + ROAD, 0.05, ROAD, COLOR.road);
  }
  // pebbles
  for (let i = 0; i < (W + D) * 1.2; i++) {
    const vertical = worldRng.chance(0.5);
    if (vertical) {
      const k = worldRng.int(0, L.cols);
      statics.box(-W / 2 + k * CELL + worldRng.range(-2, 2), 0.05, worldRng.range(-D / 2, D / 2), 0.22, 0.05, 0.18, COLOR.pebble);
    } else {
      const k = worldRng.int(0, L.rows);
      statics.box(worldRng.range(-W / 2, W / 2), 0.05, -D / 2 + k * CELL + worldRng.range(-2, 2), 0.18, 0.05, 0.22, COLOR.pebble);
    }
  }

  // --- street lamps near intersections ---
  for (let i = 0; i <= L.cols; i++) {
    for (let j = 0; j <= L.rows; j++) {
      // Sit on the grass verge of the neighboring cell, not on the road.
      const lx = -W / 2 + i * CELL + (i < L.cols ? 3.2 : -3.2);
      const lz = -D / 2 + j * CELL + (j < L.rows ? 3.2 : -3.2);
      statics.box(lx, 0, lz, 0.4, 0.3, 0.4, '#4a5a4c');
      statics.box(lx, 0.3, lz, 0.18, 2.6, 0.18, '#4a5a4c');
      statics.box(lx, 2.9, lz, 0.6, 0.12, 0.6, '#3c4a3e');
      if (SEASON.snow) statics.box(lx, 3.02, lz, 0.64, 0.08, 0.64, SNOW);
      lampHeads.box(lx, 2.42, lz, 0.42, 0.48, 0.42, '#fff3c4');
      statics.box(lx, 2.36, lz, 0.5, 0.06, 0.5, '#3c4a3e');
      addCollider(lx, lz, 0.5, 0.5, 3.2);
    }
  }

  // --- border forest ---
  const innerX = W / 2 + ROAD / 2 + 2;
  const innerZ = D / 2 + ROAD / 2 + 2;
  for (let x = -innerX - 22; x <= innerX + 22; x += 3.6) {
    for (let z = -innerZ - 22; z <= innerZ + 22; z += 3.6) {
      const tx = x + worldRng.range(-1.2, 1.2);
      const tz = z + worldRng.range(-1.2, 1.2);
      if (Math.abs(tx) < innerX && Math.abs(tz) < innerZ) continue;
      if (worldRng.chance(0.25)) continue;
      addTree(statics, tx, tz, worldRng, worldRng.chance(0.3) ? 'pine' : 'round', worldRng.range(0.85, 1.25));
    }
  }

  // --- flowers on verges ---
  for (let i = 0; i < L.cols * L.rows * 22; i++) {
    const cell = worldRng.pick([L.plaza, ...L.farmCells, ...L.spare]);
    const side = worldRng.int(0, 3);
    const along = worldRng.range(-12, 12);
    const off = worldRng.range(11.6, 12.3);
    const [x, z] = side === 0 ? [along, -off] : side === 1 ? [along, off] : side === 2 ? [-off, along] : [off, along];
    if (cell === L.plaza) continue;
    if (side === 1 && Math.abs(along) < 3) continue; // keep farm gates clear
    addFlower(statics, cell.x + x, cell.z + z, worldRng.pick(FLOWER_COLORS));
  }

  // --- farms ---
  owners.forEach((owner, i) => {
    const cell = L.farmCells[i];
    const rng = makeRng(shuffle ? `${seed}|${owner}|${Math.random()}` : `${seed}|${owner}`);
    const farm = buildFarm(scene, cell, owner, i, rng, addCollider, animalsPerFarm, ownerGames.get(owner) || [], decor, styles[i]);
    farms.push(farm);
    addPad(pads, farm.door.x, farm.door.z + PAD_OFFSET);
    for (const a of farm.animals) {
      scene.add(a.object);
      animals.push(a);
    }
    herds.push(farm.animals);
    interactables.push({ kind: 'farm', x: cell.x, z: cell.z + H, r: 3.2, farm });
    areas.push({ kind: 'farm', farm, minX: cell.x - H, maxX: cell.x + H, minZ: cell.z - H, maxZ: cell.z + H });
  });

  // --- plaza ---
  const plaza = buildPlaza(scene, statics, L.plaza, worldRng, addCollider, updaters, decor, contribute);
  // A few animals wander the open plaza tiles east and west of the fountain.
  const P = L.plaza;
  const plazaHerds = [
    { pasture: { minX: P.x + 3.4, maxX: P.x + 9.4, minZ: P.z - 3.0, maxZ: P.z + 3.0 }, kinds: [['chicken', 'white'], ['chicken', 'brown'], ['rabbit', 'white']] },
    { pasture: { minX: P.x - 6.0, maxX: P.x - 3.4, minZ: P.z - 4.2, maxZ: P.z + 3.4 }, kinds: [['sheep', 'white'], ['duck', 'white']] },
  ];
  plazaHerds.forEach((h, i) => {
    const herd = h.kinds.map(([type, variant], k) => new Animal(type, variant, { pasture: h.pasture }, makeRng(`${seed}|plaza|${i}|${k}`)));
    for (const a of herd) {
      scene.add(a.object);
      animals.push(a);
    }
    herds.push(herd);
  });
  interactables.push({ kind: 'board', x: plaza.board.x, z: plaza.board.z + 0.8, r: 2.6 });
  if (plaza.github) interactables.push({ kind: 'github', x: plaza.github.x, z: plaza.github.z + 0.9, r: 2.4, url: contribute });
  areas.push({ kind: 'plaza', minX: L.plaza.x - 12.5, maxX: L.plaza.x + 12.5, minZ: L.plaza.z - 12.5, maxZ: L.plaza.z + 12.5 });

  // --- characters strolling the roads between farms (not on anyone's farm yet) ---
  // Each one gets its own road segment between two intersections, spread over the town.
  const segments = [];
  for (let k = 0; k <= L.rows; k++) {
    for (let c = 0; c < L.cols; c++) {
      const z = -D / 2 + k * CELL;
      const x0 = -W / 2 + c * CELL;
      segments.push({ minX: x0 + 5, maxX: x0 + CELL - 5, minZ: z - 1.2, maxZ: z + 1.2 });
    }
  }
  for (let k = 0; k <= L.cols; k++) {
    for (let r = 0; r < L.rows; r++) {
      const x = -W / 2 + k * CELL;
      const z0 = -D / 2 + r * CELL;
      segments.push({ minX: x - 1.2, maxX: x + 1.2, minZ: z0 + 5, maxZ: z0 + CELL - 5 });
    }
  }
  const roadRng = makeRng(`${seed}|roads`);
  for (let i = segments.length - 1; i > 0; i--) {
    const j = Math.floor(roadRng.next() * (i + 1));
    [segments[i], segments[j]] = [segments[j], segments[i]];
  }
  const strollers = [];
  roaming.forEach((type, i) => {
    if (!GAMES[type]) {
      console.warn(`[클클 타운] 모르는 캐릭터: ${type}`);
      return;
    }
    const r = makeRng(`${seed}|roam|${type}`);
    const a = new Animal(type, r.pick(Object.keys(GAMES[type].variants)), { pasture: segments[i % segments.length] }, r);
    scene.add(a.object);
    animals.push(a);
    strollers.push(a);
  });
  herds.push(strollers);

  // --- spare cells: pond meadows with wild ducks ---
  for (const cell of L.spare) {
    const home = buildMeadow(statics, cell, worldRng, addCollider);
    const ducks = [];
    const n = worldRng.int(2, 3);
    for (let k = 0; k < n; k++) {
      const a = new Animal('duck', worldRng.pick(['white', 'mallard']), home, makeRng(`${seed}|pond|${cell.c},${cell.r}|${k}`));
      scene.add(a.object);
      ducks.push(a);
      animals.push(a);
    }
    herds.push(ducks);
    areas.push({ kind: 'meadow', minX: cell.x - 12.5, maxX: cell.x + 12.5, minZ: cell.z - 12.5, maxZ: cell.z + 12.5 });
  }

  scene.add(statics.mesh());
  const lampMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#000000') });
  const lamps = lampHeads.mesh(lampMaterial, { cast: false, receive: false });
  scene.add(lamps);

  // Christmas lights: unlit so they read as glowing, brighter and twinkling after dark.
  let glow = 0;
  let setDecorGlow = () => {};
  if (decor) {
    const mats = decor.bulbs.map((b) => {
      const m = new THREE.MeshBasicMaterial({ vertexColors: true });
      scene.add(b.mesh(m, { cast: false, receive: false }));
      return m;
    });
    // Warm light from the plaza tree on the snow around it, only after dark.
    const treeLight = new THREE.PointLight('#ffcf8a', 0, 18, 1.4);
    treeLight.position.set(plaza.tree.x, 3.2, plaza.tree.z + 1.2);
    scene.add(treeLight);
    setDecorGlow = (level) => {
      glow = level;
      treeLight.intensity = level * 28;
    };
    updaters.push((dt, t) => {
      const wave = Math.sin(t * 2.4);
      const base = 0.8 + glow * 0.25;
      const amp = 0.12 + glow * 0.5;
      mats[0].color.setScalar(base + amp * wave);
      mats[1].color.setScalar(base - amp * wave);
    });
  }

  // Glowing pads in front of every house door, with sparkles drifting up from them.
  const padMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  scene.add(pads.mesh(padMaterial, { cast: false, receive: false }));
  const sparkles = padSparkles(farms.map((f) => ({ x: f.door.x, z: f.door.z + PAD_OFFSET })));
  scene.add(sparkles.mesh);
  updaters.push((dt, t) => {
    padMaterial.color.setScalar(0.9 + 0.1 * Math.sin(t * 2.2));
    sparkles.update(t);
  });

  const bounds = { minX: -W / 2 - 2.5, maxX: W / 2 + 2.5, minZ: -D / 2 - 2.5, maxZ: D / 2 + 2.5 };

  return {
    W, D, cols: L.cols, rows: L.rows,
    farms, plaza, animals, colliders, interactables, areas, bounds, lampMaterial,
    spare: L.spare,
    /** Called by the sky with the time of day's lamp level (0 by day, 1 at night). */
    setLights(lamps) {
      setDecorGlow(lamps);
    },
    spawn: new THREE.Vector3(L.plaza.x, 0, L.plaza.z + 7),
    /**
     * The nearest place to (x, z) where the player can stand: inside the town and clear of every
     * wall, fence, tree and prop. Searches outward in rings; null if nothing is free nearby.
     */
    freeSpot(x, z, r = 0.55) {
      const inside = (px, pz) => px > bounds.minX + 1 && px < bounds.maxX - 1 && pz > bounds.minZ + 1 && pz < bounds.maxZ - 1;
      const free = (px, pz) =>
        inside(px, pz) && colliders.every((c) => px < c.minX - r || px > c.maxX + r || pz < c.minZ - r || pz > c.maxZ + r);
      x = Math.min(bounds.maxX - 1.5, Math.max(bounds.minX + 1.5, x));
      z = Math.min(bounds.maxZ - 1.5, Math.max(bounds.minZ + 1.5, z));
      if (free(x, z)) return { x, z };
      for (let ring = 1; ring <= 24; ring++) {
        const d = ring * 0.5;
        const n = Math.max(8, Math.round(d * 8));
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          const px = x + Math.cos(a) * d;
          const pz = z + Math.sin(a) * d;
          if (free(px, pz)) return { x: px, z: pz };
        }
      }
      return null;
    },
    areaAt(x, z) {
      for (const a of areas) {
        if (x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ) return a;
      }
      return null;
    },
    update(dt, t, playerPos) {
      for (const f of farms) fadeTallProps(f, playerPos, dt);
      for (const a of animals) a.update(dt, t, playerPos);
      for (const h of herds) separate(h);
      for (const u of updaters) u(dt, t);
    },
  };
}

// ---------------------------------------------------------------------------
// Farm
// ---------------------------------------------------------------------------

/** Fades a farm's barn, silo and tree while the player stands just north of them. */
function fadeTallProps(farm, p, dt) {
  const behind = p.z < farm.cz - 7 && p.z > farm.cz - 26 && Math.abs(p.x - farm.cx) < 15;
  const m = farm.tallMaterial;
  const target = behind ? 0.3 : 1;
  m.opacity += (target - m.opacity) * Math.min(1, dt * 6);
  if (!behind && m.opacity > 0.985) m.opacity = 1;
  const fading = m.opacity < 1;
  if (fading !== m.transparent) {
    m.transparent = fading;
    m.depthWrite = !fading;
    m.needsUpdate = true;
  }
}

/** Picks `count` animals, each of a random type and color, grouped by type. */
function pickAnimals(rng, count) {
  const types = Object.keys(ANIMALS);
  const byType = new Map();
  for (let i = 0; i < count; i++) {
    const type = rng.pick(types);
    const variant = rng.pick(Object.keys(ANIMALS[type].variants));
    if (!byType.has(type)) byType.set(type, { type, count: 0, variants: [] });
    const entry = byType.get(type);
    entry.count += 1;
    entry.variants.push(variant);
  }
  return [...byType.values()];
}

function buildFarm(scene, cell, owner, index, rng, addCollider, animalCount, games, decor, style) {
  const cx = cell.x;
  const cz = cell.z;
  const v = new Voxels();
  // The seeded sequence used to pick the building here. The pick stays so that everything
  // after it (side, crop, flowers) comes out the same as before the building kinds grew.
  const classic = rng.pick(STYLES.slice(0, CLASSIC));
  const side = rng.sign(); // which side the barn sits on
  const cropKey = rng.pick(Object.keys(CROPS));
  const fence = rng.pick(['#f6f1e6', '#b98657', '#f6f1e6', '#a7754b']);
  const middle = rng.pick(['tree', 'silo', 'hay', 'apple', 'silo']);
  const accent = style.accent || (style.kind === 'barn' ? style.wall : style.roof);

  // ground inside the fence
  v.box(cx, 0, cz, PLOT, 0.03, PLOT, COLOR.plotGrass);

  // fence
  buildFence(v, cx, cz, fence);
  addCollider(cx, cz - H, PLOT + 0.3, 0.3, 1.1);
  addCollider(cx - H, cz, 0.3, PLOT + 0.3, 1.1);
  addCollider(cx + H, cz, 0.3, PLOT + 0.3, 1.1);
  addCollider(cx - (H + 2.1) / 2, cz + H, H - 2.1 + 0.3, 0.3, 1.1);
  addCollider(cx + (H + 2.1) / 2, cz + H, H - 2.1 + 0.3, 0.3, 1.1);

  // gate arch with the owner's name
  mirrorX((s) => v.box(cx + s * 2.3, 0, cz + H, 0.36, 2.9, 0.36, COLOR.woodDark));
  v.box(cx, 2.75, cz + H, 5.1, 0.28, 0.4, COLOR.woodDark);
  v.box(cx, 3.03, cz + H, 4.4, 0.95, 0.14, COLOR.wood);
  v.box(cx, 3.0, cz + H, 4.6, 0.08, 0.18, accent);
  if (SEASON.snow) {
    v.box(cx, 3.98, cz + H, 4.48, 0.1, 0.22, SNOW);
    mirrorX((s) => v.box(cx + s * 2.38, 3.03, cz + H, 0.42, 0.08, 0.44, SNOW));
  }
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(4.1, 0.85),
    new THREE.MeshLambertMaterial({ map: textTexture(owner, { font: 'bold 68px Galmuri11', color: '#3b2a1e' }), transparent: true }),
  );
  sign.position.set(cx, 3.505, cz + H + 0.075);
  scene.add(sign);

  // path from the gate to the barn door
  const bx = cx + side * 6.5;
  const bz = cz - 7;
  v.box(cx, 0, cz + 3.5, 1.6, 0.06, 15, COLOR.path);
  v.box((cx + bx) / 2, 0, cz - 3.2, Math.abs(bx - cx) + 1.6, 0.06, 1.6, COLOR.path);

  // barn / cottage
  // Tall props go in their own mesh so they can fade when the player walks behind them.
  const tall = new Voxels();
  // The old cottage drew ten flower colors from the farm's sequence; keep its place in line.
  if (classic.kind === 'cottage') for (let k = 0; k < 10; k++) rng.next();
  const house = buildHouse(tall, bx, bz, style, makeRng(`${owner}|house`), decor);
  addCollider(bx, bz + house.oz, house.w + 0.2, house.d + 0.2, 10);

  // crop field
  buildCrops(v, cx - side * 6, cz - 7, cropKey, rng);

  // centerpiece behind the path
  if (middle === 'silo') {
    buildSilo(tall, cx, cz - 8.2, rng);
    addCollider(cx, cz - 8.2, 2.5, 2.5, 8);
  } else if (middle === 'hay') {
    buildHayStack(tall, cx, cz - 8);
    addCollider(cx, cz - 8, 2.6, 2.0, 1.9);
  } else {
    addTree(tall, cx, cz - 8.2, rng, middle === 'apple' ? 'apple' : 'round', 1.05);
    addCollider(cx, cz - 8.2, 0.8, 0.8, 8);
  }

  // trough and hay bales between the barn strip and the pasture
  const tx = cx - side * 4.5;
  v.box(tx, 0, cz - 3.0, 1.9, 0.5, 0.75, COLOR.woodDark);
  v.box(tx, 0.1, cz - 3.0, 1.6, 0.42, 0.5, SEASON.snow ? '#d4ecf5' : '#7cc8ea');
  addCollider(tx, cz - 3.0, 1.9, 0.75, 0.5);
  const hx = cx + side * 9.4;
  buildHayBale(v, hx, cz - 2.9);
  addCollider(hx, cz - 2.9, 1.1, 0.9, 0.85);
  if (rng.chance(0.6)) {
    buildHayBale(v, cx - side * 8.6, cz - 2.9);
    addCollider(cx - side * 8.6, cz - 2.9, 1.1, 0.9, 0.85);
  }

  // grass tufts and flowers in the pasture
  for (let k = 0; k < 26; k++) {
    const x = cx + rng.range(-10, 10);
    const z = cz + rng.range(-1.5, 10);
    if (Math.abs(x - cx) < 1.2) continue;
    if (rng.chance(0.3)) addFlower(v, x, z, rng.pick(FLOWER_COLORS));
    else {
      const h = rng.range(0.2, 0.35);
      if (SEASON.snow) v.box(x, 0, z, 0.3, 0.1, 0.24, SNOW);
      else v.box(x, 0, z, 0.12, h, 0.12, SEASON.autumn ? DRY_GRASS : '#6fae4c');
    }
  }

  scene.add(v.mesh());
  const tallMaterial = voxelMaterial.clone();
  scene.add(tall.mesh(tallMaterial));

  // Every farm has the club cloud. Farms whose owner played games together add one
  // character per game played; other farms get `animalCount` random animals (0 by default).
  const home = { pasture: { minX: cx - 9.6, maxX: cx + 9.6, minZ: cz - 1.4, maxZ: cz + 9.6 } };
  const animals = [new Animal('cloud', 'white', home, makeRng(`${owner}|cloud`))];
  let herd = [];
  if (games.length) {
    for (const g of games) {
      const variants = Object.keys(GAMES[g.type].variants);
      for (let k = 0; k < g.count; k++) {
        const r = makeRng(`${owner}|${g.type}|${k}`);
        animals.push(new Animal(g.type, r.pick(variants), home, r));
      }
    }
  } else {
    herd = pickAnimals(rng, animalCount);
    herd.forEach((h) => {
      h.variants.forEach((variant, k) => {
        animals.push(new Animal(h.type, variant, home, makeRng(`${owner}|${h.type}|${k}|${rng.next()}`)));
      });
    });
  }

  return {
    index, owner, cx, cz, accent, style, crop: CROPS[cropKey], cropKey, herd, games, animals, tallMaterial,
    labelAnchor: new THREE.Vector3(cx, 5.2, cz + 6),
    // The front door: walking into it enters the house (see main.js).
    door: { x: bx, z: bz + 3, half: house.doorHalf },
    gate: { x: cx, z: cz + H + 3.6 },
  };
}

function mirrorX(fn) {
  fn(-1);
  fn(1);
}

function buildFence(v, cx, cz, color) {
  const postW = 0.24;
  const snow = SEASON.snow;
  const rail = (x, z, len, alongX) => {
    for (const y of [0.4, 0.78]) {
      if (alongX) v.box(x, y, z, len, 0.12, 0.1, color);
      else v.box(x, y, z, 0.1, 0.12, len, color);
    }
    if (snow) {
      if (alongX) v.box(x, 0.9, z, len, 0.05, 0.13, SNOW);
      else v.box(x, 0.9, z, 0.13, 0.05, len, SNOW);
    }
  };
  const post = (x, z) => {
    v.box(x, 0, z, postW, 1.05, postW, color);
    if (snow) v.box(x, 1.05, z, postW + 0.04, 0.08, postW + 0.04, SNOW);
  };
  for (let t = -H; t <= H + 0.001; t += 2) {
    post(cx + t, cz - H); // back
    post(cx - H, cz + t); // left
    post(cx + H, cz + t); // right
    if (Math.abs(t) > 2.2) post(cx + t, cz + H); // front
  }
  rail(cx, cz - H, PLOT, true);
  rail(cx - H, cz, PLOT, false);
  rail(cx + H, cz, PLOT, false);
  rail(cx - (H + 2.3) / 2, cz + H, H - 2.3, true);
  rail(cx + (H + 2.3) / 2, cz + H, H - 2.3, true);
}

/**
 * Builds a farm's house. Every kind keeps its front door in the middle of the front wall
 * (z = bz + 3) so the farm path leads to it. Returns the footprint for the collider
 * (`w`, `d`, and `oz`, the footprint's offset in z) and the half width of the doorway.
 */
function buildHouse(v, bx, bz, st, rng, decor) {
  const front = bz + 3;
  const h = HOUSES[st.kind](v, bx, bz, front, st, rng);
  if (decor) {
    // Fairy lights along the front eave, sagging a little between hooks.
    const { y, z, w } = h.eave;
    v.box(bx, y, z, w, 0.03, 0.03, '#2f3b2f');
    const n = Math.floor((w - 0.12) / 0.48);
    for (let i = 0; i <= n; i++) {
      const sag = i % 4 === 2 ? 0.1 : i % 2 ? 0.05 : 0;
      decor.bulbs[i % 2].box(bx - (n * 0.48) / 2 + i * 0.48, y - 0.19 - sag, z, 0.15, 0.18, 0.15, BULB_COLORS[i % BULB_COLORS.length]);
    }
    // Wreath on the door.
    addWreath(v, bx, h.wreath.y, h.wreath.z);
  }
  return { w: 7, d: 6, oz: 0, ...h };
}

/** Stepped gable roof whose ridge runs front to back. `inner` fills the gable ends. */
function gableRoof(v, bx, bz, y0, widths, depth, roof, inner) {
  widths.forEach((w, i) => {
    const y = y0 + i * 0.45;
    v.box(bx, y, bz, w, 0.45, depth, roof, { jitter: 0.03 });
    if (w - 1 > 0.2) v.box(bx, y, bz, w - 1, 0.44, depth + 0.06, inner);
    if (SEASON.snow) {
      // Snow on each step's exposed tread; the next step covers the middle.
      const next = widths[i + 1];
      if (next) mirrorX((s) => v.box(bx + s * (w + next) / 4, y + 0.45, bz, (w - next) / 2, 0.12, depth + 0.04, SNOW));
      else v.box(bx, y + 0.45, bz, w + 0.04, 0.16, depth + 0.04, SNOW);
    }
  });
}

/** Stepped roof that slopes on all four sides. `layers` are [width, depth] from the eave up. */
function hipRoof(v, bx, bz, y0, layers, h, roof, jitter = 0.04) {
  layers.forEach(([w, d], i) => {
    const y = y0 + i * h;
    v.box(bx, y, bz, w, h, d, roof, { jitter });
    // Each layer's snow is hidden in the middle by the layer above it.
    if (SEASON.snow) v.box(bx, y + h, bz, w + 0.04, 0.12, d + 0.04, SNOW);
  });
}

/** An eight-sided slab made of three boxes, for round things. */
function oct(v, x, y, z, r, h, color, opt) {
  v.box(x, y, z, r * 2, h, r * 1.2, color, opt);
  v.box(x, y, z, r * 1.2, h, r * 2, color, opt);
  v.box(x, y, z, r * 1.68, h, r * 1.68, color, opt);
}

const STANDARD_ROOF = [7.9, 6.5, 5.1, 3.7, 2.3, 0.9];

/** A framed window on the front wall with a cross bar. */
function frontWindow(v, x, y, z, w, h, frame, pane = '#bfe3f2') {
  v.box(x, y, z + 0.02, w + 0.25, h + 0.2, 0.06, frame);
  v.box(x, y + 0.08, z + 0.05, w, h, 0.04, pane);
  v.box(x, y + 0.08, z + 0.08, 0.08, h, 0.02, frame);
  v.box(x, y + 0.08 + h / 2 - 0.04, z + 0.08, w, 0.08, 0.02, frame);
}

const HOUSES = {
  barn(v, bx, bz, front, st) {
    classicShell(v, bx, bz, st);
    // big door with an X brace
    v.box(bx, 0.3, front + 0.02, 2.9, 2.45, 0.06, st.trim);
    v.box(bx, 0.3, front + 0.06, 2.5, 2.25, 0.04, st.door);
    const tilt = Math.PI / 2 - Math.atan2(2.25, 2.5);
    v.box(bx, 1.42, front + 0.09, 0.14, 3.1, 0.03, st.trim, { rz: tilt, center: true });
    v.box(bx, 1.42, front + 0.09, 0.14, 3.1, 0.03, st.trim, { rz: -tilt, center: true });
    v.box(bx, 1.36, front + 0.09, 2.5, 0.12, 0.03, st.trim);
    // hayloft window
    v.box(bx, 3.45, front + 0.35, 1.1, 0.95, 0.04, st.trim);
    v.box(bx, 3.55, front + 0.38, 0.8, 0.7, 0.03, '#3b2a20');
    // side windows
    for (const sx of [-1, 1]) {
      v.box(bx + sx * 3.51, 1.7, bz, 0.04, 0.8, 1.0, st.trim);
      v.box(bx + sx * 3.53, 1.8, bz, 0.03, 0.6, 0.8, '#3b2a20');
    }
    return { doorHalf: 1.1, eave: { y: 3.27, z: front + 0.36, w: 7.8 }, wreath: { y: 1.5, z: front + 0.12 } };
  },

  cottage(v, bx, bz, front, st, rng) {
    classicShell(v, bx, bz, st);
    // door, windows with flower boxes, chimney
    v.box(bx, 0.3, front + 0.02, 1.3, 2.1, 0.06, st.trim);
    v.box(bx, 0.3, front + 0.05, 1.05, 1.95, 0.04, st.door);
    v.box(bx + 0.32, 1.2, front + 0.08, 0.1, 0.1, 0.04, '#ffd34d');
    for (const sx of [-1, 1]) {
      const wx = bx + sx * 2.2;
      v.box(wx, 1.2, front + 0.02, 1.2, 1.1, 0.06, st.trim);
      v.box(wx, 1.28, front + 0.05, 0.95, 0.9, 0.04, '#bfe3f2');
      v.box(wx, 1.28, front + 0.08, 0.08, 0.9, 0.02, st.trim);
      v.box(wx, 1.69, front + 0.08, 0.95, 0.08, 0.02, st.trim);
      v.box(wx, 0.95, front + 0.2, 1.3, 0.25, 0.32, COLOR.woodDark);
      for (let k = -2; k <= 2; k++) v.box(wx + k * 0.24, 1.2, front + 0.2, 0.16, 0.16, 0.16, bloom(rng.pick(FLOWER_COLORS)));
    }
    v.box(bx + 1.8, 4.2, bz - 1.2, 0.8, 2.4, 0.8, '#b0645a');
    v.box(bx + 1.8, 6.6, bz - 1.2, 0.95, 0.2, 0.95, '#8f4f47');
    if (SEASON.snow) v.box(bx + 1.8, 6.8, bz - 1.2, 0.99, 0.1, 0.99, SNOW);
    return { doorHalf: 0.5, eave: { y: 3.27, z: front + 0.36, w: 7.8 }, wreath: { y: 1.55, z: front + 0.08 } };
  },

  // Log cabin: stacked logs that cross at the corners, a plank door and a stone chimney.
  log(v, bx, bz, front, st) {
    const logs = [st.wall, '#96633c'];
    v.box(bx, 0, bz, 7.3, 0.3, 6.3, '#8f8a80');
    for (let i = 0; i < 7; i++) {
      const y = 0.3 + i * 0.43;
      v.box(bx, y, bz, 7, 0.43, 6, logs[i % 2], { jitter: 0.03 });
      v.box(bx, y + 0.4, bz, 7.02, 0.03, 6.02, '#7d5231');
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          if (i % 2) v.box(bx + sx * 3.62, y + 0.04, bz + sz * 2.75, 0.5, 0.35, 0.36, logs[1]);
          else v.box(bx + sx * 3.25, y + 0.04, bz + sz * 3.12, 0.36, 0.35, 0.5, logs[0]);
        }
      }
    }
    gableRoof(v, bx, bz, 3.3, STANDARD_ROOF, 6.6, st.roof, logs[1]);
    // plank door
    v.box(bx, 0.3, front + 0.02, 1.4, 2.15, 0.06, st.trim);
    v.box(bx, 0.3, front + 0.05, 1.1, 2.0, 0.04, st.door);
    for (const dx of [-0.19, 0.19]) v.box(bx + dx, 0.3, front + 0.07, 0.04, 2.0, 0.02, st.trim);
    v.box(bx + 0.36, 1.25, front + 0.09, 0.1, 0.22, 0.04, '#2f2a26');
    // window with shutters in the roof's color
    const wx = bx - 2.15;
    frontWindow(v, wx, 1.25, front, 0.95, 0.9, st.trim);
    mirrorX((s) => v.box(wx + s * 0.82, 1.27, front + 0.04, 0.38, 1.02, 0.05, st.roof));
    // firewood stacked by the door
    for (let r = 0; r < 3; r++) {
      for (let k = 0; k < 4 - r; k++) {
        const fx = bx + 1.55 + r * 0.17 + k * 0.34;
        v.box(fx, 0.3 + r * 0.3, front + 0.2, 0.3, 0.3, 0.36, '#8a6040');
        v.box(fx, 0.37 + r * 0.3, front + 0.39, 0.18, 0.16, 0.02, '#d9b98a');
      }
    }
    // stone chimney
    v.box(bx - 2.0, 3.9, bz - 1.2, 0.95, 2.7, 0.95, '#9a958c', { jitter: 0.04 });
    v.box(bx - 2.0, 6.6, bz - 1.2, 1.1, 0.2, 1.1, '#7f7a72');
    if (SEASON.snow) v.box(bx - 2.0, 6.8, bz - 1.2, 1.14, 0.1, 1.14, SNOW);
    return { doorHalf: 0.5, eave: { y: 3.27, z: front + 0.36, w: 7.8 }, wreath: { y: 1.6, z: front + 0.09 } };
  },

  // Stone house: rough stone walls, pale corner stones and a thick stepped roof.
  stone(v, bx, bz, front, st, rng) {
    const stones = ['#a8a296', '#c9c3b5', '#9d978b', '#c2bcae'];
    v.box(bx, 0, bz, 7.3, 0.3, 6.3, '#8f8a80');
    v.box(bx, 0.3, bz, 7, 3.0, 6, st.wall, { jitter: 0.02 });
    for (let k = 0; k < 34; k++) {
      const x = rng.range(-3.1, 3.1);
      const y = rng.range(0.4, 2.85);
      const w = rng.range(0.45, 0.8);
      const hgt = rng.range(0.24, 0.38);
      const color = rng.pick(stones);
      if (Math.abs(x) < 1.15 && y < 2.75) continue; // door
      if (Math.abs(Math.abs(x) - 2.2) < 1.05 && y > 0.8 && y < 2.5) continue; // windows
      v.box(bx + x, y, front + 0.01, w, hgt, 0.05, color);
    }
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 12; k++) {
        v.box(bx + sx * 3.51, rng.range(0.4, 2.85), bz + rng.range(-2.5, 2.5), 0.05, rng.range(0.24, 0.38), rng.range(0.45, 0.8), rng.pick(stones));
      }
      // corner stones, long and short in turn
      for (const sz of [-1, 1]) {
        for (let i = 0; i < 6; i++) {
          v.box(bx + sx * 3.36, 0.3 + i * 0.5, bz + sz * 2.86, i % 2 ? 0.6 : 0.4, 0.5, i % 2 ? 0.4 : 0.6, st.trim);
        }
      }
    }
    hipRoof(v, bx, bz, 3.3, [[8, 7], [6.8, 5.8], [5.6, 4.6], [4.2, 3.2], [2.6, 1.6]], 0.5, st.roof, 0.06);
    // arched door
    v.box(bx, 0.3, front + 0.02, 1.4, 2.0, 0.06, st.trim);
    v.box(bx, 2.3, front + 0.02, 1.0, 0.24, 0.06, st.trim);
    v.box(bx, 0.3, front + 0.05, 1.1, 1.9, 0.04, st.door);
    v.box(bx, 2.2, front + 0.05, 0.7, 0.22, 0.04, st.door);
    v.box(bx, 1.3, front + 0.08, 1.1, 0.1, 0.02, '#4a3a2c');
    v.box(bx + 0.34, 1.05, front + 0.09, 0.1, 0.1, 0.04, '#2f2a26');
    // windows with wooden shutters
    for (const sx of [-1, 1]) {
      const wx = bx + sx * 2.2;
      frontWindow(v, wx, 1.2, front, 0.8, 0.9, st.trim);
      mirrorX((s) => v.box(wx + s * 0.72, 1.24, front + 0.04, 0.32, 1.0, 0.05, st.door));
    }
    v.box(bx + 2.0, 4.3, bz - 1.4, 0.9, 2.0, 0.9, '#9a958c', { jitter: 0.04 });
    v.box(bx + 2.0, 6.3, bz - 1.4, 1.05, 0.2, 1.05, '#7f7a72');
    if (SEASON.snow) v.box(bx + 2.0, 6.5, bz - 1.4, 1.09, 0.1, 1.09, SNOW);
    return { doorHalf: 0.5, eave: { y: 3.27, z: front + 0.56, w: 7.8 }, wreath: { y: 1.55, z: front + 0.08 } };
  },

  // Mushroom house: a round stalk under a wide spotted cap.
  mushroom(v, bx, bz, front, st, rng) {
    const cz = bz + 0.3; // the stalk is 5.4 deep, so its front wall still sits at `front`
    oct(v, bx, 0, cz, 2.82, 0.3, st.trim);
    oct(v, bx, 0.3, cz, 2.7, 2.5, st.wall, { jitter: 0.02 });
    oct(v, bx, 2.66, bz + 0.1, 3.5, 0.16, '#f3e3c4');
    const cap = [[3.9, 0.45], [3.7, 0.5], [3.2, 0.5], [2.6, 0.5], [1.8, 0.45], [0.9, 0.3]];
    let y = 2.8;
    cap.forEach(([r, hgt], i) => {
      oct(v, bx, y, bz + 0.1, r, hgt, st.roof, { jitter: 0.03 });
      const next = cap[i + 1];
      if (SEASON.snow) oct(v, bx, y + hgt, bz + 0.1, r + 0.02, 0.12, SNOW);
      else if (next && i > 0) {
        // white spots on the steps of the cap
        const n = 6 - i;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + rng.range(-0.3, 0.3);
          const rr = (r + next[0]) / 2 - 0.12;
          v.box(bx + Math.cos(a) * rr * 0.92, y + hgt, bz + 0.1 + Math.sin(a) * rr * 0.92, 0.5, 0.08, 0.5, '#fffaf0');
        }
      }
      // and on the front of the cap
      if (i > 0 && i < 4) v.box(bx + rng.range(-0.5, 0.5) * r * 0.5, y + 0.1, bz + 0.1 + r + 0.01, 0.5, 0.28, 0.04, '#fffaf0');
      y += hgt;
    });
    // round door
    v.box(bx, 0.3, front + 0.02, 1.3, 1.85, 0.06, '#c9a26a');
    v.box(bx, 2.15, front + 0.02, 0.9, 0.22, 0.06, '#c9a26a');
    v.box(bx, 0.3, front + 0.05, 1.0, 1.75, 0.04, st.door);
    v.box(bx, 2.05, front + 0.05, 0.6, 0.2, 0.04, st.door);
    v.box(bx + 0.3, 1.1, front + 0.08, 0.1, 0.1, 0.04, '#ffd34d');
    // round windows
    for (const sx of [-1, 1]) {
      const wx = bx + sx * 1.2;
      v.box(wx, 1.25, front + 0.02, 0.7, 0.46, 0.05, '#c9a26a');
      v.box(wx, 1.13, front + 0.02, 0.46, 0.7, 0.05, '#c9a26a');
      v.box(wx, 1.3, front + 0.05, 0.52, 0.36, 0.04, '#bfe3f2');
      v.box(wx, 1.22, front + 0.05, 0.36, 0.52, 0.04, '#bfe3f2');
    }
    // little chimney pipe
    v.box(bx + 1.7, 4.4, bz - 0.9, 0.4, 1.3, 0.4, st.trim);
    v.box(bx + 1.7, 5.7, bz - 0.9, 0.56, 0.14, 0.56, '#c9b891');
    return {
      w: 5.4, d: 5.4, oz: 0.3, doorHalf: 0.45,
      eave: { y: 2.77, z: bz + 4.05, w: 4.4 }, wreath: { y: 1.45, z: front + 0.08 },
    };
  },

  // Two-story house: narrow and tall, with a balcony over the door.
  twostory(v, bx, bz, front, st) {
    const Wd = 5.8;
    v.box(bx, 0, bz, Wd + 0.3, 0.3, 6.3, '#a59d90');
    v.box(bx, 0.3, bz, Wd, 5.4, 6, st.wall, { jitter: 0.02 });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) v.box(bx + sx * (Wd / 2 - 0.1), 0.3, bz + sz * 2.9, 0.27, 5.4, 0.27, st.trim);
    }
    v.box(bx, 2.95, bz, Wd + 0.1, 0.18, 6.1, st.trim);
    gableRoof(v, bx, bz, 5.7, [6.7, 5.5, 4.3, 3.1, 1.9, 0.8], 6.6, st.roof, st.wall);
    // door and ground floor windows
    v.box(bx, 0.3, front + 0.02, 1.3, 2.1, 0.06, st.trim);
    v.box(bx, 0.3, front + 0.05, 1.05, 1.95, 0.04, st.door);
    v.box(bx + 0.32, 1.2, front + 0.08, 0.1, 0.1, 0.04, '#ffd34d');
    for (const sx of [-1, 1]) frontWindow(v, bx + sx * 1.95, 1.15, front, 0.8, 0.95, st.trim);
    // balcony on brackets, with a glass door behind it
    v.box(bx, 2.95, front + 0.45, 2.7, 0.14, 0.9, st.trim);
    mirrorX((s) => v.box(bx + s * 1.1, 2.55, front + 0.2, 0.14, 0.4, 0.4, st.trim));
    v.box(bx, 3.6, front + 0.86, 2.7, 0.08, 0.08, st.roof);
    for (let k = -3; k <= 3; k++) v.box(bx + k * 0.43, 3.09, front + 0.86, 0.07, 0.52, 0.07, st.roof);
    mirrorX((s) => v.box(bx + s * 1.31, 3.6, front + 0.45, 0.08, 0.08, 0.9, st.roof));
    v.box(bx, 3.13, front + 0.02, 1.25, 1.85, 0.06, st.trim);
    v.box(bx, 3.2, front + 0.05, 1.0, 1.7, 0.04, '#bfe3f2');
    v.box(bx, 3.2, front + 0.08, 0.08, 1.7, 0.02, st.trim);
    for (const sx of [-1, 1]) frontWindow(v, bx + sx * 1.95, 3.75, front, 0.8, 0.95, st.trim);
    // round window under the ridge
    v.box(bx, 6.35, front + 0.33, 0.8, 0.8, 0.04, st.trim);
    v.box(bx, 6.45, front + 0.36, 0.6, 0.6, 0.03, '#bfe3f2');
    v.box(bx - 1.5, 6.4, bz - 1.4, 0.8, 2.2, 0.8, '#b0645a');
    v.box(bx - 1.5, 8.6, bz - 1.4, 0.95, 0.2, 0.95, '#8f4f47');
    if (SEASON.snow) v.box(bx - 1.5, 8.8, bz - 1.4, 0.99, 0.1, 0.99, SNOW);
    return { w: Wd, doorHalf: 0.5, eave: { y: 5.67, z: front + 0.36, w: 6.6 }, wreath: { y: 1.55, z: front + 0.08 } };
  },

  // Korean tiled house: wooden pillars, paper lattice doors and a wide roof with lifted corners.
  hanok(v, bx, bz, front, st) {
    const wood = st.trim;
    const paper = st.door;
    v.box(bx, 0, bz, 7.3, 0.4, 6.3, '#b5afa3', { jitter: 0.02 });
    v.box(bx, 0.4, bz, 6.8, 2.7, 5.8, st.wall);
    // pillars and beams
    for (const x of [-3.3, -1.15, 1.15, 3.3]) {
      v.box(bx + x, 0.4, bz + 2.84, 0.3, 2.7, 0.3, wood);
      v.box(bx + x, 0.4, bz - 2.84, 0.3, 2.7, 0.3, wood);
    }
    v.box(bx, 2.82, bz + 2.84, 6.9, 0.28, 0.32, wood);
    v.box(bx, 0.4, bz + 2.84, 6.9, 0.14, 0.32, wood);
    mirrorX((s) => v.box(bx + s * 3.3, 2.82, bz, 0.3, 0.28, 5.9, wood));
    // lattice doors in the middle bay
    v.box(bx, 0.54, bz + 2.93, 2.0, 2.28, 0.06, paper);
    for (const dx of [-0.75, -0.5, -0.25, 0.25, 0.5, 0.75]) v.box(bx + dx, 0.54, bz + 2.97, 0.04, 2.28, 0.02, wood);
    v.box(bx, 0.54, bz + 2.97, 0.1, 2.28, 0.03, wood);
    for (const yy of [0.95, 1.5, 2.05, 2.5]) v.box(bx, yy, bz + 2.97, 2.0, 0.04, 0.02, wood);
    // lattice windows in the side bays
    for (const sx of [-1, 1]) {
      const wx = bx + sx * 2.22;
      v.box(wx, 1.2, bz + 2.91, 1.5, 1.2, 0.05, wood);
      v.box(wx, 1.28, bz + 2.93, 1.34, 1.04, 0.05, paper);
      for (const dx of [-0.45, -0.15, 0.15, 0.45]) v.box(wx + dx, 1.28, bz + 2.97, 0.04, 1.04, 0.02, wood);
      for (const yy of [1.55, 1.95]) v.box(wx, yy, bz + 2.97, 1.34, 0.04, 0.02, wood);
    }
    // roof: rafters, a wide eave with lifted corners, then tiles up to the ridge
    const tile = st.roof;
    v.box(bx, 3.1, bz, 8.0, 0.1, 6.9, wood);
    v.box(bx, 3.2, bz, 8.6, 0.26, 7.4, tile, { jitter: 0.03 });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        v.box(bx + sx * 4.1, 3.36, bz + sz * 3.5, 0.8, 0.2, 0.8, tile);
        v.box(bx + sx * 4.3, 3.5, bz + sz * 3.7, 0.45, 0.2, 0.45, tile);
      }
    }
    const layers = [[7.6, 6.2], [6.6, 4.8], [5.8, 3.4], [5.2, 2.0]];
    hipRoof(v, bx, bz, 3.46, layers, 0.4, tile, 0.03);
    if (!SEASON.snow) {
      // rows of round tiles running down the front and back slopes
      const ridge = new THREE.Color(tile).offsetHSL(0, 0, 0.09).getStyle();
      const edges = [7.4, ...layers.map((l) => l[1]), 0.6];
      layers.forEach(([w], i) => {
        const tread = (edges[i] - edges[i + 1]) / 2;
        for (let x = -w / 2 + 0.3; x <= w / 2 - 0.29; x += 0.5) {
          for (const sz of [-1, 1]) v.box(bx + x, 3.46 + i * 0.4, bz + sz * (edges[i + 1] / 2 + tread / 2), 0.14, 0.06, tread, ridge);
        }
      });
    }
    v.box(bx, 5.06, bz, 5.4, 0.34, 0.6, '#33373e');
    mirrorX((s) => v.box(bx + s * 2.75, 5.26, bz, 0.5, 0.3, 0.7, '#33373e'));
    if (SEASON.snow) v.box(bx, 5.4, bz, 5.0, 0.12, 0.64, SNOW);
    return { doorHalf: 0.9, eave: { y: 3.17, z: bz + 3.75, w: 8.3 }, wreath: { y: 1.6, z: bz + 3.02 } };
  },
};

/** Walls, corner trims and gable roof shared by the barn and the cottage. */
function classicShell(v, bx, bz, st) {
  const Wd = 7;
  const Dp = 6;
  v.box(bx, 0, bz, Wd + 0.3, 0.3, Dp + 0.3, '#a59d90');
  v.box(bx, 0.3, bz, Wd, 3.0, Dp, st.wall, { jitter: 0.02 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      v.box(bx + sx * (Wd / 2 - 0.1), 0.3, bz + sz * (Dp / 2 - 0.1), 0.27, 3.0, 0.27, st.trim);
    }
  }
  gableRoof(v, bx, bz, 3.3, STANDARD_ROOF, Dp + 0.6, st.roof, st.wall);
}

// ---------------------------------------------------------------------------
// Door pads: a glowing round mat in front of each house door.
// ---------------------------------------------------------------------------

/** How far in front of the door the pad's center lies. */
const PAD_OFFSET = 1.05;

/** A pixel-art disc on the ground: a blue ring around a pale middle. */
export function addPad(v, x, z, y = 0.07) {
  const R = 0.82;
  const px = 0.164;
  const row = (r, yy, color) => {
    for (let dz = -r + px / 2; dz < r; dz += px) {
      const w = Math.round((2 * Math.sqrt(r * r - dz * dz)) / px) * px;
      if (w > 0) v.box(x, yy, z + dz, w, 0.02, px, color);
    }
  };
  row(R, y, '#7fd6ff');
  row(R - 0.2, y + 0.01, '#eafaff');
  row(R - 0.5, y + 0.02, '#fff6c9');
}

/** Small lights that rise from each pad and fade, five per pad, drawn as one instanced mesh. */
export function padSparkles(spots) {
  const PER = 5;
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: '#fffbe0' }),
    Math.max(1, spots.length * PER),
  );
  mesh.frustumCulled = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  return {
    mesh,
    update(t) {
      spots.forEach((s, i) => {
        for (let k = 0; k < PER; k++) {
          const phase = (t * 0.45 + k / PER + i * 0.37) % 1;
          const a = k * 2.4 + i;
          const size = Math.sin(phase * Math.PI);
          pos.set(s.x + Math.cos(a) * 0.5, 0.15 + phase * 1.5, s.z + Math.sin(a) * 0.5);
          scale.setScalar(size);
          mesh.setMatrixAt(i * PER + k, m.compose(pos, q, scale));
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/** A small Christmas wreath with a red bow, centered at (x, y) on a wall facing +z. */
function addWreath(v, x, y, z) {
  const g = '#2f8a4a';
  const r = 0.3;
  v.box(x, y + r - 0.08, z, 0.44, 0.16, 0.06, g);
  v.box(x, y - r - 0.08, z, 0.44, 0.16, 0.06, g);
  mirrorX((s) => v.box(x + s * r, y - 0.22, z, 0.16, 0.44, 0.06, g));
  mirrorX((s) => mirrorX((t) => v.box(x + s * 0.21, y + t * 0.21 - 0.07, z, 0.14, 0.14, 0.06, '#3a9a55')));
  for (const [dx, dy] of [[-0.24, 0.12], [0.27, -0.05], [0.05, 0.28]]) v.box(x + dx, y + dy - 0.05, z + 0.03, 0.08, 0.08, 0.04, '#e53b3b');
  v.box(x, y - r - 0.12, z + 0.04, 0.26, 0.16, 0.05, '#d92e2e');
  mirrorX((s) => v.box(x + s * 0.08, y - r - 0.32, z + 0.04, 0.07, 0.22, 0.04, '#d92e2e'));
}

function buildSilo(v, x, z, rng) {
  const body = rng.pick(['#d9dde3', '#c9d6e6', '#e6dccb']);
  const band = '#9aa3ad';
  const roof = rng.pick(['#5b6d84', '#8a4a42', '#4f6b52']);
  v.box(x, 0, z, 2.0, 5, 2.0, body);
  v.box(x, 0, z, 2.4, 5, 1.4, body);
  v.box(x, 0, z, 1.4, 5, 2.4, body);
  for (const y of [1.4, 3.1]) {
    v.box(x, y, z, 2.46, 0.16, 1.46, band);
    v.box(x, y, z, 1.46, 0.16, 2.46, band);
    v.box(x, y, z, 2.06, 0.16, 2.06, band);
  }
  v.box(x, 5, z, 2.1, 0.4, 2.1, roof);
  v.box(x, 5.4, z, 1.5, 0.35, 1.5, roof);
  v.box(x, 5.75, z, 0.9, 0.3, 0.9, roof);
  if (SEASON.snow) {
    v.box(x, 5.4, z, 2.14, 0.08, 2.14, SNOW);
    v.box(x, 5.75, z, 1.54, 0.08, 1.54, SNOW);
    v.box(x, 6.05, z, 0.94, 0.14, 0.94, SNOW);
  }
}

function buildHayBale(v, x, z) {
  v.box(x, 0, z, 1.05, 0.8, 0.85, '#e8c45a', { jitter: 0.04 });
  v.box(x - 0.25, 0, z, 0.08, 0.82, 0.87, '#c9a23f');
  v.box(x + 0.25, 0, z, 0.08, 0.82, 0.87, '#c9a23f');
  if (SEASON.snow) v.box(x, 0.82, z, 1.07, 0.1, 0.89, SNOW);
  if (SEASON.autumn) addPumpkin(v, x + 0.1, 0.82, z, 0.8);
  if (SEASON.summer) addWatermelon(v, x + 0.1, 0.82, z, 0.8);
}

/** A striped watermelon sitting at height y. `s` scales it. */
function addWatermelon(v, x, y, z, s = 1) {
  v.box(x, y, z, 0.62 * s, 0.46 * s, 0.5 * s, '#3f8f3a');
  for (const dx of [-0.2, 0, 0.2]) v.box(x + dx * s, y, z, 0.07 * s, 0.47 * s, 0.52 * s, '#24622a');
  v.box(x, y + 0.46 * s, z, 0.05 * s, 0.08 * s, 0.05 * s, '#5a7d2a');
}

/** Spring picnic: a checkered mat, a basket and a lunch box. */
function buildPicnic(v, x, z, addCollider) {
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      v.box(x - 1.2 + i * 0.8, 0.07, z - 0.8 + j * 0.8, 0.8, 0.04, 0.8, (i + j) & 1 ? '#fffaf0' : '#e45b5b');
    }
  }
  const bx = x + 0.6;
  const bz = z - 0.3;
  v.box(bx, 0.11, bz, 0.72, 0.42, 0.5, '#b7834a', { jitter: 0.04 });
  v.box(bx, 0.53, bz, 0.76, 0.06, 0.54, '#9a6a38');
  mirrorX((t) => v.box(bx + t * 0.3, 0.59, bz, 0.06, 0.3, 0.06, '#9a6a38'));
  v.box(bx, 0.86, bz, 0.66, 0.06, 0.06, '#9a6a38');
  v.box(x - 0.6, 0.11, z + 0.15, 0.62, 0.2, 0.44, '#3d7fd1');
  v.box(x - 0.6, 0.31, z + 0.15, 0.64, 0.05, 0.46, '#f4f1ea');
  addCollider(bx, bz, 0.8, 0.6, 0.9);
}

/** A small bed of tulips. */
function buildTulips(v, x, z, addCollider) {
  v.box(x, 0, z, 2.0, 0.3, 1.5, '#b9a98c');
  v.box(x, 0, z, 1.8, 0.36, 1.3, '#8a5a36');
  const colors = ['#e8433a', '#f6c21c', '#f59bb8', '#fffaf0', '#e8433a', '#c2408a'];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      const tx = x - 0.66 + i * 0.44;
      const tz = z - 0.4 + j * 0.4;
      v.box(tx, 0.36, tz, 0.05, 0.3, 0.05, '#4f9a3c');
      v.box(tx, 0.62, tz, 0.17, 0.22, 0.17, colors[(i * 3 + j) % colors.length]);
    }
  }
  addCollider(x, z, 2.0, 1.5, 0.5);
}

/** Summer: a striped parasol over a cooler and a watermelon. */
function buildParasol(v, x, z, addCollider) {
  v.box(x, 0.07, z, 0.1, 2.7, 0.1, '#f4f1ea');
  [[2.8, 0.12], [2.2, 0.14], [1.5, 0.14], [0.8, 0.12]].forEach(([w, h], i) => {
    v.box(x, 2.5 + i * 0.13, z, w, h, w, i % 2 ? '#fffaf0' : '#e84a4a');
  });
  v.box(x + 0.6, 0.07, z + 0.3, 0.7, 0.45, 0.45, '#3d9be0');
  v.box(x + 0.6, 0.52, z + 0.3, 0.74, 0.08, 0.49, '#f4f1ea');
  addWatermelon(v, x - 0.6, 0.07, z + 0.35, 1.0);
  addCollider(x, z + 0.2, 2.0, 1.0, 0.7);
}

/** A paddling pool with a rubber duck. */
function buildPool(v, x, z, addCollider) {
  v.box(x, 0.07, z, 2.2, 0.38, 2.2, '#5fb4ef');
  v.box(x, 0.07, z, 1.7, 0.4, 1.7, '#8fd6f5');
  v.box(x - 0.2, 0.47, z + 0.15, 0.3, 0.22, 0.26, '#f6d02f');
  v.box(x - 0.07, 0.62, z + 0.15, 0.18, 0.18, 0.18, '#f6d02f');
  v.box(x + 0.04, 0.66, z + 0.15, 0.1, 0.06, 0.1, '#f39a1f');
  addCollider(x, z, 2.2, 2.2, 0.45);
}

/** A pumpkin sitting at height y. `s` scales it. */
function addPumpkin(v, x, y, z, s = 1) {
  v.box(x, y, z, 0.62 * s, 0.42 * s, 0.54 * s, '#f0891d');
  v.box(x, y, z, 0.42 * s, 0.44 * s, 0.58 * s, '#e07a14');
  v.box(x, y + 0.42 * s, z, 0.07 * s, 0.13 * s, 0.07 * s, '#5a7d2a');
}

/** A heap of fallen leaves. */
function buildLeafPile(v, x, z) {
  const local = makeRng(`leaf-pile|${x.toFixed(2)}|${z.toFixed(2)}`);
  [[1.9, 0.22, 1.6], [1.4, 0.2, 1.2], [0.8, 0.16, 0.7]].forEach(([w, h, d], i) => {
    for (let k = 0; k < 5; k++) {
      const c = local.pick(AUTUMN_LEAVES);
      v.box(x + local.range(-0.25, 0.25) * w, i * 0.2, z + local.range(-0.25, 0.25) * d, w * 0.6, h, d * 0.6, c, { jitter: 0.05 });
    }
  });
}

function buildHayStack(v, x, z) {
  v.box(x, 0, z, 2.6, 0.9, 2.0, '#e8c45a', { jitter: 0.04 });
  v.box(x, 0.9, z, 2.0, 0.6, 1.5, '#efce6a', { jitter: 0.04 });
  v.box(x, 1.5, z, 1.2, 0.4, 0.9, '#f3d77a', { jitter: 0.04 });
  if (SEASON.snow) {
    v.box(x, 0.9, z, 2.64, 0.08, 2.04, SNOW);
    v.box(x, 1.5, z, 2.04, 0.08, 1.54, SNOW);
    v.box(x, 1.9, z, 1.24, 0.14, 0.94, SNOW);
  }
}

function buildCrops(field, fx, fz, kind, rng) {
  field.box(fx, 0, fz, 8.2, 0.16, 6.2, COLOR.soil);
  // In the snow season the field is a blanket of snow with ridges showing the rows,
  // and the plants go to a builder that is thrown away.
  const snow = SEASON.snow;
  const v = snow ? discard() : field;
  const rows = [-3, -1, 1, 3];
  for (const ox of rows) {
    field.box(fx + ox, 0.16, fz, 0.9, snow ? 0.16 : 0.08, 5.8, COLOR.soilRidge);
    for (let k = 0; k < 6; k++) {
      const px = fx + ox;
      const pz = fz - 2.5 + k;
      const y = 0.24;
      switch (kind) {
        case 'carrot':
          v.box(px, 0.2, pz, 0.24, 0.1, 0.24, '#f08a24');
          v.box(px, y, pz, 0.12, 0.38, 0.12, '#58a83f');
          v.box(px + 0.1, y, pz + 0.04, 0.1, 0.26, 0.1, '#6cbf4c');
          v.box(px - 0.09, y, pz - 0.05, 0.1, 0.3, 0.1, '#6cbf4c');
          break;
        case 'cabbage':
          v.box(px, y, pz, 0.62, 0.36, 0.62, '#86c35f', { jitter: 0.05 });
          v.box(px, y + 0.06, pz, 0.42, 0.42, 0.42, '#b9e28e');
          break;
        case 'wheat':
          for (const dx of [-0.2, 0.05, 0.25]) {
            const h = rng.range(0.7, 0.95);
            v.box(px + dx, y, pz + rng.range(-0.2, 0.2), 0.07, h, 0.07, '#cfa944');
            v.box(px + dx, y + h - 0.05, pz, 0.13, 0.26, 0.13, '#efcd63');
          }
          break;
        case 'pumpkin':
          if (k % 2 === 0) {
            v.box(px, y, pz + 0.5, 0.74, 0.5, 0.64, '#f0891d');
            v.box(px, y, pz + 0.5, 0.5, 0.52, 0.68, '#e07a14');
            v.box(px, y + 0.5, pz + 0.5, 0.08, 0.14, 0.08, '#5a7d2a');
          } else {
            v.box(px + 0.25, y, pz + 0.3, 0.5, 0.05, 0.45, '#4f9a3c');
          }
          break;
        case 'strawberry':
          v.box(px, y, pz, 0.52, 0.22, 0.52, '#4f9e42', { jitter: 0.05 });
          v.box(px + 0.2, y + 0.04, pz + 0.22, 0.13, 0.13, 0.11, '#e5303e');
          v.box(px - 0.2, y + 0.02, pz + 0.12, 0.12, 0.12, 0.1, '#e5303e');
          break;
        case 'corn': {
          // Ready for harvest in autumn: the stalks have dried.
          const stalk = SEASON.autumn ? '#bca55a' : '#6ea33e';
          const blade = SEASON.autumn ? '#cdb46a' : '#7fb84a';
          v.box(px, y, pz, 0.12, 1.5, 0.12, stalk);
          v.box(px, y + 0.7, pz, 0.7, 0.05, 0.12, blade, { ry: rng.range(0, Math.PI) });
          v.box(px, y + 1.1, pz, 0.6, 0.05, 0.12, blade, { ry: rng.range(0, Math.PI) });
          v.box(px + 0.11, y + 0.75, pz, 0.12, 0.3, 0.12, '#f2cf4a');
          v.box(px, y + 1.5, pz, 0.06, 0.22, 0.06, '#d9c06a');
          break;
        }
        default:
          break;
      }
    }
  }
  if (rng.chance(0.45)) buildScarecrow(field, fx + rng.pick([-2, 0, 2]), fz + 3.1);
}

function buildScarecrow(v, x, z) {
  v.box(x, 0, z, 0.14, 1.9, 0.14, COLOR.woodDark);
  v.box(x, 1.3, z, 1.5, 0.12, 0.12, COLOR.woodDark);
  v.box(x, 0.85, z, 0.6, 0.65, 0.34, '#d0584e');
  v.box(x, 1.55, z, 0.46, 0.44, 0.4, '#e6cf98');
  v.box(x - 0.1, 1.72, z + 0.205, 0.07, 0.07, 0.02, '#3b2a20');
  v.box(x + 0.1, 1.72, z + 0.205, 0.07, 0.07, 0.02, '#3b2a20');
  v.box(x, 1.98, z, 0.9, 0.06, 0.8, '#ecc96d');
  v.box(x, 2.0, z, 0.5, 0.24, 0.46, '#ecc96d');
  if (SEASON.snow) v.box(x, 2.24, z, 0.52, 0.08, 0.48, SNOW);
}

/** A snowman with a scarf and a bucket hat, facing +z. */
function buildSnowman(v, x, z) {
  const W = '#fbfdff';
  v.box(x, 0, z, 1.2, 0.95, 1.2, W);
  v.box(x, 0.12, z, 1.42, 0.7, 1.0, W);
  v.box(x, 0.12, z, 1.0, 0.7, 1.42, W);
  v.box(x, 0.9, z, 0.92, 0.72, 0.92, W);
  v.box(x, 1.0, z, 1.06, 0.52, 0.76, W);
  v.box(x, 1.0, z, 0.76, 0.52, 1.06, W);
  v.box(x, 1.66, z, 0.72, 0.62, 0.72, W);
  // scarf
  v.box(x, 1.56, z, 0.84, 0.16, 0.84, '#d93a3a');
  v.box(x + 0.24, 1.18, z + 0.43, 0.18, 0.42, 0.06, '#d93a3a');
  // face and buttons
  mirrorX((s) => v.box(x + s * 0.15, 1.98, z + 0.36, 0.09, 0.09, 0.02, '#2b2a3d'));
  v.box(x, 1.84, z + 0.5, 0.1, 0.1, 0.3, '#f08a24');
  for (const y of [1.15, 1.35]) v.box(x, y, z + 0.47, 0.09, 0.09, 0.02, '#2b2a3d');
  // twig arms
  mirrorX((s) => v.box(x + s * 0.8, 1.28, z, 0.7, 0.07, 0.07, '#6b4a35', { rz: s * 0.45, center: true }));
  // bucket hat
  v.box(x, 2.28, z, 0.66, 0.08, 0.66, '#3d4a63');
  v.box(x, 2.36, z, 0.5, 0.34, 0.5, '#4f6b8a');
  v.box(x, 2.7, z, 0.54, 0.06, 0.54, SNOW);
}

/** The plaza Christmas tree: stepped tiers with snow, ornaments, a star and twinkling bulbs. */
function buildChristmasTree(v, bulbs, x, z) {
  const rng = makeRng('christmas-tree');
  v.box(x, 0, z, 0.8, 1.2, 0.8, '#7a4b2b');
  const tiers = [4.6, 3.9, 3.2, 2.5, 1.8, 1.1, 0.5];
  let n = 0;
  tiers.forEach((w, i) => {
    const y = 0.8 + i * 0.8;
    v.box(x, y, z, w, 0.95, w, i % 2 ? '#2f7d45' : '#358a4c', { jitter: 0.05 });
    if (SEASON.snow) v.box(x, y + 0.95, z, w + 0.04, 0.1, w + 0.04, SNOW);
    if (w < 1) return;
    const half = w / 2 + 0.06;
    const per = Math.max(2, Math.round(w / 0.62));
    for (let k = 0; k < per; k++) {
      const along = -w / 2 + (w * (k + 0.5)) / per;
      for (const [dx, dz] of [[along, half], [along, -half], [half, along], [-half, along]]) {
        bulbs[n % 2].box(x + dx, y + 0.1, z + dz, 0.15, 0.15, 0.15, BULB_COLORS[n % BULB_COLORS.length]);
        n += 1;
      }
    }
    // ornaments
    for (let k = 0; k < 3; k++) {
      const side = rng.int(0, 3);
      const along = rng.range(-w / 2 + 0.3, w / 2 - 0.3);
      const ox = side === 0 ? along : side === 1 ? along : side === 2 ? half : -half;
      const oz = side === 0 ? half : side === 1 ? -half : along;
      v.box(x + ox, y + 0.45, z + oz, 0.26, 0.26, 0.26, rng.pick(['#d93a3a', '#f2c94c', '#3f7fd9', '#e6ebf2']));
    }
  });
  // star
  const top = 0.8 + tiers.length * 0.8 + 0.2;
  const star = '#ffe066';
  bulbs[0].box(x, top, z, 0.22, 1.0, 0.16, star);
  bulbs[0].box(x, top + 0.42, z, 1.0, 0.22, 0.16, star);
  bulbs[0].box(x, top + 0.53, z, 0.5, 0.5, 0.16, star, { rz: Math.PI / 4, center: true });
  // presents in front
  [[-1.35, 2.75, 0.7, 0.6, '#d93a3a', '#f2c94c'], [0.0, 2.9, 0.8, 0.5, '#3f7fd9', '#ffffff'], [1.3, 2.7, 0.6, 0.7, '#3a9a55', '#d93a3a']].forEach(
    ([dx, dz, s, h, box, ribbon]) => {
      v.box(x + dx, 0, z + dz, s, h, s, box);
      v.box(x + dx, 0, z + dz, 0.12, h + 0.02, s + 0.02, ribbon);
      v.box(x + dx, 0, z + dz, s + 0.02, h + 0.02, 0.12, ribbon);
      v.box(x + dx, h, z + dz, 0.3, 0.12, 0.12, ribbon);
    },
  );
}

// ---------------------------------------------------------------------------
// Plaza: fountain with the cloud mascot, windmill, notice board, welcome arch.
// ---------------------------------------------------------------------------

function buildPlaza(scene, v, cell, rng, addCollider, updaters, decor, contribute) {
  const snow = SEASON.snow;
  const cx = cell.x;
  const cz = cell.z;
  for (let i = -6; i < 6; i++) {
    for (let j = -6; j < 6; j++) {
      v.box(cx + i * 2 + 1, 0, cz + j * 2 + 1, 2, 0.07, 2, (i + j) & 1 ? '#ece5d4' : '#e0d6c0');
    }
  }

  // fountain
  const fz = cz - 1;
  v.box(cx, 0, fz, 4.6, 0.65, 4.6, COLOR.stone);
  v.box(cx, 0, fz, 3.9, 0.68, 3.9, COLOR.water);
  v.box(cx, 0, fz, 1.0, 1.5, 1.0, COLOR.stone);
  v.box(cx, 1.5, fz, 1.9, 0.3, 1.9, COLOR.stone);
  v.box(cx, 1.5, fz, 1.5, 0.33, 1.5, COLOR.water);
  addCollider(cx, fz, 4.6, 4.6, 0.65);

  const mascot = createMascot();
  mascot.position.set(cx, 4.9, fz);
  scene.add(mascot);
  updaters.push((dt, t) => {
    mascot.position.y = 4.9 + Math.sin(t * 1.4) * 0.25;
    mascot.rotation.y = Math.sin(t * 0.5) * 0.35;
  });

  // water droplets
  const drops = new THREE.Group();
  const dropMat = new THREE.MeshLambertMaterial({ color: '#a9defa' });
  const dropGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
  const dropList = [];
  for (let k = 0; k < 10; k++) {
    const m = new THREE.Mesh(dropGeo, dropMat);
    drops.add(m);
    dropList.push({ m, a: (k / 10) * Math.PI * 2, off: k / 10 });
  }
  drops.position.set(cx, 0, fz);
  // The fountain is frozen in the snow season, so it has no spray.
  if (!snow) {
    scene.add(drops);
    updaters.push((dt, t) => {
      for (const d of dropList) {
        const p = (t * 0.8 + d.off) % 1;
        const r = 0.2 + p * 1.1;
        d.m.position.set(Math.cos(d.a) * r, 1.85 + Math.sin(p * Math.PI) * 0.8 - p * 1.2, Math.sin(d.a) * r);
      }
    });
  } else {
    // snow along the stone rim
    for (const s of [-1, 1]) {
      v.box(cx, 0.65, fz + s * 2.12, 4.64, 0.08, 0.38, SNOW);
      v.box(cx + s * 2.12, 0.65, fz, 0.38, 0.08, 4.64, SNOW);
    }
  }

  // windmill
  const wx = cx - 7.6;
  const wz = cz - 7.6;
  v.box(wx, 0, wz, 4.2, 1.0, 4.2, '#c5bba8');
  v.box(wx, 1.0, wz, 3.6, 2.4, 3.6, '#f4eee2');
  v.box(wx, 3.4, wz, 3.2, 2.4, 3.2, '#f1eade');
  v.box(wx, 5.8, wz, 2.8, 1.6, 2.8, '#eee6d8');
  const roof = '#c7513f';
  [[3.4, 0.5], [2.6, 0.5], [1.7, 0.5], [0.8, 0.45]].forEach(([w, h], i) => {
    v.box(wx, 7.4 + i * 0.5, wz, w, h, w, roof);
    if (snow) v.box(wx, 7.4 + i * 0.5 + h, wz, w + 0.04, i === 3 ? 0.16 : 0.1, w + 0.04, SNOW);
  });
  if (snow) {
    for (const [y, w] of [[1.0, 4.2], [3.4, 3.6], [5.8, 3.2]]) v.box(wx, y, wz, w + 0.04, 0.1, w + 0.04, SNOW);
  }
  v.box(wx, 1.0, wz + 1.81, 1.1, 1.7, 0.04, '#7a4b2b');
  v.box(wx, 4.0, wz + 1.61, 0.8, 0.8, 0.04, '#bfe3f2');
  v.box(wx, 6.2, wz + 1.6, 0.6, 0.6, 0.6, '#6b4a35');
  addCollider(wx, wz, 4.2, 4.2, 10);

  const blades = new THREE.Group();
  const bv = new Voxels();
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const rot = { rz: a, center: true };
    bv.box(-s * 2.1, c * 2.1, 0, 0.16, 4.2, 0.12, '#6b4a35', rot);
    bv.box(-s * 2.5 + c * 0.45, c * 2.5 + s * 0.45, 0.04, 0.8, 3.0, 0.05, '#fbf7ee', rot);
  }
  bv.box(0, 0, 0.1, 0.4, 0.4, 0.3, '#4a3424', { center: true });
  blades.add(bv.mesh());
  blades.position.set(wx, 6.5, wz + 2.05);
  scene.add(blades);
  updaters.push((dt) => {
    blades.rotation.z -= dt * 0.6;
  });

  // welcome arch on the north edge, so it never hides the player from the camera
  const az = cz - 11.2;
  for (const s of [-1, 1]) {
    v.box(cx + s * 3.6, 0, az, 0.6, 0.4, 0.6, COLOR.stone);
    v.box(cx + s * 3.6, 0.4, az, 0.42, 3.4, 0.42, COLOR.woodDark);
    addCollider(cx + s * 3.6, az, 0.6, 0.6, 4);
  }
  v.box(cx, 3.6, az, 8.0, 0.3, 0.5, COLOR.woodDark);
  v.box(cx, 3.9, az, 6.0, 1.3, 0.2, '#fffaf0');
  v.box(cx, 3.84, az, 6.3, 0.12, 0.26, '#6fbdf2');
  v.box(cx, 5.2, az, 6.3, 0.12, 0.26, '#6fbdf2');
  if (snow) {
    v.box(cx, 5.32, az, 6.34, 0.14, 0.3, SNOW);
    mirrorX((s) => v.box(cx + s * 3.5, 3.9, az, 1.04, 0.1, 0.54, SNOW));
  }
  const welcome = new THREE.Mesh(
    new THREE.PlaneGeometry(5.8, 1.25),
    new THREE.MeshLambertMaterial({ map: textTexture('☁ 클클 타운 ☁', { width: 768, height: 160, font: 'bold 92px Galmuri11', color: '#2e4a7d' }), transparent: true }),
  );
  welcome.position.set(cx, 4.55, az + 0.105);
  scene.add(welcome);

  // notice board
  const board = { x: cx + 7.4, z: cz + 4.2 };
  for (const s of [-1, 1]) v.box(board.x + s * 1.3, 0, board.z, 0.22, 2.4, 0.22, COLOR.woodDark);
  v.box(board.x, 0.9, board.z, 3.0, 1.5, 0.18, COLOR.wood);
  v.box(board.x, 2.4, board.z, 3.4, 0.2, 0.5, '#c7513f');
  if (snow) v.box(board.x, 2.6, board.z, 3.44, 0.12, 0.54, SNOW);
  [[-0.9, 1.2, '#fffaf0'], [0.05, 1.25, '#fff1a8'], [0.95, 1.05, '#d9f0ff'], [-0.35, 1.0, '#ffe0e6']].forEach(([dx, y, c]) => {
    v.box(board.x + dx, y, board.z + 0.1, 0.6, 0.55, 0.02, c);
  });
  addCollider(board.x, board.z, 3.0, 0.4, 3);
  const boardTitle = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.42),
    new THREE.MeshLambertMaterial({ map: textTexture('마을 안내판', { width: 512, height: 84, font: 'bold 56px Galmuri11', color: '#fffaf0', bg: '#7a4b2b' }) }),
  );
  boardTitle.position.set(board.x, 2.12, board.z + 0.1);
  scene.add(boardTitle);

  // benches
  for (const [x, z] of [[cx - 5.2, cz + 5], [cx + 4.2, cz - 6.6]]) {
    v.box(x, 0, z, 0.2, 0.45, 0.6, COLOR.woodDark);
    v.box(x + 1.6, 0, z, 0.2, 0.45, 0.6, COLOR.woodDark);
    v.box(x + 0.8, 0.45, z, 2.2, 0.12, 0.7, COLOR.wood);
    v.box(x + 0.8, 0.57, z - 0.32, 2.2, 0.55, 0.1, COLOR.wood);
    if (snow) v.box(x + 0.8, 0.57, z + 0.04, 2.2, 0.07, 0.6, SNOW);
    addCollider(x + 0.8, z, 2.2, 0.8, 0.6);
  }

  // flower beds (under snow in the snow season). The bed that stood beside the GitHub sign was
  // removed; it is still built into a throwaway Voxels so its rng picks stay and everything built
  // after the plaza keeps its look.
  for (const [x, z, removed] of [[cx - 8.6, cz + 1.5], [cx + 7.5, cz - 4.6], [cx - 3.2, cz + 8.6, true], [cx + 3.2, cz + 8.6]]) {
    const bed = removed ? discard() : v;
    bed.box(x, 0, z, 3.0, 0.35, 1.8, '#b9a98c');
    bed.box(x, 0, z, 2.7, snow ? 0.46 : 0.4, 1.5, COLOR.soil);
    for (let k = 0; k < 9; k++) {
      const color = bloom(rng.pick(FLOWER_COLORS));
      if (!snow) bed.box(x - 1.0 + (k % 3) * 1.0, 0.4, z - 0.45 + Math.floor(k / 3) * 0.45, 0.28, 0.24, 0.28, color);
    }
    if (!removed) addCollider(x, z, 3.0, 1.8, 0.4);
  }

  // Trees in the corners. In the Christmas season the north-east one makes way for the
  // Christmas tree, which stands where the camera sees it without hiding the player.
  const tree = { x: cx + 9.2, z: cz - 9.0 };
  [[cx + 9.6, cz - 9.4], [cx - 10, cz + 9.6], [cx + 10, cz + 9.6]].forEach(([x, z], i) => {
    if (decor && i === 0) {
      addTree(discard(), x, z, rng, 'round', 0.95);
      buildChristmasTree(v, decor.bulbs, tree.x, tree.z);
      addCollider(tree.x, tree.z, 4.6, 4.6, 8);
      addCollider(tree.x, tree.z + 2.75, 3.6, 0.9, 0.8);
      return;
    }
    addTree(v, x, z, rng, 'round', 0.95);
    addCollider(x, z, 0.8, 0.8, 8);
  });

  // snowmen on the open corners of the plaza
  if (snow) {
    for (const [x, z] of [[cx - 9.6, cz + 5.6], [cx + 7.6, cz + 8.2]]) {
      buildSnowman(v, x, z);
      addCollider(x, z, 1.3, 1.3, 2.8);
    }
  }

  // GitHub sign by the south entrance. E opens the town's repository.
  let github = null;
  if (contribute) {
    github = { x: cx - 7.0, z: cz + 8.8 };
    const { x: gx, z: gz } = github;
    for (const s of [-1, 1]) v.box(gx + s * 1.05, 0, gz, 0.22, 2.3, 0.22, COLOR.woodDark);
    v.box(gx, 0.75, gz, 2.5, 1.75, 0.16, COLOR.woodDark);
    v.box(gx, 0.82, gz + 0.02, 2.3, 1.6, 0.16, '#24292f');
    if (snow) v.box(gx, 2.5, gz, 2.54, 0.1, 0.24, SNOW);
    addCollider(gx, gz, 2.5, 0.4, 2.6);
    const mark = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.3),
      new THREE.MeshLambertMaterial({ map: pathTexture(GITHUB_MARK, '#ffffff'), transparent: true }),
    );
    mark.position.set(gx, 1.62, gz + 0.11);
    scene.add(mark);
  }

  // Spring and summer use the same open corners.
  if (SEASON.spring) {
    buildPicnic(v, cx + 7.0, cz + 8.2, addCollider);
    buildTulips(v, cx - 9.6, cz + 5.6, addCollider);
  } else if (SEASON.summer) {
    buildParasol(v, cx + 7.6, cz + 8.2, addCollider);
    buildPool(v, cx - 9.6, cz + 5.6, addCollider);
  }

  // Autumn harvest on the same open corners: a hay bale with pumpkins and a heap of leaves.
  if (SEASON.autumn) {
    const [hx, hz] = [cx + 7.6, cz + 8.2];
    buildHayBale(v, hx, hz);
    addPumpkin(v, hx - 0.95, 0, hz + 0.3, 1.1);
    addPumpkin(v, hx + 0.9, 0, hz + 0.45, 0.9);
    addPumpkin(v, hx + 0.2, 0, hz + 0.85, 0.7);
    addCollider(hx, hz + 0.3, 2.6, 1.6, 0.9);
    buildLeafPile(v, cx - 9.6, cz + 5.6);
    addCollider(cx - 9.6, cz + 5.6, 1.6, 1.4, 0.6);
  }

  return { cx, cz, board, tree, github, labelAnchor: new THREE.Vector3(cx, 7.8, fz) };
}

// ---------------------------------------------------------------------------
// Meadow with a pond
// ---------------------------------------------------------------------------

function buildMeadow(v, cell, rng, addCollider) {
  const cx = cell.x;
  const cz = cell.z;
  v.box(cx, 0, cz, 14, 0.05, 8, COLOR.sand);
  v.box(cx, 0, cz, 12, 0.05, 10, COLOR.sand);
  v.box(cx, 0, cz, 12.4, 0.08, 6.2, COLOR.water);
  v.box(cx, 0, cz, 10.4, 0.08, 8.2, COLOR.water);
  v.box(cx, 0, cz, 8, 0.09, 5, COLOR.waterDeep);
  // The pond is frozen in the snow season: no lily pads, dry reeds.
  const snow = SEASON.snow;
  const pads = snow ? discard() : v;
  for (let k = 0; k < 6; k++) {
    pads.box(cx + rng.range(-4.5, 4.5), 0.08, cz + rng.range(-2.6, 2.6), 0.7, 0.03, 0.6, '#5fae4f');
  }
  for (let k = 0; k < 10; k++) {
    const a = rng.range(0, Math.PI * 2);
    v.box(cx + Math.cos(a) * 6.3, 0, cz + Math.sin(a) * 4.2, 0.1, rng.range(0.6, 1.1), 0.1, snow || SEASON.autumn ? '#b5a273' : '#6c9e3c');
  }
  addCollider(cx, cz, 12.0, 6.0, 0.5);
  addCollider(cx, cz, 10.0, 8.0, 0.5);

  const trees = [];
  for (let k = 0; k < 7; k++) {
    const a = rng.range(0, Math.PI * 2);
    const x = cx + Math.cos(a) * rng.range(8.5, 10.5);
    const z = cz + Math.sin(a) * rng.range(7.2, 10);
    addTree(v, x, z, rng, rng.chance(0.3) ? 'pine' : 'round', rng.range(0.85, 1.15));
    addCollider(x, z, 0.8, 0.8, 8);
    trees.push([x, z]);
  }

  if (snow) {
    // A snowman by the pond, on the first spot clear of the trees.
    const spots = [[4.6, 7.0], [-4.6, 7.0], [8.4, 0], [-8.4, 0], [4.6, -7.0], [-4.6, -7.0]];
    const spot = spots.find(([dx, dz]) => trees.every(([x, z]) => Math.hypot(x - (cx + dx), z - (cz + dz)) > 2.4));
    if (spot) {
      buildSnowman(v, cx + spot[0], cz + spot[1]);
      addCollider(cx + spot[0], cz + spot[1], 1.3, 1.3, 2.8);
    }
  }
  for (let k = 0; k < 30; k++) {
    const x = cx + rng.range(-11.5, 11.5);
    const z = cz + rng.range(-11.5, 11.5);
    if (Math.abs(x - cx) < 7.5 && Math.abs(z - cz) < 5.5) continue;
    addFlower(v, x, z, rng.pick(FLOWER_COLORS));
  }
  return { swim: true, pasture: { minX: cx - 4.6, maxX: cx + 4.6, minZ: cz - 2.6, maxZ: cz + 2.6 } };
}
