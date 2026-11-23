let audioContext: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let muted = true;

function getAudioContext(): AudioContext {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContext();
    noiseBuffer = audioContext.createBuffer(
      1,
      Math.ceil(audioContext.sampleRate * 0.08),
      audioContext.sampleRate,
    );
    const channel = noiseBuffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }
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

export function playFlap(): void {
  if (muted || !audioContext || !noiseBuffer || audioContext.state !== 'running') return;

  const context = audioContext;
  const now = context.currentTime;
  const variation = 0.94 + Math.random() * 0.12;
  const noise = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const clickGain = context.createGain();
  noise.buffer = noiseBuffer;
  noise.playbackRate.value = variation;
  filter.type = 'bandpass';
  filter.frequency.value = 1750 * variation;
  filter.Q.value = 0.8;
  clickGain.gain.setValueAtTime(0.0001, now);
  clickGain.gain.exponentialRampToValueAtTime(0.18, now + 0.003);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
  noise.connect(filter).connect(clickGain).connect(context.destination);
  noise.start(now);
  noise.stop(now + 0.06);

  const thump = context.createOscillator();
  const thumpGain = context.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(112 * variation, now);
  thump.frequency.exponentialRampToValueAtTime(64 * variation, now + 0.045);
  thumpGain.gain.setValueAtTime(0.0001, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.1, now + 0.004);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
  thump.connect(thumpGain).connect(context.destination);
  thump.start(now);
  thump.stop(now + 0.065);
}
