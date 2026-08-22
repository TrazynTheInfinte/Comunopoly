// Procedural sound (no audio files) - everything here is synthesized at
// runtime with the Web Audio API: short oscillator/noise bursts for
// sound effects, and a tiny chiptune-style sequencer for background
// music. Deliberately simple/8-bit sounding rather than realistic -
// swap in real audio files later if/when they exist, this module's
// exported function names are the integration point either way.

const MUTE_STORAGE_KEY = 'comunopoly-muted';
const MUSIC_VOLUME_STORAGE_KEY = 'comunopoly-music-volume';
// The gain/volume actually applied is this, scaled by the user's music
// volume preference (0-1) - these are the "100%" ceilings, tuned so
// music sits behind the sound effects rather than over them.
const MAX_MENU_MUSIC_GAIN = 0.16;
const MAX_GAME_MUSIC_VOLUME = 0.35;

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
}

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let muted = localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
let musicVolume = clamp01(Number(localStorage.getItem(MUSIC_VOLUME_STORAGE_KEY) ?? '1'));

export function getMusicVolume(): number {
  return musicVolume;
}

/** A 0-1 preference, independent of the mute toggle - applies to both the menu's procedural music and the real in-game tracks. */
export function setMusicVolume(value: number): void {
  musicVolume = clamp01(value);
  localStorage.setItem(MUSIC_VOLUME_STORAGE_KEY, String(musicVolume));
  if (musicGain) musicGain.gain.value = MAX_MENU_MUSIC_GAIN * musicVolume;
  if (gameMusicEl) gameMusicEl.volume = MAX_GAME_MUSIC_VOLUME * musicVolume;
}

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
    musicGain.gain.value = MAX_MENU_MUSIC_GAIN * musicVolume;
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
    if (!muted) startMenuMusic();
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
    stopMenuMusic();
    gameMusicEl?.pause();
    return;
  }

  initAudio();
  // Resume whichever was actually supposed to be playing - a game
  // already in progress (gameMusicMode survives muting, even though
  // actual playback was paused while muted) takes priority over
  // falling back to menu music. Resumes the same paused track rather
  // than picking a new one, same as hitting "play" again on any paused
  // <audio> element.
  if (gameMusicMode && gameMusicEl) {
    gameMusicEl.play().catch(() => {});
  } else {
    startMenuMusic();
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

/** A property forcibly changing hands with no roubles involved - Kulak's/T-Rex's auto-seize, Siege of Stalingrad, The Volga. Harsher/darker than playCash, since nobody got paid for this. */
export function playSeize(): void {
  sweep(500, 150, 0.28, 'sawtooth', 0.25);
  noiseBurst(0.08, 0.12);
}

/** Chernobyl Power exploding - a low sweeping thud plus a noise burst, distinct from playSeize (a quick heist-like sting) since this is meant to read as a genuine one-time disaster, not just an ordinary property changing hands. */
export function playExplosion(): void {
  sweep(300, 40, 0.5, 'sawtooth', 0.32);
  noiseBurst(0.3, 0.28);
}

/** Plays the instant it becomes a player's own turn - a cue to notice even if they're not looking at the board (alt-tabbed, etc). */
export function playYourTurn(): void {
  tone(494, 0.1, 'triangle', 0.22);
  tone(659, 0.16, 'triangle', 0.22, 0.1);
}

/** The "are you still there?" AFK prompt appearing (see useAfkSelfCheck) - deliberately more insistent than playYourTurn, since this one means a countdown to an automatic skip has already started. */
export function playAfkAlert(): void {
  tone(220, 0.12, 'square', 0.2);
  tone(220, 0.12, 'square', 0.2, 0.2);
  tone(220, 0.12, 'square', 0.2, 0.4);
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

let menuMusicTimer: ReturnType<typeof setTimeout> | null = null;
let menuMusicPlaying = false;
let lastMenuTrackIndex = -1;

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

/** Starts (or continues) the shuffling menu-music loop. No-op if already playing, muted, or a game's real background track is active - menu music must never play underneath the in-game tracks (they're separate audio systems, so nothing else would stop the overlap). See startGameMusic/startFinalRoundMusic for the real-audio-file tracks that play once a game's actually underway. */
export function startMenuMusic(): void {
  if (menuMusicPlaying || muted || gameMusicMode) return;
  const ctx = ensureContext();
  if (!ctx) return;
  menuMusicPlaying = true;

  const loop = () => {
    if (!menuMusicPlaying) return;
    let index = Math.floor(Math.random() * TRACKS.length);
    if (TRACKS.length > 1 && index === lastMenuTrackIndex) {
      index = (index + 1) % TRACKS.length;
    }
    lastMenuTrackIndex = index;
    const duration = playTrack(TRACKS[index]);
    menuMusicTimer = setTimeout(loop, duration * 1000 + 500);
  };
  loop();
}

export function stopMenuMusic(): void {
  menuMusicPlaying = false;
  if (menuMusicTimer) {
    clearTimeout(menuMusicTimer);
    menuMusicTimer = null;
  }
}

// --- Background music: real tracks for in-game play -----------------------
//
// Two pools of real audio files (public/audio/), supplied rather than
// synthesized: "standard" tracks shuffle continuously during normal
// play, same idea as the menu's procedural loop; once the Endgame's
// final lap starts, one "final" track is chosen at random and just
// loops for the rest of the match instead of continuing to shuffle.
// Plain <audio> elements rather than the Web Audio graph above - these
// are multi-minute files, and <audio> streams them instead of decoding
// the whole thing into memory up front the way Web Audio's
// decodeAudioData would.

// Exposed (as name/url pairs) for the Dev Panel's track switcher -
// everything else in this module just picks from these by index.
export const STANDARD_TRACKS = ['standard-1.mp3', 'standard-2.mp3', 'standard-3.mp3'].map((name) => ({
  name,
  url: `${import.meta.env.BASE_URL}audio/${name}`,
}));
export const FINAL_TRACKS = ['final-1.mp3', 'final-2.mp3', 'final-3.mp3'].map((name) => ({
  name,
  url: `${import.meta.env.BASE_URL}audio/${name}`,
}));
const STANDARD_TRACK_URLS = STANDARD_TRACKS.map((t) => t.url);
const FINAL_TRACK_URLS = FINAL_TRACKS.map((t) => t.url);

let gameMusicEl: HTMLAudioElement | null = null;
let gameMusicMode: 'standard' | 'final' | null = null;
let lastStandardTrackUrl: string | null = null;

function ensureGameMusicElement(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!gameMusicEl) {
    gameMusicEl = new Audio();
    gameMusicEl.volume = MAX_GAME_MUSIC_VOLUME * musicVolume;
  }
  return gameMusicEl;
}

/** Plays (if not muted - but always picks/sets up the track either way, so unmuting later resumes correctly) a new random standard track, avoiding an immediate repeat. */
function playStandardTrack(): void {
  const el = ensureGameMusicElement();
  if (!el) return;
  let url = STANDARD_TRACK_URLS[Math.floor(Math.random() * STANDARD_TRACK_URLS.length)];
  if (STANDARD_TRACK_URLS.length > 1 && url === lastStandardTrackUrl) {
    const currentIndex = STANDARD_TRACK_URLS.indexOf(url);
    url = STANDARD_TRACK_URLS[(currentIndex + 1) % STANDARD_TRACK_URLS.length];
  }
  lastStandardTrackUrl = url;
  el.loop = false;
  el.src = url;
  if (muted) return;
  el.play().catch(() => {
    // Refused (no gesture yet, still loading, etc.) - harmless, whatever
    // triggers next (a click, the next call) will retry.
  });
}

/**
 * Shuffles continuously among the "standard" gameplay tracks - each one
 * plays once through, then a different one is picked. Call once when a
 * game actually starts. Sets up the track even while muted, so the
 * "resume where we left off" logic in setMuted has something to resume.
 */
export function startGameMusic(): void {
  const el = ensureGameMusicElement();
  if (!el) return;
  if (gameMusicMode === 'standard') return; // already doing this
  gameMusicMode = 'standard';
  el.onended = () => {
    if (gameMusicMode === 'standard') playStandardTrack();
  };
  playStandardTrack();
}

/** Switches to a single randomly-chosen "final round" track, looped for the rest of the match. Call once when the Endgame's final lap begins. */
export function startFinalRoundMusic(): void {
  const el = ensureGameMusicElement();
  if (!el) return;
  if (gameMusicMode === 'final') return; // already doing this
  gameMusicMode = 'final';
  el.onended = null;
  el.loop = true;
  el.src = FINAL_TRACK_URLS[Math.floor(Math.random() * FINAL_TRACK_URLS.length)];
  if (muted) return;
  el.play().catch(() => {});
}

/** Stops whichever in-game track (standard or final) is currently playing. Call when leaving a game back to the lobby/menu. */
export function stopGameMusic(): void {
  gameMusicMode = null;
  if (gameMusicEl) {
    gameMusicEl.onended = null;
    gameMusicEl.pause();
  }
}

/**
 * Dev Panel track switcher: forces a specific track to play right now,
 * bypassing the normal shuffle/pick-at-random logic - lets someone
 * preview any of the 6 without waiting for it to come up naturally.
 * Standard tracks picked this way still auto-advance (to another
 * random standard track) when they end, same as the real thing; a
 * final track picked this way just loops, same as the real thing.
 */
export function debugPlayGameTrack(kind: 'standard' | 'final', index: number): void {
  const el = ensureGameMusicElement();
  if (!el) return;
  const track = (kind === 'standard' ? STANDARD_TRACKS : FINAL_TRACKS)[index];
  if (!track) return;

  gameMusicMode = kind;
  if (kind === 'standard') {
    lastStandardTrackUrl = track.url;
    el.loop = false;
    el.onended = () => {
      if (gameMusicMode === 'standard') playStandardTrack();
    };
  } else {
    el.loop = true;
    el.onended = null;
  }
  el.src = track.url;
  if (muted) return;
  el.play().catch(() => {});
}
