// Background music. The track streams through an <audio> element, and its loudness goes through
// a Web Audio gain node because iOS ignores a volume set on media elements by script.
// Browsers allow sound only after the visitor clicks or presses a key. start() is called from the
// enter-town click; when the town opens without one (a farm link), the next click or key press
// starts the music.

const FADE_IN = 1.5;
const FADE_OUT = 0.4;
const SLIDE = 0.06;

export class Music {
  constructor(url, { on = true, volume = 40 } = {}) {
    this.url = url;
    this.on = on;
    this.volume = volume; // 0..100
    this.started = false;
    this.audio = null;
    this.ctx = null;
    this.gain = null;
    this.pauseTimer = 0;
    this.waiting = false;
    document.addEventListener('visibilitychange', () => this.sync(FADE_OUT));
  }

  get audible() {
    return this.on && this.volume > 0;
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.sync(FADE_IN);
  }

  setOn(on) {
    this.on = on;
    this.sync(on ? FADE_IN : FADE_OUT);
  }

  setVolume(volume) {
    const wasAudible = this.audible;
    this.volume = volume;
    this.sync(wasAudible ? SLIDE : FADE_IN);
  }

  // A gentle curve: the slider's middle sounds like the middle.
  level() {
    return this.audible ? Math.pow(this.volume / 100, 1.5) : 0;
  }

  ensure() {
    if (this.audio) return;
    const audio = new Audio();
    audio.src = this.url;
    audio.loop = true;
    audio.preload = 'auto';
    this.audio = audio;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      this.ctx.createMediaElementSource(audio).connect(this.gain).connect(this.ctx.destination);
    } catch {
      this.ctx = null;
      this.gain = null;
    }
  }

  sync(fade) {
    if (!this.started) return;
    const play = this.audible && !document.hidden;
    if (!play && !this.audio) return;
    // Without any click yet the browser would refuse; wait for one instead of trying.
    if (play && navigator.userActivation && !navigator.userActivation.hasBeenActive) {
      this.waitForGesture();
      return;
    }
    this.ensure();
    clearTimeout(this.pauseTimer);
    const target = play ? this.level() : 0;
    if (this.gain) {
      const g = this.gain.gain;
      const now = this.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(target, now + fade);
    } else {
      this.audio.volume = target;
    }
    if (play) {
      // A context made without a click stays suspended until one comes.
      if (this.ctx?.state === 'suspended') {
        this.ctx.resume().catch(() => {});
        this.waitForGesture();
      }
      if (this.audio.paused) this.audio.play().catch(() => this.waitForGesture());
    } else {
      // Pause after the fade so a muted tab does not keep decoding.
      this.pauseTimer = setTimeout(() => this.audio.pause(), fade * 1000 + 50);
    }
  }

  waitForGesture() {
    if (this.waiting) return;
    this.waiting = true;
    const retry = () => {
      window.removeEventListener('pointerdown', retry, true);
      window.removeEventListener('keydown', retry, true);
      this.waiting = false;
      this.sync(FADE_IN);
    };
    window.addEventListener('pointerdown', retry, true);
    window.addEventListener('keydown', retry, true);
  }
}
