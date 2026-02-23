export class AudioManager {
  constructor({
    areaTracks = {},
    areaTrackFallbacks = {},
    sfxTracks = {},
    bgmVolume = 0.6,
    sfxVolume = 0.8,
    fadeDurationMs = 600
  } = {}) {
    this.areaTracks = new Map(Object.entries(areaTracks));
    this.areaTrackFallbacks = new Map(Object.entries(areaTrackFallbacks));
    this.sfxTracks = new Map(Object.entries(sfxTracks));
    this.bgmAudioBySrc = new Map();
    this.bgmAreaBySrc = new Map();
    this.sfxPrototypeBySrc = new Map();
    this.failedBgmSrc = new Set();
    this.currentArea = null;
    this.currentAudio = null;
    this.bgmVolume = bgmVolume;
    this.bgmVolumeMultiplier = 1;
    this.sfxVolume = sfxVolume;
    this.bgmFadeMs = fadeDurationMs;
    this.fadeTimers = new Map();
    this._unlockBound = false;
    this._bgmDuckRestoreTimer = null;
    this.activeSfxShots = new Set();
    this._pauseMenuAudioSuspended = false;
    this._resumeMusicAfterPause = false;
    this._pausedSfxShots = new Set();
    this._autoplayRetryTimer = null;
  }

  getResolvedBgmVolume() {
    return Math.max(0, Math.min(1, this.bgmVolume * this.bgmVolumeMultiplier));
  }

  setBgmVolume(volume = this.bgmVolume, { fadeMs = this.bgmFadeMs } = {}) {
    const safe = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : this.bgmVolume;
    this.bgmVolume = safe;
    if (!this.currentAudio) return;
    this._fadeAudio(this.currentAudio, this.getResolvedBgmVolume(), fadeMs).catch(() => {});
  }

  setSfxVolume(volume = this.sfxVolume) {
    const safe = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : this.sfxVolume;
    this.sfxVolume = safe;
    for (const proto of this.sfxPrototypeBySrc.values()) {
      try { proto.volume = safe; } catch (e) {}
    }
    for (const shot of this.activeSfxShots) {
      if (!shot || shot.ended) continue;
      try { shot.volume = safe; } catch (e) {}
    }
  }

  setBgmVolumeMultiplier(multiplier = 1, { fadeMs = this.bgmFadeMs } = {}) {
    const safe = Number.isFinite(multiplier) ? Math.max(0, multiplier) : 1;
    if (Math.abs(safe - this.bgmVolumeMultiplier) < 0.0001) return;
    this.bgmVolumeMultiplier = safe;
    if (!this.currentAudio) return;
    this._fadeAudio(this.currentAudio, this.getResolvedBgmVolume(), fadeMs).catch(() => {});
  }

  registerAreaTrack(areaName, src) {
    this.areaTracks.set(areaName, src);
  }

  registerAreaTrackFallbacks(areaName, fallbackSrcs = []) {
    const normalized = Array.isArray(fallbackSrcs)
      ? fallbackSrcs.filter((src) => typeof src === "string" && src.length > 0)
      : [];
    this.areaTrackFallbacks.set(areaName, normalized);
  }

  _getAreaTrackCandidates(areaName) {
    const primary = this.areaTracks.get(areaName);
    const fallbacks = this.areaTrackFallbacks.get(areaName);
    const candidates = [];
    if (typeof primary === "string" && primary.length > 0) {
      candidates.push(primary);
    }
    if (Array.isArray(fallbacks)) {
      for (const src of fallbacks) {
        if (typeof src !== "string" || src.length === 0) continue;
        if (!candidates.includes(src)) candidates.push(src);
      }
    }
    return candidates;
  }

  _resolveAreaTrackSrc(areaName) {
    const candidates = this._getAreaTrackCandidates(areaName);
    if (candidates.length === 0) return null;
    const healthy = candidates.find((src) => !this.failedBgmSrc.has(src));
    return healthy || candidates[0];
  }

  registerSfxTrack(sfxName, src) {
    this.sfxTracks.set(sfxName, src);
  }

  playMusicForArea(areaName) {
    const src = this._resolveAreaTrackSrc(areaName);
    if (!src) {
      // No music defined for this area -> continue current music
      this.currentArea = areaName ?? null;
      return;
    }
    this.bgmAreaBySrc.set(src, areaName);

    const nextAudio = this._getOrCreateAudio(src);
    const sameArea = this.currentArea === areaName && this.currentAudio === nextAudio;
    if (sameArea && !nextAudio.paused) return;

    const fadeMs = this.bgmFadeMs;

    // If there's a different current audio, fade it out while fading in the next
    if (this.currentAudio && this.currentAudio !== nextAudio) {
      const prev = this.currentAudio;

      // Prepare next audio at zero volume and start playing
      try { nextAudio.volume = 0; } catch (e) {}
      this._playBgmWithAutoplayFallback(nextAudio);

      // Fade out previous and fade in next concurrently
      Promise.all([
        this._fadeAudio(prev, 0, fadeMs).then(() => {
          try { prev.pause(); prev.currentTime = 0; } catch (e) {}
        }),
        this._fadeAudio(nextAudio, this.getResolvedBgmVolume(), fadeMs)
      ]).catch(() => {});

      this.currentAudio = nextAudio;
      this.currentArea = areaName;
      return;
    }

    // If there's no current audio, just start the next audio with a fade-in
    if (!this.currentAudio) {
      try { nextAudio.volume = 0; } catch (e) {}
      this._playBgmWithAutoplayFallback(nextAudio);
      this.currentAudio = nextAudio;
      this.currentArea = areaName;
      this._fadeAudio(nextAudio, this.getResolvedBgmVolume(), fadeMs).catch(() => {});
      return;
    }

    // If same audio but paused, try to resume with fade-in
    if (sameArea && nextAudio.paused) {
      try { nextAudio.volume = 0; } catch (e) {}
      this._playBgmWithAutoplayFallback(nextAudio);
      this._fadeAudio(nextAudio, this.getResolvedBgmVolume(), fadeMs).catch(() => {});
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
    this.activeSfxShots.add(shot);
    shot.addEventListener("ended", () => {
      this.activeSfxShots.delete(shot);
      this._pausedSfxShots.delete(shot);
    }, { once: true });

    const playPromise = shot.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((err) => {
        console.warn("AudioManager: failed to play SFX", src, err);
        this.activeSfxShots.delete(shot);
        this._pausedSfxShots.delete(shot);
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
    this._resumeMusicAfterPause = false;
    this._clearAutoplayRetryTimer();
  }

  attachUnlockHandlers(target = window) {
    if (this._unlockBound) return;
    this._unlockBound = true;

    const unlock = () => {
      if (this._pauseMenuAudioSuspended) return;
      if (!this.currentAudio || !this.currentAudio.paused) return;
      this._playBgmWithAutoplayFallback(this.currentAudio);
    };

    target.addEventListener("pointerdown", unlock, { passive: true });
    target.addEventListener("keydown", unlock);
    target.addEventListener("load", unlock, { once: true });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") unlock();
    });
    setTimeout(unlock, 0);
  }

  _getOrCreateAudio(src) {
    if (this.bgmAudioBySrc.has(src)) return this.bgmAudioBySrc.get(src);

    const audio = new Audio(src);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = this.getResolvedBgmVolume();
    audio.addEventListener('error', (e) => {
      console.warn('AudioManager: BGM load error for', src, e);
      this.failedBgmSrc.add(src);
      const areaName = this.bgmAreaBySrc.get(src);
      if (areaName && this.currentArea === areaName) {
        setTimeout(() => this.playMusicForArea(areaName), 0);
      }
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
    const duckTo = Math.max(0.08, this.getResolvedBgmVolume() * 0.35);
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
        this._fadeAudio(audio, this.getResolvedBgmVolume(), upMs).catch(() => {});
      }
      this._bgmDuckRestoreTimer = null;
    }, holdMs);
  }

  pauseForPauseMenu() {
    if (this._pauseMenuAudioSuspended) return;
    this._pauseMenuAudioSuspended = true;

    this._resumeMusicAfterPause = false;
    if (this.currentAudio && !this.currentAudio.paused) {
      try {
        this.currentAudio.pause();
        this._resumeMusicAfterPause = true;
      } catch (e) {}
    }

    this._pausedSfxShots.clear();
    for (const shot of this.activeSfxShots) {
      if (!shot || shot.paused || shot.ended) continue;
      try {
        shot.pause();
        this._pausedSfxShots.add(shot);
      } catch (e) {}
    }
  }

  resumeFromPauseMenu() {
    if (!this._pauseMenuAudioSuspended) return;
    this._pauseMenuAudioSuspended = false;

    if (this._resumeMusicAfterPause && this.currentAudio) {
      this._playBgmWithAutoplayFallback(this.currentAudio);
    }
    this._resumeMusicAfterPause = false;

    for (const shot of this._pausedSfxShots) {
      if (!shot || shot.ended) continue;
      const playPromise = shot.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    }
    this._pausedSfxShots.clear();
  }

  _playBgmWithAutoplayFallback(audio) {
    if (!audio) return;
    const playPromise = audio.play();
    if (!playPromise || typeof playPromise.then !== "function") return;
    playPromise
      .then(() => this._clearAutoplayRetryTimer())
      .catch(() => {
        // Browsers may block unmuted autoplay; bootstrap silently then fade audible volume.
        const wasMuted = Boolean(audio.muted);
        try { audio.muted = true; } catch (e) {}
        const mutedPlayPromise = audio.play();
        if (!mutedPlayPromise || typeof mutedPlayPromise.then !== "function") {
          this._scheduleAutoplayRetry();
          return;
        }
        mutedPlayPromise
          .then(() => {
            try { audio.muted = wasMuted; } catch (e) {}
            this._clearAutoplayRetryTimer();
          })
          .catch(() => this._scheduleAutoplayRetry());
      });
  }

  _scheduleAutoplayRetry() {
    if (this._autoplayRetryTimer) return;
    this._autoplayRetryTimer = setTimeout(() => {
      this._autoplayRetryTimer = null;
      if (this._pauseMenuAudioSuspended || !this.currentAudio || !this.currentAudio.paused) return;
      this._playBgmWithAutoplayFallback(this.currentAudio);
    }, 1200);
  }

  _clearAutoplayRetryTimer() {
    if (!this._autoplayRetryTimer) return;
    clearTimeout(this._autoplayRetryTimer);
    this._autoplayRetryTimer = null;
  }
}

export { AudioManager as MusicManager };
