import './style.css';
import * as THREE from 'three';
import { CONFIG, resolveOwners, guestbookReady } from './config.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Sky, TIMES, TIME_ORDER, timeForHour } from './sky.js';
import { Overlay, Minimap, Dialog, Prompt, toast, areaBanner, setupTouch } from './ui.js';
import { initSeason } from './season.js';
import { Falling, Fireflies, SNOWFALL, LEAFFALL, PETALFALL } from './falling.js';

const $ = (sel) => document.querySelector(sel);

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage can be unavailable (private mode); the setting just will not stick */
  }
}

const isTouch = window.matchMedia('(pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touch');

// ---------------------------------------------------------------------------
// Renderer, scene, camera
// ---------------------------------------------------------------------------

const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, stencil: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 600);

let lite = storageGet('clcl-lite') === '1';
const liteBox = $('#liteMode');
liteBox.checked = lite;

function applyQuality() {
  renderer.shadowMap.enabled = !lite;
  falling?.setLite(lite);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1 : 2));
  scene.traverse((o) => {
    if (o.material) o.material.needsUpdate = true;
  });
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}

liteBox.addEventListener('change', () => {
  lite = liteBox.checked;
  storageSet('clcl-lite', lite ? '1' : '0');
  applyQuality();
});

// ---------------------------------------------------------------------------
// Build the town once the pixel font is ready (signs are drawn with it).
// ---------------------------------------------------------------------------

async function fontsReady() {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('bold 64px Galmuri11'), document.fonts.load('14px Galmuri14')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* fall back to system fonts */
  }
}

await fontsReady();

const season = initSeason(CONFIG.seasons);
const owners = resolveOwners();
const world = buildWorld(scene, owners, {
  seed: CONFIG.seed,
  shuffle: CONFIG.shuffleEachVisit,
  animalsPerFarm: CONFIG.animalsPerFarm,
  plays: CONFIG.plays,
  roaming: CONFIG.roaming,
  contribute: CONFIG.contributeUrl,
});
const player = new Player();
scene.add(player.object);
player.teleport(world.spawn.x, world.spawn.z, Math.PI);

const sky = new Sky(scene, world);
// Snow in the snow season, leaves in autumn, cherry petals in spring, fireflies on summer nights.
const fallKind = season.snow ? SNOWFALL : season.autumn ? LEAFFALL : season.spring ? PETALFALL : null;
const falling = fallKind ? new Falling(scene, fallKind) : null;
const fireflies = season.summer ? new Fireflies(scene) : null;
// New Year's Day always opens at dawn to show the sunrise.
let timeKey = season.newyear ? 'morning' : timeForHour(new Date().getHours());
sky.apply(timeKey);

const overlay = new Overlay($('#labels'));
world.farms.forEach((f) => overlay.addFarmLabel(f));
overlay.addPlainLabel(world.plaza.labelAnchor, `<div class="name"><b>클클 광장</b></div>`, 'plaza');
const minimap = new Minimap($('#minimap'), world);
const dialog = new Dialog();
const prompt = new Prompt();

applyQuality();

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

const keys = new Set();
const input = { x: 0, z: 0, run: false, jump: false, joyX: 0, joyZ: 0, joyRun: false };
let state = 'intro'; // intro -> entering -> play

const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

window.addEventListener('keydown', (e) => {
  if (state === 'intro') {
    if (e.code === 'Enter') enterTown();
    return;
  }
  // Typing in a text box (the farm search) is not a game control. On a Korean keyboard ㄷ is
  // the E key and ㅇ is D, so the keys must reach the box. Escape still closes the window.
  if (e.target instanceof HTMLInputElement && e.target.type !== 'checkbox') {
    if (e.code === 'Escape' && dialog.open) dialog.close();
    return;
  }
  if (MOVE_KEYS.includes(e.code)) e.preventDefault();
  if (dialog.open) {
    if (e.code === 'Escape' || e.code === 'KeyE') {
      e.preventDefault();
      dialog.close();
    }
    return;
  }
  keys.add(e.code);
  if (e.code === 'Space' && !e.repeat) input.jump = true;
  if (e.code === 'KeyE' && !e.repeat) interact();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

function readInput() {
  let x = 0;
  let z = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
  x += input.joyX;
  z += input.joyZ;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  input.x = dialog.open ? 0 : x;
  input.z = dialog.open ? 0 : z;
  input.run = keys.has('ShiftLeft') || keys.has('ShiftRight') || input.joyRun;
}

setupTouch(input, () => {
  if (dialog.open) dialog.close();
  else interact();
});

let zoom = 1;
window.addEventListener(
  'wheel',
  (e) => {
    if (state !== 'play' || dialog.open) return;
    zoom = Math.max(0.6, Math.min(1.7, zoom * (e.deltaY > 0 ? 1.08 : 0.93)));
  },
  { passive: true },
);

// ---------------------------------------------------------------------------
// Interaction
// ---------------------------------------------------------------------------

let focus = null;

function findFocus() {
  const p = player.pos;
  let best = null;
  let bestD = Infinity;
  for (const it of world.interactables) {
    const d = Math.hypot(it.x - p.x, it.z - p.z);
    if (d < it.r && d < bestD) {
      best = it;
      bestD = d;
    }
  }
  for (const a of world.animals) {
    const d = Math.hypot(a.pos.x - p.x, a.pos.z - p.z) - a.radius;
    if (d < 1.3 && d < bestD) {
      best = { kind: 'animal', animal: a };
      bestD = d;
    }
  }
  return best;
}

function promptText(f) {
  if (!f) return '';
  if (f.kind === 'farm') return `${f.farm.owner}의 농장 정보 보기`;
  if (f.kind === 'board') return '마을 안내판 보기';
  if (f.kind === 'github') return '기여하기';
  if (f.kind === 'animal') return f.animal.actionLabel;
  return '';
}

function interact() {
  if (state !== 'play' || !focus) return;
  if (focus.kind === 'farm') openFarm(focus.farm);
  else if (focus.kind === 'board') dialog.board(world.farms, travelTo);
  else if (focus.kind === 'github') window.open(focus.url, '_blank', 'noopener');
  else if (focus.kind === 'animal') {
    const a = focus.animal;
    a.pet(player.pos.x, player.pos.z);
    overlay.bubble(a.object, a.petLine(), a.bubbleHeight);
  }
}

// The open farm is kept in the address (?farm=이름). That makes a shareable farm link,
// and brings the visitor back to the same guestbook after the GitHub login redirect.
const guestbook = guestbookReady() ? CONFIG.guestbook : null;

function setFarmParam(owner) {
  const url = new URL(location.href);
  if (owner) url.searchParams.set('farm', owner);
  else url.searchParams.delete('farm');
  history.replaceState(history.state, '', url);
}

function openFarm(farm) {
  dialog.farm(farm, guestbook);
  setFarmParam(farm.owner);
}

dialog.onClose = () => setFarmParam(null);

function travelTo(farm) {
  dialog.close();
  player.teleport(farm.gate.x, farm.gate.z, Math.PI);
  snapCamera();
  toast(`${farm.owner}의 농장 앞으로 왔어요`);
}

let currentArea = null;

function checkArea() {
  const a = world.areaAt(player.pos.x, player.pos.z);
  const key = a ? (a.kind === 'farm' ? `farm:${a.farm.index}` : `${a.kind}:${a.minX}`) : null;
  if (key === currentArea) return;
  currentArea = key;
  if (!a) return;
  if (a.kind === 'farm') {
    areaBanner(`<small>여기는</small><b>${a.farm.owner}</b>의 농장`);
  } else if (a.kind === 'plaza') {
    areaBanner(`<small>여기는</small><b>클클 광장</b>`);
  } else {
    areaBanner(`<small>여기는</small><b>연못 쉼터</b>`);
  }
}

// Animals near the player sometimes talk on their own.
let chatter = 3;
function ambientChatter(dt) {
  chatter -= dt;
  if (chatter > 0) return;
  chatter = 2.5 + Math.random() * 4;
  const near = world.animals.filter((a) => Math.hypot(a.pos.x - player.pos.x, a.pos.z - player.pos.z) < 16);
  if (!near.length) return;
  const a = near[Math.floor(Math.random() * near.length)];
  overlay.bubble(a.object, a.chatterLine(), a.bubbleHeight, 1400);
}

// ---------------------------------------------------------------------------
// Time of day
// ---------------------------------------------------------------------------

const timeBtn = $('#timeBtn');
function renderTimeBtn() {
  const p = TIMES[timeKey];
  timeBtn.innerHTML = `<span>${p.icon}</span>${p.label}`;
  timeBtn.setAttribute('aria-label', `시간대 바꾸기, 지금은 ${p.label}`);
}
timeBtn.addEventListener('click', () => {
  timeKey = TIME_ORDER[(TIME_ORDER.indexOf(timeKey) + 1) % TIME_ORDER.length];
  sky.apply(timeKey);
  renderTimeBtn();
  timeBtn.blur();
});
renderTimeBtn();

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

const camTarget = new THREE.Vector3();
const camWanted = new THREE.Vector3();
const lookAt = new THREE.Vector3();
let enterT = 0;
const enterFrom = new THREE.Vector3();
const enterLook = new THREE.Vector3();

function followOffset() {
  const portrait = window.innerHeight > window.innerWidth;
  const k = zoom * (portrait ? 1.35 : 1);
  return new THREE.Vector3(0, 19 * k, 19 * k);
}

function snapCamera() {
  camTarget.copy(player.pos);
  camera.position.copy(camTarget).add(followOffset());
  lookAt.copy(camTarget).y += 1;
  camera.lookAt(lookAt);
}

function orbitCamera(t) {
  const r = Math.max(world.W, world.D) * 0.62 + 30;
  if (season.newyear) {
    // New Year's Day: look east across the town, low enough to watch the sun rise over the forest.
    const a = -Math.PI / 2 + Math.sin(t * 0.04) * 0.15;
    camera.position.set(Math.sin(a) * r, r * 0.3 + 8, Math.cos(a) * r);
    lookAt.set(0, r * 0.12, 0);
    camera.lookAt(lookAt);
    return;
  }
  const a = t * 0.05;
  camera.position.set(Math.sin(a) * r, r * 0.62 + 12, Math.cos(a) * r);
  lookAt.set(0, 0, 0);
  camera.lookAt(lookAt);
}

function updateCamera(dt, t) {
  if (state === 'intro') {
    orbitCamera(t);
    return;
  }
  camTarget.lerp(player.pos, Math.min(1, dt * 6));
  camWanted.copy(camTarget).add(followOffset());
  if (state === 'entering') {
    enterT = Math.min(1, enterT + dt / 1.6);
    const e = enterT < 0.5 ? 4 * enterT ** 3 : 1 - (-2 * enterT + 2) ** 3 / 2;
    camera.position.lerpVectors(enterFrom, camWanted, e);
    lookAt.lerpVectors(enterLook, camTarget, e);
    lookAt.y += e;
    camera.lookAt(lookAt);
    if (enterT >= 1) {
      state = 'play';
      sky.setShadowSpan(34);
      scene.fog.near = 70;
      scene.fog.far = 170;
    }
    return;
  }
  camera.position.lerp(camWanted, Math.min(1, dt * 5));
  lookAt.copy(camTarget).y += 1;
  camera.lookAt(lookAt);
}

// ---------------------------------------------------------------------------
// Intro
// ---------------------------------------------------------------------------

const intro = $('#intro');
const startBtn = $('#startBtn');
startBtn.disabled = false;
// Loading is done; the start button says the rest.
$('#loadState').hidden = true;
startBtn.addEventListener('click', enterTown);
sky.setShadowSpan(Math.max(world.W, world.D) * 0.7);
scene.fog.near = 160;
scene.fog.far = 420;

function enterTown({ quiet = false } = {}) {
  if (state !== 'intro') return;
  state = 'entering';
  enterT = 0;
  enterFrom.copy(camera.position);
  enterLook.set(0, 0, 0);
  camTarget.copy(player.pos);
  intro.classList.add('hide');
  setTimeout(() => {
    intro.hidden = true;
  }, 600);
  $('#hud').hidden = false;
  minimap.resize();
  if (!quiet) setTimeout(() => toast('클클 타운에 온 걸 환영해요! 광장의 마을 안내판에서 농장 목록을 볼 수 있어요.', 5200), 1700);
}

// Opened from a farm link (or back from the GitHub login): skip the intro and open that farm.
const linkedFarm = world.farms.find((f) => f.owner === new URLSearchParams(location.search).get('farm'));
if (linkedFarm) {
  player.teleport(linkedFarm.gate.x, linkedFarm.gate.z, Math.PI);
  orbitCamera(0); // start the fly-in from the overview, not from the origin
  enterTown({ quiet: true });
  setTimeout(() => openFarm(linkedFarm), 1700);
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  minimap.resize();
});

const ORIGIN = new THREE.Vector3();
let last = performance.now();
let elapsed = 0;

renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  elapsed += dt;

  readInput();
  if (state === 'play') {
    player.update(dt, input, world);
    focus = dialog.open ? null : findFocus();
    prompt.set(promptText(focus));
    checkArea();
    ambientChatter(dt);
  } else if (state === 'entering') {
    player.animate(dt);
  } else {
    player.animate(dt);
  }

  world.update(dt, elapsed, player.pos);
  sky.update(dt);
  updateCamera(dt, elapsed);
  sky.follow(state === 'intro' ? ORIGIN : camTarget);
  falling?.update(dt, elapsed, state === 'intro' ? ORIGIN : camTarget);
  if (fireflies) {
    fireflies.setLevel(sky.lamps);
    fireflies.update(dt, elapsed, state === 'intro' ? ORIGIN : camTarget);
  }

  renderer.render(scene, camera);
  overlay.update(camera, window.innerWidth, window.innerHeight, elapsed);
  if (state !== 'intro') minimap.draw(player);
});

// Handy for debugging in the console.
window.clclTown = { world, player, camera, scene, sky, travelTo };
