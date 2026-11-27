/*
 * Procedural split-flap clatter.
 * A full board cascade lands hundreds of leaves within a second or two, so voices are pooled:
 * at most MAX_VOICES_PER_WINDOW clicks start inside each short window, and the rest are dropped.
 * Together they still read as clatter, without clipping or starving the audio thread.
 */

const WINDOW_SECONDS = 0.018;
const MAX_VOICES_PER_WINDOW = 3;

let audioContext: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let master: GainNode | null = null;
let muted = true;
let windowStart = 0;
let voicesInWindow = 0;

function getAudioContext(): AudioContext {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContext();
    noiseBuffer = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * 0.08), audioContext.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      // Decaying noise burst: the sharp tick of a leaf hitting its stop.
      channel[index] = (Math.random() * 2 - 1) * Math.exp(-index / (channel.length * 0.18));
    }
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 6;
    master = audioContext.createGain();
    master.gain.value = 0.55;
    master.connect(compressor).connect(audioContext.destination);
  }
  return audioContext;
}

export async function unmuteSound(): Promise<void> {
  const context = getAudioContext();
  await context.resume();
  muted = false;
}

export function muteSound(): void {
  muted = true;
}

export function isSoundMuted(): boolean {
  return muted;
}

/** @param pan -1 (left board) to 1 (right board). */
export function playFlap(pan = 0): void {
  if (muted || !audioContext || !noiseBuffer || !master || audioContext.state !== 'running') return;

  const context = audioContext;
  const now = context.currentTime;
  if (now - windowStart > WINDOW_SECONDS) {
    windowStart = now;
    voicesInWindow = 0;
  }
  if (voicesInWindow >= MAX_VOICES_PER_WINDOW) return;
  voicesInWindow += 1;

  const variation = 0.9 + Math.random() * 0.2;
  const panner = context.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan * 0.8));
  panner.connect(master);

  const noise = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const clickGain = context.createGain();
  noise.buffer = noiseBuffer;
  noise.playbackRate.value = variation;
  filter.type = 'bandpass';
  filter.frequency.value = 2300 * variation;
  filter.Q.value = 1.1;
  clickGain.gain.setValueAtTime(0.0001, now);
  clickGain.gain.exponentialRampToValueAtTime(0.22, now + 0.002);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
  noise.connect(filter).connect(clickGain).connect(panner);
  noise.start(now);
  noise.stop(now + 0.05);

  // Low body knock from the drum housing.
  const knock = context.createOscillator();
  const knockGain = context.createGain();
  knock.type = 'triangle';
  knock.frequency.setValueAtTime(190 * variation, now);
  knock.frequency.exponentialRampToValueAtTime(85 * variation, now + 0.035);
  knockGain.gain.setValueAtTime(0.0001, now);
  knockGain.gain.exponentialRampToValueAtTime(0.07, now + 0.003);
  knockGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
  knock.connect(knockGain).connect(panner);
  knock.start(now);
  knock.stop(now + 0.055);
}
