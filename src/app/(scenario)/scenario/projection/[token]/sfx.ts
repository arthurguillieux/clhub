/**
 * The base's own small noises, synthesised (neon tubes, doors, refusals, the circuit), so they work
 * even with no sound file. And the cassette filter for the room's recording.
 */
let ctx: AudioContext | null = null;

export function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, duration: number, type: OscillatorType = "square", volume = 0.05, when = 0) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(volume, a.currentTime + when);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + when + duration);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + when);
  o.stop(a.currentTime + when + duration + 0.05);
}

function noise(duration: number, volume = 0.08, freq = 900) {
  const a = audio();
  if (!a) return;
  const buffer = a.createBuffer(1, Math.floor(a.sampleRate * duration), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const source = a.createBufferSource();
  source.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = volume;
  source.connect(filter).connect(g).connect(a.destination);
  source.start();
}

export const SFX = {
  neon: () => {
    [0, 0.12, 0.3, 0.5, 0.7].forEach((t) => tone(100, 0.08, "sawtooth", 0.04, t));
    tone(120, 1.4, "sawtooth", 0.012, 0.8);
  },
  door: () => {
    noise(0.9, 0.12, 500);
    tone(70, 0.5, "sine", 0.08, 0.1);
  },
  deny: () => {
    tone(90, 0.35, "square", 0.06);
    tone(90, 0.35, "square", 0.06, 0.45);
  },
  ok: () => {
    tone(880, 0.12, "square", 0.04);
    tone(1320, 0.2, "square", 0.04, 0.14);
  },
  boot: () => {
    tone(1000, 0.15, "square", 0.03);
    noise(0.4, 0.03, 3000);
  },
  zap: () => {
    noise(0.5, 0.2, 2400);
    tone(55, 0.6, "sawtooth", 0.06);
  },
  glitch: () => {
    noise(0.35, 0.15, 4000);
    tone(1760, 0.08, "square", 0.03, 0.05);
    tone(220, 0.15, "sawtooth", 0.05, 0.15);
  },
  click: () => tone(1800, 0.03, "square", 0.03),
  wind: () => noise(2.5, 0.05, 300),
};

/**
 * Plays a recording through a worn cassette: hiss, no lows, no highs. Answers with an analyser for the
 * amber waveform, and a function that stops everything.
 */
export function cassette(element: HTMLMediaElement): { analyser: AnalyserNode; stop: () => void } | null {
  const a = audio();
  if (!a) return null;
  const source = a.createMediaElementSource(element);
  const low = a.createBiquadFilter();
  low.type = "highpass";
  low.frequency.value = 320;
  const high = a.createBiquadFilter();
  high.type = "lowpass";
  high.frequency.value = 3200;
  const analyser = a.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(low).connect(high).connect(analyser).connect(a.destination);
  const hissBuffer = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
  const data = hissBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  const hiss = a.createBufferSource();
  hiss.buffer = hissBuffer;
  hiss.loop = true;
  const hissGain = a.createGain();
  hissGain.gain.value = 0.025;
  hiss.connect(hissGain).connect(a.destination);
  hiss.start();
  return {
    analyser,
    stop: () => {
      try {
        hiss.stop();
        source.disconnect();
      } catch {
        // Already stopped.
      }
    },
  };
}
