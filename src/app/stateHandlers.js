import { TILE_TYPES } from "../core/constants.js";

export function createWorldStateHandlers({
  worldService,
  tileSize,
  gameFlags,
  getCurrentTownId,
  getCurrentAreaId
}) {
  function isConditionallyHiddenDoor(tileX, tileY) {
    const townId = getCurrentTownId();
    const areaId = getCurrentAreaId();
    const town = worldService.getTown(townId);
    if (!town || !Array.isArray(town.conditionalDoors)) return false;

    for (const conditionalDoor of town.conditionalDoors) {
      if (conditionalDoor.areaId !== areaId) continue;
      if (conditionalDoor.x !== tileX || conditionalDoor.y !== tileY) continue;
      if (!gameFlags[conditionalDoor.hiddenUntil]) return true;
    }

    return false;
  }

  function getRespawnDestination(townId) {
    const town = worldService.getTown(townId);
    if (!town) return null;

    const fallbackSpawn = town.respawnSpawn
      ? worldService.resolveSpawn(townId, town.respawnSpawn)
      : null;

    const fallback = fallbackSpawn
      ? {
        townId: fallbackSpawn.townId || townId,
        areaId: fallbackSpawn.areaId,
        x: Number.isFinite(fallbackSpawn.x) ? fallbackSpawn.x : 6 * tileSize,
        y: Number.isFinite(fallbackSpawn.y) ? fallbackSpawn.y : 8 * tileSize,
        dir: "up"
      }
      : null;

    if (!town.respawnNpcId) return fallback;

    const respawnNpcDef = Array.isArray(town.npcs)
      ? town.npcs.find((npc) => npc && npc.id === town.respawnNpcId)
      : null;
    if (!respawnNpcDef) return fallback;

    const areaId = respawnNpcDef.areaId || (fallback && fallback.areaId);
    const area = areaId ? worldService.getArea(townId, areaId) : null;
    if (!area) return fallback;

    const facingOffsets = {
      up: { x: 0, y: -1, dir: "down" },
      down: { x: 0, y: 1, dir: "up" },
      left: { x: -1, y: 0, dir: "right" },
      right: { x: 1, y: 0, dir: "left" }
    };
    const facing = facingOffsets[respawnNpcDef.dir || "down"] || facingOffsets.down;
    const targetTx = respawnNpcDef.x + facing.x;
    const targetTy = respawnNpcDef.y + facing.y;

    const inBounds =
      targetTx >= 0 &&
      targetTy >= 0 &&
      targetTx < area.width &&
      targetTy < area.height;

    if (!inBounds) return fallback;

    const tile = area.map[targetTy]?.[targetTx];
    if (
      tile === TILE_TYPES.WALL ||
      tile === TILE_TYPES.TREE ||
      tile === TILE_TYPES.SIGNPOST
    ) {
      return fallback;
    }

    return {
      townId,
      areaId,
      x: targetTx * tileSize,
      y: targetTy * tileSize,
      dir: facing.dir
    };
  }

  return {
    isConditionallyHiddenDoor,
    getRespawnDestination
  };
}

export function createRuntimeStateHandlers({
  getGameState,
  isFreeExploreState,
  titleScreenSystem,
  gameplayStartState,
  player,
  cam,
  getCurrentMapW,
  getCurrentMapH,
  getGameController,
  setGameState,
  setPreviousWorldState,
  setPreviousGameState,
  defeatSequenceSystem,
  playerDefeatSequence,
  getCurrentTownId,
  getCurrentAreaId,
  challengeSystem,
  gameFlags,
  itemAlert,
  enemies,
  dialogue,
  input,
  musicManager,
  userSettings,
  combatFeedback,
  fountainHealSystem,
  doorSequence,
  choiceState
}) {
  function isDialogueActive() {
    return dialogue.isActive();
  }

  function triggerHitstop(durationMs) {
    if (!Number.isFinite(durationMs) || durationMs <= 0) return;
    const now = performance.now();
    combatFeedback.hitstopUntil = Math.max(combatFeedback.hitstopUntil, now + durationMs);
  }

  function triggerCameraShake(magnitude = 0, durationMs = 0) {
    if (!userSettings.screenShake) return;
    if (!Number.isFinite(durationMs) || durationMs <= 0) return;
    const now = performance.now();
    combatFeedback.shakeUntil = Math.max(combatFeedback.shakeUntil, now + durationMs);
    combatFeedback.shakeMagnitude = Math.max(combatFeedback.shakeMagnitude, magnitude);
  }

  function updatePlayerDefeatSequence(now) {
    defeatSequenceSystem.update(now, {
      playerDefeatSequence,
      player,
      gameController: getGameController(),
      currentTownId: getCurrentTownId(),
      currentAreaId: getCurrentAreaId(),
      setGameState,
      setPreviousWorldState,
      setPreviousGameState
    });
  }

  function handleChallengeEnemyDefeat(enemy, now) {
    return challengeSystem.handleEnemyDefeat(
      { gameFlags, currentTownId: getCurrentTownId(), player, itemAlert },
      enemy,
      now
    );
  }

  function handlePlayerDefeated({ player: defeatedPlayer }) {
    defeatSequenceSystem.handlePlayerDefeated({
      playerDefeatSequence,
      player: defeatedPlayer,
      dialogue,
      input,
      currentTownId: getCurrentTownId(),
      setGameState
    });
  }

  function handleCombatHitConfirmed(event) {
    if (!event) return;

    if (event.type === "entityDamaged") {
      triggerHitstop(52);
      triggerCameraShake(2.8, 120);
      musicManager.playSfx("hitImpact");
      return;
    }

    if (event.type === "playerDamaged") {
      triggerHitstop(44);
      triggerCameraShake(2.2, 140);
      combatFeedback.playerDamageFlashUntil = performance.now() + 170;
      musicManager.playSfx("hurt");
    }
  }

  function updateTitleScreen(now) {
    titleScreenSystem.update(now, {
      player,
      cam,
      currentMapW: getCurrentMapW(),
      currentMapH: getCurrentMapH(),
      onFadeOutComplete: () => {
        setGameState(gameplayStartState);
        setPreviousWorldState(gameplayStartState);
        setPreviousGameState(gameplayStartState);

        const gameController = getGameController();
        if (gameController && typeof gameController.syncMusicForCurrentArea === "function") {
          gameController.syncMusicForCurrentArea();
        }
      }
    });
  }

  function canRunCombatSystems() {
    const gameState = getGameState();
    return (
      isFreeExploreState(gameState) &&
      !isDialogueActive() &&
      !choiceState.active &&
      !doorSequence.active &&
      !player.isTraining
    );
  }

  function updateFountainHealing(now) {
    const gameState = getGameState();
    fountainHealSystem.update({
      now,
      gameState,
      doorSequenceActive: doorSequence.active,
      player,
      currentTownId: getCurrentTownId(),
      currentAreaId: getCurrentAreaId()
    });
  }

  function prepareChallengeEnemies() {
    challengeSystem.prepareEnemies({
      gameFlags,
      currentTownId: getCurrentTownId(),
      enemies
    });
  }

  return {
    isDialogueActive,
    updatePlayerDefeatSequence,
    handleChallengeEnemyDefeat,
    handlePlayerDefeated,
    handleCombatHitConfirmed,
    updateTitleScreen,
    canRunCombatSystems,
    updateFountainHealing,
    prepareChallengeEnemies
  };
}
