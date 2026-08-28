import { state, els } from './state.js';
import { isLoggedIn, requireAuth } from './auth.js';
import { currentPack, currentScene, selectScene } from './pack.js';
import { scheduleSave } from './persist.js';
import { animateProgress, stopActivePlayback, stopProjectPreview, unlockAudio } from './playback.js';
import { isIOS, isPhone, measureBlobPeak, pickRecorderMime, rememberUrl, toast, voiceLevelFromPeak, wait } from './utils.js';

export async function startTakeFlow() {
  if (!isLoggedIn()) {
    requireAuth();
    return;
  }
  void unlockAudio();
  const scene = currentScene();
  if (!scene) {
    toast('Importe um pack para gravar.');
    return;
  }
  if (state.previewing) stopProjectPreview();
  if (state.countdownTimer || state.countdownStartTimer) {
    abortCapture();
    selectScene(state.activeIndex, { keepCapture: true });
    toast('Countdown cancelado.');
    return;
  }
  if (state.recorder?.state === 'recording') {
    try {
      state.recorder.requestData();
    } catch {
      // ignore
    }
    state.recorder.stop();
    return;
  }

  stopActivePlayback();
  if (els.sceneVideo) els.sceneVideo.pause();
  clearInterval(state.countdownTimer);
  clearTimeout(state.countdownStartTimer);
  clearInterval(state.recordingTimer);
  clearTimeout(state.recordStopTimer);
  state.countdownTimer = null;
  state.countdownStartTimer = null;
  state.recordingTimer = null;
  state.recordStopTimer = null;
  if (state.recorder?.state === 'recording') {
    state.ignoreRecorderStop = true;
    try { state.recorder.stop(); } catch { /* ignore */ }
  }
  state.recorder = null;
  stopStream();
  stopMeter();
  const gen = ++state.captureGen;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1
      }
    });
  } catch (error) {
    const denied = error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError';
    toast(denied
      ? 'Você bloqueou o microfone. Permita o mic neste site e toque de novo.'
      : 'Não achei um microfone neste aparelho.');
    return;
  }
  if (state.captureGen !== gen) {
    stream.getTracks().forEach((track) => track.stop());
    return;
  }

  state.liveStream = stream;
  startMeter(stream);
  stream.getAudioTracks().forEach((track) => {
    track.enabled = true;
  });
  els.countdownBadge.style.display = 'grid';
  els.recordingOverlay.style.display = 'grid';
  els.stageState.textContent = 'Prepare a fala...';
  els.stageState.className = 'stage-state recording';
  els.recordBtn.classList.add('recording');
  els.recordBtn.setAttribute('aria-label', 'Parar');
  els.micHint.textContent = 'Toque de novo para cancelar';
  if (els.recordingStatus) els.recordingStatus.textContent = 'Preparando';

  let count = 3;
  els.countdownBadge.textContent = String(count);
  els.timerValue.textContent = String(count);
  state.countdownTimer = setInterval(() => {
    count -= 1;
    els.countdownBadge.textContent = count === 0 ? 'DUBLE!' : String(count);
    els.timerValue.textContent = String(Math.max(0, count));
    if (count <= 0) {
      clearInterval(state.countdownTimer);
      state.countdownTimer = null;
      state.countdownStartTimer = setTimeout(() => {
        state.countdownStartTimer = null;
        if (state.captureGen !== gen) return;
        recordActiveScene();
      }, 220);
    }
  }, 1000);
}

export function recordActiveScene() {
  if (!state.liveStream) return;
  const scene = currentScene();
  const stream = state.liveStream;
  if (!scene || !stream) return;

  const mimeType = pickRecorderMime();
  state.chunks = [];
  state.recordPeak = 0;
  state.ignoreRecorderStop = false;
  try {
    state.recorder = mimeType
      ? new MediaRecorder(stream, isPhone() ? { mimeType } : { mimeType, audioBitsPerSecond: 128000 })
      : new MediaRecorder(stream);
  } catch {
  state.recorder = new MediaRecorder(stream);
  }
  const startedAt = Date.now();
  const recMs = Math.round(Math.max(1.6, Number(scene.duration) || 2) * 1000);

  state.recorder.ondataavailable = (event) => {
    if (event.data?.size) state.chunks.push(event.data);
  };
  state.recorder.onstop = async () => {
    await wait(180);
    const elapsed = (Date.now() - startedAt) / 1000;
    const livePeak = state.recordPeak;
    stopStream();
    stopMeter();
    const discarded = state.ignoreRecorderStop;
    state.ignoreRecorderStop = false;
    state.recorder = null;
    if (discarded) return;

    const pack = currentPack();
    if (!pack) return;
    const blob = new Blob(state.chunks, { type: state.chunks[0]?.type || mimeType || 'audio/webm' });
    if (blob.size < 400) {
      toast('Essa fala não gravou o áudio. Toque no microfone e fale de novo.');
      selectScene(state.activeIndex, { keepCapture: true });
      return;
    }
    let decodedPeak = 0;
    let decoded = false;
    try {
      decodedPeak = await measureBlobPeak(blob);
      decoded = true;
    } catch {
      decodedPeak = 0;
    }
    const profile = await profileTakeAudio(blob).catch(() => ({}));
    const voicePeak = Math.max(livePeak, decodedPeak, profile.peak || 0);
    if (pack.takes[scene.id]?.url) URL.revokeObjectURL(pack.takes[scene.id].url);
    const url = rememberUrl(URL.createObjectURL(blob), blob);
    pack.takes[scene.id] = {
      url,
      blob,
      character: scene.character,
      subtitle: scene.subtitle,
      createdAt: new Date().toISOString(),
      duration: elapsed,
      ext: /mp4|m4a|aac/i.test(blob.type) ? 'm4a' : 'webm',
      peak: voicePeak,
      onset: profile.onset,
      release: profile.release,
      voiced: profile.voiced
    };
    selectScene(state.activeIndex, { keepCapture: true });
    scheduleSave();
    if (voicePeak < 0.14) {
      toast('Volume baixo. Fale mais perto do microfone e grave de novo.');
    } else if (voicePeak > 0.78) {
      toast('Um pouco alto. Afaste um pouco o microfone.');
    } else {
      toast('Take gravado. Volume bom para a dublagem.');
    }
    setVoiceMeter(voicePeak, false);
    const finished = pack.scenes.every((item) => pack.takes[item.id]);
    if (finished) {
      toast('Pack concluído. Toque em Finalizar dublagem.');
    }
  };

  els.countdownBadge.style.display = 'none';
  els.recordingOverlay.style.display = 'grid';
  els.stageState.textContent = 'Gravando take...';
  els.stageState.className = 'stage-state recording';
  els.recordBtn.classList.add('recording');
  els.recordBtn.setAttribute('aria-label', 'Parar');
  els.micHint.textContent = 'Fale agora · o filme fica parado nesta fala';
  if (els.recordingStatus) els.recordingStatus.textContent = 'Gravando';
  els.sceneVideo?.pause();
  animateProgress(recMs / 1000);

  state.recordingTimer = setInterval(() => {
    const remaining = Math.max(0, (recMs / 1000) - ((Date.now() - startedAt) / 1000));
    els.timerValue.textContent = remaining.toFixed(1);
  }, 100);

  try {
    if (isIOS()) {
      state.recorder.start(100);
    } else {
      state.recorder.start(250);
    }
  } catch {
    try {
  state.recorder.start();
    } catch {
      state.recorder.start(250);
    }
  }
  state.recordStopTimer = setTimeout(() => {
    if (state.recorder?.state === 'recording') {
      try {
        state.recorder.requestData();
      } catch {
        // Alguns browsers só entregam o áudio no stop.
      }
      state.recorder.stop();
    }
  }, recMs);
}

export function abortCapture({ keepPreview = false } = {}) {
  state.captureGen += 1;
  clearInterval(state.countdownTimer);
  clearTimeout(state.countdownStartTimer);
  clearInterval(state.recordingTimer);
  clearTimeout(state.recordStopTimer);
  clearInterval(state.progressTimer);
  clearTimeout(state.playbackTimer);
  clearTimeout(state.videoTimer);
  state.countdownTimer = null;
  state.countdownStartTimer = null;
  state.recordingTimer = null;
  state.recordStopTimer = null;
  state.progressTimer = null;
  state.playbackTimer = null;
  state.videoTimer = null;
  els.countdownBadge && (els.countdownBadge.style.display = 'none');
  if (els.recordingOverlay) els.recordingOverlay.style.display = 'none';
  els.recordBtn?.classList.remove('recording');
  els.recordBtn?.setAttribute('aria-label', 'Gravar');
  stopActivePlayback();
  if (els.sceneVideo) els.sceneVideo.pause();
  if (state.recorder?.state === 'recording') {
    state.ignoreRecorderStop = true;
    try {
      state.recorder.stop();
    } catch {
      state.recorder = null;
      stopStream();
      stopMeter();
    }
  } else {
    state.recorder = null;
    stopStream();
    stopMeter();
  }
  if (!keepPreview) {
    state.previewing = false;
    if (els.previewBtnAlt) els.previewBtnAlt.textContent = '▶ Assistir resultado';
    els.stopPreviewBtn?.classList.add('is-hidden');
  }
}

export function stopStream() {
  state.liveStream?.getTracks().forEach((track) => track.stop());
  if (state.meterStream && state.meterStream !== state.liveStream) {
    state.meterStream.getTracks().forEach((track) => track.stop());
  }
  state.liveStream = null;
  state.meterStream = null;
}

export function setVoiceMeter(peak, live) {
  const level = voiceLevelFromPeak(peak);
  if (els.voiceMeter) {
    els.voiceMeter.hidden = false;
    els.voiceMeter.classList.remove('is-low', 'is-good', 'is-high');
    els.voiceMeter.classList.add(`is-${level.id}`);
  }
  if (els.voiceMeterFill) {
    els.voiceMeterFill.style.width = `${Math.max(8, Math.min(100, Math.round((Number(peak) || 0) * 135)))}%`;
  }
  if (els.voiceMeterHint) {
    els.voiceMeterHint.textContent = live && level.id === 'good' ? 'Pode falar neste volume' : level.hint;
  }
}

export function startMeter(stream) {
  stopMeter();
  if (!stream) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  state.audioContext = new AudioCtx();
  state.audioContext.resume?.();
  const source = state.audioContext.createMediaStreamSource(stream);
  state.analyser = state.audioContext.createAnalyser();
  state.analyser.fftSize = 256;
  source.connect(state.analyser);
  const data = new Uint8Array(state.analyser.frequencyBinCount);
  const wave = new Uint8Array(state.analyser.fftSize);
  const tick = () => {
    if (!state.analyser) return;
    state.analyser.getByteFrequencyData(data);
    state.analyser.getByteTimeDomainData(wave);
    let peak = 0;
    for (let i = 0; i < wave.length; i += 1) {
      peak = Math.max(peak, Math.abs(wave[i] - 128) / 128);
    }
    if (state.recorder?.state === 'recording' || state.countdownTimer) {
      state.recordPeak = Math.max(state.recordPeak, peak);
      setVoiceMeter(Math.max(state.recordPeak, peak), true);
    }
    els.micBars?.forEach((bar, index) => {
      const value = data[Math.min(index, data.length - 1)] / 255;
      bar.style.height = `${Math.max(4, value * 22)}px`;
      bar.style.opacity = String(0.35 + value * 0.65);
    });
    els.waveformBars?.forEach((bar, index) => {
      const value = data[Math.min(index, data.length - 1)] / 255;
      bar.style.height = `${Math.max(10, 18 + value * 70)}px`;
    });
    state.meterRaf = requestAnimationFrame(tick);
  };
  tick();
}

export async function profileTakeAudio(blob) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return { peak: 0, onset: 0, release: 0, voiced: 0 };
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const samples = decoded.getChannelData(0);
    const rate = decoded.sampleRate;
    const windowSize = Math.max(64, Math.floor(rate * 0.02));
    let peak = 0;
    let onset = decoded.duration;
    let release = 0;
    const threshold = 0.035;
    for (let i = 0; i < samples.length; i += windowSize) {
      let sum = 0;
      const end = Math.min(samples.length, i + windowSize);
      for (let j = i; j < end; j += 1) {
        const value = Math.abs(samples[j]);
        peak = Math.max(peak, value);
        sum += samples[j] * samples[j];
      }
      const rms = Math.sqrt(sum / Math.max(1, end - i));
      if (rms >= threshold) {
        const time = i / rate;
        onset = Math.min(onset, time);
        release = Math.max(release, time + (windowSize / rate));
      }
    }
    if (peak < threshold) {
      return { peak, onset: 0, release: 0, voiced: 0 };
    }
    const voiced = Math.max(0, release - onset);
    return { peak, onset, release, voiced };
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

export function stopMeter() {
  cancelAnimationFrame(state.meterRaf);
  state.meterRaf = 0;
  state.analyser = null;
  state.recordStream = null;
  state.audioContext?.close().catch(() => undefined);
  state.audioContext = null;
}
