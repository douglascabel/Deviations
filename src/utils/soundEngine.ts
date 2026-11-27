/*
 * Split-flap sound, modelled on the mechanism rather than on noise bursts.
 *
 * A Solari leaf is a thin plate released by a latch; it falls, slaps the stop of the leaf below,
 * rebounds once and settles, while the drum's motor and gear train run underneath. Each event is
 * synthesised as a sum of damped, inharmonic plate modes (the ring of the leaf), a low knock (the
 * drum housing) and a short contact transient, with a micro-rebound a few milliseconds later.
 *
 * Sixteen landing variants and eight latch-release variants are rendered once into AudioBuffers,
 * so playback is just a buffer source per event. Everything runs through a convolution reverb
 * whose impulse response is generated for a large, hard-surfaced hall like the TWA terminal.
 * Voices are pooled per short window so a full-board cascade becomes a dense rattle, not a clip.
 */

const WINDOW_SECONDS = 0.016;
const MAX_LANDINGS_PER_WINDOW = 4;
const MAX_RELEASES_PER_WINDOW = 2;
const LANDING_VARIANTS = 16;
const RELEASE_VARIANTS = 8;

interface Engine {
  context: BaseAudioContext;
  bus: GainNode;
  landings: AudioBuffer[];
  releases: AudioBuffer[];
  motorGain: GainNode;
}

let engine: Engine | null = null;
let muted = true;
let windowStart = 0;
let landingsInWindow = 0;
let releasesInWindow = 0;
let motorLevel = 0;

function random(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

interface Mode {
  frequency: number;
  decay: number;
  amplitude: number;
}

/** Adds an impact (contact transient + damped modes) into `out`, starting at `offset` samples. */
function addImpact(out: Float32Array, rate: number, offset: number, modes: Mode[], click: number, gain: number): void {
  const length = out.length;
  // Contact transient: a fraction of a millisecond of high-passed noise.
  const clickSamples = Math.floor(rate * 0.0007);
  let previous = 0;
  for (let index = 0; index < clickSamples && offset + index < length; index += 1) {
    const noise = Math.random() * 2 - 1;
    const highPassed = noise - previous;
    previous = noise;
    out[offset + index] += highPassed * click * gain * (1 - index / clickSamples);
  }
  for (const mode of modes) {
    const phase = Math.random() * Math.PI * 2;
    const omega = (2 * Math.PI * mode.frequency) / rate;
    const decaySamples = mode.decay * rate;
    const end = Math.min(length - offset, Math.floor(decaySamples * 7));
    // A 0.2 ms attack ramp avoids an artificial step at the onset of each mode.
    const attack = Math.max(1, Math.floor(rate * 0.0002));
    for (let index = 0; index < end; index += 1) {
      const envelope = Math.exp(-index / decaySamples) * Math.min(1, index / attack);
      out[offset + index] += Math.sin(omega * index + phase) * envelope * mode.amplitude * gain;
    }
  }
}

/** The leaf landing on its stop, with a micro-rebound. */
function renderLanding(rate: number): Float32Array {
  const out = new Float32Array(Math.ceil(rate * 0.16));
  const size = random(0.93, 1.07);
  // Ratios of a thin clamped plate, slightly detuned per leaf.
  const plate: Mode[] = [
    { frequency: 1240, decay: 0.019, amplitude: 0.5 },
    { frequency: 2210, decay: 0.014, amplitude: 0.42 },
    { frequency: 3480, decay: 0.011, amplitude: 0.34 },
    { frequency: 4930, decay: 0.008, amplitude: 0.24 },
    { frequency: 6720, decay: 0.006, amplitude: 0.16 },
    { frequency: 9150, decay: 0.004, amplitude: 0.1 },
  ].map((mode) => ({
    frequency: mode.frequency * size * random(0.96, 1.04),
    decay: mode.decay * random(0.8, 1.2),
    amplitude: mode.amplitude * random(0.7, 1.15),
  }));
  // The drum housing and frame answer with a dull wooden-metal knock.
  const body: Mode[] = [
    { frequency: random(190, 240), decay: 0.016, amplitude: 0.26 },
    { frequency: random(420, 520), decay: 0.01, amplitude: 0.2 },
    { frequency: random(110, 130), decay: 0.02, amplitude: 0.07 },
  ];
  addImpact(out, rate, 0, [...plate, ...body], 0.9, 1);
  // Rebound: the leaf lifts off the stop and taps it again, quieter and duller.
  const reboundAt = Math.floor(rate * random(0.007, 0.012));
  addImpact(
    out,
    rate,
    reboundAt,
    plate.slice(0, 4).map((mode) => ({ ...mode, amplitude: mode.amplitude * 0.8 })),
    0.4,
    random(0.22, 0.34),
  );
  return out;
}

/** The latch letting go of the next leaf: a faint, bright tick. */
function renderRelease(rate: number): Float32Array {
  const out = new Float32Array(Math.ceil(rate * 0.05));
  addImpact(
    out,
    rate,
    0,
    [
      { frequency: random(2500, 2900), decay: 0.004, amplitude: 0.3 },
      { frequency: random(4300, 4900), decay: 0.003, amplitude: 0.22 },
      { frequency: random(7000, 7800), decay: 0.002, amplitude: 0.14 },
    ],
    0.5,
    0.35,
  );
  return out;
}

function toBuffer(context: BaseAudioContext, samples: Float32Array): AudioBuffer {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const buffer = context.createBuffer(1, samples.length, context.sampleRate);
  const channel = buffer.getChannelData(0);
  const scale = peak > 0 ? 0.9 / peak : 1;
  for (let index = 0; index < samples.length; index += 1) channel[index] = samples[index] * scale;
  return buffer;
}

/**
 * Impulse response of a large hard hall: sparse early reflections off glass and concrete, then a
 * dense tail (~2.4 s) that darkens as it decays, decorrelated between the two ears.
 */
function makeHallImpulse(context: BaseAudioContext): AudioBuffer {
  const rate = context.sampleRate;
  const seconds = 2.6;
  const length = Math.floor(rate * seconds);
  const impulse = context.createBuffer(2, length, rate);
  const preDelay = Math.floor(rate * 0.022);
  const reflections = [0.011, 0.019, 0.031, 0.043, 0.058, 0.074].map((time) => Math.floor(rate * time));
  for (let channelIndex = 0; channelIndex < 2; channelIndex += 1) {
    const channel = impulse.getChannelData(channelIndex);
    for (const [index, time] of reflections.entries()) {
      const at = time + Math.floor(random(0, rate * 0.003));
      if (at < length) channel[at] += (channelIndex === index % 2 ? 0.55 : 0.4) * 0.85 ** index;
    }
    let lowPassed = 0;
    for (let index = preDelay; index < length; index += 1) {
      const t = (index - preDelay) / rate;
      // Air and soft furnishings absorb high frequencies first: the tail gets darker over time.
      const brightness = Math.max(0.04, 0.75 * Math.exp(-t / 0.55));
      lowPassed += brightness * ((Math.random() * 2 - 1) - lowPassed);
      const envelope = Math.exp((-6.9 * t) / 2.4);
      const fadeIn = Math.min(1, t / 0.03);
      channel[index] += lowPassed * envelope * fadeIn * 0.9;
    }
  }
  return impulse;
}

/** Continuous drum-motor whir with gear ripple; its level follows how many cells are turning. */
function makeMotor(context: BaseAudioContext, destination: AudioNode): GainNode {
  const noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = noise.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  source.buffer = noise;
  source.loop = true;
  const band = context.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 150;
  band.Q.value = 1.4;

  const hum = context.createOscillator();
  hum.type = 'triangle';
  hum.frequency.value = 100;
  const humGain = context.createGain();
  humGain.gain.value = 0.12;

  // Gear ripple: the teeth of the drum gear modulate the whir about 22 times a second.
  const ripple = context.createOscillator();
  ripple.frequency.value = 22;
  const rippleDepth = context.createGain();
  rippleDepth.gain.value = 0.35;
  const motorGain = context.createGain();
  motorGain.gain.value = 0;
  const modulated = context.createGain();
  modulated.gain.value = 0.65;
  ripple.connect(rippleDepth).connect(modulated.gain);

  source.connect(band).connect(modulated);
  hum.connect(humGain).connect(modulated);
  modulated.connect(motorGain).connect(destination);
  source.start();
  hum.start();
  ripple.start();
  return motorGain;
}

function createEngine(context: BaseAudioContext): Engine {
  const rate = context.sampleRate;

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 12;
  compressor.ratio.value = 5;
  compressor.attack.value = 0.002;
  compressor.release.value = 0.12;
  const master = context.createGain();
  master.gain.value = 0.9;
  compressor.connect(master).connect(context.destination);

  // The board hangs well above and away from the listener: soften the very top end.
  const air = context.createBiquadFilter();
  air.type = 'highshelf';
  air.frequency.value = 7000;
  air.gain.value = -5;
  // Remove sub-bass rumble and DC; the mechanism has no real energy down there.
  const rumble = context.createBiquadFilter();
  rumble.type = 'highpass';
  rumble.frequency.value = 70;
  rumble.Q.value = 0.7;
  const bus = context.createGain();
  bus.gain.value = 0.5;
  bus.connect(rumble).connect(air);

  const dry = context.createGain();
  dry.gain.value = 0.78;
  const reverb = context.createConvolver();
  reverb.buffer = makeHallImpulse(context);
  const wet = context.createGain();
  wet.gain.value = 0.32;
  air.connect(dry).connect(compressor);
  air.connect(reverb).connect(wet).connect(compressor);

  return {
    context,
    bus,
    landings: Array.from({ length: LANDING_VARIANTS }, () => toBuffer(context, renderLanding(rate))),
    releases: Array.from({ length: RELEASE_VARIANTS }, () => toBuffer(context, renderRelease(rate))),
    motorGain: makeMotor(context, bus),
  };
}

export async function unmuteSound(): Promise<void> {
  if (!engine || engine.context.state === 'closed') engine = createEngine(new AudioContext());
  await (engine.context as AudioContext).resume();
  muted = false;
}

export function muteSound(): void {
  muted = true;
  if (engine) engine.motorGain.gain.setTargetAtTime(0, engine.context.currentTime, 0.05);
  motorLevel = 0;
}

export function isSoundMuted(): boolean {
  return muted;
}

function ready(): Engine | null {
  if (muted || !engine || engine.context.state !== 'running') return null;
  const now = engine.context.currentTime;
  if (now - windowStart > WINDOW_SECONDS) {
    windowStart = now;
    landingsInWindow = 0;
    releasesInWindow = 0;
  }
  return engine;
}

function play(target: Engine, buffer: AudioBuffer, pan: number, gain: number, when?: number): void {
  const { context } = target;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = random(0.97, 1.03);
  const level = context.createGain();
  level.gain.value = gain;
  const panner = context.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan * 0.75 + random(-0.05, 0.05)));
  source.connect(level).connect(panner).connect(target.bus);
  source.start(when ?? context.currentTime);
}

/** A leaf lands on its stop. @param pan -1 (left board) to 1 (right board). */
export function playFlap(pan = 0): void {
  const target = ready();
  if (!target || landingsInWindow >= MAX_LANDINGS_PER_WINDOW) return;
  landingsInWindow += 1;
  play(target, target.landings[Math.floor(Math.random() * target.landings.length)], pan, random(0.32, 0.5));
}

/** The latch releases the next leaf. */
export function playRelease(pan = 0): void {
  const target = ready();
  if (!target || releasesInWindow >= MAX_RELEASES_PER_WINDOW) return;
  releasesInWindow += 1;
  play(target, target.releases[Math.floor(Math.random() * target.releases.length)], pan, random(0.1, 0.18));
}

/** Drive the motor whir from the number of drums currently turning. */
export function setMechanismActivity(activeCells: number): void {
  if (!engine || muted) return;
  const level = Math.min(1, Math.sqrt(activeCells / 160)) * 0.035;
  if (Math.abs(level - motorLevel) < 0.004) return;
  motorLevel = level;
  engine.motorGain.gain.setTargetAtTime(level, engine.context.currentTime, level > 0 ? 0.08 : 0.25);
}

/**
 * Offline render of a full-board cascade, for auditioning the sound without the 3D scene.
 * Mirrors the board's timing: 82 cells per row, rows staggered, each drum stepping a random
 * number of leaves at its own speed. Not used by the app at runtime.
 */
export async function renderCascadePreview(seconds = 5): Promise<AudioBuffer> {
  const rate = 48000;
  const context = new OfflineAudioContext(2, Math.ceil(rate * seconds), rate);
  const offline = createEngine(context);
  const busy = new Float32Array(Math.ceil(seconds * 100));
  const landings = new Map<number, number>();
  const releases = new Map<number, number>();
  for (let row = 0; row < 7; row += 1) {
    for (let cell = 0; cell < 82; cell += 1) {
      const pan = (cell / 81) * 2 - 1;
      const duration = 0.068 + Math.random() * 0.022;
      let time = 0.3 + row * 0.07 + (cell % 41) * 0.012;
      const steps = Math.floor(Math.random() * 30);
      for (let step = 0; step < steps && time < seconds - 0.3; step += 1) {
        const releaseWindow = Math.floor(time / WINDOW_SECONDS);
        const landAt = time + duration * 0.74;
        const landWindow = Math.floor(landAt / WINDOW_SECONDS);
        if ((releases.get(releaseWindow) ?? 0) < MAX_RELEASES_PER_WINDOW) {
          releases.set(releaseWindow, (releases.get(releaseWindow) ?? 0) + 1);
          play(offline, offline.releases[Math.floor(Math.random() * RELEASE_VARIANTS)], pan, random(0.1, 0.18), time);
        }
        if ((landings.get(landWindow) ?? 0) < MAX_LANDINGS_PER_WINDOW) {
          landings.set(landWindow, (landings.get(landWindow) ?? 0) + 1);
          play(offline, offline.landings[Math.floor(Math.random() * LANDING_VARIANTS)], pan, random(0.32, 0.5), landAt);
        }
        busy[Math.floor(time * 100)] += 1;
        time += duration;
      }
    }
  }
  busy.forEach((count, index) => {
    const level = Math.min(1, Math.sqrt((count * 8) / 160)) * 0.035;
    offline.motorGain.gain.setTargetAtTime(level, index / 100, 0.08);
  });
  return context.startRendering();
}
