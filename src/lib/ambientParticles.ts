const TAU = Math.PI * 2;
const palette = ['#7894b5', '#8680ad', '#b4b8c8', '#8ebcba', '#ffe2ad', '#a3eaff'];

export function createGalaxyParticles() {
  let seed = 290687;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  return Array.from({ length: 540 }, (_, i) => {
    const reactive = i >= 468;
    const field = i < 122;
    const depth = random();
    const radius = .075 + .96 * (reactive ? .21 + .79 * random() : random() ** 1.28);
    const turn = (i % 3) * TAU / 3 + 2.46 * Math.log(1 + radius * 2.2)
      + (random() + random() - 1) * (.50 - radius * .19);
    const u = Math.cos(turn) * radius;
    const v = Math.sin(turn) * radius * .52;
    return {
      x: field ? (random() - .5) * 2.6 : .9 * u + .43 * v + .08,
      y: field ? (random() - .5) * 2.1 : -.43 * u + .9 * v + .05,
      size: field ? .36 + 1.02 * depth ** 2 : .42 + 1.3 * depth ** 3,
      alpha: field ? .10 + .24 * depth : .095 + .28 * depth,
      color: reactive ? 4 + (i % 2) : Math.floor(random() * 4),
      reactive, depth, phase: random() * TAU,
    };
  });
}

type Particle = ReturnType<typeof createGalaxyParticles>[number];

export function galaxyPose(p: Particle, seconds: number, energy: number, span: number) {
  const drift = (.7 + p.depth * 2.1) * Math.sin(seconds * (.11 + p.depth * .1) + p.phase);
  const burst = p.reactive ? energy * (3 + p.depth * 10) : 0;
  return {
    x: p.x * span + (drift + burst) * Math.cos(p.phase),
    y: p.y * span + (drift + burst * .7) * Math.sin(p.phase),
    size: p.size + (p.reactive ? energy * (1 + p.depth * 1.8) : 0),
    alpha: p.reactive ? energy * (.28 + p.depth * .49) : p.alpha,
  };
}

// The scopes and galaxy share one bounded, 24 Hz cadence and one analyser read.
export function createGalaxy(canvas: HTMLCanvasElement, onMotionChange: () => void) {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const context = canvas.getContext('2d');
  const particles = createGalaxyParticles().sort((a, b) => a.color - b.color);
  let previousTime: number | null = null;
  let seconds = 0;
  let energy = 0;
  let frozen = false;
  let motionChanged = false;
  let resizePending = false;

  function draw() {
    if (!context) return;
    // Use layout dimensions, not a bounding rect distorted by year travel.
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(1.5, window.devicePixelRatio || 1, Math.sqrt(1_350_000 / (w * h)));
    const width = Math.max(1, Math.floor(w * dpr)), height = Math.max(1, Math.floor(h * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(width / w, 0, 0, height / h, 0, 0);
    context.clearRect(0, 0, w, h);
    const span = Math.min(w * .78, h * .70);
    let color = -1;
    for (const p of particles) {
      if (p.reactive && energy === 0) continue;
      const pose = galaxyPose(p, motion.matches ? 0 : seconds, energy, span);
      const x = w * .51 + pose.x, y = h * .51 + pose.y;
      if (x < -3 || x > w + 3 || y < -3 || y > h + 3) continue;
      // Keep the map's center and the left controls quieter than the arms.
      const center = Math.hypot((x - w * .37) / span, (y - h * .48) / span);
      context.globalAlpha = pose.alpha * Math.min(1, .54 + center * .88);
      if (p.color !== color) context.fillStyle = palette[color = p.color];
      context.fillRect(x - pose.size / 2, y - pose.size / 2, pose.size, pose.size);
    }
    context.globalAlpha = 1;
  }

  function changeMotion() {
    if (frozen) { motionChanged = true; return; }
    previousTime = null;
    if (motion.matches) {
      energy = 0;
      draw();
    }
    onMotionChange();
  }
  motion.addEventListener('change', changeMotion);
  const observer = new ResizeObserver(() => {
    if (frozen) resizePending = true;
    else draw();
  });
  observer.observe(canvas);

  return {
    isAnimated: () => !motion.matches,
    update(timestamp: number, level: number) {
      if (motion.matches || frozen || document.hidden) return;
      const first = previousTime === null;
      if (!first) seconds += Math.min(100, Math.max(0, timestamp - previousTime!)) / 1000;
      previousTime = timestamp;
      const actual = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
      // Preserve the last envelope on the first frame after a scene hold.
      if (!first) energy = actual === 0 ? 0 : energy + (actual - energy) * .27;
      draw();
    },
    silence() {
      if (frozen) return;
      energy = 0;
      if (!motion.matches && !document.hidden) draw();
    },
    suspend() { previousTime = null; },
    freeze(stopped: boolean) {
      frozen = stopped;
      previousTime = null;
      if (!stopped && motionChanged) {
        motionChanged = false;
        changeMotion();
      }
      if (!stopped && resizePending) { resizePending = false; draw(); }
    },
    dispose() {
      observer.disconnect();
      motion.removeEventListener('change', changeMotion);
    },
  };
}
