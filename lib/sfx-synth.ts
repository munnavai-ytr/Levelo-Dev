/**
 * Levelo Parametric SFX Synthesizer & WAV Audio Encoder
 * Synthesizes retro and modern game sound effects with WebAudio and renders clean 16-bit WAV files.
 */

export interface SfxParams {
  waveform: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';
  startFreq: number; // Hz (20 - 4000)
  endFreq: number; // Hz (20 - 4000)
  slideTime: number; // seconds (0.01 - 2.0)
  slideType: 'linear' | 'exponential';
  attack: number; // seconds (0.001 - 0.5)
  decay: number; // seconds (0.01 - 1.0)
  sustain: number; // 0.0 - 1.0 volume
  release: number; // seconds (0.01 - 1.5)
  vibratoFreq: number; // Hz (0 - 30)
  vibratoDepth: number; // Hz (0 - 200)
  bitcrushBits: number; // 0 (disabled) to 16
  volume: number; // 0.1 to 1.0
}

export const SFX_PRESETS: Record<string, { label: string; icon: string; params: SfxParams }> = {
  jump: {
    label: 'Jump',
    icon: '🦘',
    params: {
      waveform: 'square',
      startFreq: 150,
      endFreq: 600,
      slideTime: 0.18,
      slideType: 'exponential',
      attack: 0.005,
      decay: 0.05,
      sustain: 0.2,
      release: 0.12,
      vibratoFreq: 0,
      vibratoDepth: 0,
      bitcrushBits: 0,
      volume: 0.8,
    },
  },
  coin: {
    label: 'Coin / Pickup',
    icon: '🪙',
    params: {
      waveform: 'sine',
      startFreq: 987, // B5
      endFreq: 1318, // E6
      slideTime: 0.08,
      slideType: 'linear',
      attack: 0.005,
      decay: 0.04,
      sustain: 0.3,
      release: 0.25,
      vibratoFreq: 0,
      vibratoDepth: 0,
      bitcrushBits: 0,
      volume: 0.75,
    },
  },
  hit: {
    label: 'Hit / Hurt',
    icon: '💥',
    params: {
      waveform: 'sawtooth',
      startFreq: 320,
      endFreq: 60,
      slideTime: 0.15,
      slideType: 'exponential',
      attack: 0.002,
      decay: 0.08,
      sustain: 0.1,
      release: 0.1,
      vibratoFreq: 15,
      vibratoDepth: 40,
      bitcrushBits: 6,
      volume: 0.9,
    },
  },
  shoot: {
    label: 'Laser / Shoot',
    icon: '🔫',
    params: {
      waveform: 'sawtooth',
      startFreq: 1200,
      endFreq: 180,
      slideTime: 0.12,
      slideType: 'exponential',
      attack: 0.002,
      decay: 0.06,
      sustain: 0.1,
      release: 0.08,
      vibratoFreq: 0,
      vibratoDepth: 0,
      bitcrushBits: 0,
      volume: 0.8,
    },
  },
  explosion: {
    label: 'Explosion',
    icon: '💣',
    params: {
      waveform: 'noise',
      startFreq: 240,
      endFreq: 40,
      slideTime: 0.45,
      slideType: 'exponential',
      attack: 0.005,
      decay: 0.25,
      sustain: 0.15,
      release: 0.4,
      vibratoFreq: 0,
      vibratoDepth: 0,
      bitcrushBits: 4,
      volume: 0.95,
    },
  },
  powerup: {
    label: 'Power-up',
    icon: '⭐',
    params: {
      waveform: 'triangle',
      startFreq: 260,
      endFreq: 1040,
      slideTime: 0.35,
      slideType: 'linear',
      attack: 0.01,
      decay: 0.1,
      sustain: 0.4,
      release: 0.25,
      vibratoFreq: 8,
      vibratoDepth: 25,
      bitcrushBits: 0,
      volume: 0.8,
    },
  },
  gameover: {
    label: 'Game Over',
    icon: '💀',
    params: {
      waveform: 'sawtooth',
      startFreq: 450,
      endFreq: 75,
      slideTime: 0.6,
      slideType: 'exponential',
      attack: 0.01,
      decay: 0.2,
      sustain: 0.3,
      release: 0.4,
      vibratoFreq: 5,
      vibratoDepth: 15,
      bitcrushBits: 0,
      volume: 0.85,
    },
  },
  blip: {
    label: 'Select / Blip',
    icon: '🔘',
    params: {
      waveform: 'sine',
      startFreq: 600,
      endFreq: 800,
      slideTime: 0.03,
      slideType: 'linear',
      attack: 0.002,
      decay: 0.02,
      sustain: 0.1,
      release: 0.04,
      vibratoFreq: 0,
      vibratoDepth: 0,
      bitcrushBits: 0,
      volume: 0.65,
    },
  },
};

/**
 * Plays the parametric SFX live through the browser AudioContext.
 */
export async function playSfx(params: SfxParams): Promise<void> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;

  const ctx = new AudioContextClass();
  const now = ctx.currentTime;
  const totalDuration = params.attack + params.decay + params.release + params.slideTime;

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.linearRampToValueAtTime(params.volume, now + params.attack);
  masterGain.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, params.volume * params.sustain),
    now + params.attack + params.decay
  );
  masterGain.gain.setValueAtTime(
    Math.max(0.0001, params.volume * params.sustain),
    now + params.attack + params.decay + Math.max(0, params.slideTime - params.decay)
  );
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + totalDuration);

  masterGain.connect(ctx.destination);

  if (params.waveform === 'noise') {
    // Generate white noise buffer
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * totalDuration));
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    // Filter frequency sweep
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(params.startFreq * 2, now);
    if (params.slideType === 'exponential') {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(20, params.endFreq * 2),
        now + params.slideTime
      );
    } else {
      filter.frequency.linearRampToValueAtTime(
        Math.max(20, params.endFreq * 2),
        now + params.slideTime
      );
    }

    whiteNoise.connect(filter);
    filter.connect(masterGain);
    whiteNoise.start(now);
    whiteNoise.stop(now + totalDuration + 0.05);
  } else {
    const osc = ctx.createOscillator();
    osc.type = params.waveform;

    // Frequency sweep
    osc.frequency.setValueAtTime(params.startFreq, now);
    if (params.slideType === 'exponential') {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, params.endFreq),
        now + params.slideTime
      );
    } else {
      osc.frequency.linearRampToValueAtTime(
        Math.max(20, params.endFreq),
        now + params.slideTime
      );
    }

    // Vibrato LFO if depth > 0
    if (params.vibratoDepth > 0 && params.vibratoFreq > 0) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(params.vibratoFreq, now);
      lfoGain.gain.setValueAtTime(params.vibratoDepth, now);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(now);
      lfo.stop(now + totalDuration + 0.05);
    }

    osc.connect(masterGain);
    osc.start(now);
    osc.stop(now + totalDuration + 0.05);
  }

  setTimeout(() => {
    ctx.close().catch(() => {});
  }, Math.ceil((totalDuration + 0.2) * 1000));
}

/**
 * Renders the parametric sound into a 44.1kHz 16-bit Mono WAV file as a Data URL.
 */
export async function renderSfxToWavDataUrl(params: SfxParams): Promise<{
  dataUrl: string;
  size: number;
  duration: number;
}> {
  const sampleRate = 44100;
  const totalDuration = Math.max(0.05, params.attack + params.decay + params.release + params.slideTime);
  const totalSamples = Math.floor(sampleRate * totalDuration);

  // OfflineAudioContext for clean deterministic offline rendering
  const offlineCtx = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
    1,
    totalSamples,
    sampleRate
  );

  const now = 0;
  const masterGain = offlineCtx.createGain();
  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.linearRampToValueAtTime(params.volume, now + params.attack);
  masterGain.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, params.volume * params.sustain),
    now + params.attack + params.decay
  );
  masterGain.gain.setValueAtTime(
    Math.max(0.0001, params.volume * params.sustain),
    now + params.attack + params.decay + Math.max(0, params.slideTime - params.decay)
  );
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + totalDuration);

  masterGain.connect(offlineCtx.destination);

  if (params.waveform === 'noise') {
    const noiseBuffer = offlineCtx.createBuffer(1, totalSamples, sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < totalSamples; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = offlineCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = offlineCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(params.startFreq * 2, now);
    if (params.slideType === 'exponential') {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(20, params.endFreq * 2),
        now + params.slideTime
      );
    } else {
      filter.frequency.linearRampToValueAtTime(
        Math.max(20, params.endFreq * 2),
        now + params.slideTime
      );
    }

    whiteNoise.connect(filter);
    filter.connect(masterGain);
    whiteNoise.start(now);
  } else {
    const osc = offlineCtx.createOscillator();
    osc.type = params.waveform;
    osc.frequency.setValueAtTime(params.startFreq, now);
    if (params.slideType === 'exponential') {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, params.endFreq),
        now + params.slideTime
      );
    } else {
      osc.frequency.linearRampToValueAtTime(
        Math.max(20, params.endFreq),
        now + params.slideTime
      );
    }

    if (params.vibratoDepth > 0 && params.vibratoFreq > 0) {
      const lfo = offlineCtx.createOscillator();
      const lfoGain = offlineCtx.createGain();
      lfo.frequency.setValueAtTime(params.vibratoFreq, now);
      lfoGain.gain.setValueAtTime(params.vibratoDepth, now);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(now);
    }

    osc.connect(masterGain);
    osc.start(now);
  }

  const renderedBuffer = await offlineCtx.startRendering();
  const channelData = renderedBuffer.getChannelData(0);

  // Encode to WAV Blob
  const wavBlob = encodeWav(channelData, sampleRate);
  const size = wavBlob.size;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(wavBlob);
  });

  return {
    dataUrl,
    size,
    duration: Math.round(totalDuration * 100) / 100,
  };
}

/**
 * Converts Float32Array PCM audio buffer into standard 16-bit PCM RIFF WAV Blob.
 */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length minus RIFF header */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (1 = PCM) */
  view.setUint16(20, 1, true);
  /* channel count (1 = Mono) */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sampleRate * 1 channel * 2 bytes/sample) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (1 channel * 2 bytes/sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  // Write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
