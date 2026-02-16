export function createSaveLoadCoordinator({
  buildGameSnapshot,
  applyGameSnapshot,
  loadGameSnapshot,
  saveGameSnapshot,
  getSaveLoadContext,
  applyWorldState,
  applyGameState,
  getGameController,
  setSettingsStatus,
  musicManager,
  onSaveNotice = null,
  onAfterRestore = null
}) {
  const newGameBaselineSnapshot = buildGameSnapshot(getSaveLoadContext());
  let lastAutoSaveAt = 0;
  const autoSaveCooldownMs = 7000;
  const nowMs = () => (typeof performance !== "undefined" && typeof performance.now === "function")
    ? performance.now()
    : Date.now();

  function pushSaveNotice(text, type = "save", durationMs = 1700) {
    if (typeof onSaveNotice === "function") {
      onSaveNotice({ text, type, durationMs });
    }
  }

  function syncMusicForCurrentArea() {
    const gameController = getGameController();
    if (gameController && typeof gameController.syncMusicForCurrentArea === "function") {
      gameController.syncMusicForCurrentArea();
    }
  }

  function restoreGameFromSnapshot(snapshot, successMessage = "Game loaded.") {
    const result = applyGameSnapshot(snapshot, getSaveLoadContext());
    if (!result.success) {
      musicManager.playSfx("uiError");
      setSettingsStatus("Save data invalid.");
      pushSaveNotice("Save data invalid.", "error", 2000);
      return false;
    }

    if (result.newWorldState) {
      applyWorldState(result.newWorldState);
    }

    if (result.newGameState) {
      applyGameState(result.newGameState);
    }

    syncMusicForCurrentArea();
    musicManager.playSfx("loadGame");
    setSettingsStatus(successMessage);
    pushSaveNotice(successMessage, "load", 1700);
    if (typeof onAfterRestore === "function") {
      onAfterRestore();
    }
    return true;
  }

  function performSaveGame() {
    const snapshot = buildGameSnapshot(getSaveLoadContext());
    const ok = saveGameSnapshot(snapshot);
    if (ok) {
      musicManager.playSfx("saveGame");
      setSettingsStatus("Game saved.");
      pushSaveNotice("Game saved.", "save", 1700);
      return;
    }

    musicManager.playSfx("uiError");
    setSettingsStatus("Save failed.");
    pushSaveNotice("Save failed.", "error", 2200);
  }

  function performLoadGame() {
    const snapshot = loadGameSnapshot();
    if (!snapshot) {
      musicManager.playSfx("uiError");
      setSettingsStatus("No save found.");
      pushSaveNotice("No save found.", "error", 2000);
      return;
    }

    restoreGameFromSnapshot(snapshot, "Save loaded.");
  }

  function performStartNewGame() {
    restoreGameFromSnapshot(newGameBaselineSnapshot, "New game started.");
  }

  function performAutoSave(reason = "Checkpoint") {
    const now = nowMs();
    if (now - lastAutoSaveAt < autoSaveCooldownMs) {
      return false;
    }

    const snapshot = buildGameSnapshot(getSaveLoadContext());
    const ok = saveGameSnapshot(snapshot);
    if (!ok) return false;

    lastAutoSaveAt = now;
    pushSaveNotice(`Autosaved: ${reason}`, "autosave", 1450);
    return true;
  }

  function applyTitlePreviewSnapshot() {
    const titlePreviewSnapshot = loadGameSnapshot();
    if (titlePreviewSnapshot) {
      applyGameSnapshot(titlePreviewSnapshot, getSaveLoadContext());
    }
  }

  return {
    performSaveGame,
    performLoadGame,
    performStartNewGame,
    performAutoSave,
    restoreGameFromSnapshot,
    applyTitlePreviewSnapshot,
    getNewGameBaselineSnapshot: () => newGameBaselineSnapshot
  };
}
