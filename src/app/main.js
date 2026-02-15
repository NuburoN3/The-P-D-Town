import {
  TILE,
  CAMERA_ZOOM,
  SPRITE_FRAME_WIDTH,
  SPRITE_FRAME_HEIGHT,
  SPRITE_FRAMES_PER_ROW,
  COLORS,
  UI,
  TRAINING,
  GAME_STATES,
  isFreeExploreState
} from "../core/constants.js";
import { InputManager } from "../core/InputManager.js";
import { CollisionService } from "../core/CollisionSystem.js";
import { drawTile as drawTileSystem } from "../rendering/TileSystem.js";
import { DialogueSystem } from "../game/DialogueSystem.js";
import { renderGameFrame } from "../game/RenderSystem.js";
import { createMovementSystem } from "../game/MovementSystem.js";
import { createInteractionSystem } from "../game/InteractionSystem.js";
import { createGameController } from "../game/GameController.js";
import { createBarMinigameSystem } from "../game/BarMinigameSystem.js";
import { createGameRuntime } from "../game/bootstrap.js";

const { canvas, ctx, assets, worldService, musicManager, state } = createGameRuntime();

const {
  gameFlags,
  playerInventory,
  playerStats,
  trainingPopup,
  itemAlert,
  inventoryHint,
  barMinigame,
  npcs,
  player,
  cam,
  doorSequence
} = state;

let { currentTownId, currentAreaId, currentMap, currentMapW, currentMapH, gameState, previousWorldState } = state;

let previousGameState = GAME_STATES.OVERWORLD;

let interactionSystem = null;
const input = new InputManager({
  onToggleInventory: () => {
    if (interactionSystem) {
      interactionSystem.toggleInventory();
    }
  },
  shouldHandleInput: () => !(gameState === GAME_STATES.PAUSE_MENU || gameState === GAME_STATES.INVENTORY || gameState === GAME_STATES.ATTRIBUTES || gameState === GAME_STATES.SETTINGS)
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
const pauseMenuState = { active: false, selected: 0, options: ['Inventory', 'Attributes', 'Settings', 'Quit'] };
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

const barMinigameSystem = createBarMinigameSystem({
  state: barMinigame,
  getCurrentAreaKind: () => worldService.getAreaKind(currentTownId, currentAreaId),
  setGameState: (nextState) => {
    gameState = nextState;
  },
  showDialogue
});

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
  pauseMenuState,
  showDialogue,
  openYesNoChoice,
  closeDialogue: () => dialogue.close(),
  advanceDialogue,
  getInteractPressed: () => input.getInteractPressed(),
  clearInteractPressed: () => input.clearInteractPressed(),
  startBarMinigame: (options) => barMinigameSystem.start(options),
  handleBarMinigameInteract: () => barMinigameSystem.handleInteract()
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
    updateBarMinigame: () => barMinigameSystem.update()
  }
});

input.initialize();

addEventListener("keydown", (e) => {
  if (!choiceState.active) return;

  if (!e.repeat && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "w" || e.key === "s")) {
    const direction = (e.key === "ArrowUp" || e.key === "w") ? -1 : 1;
    const total = choiceState.options.length;
    choiceState.selected = (choiceState.selected + direction + total) % total;
  }

  if (e.key === " " && !e.repeat) {
    confirmChoice();
    input.clearInteractPressed();
  }
});

addEventListener("keydown", (e) => {
  if (choiceState.active) return;
  if (gameState === GAME_STATES.PAUSE_MENU) {
    e.preventDefault();
    if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "w" || e.key === "s") {
      const direction = (e.key === "ArrowUp" || e.key === "w") ? -1 : 1;
      const total = 4; // options length
      pauseMenuState.selected = (pauseMenuState.selected + direction + total) % total;
    }
    if (e.key === " " && !e.repeat) {
      const options = ['Inventory', 'Attributes', 'Settings', 'Quit'];
      const selected = options[pauseMenuState.selected];
      if (selected === 'Inventory') {
        gameState = GAME_STATES.INVENTORY;
      } else if (selected === 'Attributes') {
        gameState = GAME_STATES.ATTRIBUTES;
      } else if (selected === 'Settings') {
        gameState = GAME_STATES.SETTINGS;
      } else if (selected === 'Quit') {
        if (confirm('Quit game?')) {
          window.location.reload();
        }
      }
    }
    return;
  }
  if (gameState === GAME_STATES.INVENTORY || gameState === GAME_STATES.ATTRIBUTES || gameState === GAME_STATES.SETTINGS) {
    if (e.key === "Enter" && !e.repeat) {
      gameState = GAME_STATES.PAUSE_MENU;
      e.preventDefault();
    }
    return;
  }
  if (e.key === "Enter" && !e.repeat) {
    if (gameState === GAME_STATES.PAUSE_MENU) {
      gameState = previousGameState;
    } else if (isFreeExploreState(gameState)) {
      previousGameState = gameState;
      gameState = GAME_STATES.PAUSE_MENU;
    }
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
      inventoryHint,
      barMinigame
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
