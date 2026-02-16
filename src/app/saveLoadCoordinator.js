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
  musicManager
}) {
  const newGameBaselineSnapshot = buildGameSnapshot(getSaveLoadContext());

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
    return true;
  }

  function performSaveGame() {
    const snapshot = buildGameSnapshot(getSaveLoadContext());
    const ok = saveGameSnapshot(snapshot);
    if (ok) {
      musicManager.playSfx("saveGame");
      setSettingsStatus("Game saved.");
      return;
    }

    musicManager.playSfx("uiError");
    setSettingsStatus("Save failed.");
  }

  function performLoadGame() {
    const snapshot = loadGameSnapshot();
    if (!snapshot) {
      musicManager.playSfx("uiError");
      setSettingsStatus("No save found.");
      return;
    }

    restoreGameFromSnapshot(snapshot, "Save loaded.");
  }

  function performStartNewGame() {
    restoreGameFromSnapshot(newGameBaselineSnapshot, "New game started.");
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
    restoreGameFromSnapshot,
    applyTitlePreviewSnapshot,
    getNewGameBaselineSnapshot: () => newGameBaselineSnapshot
  };
}
