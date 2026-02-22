import { AREA_KINDS, GAME_STATES, isFreeExploreState } from "../core/constants.js";
import { getTownProgress, playerTilePosition as getPlayerTilePosition } from "./interaction/contextUtils.js";
import { createDoorSequenceStarter } from "./interaction/doorSequence.js";
import {
  findClosestInteractableLeftover,
  findClosestInteractableNpc,
  findNearbySignpost,
  orientNpcTowardPlayer
} from "./interaction/interactionSearch.js";
import { createNPCInteractionHandler } from "./interaction/npcInteractions.js";
import { createTryTrainingAction } from "./interaction/trainingActions.js";

export function createInteractionSystem({
  tileSize,
  ui,
  training,
  canvas,
  cameraZoom = 1,
  gameFlags,
  playerInventory,
  playerEquipment,
  playerStats,
  trainingPopup,
  itemAlert,
  inventoryHint,
  player,
  npcs,
  leftovers = [],
  doorSequence,
  musicManager,
  worldService,
  trainingContent,
  getCurrentTownId,
  getCurrentAreaId,
  getCurrentAreaKind,
  getCurrentMap,
  getCurrentMapW,
  getCurrentMapH,
  getGameState,
  setGameState,
  getPreviousWorldState,
  setPreviousWorldState,
  isDialogueActive,
  choiceState,
  showDialogue,
  openYesNoChoice,
  advanceDialogue,
  pauseDialogueAdvance = () => { },
  lockInteractionInput = () => { },
  isInteractionLocked = () => false,
  getInteractPressed,
  clearInteractPressed,
  syncObjectiveState = () => { },
  spawnVisualEffect = () => { },
  canEnterDoor = () => ({ allowed: true, message: "" }),
  onDoorEntryBlocked = () => { },
  onLeftoversInteracted = () => { },
  handleFeatureNPCInteraction = () => false,
  handleFeatureStateInteraction = () => false,
  openQuestCompletionPanel = () => false
}) {
  const playerTilePosition = () => getPlayerTilePosition(player, tileSize);
  const getCurrentTownProgress = () => getTownProgress(gameFlags, getCurrentTownId());

  const tryTrainingAction = createTryTrainingAction({
    tileSize,
    training,
    gameFlags,
    playerStats,
    trainingPopup,
    player,
    doorSequence,
    worldService,
    trainingContent,
    musicManager,
    getCurrentTownId,
    getCurrentAreaId,
    getCurrentAreaKind,
    getGameState,
    isDialogueActive,
    choiceState,
    showDialogue,
    spawnVisualEffect,
    playerTilePosition,
    getTownProgress: getCurrentTownProgress
  });

  const handleNPCInteraction = createNPCInteractionHandler({
    tileSize,
    gameFlags,
    playerInventory,
    playerEquipment,
    playerStats,
    itemAlert,
    inventoryHint,
    player,
    trainingContent,
    musicManager,
    showDialogue,
    openYesNoChoice,
    pauseDialogueAdvance,
    lockInteractionInput,
    spawnVisualEffect,
    getTownProgress: getCurrentTownProgress,
    handleFeatureNPCInteraction,
    syncObjectiveState,
    openQuestCompletionPanel
  });

  const beginDoorSequence = createDoorSequenceStarter({
    tileSize,
    canvas,
    cameraZoom,
    player,
    doorSequence,
    musicManager,
    worldService,
    getCurrentTownId,
    getCurrentAreaId,
    getGameState,
    setGameState,
    clearInteractPressed,
    spawnVisualEffect,
    canEnterDoor: ({ doorTile, destination, townId, areaId }) =>
      canEnterDoor({ doorTile, destination, townId, areaId, playerEquipment }),
    onDoorEntryBlocked
  });

  function toggleInventory() {
    const gameState = getGameState();
    if (gameState === GAME_STATES.INVENTORY) {
      const previousState = getPreviousWorldState();
      setGameState(previousState);
      if (isFreeExploreState(previousState) && musicManager && typeof musicManager.resumeFromPauseMenu === "function") {
        musicManager.resumeFromPauseMenu();
      }
      clearInteractPressed();
      return;
    }

    if (!isFreeExploreState(gameState)) return;
    if (isDialogueActive() || choiceState.active || doorSequence.active) return;

    setPreviousWorldState(gameState);
    setGameState(GAME_STATES.INVENTORY);
    clearInteractPressed();
  }

  function handleInteraction() {
    const gameState = getGameState();

    if (handleFeatureStateInteraction(gameState)) {
      return;
    }

    if (
      gameState === GAME_STATES.TITLE_SCREEN ||
      gameState === GAME_STATES.INVENTORY ||
      gameState === GAME_STATES.QUEST_TRACKER ||
      gameState === GAME_STATES.QUEST_COMPLETION ||
      gameState === GAME_STATES.PAUSE_MENU ||
      gameState === GAME_STATES.SETTINGS ||
      gameState === GAME_STATES.ATTRIBUTES
    ) {
      clearInteractPressed();
      return;
    }

    if (!getInteractPressed()) return;
    if (isInteractionLocked()) {
      clearInteractPressed();
      return;
    }

    if (isDialogueActive()) {
      advanceDialogue();
      clearInteractPressed();
      return;
    }

    if (gameState === GAME_STATES.ENTERING_DOOR || gameState === GAME_STATES.TRANSITION) {
      clearInteractPressed();
      return;
    }

    const currentAreaId = getCurrentAreaId();
    const currentMap = getCurrentMap();
    const currentMapW = getCurrentMapW();
    const currentMapH = getCurrentMapH();
    const currentTownId = getCurrentTownId();

    const playerCenterX = player.x + tileSize / 2;
    const playerCenterY = player.y + tileSize / 2;

    const closestLeftover = findClosestInteractableLeftover({
      leftovers,
      currentTownId,
      currentAreaId,
      playerCenterX,
      playerCenterY,
      interactReach: ui.INTERACT_REACH
    });
    if (closestLeftover) {
      onLeftoversInteracted(closestLeftover);
      clearInteractPressed();
      return;
    }

    const closestNpc = findClosestInteractableNpc({
      npcs,
      currentAreaId,
      playerCenterX,
      playerCenterY,
      interactReach: ui.INTERACT_REACH
    });

    if (closestNpc) {
      orientNpcTowardPlayer(closestNpc, playerCenterX, playerCenterY);
      handleNPCInteraction(closestNpc);
      clearInteractPressed();
      return;
    }

    const signpost = findNearbySignpost({
      player,
      tileSize,
      inset: 5,
      currentMap,
      currentMapW,
      currentMapH,
      readSignpost: (tx, ty) => worldService.getSignpostText(currentTownId, currentAreaId, tx, ty)
    });

    if (signpost) {
      spawnVisualEffect("interactionPulse", {
        x: signpost.tx * tileSize + tileSize / 2,
        y: signpost.ty * tileSize + tileSize / 2,
        size: 18
      });
      showDialogue("", signpost.text);
      clearInteractPressed();
      return;
    }

    if (getCurrentAreaKind() !== AREA_KINDS.OVERWORLD && gameFlags.acceptedTraining) {
      const trainingTile = worldService.getTrainingTile(currentTownId, currentAreaId);
      if (trainingTile) {
        const tilePos = playerTilePosition();
        const onTrainingTile = tilePos.x === trainingTile.x && tilePos.y === trainingTile.y;
        if (onTrainingTile) {
          tryTrainingAction();
          clearInteractPressed();
          return;
        }
      }
    }

    clearInteractPressed();
  }

  return {
    playerTilePosition,
    tryTrainingAction,
    toggleInventory,
    handleNPCInteraction,
    beginDoorSequence,
    handleInteraction
  };
}
