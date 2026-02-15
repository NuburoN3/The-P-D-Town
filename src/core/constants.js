// ============================================================================
// GAME CONSTANTS
// ============================================================================

export const TILE = 32;
export const PLAYER_SPRITE_HEIGHT_TILES = 1.15;
export const CAMERA_ZOOM = 1.4;
export const SPRITE_FRAME_WIDTH = 32;
export const SPRITE_FRAME_HEIGHT = 32;
export const SPRITE_FRAMES_PER_ROW = 3;

export const AREA_KINDS = Object.freeze({
  OVERWORLD: "overworld",
  INTERIOR: "interior"
});

export const GAME_STATES = Object.freeze({
  OVERWORLD: "overworld",
  INTERIOR: "interior",
  INVENTORY: "inventory",
  ENTERING_DOOR: "enteringDoor",
  TRANSITION: "transition"
});

export function isFreeExploreState(gameState) {
  return gameState === GAME_STATES.OVERWORLD || gameState === GAME_STATES.INTERIOR;
}

// Tile type IDs
export const TILE_TYPES = {
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
export const COLORS = {
  // Slightly darker, low-key grass base
  GRASS: "#4fae57",
  GRASS_DARK: "#387a3f",
  GRASS_SPECKLE: "#3b9b4a",
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
export const UI = {
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
export const TRAINING = {
  DURATION_MS: 2000,
  ANIM_DURATION_MS: 400,
  LEVEL_UP_HOLD_MS: 250,
  XP_PER_SESSION: 5,
  INITIAL_XP_NEEDED: 10,
  XP_INCREMENT: 5,
  LEVEL_UP_MESSAGE: "Your discipline has grown! Level increased!"
};
