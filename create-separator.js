const DEMUCS_ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.min.mjs';
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

async function loadOrt() {
  if (ortModule) return ortModule;
  if (!ortLoadPromise) {
    ortLoadPromise = import(/* webpackIgnore: true */ DEMUCS_ORT_CDN).then((mod) => {
      ortModule = mod;
      const threads = Math.min(navigator.hardwareConcurrency || 2, 4);
      if (ortModule?.env?.wasm) ortModule.env.wasm.numThreads = threads;
      return ortModule;
    });
  }
  return ortLoadPromise;
}

async function loadDemucsSession(onProgress) {
  if (demucsSession) return demucsSession;
  if (!demucsSessionPromise) {
    demucsSessionPromise = (async () => {
      onProgress?.(4, 'load');
      const ort = await loadOrt();
      const providers = [];
      if (typeof navigator !== 'undefined' && 'gpu' in navigator) providers.push('webgpu');
      providers.push('wasm');
      demucsSession = await ort.InferenceSession.create(DEMUCS_MODEL_URL, {
        executionProviders: providers,
        graphOptimizationLevel: 'all'
      });
      return demucsSession;
    })();
  }
  return demucsSessionPromise;
}

async function resampleTo44100Stereo(audioBuffer) {
  const leftIn = audioBuffer.getChannelData(0);
  const rightIn = audioBuffer.numberOfChannels > 1
    ? audioBuffer.getChannelData(1)
    : audioBuffer.getChannelData(0);
  if (audioBuffer.sampleRate === DEMUCS_SAMPLE_RATE
    && audioBuffer.numberOfChannels >= 2
    && leftIn.length === audioBuffer.length) {
    return [leftIn, rightIn];
  }
  const length = Math.max(1, Math.ceil(audioBuffer.duration * DEMUCS_SAMPLE_RATE));
  const offline = new OfflineAudioContext(2, length, DEMUCS_SAMPLE_RATE);
  const buffer = offline.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    buffer.copyToChannel(audioBuffer.getChannelData(channel), channel);
  }
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();
  const left = rendered.getChannelData(0);
  const right = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : rendered.getChannelData(0);
  return [left, right];
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
    const stems = result.stems.data;
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

export async function separateCreateStems(audioBuffer, { onProgress } = {}) {
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
  onProgress?.(98, 'encode');
  return {
    sampleRate: DEMUCS_SAMPLE_RATE,
    vocalsBytes: encodeStereoWav(vocals[0], vocals[1], DEMUCS_SAMPLE_RATE),
    backingBytes: encodeStereoWav(backing[0], backing[1], DEMUCS_SAMPLE_RATE)
  };
}
