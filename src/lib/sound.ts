// Procedural sound (no audio files) - everything here is synthesized at
// runtime with the Web Audio API: short oscillator/noise bursts for
// sound effects, and a tiny chiptune-style sequencer for background
// music. Deliberately simple/8-bit sounding rather than realistic -
// swap in real audio files later if/when they exist, this module's
// exported function names are the integration point either way.

const MUTE_STORAGE_KEY = 'comunopoly-muted';

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let muted = localStorage.getItem(MUTE_STORAGE_KEY) === 'true';

function ensureContext(): AudioContext | null {
  // Some environments (very old browsers, or this code running before
  // any DOM exists) might not have Web Audio at all - fail quiet rather
  // than throw, since sound is a nice-to-have, never load-bearing.
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!audioContext) {
    audioContext = new Ctor();
    masterGain = audioContext.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(audioContext.destination);

    sfxGain = audioContext.createGain();
    sfxGain.gain.value = 0.5;
    sfxGain.connect(masterGain);

    musicGain = audioContext.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(masterGain);
  }
  return audioContext;
}

/** Must be called from within a real user gesture (a click) - browsers refuse to start/resume audio otherwise. Safe to call repeatedly. */
export function initAudio(): void {
  const ctx = ensureContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {
      // Autoplay was refused (no user gesture yet, or the browser just
      // said no) - harmless, the next real click will retry.
    });
  }
}

/** Wires a one-time "first click anywhere" listener that unlocks audio and starts music (if not muted) - so sound works even if the player never touches the dedicated sound toggle, since joining/creating a room is itself a qualifying click. */
export function wireAutoInitOnFirstInteraction(): void {
  if (typeof document === 'undefined') return;
  const handler = () => {
    initAudio();
    if (!muted) startMusic();
    document.removeEventListener('pointerdown', handler);
  };
  document.addEventListener('pointerdown', handler, { once: true });
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  localStorage.setItem(MUTE_STORAGE_KEY, String(value));
  if (masterGain) masterGain.gain.value = value ? 0 : 1;
  if (value) {
    stopMusic();
  } else {
    initAudio();
    startMusic();
  }
}

export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}

// --- Sound effect primitives --------------------------------------------

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'square',
  gainValue = 0.3,
  when = 0,
): void {
  const ctx = ensureContext();
  if (!ctx || !sfxGain) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const start = ctx.currentTime + when;
  gain.gain.setValueAtTime(gainValue, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start(start);
  osc.stop(start + duration);
}

function sweep(startFreq: number, endFreq: number, duration: number, type: OscillatorType = 'sine', gainValue = 0.3): void {
  const ctx = ensureContext();
  if (!ctx || !sfxGain) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);
  gain.gain.setValueAtTime(gainValue, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function noiseBurst(duration: number, gainValue = 0.2): void {
  const ctx = ensureContext();
  if (!ctx || !sfxGain) return;
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = gainValue;
  source.connect(gain);
  gain.connect(sfxGain);
  source.start();
}

// --- Named sound effects --------------------------------------------------

export function playDiceTick(): void {
  tone(200 + Math.random() * 120, 0.045, 'square', 0.12);
}

export function playDiceLand(): void {
  tone(440, 0.09, 'triangle', 0.25);
  tone(330, 0.12, 'triangle', 0.2, 0.05);
}

/** Buying, paying/collecting rent, mortgaging, Smuggling - anything roubles-changing-hands. */
export function playCash(): void {
  sweep(600, 1300, 0.14, 'square', 0.2);
  tone(1500, 0.08, 'square', 0.15, 0.1);
}

export function playCardDraw(): void {
  sweep(320, 900, 0.18, 'sawtooth', 0.15);
  noiseBurst(0.05, 0.06);
}

export function playJail(): void {
  tone(160, 0.22, 'sawtooth', 0.22);
  tone(120, 0.28, 'sawtooth', 0.22, 0.16);
}

export function playDisappear(): void {
  sweep(600, 50, 0.55, 'sine', 0.22);
}

export function playEndgameFanfare(): void {
  const notes = [523.25, 659.25, 784.0, 1046.5]; // C E G C
  notes.forEach((freq, i) => tone(freq, 0.35, 'square', 0.22, i * 0.15));
}

// --- Background music: a tiny chiptune sequencer --------------------------

const NOTE_FREQ: Record<string, number> = {
  C4: 261.63,
  D4: 293.66,
  Eb4: 311.13,
  F4: 349.23,
  G4: 392.0,
  Ab4: 415.3,
  Bb4: 466.16,
  C5: 523.25,
  D5: 587.33,
  Eb5: 622.25,
};

interface Note {
  note: keyof typeof NOTE_FREQ;
  beats: number;
}

// Short, minor-key, march-ish loops - not meant to be a real
// composition, just enough motion that looping doesn't feel static.
const TRACKS: Note[][] = [
  [
    { note: 'C4', beats: 1 },
    { note: 'Eb4', beats: 1 },
    { note: 'G4', beats: 1 },
    { note: 'C5', beats: 1 },
    { note: 'Bb4', beats: 1 },
    { note: 'G4', beats: 1 },
    { note: 'Eb4', beats: 1 },
    { note: 'D4', beats: 2 },
  ],
  [
    { note: 'D4', beats: 1 },
    { note: 'F4', beats: 1 },
    { note: 'Ab4', beats: 1 },
    { note: 'G4', beats: 1 },
    { note: 'F4', beats: 1 },
    { note: 'D4', beats: 1 },
    { note: 'C4', beats: 2 },
  ],
  [
    { note: 'G4', beats: 0.5 },
    { note: 'G4', beats: 0.5 },
    { note: 'Eb4', beats: 1 },
    { note: 'F4', beats: 1 },
    { note: 'D4', beats: 1 },
    { note: 'Eb5', beats: 1 },
    { note: 'C5', beats: 2 },
  ],
];

const BEAT_SECONDS = 0.33;

let musicTimer: ReturnType<typeof setTimeout> | null = null;
let musicPlaying = false;
let lastTrackIndex = -1;

function playTrack(track: Note[]): number {
  const ctx = ensureContext();
  if (!ctx || !musicGain) return 1;
  let t = ctx.currentTime + 0.05;
  for (const { note, beats } of track) {
    const freq = NOTE_FREQ[note];
    const duration = beats * BEAT_SECONDS;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.92);
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(t);
    osc.stop(t + duration);
    t += duration;
  }
  return t - ctx.currentTime;
}

/** Starts (or continues) the shuffling background-music loop. No-op if already playing or muted. */
export function startMusic(): void {
  if (musicPlaying || muted) return;
  const ctx = ensureContext();
  if (!ctx) return;
  musicPlaying = true;

  const loop = () => {
    if (!musicPlaying) return;
    let index = Math.floor(Math.random() * TRACKS.length);
    if (TRACKS.length > 1 && index === lastTrackIndex) {
      index = (index + 1) % TRACKS.length;
    }
    lastTrackIndex = index;
    const duration = playTrack(TRACKS[index]);
    musicTimer = setTimeout(loop, duration * 1000 + 500);
  };
  loop();
}

export function stopMusic(): void {
  musicPlaying = false;
  if (musicTimer) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
}
