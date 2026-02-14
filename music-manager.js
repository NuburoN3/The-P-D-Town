export class MusicManager {
  constructor({ areaTracks = {}, volume = 0.6 } = {}) {
    this.areaTracks = new Map(Object.entries(areaTracks));
    this.audioBySrc = new Map();
    this.currentArea = null;
    this.currentAudio = null;
    this.volume = volume;
    this._unlockBound = false;
  }

  registerAreaTrack(areaName, src) {
    this.areaTracks.set(areaName, src);
  }

  playMusicForArea(areaName) {
    const src = this.areaTracks.get(areaName);
    if (!src) {
      this.stopCurrentMusic();
      this.currentArea = areaName ?? null;
      return;
    }

    const nextAudio = this._getOrCreateAudio(src);
    const sameArea = this.currentArea === areaName && this.currentAudio === nextAudio;
    if (sameArea && !nextAudio.paused) return;

    if (this.currentAudio && this.currentAudio !== nextAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }

    for (const audio of this.audioBySrc.values()) {
      if (audio !== nextAudio && !audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    }

    this.currentAudio = nextAudio;
    this.currentArea = areaName;

    const playPromise = nextAudio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  }

  stopCurrentMusic() {
    if (!this.currentAudio) return;
    this.currentAudio.pause();
    this.currentAudio.currentTime = 0;
    this.currentAudio = null;
    this.currentArea = null;
  }

  attachUnlockHandlers(target = window) {
    if (this._unlockBound) return;
    this._unlockBound = true;

    const unlock = () => {
      if (!this.currentAudio || !this.currentAudio.paused) return;
      const playPromise = this.currentAudio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    };

    target.addEventListener("pointerdown", unlock, { passive: true });
    target.addEventListener("keydown", unlock);
  }

  _getOrCreateAudio(src) {
    if (this.audioBySrc.has(src)) return this.audioBySrc.get(src);

    const audio = new Audio(src);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = this.volume;
    this.audioBySrc.set(src, audio);
    return audio;
  }
}
