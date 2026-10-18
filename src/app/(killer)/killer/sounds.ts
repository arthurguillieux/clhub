/**
 * The TV's sounds. Browsers only allow sound after a click on the page, hence the TV's "Activer le
 * son" button, which creates the AudioContext passed here.
 *
 * The elimination is a cannon shot: a recorded one when ELIMINATION_SAMPLE points to a file in
 * public/, otherwise synthesised on the spot — a bright crack, a distorted body, a sub-bass thump
 * and a rumble with an echo. Most of the synthesised energy sits between 150 Hz and 3 kHz: the
 * very first version was nearly all sub-bass, which a laptop's speakers can't play.
 */

/** A recorded shot to play instead of the synthesised one (a file under public/), or null. */
export const ELIMINATION_SAMPLE: string | null = null;

/** Fetches and decodes a recorded sound; null if it can't be had (the synthesised shot then plays). */
export async function loadSample(audio: AudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await audio.decodeAudioData(await response.arrayBuffer());
  } catch {
    return null;
  }
}
function noiseBuffer(audio: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(audio.sampleRate * seconds);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function distortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i * 2) / curve.length - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  return curve;
}

export function playElimination(audio: AudioContext, sample: AudioBuffer | null = null): void {
  const now = audio.currentTime;

  if (sample) {
    const source = audio.createBufferSource();
    source.buffer = sample;
    source.connect(audio.destination);
    source.start(now);
    return;
  }

  // Everything goes through a compressor so the sound is loud without clipping.
  const master = audio.createDynamicsCompressor();
  master.threshold.value = -18;
  master.ratio.value = 6;
  const volume = audio.createGain();
  volume.gain.value = 1.4;
  master.connect(volume).connect(audio.destination);

  // A short echo, as if the shot rang out across a hall.
  const echo = audio.createDelay();
  echo.delayTime.value = 0.28;
  const echoFeedback = audio.createGain();
  echoFeedback.gain.value = 0.32;
  const echoTone = audio.createBiquadFilter();
  echoTone.type = "lowpass";
  echoTone.frequency.value = 1400;
  echo.connect(echoTone).connect(echoFeedback).connect(echo);
  echoTone.connect(master);

  const noise = noiseBuffer(audio, 3);

  // Crack: bright noise, gone in a tenth of a second.
  const crack = audio.createBufferSource();
  crack.buffer = noise;
  const crackFilter = audio.createBiquadFilter();
  crackFilter.type = "highpass";
  crackFilter.frequency.value = 900;
  const crackGain = audio.createGain();
  crackGain.gain.setValueAtTime(1.6, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
  crack.connect(crackFilter).connect(crackGain);
  crackGain.connect(master);
  crackGain.connect(echo);
  crack.start(now);
  crack.stop(now + 0.2);

  // Body: a falling tone pushed through distortion, so its harmonics reach small speakers.
  const body = audio.createOscillator();
  body.type = "triangle";
  body.frequency.setValueAtTime(190, now);
  body.frequency.exponentialRampToValueAtTime(48, now + 0.6);
  const shaper = audio.createWaveShaper();
  shaper.curve = distortionCurve(40);
  const bodyTone = audio.createBiquadFilter();
  bodyTone.type = "lowpass";
  bodyTone.frequency.setValueAtTime(2400, now);
  bodyTone.frequency.exponentialRampToValueAtTime(300, now + 0.8);
  const bodyGain = audio.createGain();
  bodyGain.gain.setValueAtTime(0.0001, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.9, now + 0.01);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
  body.connect(shaper).connect(bodyTone).connect(bodyGain);
  bodyGain.connect(master);
  bodyGain.connect(echo);
  body.start(now);
  body.stop(now + 1.2);

  // Sub thump: felt on a TV or a sound bar, harmless elsewhere.
  const thump = audio.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(85, now);
  thump.frequency.exponentialRampToValueAtTime(32, now + 0.9);
  const thumpGain = audio.createGain();
  thumpGain.gain.setValueAtTime(1, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
  thump.connect(thumpGain).connect(master);
  thump.start(now);
  thump.stop(now + 1.4);

  // Rumble: noise in the mid-range, rolling away for a couple of seconds.
  const rumble = audio.createBufferSource();
  rumble.buffer = noise;
  const rumbleFilter = audio.createBiquadFilter();
  rumbleFilter.type = "lowpass";
  rumbleFilter.frequency.setValueAtTime(2200, now);
  rumbleFilter.frequency.exponentialRampToValueAtTime(160, now + 2.6);
  const rumbleGain = audio.createGain();
  rumbleGain.gain.setValueAtTime(0.0001, now);
  rumbleGain.gain.exponentialRampToValueAtTime(0.8, now + 0.05);
  rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 2.8);
  rumble.connect(rumbleFilter).connect(rumbleGain).connect(master);
  rumble.start(now);
  rumble.stop(now + 2.9);

  // The echo loop would otherwise keep running silently forever.
  setTimeout(() => {
    echo.disconnect();
    master.disconnect();
  }, 4500);
}

/** Two soft tones, played when the sound is switched on: proof that the TV can be heard. */
export function playChime(audio: AudioContext): void {
  const now = audio.currentTime;
  [880, 1320].forEach((frequency, i) => {
    const start = now + i * 0.14;
    const tone = audio.createOscillator();
    tone.type = "sine";
    tone.frequency.value = frequency;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
    tone.connect(gain).connect(audio.destination);
    tone.start(start);
    tone.stop(start + 0.65);
  });
}
