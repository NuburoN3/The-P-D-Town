export function createMenuStateController({
  gameStates,
  isFreeExploreState,
  getGameState,
  setGameState,
  getPreviousGameState,
  setPreviousGameState,
  pauseMenuState,
  syncPointerLockWithState,
  musicManager
}) {
  function setPauseMenuAnimation(mode, durationMs = 170) {
    pauseMenuState.animationMode = mode;
    pauseMenuState.animationStartedAt = performance.now();
    pauseMenuState.animationDurationMs = durationMs;
  }

  function openPauseMenu() {
    const gameState = getGameState();
    if (!isFreeExploreState(gameState)) return;

    setPreviousGameState(gameState);
    setGameState(gameStates.PAUSE_MENU);
    syncPointerLockWithState();
    setPauseMenuAnimation("in", 170);
    musicManager.pauseForPauseMenu();
    musicManager.playSfx("menuOpen");
  }

  function resumeFromPauseMenu() {
    setPauseMenuAnimation("out", 140);
    setGameState(getPreviousGameState());
    syncPointerLockWithState({ fromUserGesture: true });
    musicManager.resumeFromPauseMenu();
    musicManager.playSfx("menuConfirm");
  }

  function returnToPauseMenu() {
    setGameState(gameStates.PAUSE_MENU);
    syncPointerLockWithState();
    setPauseMenuAnimation("in", 130);
    musicManager.pauseForPauseMenu();
    musicManager.playSfx("menuOpen");
  }

  return {
    openPauseMenu,
    resumeFromPauseMenu,
    returnToPauseMenu
  };
}
