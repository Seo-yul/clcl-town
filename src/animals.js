import { ANIMALS, createAnimalRig } from './models.js';

const TAU = Math.PI * 2;

function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

const LEG_PHASE_4 = [0, Math.PI, Math.PI, 0];
const LEG_PHASE_2 = [0, Math.PI];

/**
 * A farm animal that wanders inside its pasture rectangle.
 * States: idle (sometimes grazing or pecking) and walk (toward a random target).
 */
export class Animal {
  constructor(type, variant, home, rng) {
    this.type = type;
    this.def = ANIMALS[type];
    this.home = home; // { pasture: {minX,maxX,minZ,maxZ}, swim?: bool }
    this.rng = rng;
    this.rig = createAnimalRig(type, variant);
    this.object = this.rig.root;
    this.pos = this.object.position;
    this.radius = this.def.radius;
    const p = home.pasture;
    this.pos.set(rng.range(p.minX, p.maxX), 0, rng.range(p.minZ, p.maxZ));
    this.heading = rng.range(-Math.PI, Math.PI);
    this.object.rotation.y = this.heading;
    this.state = 'idle';
    this.timer = rng.range(0.3, 3);
    this.tx = this.pos.x;
    this.tz = this.pos.z;
    this.speed = this.def.speed * rng.range(0.85, 1.15);
    this.walkT = rng.range(0, 10);
    this.move = 0;
    this.graze = 0;
    this.grazing = false;
    this.lookYaw = 0;
    this.joy = 0;
    this.legPhase = this.rig.legs.length === 4 ? LEG_PHASE_4 : LEG_PHASE_2;
  }

  pickTarget() {
    const p = this.home.pasture;
    const r = this.rng;
    // Prefer short strolls so the herd looks calm.
    const reach = r.range(1.5, 6);
    const a = r.range(-Math.PI, Math.PI);
    this.tx = Math.min(p.maxX, Math.max(p.minX, this.pos.x + Math.sin(a) * reach));
    this.tz = Math.min(p.maxZ, Math.max(p.minZ, this.pos.z + Math.cos(a) * reach));
  }

  /** Called when the player pets the animal. */
  pet(px, pz) {
    this.joy = 1;
    this.state = 'idle';
    this.grazing = false;
    this.timer = 2.5;
    this.heading = Math.atan2(px - this.pos.x, pz - this.pos.z);
  }

  update(dt, t, player) {
    const r = this.rng;
    this.timer -= dt;

    if (this.state === 'idle') {
      if (this.timer <= 0) {
        if (r.chance(0.7)) {
          this.state = 'walk';
          this.grazing = false;
          this.pickTarget();
          this.timer = 12;
        } else {
          this.timer = r.range(1.5, 4);
          this.grazing = (this.def.grazes || this.def.pecks) && r.chance(0.6);
        }
      }
    } else {
      const dx = this.tx - this.pos.x;
      const dz = this.tz - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.25 || this.timer <= 0) {
        this.state = 'idle';
        this.timer = r.range(1.5, 5);
        this.grazing = (this.def.grazes || this.def.pecks) && r.chance(0.55);
      } else {
        const want = Math.atan2(dx, dz);
        const diff = wrapAngle(want - this.heading);
        this.heading += Math.sign(diff) * Math.min(Math.abs(diff), dt * 3.2);
        if (Math.abs(diff) < 0.6) {
          const step = this.speed * dt;
          this.pos.x += Math.sin(this.heading) * step;
          this.pos.z += Math.cos(this.heading) * step;
        }
      }
    }

    const p = this.home.pasture;
    this.pos.x = Math.min(p.maxX, Math.max(p.minX, this.pos.x));
    this.pos.z = Math.min(p.maxZ, Math.max(p.minZ, this.pos.z));
    this.object.rotation.y = this.heading;

    // --- animation ---
    const moving = this.state === 'walk' ? 1 : 0;
    this.move += (moving - this.move) * Math.min(1, dt * 6);
    this.walkT += dt * this.speed * 7 * this.move;
    const legs = this.rig.legs;
    const swing = Math.sin(this.walkT);

    let hop = 0;
    if (this.def.gait === 'hop') {
      hop = Math.abs(Math.sin(this.walkT * 0.6)) * 0.28 * this.move;
      for (let i = 0; i < legs.length; i++) legs[i].rotation.x = (i < 2 ? -1 : 1) * hop * 1.2;
    } else {
      for (let i = 0; i < legs.length; i++) {
        legs[i].rotation.x = Math.sin(this.walkT + this.legPhase[i]) * 0.55 * this.move;
      }
    }
    this.rig.body.position.y = Math.abs(swing) * 0.03 * this.move;

    // Look at the player when they come close.
    let wantYaw = 0;
    if (player) {
      const pdx = player.x - this.pos.x;
      const pdz = player.z - this.pos.z;
      if (pdx * pdx + pdz * pdz < 16) {
        wantYaw = Math.max(-0.8, Math.min(0.8, wrapAngle(Math.atan2(pdx, pdz) - this.heading)));
      }
    }
    this.lookYaw += (wantYaw - this.lookYaw) * Math.min(1, dt * 4);

    let pitch = 0;
    if (this.grazing && this.state === 'idle') {
      if (this.def.pecks) pitch = Math.max(0, Math.sin(t * 9 + this.walkT)) * 0.9;
      else pitch = 0.75;
    }
    this.graze += (pitch - this.graze) * Math.min(1, dt * (this.def.pecks ? 14 : 3));
    this.rig.head.rotation.set(this.graze, this.lookYaw, 0);

    // A happy little jump after being petted.
    if (this.joy > 0) {
      this.joy = Math.max(0, this.joy - dt * 1.4);
      hop = Math.max(hop, Math.abs(Math.sin(this.joy * Math.PI * 3)) * 0.35 * this.joy);
    }
    this.pos.y = (this.home.swim ? -0.06 + Math.sin(t * 2 + this.walkT) * 0.02 : 0) + hop;
  }
}

/** Pushes animals in the same home apart so they do not overlap. */
export function separate(animals) {
  for (let i = 0; i < animals.length; i++) {
    const a = animals[i];
    for (let j = i + 1; j < animals.length; j++) {
      const b = animals[j];
      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      const min = (a.radius + b.radius) * 0.85;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        a.pos.x -= (dx / d) * push;
        a.pos.z -= (dz / d) * push;
        b.pos.x += (dx / d) * push;
        b.pos.z += (dz / d) * push;
      }
    }
  }
}
