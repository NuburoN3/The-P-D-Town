import { GAME_STATES, isFreeExploreState } from "../core/constants.js";
import { createRoamingNpcController } from "./controller/roamingNpcController.js";
import { createTransientUiUpdater } from "./controller/transientUiController.js";

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
  const { updateRoamingNPCs } = createRoamingNpcController({ state, collision });
  const { updateTransientUi } = createTransientUiUpdater({ state, dialogue, levelUpMessage });

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
    const previousAreaId = state.getCurrentAreaId();
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
    if (typeof actions.onAreaChanged === "function") {
      actions.onAreaChanged({
        previousTownId,
        previousAreaId,
        townId,
        areaId
      });
    }
    return true;
  }

  function updatePlayerMovement(dtScale = 1) {
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
        currentAreaId: state.getCurrentAreaId(),
        dtScale
      },
      {
        collides: collision.collidesAt,
        collidesWithNPC: collision.collidesWithNPCAt,
        doorFromCollision: collision.detectDoorCollision,
        beginDoorSequence: actions.beginDoorSequence
      }
    );
  }

  function updateDoorEntry(dtScale = 1) {
    movementSystem.updateDoorEntry(
      { player: state.player, doorSequence: state.doorSequence, dtScale },
      (nextState) => {
        state.setGameState(nextState);
      }
    );
  }

  function updateTransition(dtScale = 1) {
    movementSystem.updateTransition(
      { player: state.player, doorSequence: state.doorSequence, dtScale },
      {
        setArea,
        setGameState: (nextState) => {
          state.setGameState(nextState);
        },
        getCurrentAreaKind: () => worldService.getAreaKind(state.getCurrentTownId(), state.getCurrentAreaId())
      }
    );
  }

  function update(dtScale = 1) {
    const now = performance.now();
    updateTransientUi(now);

    const gameState = state.getGameState();
    if (isFreeExploreState(gameState) && !dialogue.isDialogueActive()) {
      updateRoamingNPCs(now, dtScale);
      if (!state.player.isTraining) {
        updatePlayerMovement(dtScale);
      }
    } else if (dialogue.isDialogueActive()) {
      state.player.walking = false;
    } else if (typeof actions.updateFeatureState === "function" && actions.updateFeatureState(gameState)) {
      state.player.walking = false;
    } else if (gameState === GAME_STATES.ENTERING_DOOR) {
      updateDoorEntry(dtScale);
    } else if (gameState === GAME_STATES.TRANSITION) {
      updateTransition(dtScale);
    }

    if (state.getGameState() !== GAME_STATES.TRANSITION && !state.playerDefeatSequence?.active) {
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
