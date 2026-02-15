import {
  TILE,
  CAMERA_ZOOM,
  SPRITE_FRAME_WIDTH,
  SPRITE_FRAME_HEIGHT,
  SPRITE_FRAMES_PER_ROW,
  COLORS,
  UI,
  TRAINING
} from "../core/constants.js";
import { InputManager } from "../core/InputManager.js";
import { CollisionService } from "../core/CollisionSystem.js";
import { drawTile as drawTileSystem } from "../rendering/TileSystem.js";
import { DialogueSystem } from "../game/DialogueSystem.js";
import { renderGameFrame } from "../game/RenderSystem.js";
import { createMovementSystem } from "../game/MovementSystem.js";
import { createInteractionSystem } from "../game/InteractionSystem.js";
import { createGameController } from "../game/GameController.js";
import { createGameRuntime } from "../game/bootstrap.js";
import { createGameFeatures } from "../game/features/index.js";
import { createFeatureCoordinator } from "../game/features/FeatureCoordinator.js";

const { canvas, ctx, assets, worldService, musicManager, state } = createGameRuntime();

const {
  gameFlags,
  playerInventory,
  playerStats,
  trainingPopup,
  itemAlert,
  inventoryHint,
  npcs,
  player,
  cam,
  doorSequence
} = state;

let { currentTownId, currentAreaId, currentMap, currentMapW, currentMapH, gameState, previousWorldState } = state;

let interactionSystem = null;
const input = new InputManager({
  onToggleInventory: () => {
    if (interactionSystem) {
      interactionSystem.toggleInventory();
    }
  }
});

const collisionService = new CollisionService({ tileSize: TILE });

const movementSystem = createMovementSystem({
  keys: input.keys,
  tileSize: TILE,
  spriteFramesPerRow: SPRITE_FRAMES_PER_ROW,
  cameraZoom: CAMERA_ZOOM,
  musicManager
});

const dialogue = new DialogueSystem({ ctx, canvas, ui: UI });
const choiceState = dialogue.choiceState;
const trainingContent = worldService.getTrainingContent();

function isDialogueActive() {
  return dialogue.isActive();
}

function showDialogue(name, textOrLines, endAction = null) {
  dialogue.show(name, textOrLines, endAction);
}

function openYesNoChoice(onConfirm) {
  dialogue.openYesNoChoice(onConfirm);
}

function confirmChoice() {
  dialogue.confirmChoice();
}

function advanceDialogue() {
  dialogue.advance();
}

const gameFeatures = createGameFeatures({
  getCurrentAreaKind: () => worldService.getAreaKind(currentTownId, currentAreaId),
  setGameState: (nextState) => {
    gameState = nextState;
  },
  showDialogue,
  openYesNoChoice,
  closeDialogue: () => dialogue.close()
});

const featureCoordinator = createFeatureCoordinator({ features: gameFeatures });

interactionSystem = createInteractionSystem({
  tileSize: TILE,
  ui: UI,
  training: TRAINING,
  canvas,
  gameFlags,
  playerInventory,
  playerStats,
  trainingPopup,
  itemAlert,
  inventoryHint,
  player,
  npcs,
  doorSequence,
  musicManager,
  worldService,
  trainingContent,
  getCurrentTownId: () => currentTownId,
  getCurrentAreaId: () => currentAreaId,
  getCurrentAreaKind: () => worldService.getAreaKind(currentTownId, currentAreaId),
  getCurrentMap: () => currentMap,
  getCurrentMapW: () => currentMapW,
  getCurrentMapH: () => currentMapH,
  getGameState: () => gameState,
  setGameState: (nextState) => {
    gameState = nextState;
  },
  getPreviousWorldState: () => previousWorldState,
  setPreviousWorldState: (nextState) => {
    previousWorldState = nextState;
  },
  isDialogueActive,
  choiceState,
  showDialogue,
  openYesNoChoice,
  advanceDialogue,
  getInteractPressed: () => input.getInteractPressed(),
  clearInteractPressed: () => input.clearInteractPressed(),
  handleFeatureNPCInteraction: (npc) => featureCoordinator.tryHandleNPCInteraction(npc),
  handleFeatureStateInteraction: (activeGameState) => {
    if (!featureCoordinator.handlesGameState(activeGameState)) return false;
    if (input.getInteractPressed()) {
      featureCoordinator.handleStateInteract(activeGameState);
      input.clearInteractPressed();
    }
    return true;
  }
});

const gameController = createGameController({
  movementSystem,
  collision: {
    collidesAt: (...args) => collisionService.collides(...args),
    collidesWithNPCAt: (...args) => collisionService.collidesWithNPC(...args),
    detectDoorCollision: (...args) => collisionService.doorFromCollision(...args)
  },
  musicManager,
  worldService,
  levelUpMessage: TRAINING.LEVEL_UP_MESSAGE,
  state: {
    player,
    npcs,
    doorSequence,
    trainingPopup,
    itemAlert,
    inventoryHint,
    cam,
    canvas,
    getCurrentTownId: () => currentTownId,
    setCurrentTownId: (townId) => {
      currentTownId = townId;
    },
    getCurrentAreaId: () => currentAreaId,
    setCurrentAreaId: (areaId) => {
      currentAreaId = areaId;
    },
    setCurrentMapContext: ({ map, width, height }) => {
      currentMap = map;
      currentMapW = width;
      currentMapH = height;
    },
    reloadTownNPCs: (townId) => {
      const nextTownNPCs = worldService.createNPCsForTown(townId);
      npcs.splice(0, npcs.length, ...nextTownNPCs);
    },
    getCurrentMap: () => currentMap,
    getCurrentMapW: () => currentMapW,
    getCurrentMapH: () => currentMapH,
    getGameState: () => gameState,
    setGameState: (nextState) => {
      gameState = nextState;
    }
  },
  dialogue: {
    isDialogueActive,
    isChoiceActive: () => choiceState.active,
    showDialogue
  },
  actions: {
    beginDoorSequence: (doorTile) => interactionSystem.beginDoorSequence(doorTile),
    handleInteraction: () => interactionSystem.handleInteraction(),
    updateFeatureState: (activeGameState) => featureCoordinator.updateForState(activeGameState)
  }
});

input.initialize();

addEventListener("keydown", (e) => {
  if (!choiceState.active) return;

  if (!e.repeat && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
    const direction = e.key === "ArrowUp" ? -1 : 1;
    const total = choiceState.options.length;
    choiceState.selected = (choiceState.selected + direction + total) % total;
  }

  if (e.key === "Enter" && !e.repeat) {
    confirmChoice();
    input.clearInteractPressed();
  }
});

function drawTile(type, x, y, tileX, tileY) {
  const getTileAt = (tx, ty) => {
    if (ty < 0 || ty >= currentMapH || tx < 0 || tx >= currentMapW) return null;
    const row = currentMap[ty];
    return row ? row[tx] : null;
  };

  drawTileSystem(
    ctx,
    currentTownId,
    currentAreaId,
    gameState,
    doorSequence,
    type,
    x,
    y,
    tileX,
    tileY,
    (townId, areaId, tx, ty) => worldService.getBuilding(townId, areaId, tx, ty),
    getTileAt
  );
}

function render() {
  renderGameFrame({
    ctx,
    canvas,
    cameraZoom: CAMERA_ZOOM,
    tileSize: TILE,
    spriteFrameWidth: SPRITE_FRAME_WIDTH,
    spriteFrameHeight: SPRITE_FRAME_HEIGHT,
    spriteFramesPerRow: SPRITE_FRAMES_PER_ROW,
    colors: COLORS,
    ui: UI,
    drawTile,
    getHandstandSprite: () => assets.getSprite("protagonist_handstand"),
    drawCustomOverlays: ({ ctx: frameCtx, canvas: frameCanvas, colors: frameColors, ui: frameUi, state: frameState }) => {
      featureCoordinator.renderOverlays({
        ctx: frameCtx,
        canvas: frameCanvas,
        colors: frameColors,
        ui: frameUi,
        state: frameState
      });
    },
    state: {
      currentMap,
      currentMapW,
      currentMapH,
      currentAreaId,
      currentAreaKind: worldService.getAreaKind(currentTownId, currentAreaId),
      gameState,
      doorSequence,
      player,
      npcs,
      cam,
      trainingPopup,
      playerStats,
      playerInventory,
      itemAlert,
      inventoryHint
    },
    dialogue
  });
}

gameController.syncMusicForCurrentArea();

function loop() {
  gameController.update();
  render();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
