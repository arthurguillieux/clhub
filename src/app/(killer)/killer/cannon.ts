/**
 * A cannon shot, synthesised on the spot (no audio file, nothing borrowed from
 * the films): a sharp noise crack, a falling sub-bass thump, then a long
 * filtered rumble. Browsers only allow sound after a click on the page, hence
 * the TV's "Activer le son" button, which passes its AudioContext here.
 */
export function playCannon(audio: AudioContext): void {
  const now = audio.currentTime;
  const out = audio.createGain();
  out.gain.value = 0.9;
  out.connect(audio.destination);

  // Crack: a burst of white noise through a band-pass, gone in a fraction of a second.
  const noiseLength = Math.floor(audio.sampleRate * 2.5);
  const buffer = audio.createBuffer(1, noiseLength, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < noiseLength; i++) data[i] = Math.random() * 2 - 1;

  const crack = audio.createBufferSource();
  crack.buffer = buffer;
  const crackFilter = audio.createBiquadFilter();
  crackFilter.type = "bandpass";
  crackFilter.frequency.value = 900;
  const crackGain = audio.createGain();
  crackGain.gain.setValueAtTime(1, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  crack.connect(crackFilter).connect(crackGain).connect(out);
  crack.start(now);
  crack.stop(now + 0.3);

  // Thump: a sine dropping from 90 Hz to 30 Hz.
  const thump = audio.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(90, now);
  thump.frequency.exponentialRampToValueAtTime(30, now + 0.9);
  const thumpGain = audio.createGain();
  thumpGain.gain.setValueAtTime(1.2, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
  thump.connect(thumpGain).connect(out);
  thump.start(now);
  thump.stop(now + 1.5);

  // Rumble: the same noise, low-passed, rolling away for a couple of seconds.
  const rumble = audio.createBufferSource();
  rumble.buffer = buffer;
  const rumbleFilter = audio.createBiquadFilter();
  rumbleFilter.type = "lowpass";
  rumbleFilter.frequency.setValueAtTime(400, now);
  rumbleFilter.frequency.exponentialRampToValueAtTime(60, now + 2.4);
  const rumbleGain = audio.createGain();
  rumbleGain.gain.setValueAtTime(0.0001, now);
  rumbleGain.gain.exponentialRampToValueAtTime(0.7, now + 0.08);
  rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
  rumble.connect(rumbleFilter).connect(rumbleGain).connect(out);
  rumble.start(now);
  rumble.stop(now + 2.5);
}
