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

// ============================================================================
// DIALOGUE SYSTEM
// ============================================================================

let dialogueName = "";
let dialogueLines = [];
let dialogueIndex = 0;
let dialogueEndAction = null;
let visibleCharacters = 0;
let textStartTime = 0;

const choiceState = {
  active: false,
  options: ["Yes", "No"],
  selected: 0,
  onConfirm: null
};

function resetDialogueAnimation() {
  visibleCharacters = 0;
  textStartTime = performance.now();
}

function currentDialogueLine() {
  return isDialogueActive() ? (dialogueLines[dialogueIndex] || "") : "";
}

function currentDialogueVisibleLength() {
  return currentDialogueLine().replace(/\n/g, "").length;
}

function updateVisibleCharacters() {
  const elapsedSeconds = Math.max(0, (performance.now() - textStartTime) / 1000);
  visibleCharacters = Math.min(
    currentDialogueVisibleLength(),
    Math.floor(elapsedSeconds * UI.CHARACTERS_PER_SECOND)
  );
  return visibleCharacters;
}

function isDialogueActive() {
  return dialogueLines.length > 0;
}

function wrapText(ctx, text, maxWidth) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines = [];
  let currentLine = words[0];
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const testLine = `${currentLine} ${word}`;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

function showDialogue(name, textOrLines, endAction = null) {
  dialogueName = (name || "").trim();
  const sourceLines = Array.isArray(textOrLines) ? textOrLines : [textOrLines];

  ctx.save();
  ctx.font = "20px monospace";

  const textMaxWidth = canvas.width - 80;
  const lineSpacing = UI.LINE_SPACING;
  const boxHeight = UI.TEXT_BOX_HEIGHT;
  const boxY = canvas.height - boxHeight - 20;
  const dialogueTextStartY = dialogueName ? boxY + 66 : boxY + 52;
  const maxBaselineY = boxY + boxHeight - 8;
  const maxLinesPerPage = Math.max(
    1,
    Math.floor((maxBaselineY - dialogueTextStartY) / lineSpacing) + 1
  );

  const pagedDialogue = [];
  for (const entry of sourceLines) {
    const wrapped = wrapText(ctx, String(entry ?? ""), textMaxWidth);
    for (let i = 0; i < wrapped.length; i += maxLinesPerPage) {
      const pageLines = wrapped.slice(i, i + maxLinesPerPage);
      pagedDialogue.push(pageLines.join("\n"));
    }
  }

  dialogueLines = pagedDialogue;
  ctx.restore();
  dialogueIndex = 0;
  dialogueEndAction = endAction;
  closeChoice();
  resetDialogueAnimation();
}

function openYesNoChoice(onConfirm) {
  choiceState.active = true;
  choiceState.selected = 0;
  choiceState.onConfirm = onConfirm;
}

function closeChoice() {
  choiceState.active = false;
  choiceState.selected = 0;
  choiceState.onConfirm = null;
}

function confirmChoice() {
  if (!choiceState.active) return;
  const selectedOption = choiceState.options[choiceState.selected];
  const onConfirm = choiceState.onConfirm;
  closeChoice();
  if (onConfirm) onConfirm(selectedOption);
}

function advanceDialogue() {
  if (!isDialogueActive() || choiceState.active) return;
  updateVisibleCharacters();

  if (visibleCharacters < currentDialogueVisibleLength()) {
    visibleCharacters = currentDialogueVisibleLength();
    return;
  }

  if (dialogueIndex < dialogueLines.length - 1) {
    dialogueIndex++;
    resetDialogueAnimation();
  } else if (dialogueEndAction) {
    const endAction = dialogueEndAction;
    dialogueEndAction = null;
    endAction();
  } else {
    closeDialogue();
  }
}

function closeDialogue() {
  dialogueName = "";
  dialogueLines = [];
  dialogueIndex = 0;
  dialogueEndAction = null;
  visibleCharacters = 0;
  textStartTime = 0;
  closeChoice();
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

function collides(nx, ny) {
  return collidesAt(nx, ny, currentMap, currentMapW, currentMapH);
}

function collidesWithNPC(nx, ny) {
  return collidesWithNPCAt(nx, ny, npcs, currentAreaType);
}

function doorFromCollision(nx, ny) {
  return detectDoorCollision(nx, ny, currentMap, currentMapW, currentMapH);
}

// ============================================================================
// PLAYER ACTIONS
// ============================================================================

function playerTilePosition() {
  return {
    x: Math.floor((player.x + TILE / 2) / TILE),
    y: Math.floor((player.y + TILE / 2) / TILE)
  };
}

function tryTrainingAction() {
  const isFreeExploreState = gameState === "overworld" || gameState === "interior";
  if (!isFreeExploreState) return;
  if (isDialogueActive() || choiceState.active || doorSequence.active) return;
  if (currentAreaType === 'overworld') return;
  if (!gameFlags.acceptedTraining) return;

  const interior = currentTown?.interiorMaps?.[currentAreaType];
  if (!interior || !interior.trainingTile) return;
  
  const tilePos = playerTilePosition();
  if (!tilePos) return;
  
  const onTrainingTile = tilePos.x === interior.trainingTile.x && tilePos.y === interior.trainingTile.y;
  if (!onTrainingTile) return;

  // If at max discipline level, show completion message
  if (playerStats.disciplineLevel >= 2) {
    if (!isDialogueActive()) {
      showDialogue("", "Training complete. Speak to Mr. Hanami.");
    }
    return;
  }

  // Don't allow multiple training sessions at once
  if (trainingPopup.active) return;

  const startXP = playerStats.disciplineXP;
  const xpEarned = TRAINING.XP_PER_SESSION;
  trainingPopup.xpNeededSnapshot = playerStats.disciplineXPNeeded;

  playerStats.disciplineXP += xpEarned;
  trainingPopup.startXP = startXP;
  trainingPopup.targetXP = playerStats.disciplineXP;
  trainingPopup.xpGained = xpEarned;
  trainingPopup.levelUp = false;
  trainingPopup.pendingLevelUpDialogueAt = null;
  trainingPopup.active = true;
  trainingPopup.startedAt = performance.now();

  // start player handstand/training animation
  player.isTraining = true;
  player.handstandAnimTimer = 0;
  player.handstandFrame = 0;
  player.walking = false;

  if (playerStats.disciplineXP >= playerStats.disciplineXPNeeded) {
    trainingPopup.levelUp = true;
    trainingPopup.pendingLevelUpDialogueAt = trainingPopup.startedAt + trainingPopup.animDurationMs;
    playerStats.disciplineLevel += 1;
    if (!gameFlags.completedTraining && playerStats.disciplineLevel >= 2) {
      gameFlags.completedTraining = true;
    }
    playerStats.disciplineXP = 0;
    playerStats.disciplineXPNeeded += TRAINING.XP_INCREMENT;
  }
}

function toggleInventory() {
  if (gameState === "inventory") {
    gameState = previousWorldState;
    clearInteractPressed();
    return;
  }

  const isFreeExploreState = gameState === "overworld" || gameState === "interior";
  if (!isFreeExploreState) return;
  if (isDialogueActive() || choiceState.active || doorSequence.active) return;

  previousWorldState = gameState;
  gameState = "inventory";
  clearInteractPressed();
}

function handleNPCInteraction(npc) {
  if (npc.hasTrainingChoice) {
    if (gameFlags.completedTraining) {
      showDialogue(npc.name, [
        "Excellent.",
        "You have mastered the basics and are now ready for your next lesson. I won't tell you what it is though!"
      ]);
      return;
    }

    if (gameFlags.acceptedTraining) {
      showDialogue(npc.name, npc.alreadyTrainingDialogue);
      return;
    }

    showDialogue(npc.name, npc.dialogue, () => {
      openYesNoChoice((selectedOption) => {
        if (selectedOption === "Yes") {
          gameFlags.acceptedTraining = true;
          if (!playerInventory["Training Headband"]) {
            playerInventory["Training Headband"] = 1;
            // show item alert above player and inventory hint
            itemAlert.active = true;
            itemAlert.text = "New item: Training Headband";
            itemAlert.startedAt = performance.now();
            inventoryHint.active = true;
            inventoryHint.startedAt = performance.now();
            // play unlock SFX
            try { musicManager.playSfx("itemUnlock"); } catch (e) {}
          }
          showDialogue(npc.name, "You received a Training Headband!");
        } else {
          showDialogue(npc.name, "Come speak to me when you are ready.");
        }
      });
    });
  } else {
    showDialogue(npc.name, npc.dialogue);
  }
}

function beginDoorSequence(doorTile) {
  if (gameState === "enteringDoor" || gameState === "transition") return;
  musicManager.playSfx("enterDoor");

  const playerCenterX = player.x + TILE / 2;
  const playerCenterY = player.y + TILE / 2;
  const doorCenterX = doorTile.tx * TILE + TILE / 2;
  const doorCenterY = doorTile.ty * TILE + TILE / 2;
  let vx = doorCenterX - playerCenterX;
  let vy = doorCenterY - playerCenterY;
  const len = Math.hypot(vx, vy) || 1;
  vx /= len;
  vy /= len;

  doorSequence.active = true;
  doorSequence.tx = doorTile.tx;
  doorSequence.ty = doorTile.ty;
  doorSequence.stepDx = vx * 1.5;
  doorSequence.stepDy = vy * 1.5;
  doorSequence.stepFrames = 20;
  doorSequence.frame = 0;

  if (currentAreaType === 'overworld') {
    // Find which building this door belongs to
    const building = getBuilding(currentTownId, doorTile.tx, doorTile.ty);
    if (building) {
      doorSequence.targetAreaType = building.interiorId;
      const interior = currentTown.interiorMaps[building.interiorId];
      const door = interior.door;
      doorSequence.targetX = door.x * TILE;
      doorSequence.targetY = (door.y - 1) * TILE;
    }
  } else {
    // Going from interior back to overworld
    doorSequence.targetAreaType = 'overworld';
    const building = Array.from(currentTown.buildings).find(b => b.interiorId === currentAreaType);
    if (building) {
      doorSequence.targetX = building.doorPos.x * TILE;
      doorSequence.targetY = (building.doorPos.y + 1) * TILE;
    }
  }

  doorSequence.maxFadeRadius = Math.hypot(canvas.width, canvas.height);
  doorSequence.fadeRadius = doorSequence.maxFadeRadius;
  doorSequence.transitionPhase = "out";
  gameState = "enteringDoor";
  clearInteractPressed();
}

// ============================================================================
// INTERACTION SYSTEM
// ============================================================================

function handleInteraction() {
  if (gameState === "inventory") {
    clearInteractPressed();
    return;
  }

  if (!getInteractPressed()) return;

  if (isDialogueActive()) {
    advanceDialogue();
    clearInteractPressed();
    return;
  }

  if (gameState === "enteringDoor" || gameState === "transition") {
    clearInteractPressed();
    return;
  }

  const playerCenterX = player.x + TILE / 2;
  const playerCenterY = player.y + TILE / 2;

  // Check NPC interactions
  for (const npc of npcs) {
    if (npc.world !== currentAreaType) continue;

    const npcCenterX = npc.x + npc.width / 2;
    const npcCenterY = npc.y + npc.height / 2;
    const dx = Math.abs(playerCenterX - npcCenterX);
    const dy = Math.abs(playerCenterY - npcCenterY);

    if (dx <= UI.INTERACT_REACH && dy <= UI.INTERACT_REACH) {
      const relativeX = playerCenterX - npcCenterX;
      const relativeY = playerCenterY - npcCenterY;

      if (Math.abs(relativeX) >= Math.abs(relativeY)) {
        npc.dir = relativeX < 0 ? "left" : "right";
      } else {
        npc.dir = relativeY < 0 ? "up" : "down";
      }

      handleNPCInteraction(npc);
      clearInteractPressed();
      return;
    }
  }

  // Check signpost interactions
  const inset = 5;
  const left = Math.floor((player.x + inset) / TILE) - 1;
  const right = Math.floor((player.x + TILE - inset) / TILE) + 1;
  const top = Math.floor((player.y + inset) / TILE) - 1;
  const bottom = Math.floor((player.y + TILE - inset) / TILE) + 1;

  for (let ty = top; ty <= bottom; ty++) {
    if (ty < 0 || ty >= currentMapH) continue;
    for (let tx = left; tx <= right; tx++) {
      if (tx < 0 || tx >= currentMapW) continue;
      if (currentMap[ty][tx] === TILE_TYPES.SIGNPOST) {
        showDialogue("", "The Dojo");
        clearInteractPressed();
        return;
      }
    }
  }

  // Check training tile interaction
  if (currentAreaType !== 'overworld' && gameFlags.acceptedTraining) {
    const interior = currentTown?.interiorMaps?.[currentAreaType];
    if (interior && interior.trainingTile) {
      const tilePos = playerTilePosition();
      if (tilePos) {
        const onTrainingTile = tilePos.x === interior.trainingTile.x && tilePos.y === interior.trainingTile.y;
        if (onTrainingTile) {
          tryTrainingAction();
          clearInteractPressed();
          return;
        }
      }
    }
  }

  clearInteractPressed();
}

// ============================================================================
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

let lastWalkSoundTime = 0;
const WALK_SOUND_INTERVAL = 300; // milliseconds between walk sounds

function updatePlayerMovement() {
  let dx = 0;
  let dy = 0;

  if (keys["w"] || keys["arrowup"]) {
    dy -= player.speed;
    player.dir = "up";
  }
  if (keys["s"] || keys["arrowdown"]) {
    dy += player.speed;
    player.dir = "down";
  }
  if (keys["a"] || keys["arrowleft"]) {
    dx -= player.speed;
    player.dir = "left";
  }
  if (keys["d"] || keys["arrowright"]) {
    dx += player.speed;
    player.dir = "right";
  }

  player.walking = dx !== 0 || dy !== 0;

  // Play walking sound at intervals
  if (player.walking) {
    const now = performance.now();
    if (now - lastWalkSoundTime > WALK_SOUND_INTERVAL) {
      musicManager.playSfx("walking");
      lastWalkSoundTime = now;
    }
  }

  if (dx !== 0 && dy !== 0) {
    const s = Math.SQRT1_2;
    dx *= s;
    dy *= s;
  }

  const nx = player.x + dx;
  const ny = player.y + dy;

  if (!collides(nx, player.y) && !collidesWithNPC(nx, player.y)) {
    player.x = nx;
  } else if (dx !== 0) {
    const doorTile = doorFromCollision(nx, player.y);
    if (doorTile) {
      beginDoorSequence(doorTile);
    } else {
      // Hit a wall or obstacle - play collision sound
      musicManager.playSfx("collision");
    }
  }

  if (!collides(player.x, ny) && !collidesWithNPC(player.x, ny)) {
    player.y = ny;
  } else if (dy !== 0) {
    const doorTile = doorFromCollision(player.x, ny);
    if (doorTile) {
      beginDoorSequence(doorTile);
    } else {
      // Hit a wall or obstacle - play collision sound
      musicManager.playSfx("collision");
    }
  }

  if (player.walking) {
    player.frame = (player.frame + 1) % 24;
  }
}

function updateDoorEntry() {
  player.walking = true;
  player.frame = (player.frame + 1) % 24;

  if (doorSequence.frame < doorSequence.stepFrames) {
    player.x += doorSequence.stepDx;
    player.y += doorSequence.stepDy;
    doorSequence.frame++;
  } else {
    gameState = "transition";
  }
}

function updateTransition() {
  player.walking = false;

  if (doorSequence.transitionPhase === "out") {
    doorSequence.fadeRadius -= 20;
    if (doorSequence.fadeRadius <= 0) {
      doorSequence.fadeRadius = 0;
      setArea(doorSequence.targetAreaType);
      player.x = doorSequence.targetX;
      player.y = doorSequence.targetY;
      player.dir = doorSequence.targetAreaType === 'overworld' ? "down" : "up";
      doorSequence.transitionPhase = "in";
    }
  } else {
    doorSequence.fadeRadius += 20;
    if (doorSequence.fadeRadius >= doorSequence.maxFadeRadius) {
      doorSequence.fadeRadius = doorSequence.maxFadeRadius;
      doorSequence.active = false;
      gameState = currentAreaType === 'overworld' ? 'overworld' : 'interior';
    }
  }
}

function updatePlayerAnimation() {
  // If player is performing the training handstand animation, animate that
  if (player.isTraining) {
    player.handstandAnimTimer += 1;
    if (player.handstandAnimTimer >= 10) {
      player.handstandAnimTimer = 0;
      player.handstandFrame = (player.handstandFrame + 1) % SPRITE_FRAMES_PER_ROW;
    }
    // Pause normal walking animation
    player.animTimer = 0;
    player.animFrame = 1;
    return;
  }

  if (player.walking) {
    player.animTimer += 1;
    if (player.animTimer >= 8) {
      player.animTimer = 0;
      player.animFrame = (player.animFrame + 1) % SPRITE_FRAMES_PER_ROW;
    }
  } else {
    player.animTimer = 0;
    player.animFrame = 1;
  }
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
  const worldW = currentMapW * TILE;
  const worldH = currentMapH * TILE;
  const visibleW = canvas.width / CAMERA_ZOOM;
  const visibleH = canvas.height / CAMERA_ZOOM;
  const halfVisibleW = visibleW / 2;
  const halfVisibleH = visibleH / 2;

  let cx = player.x - halfVisibleW;
  let cy = player.y - halfVisibleH;

  const minX = Math.min(0, worldW - visibleW);
  const maxX = Math.max(0, worldW - visibleW);
  const minY = Math.min(0, worldH - visibleH);
  const maxY = Math.max(0, worldH - visibleH);

  cam.x = Math.max(minX, Math.min(cx, maxX));
  cam.y = Math.max(minY, Math.min(cy, maxY));
}

// ============================================================================
// RENDERING SYSTEM
// ============================================================================

function drawTile(type, x, y, tileX, tileY) {
  drawTileSystem(ctx, currentTownId, gameState, doorSequence, type, x, y, tileX, tileY);
}

function drawPlayer(cam) {
  if (player.sprite && player.sprite.width && player.sprite.height) {
    const targetHeight = TILE * player.desiredHeightTiles;
    const scale = targetHeight / SPRITE_FRAME_HEIGHT;
    const drawWidth = SPRITE_FRAME_WIDTH * scale;
    const drawHeight = SPRITE_FRAME_HEIGHT * scale;
    const drawX = Math.round(player.x - cam.x - (drawWidth - TILE) / 2);
    const drawY = Math.round(player.y - cam.y - (drawHeight - TILE));

    if (player.isTraining) {
      const handSprite = AssetManager.getSprite('protagonist_handstand') || player.sprite;
      const frame = player.handstandFrame || 0;
      const sx = frame * SPRITE_FRAME_WIDTH;
      const sy = 0;
      ctx.drawImage(
        handSprite,
        sx,
        sy,
        SPRITE_FRAME_WIDTH,
        SPRITE_FRAME_HEIGHT,
        drawX,
        drawY,
        drawWidth,
        drawHeight
      );
    } else {
      const directionToRow = {
        down: 0,
        left: 1,
        right: 2,
        up: 3
      };
      const row = directionToRow[player.dir] ?? 0;
      const frame = player.walking ? player.animFrame : 1;
      const sx = frame * SPRITE_FRAME_WIDTH;
      const sy = row * SPRITE_FRAME_HEIGHT;

      ctx.drawImage(
        player.sprite,
        sx,
        sy,
        SPRITE_FRAME_WIDTH,
        SPRITE_FRAME_HEIGHT,
        drawX,
        drawY,
        drawWidth,
        drawHeight
      );
    }
  }
}

function drawNPCSprite(npc, drawX, drawY, drawWidth, drawHeight) {
  ctx.save();
  if (npc.dir === "left") {
    ctx.translate(drawX + drawWidth / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(drawX + drawWidth / 2), 0);
  }
  ctx.drawImage(npc.sprite, drawX, drawY, drawWidth, drawHeight);
  if (npc.dir === "up") {
    ctx.fillStyle = COLORS.SHADOW;
    ctx.fillRect(drawX, drawY, drawWidth, drawHeight);
  }
  ctx.restore();
}

function drawNPCPlaceholder(nx, ny) {
  ctx.fillStyle = COLORS.NPC_BODY;
  ctx.fillRect(nx + 6, ny + 8, 20, 20);
  ctx.fillStyle = COLORS.NPC_FACE;
  ctx.fillRect(nx + 10, ny + 4, 12, 8);
  ctx.fillStyle = COLORS.NPC_LEGS;
  ctx.fillRect(nx + 10, ny + 26, 6, 6);
  ctx.fillRect(nx + 16, ny + 26, 6, 6);
}

function drawNPCs(cam) {
  if (currentAreaType === 'overworld') return;

  for (const npc of npcs) {
    if (npc.world !== currentAreaType) continue;

    const nx = npc.x - cam.x;
    const ny = npc.y - cam.y;

    if (nx > -npc.width && ny > -npc.height && nx < canvas.width && ny < canvas.height) {
      if (npc.sprite && npc.sprite.width && npc.sprite.height) {
        let drawWidth, drawHeight, drawX, drawY;

        if (npc.desiredHeightTiles) {
          const targetHeight = TILE * npc.desiredHeightTiles;
          const scale = targetHeight / npc.sprite.height;
          drawWidth = npc.sprite.width * scale;
          drawHeight = npc.sprite.height * scale;
          drawX = Math.round(npc.x - cam.x - (drawWidth - TILE) / 2);
          drawY = Math.round(npc.y - cam.y - (drawHeight - TILE));
        } else {
          drawWidth = npc.spriteWidth || TILE;
          drawHeight = npc.spriteHeight || TILE;
          drawX = Math.round(npc.x - cam.x - (drawWidth - TILE) / 2);
          drawY = Math.round(npc.y - cam.y - (drawHeight - TILE));
        }

        drawNPCSprite(npc, drawX, drawY, drawWidth, drawHeight);
      } else {
        drawNPCPlaceholder(nx, ny);
      }
    }
  }
}

function drawTrainingPopup(cam) {
  if (!trainingPopup.active) return;

  const elapsed = performance.now() - trainingPopup.startedAt;
  const fadeRatio = Math.max(0, 1 - elapsed / trainingPopup.durationMs);
  if (fadeRatio <= 0) return;

  const px = player.x - cam.x + TILE / 2;
  const py = player.y - cam.y;

  const boxW = UI.TRAINING_POPUP_WIDTH;
  const boxH = UI.TRAINING_POPUP_HEIGHT;
  let boxX = Math.round(px - boxW / 2);
  let boxY = Math.round(py - 58);

  if (boxY < 0) {
    boxY = Math.round(py + TILE + 10);
  }

  boxX = Math.max(0, Math.min(boxX, canvas.width - boxW));
  boxY = Math.max(0, boxY);

  let progressRatio;
  if (trainingPopup.levelUp) {
    const fillProgress = Math.min(1, elapsed / trainingPopup.animDurationMs);
    const holdEnd = trainingPopup.animDurationMs + trainingPopup.levelUpHoldMs;
    progressRatio = elapsed < trainingPopup.animDurationMs ? fillProgress : 
                    elapsed < holdEnd ? 1 : 0;
  } else {
    const animationProgress = Math.min(1, elapsed / trainingPopup.animDurationMs);
    const displayXP = trainingPopup.startXP + (trainingPopup.targetXP - trainingPopup.startXP) * animationProgress;
    progressRatio = Math.min(1, displayXP / trainingPopup.xpNeededSnapshot);
  }

  ctx.save();
  ctx.globalAlpha = fadeRatio;

  ctx.fillStyle = COLORS.POPUP_BG;
  ctx.fillRect(boxX, boxY, boxW, boxH);

  ctx.strokeStyle = COLORS.POPUP_BORDER;
  ctx.lineWidth = 1;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.fillStyle = COLORS.TEXT;
  ctx.font = "12px monospace";
  ctx.fillText(`Lv. ${playerStats.disciplineLevel}`, boxX + 8, boxY + 13);
  ctx.fillText(`+${trainingPopup.xpGained} XP`, boxX + 78, boxY + 13);

  const barX = boxX + 8;
  const barY = boxY + 21;
  const barW = boxW - 16;
  const barH = 14;

  ctx.fillStyle = COLORS.POPUP_BAR_BG;
  ctx.fillRect(barX, barY, barW, barH);

  ctx.fillStyle = COLORS.POPUP_BAR_FILL;
  ctx.fillRect(barX, barY, Math.round(barW * progressRatio), barH);

  ctx.restore();
}

function drawTextbox() {
  if (!isDialogueActive() || gameState === "inventory") return;

  // Keep dialogue box height fixed so it doesn't resize when choices appear
  const boxHeight = UI.TEXT_BOX_HEIGHT;
  const boxY = canvas.height - boxHeight - 20;

  ctx.fillStyle = COLORS.DIALOGUE_BG;
  ctx.fillRect(20, boxY, canvas.width - 40, boxHeight);

  ctx.strokeStyle = COLORS.DIALOGUE_BORDER;
  ctx.lineWidth = 3;
  ctx.strokeRect(20, boxY, canvas.width - 40, boxHeight);

  ctx.fillStyle = COLORS.TEXT;
  ctx.font = "20px monospace";

  const textStartX = 40;
  const lineSpacing = UI.LINE_SPACING;
  updateVisibleCharacters();

  const fullPageLines = currentDialogueLine().split("\n");
  const wrappedLines = [];
  let remainingCharacters = visibleCharacters;

  for (const line of fullPageLines) {
    if (remainingCharacters <= 0) break;
    const visibleInLine = Math.min(line.length, remainingCharacters);
    wrappedLines.push(line.slice(0, visibleInLine));
    remainingCharacters -= visibleInLine;
    if (visibleInLine < line.length) break;
  }

  const textHeight = wrappedLines.length * lineSpacing;
  // Center text vertically in the dialogue box; choices will be drawn above the box
  const textStartY = boxY + (boxHeight - textHeight) / 2 + lineSpacing - 6;

  if (dialogueName) {
    ctx.fillText(dialogueName, 40, boxY + 28);
  }

  for (let i = 0; i < wrappedLines.length; i++) {
    ctx.fillText(wrappedLines[i], textStartX, textStartY + i * lineSpacing);
  }

  // Draw choices in a small box above the dialogue when active
  if (choiceState.active) {
    const optPadding = 10;
    ctx.font = "20px monospace";
    let maxW = 0;
    for (const opt of choiceState.options) {
      maxW = Math.max(maxW, ctx.measureText(opt).width);
    }
    const optionsW = Math.max(120, maxW + 40);
    const optionsH = choiceState.options.length * UI.LINE_SPACING + optPadding * 2;
    // Place options on the left (aligned with dialogue text) instead of centered
    const optionsX = 40; // align with `textStartX`
    const optionsY = boxY - optionsH - 12; // 12px gap above dialog box

    // Background and border
    ctx.fillStyle = COLORS.POPUP_BG;
    ctx.fillRect(optionsX, optionsY, optionsW, optionsH);
    ctx.strokeStyle = COLORS.DIALOGUE_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(optionsX, optionsY, optionsW, optionsH);

    // Draw options and selection marker
    for (let i = 0; i < choiceState.options.length; i++) {
      const optY = optionsY + optPadding + (i + 0.8) * UI.LINE_SPACING;
      const textX = optionsX + 20;
      if (i === choiceState.selected) {
        // small right-pointing triangle to the left of the option
        ctx.beginPath();
        ctx.moveTo(textX - 12 + 8, optY - 6);
        ctx.lineTo(textX - 12, optY - 10);
        ctx.lineTo(textX - 12, optY - 2);
        ctx.closePath();
        ctx.fillStyle = COLORS.TEXT;
        ctx.fill();
      }
      ctx.fillStyle = COLORS.TEXT;
      ctx.fillText(choiceState.options[i], textX, optY);
    }
  }

  const pageComplete = visibleCharacters >= currentDialogueVisibleLength();
  const blink = Math.floor(performance.now() / 500) % 2 === 0;
  if (pageComplete && !choiceState.active && blink) {
    // Draw a small right-pointing triangle as the page indicator
    const bobOffsetY = Math.sin(performance.now() * 0.008) * 3;
    const indicatorY = boxY + boxHeight - 12 + bobOffsetY;
    const indicatorX = canvas.width - 28;
    ctx.beginPath();
    ctx.moveTo(indicatorX + 8, indicatorY); // tip on the right
    ctx.lineTo(indicatorX, indicatorY - 6);
    ctx.lineTo(indicatorX, indicatorY + 6);
    ctx.closePath();
    ctx.fill();
  }
}

function drawDoorTransition(cam) {
  if (gameState !== "transition") return;

  const px = player.x - cam.x + TILE / 2;
  const py = player.y - cam.y + TILE / 2;

  ctx.save();
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(px, py, doorSequence.fadeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawInventoryOverlay() {
  if (gameState !== "inventory") return;

  ctx.fillStyle = COLORS.INVENTORY_OVERLAY;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const boxW = UI.INVENTORY_BOX_WIDTH;
  const boxH = UI.INVENTORY_BOX_HEIGHT;
  const boxX = (canvas.width - boxW) / 2;
  const boxY = (canvas.height - boxH) / 2;

  ctx.fillStyle = COLORS.INVENTORY_BG;
  ctx.fillRect(boxX, boxY, boxW, boxH);

  ctx.strokeStyle = COLORS.DIALOGUE_BORDER;
  ctx.lineWidth = 3;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.fillStyle = COLORS.TEXT;
  ctx.font = "28px monospace";
  ctx.fillText("Inventory", boxX + 24, boxY + 42);

  const entries = Object.entries(playerInventory);
  ctx.font = "20px monospace";

  let row = 0;
  if (entries.length === 0) {
    ctx.fillText("(No items)", boxX + 24, boxY + 90);
    row = 1;
  } else {
    for (const [itemName, quantity] of entries) {
      ctx.fillText(`${itemName} x${quantity}`, boxX + 24, boxY + 90 + row * 28);
      row++;
    }
  }

  const statsY = boxY + 90 + row * 28 + 18;
  ctx.font = "22px monospace";
  ctx.fillText("Stats", boxX + 24, statsY);

  ctx.font = "20px monospace";
  const levelY = statsY + 30;
  ctx.fillText(`Discipline Lv. ${playerStats.disciplineLevel}`, boxX + 24, levelY);

  const barX = boxX + 24;
  const barY = levelY + 18;
  const barW = boxW - 48;
  const barH = 20;
  const progressRatio = Math.min(1, playerStats.disciplineXP / playerStats.disciplineXPNeeded);

  ctx.fillStyle = COLORS.POPUP_BAR_BG;
  ctx.fillRect(barX, barY, barW, barH);

  ctx.fillStyle = COLORS.INVENTORY_BAR_FILL;
  ctx.fillRect(barX, barY, barW * progressRatio, barH);

  ctx.strokeStyle = COLORS.DIALOGUE_BORDER;
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barW, barH);

  ctx.fillStyle = COLORS.TEXT;
  ctx.font = "16px monospace";
  const progressText = `${playerStats.disciplineXP} / ${playerStats.disciplineXPNeeded}`;
  const textWidth = ctx.measureText(progressText).width;
  ctx.fillText(progressText, barX + (barW - textWidth) / 2, barY + 15);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Zoom world rendering in world-space; camera offsets remain source of truth.
  ctx.save();
  ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
  const visibleW = canvas.width / CAMERA_ZOOM;
  const visibleH = canvas.height / CAMERA_ZOOM;

  // Draw map
  for (let y = 0; y < currentMapH; y++) {
    for (let x = 0; x < currentMapW; x++) {
      const drawX = x * TILE - cam.x;
      const drawY = y * TILE - cam.y;

      if (drawX > -TILE && drawY > -TILE && drawX < visibleW && drawY < visibleH) {
        drawTile(currentMap[y][x], drawX, drawY, x, y);
      }
    }
  }

  // Draw game elements
  drawNPCs(cam);
  drawPlayer(cam);
  drawTrainingPopup(cam);
  drawDoorTransition(cam);
  ctx.restore();
  // Draw in-screen notifications (above-player and top-left hints)
  drawItemNotifications();

  drawInventoryOverlay();
  drawTextbox();
}

function drawItemNotifications() {
  // Draw above-player item alert in screen space
  if (itemAlert.active) {
    const elapsed = performance.now() - itemAlert.startedAt;
    const t = Math.min(1, elapsed / itemAlert.durationMs);
    const alpha = 1 - Math.max(0, (elapsed - (itemAlert.durationMs - 400)) / 400);

    const screenX = (player.x - cam.x) * CAMERA_ZOOM + (TILE * CAMERA_ZOOM) / 2;
    const screenY = (player.y - cam.y) * CAMERA_ZOOM - 18;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "18px monospace";
    const padding = 8;
    const text = itemAlert.text;
    const textW = ctx.measureText(text).width;
    const boxW = Math.max(120, textW + padding * 2);
    const boxH = 28;
    const boxX = Math.round(screenX - boxW / 2);
    const boxY = Math.round(screenY - boxH);

    ctx.fillStyle = COLORS.POPUP_BG;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = COLORS.POPUP_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = COLORS.TEXT;
    ctx.fillText(text, boxX + padding, boxY + 19);
    ctx.restore();
  }

  // Draw top-left inventory hint
  if (inventoryHint.active) {
    const elapsed = performance.now() - inventoryHint.startedAt;
    const alpha = 1 - Math.max(0, (elapsed - (inventoryHint.durationMs - 600)) / 600);
    ctx.save();
    ctx.globalAlpha = alpha * 0.95;
    ctx.font = "16px monospace";
    const hintText = "New item received — press I to view your inventory";
    const padding = 8;
    const textW = ctx.measureText(hintText).width;
    const boxW = textW + padding * 2;
    const boxH = 28;
    const boxX = 12;
    const boxY = 12;
    ctx.fillStyle = COLORS.POPUP_BG;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = COLORS.POPUP_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = COLORS.TEXT;
    ctx.fillText(hintText, boxX + padding, boxY + 19);
    ctx.restore();
  }
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




