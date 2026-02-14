import {
  TILE,
  OVERWORLD_W,
  OVERWORLD_H,
  INTERIOR_W,
  INTERIOR_H,
  CAMERA_ZOOM,
  SPRITE_FRAME_WIDTH,
  SPRITE_FRAME_HEIGHT,
  SPRITE_FRAMES_PER_ROW,
  TILE_TYPES,
  COLORS,
  UI,
  TRAINING
} from "./src/constants.js";
import { AssetManager } from "./src/AssetManager.js";
import { initializeInput, keys, getInteractPressed, clearInteractPressed } from "./src/InputManager.js";
import { collides as collidesAt, collidesWithNPC as collidesWithNPCAt, doorFromCollision as detectDoorCollision } from "./src/CollisionSystem.js";
import { drawTile as drawTileSystem } from "./src/TileSystem.js";
import { DialogueSystem } from "./src/game/DialogueSystem.js";
import { renderGameFrame } from "./src/game/RenderSystem.js";
import { createMovementSystem } from "./src/game/MovementSystem.js";
import { createInteractionSystem } from "./src/game/InteractionSystem.js";
import { createGameController } from "./src/game/GameController.js";
import { createGameRuntime } from "./src/game/bootstrap.js";
import { getBuilding } from "./src/WorldManager.js";
// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const { canvas, ctx, musicManager, state } = createGameRuntime();

const { gameFlags, playerInventory, playerStats, trainingPopup, itemAlert, inventoryHint, npcs, player, cam, doorSequence } = state;
let { currentTownId, currentTown, currentAreaType, currentMap, currentMapW, currentMapH, gameState, previousWorldState } = state;

const movementSystem = createMovementSystem({
  keys,
  tileSize: TILE,
  spriteFramesPerRow: SPRITE_FRAMES_PER_ROW,
  cameraZoom: CAMERA_ZOOM,
  musicManager
});

// ============================================================================
// DIALOGUE SYSTEM
// ============================================================================

const dialogue = new DialogueSystem({ ctx, canvas, ui: UI });
const choiceState = dialogue.choiceState;

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

// ============================================================================
// PLAYER ACTIONS
// ============================================================================

const interactionSystem = createInteractionSystem({
  tileSize: TILE,
  ui: UI,
  training: TRAINING,
  tileTypes: TILE_TYPES,
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
  getBuilding,
  getCurrentTownId: () => currentTownId,
  getCurrentTown: () => currentTown,
  getCurrentAreaType: () => currentAreaType,
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
  getInteractPressed,
  clearInteractPressed
});

const gameController = createGameController({
  world: {
    overworldW: OVERWORLD_W,
    overworldH: OVERWORLD_H,
    interiorW: INTERIOR_W,
    interiorH: INTERIOR_H
  },
  movementSystem,
  collision: {
    collidesAt,
    collidesWithNPCAt,
    detectDoorCollision
  },
  musicManager,
  state: {
    player,
    npcs,
    doorSequence,
    trainingPopup,
    itemAlert,
    inventoryHint,
    cam,
    canvas,
    getCurrentTown: () => currentTown,
    getCurrentAreaType: () => currentAreaType,
    setCurrentAreaType: (areaType) => {
      currentAreaType = areaType;
    },
    setCurrentMapContext: ({ map, width, height }) => {
      currentMap = map;
      currentMapW = width;
      currentMapH = height;
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
    handleInteraction: () => interactionSystem.handleInteraction()
  }
});

// INPUT HANDLING
// ============================================================================

initializeInput();
document.addEventListener("toggleInventory", () => {
  interactionSystem.toggleInventory();
});

addEventListener("keydown", (e) => {
  if (!choiceState.active) return;

  if (!e.repeat && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
    const direction = e.key === "ArrowUp" ? -1 : 1;
    const total = choiceState.options.length;
    choiceState.selected = (choiceState.selected + direction + total) % total;
  }

  if (e.key === "Enter" && !e.repeat) {
    confirmChoice();
    clearInteractPressed();
  }
});

// ============================================================================
// RENDERING SYSTEM
// ============================================================================

function drawTile(type, x, y, tileX, tileY) {
  drawTileSystem(ctx, currentTownId, gameState, doorSequence, type, x, y, tileX, tileY);
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
    getHandstandSprite: () => AssetManager.getSprite("protagonist_handstand"),
    state: {
      currentMap,
      currentMapW,
      currentMapH,
      currentAreaType,
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

// ============================================================================
// GAME LOOP
// ============================================================================


gameController.syncMusicForCurrentArea();
function loop() {
  gameController.update();
  render();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);