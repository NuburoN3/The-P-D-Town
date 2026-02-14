export class AudioManager {
  constructor({ areaTracks = {}, sfxTracks = {}, bgmVolume = 0.6, sfxVolume = 0.8 } = {}) {
    this.areaTracks = new Map(Object.entries(areaTracks));
    this.sfxTracks = new Map(Object.entries(sfxTracks));
    this.bgmAudioBySrc = new Map();
    this.sfxPrototypeBySrc = new Map();
    this.currentArea = null;
    this.currentAudio = null;
    this.bgmVolume = bgmVolume;
    this.sfxVolume = sfxVolume;
    this._unlockBound = false;
  }

  registerAreaTrack(areaName, src) {
    this.areaTracks.set(areaName, src);
  }

  registerSfxTrack(sfxName, src) {
    this.sfxTracks.set(sfxName, src);
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

    for (const audio of this.bgmAudioBySrc.values()) {
      if (audio !== nextAudio && !audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    }

    this.currentAudio = nextAudio;
    this.currentArea = areaName;

    const playPromise = nextAudio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((err) => {
        console.warn("AudioManager: failed to play BGM for", areaName, "src=", src, err);
      });
    }
  }

  playSfx(sfxNameOrSrc) {
    const src = this.sfxTracks.get(sfxNameOrSrc) || sfxNameOrSrc;
    if (!src) {
      console.warn("AudioManager: playSfx called with unknown src/name:", sfxNameOrSrc);
      return;
    }

    const prototype = this._getOrCreateSfxPrototype(src);
    const shot = prototype.cloneNode(true);
    shot.volume = this.sfxVolume;
    shot.currentTime = 0;

    const playPromise = shot.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((err) => {
        console.warn("AudioManager: failed to play SFX", src, err);
      });
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
    if (this.bgmAudioBySrc.has(src)) return this.bgmAudioBySrc.get(src);

    const audio = new Audio(src);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = this.bgmVolume;
    audio.addEventListener('error', (e) => {
      console.warn('AudioManager: BGM load error for', src, e);
    });
    this.bgmAudioBySrc.set(src, audio);
    return audio;
  }

  _getOrCreateSfxPrototype(src) {
    if (this.sfxPrototypeBySrc.has(src)) return this.sfxPrototypeBySrc.get(src);

    const audio = new Audio(src);
    audio.loop = false;
    audio.preload = "auto";
    audio.volume = this.sfxVolume;
    audio.addEventListener('error', (e) => {
      console.warn('AudioManager: SFX load error for', src, e);
    });
    this.sfxPrototypeBySrc.set(src, audio);
    return audio;
  }
}

export { AudioManager as MusicManager };
