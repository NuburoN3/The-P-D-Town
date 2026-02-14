import { AudioManager } from "./music-manager.js";
import { initializeInput, keys, getInteractPressed, clearInteractPressed } from "./src/InputManager.js";
import { collides as collidesAt, collidesWithNPC as collidesWithNPCAt, doorFromCollision as detectDoorCollision } from "./src/CollisionSystem.js";
import { drawTile as drawTileSystem } from "./src/TileSystem.js";
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
const PLAYER_SPRITE_HEIGHT_TILES = 1.15;
const CAMERA_ZOOM = 1.4;
const SPRITE_FRAME_WIDTH = 32;
const SPRITE_FRAME_HEIGHT = 32;
const SPRITE_FRAMES_PER_ROW = 3;

// Tile type IDs
const TILE_TYPES = {
  GRASS: 0,
  PATH: 1,
  TREE: 2,
  WALL: 3,
  SIGNPOST: 4,
  DOOR: 5,
  INTERIOR_FLOOR: 6,
  TRAINING_FLOOR: 7,
  CHERRY_BLOSSOM: 8
};

// Colors for rendering
const COLORS = {
  GRASS: "#2e7d32",
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
// ASSET MANAGER
// ============================================================================

const AssetManager = {
  sprites: {},
  
  loadSprite(name, src) {
    const img = new Image();
    img.src = src;
    this.sprites[name] = img;
    return img;
  },
  
  getSprite(name) {
    return this.sprites[name] || null;
  }
};

// Load all sprites upfront
AssetManager.loadSprite('mr_hanami', 'mr_hanami.png');
AssetManager.loadSprite('protagonist', 'protagonist.png');

// ============================================================================
// BUILDING DEFINITIONS
// ============================================================================

const BUILDING_TYPES = {
  DOJO: 'DOJO',
  HOUSE: 'HOUSE',
  SHOP: 'SHOP',
  SHRINE: 'SHRINE'
};

// Building-specific tile renderers
const buildingRenderers = {
  DOJO: {
    renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol) {
      // Japanese temple aesthetic
      const roofColor = "#c41e3a"; // Traditional temple red
      const roofDark = "#8b0000";
      const woodColor = "#8b6f47"; // Dark wood
      const wallColor = "#d4af7a"; // Light gold/tan
      const trimColor = "#3d2817"; // Dark brown
      
      // Draw main wall body
      ctx.fillStyle = wallColor;
      ctx.fillRect(x, y, TILE, TILE);
      
      // Add temple roof effect on top rows
      if (isTopRow) {
        // Draw pitched roof with multiple layers
        ctx.fillStyle = roofColor;
        ctx.fillRect(x, y, TILE, 10);
        
        // Roof trim/edge
        ctx.fillStyle = roofDark;
        ctx.fillRect(x, y + 9, TILE, 2);
        
        // Subtle eave pattern
        ctx.fillStyle = "rgba(196, 30, 58, 0.6)";
        ctx.fillRect(x + 2, y + 3, TILE - 4, 4);
      }
      
      // Draw wooden posts/pillars on sides
      if (isLeftCol) {
        ctx.fillStyle = woodColor;
        ctx.fillRect(x, y + 6, 4, TILE - 6);
      }
      if (isRightCol) {
        ctx.fillStyle = woodColor;
        ctx.fillRect(x + TILE - 4, y + 6, 4, TILE - 6);
      }
      
      // Add decorative horizontal beams
      if (!isTopRow && !isBottomRow) {
        ctx.fillStyle = woodColor;
        ctx.fillRect(x, y + 8, TILE, 2);
        ctx.fillRect(x, y + 20, TILE, 2);
      }
      
      // Dark trim/frame around edge
      ctx.strokeStyle = trimColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
      
      // Add internal grid pattern for detail
      ctx.strokeStyle = "rgba(61, 40, 23, 0.3)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x + TILE / 2, y + 2);
      ctx.lineTo(x + TILE / 2, y + TILE - 2);
      ctx.stroke();
      
      // Gold/decorative accents on corners
      if (isTopRow && isLeftCol) {
        ctx.fillStyle = "#ffd700";
        ctx.fillRect(x + 2, y + 5, 3, 3);
      }
      if (isTopRow && isRightCol) {
        ctx.fillStyle = "#ffd700";
        ctx.fillRect(x + TILE - 5, y + 5, 3, 3);
      }
    }
  },
  HOUSE: {
    renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol) {
      ctx.fillStyle = "#a1887f";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = "#8d6e63";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, TILE, TILE);
    }
  },
  SHOP: {
    renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol) {
      ctx.fillStyle = "#9b7d6f";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = "#6d5b4c";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, TILE, TILE);
    }
  },
  SHRINE: {
    renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol) {
      ctx.fillStyle = "#8b6f47";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = "#6d5b3f";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, TILE, TILE);
    }
  }
};

// ============================================================================
// TOWN DEFINITIONS
// ============================================================================

const townDefinitions = {
  hanamiTown: {
    id: 'hanamiTown',
    name: 'Hanami Town',
    areaLabel: 'hanamiTown',
    
    buildings: [
      {
        type: BUILDING_TYPES.DOJO,
        x: 13,
        y: 10,
        width: 5,
        height: 4,
        doorPos: { x: 15, y: 13 },
        interiorId: 'hanamiDojo',
        npcId: 'mrHanami'
      }
    ],
    
    overworldMap: null,
    interiorMaps: {
      hanamiDojo: null
    },
    
    generateOverworldMap() {
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

      for (const building of this.buildings) {
        for (let y = building.y; y < building.y + building.height; y++) {
          for (let x = building.x; x < building.x + building.width; x++) {
            map[y][x] = TILE_TYPES.WALL;
          }
        }
      }

      const building = this.buildings[0];
      map[building.doorPos.y][building.doorPos.x] = TILE_TYPES.DOOR;
      map[14][14] = TILE_TYPES.SIGNPOST;

      const treeClusters = [
        [4, 4], [5, 4], [4, 5], [24, 4], [25, 4], [24, 5],
        [5, 23], [4, 24], [24, 23], [25, 24], [22, 20], [8, 20]
      ];
      for (const [x, y] of treeClusters) {
        map[y][x] = TILE_TYPES.TREE;
      }

      // Cherry blossom tree behind the dojo (like in Hanami Town)
      const cherryBlossomPositions = [
        [15, 5], [14, 6], [15, 6], [16, 6], [14, 7], [15, 7], [16, 7]
      ];
      for (const [x, y] of cherryBlossomPositions) {
        if (x >= 0 && x < OVERWORLD_W && y >= 0 && y < OVERWORLD_H) {
          map[y][x] = TILE_TYPES.CHERRY_BLOSSOM;
        }
      }

      return map;
    },

    generateInteriorMap(interiorId) {
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
  }
};

// Initialize town maps
for (const townId in townDefinitions) {
  const town = townDefinitions[townId];
  town.overworldMap = town.generateOverworldMap();
  for (const interiorId in town.interiorMaps) {
    const interior = town.generateInteriorMap(interiorId);
    town.interiorMaps[interiorId] = {
      map: interior.map,
      door: interior.door,
      trainingTile: interior.trainingTile
    };
  }
}

const musicManager = new AudioManager({
  areaTracks: {
    // Play dojo music only when inside the hanamiDojo interior
    hanamiDojo: "Hanami_Game_Audio_BG.wav"
  },
  sfxTracks: {
    enterDoor: "EnterDoor_Sound.wav"
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

// Helper to get town building by coordinates
function getBuilding(townId, tileX, tileY) {
  const town = townDefinitions[townId];
  if (!town) return null;
  
  for (const building of town.buildings) {
    if (tileX >= building.x && tileX < building.x + building.width &&
        tileY >= building.y && tileY < building.y + building.height) {
      return building;
    }
  }
  return null;
}

// Helper to render a building tile
function renderBuildingTile(building, x, y, tileX, tileY) {
  const isTopRow = tileY === building.y;
  const isBottomRow = tileY === building.y + building.height - 1;
  const isLeftCol = tileX === building.x;
  const isRightCol = tileX === building.x + building.width - 1;
  
  const renderer = buildingRenderers[building.type];
  if (renderer) {
    renderer.renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol);
  }
}

// ============================================================================
// ASSETS & NPCs
// ============================================================================

const npcRegistry = {
  mrHanami: {
    id: 'mrHanami',
    name: 'Mr. Hanami',
    spriteName: 'mr_hanami',
    desiredHeightTiles: 1.15,
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
    towns: {
      hanamiTown: {
        interiorId: 'hanamiDojo',
        x: 7 * TILE,
        y: 4 * TILE,
        dir: 'down'
      }
    }
  }
};

const npcs = [];

// Load NPCs for current town
function loadNPCsForTown(townId) {
  npcs.length = 0;
  
  for (const npcId in npcRegistry) {
    const npcDef = npcRegistry[npcId];
    const townData = npcDef.towns[townId];
    
    if (townData) {
      npcs.push({
        id: npcId,
        world: townData.interiorId,
        x: townData.x,
        y: townData.y,
        width: TILE,
        height: TILE,
        desiredHeightTiles: npcDef.desiredHeightTiles,
        name: npcDef.name,
        sprite: AssetManager.getSprite(npcDef.spriteName),
        dialogue: npcDef.dialogue,
        alreadyTrainingDialogue: npcDef.alreadyTrainingDialogue,
        hasTrainingChoice: npcDef.hasTrainingChoice,
        dir: townData.dir
      });
    }
  }
}

// Initialize NPCs for current town
loadNPCsForTown(currentTownId);

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

function areaNameForTown(townId) {
  const town = townDefinitions[townId];
  return town ? town.areaLabel : null;
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
  let textStartY;
  if (choiceState.active) {
    // When choices are active, position text in upper portion to avoid overlap
    const textAreaTop = dialogueName ? boxY + 40 : boxY + 26;
    const textAreaHeight = 50; // Reserve space for options below
    textStartY = textAreaTop + (textAreaHeight - textHeight) / 2 + lineSpacing - 6;
  } else {
    // Center text in the entire box when no choices
    textStartY = boxY + (boxHeight - textHeight) / 2 + lineSpacing - 6;
  }

  if (dialogueName) {
    ctx.fillText(dialogueName, 40, boxY + 28);
  }

  for (let i = 0; i < wrappedLines.length; i++) {
    ctx.fillText(wrappedLines[i], textStartX, textStartY + i * lineSpacing);
  }

  if (choiceState.active) {
    const optionsStartY = boxY + 90;
    for (let i = 0; i < choiceState.options.length; i++) {
      const prefix = i === choiceState.selected ? "? " : "  ";
      ctx.fillText(prefix + choiceState.options[i], 40, optionsStartY + i * 24);
    }
  }

  const pageComplete = visibleCharacters >= currentDialogueVisibleLength();
  const blink = Math.floor(performance.now() / 500) % 2 === 0;
  if (pageComplete && !choiceState.active && blink) {
    const indicatorText = "?";
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

  drawInventoryOverlay();
  drawTextbox();
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




