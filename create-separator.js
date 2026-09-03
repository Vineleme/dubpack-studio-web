const DEMUCS_ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.min.mjs';
const DEMUCS_WASM_PATHS = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';
const DEMUCS_MODEL_URL = 'https://huggingface.co/StemSplitio/htdemucs-ft-vocals-onnx/resolve/main/htdemucs_ft_vocals_fp16weights.onnx';
const DEMUCS_SAMPLE_RATE = 44100;
const DEMUCS_SEGMENT_S = 7.8;
const DEMUCS_N_SAMPLES = Math.round(DEMUCS_SEGMENT_S * DEMUCS_SAMPLE_RATE);
const DEMUCS_N_CHANNELS = 2;
const DEMUCS_OVERLAP = Math.floor(DEMUCS_N_SAMPLES / 4);
const DEMUCS_STRIDE = DEMUCS_N_SAMPLES - DEMUCS_OVERLAP;
const DEMUCS_VOCALS_ROW = 3;

let ortModule = null;
let ortLoadPromise = null;
let demucsSession = null;
let demucsSessionPromise = null;

function makeTransitionWindow(segment, overlap) {
  const window = new Float32Array(segment);
  window.fill(1);
  for (let i = 0; i < overlap; i += 1) {
    const value = i / overlap;
    window[i] = value;
    window[segment - 1 - i] = value;
  }
  return window;
}

function copyChannel(data) {
  return data instanceof Float32Array ? new Float32Array(data) : Float32Array.from(data);
}

async function loadOrt() {
  if (ortModule) return ortModule;
  if (!ortLoadPromise) {
    ortLoadPromise = import(/* webpackIgnore: true */ DEMUCS_ORT_CDN)
      .then((mod) => {
        ortModule = mod;
        if (ortModule?.env?.wasm) {
          // Without COOP/COEP, multi-thread WASM can crash — keep single-thread.
          ortModule.env.wasm.numThreads = 1;
          ortModule.env.wasm.wasmPaths = DEMUCS_WASM_PATHS;
        }
        return ortModule;
      })
      .catch((error) => {
        ortLoadPromise = null;
        throw error;
      });
  }
  return ortLoadPromise;
}

async function createOrtSession(ort, providers) {
  return ort.InferenceSession.create(DEMUCS_MODEL_URL, {
    executionProviders: providers,
    graphOptimizationLevel: 'all'
  });
}

async function loadDemucsSession(onProgress) {
  if (demucsSession) return demucsSession;
  if (!demucsSessionPromise) {
    demucsSessionPromise = (async () => {
      onProgress?.(4, 'load');
      const ort = await loadOrt();
      const attempts = [];
      if (typeof navigator !== 'undefined' && 'gpu' in navigator) attempts.push(['webgpu']);
      attempts.push(['wasm']);
      let lastError = null;
      for (const providers of attempts) {
        try {
          demucsSession = await createOrtSession(ort, providers);
          return demucsSession;
        } catch (error) {
          lastError = error;
          console.warn('Demucs session failed with', providers, error);
        }
      }
      throw lastError || new Error('demucs-session-failed');
    })().catch((error) => {
      demucsSession = null;
      demucsSessionPromise = null;
      throw error;
    });
  }
  return demucsSessionPromise;
}

async function resampleTo44100Stereo(audioBuffer) {
  const leftIn = copyChannel(audioBuffer.getChannelData(0));
  const rightIn = copyChannel(
    audioBuffer.numberOfChannels > 1
      ? audioBuffer.getChannelData(1)
      : audioBuffer.getChannelData(0)
  );
  if (audioBuffer.sampleRate === DEMUCS_SAMPLE_RATE) {
    return [leftIn, rightIn];
  }
  const length = Math.max(1, Math.ceil(audioBuffer.duration * DEMUCS_SAMPLE_RATE));
  const offline = new OfflineAudioContext(2, length, DEMUCS_SAMPLE_RATE);
  const buffer = offline.createBuffer(2, leftIn.length, audioBuffer.sampleRate);
  buffer.copyToChannel(leftIn, 0);
  buffer.copyToChannel(rightIn, 1);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();
  return [
    copyChannel(rendered.getChannelData(0)),
    copyChannel(rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : rendered.getChannelData(0))
  ];
}

async function separateVocalsStereo(session, mix, ort, onChunk) {
  const totalLen = mix[0].length;
  const nChunks = Math.max(1, Math.ceil(totalLen / DEMUCS_STRIDE));
  const vocals = [new Float32Array(totalLen), new Float32Array(totalLen)];
  const weight = new Float32Array(totalLen);
  const win = makeTransitionWindow(DEMUCS_N_SAMPLES, DEMUCS_OVERLAP);
  const chunkBuf = new Float32Array(DEMUCS_N_CHANNELS * DEMUCS_N_SAMPLES);

  for (let index = 0; index < nChunks; index += 1) {
    onChunk?.(index + 1, nChunks);
    const start = index * DEMUCS_STRIDE;
    const end = Math.min(start + DEMUCS_N_SAMPLES, totalLen);
    chunkBuf.fill(0);
    for (let channel = 0; channel < DEMUCS_N_CHANNELS; channel += 1) {
      chunkBuf
        .subarray(channel * DEMUCS_N_SAMPLES, channel * DEMUCS_N_SAMPLES + (end - start))
        .set(mix[channel].subarray(start, end));
    }
    const inputTensor = new ort.Tensor('float32', chunkBuf, [1, DEMUCS_N_CHANNELS, DEMUCS_N_SAMPLES]);
    const result = await session.run({ mix: inputTensor });
    const stems = result.stems?.data || result.output?.data || Object.values(result)[0]?.data;
    if (!stems) throw new Error('demucs-empty-output');
    const vocalsOffset = (DEMUCS_VOCALS_ROW * DEMUCS_N_CHANNELS) * DEMUCS_N_SAMPLES;
    const chunkLen = end - start;
    for (let channel = 0; channel < DEMUCS_N_CHANNELS; channel += 1) {
      const rowStart = vocalsOffset + channel * DEMUCS_N_SAMPLES;
      for (let sample = 0; sample < chunkLen; sample += 1) {
        vocals[channel][start + sample] += stems[rowStart + sample] * win[sample];
      }
    }
    for (let sample = 0; sample < chunkLen; sample += 1) weight[start + sample] += win[sample];
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  for (let channel = 0; channel < DEMUCS_N_CHANNELS; channel += 1) {
    for (let sample = 0; sample < totalLen; sample += 1) {
      vocals[channel][sample] /= Math.max(weight[sample], 1e-8);
    }
  }
  return vocals;
}

function subtractStereo(mix, vocals) {
  const backing = [new Float32Array(mix[0].length), new Float32Array(mix[0].length)];
  for (let channel = 0; channel < 2; channel += 1) {
    for (let sample = 0; sample < mix[channel].length; sample += 1) {
      backing[channel][sample] = mix[channel][sample] - vocals[channel][sample];
    }
  }
  return backing;
}

/** Lightweight mid/side fallback when Demucs cannot load (no download, instant). */
function karaokeSeparate(mix) {
  const totalLen = mix[0].length;
  const vocals = [new Float32Array(totalLen), new Float32Array(totalLen)];
  const backing = [new Float32Array(totalLen), new Float32Array(totalLen)];
  for (let sample = 0; sample < totalLen; sample += 1) {
    const left = mix[0][sample];
    const right = mix[1][sample];
    const mid = (left + right) * 0.5;
    const side = (left - right) * 0.5;
    vocals[0][sample] = mid;
    vocals[1][sample] = mid;
    // Keep stereo ambience / effects; strongly attenuate centered dialogue.
    backing[0][sample] = side + (mid * 0.015);
    backing[1][sample] = (-side) + (mid * 0.015);
  }
  return { vocals, backing };
}

function encodeStereoWav(left, right, sampleRate) {
  const length = Math.min(left.length, right.length);
  const buffer = new ArrayBuffer(44 + length * 4);
  const view = new DataView(buffer);
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + length * 4, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, length * 4, true);
  let offset = 44;
  for (let i = 0; i < length; i += 1) {
    for (const sample of [left[i], right[i]]) {
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
  }
  return new Uint8Array(buffer);
}

async function separateWithDemucs(audioBuffer, onProgress) {
  const ort = await loadOrt();
  const session = await loadDemucsSession((pct, stage) => {
    if (stage === 'load') onProgress?.(pct, 'load');
  });
  onProgress?.(8, 'prepare');
  const mix = await resampleTo44100Stereo(audioBuffer);
  const vocals = await separateVocalsStereo(session, mix, ort, (chunk, total) => {
    const pct = 8 + ((chunk / Math.max(1, total)) * 86);
    onProgress?.(pct, 'run', { chunk, total });
  });
  const backing = subtractStereo(mix, vocals);
  return { vocals, backing, sampleRate: DEMUCS_SAMPLE_RATE, mode: 'demucs' };
}

async function separateWithKaraoke(audioBuffer, onProgress) {
  onProgress?.(20, 'prepare');
  const mix = await resampleTo44100Stereo(audioBuffer);
  onProgress?.(70, 'run', { chunk: 1, total: 1 });
  const separated = karaokeSeparate(mix);
  return {
    vocals: separated.vocals,
    backing: separated.backing,
    sampleRate: DEMUCS_SAMPLE_RATE,
    mode: 'karaoke'
  };
}

export async function separateCreateStems(audioBuffer, { onProgress } = {}) {
  let separated;
  try {
    separated = await separateWithDemucs(audioBuffer, onProgress);
  } catch (error) {
    console.warn('Demucs unavailable, using local karaoke fallback', error);
    onProgress?.(15, 'fallback');
    separated = await separateWithKaraoke(audioBuffer, onProgress);
  }
  onProgress?.(98, 'encode');
  return {
    sampleRate: separated.sampleRate,
    mode: separated.mode,
    vocalsBytes: encodeStereoWav(separated.vocals[0], separated.vocals[1], separated.sampleRate),
    backingBytes: encodeStereoWav(separated.backing[0], separated.backing[1], separated.sampleRate)
  };
}
