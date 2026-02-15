export class AudioManager {
  constructor({ areaTracks = {}, sfxTracks = {}, bgmVolume = 0.6, sfxVolume = 0.8, fadeDurationMs = 600 } = {}) {
    this.areaTracks = new Map(Object.entries(areaTracks));
    this.sfxTracks = new Map(Object.entries(sfxTracks));
    this.bgmAudioBySrc = new Map();
    this.sfxPrototypeBySrc = new Map();
    this.currentArea = null;
    this.currentAudio = null;
    this.bgmVolume = bgmVolume;
    this.sfxVolume = sfxVolume;
    this.bgmFadeMs = fadeDurationMs;
    this.fadeTimers = new Map();
    this._unlockBound = false;
    this._bgmDuckRestoreTimer = null;
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
      // No music defined for this area -> continue current music
      this.currentArea = areaName ?? null;
      return;
    }

    const nextAudio = this._getOrCreateAudio(src);
    const sameArea = this.currentArea === areaName && this.currentAudio === nextAudio;
    if (sameArea && !nextAudio.paused) return;

    const fadeMs = this.bgmFadeMs;

    // If there's a different current audio, fade it out while fading in the next
    if (this.currentAudio && this.currentAudio !== nextAudio) {
      const prev = this.currentAudio;

      // Prepare next audio at zero volume and start playing
      try { nextAudio.volume = 0; } catch (e) {}
      const playPromise = nextAudio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }

      // Fade out previous and fade in next concurrently
      Promise.all([
        this._fadeAudio(prev, 0, fadeMs).then(() => {
          try { prev.pause(); prev.currentTime = 0; } catch (e) {}
        }),
        this._fadeAudio(nextAudio, this.bgmVolume, fadeMs)
      ]).catch(() => {});

      this.currentAudio = nextAudio;
      this.currentArea = areaName;
      return;
    }

    // If there's no current audio, just start the next audio with a fade-in
    if (!this.currentAudio) {
      try { nextAudio.volume = 0; } catch (e) {}
      const playPromise = nextAudio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
      this.currentAudio = nextAudio;
      this.currentArea = areaName;
      this._fadeAudio(nextAudio, this.bgmVolume, fadeMs).catch(() => {});
      return;
    }

    // If same audio but paused, try to resume with fade-in
    if (sameArea && nextAudio.paused) {
      try { nextAudio.volume = 0; } catch (e) {}
      const playPromise = nextAudio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
      this._fadeAudio(nextAudio, this.bgmVolume, fadeMs).catch(() => {});
      this.currentAudio = nextAudio;
      this.currentArea = areaName;
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

    if (sfxNameOrSrc === "itemUnlock") {
      this._duckCurrentMusic();
    }
  }

  stopCurrentMusic() {
    if (!this.currentAudio) return;
    const audio = this.currentAudio;
    const fadeMs = this.bgmFadeMs;
    this._fadeAudio(audio, 0, fadeMs).then(() => {
      try { audio.pause(); audio.currentTime = 0; } catch (e) {}
    }).catch(() => {
      try { audio.pause(); audio.currentTime = 0; } catch (e) {}
    });
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

  _fadeAudio(audio, toVolume, duration) {
    if (!audio || typeof audio.volume !== 'number') return Promise.resolve();

    // Cancel any existing fade on this audio
    const prev = this.fadeTimers.get(audio);
    if (prev && prev.rafId) cancelAnimationFrame(prev.rafId);

    const startVol = audio.volume;
    const startTime = performance.now();
    const self = this;

    return new Promise((resolve) => {
      function step(now) {
        const t = Math.min(1, (now - startTime) / Math.max(1, duration));
        try {
          audio.volume = startVol + (toVolume - startVol) * t;
        } catch (e) {}

        if (t < 1) {
          const rafId = requestAnimationFrame(step);
          self.fadeTimers.set(audio, { rafId });
        } else {
          try { audio.volume = toVolume; } catch (e) {}
          self.fadeTimers.delete(audio);
          resolve();
        }
      }

      const rafId = requestAnimationFrame(step);
      self.fadeTimers.set(audio, { rafId });
    });
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

  _duckCurrentMusic() {
    if (!this.currentAudio) return;

    const audio = this.currentAudio;
    const duckTo = Math.max(0.08, this.bgmVolume * 0.35);
    const downMs = 120;
    const holdMs = 520;
    const upMs = 300;

    this._fadeAudio(audio, duckTo, downMs).catch(() => {});

    if (this._bgmDuckRestoreTimer) {
      clearTimeout(this._bgmDuckRestoreTimer);
      this._bgmDuckRestoreTimer = null;
    }

    this._bgmDuckRestoreTimer = setTimeout(() => {
      if (this.currentAudio === audio) {
        this._fadeAudio(audio, this.bgmVolume, upMs).catch(() => {});
      }
      this._bgmDuckRestoreTimer = null;
    }, holdMs);
  }
}

export { AudioManager as MusicManager };
