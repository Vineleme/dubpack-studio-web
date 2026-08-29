import { t } from './i18n-bridge.js';
import { state, els } from './state.js';
import { firebaseAuth } from './auth.js';
import { accountFromFirebase, changeLang, clearAuthError, finishLogin, handleAvatarUpload, isLoggedIn, logoutUser, refreshAccountUi, requireAuth, setAuthMode, showAuthGate, showPasswordReset, submitAuth, suggestSignupName, togglePasswordVisibility } from './auth.js';
import { renderActivity, renderCreditShop, updateCreditUi } from './credits.js';
import { downloadFinalMp4, requestFinalMp4 } from './export.js';
import { currentPack, goNextScene, importPack, selectScene, showFinalVideo } from './pack.js';
import { downloadTake, playCurrentTake, playProjectPreview, playReference, stopProjectPreview, unlockAudio } from './playback.js';
import { abortCapture, startTakeFlow } from './recorder.js';
import { formatClock, takePlaceholder, toast } from './utils.js';

export function getStudioTips() {
  return [1, 2, 3, 4].map((index) => ({
    title: t(`tip.${index}.title`),
    body: t(`tip.${index}.body`)
  }));
}

export function bindUi() {
  els.authForm?.addEventListener('submit', submitAuth);
  els.authSubmitBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    submitAuth(event);
  });
  els.authSwitchBtn?.addEventListener('click', () => {
    if (state.authMode === 'reset') {
      clearAuthError();
      setAuthMode('login');
      return;
    }
    clearAuthError();
    setAuthMode(state.authMode === 'signup' ? 'login' : 'signup');
  });
  els.authForgotBtn?.addEventListener('click', showPasswordReset);
  els.authEmail?.addEventListener('input', () => {
    clearAuthError();
    suggestSignupName();
  });
  els.authPassword?.addEventListener('input', clearAuthError);
  els.authPasswordToggle?.addEventListener('click', togglePasswordVisibility);
  els.authGate?.addEventListener('click', (event) => {
    if (event.target === els.authGate) showAuthGate(false);
  });
  els.packInput?.addEventListener('change', importPack);
  els.packInputEmpty?.addEventListener('change', importPack);
  document.querySelectorAll('label.text-link, .pack-empty label.primary').forEach((label) => {
    label.addEventListener('click', (event) => {
      if (isLoggedIn()) return;
      event.preventDefault();
      event.stopPropagation();
      requireAuth();
    });
  });
  els.userChip?.addEventListener('click', () => {
    if (!isLoggedIn()) {
      requireAuth();
      return;
    }
    applyTab('profile');
  });
  els.profileNavBtn?.addEventListener('click', () => setTab('profile'));
  els.prevBtn?.addEventListener('click', () => setTab('packs'));
  els.prevSceneBtn?.addEventListener('click', () => selectScene(state.activeIndex - 1));
  els.nextSceneBtn?.addEventListener('click', goNextScene);
  els.nextBtn?.addEventListener('click', goNextScene);
  els.referenceBtn?.addEventListener('click', playReference);
  els.referenceBtnBottom?.addEventListener('click', playReference);
  els.recordBtn?.addEventListener('click', startTakeFlow);
  els.downloadTakeBtn?.addEventListener('click', downloadTake);
  els.previewBtn?.addEventListener('click', playCurrentTake);
  els.listenTakeBtn?.addEventListener('click', playCurrentTake);
  els.previewBtnAlt?.addEventListener('click', playProjectPreview);
  els.stopPreviewBtn?.addEventListener('click', stopProjectPreview);
  els.exportVideoBtn?.addEventListener('click', requestFinalMp4);
  els.exportVideoBtnSide?.addEventListener('click', requestFinalMp4);
  els.generateMp4Btn?.addEventListener('click', requestFinalMp4);
  els.downloadMp4Btn?.addEventListener('click', () => void downloadFinalMp4());
  document.querySelectorAll('[data-lang]').forEach((button) => {
    button.addEventListener('click', () => changeLang(button.dataset.lang));
  });
  els.helpBtn?.addEventListener('click', () => els.helpModal?.classList.remove('is-hidden'));
  els.helpCloseBtn?.addEventListener('click', () => els.helpModal?.classList.add('is-hidden'));
  els.helpModal?.addEventListener('click', (event) => {
    if (event.target === els.helpModal) els.helpModal.classList.add('is-hidden');
  });
  els.proBtn?.addEventListener('click', () => setTab('credits'));
  els.bellBtn?.addEventListener('click', () => setTab('credits'));
  els.logoutBtn?.addEventListener('click', logoutUser);
  els.userLogoutBtn?.addEventListener('click', logoutUser);
  els.profileLoginBtn?.addEventListener('click', () => requireAuth());
  els.profileAvatarInput?.addEventListener('change', handleAvatarUpload);
  els.packRailNext?.addEventListener('click', () => {
    els.packGrid?.scrollBy({ left: 240, behavior: 'smooth' });
  });
  const unlockAudioOnce = () => {
    unlockAudio().catch(() => undefined);
  };
  document.addEventListener('touchstart', unlockAudioOnce, { once: true, passive: true });
  document.addEventListener('click', unlockAudioOnce, { once: true });
  startStudioTips();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !state.exporting) abortCapture();
  });
  window.addEventListener('pagehide', () => {
    if (!state.exporting) abortCapture();
  });

  document.addEventListener('click', (event) => {
    const tabBtn = event.target.closest('[data-tab]');
    if (!tabBtn) return;
    if (tabBtn.id === 'userChip' || tabBtn.id === 'profileNavBtn') return;
    if (tabBtn.tagName === 'A') event.preventDefault();
    const tab = tabBtn.dataset.tab;
    if (tab) setTab(tab);
  });
}

export function setTab(tab) {
  if (!state.user && firebaseAuth?.currentUser) {
    void finishLogin(accountFromFirebase(firebaseAuth.currentUser), { toast: false }).then(() => applyTab(tab));
    return;
  }
  applyTab(tab);
}

export function applyTab(tab) {
  if ((tab === 'record' || tab === 'dub') && !currentPack()) {
    toast('Importe um pack para gravar.');
    tab = 'packs';
  }
  document.querySelectorAll('.tab-view').forEach((view) => view.classList.remove('active'));
  document.querySelector(`#${tab}Tab`)?.classList.add('active');
  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
  document.querySelector('.dashboard')?.classList.toggle('final-mode', tab === 'dub');
  if (tab !== 'record') abortCapture();
  if (tab === 'record' && !state.previewing) selectScene(state.activeIndex);
  if (tab === 'dub') {
    showFinalVideo(currentPack());
  }
  if (tab === 'credits' || tab === 'profile') {
    updateCreditUi();
    renderCreditShop();
    refreshAccountUi();
  }
  if (tab === 'packs') renderActivity();
  if (tab === 'profile' || tab === 'credits') {
    document.querySelector('.content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

export function startStudioTips() {
  if (!els.tipDots || !els.tipTitle) return;
  const tips = getStudioTips();
  els.tipDots.replaceChildren();
  tips.forEach((tip, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', tip.title);
    dot.addEventListener('click', () => showStudioTip(index, true));
    els.tipDots.append(dot);
  });
  showStudioTip(0);
  clearInterval(state.tipTimer);
  state.tipTimer = setInterval(() => {
    showStudioTip((state.tipIndex + 1) % tips.length);
  }, 6500);
}

export function refreshStudioTips() {
  if (!els.tipDots || !els.tipTitle) return;
  const tips = getStudioTips();
  els.tipDots.querySelectorAll('button').forEach((dot, index) => {
    dot.setAttribute('aria-label', tips[index]?.title || '');
  });
  showStudioTip(state.tipIndex ?? 0);
}

export function showStudioTip(index, pause) {
  const tips = getStudioTips();
  state.tipIndex = index;
  const tip = tips[index];
  if (!tip) return;
  if (els.tipTitle) {
    els.tipTitle.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = tip.title;
    els.tipTitle.append(strong);
  }
  if (els.tipBody) els.tipBody.textContent = tip.body;
  els.tipDots?.querySelectorAll('button').forEach((dot, i) => {
    dot.classList.toggle('is-on', i === index);
  });
  if (pause) {
    clearInterval(state.tipTimer);
    state.tipTimer = setInterval(() => {
      showStudioTip((state.tipIndex + 1) % tips.length);
    }, 6500);
  }
}

export function renderTakeRail() {
  if (!els.takeRail) return;
  const pack = currentPack();
  els.takeRail.replaceChildren();
  if (!pack) return;
  pack.scenes.forEach((scene, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rail-dot';
    button.classList.toggle('is-active', index === state.activeIndex);
    button.classList.toggle('is-recorded', Boolean(pack.takes[scene.id]));
    button.title = scene.subtitle;
    button.textContent = String(index + 1);
    button.addEventListener('click', () => selectScene(index));
    els.takeRail.append(button);
  });
}

export function renderLocalTakes() {
  if (!els.localTakes) return;
  const pack = currentPack();
  els.localTakes.replaceChildren();
  if (!pack) {
    els.localTakes.append(takePlaceholder('Importe um pack para ver os takes.'));
    return;
  }
  const takes = Object.entries(pack.takes);
  if (!takes.length) {
    els.localTakes.append(takePlaceholder('Nenhum take gravado ainda.'));
    return;
  }
  takes.forEach(([id, take]) => {
    const sceneIndex = pack.scenes.findIndex((scene) => scene.id === id);
    const card = document.createElement('div');
    card.className = 'take-card';
    const title = document.createElement('strong');
    title.textContent = `Fala ${sceneIndex + 1} · ${take.character}`;
    const line = document.createElement('p');
    line.textContent = take.subtitle;
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = take.url;
    card.append(title, line, audio);
    els.localTakes.append(card);
  });
}

export function updateScoreCard() {
  const pack = currentPack();
  if (!pack?.scenes.length) {
    els.scoreAverage.textContent = '—';
    els.scoreCaption.textContent = 'SEM PACK';
    els.scoreCoverage.textContent = '—';
    els.scoreDuration.textContent = '—';
    els.scoreOnTime.textContent = '—';
    els.scorePack.textContent = '—';
    return;
  }
  const recorded = pack.scenes.filter((scene) => pack.takes[scene.id]);
  const coverage = Math.round((recorded.length / pack.scenes.length) * 100);
  const durationScores = recorded.map((scene) => {
    const take = pack.takes[scene.id];
    const delta = Math.abs((take.duration || scene.duration) - scene.duration);
    return Math.max(0, 100 - (delta / Math.max(scene.duration, 0.8)) * 100);
  });
  const durationAvg = durationScores.length
    ? Math.round(durationScores.reduce((sum, value) => sum + value, 0) / durationScores.length)
    : 0;
  const onTime = durationScores.length
    ? Math.round((durationScores.filter((value) => value >= 80).length / durationScores.length) * 100)
    : 0;
  const overall = recorded.length ? Math.round((coverage * 0.45) + (durationAvg * 0.55)) : 0;
  els.scoreAverage.textContent = recorded.length ? String(overall) : '—';
  els.scoreCaption.textContent = recorded.length ? 'MÉDIA GERAL' : 'SEM TAKES';
  els.scoreCoverage.textContent = `${coverage}%`;
  els.scoreDuration.textContent = recorded.length ? `${durationAvg}%` : '—';
  els.scoreOnTime.textContent = recorded.length ? `${onTime}%` : '—';
  els.scorePack.textContent = pack.name;
}

export function timingMessage(scene, take) {
  const onset = Number(take.onset);
  const voiced = Number(take.voiced);
  if (Number.isFinite(onset) && onset > 0.4) {
    return `Você entrou ${onset.toFixed(1)}s depois do início do take.`;
  }
  if (Number.isFinite(voiced) && voiced > 0.3) {
    const delta = voiced - scene.duration;
    if (delta < -0.35) return `Sua fala durou ${Math.abs(delta).toFixed(1)}s a menos que a referência.`;
    if (delta > 0.35) return `Sua fala durou ${delta.toFixed(1)}s a mais que a referência.`;
    return 'Duração alinhada com a referência.';
  }
  const delta = (take.duration || 0) - scene.duration;
  if (Math.abs(delta) <= 0.25) return 'Duração alinhada com a referência.';
  if (delta < 0) return `Take ${Math.abs(delta).toFixed(1)}s mais curto que a referência.`;
  return `Take ${delta.toFixed(1)}s mais longo que a referência.`;
}

export function updateTimingDesk(scene, take) {
  if (!els.timingTakeBar && !els.waveEndLabel) return;
  if (els.waveStartLabel) els.waveStartLabel.textContent = '0:00';
  if (els.waveEndLabel) els.waveEndLabel.textContent = formatClock(scene.duration);
  if (els.timingRefBar) els.timingRefBar.style.width = '100%';
  if (els.timingTakeBar) {
    if (!take) {
      els.timingTakeBar.style.width = '0%';
      els.timingTakeBar.className = '';
    } else {
      const length = Number(take.voiced) > 0.2 ? take.voiced : take.duration;
      const ratio = Math.min(1.45, length / Math.max(scene.duration, 0.01));
      els.timingTakeBar.style.width = `${Math.max(8, ratio * 100)}%`;
      els.timingTakeBar.style.marginLeft = Number.isFinite(take.onset)
        ? `${Math.min(70, (take.onset / Math.max(scene.duration, 0.01)) * 100)}%`
        : '0';
      const status = timingStatus(scene, take);
      els.timingTakeBar.className = status;
    }
  }
  els.timingLabels?.forEach((label) => label.classList.remove('is-active'));
  if (take) {
    const status = timingStatus(scene, take);
    const index = status === 'early' ? 0 : status === 'late' ? 2 : 1;
    els.timingLabels[index]?.classList.add('is-active');
  }
}

export function timingStatus(scene, take) {
  const onset = Number(take.onset);
  const voiced = Number(take.voiced);
  if (Number.isFinite(onset) && onset > 0.4) return 'late';
  if (Number.isFinite(voiced) && voiced > 0.2) {
    const delta = voiced - scene.duration;
    if (delta < -0.35) return 'early';
    if (delta > 0.35) return 'late';
    return 'ok';
  }
  const delta = (take.duration || 0) - scene.duration;
  if (delta < -0.25) return 'early';
  if (delta > 0.25) return 'late';
  return 'ok';
}
