import * as THREE from 'three';
import { createPlayer } from './models.js';
import { voxelMaterial } from './voxel.js';

// The player marks its visible pixels in the stencil buffer. A flat "ghost"
// copy is then drawn only where the player is hidden behind something, so the
// player stays visible behind barns and signs without tinting itself.
const bodyMaterial = voxelMaterial.clone();
bodyMaterial.stencilWrite = true;
bodyMaterial.stencilRef = 1;
bodyMaterial.stencilFunc = THREE.AlwaysStencilFunc;
bodyMaterial.stencilZPass = THREE.ReplaceStencilOp;

const ghostMaterial = new THREE.MeshBasicMaterial({
  color: '#2e4a7d',
  transparent: true,
  opacity: 0.45,
  depthWrite: false,
  depthFunc: THREE.GreaterDepth,
  stencilWrite: true,
  stencilRef: 1,
  stencilFunc: THREE.NotEqualStencilFunc,
  stencilZPass: THREE.ReplaceStencilOp,
});

function addXray(root) {
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  for (const m of meshes) {
    m.material = bodyMaterial;
    m.renderOrder = 5; // after the rest of the opaque scene
    const ghost = new THREE.Mesh(m.geometry, ghostMaterial);
    ghost.renderOrder = 10;
    m.parent.add(ghost);
  }
}

const WALK = 5.2;
const RUN = 9.5;
const RADIUS = 0.4;
const GRAVITY = 24;
const JUMP = 7.4;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class Player {
  constructor() {
    this.rig = createPlayer();
    addXray(this.rig.root);
    this.object = this.rig.root;
    this.pos = this.object.position;
    this.vx = 0;
    this.vz = 0;
    this.vy = 0;
    this.heading = Math.PI;
    this.walkT = 0;
    this.grounded = true;
    this.speed = 0;
  }

  teleport(x, z, heading = Math.PI) {
    this.pos.set(x, 0, z);
    this.vx = this.vz = this.vy = 0;
    this.heading = heading;
    this.object.rotation.y = heading;
  }

  update(dt, input, world) {
    const max = input.run ? RUN : WALK;
    const tx = input.x * max;
    const tz = input.z * max;
    const k = Math.min(1, dt * (input.x || input.z ? 10 : 8));
    this.vx += (tx - this.vx) * k;
    this.vz += (tz - this.vz) * k;

    this.pos.x += this.vx * dt;
    this.pos.z += this.vz * dt;

    if (input.jump && this.grounded) {
      this.vy = JUMP;
      this.grounded = false;
    }
    input.jump = false;
    this.vy -= GRAVITY * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.vy = 0;
      this.grounded = true;
    }

    this.collide(world);

    this.speed = Math.hypot(this.vx, this.vz);
    if (this.speed > 0.3) {
      const want = Math.atan2(this.vx, this.vz);
      this.heading += wrapAngle(want - this.heading) * Math.min(1, dt * 12);
    }
    this.object.rotation.y = this.heading;
    this.animate(dt);
  }

  collide(world) {
    const p = this.pos;
    const r = RADIUS;
    for (const c of world.colliders) {
      if (p.y > c.h) continue;
      if (p.x < c.minX - r || p.x > c.maxX + r || p.z < c.minZ - r || p.z > c.maxZ + r) continue;
      const qx = Math.max(c.minX, Math.min(p.x, c.maxX));
      const qz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
      const dx = p.x - qx;
      const dz = p.z - qz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        p.x += (dx / d) * (r - d);
        p.z += (dz / d) * (r - d);
      } else {
        const left = p.x - c.minX;
        const right = c.maxX - p.x;
        const back = p.z - c.minZ;
        const front = c.maxZ - p.z;
        const m = Math.min(left, right, back, front);
        if (m === left) p.x = c.minX - r;
        else if (m === right) p.x = c.maxX + r;
        else if (m === back) p.z = c.minZ - r;
        else p.z = c.maxZ + r;
      }
    }
    // animals are solid too
    for (const a of world.animals) {
      const dx = p.x - a.pos.x;
      const dz = p.z - a.pos.z;
      const min = r + a.radius * 0.8;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6 && p.y < 1) {
        const d = Math.sqrt(d2);
        p.x += (dx / d) * (min - d);
        p.z += (dz / d) * (min - d);
      }
    }
    const b = world.bounds;
    p.x = Math.max(b.minX, Math.min(b.maxX, p.x));
    p.z = Math.max(b.minZ, Math.min(b.maxZ, p.z));
  }

  animate(dt) {
    const { legs, arms, body, head } = this.rig;
    const amount = Math.min(1, this.speed / WALK);
    this.walkT += dt * (4 + this.speed * 1.6) * (amount > 0.05 ? 1 : 0);
    const s = Math.sin(this.walkT);
    if (!this.grounded) {
      legs[0].rotation.x = -0.5;
      legs[1].rotation.x = 0.3;
      arms[0].rotation.x = -2.4;
      arms[1].rotation.x = -2.4;
      arms[0].rotation.z = -0.2;
      arms[1].rotation.z = 0.2;
      body.position.y = 0;
      return;
    }
    const swing = 0.75 * amount;
    legs[0].rotation.x = s * swing;
    legs[1].rotation.x = -s * swing;
    arms[0].rotation.x = -s * swing * 0.9;
    arms[1].rotation.x = s * swing * 0.9;
    arms[0].rotation.z = -0.06;
    arms[1].rotation.z = 0.06;
    body.position.y = Math.abs(Math.cos(this.walkT)) * 0.07 * amount;
    body.rotation.x = this.speed > WALK + 1 ? 0.12 : 0.03 * amount;
    head.rotation.x = amount < 0.05 ? Math.sin(performance.now() / 700) * 0.03 : 0;
  }
}
