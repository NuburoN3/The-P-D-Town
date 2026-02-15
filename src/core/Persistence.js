const SETTINGS_STORAGE_KEY = "pdtown:userSettings:v1";
const SAVE_STORAGE_KEY = "pdtown:save:v1";

export const DEFAULT_USER_SETTINGS = Object.freeze({
  highContrastMenu: false,
  screenShake: true,
  reducedFlashes: false,
  textSpeedMultiplier: 1,
  keybindings: null
});

function hasLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson(storageKey) {
  if (!hasLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`[Persistence] Failed to read '${storageKey}':`, error);
    return null;
  }
}

function writeJson(storageKey, value) {
  if (!hasLocalStorage()) return false;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`[Persistence] Failed to write '${storageKey}':`, error);
    return false;
  }
}

function clampTextSpeed(value) {
  if (!Number.isFinite(value)) return DEFAULT_USER_SETTINGS.textSpeedMultiplier;
  return Math.max(0.5, Math.min(2, value));
}

export function sanitizeUserSettings(settings) {
  const source = settings && typeof settings === "object" ? settings : {};
  return {
    highContrastMenu: Boolean(source.highContrastMenu),
    screenShake: source.screenShake !== false,
    reducedFlashes: Boolean(source.reducedFlashes),
    textSpeedMultiplier: clampTextSpeed(source.textSpeedMultiplier),
    keybindings: source.keybindings && typeof source.keybindings === "object"
      ? { ...source.keybindings }
      : null
  };
}

export function loadUserSettings() {
  const loaded = readJson(SETTINGS_STORAGE_KEY);
  return sanitizeUserSettings(loaded || DEFAULT_USER_SETTINGS);
}

export function saveUserSettings(settings) {
  return writeJson(SETTINGS_STORAGE_KEY, sanitizeUserSettings(settings));
}

export function loadGameSnapshot() {
  const data = readJson(SAVE_STORAGE_KEY);
  if (!data || typeof data !== "object") return null;
  return data;
}

export function saveGameSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  return writeJson(SAVE_STORAGE_KEY, {
    ...snapshot,
    savedAtIso: new Date().toISOString()
  });
}
