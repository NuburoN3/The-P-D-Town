// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const TILE = 32;
const OVERWORLD_W = 30;
const OVERWORLD_H = 30;
const INTERIOR_W = 12;
const INTERIOR_H = 10;

// Tile type IDs
const TILE_TYPES = {
  GRASS: 0,
  PATH: 1,
  TREE: 2,
  WALL: 3,
  SIGNPOST: 4,
  DOOR: 5,
  INTERIOR_FLOOR: 6,
  TRAINING_FLOOR: 7
};

// Colors for rendering
const COLORS = {
  GRASS: "#7ecf7e",
  TREE_LIGHT: "#2e7d32",
  TREE_DARK: "#1b5e20",
  WALL: "#8d6e63",
  SIGNPOST_WOOD: "#6d4c41",
  SIGNPOST_SIGN: "#d7ccc8",
  DOOR_INACTIVE: "#5d4037",
  DOOR_ACTIVE: "#ffcc80",
  DOOR_FRAME_INACTIVE: "#8d6e63",
  DOOR_FRAME_ACTIVE: "#ffe0b2",
  DOOR_KNOB: "#3e2723",
  INTERIOR_FLOOR_LIGHT: "#bca58a",
  INTERIOR_FLOOR_DARK: "#a1887f",
  TRAINING_FLOOR_LIGHT: "#8d7964",
  TRAINING_FLOOR_DARK: "#6d5b4c",
  PATH: "#d8c89a",
  PLAYER_BODY: "#2b2b2b",
  PLAYER_FACE: "#ffffff",
  NPC_BODY: "#7b1fa2",
  NPC_FACE: "#ffe0b2",
  NPC_LEGS: "#4a148c",
  DIALOGUE_BG: "rgba(0,0,0,0.75)",
  DIALOGUE_BORDER: "#ffffff",
  TEXT: "#ffffff",
  POPUP_BG: "rgba(12,18,28,0.9)",
  POPUP_BORDER: "#ffffff",
  POPUP_BAR_BG: "#263238",
  POPUP_BAR_FILL: "#4caf50",
  INVENTORY_BG: "rgba(22,28,38,0.96)",
  INVENTORY_OVERLAY: "rgba(0,0,0,0.6)",
  INVENTORY_BAR_FILL: "#66bb6a",
  SHADOW: "rgba(0,0,0,0.25)"
};

// UI Constants
const UI = {
  TEXT_BOX_HEIGHT: 112,
  CHOICE_BOX_HEIGHT: 152,
  TEXT_BOX_PADDING: 20,
  LINE_SPACING: 24,
  CHARACTERS_PER_SECOND: 100,
  TRAINING_POPUP_WIDTH: 120,
  TRAINING_POPUP_HEIGHT: 44,
  INVENTORY_BOX_WIDTH: 420,
  INVENTORY_BOX_HEIGHT: 280,
  INTERACT_REACH: TILE
};

// Training Constants
const TRAINING = {
  DURATION_MS: 2000,
  ANIM_DURATION_MS: 400,
  LEVEL_UP_HOLD_MS: 250,
  XP_PER_SESSION: 5,
  INITIAL_XP_NEEDED: 10,
  XP_INCREMENT: 5
};

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

// ============================================================================
// MAP & WORLD DATA
// ============================================================================

function generateOverworldMap() {
  const map = Array.from({ length: OVERWORLD_H }, (_, y) =>
    Array.from({ length: OVERWORLD_W }, (_, x) => {
      if (x === 0 || y === 0 || x === OVERWORLD_W - 1 || y === OVERWORLD_H - 1) {
        return TILE_TYPES.TREE;
      }
      return TILE_TYPES.GRASS;
    })
  );

  const pathX = 15;
  for (let y = 2; y < OVERWORLD_H - 2; y++) {
    map[y][pathX] = TILE_TYPES.PATH;
  }

  for (let x = 8; x <= 22; x++) {
    map[15][x] = TILE_TYPES.PATH;
  }

  const dojoTop = 10;
  const dojoLeft = 13;
  const dojoW = 5;
  const dojoH = 4;

  for (let y = dojoTop; y < dojoTop + dojoH; y++) {
    for (let x = dojoLeft; x < dojoLeft + dojoW; x++) {
      map[y][x] = TILE_TYPES.WALL;
    }
  }

  const overworldDoor = { x: dojoLeft + Math.floor(dojoW / 2), y: dojoTop + dojoH - 1 };
  map[overworldDoor.y][overworldDoor.x] = TILE_TYPES.DOOR;
  map[14][14] = TILE_TYPES.SIGNPOST;

  const treeClusters = [
    [4, 4], [5, 4], [4, 5], [24, 4], [25, 4], [24, 5],
    [5, 23], [4, 24], [24, 23], [25, 24], [22, 20], [8, 20]
  ];
  for (const [x, y] of treeClusters) {
    map[y][x] = TILE_TYPES.TREE;
  }

  return { map, door: overworldDoor };
}

function generateInteriorMap() {
  const map = Array.from({ length: INTERIOR_H }, (_, y) =>
    Array.from({ length: INTERIOR_W }, (_, x) => {
      if (x === 0 || y === 0 || x === INTERIOR_W - 1 || y === INTERIOR_H - 1) {
        return TILE_TYPES.WALL;
      }
      return TILE_TYPES.INTERIOR_FLOOR;
    })
  );

  const door = { x: Math.floor(INTERIOR_W / 2), y: INTERIOR_H - 1 };
  map[door.y][door.x] = TILE_TYPES.DOOR;

  const trainingTile = { x: 4, y: 5 };
  map[trainingTile.y][trainingTile.x] = TILE_TYPES.TRAINING_FLOOR;

  return { map, door, trainingTile };
}

const overworldData = generateOverworldMap();
const overworldMap = overworldData.map;
const overworldDoor = overworldData.door;

const interiorData = generateInteriorMap();
const interiorMap = interiorData.map;
const interiorDoor = interiorData.door;
const trainingTile = interiorData.trainingTile;

// ============================================================================
// ASSETS & NPCs
// ============================================================================

const hanamiSprite = new Image();
hanamiSprite.src = "mr_hanami.png";

const npcs = [
  {
    world: "interior",
    x: 7 * TILE,
    y: 4 * TILE,
    width: TILE,
    height: TILE,
    desiredHeightTiles: 1.15,
    name: "Mr. Hanami",
    sprite: hanamiSprite,
    dialogue: [
      "Hello there!",
      "Welcome to the dojo.",
      "I train students here",
      "where they practice Hana Sakura style Karate",
      "which means \"the way of the cherry blossom\".",
      "Would you like me to teach you?"
    ],
    alreadyTrainingDialogue: "Your training has already begun. Focus your mind.",
    hasTrainingChoice: true,
    dir: "down"
  }
];

// ============================================================================
// WORLD & GAME STATE
// ============================================================================

let currentMap = overworldMap;
let currentMapW = OVERWORLD_W;
let currentMapH = OVERWORLD_H;
let worldName = "overworld";
let gameState = "overworld";
let previousWorldState = "overworld";

const player = {
  x: 15 * TILE,
  y: 18 * TILE,
  speed: 2.2,
  dir: "down",
  walking: false,
  frame: 0
};

const keys = {};
let interactPressed = false;

const doorSequence = {
  active: false,
  tx: 0,
  ty: 0,
  stepDx: 0,
  stepDy: 0,
  stepFrames: 0,
  frame: 0,
  targetWorld: "overworld",
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

function setWorld(name) {
  if (name === "overworld") {
    currentMap = overworldMap;
    currentMapW = OVERWORLD_W;
    currentMapH = OVERWORLD_H;
  } else {
    currentMap = interiorMap;
    currentMapW = INTERIOR_W;
    currentMapH = INTERIOR_H;
  }
  worldName = name;
}

function tileAtPixel(px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= currentMapW || ty >= currentMapH) return TILE_TYPES.TREE;
  return currentMap[ty][tx];
}

function isBlockedAtPixel(px, py) {
  const tile = tileAtPixel(px, py);
  return tile === TILE_TYPES.TREE || tile === TILE_TYPES.WALL || 
         tile === TILE_TYPES.SIGNPOST || tile === TILE_TYPES.DOOR;
}

// ============================================================================
// COLLISION SYSTEM
// ============================================================================

function collides(nx, ny) {
  const inset = 5;
  const left = nx + inset;
  const right = nx + TILE - inset;
  const top = ny + inset;
  const bottom = ny + TILE - inset;

  return (
    isBlockedAtPixel(left, top) ||
    isBlockedAtPixel(right, top) ||
    isBlockedAtPixel(left, bottom) ||
    isBlockedAtPixel(right, bottom)
  );
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function collidesWithNPC(nx, ny) {
  const playerRect = {
    x: nx + 5,
    y: ny + 5,
    width: TILE - 10,
    height: TILE - 10
  };

  for (const npc of npcs) {
    if (npc.world !== worldName) continue;
    if (rectsOverlap(playerRect, npc)) return true;
  }
  return false;
}

function doorFromCollision(nx, ny) {
  const inset = 5;
  const corners = [
    [nx + inset, ny + inset],
    [nx + TILE - inset, ny + inset],
    [nx + inset, ny + TILE - inset],
    [nx + TILE - inset, ny + TILE - inset]
  ];

  for (const [px, py] of corners) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= currentMapW || ty >= currentMapH) continue;
    if (currentMap[ty][tx] === TILE_TYPES.DOOR) {
      return { tx, ty };
    }
  }
  return null;
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
  if (worldName !== "interior") return;
  if (!gameFlags.acceptedTraining) return;

  const tilePos = playerTilePosition();
  const onTrainingTile = tilePos.x === trainingTile.x && tilePos.y === trainingTile.y;
  if (!onTrainingTile) return;

  if (playerStats.disciplineLevel >= 2) {
    showDialogue("", "Training complete. Speak to Mr. Hanami.");
    return;
  }

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
    interactPressed = false;
    return;
  }

  const isFreeExploreState = gameState === "overworld" || gameState === "interior";
  if (!isFreeExploreState) return;
  if (isDialogueActive() || choiceState.active || doorSequence.active) return;

  previousWorldState = gameState;
  gameState = "inventory";
  interactPressed = false;
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

  if (worldName === "overworld") {
    doorSequence.targetWorld = "interior";
    doorSequence.targetX = interiorDoor.x * TILE;
    doorSequence.targetY = (interiorDoor.y - 1) * TILE;
  } else {
    doorSequence.targetWorld = "overworld";
    doorSequence.targetX = overworldDoor.x * TILE;
    doorSequence.targetY = (overworldDoor.y + 1) * TILE;
  }

  doorSequence.maxFadeRadius = Math.hypot(canvas.width, canvas.height);
  doorSequence.fadeRadius = doorSequence.maxFadeRadius;
  doorSequence.transitionPhase = "out";
  gameState = "enteringDoor";
  interactPressed = false;
}

// ============================================================================
// INTERACTION SYSTEM
// ============================================================================

function handleInteraction() {
  if (gameState === "inventory") {
    interactPressed = false;
    return;
  }

  if (!interactPressed) return;

  if (isDialogueActive()) {
    advanceDialogue();
    interactPressed = false;
    return;
  }

  if (gameState === "enteringDoor" || gameState === "transition") {
    interactPressed = false;
    return;
  }

  const playerCenterX = player.x + TILE / 2;
  const playerCenterY = player.y + TILE / 2;

  // Check NPC interactions
  for (const npc of npcs) {
    if (npc.world !== worldName) continue;

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
      interactPressed = false;
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
        interactPressed = false;
        return;
      }
    }
  }

  // Check training tile interaction
  if (worldName === "interior" && gameFlags.acceptedTraining) {
    const tilePos = playerTilePosition();
    const onTrainingTile = tilePos.x === trainingTile.x && tilePos.y === trainingTile.y;
    if (onTrainingTile) {
      tryTrainingAction();
      interactPressed = false;
      return;
    }
  }

  interactPressed = false;
}

// ============================================================================
// INPUT HANDLING
// ============================================================================

addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  keys[key] = true;

  if (key === "i" && !e.repeat) {
    toggleInventory();
    return;
  }

  if (choiceState.active) {
    if (!e.repeat && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      const direction = e.key === "ArrowUp" ? -1 : 1;
      const total = choiceState.options.length;
      choiceState.selected = (choiceState.selected + direction + total) % total;
    }

    if (e.key === "Enter" && !e.repeat) {
      confirmChoice();
    }
    return;
  }

  if (e.key === "Enter" && !e.repeat) interactPressed = true;
});

addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// ============================================================================
// GAME UPDATE LOGIC
// ============================================================================

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
    if (doorTile) beginDoorSequence(doorTile);
  }

  if (!collides(player.x, ny) && !collidesWithNPC(player.x, ny)) {
    player.y = ny;
  } else if (dy !== 0) {
    const doorTile = doorFromCollision(player.x, ny);
    if (doorTile) beginDoorSequence(doorTile);
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
      setWorld(doorSequence.targetWorld);
      player.x = doorSequence.targetX;
      player.y = doorSequence.targetY;
      player.dir = doorSequence.targetWorld === "interior" ? "up" : "down";
      doorSequence.transitionPhase = "in";
    }
  } else {
    doorSequence.fadeRadius += 20;
    if (doorSequence.fadeRadius >= doorSequence.maxFadeRadius) {
      doorSequence.fadeRadius = doorSequence.maxFadeRadius;
      doorSequence.active = false;
      gameState = worldName;
    }
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
    }
  }

  // Update game state
  if ((gameState === "overworld" || gameState === "interior") && !isDialogueActive()) {
    updatePlayerMovement();
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
}

// ============================================================================
// CAMERA SYSTEM
// ============================================================================

function camera() {
  const worldW = currentMapW * TILE;
  const worldH = currentMapH * TILE;

  let cx = player.x - canvas.width / 2 + TILE / 2;
  let cy = player.y - canvas.height / 2 + TILE / 2;

  cx = Math.max(0, Math.min(cx, Math.max(0, worldW - canvas.width)));
  cy = Math.max(0, Math.min(cy, Math.max(0, worldH - canvas.height)));

  return { x: cx, y: cy };
}

// ============================================================================
// RENDERING SYSTEM
// ============================================================================

function drawTile(type, x, y, tileX, tileY) {
  switch (type) {
    case TILE_TYPES.GRASS:
      ctx.fillStyle = COLORS.GRASS;
      ctx.fillRect(x, y, TILE, TILE);
      break;

    case TILE_TYPES.PATH:
      ctx.fillStyle = COLORS.PATH;
      ctx.fillRect(x, y, TILE, TILE);
      break;

    case TILE_TYPES.TREE:
      ctx.fillStyle = COLORS.TREE_LIGHT;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = COLORS.TREE_DARK;
      ctx.fillRect(x + 8, y + 8, 16, 16);
      break;

    case TILE_TYPES.WALL:
      ctx.fillStyle = COLORS.WALL;
      ctx.fillRect(x, y, TILE, TILE);
      break;

    case TILE_TYPES.SIGNPOST:
      ctx.fillStyle = COLORS.SIGNPOST_WOOD;
      ctx.fillRect(x + 12, y + 8, 8, 18);
      ctx.fillStyle = COLORS.SIGNPOST_SIGN;
      ctx.fillRect(x + 6, y + 6, 20, 10);
      break;

    case TILE_TYPES.DOOR:
      const isActiveDoor = gameState === "enteringDoor" && tileX === doorSequence.tx && tileY === doorSequence.ty;
      ctx.fillStyle = isActiveDoor ? COLORS.DOOR_ACTIVE : COLORS.DOOR_INACTIVE;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = isActiveDoor ? COLORS.DOOR_FRAME_ACTIVE : COLORS.DOOR_FRAME_INACTIVE;
      ctx.fillRect(x + 6, y + 4, 20, 24);
      ctx.fillStyle = COLORS.DOOR_KNOB;
      ctx.fillRect(x + 18, y + 14, 3, 3);
      break;

    case TILE_TYPES.INTERIOR_FLOOR:
      ctx.fillStyle = COLORS.INTERIOR_FLOOR_LIGHT;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = COLORS.INTERIOR_FLOOR_DARK;
      ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      break;

    case TILE_TYPES.TRAINING_FLOOR:
      ctx.fillStyle = COLORS.TRAINING_FLOOR_LIGHT;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = COLORS.TRAINING_FLOOR_DARK;
      ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      break;
  }
}

function drawPlayer(cam) {
  const px = player.x - cam.x;
  const py = player.y - cam.y;

  ctx.fillStyle = COLORS.PLAYER_BODY;
  ctx.fillRect(px + 6, py + 8, 20, 20);

  ctx.fillStyle = COLORS.PLAYER_FACE;
  ctx.fillRect(px + 10, py + 4, 12, 8);

  const legFrame = Math.floor(player.frame / 12) % 2;
  if (player.walking && legFrame === 0) {
    ctx.fillRect(px + 8, py + 26, 6, 6);
    ctx.fillRect(px + 18, py + 26, 6, 6);
  } else {
    ctx.fillRect(px + 10, py + 26, 6, 6);
    ctx.fillRect(px + 16, py + 26, 6, 6);
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
  if (worldName !== "interior") return;

  for (const npc of npcs) {
    if (npc.world !== worldName) continue;

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

  const boxHeight = choiceState.active ? UI.CHOICE_BOX_HEIGHT : UI.TEXT_BOX_HEIGHT;
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
  const centeredStartY = boxY + (boxHeight - textHeight) / 2 + lineSpacing - 6;

  if (dialogueName) {
    ctx.fillText(dialogueName, 40, boxY + 28);
  }

  for (let i = 0; i < wrappedLines.length; i++) {
    ctx.fillText(wrappedLines[i], textStartX, centeredStartY + i * lineSpacing);
  }

  if (choiceState.active) {
    const optionsStartY = boxY + 90;
    for (let i = 0; i < choiceState.options.length; i++) {
      const prefix = i === choiceState.selected ? "► " : "  ";
      ctx.fillText(prefix + choiceState.options[i], 40, optionsStartY + i * 24);
    }
  }

  const pageComplete = visibleCharacters >= currentDialogueVisibleLength();
  const blink = Math.floor(performance.now() / 500) % 2 === 0;
  if (pageComplete && !choiceState.active && blink) {
    const indicatorText = "►";
    const indicatorX = canvas.width - 20 - 18 - ctx.measureText(indicatorText).width;
    const bobOffsetY = Math.sin(performance.now() * 0.008) * 3;
    const indicatorY = boxY + boxHeight - 12 + bobOffsetY;
    ctx.fillText(indicatorText, indicatorX, indicatorY);
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
  const cam = camera();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw map
  for (let y = 0; y < currentMapH; y++) {
    for (let x = 0; x < currentMapW; x++) {
      const drawX = x * TILE - cam.x;
      const drawY = y * TILE - cam.y;

      if (drawX > -TILE && drawY > -TILE && drawX < canvas.width && drawY < canvas.height) {
        drawTile(currentMap[y][x], drawX, drawY, x, y);
      }
    }
  }

  // Draw game elements
  drawNPCs(cam);
  drawPlayer(cam);
  drawTrainingPopup(cam);
  drawDoorTransition(cam);
  drawInventoryOverlay();
  drawTextbox();
}

// ============================================================================
// GAME LOOP
// ============================================================================

function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

loop();
