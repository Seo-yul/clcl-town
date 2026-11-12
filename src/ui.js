import * as THREE from 'three';
import { ANIMALS } from './models.js';

const $ = (sel) => document.querySelector(sel);
const v3 = new THREE.Vector3();

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/** "🐮 소" for a single animal, "🐮 소 2" when there are several of one kind. */
export function herdSummary(farm) {
  return farm.herd
    .map((h) => `${ANIMALS[h.type].emoji} ${ANIMALS[h.type].name}${h.count > 1 ? ` ${h.count}` : ''}`)
    .join(' · ');
}

// ---------------------------------------------------------------------------
// Screen-space labels and speech bubbles that follow 3D positions.
// ---------------------------------------------------------------------------

export class Overlay {
  constructor(root) {
    this.root = root;
    this.labels = [];
    this.bubbles = [];
  }

  addFarmLabel(farm) {
    const el = document.createElement('div');
    el.className = 'farm-label';
    el.style.setProperty('--accent', farm.accent);
    el.innerHTML = `
      <div class="tag">
        <div class="name"><b>${escapeHtml(farm.owner)}</b></div>
        <div class="pets">${herdSummary(farm)}</div>
      </div>`;
    this.root.appendChild(el);
    this.labels.push({ el, anchor: farm.labelAnchor, phase: farm.index * 0.7 });
  }

  addPlainLabel(anchor, html, cls = '') {
    const el = document.createElement('div');
    el.className = `farm-label ${cls}`;
    el.innerHTML = `<div class="tag">${html}</div>`;
    this.root.appendChild(el);
    this.labels.push({ el, anchor, phase: 0 });
  }

  bubble(target, text, height = 1.6, ms = 1700) {
    const el = document.createElement('div');
    el.className = 'bubble';
    el.textContent = text;
    this.root.appendChild(el);
    const b = { el, target, height, until: performance.now() + ms };
    this.bubbles.push(b);
    requestAnimationFrame(() => el.classList.add('show'));
  }

  update(camera, w, h, t) {
    const camPos = camera.position;
    for (const l of this.labels) {
      v3.copy(l.anchor);
      const dist = v3.distanceTo(camPos);
      v3.project(camera);
      const visible = v3.z < 1 && v3.x > -1.3 && v3.x < 1.3 && v3.y > -1.3 && v3.y < 1.4 && dist < 150;
      if (!visible) {
        if (!l.hidden) {
          l.el.style.visibility = 'hidden';
          l.hidden = true;
        }
        continue;
      }
      if (l.hidden) {
        l.el.style.visibility = 'visible';
        l.hidden = false;
      }
      const x = (v3.x * 0.5 + 0.5) * w;
      const y = (-v3.y * 0.5 + 0.5) * h + Math.sin(t * 1.6 + l.phase) * 4;
      const scale = Math.max(0.6, Math.min(1.15, 33 / dist));
      l.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%) scale(${scale.toFixed(3)})`;
      l.el.style.opacity = dist > 95 ? Math.max(0, (150 - dist) / 55).toFixed(2) : '1';
      l.el.style.zIndex = String(1000 - Math.round(dist));
    }

    const now = performance.now();
    this.bubbles = this.bubbles.filter((b) => {
      if (now > b.until) {
        b.el.classList.remove('show');
        setTimeout(() => b.el.remove(), 250);
        return false;
      }
      v3.copy(b.target.position);
      v3.y += b.height;
      v3.project(camera);
      if (v3.z > 1) {
        b.el.style.visibility = 'hidden';
        return true;
      }
      b.el.style.visibility = 'visible';
      const x = (v3.x * 0.5 + 0.5) * w;
      const y = (-v3.y * 0.5 + 0.5) * h;
      b.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
      return true;
    });
  }
}

// ---------------------------------------------------------------------------
// Minimap
// ---------------------------------------------------------------------------

export class Minimap {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.world = world;
    const margin = 8;
    this.minX = world.bounds.minX - margin;
    this.maxX = world.bounds.maxX + margin;
    this.minZ = world.bounds.minZ - margin;
    this.maxZ = world.bounds.maxZ + margin;
    const aspect = (this.maxZ - this.minZ) / (this.maxX - this.minX);
    this.cssW = 200;
    this.cssH = Math.round(Math.max(100, Math.min(200, this.cssW * aspect)));
    this.resize();
  }

  resize() {
    const small = window.innerWidth < 640;
    const w = small ? 128 : this.cssW;
    const h = Math.round(w * (this.cssH / this.cssW));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.sx = this.canvas.width / (this.maxX - this.minX);
    this.sz = this.canvas.height / (this.maxZ - this.minZ);
    this.dpr = dpr;
    this.base = null;
  }

  mx(x) {
    return (x - this.minX) * this.sx;
  }

  mz(z) {
    return (z - this.minZ) * this.sz;
  }

  drawBase() {
    const off = document.createElement('canvas');
    off.width = this.canvas.width;
    off.height = this.canvas.height;
    const g = off.getContext('2d');
    const w = this.world;
    g.fillStyle = '#7fbf5c';
    g.fillRect(0, 0, off.width, off.height);
    // roads
    g.fillStyle = '#e6d2a8';
    const roadW = 5;
    for (let k = 0; k <= w.cols; k++) {
      const x = -w.W / 2 + k * 30;
      g.fillRect(this.mx(x - roadW / 2), this.mz(-w.D / 2 - roadW / 2), roadW * this.sx, (w.D + roadW) * this.sz);
    }
    for (let k = 0; k <= w.rows; k++) {
      const z = -w.D / 2 + k * 30;
      g.fillRect(this.mx(-w.W / 2 - roadW / 2), this.mz(z - roadW / 2), (w.W + roadW) * this.sx, roadW * this.sz);
    }
    // Farms, labeled with the owner's full name. Shortening is not safe here:
    // names such as 윤서율/윤서영 or 윤서영/이서영 share their first or last two letters.
    // When the plot is too small for a readable name, the plot is left unlabeled.
    const plotCss = (22 * this.sx) / this.dpr;
    const longest = Math.max(...w.farms.map((f) => [...f.owner].length), 1);
    const fontCss = Math.min(11, Math.floor((plotCss * 0.95) / longest));
    const family = fontCss >= 11 ? 'Galmuri11, sans-serif' : '"Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `bold ${fontCss * this.dpr}px ${family}`;
    for (const f of w.farms) {
      g.fillStyle = '#a6d97c';
      g.fillRect(this.mx(f.cx - 11), this.mz(f.cz - 11), 22 * this.sx, 22 * this.sz);
      g.fillStyle = f.accent;
      g.fillRect(this.mx(f.cx - 11), this.mz(f.cz - 11), 22 * this.sx, 4 * this.sz);
      if (fontCss >= 7) {
        g.fillStyle = '#2b2a3d';
        g.fillText(f.owner, this.mx(f.cx), this.mz(f.cz + 2));
      }
    }
    // plaza
    const p = w.plaza;
    g.fillStyle = '#efe7d6';
    g.fillRect(this.mx(p.cx - 12), this.mz(p.cz - 12), 24 * this.sx, 24 * this.sz);
    g.fillStyle = '#6cc4e8';
    g.fillRect(this.mx(p.cx - 2.3), this.mz(p.cz - 3.3), 4.6 * this.sx, 4.6 * this.sz);
    // ponds
    for (const c of w.spare) {
      g.fillStyle = '#6cc4e8';
      g.fillRect(this.mx(c.x - 6), this.mz(c.z - 4), 12 * this.sx, 8 * this.sz);
    }
    this.base = off;
  }

  draw(player) {
    if (!this.base) this.drawBase();
    const g = this.canvas.getContext('2d');
    g.drawImage(this.base, 0, 0);
    const x = this.mx(player.pos.x);
    const z = this.mz(player.pos.z);
    const s = 6 * this.dpr;
    g.save();
    g.translate(x, z);
    g.rotate(-player.heading + Math.PI);
    g.beginPath();
    g.moveTo(0, -s);
    g.lineTo(s * 0.75, s * 0.75);
    g.lineTo(0, s * 0.35);
    g.lineTo(-s * 0.75, s * 0.75);
    g.closePath();
    g.fillStyle = '#ff5a4f';
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1.5 * this.dpr;
    g.fill();
    g.stroke();
    g.restore();
  }
}

// ---------------------------------------------------------------------------
// Dialog, prompt, toast, area banner
// ---------------------------------------------------------------------------

export class Dialog {
  constructor() {
    this.el = $('#dialog');
    this.body = $('#dialogBody');
    this.open = false;
    this.onClose = null;
    $('#dialogClose').addEventListener('click', () => this.close());
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });
  }

  show(html, accent = '#ff7a59', { wide = false } = {}) {
    this.body.innerHTML = html;
    this.el.querySelector('.card').classList.toggle('wide', wide);
    this.el.style.setProperty('--accent', accent);
    this.el.hidden = false;
    this.open = true;
    requestAnimationFrame(() => this.el.classList.add('show'));
    $('#dialogClose').focus({ preventScroll: true });
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.el.classList.remove('show');
    setTimeout(() => {
      if (!this.open) this.el.hidden = true;
    }, 200);
    if (this.onClose) this.onClose();
  }

  /** Farm info. When `guestbook` (giscus settings) is given, the farm's guestbook is shown below. */
  farm(farm, guestbook = null) {
    const animals = farm.herd
      .map((h) => {
        const a = ANIMALS[h.type];
        return `<li><span class="emoji">${a.emoji}</span><span class="nm">${a.name}</span><span class="ct">${h.count}마리</span></li>`;
      })
      .join('');
    const total = farm.herd.reduce((s, h) => s + h.count, 0);
    this.show(
      `<p class="kicker">농장 정보</p>
       <h2><b>${escapeHtml(farm.owner)}</b></h2>
       <p class="owner">농장 주인 · ${escapeHtml(farm.owner)}</p>
       <h3>함께 사는 동물 ${total}마리</h3>
       <ul class="animals">${animals}</ul>
       <div class="facts">
         <span>${farm.crop.emoji} ${farm.crop.name} 밭</span>
         <span>🏠 ${farm.style.label}</span>
       </div>
       ${guestbook ? '<h3>방명록</h3><div class="guestbook"><div class="giscus" id="guestbook"></div></div>' : ''}`,
      farm.accent,
      { wide: Boolean(guestbook) },
    );
    if (guestbook) {
      mountGiscus(this.body.querySelector('.guestbook'), guestbook, guestbook.titleFormat.replace('{name}', farm.owner));
    }
  }

  board(farms, onPick) {
    const items = farms
      .map(
        (f) => `<li><button type="button" data-farm="${f.index}" style="--accent:${f.accent}">
          <b>${escapeHtml(f.owner)}</b><em>${herdSummary(f)}</em></button></li>`,
      )
      .join('');
    this.show(
      `<p class="kicker">농장 안내판</p>
       <h2>클클 마을 농장 목록</h2>
       <p class="owner">가고 싶은 농장을 고르면 그 농장 입구로 바로 이동해요.</p>
       <ul class="farm-list">${items}</ul>`,
      '#6fbdf2',
    );
    this.body.querySelectorAll('[data-farm]').forEach((btn) => {
      btn.addEventListener('click', () => onPick(farms[Number(btn.dataset.farm)]));
    });
  }
}

/**
 * URL of the town's giscus theme (public/giscus-theme.css).
 * The giscus iframe fetches it cross-origin from giscus.app, so it must be served
 * over https with CORS. Pages served over https (GitHub Pages) use their own copy;
 * local http dev servers can't be reached from giscus.app, so they use the deployed copy.
 * `?v=` is a hash of the file (see vite.config.js) so CDN and browser caches never serve an old theme.
 */
function guestbookTheme(cfg) {
  const base = location.protocol === 'https:'
    ? new URL('giscus-theme.css', document.baseURI).href
    : cfg.deployedTheme;
  if (!base) return 'light';
  const url = new URL(base);
  url.searchParams.set('v', __GISCUS_THEME_VERSION__);
  return url.href;
}

/**
 * Loads the giscus widget into `wrapper` (which holds a `.giscus` element).
 * Each farm maps to one GitHub Discussion whose title is `title`; giscus creates
 * that discussion when the first entry is posted. Strict mode matches the title
 * exactly, so 윤서영's guestbook never picks up a discussion meant for someone else.
 */
function mountGiscus(wrapper, cfg, title) {
  const script = document.createElement('script');
  script.src = 'https://giscus.app/client.js';
  script.async = true;
  script.crossOrigin = 'anonymous';
  const data = {
    repo: cfg.repo,
    'repo-id': cfg.repoId,
    category: cfg.category,
    'category-id': cfg.categoryId,
    mapping: 'specific',
    term: title,
    strict: '1',
    'reactions-enabled': '1',
    'emit-metadata': '0',
    'input-position': 'top',
    theme: guestbookTheme(cfg),
    lang: 'ko',
  };
  for (const [key, value] of Object.entries(data)) script.setAttribute(`data-${key}`, value);
  wrapper.appendChild(script);
}

export class Prompt {
  constructor() {
    this.el = $('#prompt');
    this.text = '';
  }

  set(text) {
    if (text === this.text) return;
    this.text = text;
    if (!text) {
      this.el.hidden = true;
      return;
    }
    this.el.innerHTML = `<kbd>E</kbd>${text}`;
    this.el.hidden = false;
  }
}

export function toast(text, ms = 3200) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), ms);
}

export function areaBanner(html) {
  const el = $('#area');
  el.innerHTML = html;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

// ---------------------------------------------------------------------------
// Touch controls: a virtual joystick plus action and jump buttons.
// ---------------------------------------------------------------------------

export function setupTouch(input, onAction) {
  const zone = $('#joy');
  const knob = $('#joyKnob');
  const max = 46;
  let id = null;
  let cx = 0;
  let cy = 0;
  const reset = () => {
    id = null;
    input.joyX = 0;
    input.joyZ = 0;
    input.joyRun = false;
    knob.style.transform = 'translate(-50%, -50%)';
  };
  zone.addEventListener('pointerdown', (e) => {
    id = e.pointerId;
    zone.setPointerCapture(id);
    const r = zone.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    move(e);
  });
  const move = (e) => {
    if (e.pointerId !== id) return;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const d = Math.hypot(dx, dy);
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    input.joyX = dx / max;
    input.joyZ = dy / max;
    input.joyRun = d > max * 0.95;
  };
  zone.addEventListener('pointermove', move);
  zone.addEventListener('pointerup', reset);
  zone.addEventListener('pointercancel', reset);

  $('#btnAction').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    onAction();
  });
  $('#btnJump').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    input.jump = true;
  });
}
