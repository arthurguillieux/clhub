/**
 * Sounds synthesised on the spot (no audio file). Browsers only allow sound after a click on the
 * page, hence the TV's "Activer le son" button, which creates the AudioContext passed here.
 *
 * The elimination is an impact followed by a machine powering down: a few digital glitches, a
 * distorted boom, then a falling synth tone. Most of the energy sits between 150 Hz and 3 kHz —
 * the first version (a cannon) was nearly all sub-bass, which a laptop's speakers can't play, and
 * was silent on the first try. The sub-bass stays on top for a real TV or a sound bar.
 */
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

export function playElimination(audio: AudioContext): void {
  const now = audio.currentTime;

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

  // Rumble: noise in the mid-range, rolling away.
  const rumble = audio.createBufferSource();
  rumble.buffer = noise;
  const rumbleFilter = audio.createBiquadFilter();
  rumbleFilter.type = "lowpass";
  rumbleFilter.frequency.setValueAtTime(2200, now);
  rumbleFilter.frequency.exponentialRampToValueAtTime(160, now + 1.8);
  const rumbleGain = audio.createGain();
  rumbleGain.gain.setValueAtTime(0.0001, now);
  rumbleGain.gain.exponentialRampToValueAtTime(0.6, now + 0.05);
  rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 2);
  rumble.connect(rumbleFilter).connect(rumbleGain).connect(master);
  rumble.start(now);
  rumble.stop(now + 2.1);

  // Glitches: three square-wave blips just before the impact, like a system failing.
  [0, 0.06, 0.11].forEach((delay, i) => {
    const blip = audio.createOscillator();
    blip.type = "square";
    blip.frequency.value = [2100, 1450, 2600][i]!;
    const blipGain = audio.createGain();
    blipGain.gain.setValueAtTime(0.0001, now + delay);
    blipGain.gain.exponentialRampToValueAtTime(0.18, now + delay + 0.005);
    blipGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.045);
    blip.connect(blipGain).connect(master);
    blip.start(now + delay);
    blip.stop(now + delay + 0.05);
  });

  // Power-down: a sawtooth sliding from high to low while its filter closes.
  const sweepStart = now + 0.15;
  const sweep = audio.createOscillator();
  sweep.type = "sawtooth";
  sweep.frequency.setValueAtTime(820, sweepStart);
  sweep.frequency.exponentialRampToValueAtTime(42, sweepStart + 1.7);
  const wobble = audio.createOscillator();
  wobble.frequency.value = 9;
  const wobbleDepth = audio.createGain();
  wobbleDepth.gain.value = 14;
  wobble.connect(wobbleDepth).connect(sweep.frequency);
  const sweepFilter = audio.createBiquadFilter();
  sweepFilter.type = "lowpass";
  sweepFilter.Q.value = 6;
  sweepFilter.frequency.setValueAtTime(4000, sweepStart);
  sweepFilter.frequency.exponentialRampToValueAtTime(180, sweepStart + 1.8);
  const sweepGain = audio.createGain();
  sweepGain.gain.setValueAtTime(0.0001, sweepStart);
  sweepGain.gain.exponentialRampToValueAtTime(0.32, sweepStart + 0.06);
  sweepGain.gain.setValueAtTime(0.32, sweepStart + 1);
  sweepGain.gain.exponentialRampToValueAtTime(0.001, sweepStart + 1.9);
  sweep.connect(sweepFilter).connect(sweepGain);
  sweepGain.connect(master);
  sweepGain.connect(echo);
  sweep.start(sweepStart);
  wobble.start(sweepStart);
  sweep.stop(sweepStart + 2);
  wobble.stop(sweepStart + 2);

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
