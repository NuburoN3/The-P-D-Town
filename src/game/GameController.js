import { GAME_STATES, isFreeExploreState } from "../core/constants.js";

export function createGameController({
  movementSystem,
  collision,
  musicManager,
  worldService,
  levelUpMessage,
  state,
  dialogue,
  actions
}) {
  function syncMusicForCurrentArea() {
    const musicKey = worldService.getAreaMusicKey(state.getCurrentTownId(), state.getCurrentAreaId());
    if (!musicKey) {
      musicManager.stopCurrentMusic();
      return;
    }
    musicManager.playMusicForArea(musicKey);
  }

  function setArea(townId, areaId) {
    const area = worldService.getArea(townId, areaId);
    if (!area) return false;

    const previousTownId = state.getCurrentTownId();
    state.setCurrentTownId(townId);
    state.setCurrentAreaId(areaId);
    state.setCurrentMapContext({
      map: area.map,
      width: area.width,
      height: area.height
    });

    if (townId !== previousTownId) {
      state.reloadTownNPCs(townId);
      if (typeof state.reloadTownEnemies === "function") {
        state.reloadTownEnemies(townId);
      }
    }

    syncMusicForCurrentArea();
    return true;
  }

  function updatePlayerMovement() {
    const blockingEntities = Array.isArray(state.enemies)
      ? state.npcs.concat(state.enemies.filter((enemy) => !enemy.dead))
      : state.npcs;

    movementSystem.updatePlayerMovement(
      {
        player: state.player,
        currentMap: state.getCurrentMap(),
        currentMapW: state.getCurrentMapW(),
        currentMapH: state.getCurrentMapH(),
        npcs: blockingEntities,
        currentAreaId: state.getCurrentAreaId()
      },
      {
        collides: collision.collidesAt,
        collidesWithNPC: collision.collidesWithNPCAt,
        doorFromCollision: collision.detectDoorCollision,
        beginDoorSequence: actions.beginDoorSequence
      }
    );
  }

  function updateDoorEntry() {
    movementSystem.updateDoorEntry(
      { player: state.player, doorSequence: state.doorSequence },
      (nextState) => {
        state.setGameState(nextState);
      }
    );
  }

  function updateTransition() {
    movementSystem.updateTransition(
      { player: state.player, doorSequence: state.doorSequence },
      {
        setArea,
        setGameState: (nextState) => {
          state.setGameState(nextState);
        },
        getCurrentAreaKind: () => worldService.getAreaKind(state.getCurrentTownId(), state.getCurrentAreaId())
      }
    );
  }

  function updateTransientUi(now) {
    if (
      state.trainingPopup.pendingLevelUpDialogueAt !== null &&
      now >= state.trainingPopup.pendingLevelUpDialogueAt &&
      !dialogue.isDialogueActive() &&
      !dialogue.isChoiceActive()
    ) {
      state.trainingPopup.pendingLevelUpDialogueAt = null;
      dialogue.showDialogue("", levelUpMessage);
    }

    if (state.trainingPopup.active && now - state.trainingPopup.startedAt >= state.trainingPopup.durationMs) {
      state.trainingPopup.active = false;
      state.trainingPopup.levelUp = false;
      state.player.isTraining = false;
    }

    if (state.itemAlert.active && now - state.itemAlert.startedAt >= state.itemAlert.durationMs) {
      state.itemAlert.active = false;
    }

    if (state.inventoryHint.active && now - state.inventoryHint.startedAt >= state.inventoryHint.durationMs) {
      state.inventoryHint.active = false;
    }
  }

  function update() {
    const now = performance.now();
    updateTransientUi(now);

    const gameState = state.getGameState();
    if (isFreeExploreState(gameState) && !dialogue.isDialogueActive()) {
      if (!state.player.isTraining) {
        updatePlayerMovement();
      }
    } else if (dialogue.isDialogueActive()) {
      state.player.walking = false;
    } else if (typeof actions.updateFeatureState === "function" && actions.updateFeatureState(gameState)) {
      state.player.walking = false;
    } else if (gameState === GAME_STATES.ENTERING_DOOR) {
      updateDoorEntry();
    } else if (gameState === GAME_STATES.TRANSITION) {
      updateTransition();
    }

    if (state.getGameState() !== GAME_STATES.TRANSITION) {
      actions.handleInteraction();
    }

    movementSystem.updatePlayerAnimation(state.player);
    movementSystem.updateCamera({
      cam: state.cam,
      player: state.player,
      currentMapW: state.getCurrentMapW(),
      currentMapH: state.getCurrentMapH(),
      canvas: state.canvas,
      gameState
    });
  }

  return {
    setArea,
    syncMusicForCurrentArea,
    update
  };
}
