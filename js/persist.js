import { state } from './state.js';
import { isOwner } from './auth.js';
import { buildPack, currentPack, renderPackGrid, selectScene, sessionStoreKey } from './pack.js';
import { warmSceneAudio } from './playback.js';
import { updateScoreCard } from './ui.js';
import { rememberUrl } from './utils.js';

export function scheduleSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    persistSession().catch(() => undefined);
  }, 400);
}

export function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('dubpack-studio', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('session');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function persistSession() {
  if (!state.user?.email) return;
  const payload = {
    activePackId: state.activePackId,
    activeIndex: state.activeIndex,
    packs: await Promise.all(state.packs.map(async (pack) => ({
      id: pack.id,
      name: pack.name,
      importedAt: pack.importedAt || Date.now(),
      zipBytes: pack.zipBytes,
      finalBlob: pack.finalBlob || null,
      finalExt: pack.finalExt || '',
      watermarked: Boolean(pack.watermarked),
      takes: Object.fromEntries(await Promise.all(Object.entries(pack.takes).map(async ([id, take]) => {
        const blob = take.blob || await fetch(take.url).then((response) => response.blob());
        return [id, {
          blob,
          character: take.character,
          subtitle: take.subtitle,
          createdAt: take.createdAt,
          duration: take.duration,
          ext: take.ext,
          onset: take.onset,
          release: take.release,
          voiced: take.voiced,
          peak: take.peak
        }];
      })))
    })))
  };
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('session', 'readwrite');
    tx.objectStore('session').put(payload, sessionStoreKey());
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function restoreSession() {
  const db = await openDb();
  const store = db.transaction('session', 'readonly').objectStore('session');
  const payload = await new Promise((resolve, reject) => {
    const request = store.get(sessionStoreKey());
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const fallback = payload || !isOwner() ? null : await new Promise((resolve, reject) => {
    const request = db.transaction('session', 'readonly').objectStore('session').get('current');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  const savedSession = payload || fallback;
  if (!savedSession?.packs?.length) {
    renderPackGrid();
    updateScoreCard();
    return;
  }

  for (const saved of savedSession.packs) {
    try {
      const pack = await buildPack(saved.name, saved.zipBytes);
      pack.id = saved.id;
      pack.importedAt = saved.importedAt || Date.now();
      pack.takes = {};
      Object.entries(saved.takes || {}).forEach(([id, take]) => {
        const url = rememberUrl(URL.createObjectURL(take.blob));
        pack.takes[id] = { ...take, url };
      });
      if (saved.finalBlob) {
        const savedType = String(saved.finalBlob.type || '');
        const savedExt = String(saved.finalExt || '');
        if (savedType.includes('mp4') || savedExt.includes('mp4')) {
          pack.finalBlob = saved.finalBlob;
          pack.finalExt = 'mp4';
          pack.watermarked = Boolean(saved.watermarked);
          pack.finalUrl = rememberUrl(URL.createObjectURL(saved.finalBlob));
        } else if (savedType.includes('webm') || savedExt.includes('webm')) {
          pack.finalBlob = saved.finalBlob;
          pack.finalExt = 'webm';
          pack.watermarked = Boolean(saved.watermarked);
          pack.finalUrl = rememberUrl(URL.createObjectURL(saved.finalBlob));
        }
      }
      state.packs.push(pack);
    } catch {
      // Pack salvo inválido: ignora e segue.
    }
  }

  state.activePackId = savedSession.activePackId;
  state.activeIndex = savedSession.activeIndex || 0;
  if (!currentPack() && state.packs[0]) state.activePackId = state.packs[0].id;
  renderPackGrid();
  updateScoreCard();
  if (currentPack()) {
    selectScene(state.activeIndex);
    warmSceneAudio(currentPack().scenes);
  }
}
