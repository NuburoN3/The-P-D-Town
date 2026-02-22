export function createGameLoop({
  gameStates,
  getGameState,
  getSimulationGameState,
  syncPointerLockWithState,
  inputController,
  pauseMenuSystem,
  combatFeedback,
  updateTitleScreen,
  updatePlayerDefeatSequence,
  gameController,
  prepareChallengeEnemies,
  enemyAiSystem,
  isDialogueActive,
  choiceState,
  enemies,
  npcs,
  player,
  playerEquipment = null,
  getCurrentAreaId,
  getCurrentMap,
  getCurrentMapW,
  getCurrentMapH,
  collisionService,
  combatSystem,
  input,
  updateFountainHealing,
  vfxSystem,
  updateRuntimeUi = () => { },
  render
}) {
  let lastFrameTime = performance.now();

  function loop() {
    const now = performance.now();
    const rawDt = now - lastFrameTime;
    lastFrameTime = now;
    const dt = Math.min(rawDt, 66.67);
    const dtScale = dt / 16.667;

    syncPointerLockWithState();
    if (inputController) inputController.update(now);
    pauseMenuSystem.update(dtScale);

    const gameState = getGameState();
    const simulationGameState = typeof getSimulationGameState === "function"
      ? getSimulationGameState(gameState)
      : gameState;
    const hitstopActive = now < combatFeedback.hitstopUntil;

    if (gameState === gameStates.TITLE_SCREEN || gameState === gameStates.INTRO_CUTSCENE) {
      updateTitleScreen(now);
    } else {
      updatePlayerDefeatSequence(now);

      if (!hitstopActive) {
        gameController.update(dtScale);
        prepareChallengeEnemies();

        enemyAiSystem.update({
          now,
          dtScale,
          gameState: simulationGameState,
          isDialogueActive: isDialogueActive(),
          choiceActive: choiceState.active,
          enemies,
          npcs,
          player,
          currentAreaId: getCurrentAreaId(),
          currentMap: getCurrentMap(),
          currentMapW: getCurrentMapW(),
          currentMapH: getCurrentMapH(),
          collidesAt: (...args) => collisionService.collides(...args)
        });

        combatSystem.update({
          now,
          gameState: simulationGameState,
          isDialogueActive: isDialogueActive(),
          choiceActive: choiceState.active,
          attackPressed: input.getAttackPressed(),
          requestedAttackId: player.requestedAttackId || player.equippedAttackId || null,
          player,
          playerEquipment,
          enemies,
          npcs,
          currentAreaId: getCurrentAreaId()
        });

        updateFountainHealing(now, simulationGameState);
      }

      input.clearAttackPressed();
    }

    if (!hitstopActive) {
      vfxSystem.update(now);
    }

    updateRuntimeUi(now);

    render();
    requestAnimationFrame(loop);
  }

  return {
    startLoop: () => requestAnimationFrame(loop)
  };
}
