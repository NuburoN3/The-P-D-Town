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
import { createGameRuntime } from "../game/bootstrap.js";
import { createVfxSystem } from "../game/VfxSystem.js";
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

let previousGameState = GAME_STATES.OVERWORLD;

let interactionSystem = null;
const input = new InputManager({
  onToggleInventory: () => {
    if (interactionSystem) {
      interactionSystem.toggleInventory();
    }
  },
  shouldHandleInput: () => !(
    gameState === GAME_STATES.TITLE_SCREEN ||
    gameState === GAME_STATES.PAUSE_MENU ||
    gameState === GAME_STATES.INVENTORY ||
    gameState === GAME_STATES.ATTRIBUTES ||
    gameState === GAME_STATES.SETTINGS
  )
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
const pauseMenuState = {
  active: false,
  selected: 0,
  options: ["Inventory", "Attributes", "Settings", "Quit"],
  highContrast: false,
  animationMode: "idle",
  animationStartedAt: 0,
  animationDurationMs: 170
};
const gamepadMenuState = {
  nextMoveAt: 0,
  heldDirection: 0,
  confirmHeld: false,
  backHeld: false,
  startHeld: false
};
const trainingContent = worldService.getTrainingContent();
const vfxSystem = createVfxSystem();
const gameplayStartState = gameState;
const titleState = {
  startedAt: performance.now(),
  selected: 0,
  options: ["Start Journey", "How To Play"],
  showHowTo: false,
  fadeOutActive: false,
  fadeOutStartedAt: 0,
  fadeOutDurationMs: 720,
  promptPulseOffset: Math.random() * 1000
};
gameState = GAME_STATES.TITLE_SCREEN;

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

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function moveTitleSelection(direction) {
  const total = titleState.options.length;
  titleState.selected = (titleState.selected + direction + total) % total;
  musicManager.playSfx("menuMove");
}

function confirmTitleSelection() {
  if (titleState.selected === 1) {
    titleState.showHowTo = !titleState.showHowTo;
    musicManager.playSfx("menuSelect");
    return;
  }

  titleState.fadeOutActive = true;
  titleState.fadeOutStartedAt = performance.now();
  titleState.showHowTo = false;
  vfxSystem.spawn("pickupGlow", {
    x: player.x + TILE / 2,
    y: player.y + TILE * 0.3,
    size: 40,
    durationMs: 620
  });
  musicManager.playSfx("menuConfirm");
}

function updateTitleScreen(now) {
  const worldW = currentMapW * TILE;
  const worldH = currentMapH * TILE;
  const visibleW = canvas.width / CAMERA_ZOOM;
  const visibleH = canvas.height / CAMERA_ZOOM;

  const baseX = player.x - visibleW * 0.5;
  const baseY = player.y - visibleH * 0.5;
  const seconds = (now - titleState.startedAt) / 1000;
  const driftX = Math.sin(seconds * 0.33) * TILE * 2.4;
  const driftY = Math.cos(seconds * 0.27) * TILE * 1.6;

  const minX = Math.min(0, worldW - visibleW);
  const maxX = Math.max(0, worldW - visibleW);
  const minY = Math.min(0, worldH - visibleH);
  const maxY = Math.max(0, worldH - visibleH);

  cam.x = clamp(baseX + driftX, minX, maxX);
  cam.y = clamp(baseY + driftY, minY, maxY);

  if (!titleState.fadeOutActive) return;

  const elapsed = now - titleState.fadeOutStartedAt;
  if (elapsed >= titleState.fadeOutDurationMs) {
    titleState.fadeOutActive = false;
    gameState = gameplayStartState;
    previousWorldState = gameplayStartState;
    previousGameState = gameplayStartState;
  }
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
  pauseMenuState,
  showDialogue,
  openYesNoChoice,
  advanceDialogue,
  getInteractPressed: () => input.getInteractPressed(),
  clearInteractPressed: () => input.clearInteractPressed(),
  spawnVisualEffect: (type, options) => vfxSystem.spawn(type, options),
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

function setPauseMenuAnimation(mode, durationMs = 170) {
  pauseMenuState.animationMode = mode;
  pauseMenuState.animationStartedAt = performance.now();
  pauseMenuState.animationDurationMs = durationMs;
}

function openPauseMenu() {
  if (!isFreeExploreState(gameState)) return;
  previousGameState = gameState;
  gameState = GAME_STATES.PAUSE_MENU;
  setPauseMenuAnimation("in", 170);
  musicManager.pauseForPauseMenu();
  musicManager.playSfx("menuOpen");
}

function resumeFromPauseMenu() {
  setPauseMenuAnimation("out", 140);
  gameState = previousGameState;
  musicManager.resumeFromPauseMenu();
  musicManager.playSfx("menuConfirm");
}

function returnToPauseMenu() {
  gameState = GAME_STATES.PAUSE_MENU;
  setPauseMenuAnimation("in", 130);
  musicManager.pauseForPauseMenu();
  musicManager.playSfx("menuOpen");
}

function movePauseMenuSelection(direction) {
  const total = pauseMenuState.options.length;
  pauseMenuState.selected = (pauseMenuState.selected + direction + total) % total;
  musicManager.playSfx("menuMove");
}

function toggleHighContrastMenu() {
  pauseMenuState.highContrast = !pauseMenuState.highContrast;
  musicManager.playSfx("menuConfirm");
}

function selectPauseMenuOption() {
  const selected = pauseMenuState.options[pauseMenuState.selected];
  musicManager.playSfx("menuSelect");

  if (selected === "Inventory") {
    setPauseMenuAnimation("out", 140);
    gameState = GAME_STATES.INVENTORY;
  } else if (selected === "Attributes") {
    setPauseMenuAnimation("out", 140);
    gameState = GAME_STATES.ATTRIBUTES;
  } else if (selected === "Settings") {
    setPauseMenuAnimation("out", 140);
    gameState = GAME_STATES.SETTINGS;
  } else if (selected === "Quit") {
    if (confirm("Quit game?")) {
      window.location.reload();
    }
  }
}

function resetGamepadHeldStates() {
  gamepadMenuState.heldDirection = 0;
  gamepadMenuState.confirmHeld = false;
  gamepadMenuState.backHeld = false;
  gamepadMenuState.startHeld = false;
}

function handleGamepadPauseAndMenuInput(now) {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return;
  const gamepads = navigator.getGamepads();
  const pad = Array.from(gamepads || []).find((candidate) => candidate && candidate.connected);
  if (!pad) {
    resetGamepadHeldStates();
    return;
  }

  const buttons = pad.buttons || [];
  const axisY = Array.isArray(pad.axes) && pad.axes.length > 1 ? pad.axes[1] : 0;
  const upPressed = Boolean(buttons[12]?.pressed) || axisY < -0.58;
  const downPressed = Boolean(buttons[13]?.pressed) || axisY > 0.58;
  const direction = upPressed ? -1 : downPressed ? 1 : 0;

  const confirmPressed = Boolean(buttons[0]?.pressed); // A
  const backPressed = Boolean(buttons[1]?.pressed); // B
  const startPressed = Boolean(buttons[9]?.pressed); // Start

  if (gameState === GAME_STATES.TITLE_SCREEN) {
    if (direction !== 0 && (direction !== gamepadMenuState.heldDirection || now >= gamepadMenuState.nextMoveAt)) {
      moveTitleSelection(direction);
      gamepadMenuState.heldDirection = direction;
      gamepadMenuState.nextMoveAt = now + 170;
    } else if (direction === 0) {
      gamepadMenuState.heldDirection = 0;
    }

    if ((confirmPressed || startPressed) && !gamepadMenuState.confirmHeld) {
      confirmTitleSelection();
    }

    if (backPressed && !gamepadMenuState.backHeld) {
      titleState.showHowTo = false;
      musicManager.playSfx("menuConfirm");
    }

    gamepadMenuState.confirmHeld = confirmPressed || startPressed;
    gamepadMenuState.backHeld = backPressed;
    gamepadMenuState.startHeld = startPressed;
    return;
  }

  if (gameState === GAME_STATES.PAUSE_MENU) {
    if (direction !== 0 && (direction !== gamepadMenuState.heldDirection || now >= gamepadMenuState.nextMoveAt)) {
      movePauseMenuSelection(direction);
      gamepadMenuState.heldDirection = direction;
      gamepadMenuState.nextMoveAt = now + 145;
    } else if (direction === 0) {
      gamepadMenuState.heldDirection = 0;
    }

    if (confirmPressed && !gamepadMenuState.confirmHeld) {
      selectPauseMenuOption();
    }

    if ((backPressed && !gamepadMenuState.backHeld) || (startPressed && !gamepadMenuState.startHeld)) {
      resumeFromPauseMenu();
    }

    gamepadMenuState.confirmHeld = confirmPressed;
    gamepadMenuState.backHeld = backPressed;
    gamepadMenuState.startHeld = startPressed;
    return;
  }

  gamepadMenuState.heldDirection = 0;

  if (gameState === GAME_STATES.SETTINGS) {
    if (confirmPressed && !gamepadMenuState.confirmHeld) {
      toggleHighContrastMenu();
    }
    if ((backPressed && !gamepadMenuState.backHeld) || (startPressed && !gamepadMenuState.startHeld)) {
      returnToPauseMenu();
    }
  } else if (gameState === GAME_STATES.INVENTORY || gameState === GAME_STATES.ATTRIBUTES) {
    if (
      (confirmPressed && !gamepadMenuState.confirmHeld) ||
      (backPressed && !gamepadMenuState.backHeld) ||
      (startPressed && !gamepadMenuState.startHeld)
    ) {
      returnToPauseMenu();
    }
  } else if (isFreeExploreState(gameState)) {
    if (startPressed && !gamepadMenuState.startHeld) {
      openPauseMenu();
    }
  }

  gamepadMenuState.confirmHeld = confirmPressed;
  gamepadMenuState.backHeld = backPressed;
  gamepadMenuState.startHeld = startPressed;
}

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
  const key = e.key.toLowerCase();

  if (gameState === GAME_STATES.TITLE_SCREEN) {
    if (!e.repeat && (key === "arrowup" || key === "w")) {
      moveTitleSelection(-1);
      e.preventDefault();
      return;
    }
    if (!e.repeat && (key === "arrowdown" || key === "s")) {
      moveTitleSelection(1);
      e.preventDefault();
      return;
    }
    if (!e.repeat && (key === " " || key === "enter")) {
      confirmTitleSelection();
      e.preventDefault();
      return;
    }
    if (!e.repeat && key === "escape") {
      titleState.showHowTo = false;
      musicManager.playSfx("menuConfirm");
      e.preventDefault();
      return;
    }
    return;
  }

  if (gameState === GAME_STATES.PAUSE_MENU) {
    e.preventDefault();
    if (!e.repeat && (key === "arrowup" || key === "arrowdown" || key === "w" || key === "s")) {
      const direction = (key === "arrowup" || key === "w") ? -1 : 1;
      movePauseMenuSelection(direction);
    }
    if ((key === "enter" || key === "escape") && !e.repeat) {
      resumeFromPauseMenu();
      return;
    }
    if (key === " " && !e.repeat) {
      selectPauseMenuOption();
    }
    return;
  }

  if (gameState === GAME_STATES.SETTINGS) {
    if (key === " " && !e.repeat) {
      toggleHighContrastMenu();
      e.preventDefault();
    } else if ((key === "enter" || key === "escape") && !e.repeat) {
      returnToPauseMenu();
      e.preventDefault();
    }
    return;
  }

  if (gameState === GAME_STATES.INVENTORY || gameState === GAME_STATES.ATTRIBUTES) {
    if ((key === "enter" || key === "escape") && !e.repeat) {
      returnToPauseMenu();
      e.preventDefault();
    }
    return;
  }

  if ((key === "enter" || key === "escape") && !e.repeat && isFreeExploreState(gameState)) {
    openPauseMenu();
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
      getBuildingAtWorldTile: (tx, ty) => worldService.getBuilding(currentTownId, currentAreaId, tx, ty),
      moodPreset: worldService.getAreaMoodPreset(currentTownId, currentAreaId),
      currentAreaId,
      currentAreaKind: worldService.getAreaKind(currentTownId, currentAreaId),
      gameState,
      titleState,
      doorSequence,
      player,
      npcs,
      cam,
      vfxEffects: vfxSystem.effects,
      trainingPopup,
      playerStats,
      playerInventory,
      itemAlert,
      inventoryHint,
      pauseMenuState
    },
    dialogue
  });
}

gameController.syncMusicForCurrentArea();

function loop() {
  const now = performance.now();
  handleGamepadPauseAndMenuInput(now);

  if (gameState === GAME_STATES.TITLE_SCREEN) {
    updateTitleScreen(now);
  } else {
    gameController.update();
  }

  vfxSystem.update(now);
  render();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
