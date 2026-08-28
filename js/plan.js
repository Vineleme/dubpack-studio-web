import { t } from './i18n-bridge.js';
import {
  EXPORT_CREDIT_ADVANCED,
  EXPORT_CREDIT_STANDARD,
  FREE_DAILY_EXPORT_LIMIT,
  FREE_MAX_FILM_SECONDS,
  FREE_MAX_PACKS,
  FREE_MAX_SCENES,
  FREE_MAX_ZIP_BYTES,
  OWNER_EMAILS,
  PRO_DAILY_EXPORT_LIMIT,
  PRO_MAX_FILM_SECONDS,
  PRO_MAX_PACKS,
  PRO_MAX_SCENES,
  PRO_MAX_ZIP_BYTES
} from './constants.js';
import { state } from './state.js';
import { isIOS, normalizeEmail } from './utils.js';
import { urlLooksLikeOgg } from './ogv.js';

function readProState(email = state.user?.email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  try {
    const raw = localStorage.getItem(`dubpack-pro:${normalized}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isOwner(user = state.user) {
  return OWNER_EMAILS.includes(normalizeEmail(user?.email));
}

function isPro(user = state.user) {
  if (isOwner(user)) return true;
  const pro = readProState(user?.email);
  if (!pro?.active) return false;
  return Date.now() < Number(pro.periodEnd || 0);
}

function getCreditsBalance() {
  if (isOwner()) return Number.POSITIVE_INFINITY;
  const key = state.user?.email
    ? `dubpack-credits:${normalizeEmail(state.user.email)}`
    : 'dubpack-credits';
  const stored = localStorage.getItem(key);
  const value = stored === null ? 1 : Number(stored);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

function storageKey(prefix, email = state.user?.email) {
  const normalized = normalizeEmail(email);
  return normalized ? `${prefix}:${normalized}:${dayKey()}` : '';
}

export function planLimits(user = state.user) {
  const pro = isPro(user) || isOwner(user);
  return {
    pro,
    maxZipBytes: pro ? PRO_MAX_ZIP_BYTES : FREE_MAX_ZIP_BYTES,
    maxScenes: pro ? PRO_MAX_SCENES : FREE_MAX_SCENES,
    maxFilmSeconds: pro ? PRO_MAX_FILM_SECONDS : FREE_MAX_FILM_SECONDS,
    maxPacks: pro ? PRO_MAX_PACKS : FREE_MAX_PACKS,
    dailyExports: pro ? PRO_DAILY_EXPORT_LIMIT : FREE_DAILY_EXPORT_LIMIT
  };
}

export function estimatePackFilmSeconds(scenes = []) {
  if (!scenes.length) return 0;
  return scenes.reduce((max, scene) => Math.max(max, Number(scene.videoOffset || 0) + Number(scene.duration || 0)), 0);
}

export function validatePackImport(pack, zipBytes, { replacing = false } = {}) {
  const limits = planLimits();
  const size = zipBytes?.length || pack?.zipBytes?.length || 0;
  const scenes = pack?.scenes?.length || 0;
  const filmSeconds = estimatePackFilmSeconds(pack?.scenes || []);
  const openPacks = state.packs.filter((item) => item.id !== pack?.id).length;

  if (size > limits.maxZipBytes) {
    return limits.pro ? t('limits.zip.pro') : t('limits.zip.free');
  }
  if (scenes > limits.maxScenes) {
    return limits.pro ? t('limits.scenes.pro') : t('limits.scenes.free');
  }
  if (filmSeconds > limits.maxFilmSeconds + 0.5) {
    return limits.pro ? t('limits.film.pro') : t('limits.film.free');
  }
  if (!replacing && openPacks >= limits.maxPacks) {
    return limits.pro ? t('limits.packs.pro') : t('limits.packs.free');
  }
  return '';
}

export function getDailyExportCount(email = state.user?.email) {
  const key = storageKey('dubpack-exports', email);
  if (!key) return 0;
  return Math.max(0, Number(localStorage.getItem(key)) || 0);
}

export function recordDailyExport(email = state.user?.email) {
  const key = storageKey('dubpack-exports', email);
  if (!key) return;
  localStorage.setItem(key, String(getDailyExportCount(email) + 1));
}

export function adExportUsedToday(email = state.user?.email) {
  const key = storageKey('dubpack-ad-export', email);
  return Boolean(key && localStorage.getItem(key));
}

export function markAdExportUsed(email = state.user?.email) {
  const key = storageKey('dubpack-ad-export', email);
  if (key) localStorage.setItem(key, '1');
}

export function canUseAdExport(email = state.user?.email) {
  if (isOwner(email) || isPro(email)) return false;
  return !adExportUsedToday(email);
}

export async function needsAdvancedExport(pack) {
  if (!pack) return false;
  if (isIOS()) return true;
  if (pack.filmUrl && await urlLooksLikeOgg(pack.filmUrl)) return true;
  for (const scene of pack.scenes || []) {
    if (scene.videoUrl && await urlLooksLikeOgg(scene.videoUrl)) return true;
  }
  return false;
}

export async function getExportCreditCost(pack) {
  if (isOwner()) return 0;
  return (await needsAdvancedExport(pack)) ? EXPORT_CREDIT_ADVANCED : EXPORT_CREDIT_STANDARD;
}

export function exportAllowance(cost, { viaAd = false } = {}) {
  if (isOwner()) return { ok: true, reason: '' };

  const limits = planLimits();
  const daily = getDailyExportCount();
  if (daily >= limits.dailyExports) {
    return { ok: false, reason: 'daily', message: t('limits.daily') };
  }

  if (viaAd) {
    if (!canUseAdExport()) return { ok: false, reason: 'ad', message: t('export.needCredits') };
    if (cost > EXPORT_CREDIT_STANDARD) {
      return { ok: false, reason: 'pro', message: t('export.needPro') };
    }
    return { ok: true, reason: '' };
  }

  if (cost > EXPORT_CREDIT_STANDARD && !isPro()) {
    return { ok: false, reason: 'pro', message: t('export.needPro') };
  }

  if (cost > 0 && getCreditsBalance() < cost) {
    if (canUseAdExport()) {
      return { ok: false, reason: 'ad-offer', message: t('export.needCredits') };
    }
    return { ok: false, reason: 'credits', message: t('export.needCredits') };
  }

  return { ok: true, reason: '' };
}
