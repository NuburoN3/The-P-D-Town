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
  TILE_TYPES,
  isFreeExploreState
} from "../core/constants.js";
import { InputManager } from "../core/InputManager.js";
import { CollisionService } from "../core/CollisionSystem.js";
import { loadGameSnapshot, loadUserSettings, saveGameSnapshot, saveUserSettings } from "../core/Persistence.js";
import { DialogueSystem } from "../game/DialogueSystem.js";
import { createMovementSystem } from "../game/MovementSystem.js";
import { createInteractionSystem } from "../game/InteractionSystem.js";
import { createGameController } from "../game/GameController.js";
import { createGameRuntime } from "../game/bootstrap.js";
import { createCombatSystem } from "../game/CombatSystem.js";
import { createEnemyAISystem } from "../game/EnemyAISystem.js";
import { createVfxSystem } from "../game/VfxSystem.js";
import { createGameFeatures } from "../game/features/index.js";
import { createFeatureCoordinator } from "../game/features/FeatureCoordinator.js";
import { createFountainHealingSystem } from "../game/FountainHealingSystem.js";
import { createChallengeSystem } from "../game/ChallengeSystem.js";
import { createDefeatSequenceSystem } from "../game/DefeatSequenceSystem.js";
import { createTitleScreenSystem } from "../game/TitleScreenSystem.js";
import { createPauseMenuSystem } from "../game/PauseMenuSystem.js";
import { buildGameSnapshot, applyGameSnapshot } from "../game/SaveLoadService.js";
import { createInputController } from "../game/InputController.js";
import { createWorldStateHandlers, createRuntimeStateHandlers } from "./stateHandlers.js";
import { createGameLoop } from "./gameLoop.js";
import { createSaveLoadCoordinator } from "./saveLoadCoordinator.js";
import { createGameRenderer } from "./gameRenderer.js";
import { createInputBindings } from "./inputBindings.js";
import { createMenuStateController } from "./menuStateController.js";

const { canvas, ctx, assets, worldService, musicManager, state } = createGameRuntime();

const {
  gameFlags,
  playerInventory,
  playerStats,
  trainingPopup,
  itemAlert,
  inventoryHint,
  npcs,
  enemies,
  player,
  cam,
  doorSequence,
  playerDefeatSequence
} = state;

const TITLE_SCREEN_MUSIC_KEY = "__title_screen_music__";
const TITLE_SCREEN_MUSIC_SRC = "assets/sprites/StartScreen_Audio.wav";
musicManager.registerAreaTrack(TITLE_SCREEN_MUSIC_KEY, TITLE_SCREEN_MUSIC_SRC);

let { currentTownId, currentAreaId, currentMap, currentMapW, currentMapH, gameState, previousWorldState } = state;

let previousGameState = GAME_STATES.OVERWORLD;
let gameController = null;
const getCurrentTownId = () => currentTownId;
const getCurrentAreaId = () => currentAreaId;
const getCurrentMap = () => currentMap;
const getCurrentMapW = () => currentMapW;
const getCurrentMapH = () => currentMapH;
const getGameState = () => gameState;
const getPreviousGameState = () => previousGameState;
const getGameController = () => gameController;
const setGameState = (nextState) => {
  gameState = nextState;
};
const setPreviousWorldState = (nextState) => {
  previousWorldState = nextState;
};
const setPreviousGameState = (nextState) => {
  previousGameState = nextState;
};
const mouseUiState = {
  x: 0,
  y: 0,
  insideCanvas: false
};
let menuStateController = null;
const openPauseMenu = () => {
  if (menuStateController) menuStateController.openPauseMenu();
};
const resumeFromPauseMenu = () => {
  if (menuStateController) menuStateController.resumeFromPauseMenu();
};
const returnToPauseMenu = () => {
  if (menuStateController) menuStateController.returnToPauseMenu();
};

const userSettings = loadUserSettings();
// settingsUiState moved to PauseMenuSystem

const SETTINGS_ITEMS = Object.freeze([
  { id: "highContrastMenu", kind: "toggle", label: "High Contrast Menu" },
  { id: "screenShake", kind: "toggle", label: "Screen Shake" },
  { id: "reducedFlashes", kind: "toggle", label: "Reduced Flashes" },
  { id: "textSpeedMultiplier", kind: "cycle", label: "Text Speed", values: [0.75, 1, 1.25, 1.5, 2] },
  { id: "bind.moveUp", kind: "rebind", label: "Bind Move Up", action: "moveUp" },
  { id: "bind.moveDown", kind: "rebind", label: "Bind Move Down", action: "moveDown" },
  { id: "bind.moveLeft", kind: "rebind", label: "Bind Move Left", action: "moveLeft" },
  { id: "bind.moveRight", kind: "rebind", label: "Bind Move Right", action: "moveRight" },
  { id: "bind.interact", kind: "rebind", label: "Bind Interact", action: "interact" },
  { id: "bind.attack", kind: "rebind", label: "Bind Attack", action: "attack" },
  { id: "bind.inventory", kind: "rebind", label: "Bind Inventory", action: "inventory" },
  { id: "bind.pause", kind: "rebind", label: "Bind Pause", action: "pause" },
  { id: "saveGame", kind: "action", label: "Save Game" },
  { id: "loadGame", kind: "action", label: "Load Game" }
]);

let interactionSystem = null;
const input = new InputManager({
  keyBindings: userSettings.keybindings,
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
    gameState === GAME_STATES.SETTINGS ||
    gameState === GAME_STATES.PLAYER_DEFEATED
  )
});

const collisionService = new CollisionService({ tileSize: TILE });

const movementSystem = createMovementSystem({
  keys: input.keys,
  getActionPressed: (action) => input.isActionPressed(action),
  tileSize: TILE,
  spriteFramesPerRow: SPRITE_FRAMES_PER_ROW,
  cameraZoom: CAMERA_ZOOM,
  musicManager
});

const dialogue = new DialogueSystem({ ctx, canvas, ui: UI });
const choiceState = dialogue.choiceState;
const pauseMenuSystem = createPauseMenuSystem({
  musicManager,
  canvas,
  settingsItems: [...SETTINGS_ITEMS],
  userSettings,
  loadUserSettings,
  persistUserSettings,
  setSettingsStatus
});
const pauseMenuState = pauseMenuSystem.state;
const settingsUiState = pauseMenuState.settingsUiState;

const trainingContent = worldService.getTrainingContent();
const vfxSystem = createVfxSystem();
dialogue.setTextSpeedMultiplier(userSettings.textSpeedMultiplier);

const combatFeedback = {
  hitstopUntil: 0,
  shakeUntil: 0,
  shakeMagnitude: 0,
  lastEnemyTelegraphAt: 0
};

function persistUserSettings() {
  saveUserSettings({
    ...userSettings,
    highContrastMenu: pauseMenuState.highContrast,
    keybindings: input.getBindings()
  });
}

function setSettingsStatus(text, durationMs = 1700) {
  settingsUiState.statusText = text;
  settingsUiState.statusUntil = performance.now() + durationMs;
}

function getSaveLoadContext() {
  return {
    worldService,
    collisionService,
    player,
    npcs,
    enemies,
    camera: cam,
    gameFlags,
    playerStats,
    playerInventory,
    currentGameState: gameState,
    townId: currentTownId,
    areaId: currentAreaId
  };
}

const {
  performSaveGame,
  performLoadGame,
  performStartNewGame,
  applyTitlePreviewSnapshot
} = createSaveLoadCoordinator({
  buildGameSnapshot,
  applyGameSnapshot,
  loadGameSnapshot,
  saveGameSnapshot,
  getSaveLoadContext,
  applyWorldState: (nextWorldState) => {
    currentTownId = nextWorldState.townId;
    currentAreaId = nextWorldState.areaId;
    currentMap = nextWorldState.map;
    currentMapW = nextWorldState.width;
    currentMapH = nextWorldState.height;
  },
  applyGameState: (nextGameState) => {
    gameState = nextGameState;
    previousWorldState = nextGameState;
    previousGameState = nextGameState;
  },
  getGameController,
  setSettingsStatus,
  musicManager
});

applyTitlePreviewSnapshot();

const { isConditionallyHiddenDoor, getRespawnDestination } = createWorldStateHandlers({
  worldService,
  tileSize: TILE,
  gameFlags,
  getCurrentTownId,
  getCurrentAreaId
});

const gameplayStartState = gameState;
const titleScreenSystem = createTitleScreenSystem({ tileSize: TILE, cameraZoom: CAMERA_ZOOM, musicManager, canvas });
// Use system state for rendering access
const titleState = titleScreenSystem.state;
gameState = GAME_STATES.TITLE_SCREEN;

// Fountain healing / challenge / defeat systems (created after vfxSystem above)
const fountainHealSystem = createFountainHealingSystem({ tileSize: TILE, worldService, vfxSystem });
const challengeSystem = createChallengeSystem({ tileSize: TILE, vfxSystem });
const defeatSequenceSystem = createDefeatSequenceSystem({
  tileSize: TILE,
  vfxSystem,
  getRespawnDestination,
  worldService
});

const {
  isDialogueActive,
  updatePlayerDefeatSequence,
  handleChallengeEnemyDefeat,
  handlePlayerDefeated,
  handleCombatHitConfirmed,
  updateTitleScreen,
  canRunCombatSystems,
  updateFountainHealing,
  prepareChallengeEnemies
} = createRuntimeStateHandlers({
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
});

const combatSystem = createCombatSystem({
  tileSize: TILE,
  eventHandlers: {
    onRequestVfx: (type, options) => vfxSystem.spawn(type, options),
    onPlayerAttackStarted: () => {
      musicManager.playSfx("attackSwing");
    },
    onHitConfirmed: (event) => {
      handleCombatHitConfirmed(event);
    },
    onEntityDefeated: (enemy, now) => {
      handleChallengeEnemyDefeat(enemy, now);
    },
    onPlayerDefeated: ({ player: defeatedPlayer }) => {
      handlePlayerDefeated({ player: defeatedPlayer });
    }
  }
});

const enemyAiSystem = createEnemyAISystem({
  tileSize: TILE,
  eventHandlers: {
    onEnemyAttackWindupStarted: ({ enemy, now }) => {
      if (now - combatFeedback.lastEnemyTelegraphAt > 120) {
        musicManager.playSfx("enemyTelegraph");
        combatFeedback.lastEnemyTelegraphAt = now;
      }
      vfxSystem.spawn("warningRing", {
        x: enemy.x + TILE * 0.5,
        y: enemy.y + TILE * 0.5,
        size: TILE * 0.8,
        durationMs: Math.max(180, enemy.attackWindupMs)
      });
    }
  }
});
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

function clearMenuHoverState() {
  pauseMenuState.hovered = -1;
  titleState.hovered = -1;
}

function updateMenuHoverStateFromMouse(mouseX, mouseY) {
  clearMenuHoverState();
  if (!mouseUiState.insideCanvas) return;
  if (gameState === GAME_STATES.PAUSE_MENU) {
    pauseMenuSystem.handleMouseMove(mouseX, mouseY);
    return;
  }
  if (gameState === GAME_STATES.TITLE_SCREEN) {
    titleScreenSystem.handleMouseMove(mouseX, mouseY);
  }
}

function handlePauseMenuLeftClick(mouseX, mouseY) {
  if (gameState !== GAME_STATES.PAUSE_MENU) return false;

  return pauseMenuSystem.handleClick(mouseX, mouseY, {
    onResume: resumeFromPauseMenu,
    onSave: performSaveGame,
    onLoad: performLoadGame,
    onQuit: () => {
      location.reload();
    }
  });
}

function handleTitleLeftClick(mouseX, mouseY) {
  if (gameState !== GAME_STATES.TITLE_SCREEN) return false;

  return titleScreenSystem.handleClick(mouseX, mouseY, {
    onStartGame: () => {
      performStartNewGame();
    },
    onContinueGame: () => {
      performLoadGame();
    }
  });
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

gameController = createGameController({
  movementSystem,
  collision: {
    collidesAt: (...args) => {
      const collides = collisionService.collides(...args);
      if (!collides) return false;

      // Keep conditionally-hidden door tiles passable
      const doorTile = collisionService.doorFromCollision(...args);
      if (doorTile && isConditionallyHiddenDoor(doorTile.tx, doorTile.ty)) {
        return false;
      }

      return true;
    },
    collidesWithNPCAt: (...args) => collisionService.collidesWithNPC(...args),
    detectDoorCollision: (...args) => {
      const doorTile = collisionService.doorFromCollision(...args);
      if (!doorTile) return null;
      if (isConditionallyHiddenDoor(doorTile.tx, doorTile.ty)) {
        return null;
      }
      return doorTile;
    }
  },
  musicManager,
  worldService,
  levelUpMessage: TRAINING.LEVEL_UP_MESSAGE,
  state: {
    player,
    npcs,
    enemies,
    doorSequence,
    playerDefeatSequence,
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
    reloadTownEnemies: (townId) => {
      const nextTownEnemies = worldService.createEnemiesForTown(townId);
      enemies.splice(0, enemies.length, ...nextTownEnemies);
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

const inputController = createInputController({
  inputManager: input,
  titleScreenSystem,
  pauseMenuSystem,
  getGameState: () => gameState,
  actions: {
    titleCallbacks: {
      onStartGame: performStartNewGame,
      onContinueGame: performLoadGame
    },
    onResume: resumeFromPauseMenu,
    onSave: performSaveGame,
    onLoad: performLoadGame,
    onQuit: () => location.reload(),
    openPauseMenu,
    closePauseMenu: returnToPauseMenu,
    canRunCombatSystems
  }
});

const { syncPointerLockWithState, register: registerInputBindings } = createInputBindings({
  canvas,
  mouseUiState,
  getGameState,
  gameStates: GAME_STATES,
  input,
  inputManagerClass: InputManager,
  choiceState,
  confirmChoice,
  settingsUiState,
  setSettingsStatus,
  musicManager,
  persistUserSettings,
  titleScreenSystem,
  pauseMenuSystem,
  performSaveGame,
  performStartNewGame,
  performLoadGame,
  resumeFromPauseMenu,
  returnToPauseMenu,
  openPauseMenu,
  isFreeExploreState,
  updateMenuHoverStateFromMouse,
  clearMenuHoverState,
  handleTitleLeftClick,
  handlePauseMenuLeftClick
});

menuStateController = createMenuStateController({
  gameStates: GAME_STATES,
  isFreeExploreState,
  getGameState,
  setGameState,
  getPreviousGameState,
  setPreviousGameState,
  pauseMenuState,
  syncPointerLockWithState,
  musicManager
});

registerInputBindings();

const { render } = createGameRenderer({
  ctx,
  canvas,
  assets,
  worldService,
  featureCoordinator,
  dialogue,
  cam,
  combatFeedback,
  userSettings,
  isFreeExploreState,
  tileTypes: TILE_TYPES,
  cameraZoom: CAMERA_ZOOM,
  tileSize: TILE,
  spriteFrameWidth: SPRITE_FRAME_WIDTH,
  spriteFrameHeight: SPRITE_FRAME_HEIGHT,
  spriteFramesPerRow: SPRITE_FRAMES_PER_ROW,
  colors: COLORS,
  ui: UI,
  doorSequence,
  titleState,
  playerDefeatSequence,
  player,
  npcs,
  enemies,
  gameFlags,
  input,
  settingsUiState,
  settingsItems: SETTINGS_ITEMS,
  trainingPopup,
  playerStats,
  playerInventory,
  itemAlert,
  inventoryHint,
  pauseMenuState,
  mouseUiState,
  vfxSystem,
  getCurrentTownId,
  getCurrentAreaId,
  getCurrentMap,
  getCurrentMapW,
  getCurrentMapH,
  getGameState,
  isConditionallyHiddenDoor
});

if (gameState === GAME_STATES.TITLE_SCREEN) {
  musicManager.playMusicForArea(TITLE_SCREEN_MUSIC_KEY);
} else {
  gameController.syncMusicForCurrentArea();
}

const { startLoop } = createGameLoop({
  gameStates: GAME_STATES,
  getGameState,
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
  player,
  getCurrentAreaId,
  getCurrentMap,
  getCurrentMapW,
  getCurrentMapH,
  collisionService,
  combatSystem,
  input,
  updateFountainHealing,
  vfxSystem,
  render
});

startLoop();

