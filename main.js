import { AudioManager } from "./music-manager.js";
import {
  TILE,
  OVERWORLD_W,
  OVERWORLD_H,
  INTERIOR_W,
  INTERIOR_H,
  PLAYER_SPRITE_HEIGHT_TILES,
  CAMERA_ZOOM,
  SPRITE_FRAME_WIDTH,
  SPRITE_FRAME_HEIGHT,
  SPRITE_FRAMES_PER_ROW,
  TILE_TYPES,
  COLORS,
  UI,
  TRAINING
} from "./src/constants.js";
import { AssetManager, initializeAssets } from "./src/AssetManager.js";
import { initializeInput, keys, getInteractPressed, clearInteractPressed } from "./src/InputManager.js";
import { collides as collidesAt, collidesWithNPC as collidesWithNPCAt, doorFromCollision as detectDoorCollision } from "./src/CollisionSystem.js";
import { drawTile as drawTileSystem } from "./src/TileSystem.js";
import { DialogueSystem } from "./src/game/DialogueSystem.js";
import { renderGameFrame } from "./src/game/RenderSystem.js";
import { createMovementSystem } from "./src/game/MovementSystem.js";
import { createInteractionSystem } from "./src/game/InteractionSystem.js";
import {
  initializeBuildingRenderers,
  initializeTowns,
  townDefinitions,
  getBuilding,
  createNPCsForTown
} from "./src/WorldManager.js";
// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Initialize building renderers with canvas context and constants
initializeBuildingRenderers(ctx, TILE, COLORS);

// ============================================================================
// ASSET MANAGER
// ============================================================================

initializeAssets();

initializeTowns();

// Create WAV audio data URLs for synthetic sound effects
// Walking sound - subtle 80Hz tone
const WALKING_WAV = "walking_sound.wav";

// Collision sound - brief white noise burst  
const COLLISION_WAV = "collision_sound.wav";

const musicManager = new AudioManager({
  areaTracks: {
    // Play dojo music only when inside the hanamiDojo interior
    hanamiDojo: "Hanami_Game_Audio_BG.wav"
  },
  sfxTracks: {
    enterDoor: "EnterDoor_Sound.wav",
    itemUnlock: "Item_Unlock.wav",
    walking: WALKING_WAV,
    collision: COLLISION_WAV
  },
  fadeDurationMs: 800
});
musicManager.attachUnlockHandlers();

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const gameFlags = {
  acceptedTraining: false,
  completedTraining: false
};

const playerInventory = {};

const playerStats = {
  disciplineLevel: 1,
  disciplineXP: 0,
  disciplineXPNeeded: TRAINING.INITIAL_XP_NEEDED
};

const trainingPopup = {
  active: false,
  startedAt: 0,
  durationMs: TRAINING.DURATION_MS,
  startXP: 0,
  targetXP: 0,
  xpGained: 0,
  xpNeededSnapshot: 0,
  animDurationMs: TRAINING.ANIM_DURATION_MS,
  levelUp: false,
  levelUpHoldMs: TRAINING.LEVEL_UP_HOLD_MS,
  pendingLevelUpDialogueAt: null
};

// Item / notification state
let itemAlert = {
  active: false,
  text: "",
  startedAt: 0,
  durationMs: 3000
};

let inventoryHint = {
  active: false,
  startedAt: 0,
  durationMs: 4500
};

// ============================================================================
// MAP & WORLD DATA
// ============================================================================

// Initialize current town and area
let currentTownId = 'hanamiTown';
let currentTown = townDefinitions[currentTownId];
let currentAreaType = 'overworld'; // 'overworld' or an interiorId like 'hanamiDojo'
let currentMap = currentTown.overworldMap;
let currentMapW = OVERWORLD_W;
let currentMapH = OVERWORLD_H;

// ============================================================================
// ASSETS & NPCs
// ============================================================================

const npcs = createNPCsForTown(currentTownId, {
  tileSize: TILE,
  getSprite: (name) => AssetManager.getSprite(name)
});

// ============================================================================
// WORLD & GAME STATE
// ============================================================================

let gameState = "overworld";
let previousWorldState = "overworld";

const player = {
  x: 15 * TILE,
  y: 18 * TILE,
  speed: 2.2,
  dir: "down",
  walking: false,
  frame: 0,
  animTimer: 0,
  animFrame: 1,
  sprite: AssetManager.getSprite('protagonist'),
  desiredHeightTiles: PLAYER_SPRITE_HEIGHT_TILES
};

// training/handstand animation state on the player
player.isTraining = false;
player.handstandAnimTimer = 0;
player.handstandFrame = 0;

const cam = { x: 0, y: 0 };


const doorSequence = {
  active: false,
  tx: 0,
  ty: 0,
  stepDx: 0,
  stepDy: 0,
  stepFrames: 0,
  frame: 0,
  targetTownId: '',
  targetAreaType: '',
  targetX: 0,
  targetY: 0,
  transitionPhase: "out",
  fadeRadius: 0,
  maxFadeRadius: 0
};

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
// WORLD & TILE SYSTEM
// ============================================================================

function setArea(areaType) {
  currentAreaType = areaType;
  
  if (areaType === 'overworld') {
    currentMap = currentTown.overworldMap;
    currentMapW = OVERWORLD_W;
    currentMapH = OVERWORLD_H;
  } else {
    // It's an interior ID
    const interior = currentTown.interiorMaps[areaType];
    if (interior) {
      currentMap = interior.map;
      currentMapW = INTERIOR_W;
      currentMapH = INTERIOR_H;
    }
  }
  
  syncMusicForCurrentArea();
}

function syncMusicForCurrentArea() {
  // Only play area music when inside an interior (e.g. the dojo).
  // Overworld (town) will have no persistent BGM by default.
  if (currentAreaType === 'overworld') {
    musicManager.stopCurrentMusic();
    return;
  }

  // currentAreaType contains the interior id (like 'hanamiDojo')
  const interiorAreaName = currentAreaType;
  musicManager.playMusicForArea(interiorAreaName);
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

function toggleInventory() {
  interactionSystem.toggleInventory();
}

function beginDoorSequence(doorTile) {
  interactionSystem.beginDoorSequence(doorTile);
}

function handleInteraction() {
  interactionSystem.handleInteraction();
}

// INPUT HANDLING
// ============================================================================

initializeInput();
document.addEventListener("toggleInventory", () => {
  toggleInventory();
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
// GAME UPDATE LOGIC
// ============================================================================

function updatePlayerMovement() {
  movementSystem.updatePlayerMovement(
    {
      player,
      currentMap,
      currentMapW,
      currentMapH,
      npcs,
      currentAreaType
    },
    {
      collides: collidesAt,
      collidesWithNPC: collidesWithNPCAt,
      doorFromCollision: detectDoorCollision,
      beginDoorSequence
    }
  );
}

function updateDoorEntry() {
  movementSystem.updateDoorEntry({ player, doorSequence }, (nextState) => {
    gameState = nextState;
  });
}

function updateTransition() {
  movementSystem.updateTransition(
    { player, doorSequence },
    {
      setArea,
      setGameState: (nextState) => {
        gameState = nextState;
      },
      getCurrentAreaType: () => currentAreaType
    }
  );
}

function updatePlayerAnimation() {
  movementSystem.updatePlayerAnimation(player);
}

function update() {
  const now = performance.now();
  
  // Handle level up dialogue
  if (
    trainingPopup.pendingLevelUpDialogueAt !== null &&
    now >= trainingPopup.pendingLevelUpDialogueAt &&
    !isDialogueActive() &&
    !choiceState.active
  ) {
    trainingPopup.pendingLevelUpDialogueAt = null;
    showDialogue("", "Your discipline has grown! Level increased!");
  }

  // Update training popup
  if (trainingPopup.active) {
    const elapsed = now - trainingPopup.startedAt;
    if (elapsed >= trainingPopup.durationMs) {
      trainingPopup.active = false;
      trainingPopup.levelUp = false;
      // stop training animation when popup ends
      player.isTraining = false;
    }
  }

  // Update item alert timers
  if (itemAlert.active) {
    if (now - itemAlert.startedAt >= itemAlert.durationMs) {
      itemAlert.active = false;
    }
  }

  if (inventoryHint.active) {
    if (now - inventoryHint.startedAt >= inventoryHint.durationMs) {
      inventoryHint.active = false;
    }
  }

  // Update game state
  if ((gameState === "overworld" || gameState === "interior") && !isDialogueActive()) {
    if (!player.isTraining) {
      updatePlayerMovement();
    }
  } else if (isDialogueActive()) {
    player.walking = false;
  } else if (gameState === "enteringDoor") {
    updateDoorEntry();
  } else if (gameState === "transition") {
    updateTransition();
  }

  if (gameState !== "transition") {
    handleInteraction();
  }

  updatePlayerAnimation();
  camera();
}

// ============================================================================
// CAMERA SYSTEM
// ============================================================================

function camera() {
  movementSystem.updateCamera({
    cam,
    player,
    currentMapW,
    currentMapH,
    canvas
  });
}

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


let lastTime = performance.now();
syncMusicForCurrentArea();
function loop(currentTime) {
  const delta = (currentTime - lastTime) / 1000; // seconds
  lastTime = currentTime;
  update(delta, currentTime);
  render(delta, currentTime);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);




