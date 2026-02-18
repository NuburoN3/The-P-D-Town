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
  INTRO_CUTSCENE: "introCutscene",
  TITLE_SCREEN: "titleScreen",
  OVERWORLD: "overworld",
  INTERIOR: "interior",
  INVENTORY: "inventory",
  ENTERING_DOOR: "enteringDoor",
  TRANSITION: "transition",
  PLAYER_DEFEATED: "playerDefeated",
  BAR_MINIGAME: "barMinigame",
  PAUSE_MENU: "pauseMenu",
  ATTRIBUTES: "attributes",
  SETTINGS: "settings"
});

export const BRANDING = Object.freeze({
  TITLE: "PURPOSE & DIRECTION",
  STUDIO: "Zeta Lotus Games"
});

export const ASSET_KEYS = Object.freeze({
  TITLE_HERO_IMAGE: "panddcoverart"
});

export const ASSET_PATHS = Object.freeze({
  TITLE_HERO_IMAGE: "assets/art/panddcoverart.jpg"
});

export const AUDIO_TRACKS = Object.freeze({
  TITLE_SCREEN: "assets/sprites/StartScreen_Audio.wav",
  HANAMI: "assets/audio/Hanami_Game_Audio_BG.wav",
  ANTICIPATION: "assets/audio/Anticipation_Game_Audio_BG.wav"
});

export function isFreeExploreState(gameState) {
  return gameState === GAME_STATES.OVERWORLD || gameState === GAME_STATES.INTERIOR;
}

// Tile type IDs
export const TILE_TYPES = Object.freeze({
  GRASS: 0,
  PATH: 1,
  TREE: 2,
  WALL: 3,
  SIGNPOST: 4,
  DOOR: 5,
  INTERIOR_FLOOR: 6,
  TRAINING_FLOOR: 7,
  CHERRY_BLOSSOM: 8,
  BAR_FLOOR: 9,
  BAR_COUNTER: 10,
  BAR_STOOL: 11,
  BAR_TABLE: 12,
  BAR_DECOR: 13,
  BAR_POSTER: 14,
  PORCH: 15,
  DOJO_POST: 16,
  CHURCH_STAINED_GLASS: 17,
  HILL: 18,
  BED: 19,
  TV: 20,
  HIFI: 21
});

// Colors for rendering
export const COLORS = {
  GRASS: "#5dbf5b",
  GRASS_LIGHT: "#7bd26f",
  GRASS_MID: "#4ea955",
  GRASS_DARK: "#2f7f3d",
  GRASS_DEEP: "#236734",
  GRASS_SPECKLE: "#3f9f4b",
  PATH: "#c9ab74",
  PATH_LIGHT: "#dbc090",
  PATH_DARK: "#a18456",
  PATH_EDGE: "#8d724b",
  TREE_LIGHT: "#4fba5e",
  TREE_MID: "#2f9345",
  TREE_DARK: "#1e6f34",
  TREE_DEEP: "#145227",
  TREE_TRUNK: "#7b5536",
  TREE_TRUNK_DARK: "#5d3f28",
  WALL: "#8d6e63",
  SIGNPOST_WOOD: "#6d4c41",
  SIGNPOST_SIGN: "#d7ccc8",
  DOOR_INACTIVE: "#5d4037",
  DOOR_ACTIVE: "#ffcc80",
  DOOR_FRAME_INACTIVE: "#8d6e63",
  DOOR_FRAME_ACTIVE: "#ffe0b2",
  DOOR_KNOB: "#3e2723",
  INTERIOR_FLOOR_LIGHT: "#bfa784",
  INTERIOR_FLOOR_DARK: "#9e8768",
  INTERIOR_FLOOR_TRIM: "#7f694f",
  BAR_FLOOR_LIGHT: "#7c4f31",
  BAR_FLOOR_DARK: "#613a24",
  BAR_FLOOR_TRIM: "#4b2d1c",
  BAR_COUNTER_TOP: "#8f5f3a",
  BAR_COUNTER_FRONT: "#6e432a",
  BAR_COUNTER_EDGE: "#b38354",
  BAR_STOOL_SEAT: "#a47042",
  BAR_STOOL_LEG: "#5f3a24",
  BAR_TABLE_TOP: "#8c5c38",
  BAR_TABLE_LEG: "#4f311f",
  BAR_DECOR: "#d6ab58",
  BAR_POSTER_BG: "#c94b3b",
  BAR_POSTER_ACCENT: "#f4e0a8",
  PORCH_WOOD_DARK: "#7a583a",
  PORCH_WOOD_MID: "#9e7750",
  PORCH_WOOD_LIGHT: "#c39a70",
  DOJO_POST_WOOD_DARK: "#4c2e1f",
  DOJO_POST_WOOD_MID: "#714631",
  DOJO_POST_ROPE: "#dbc48a",
  CHURCH_GLASS_FRAME: "#4b3b33",
  CHURCH_GLASS_LEAD: "#2f2f38",
  HILL_TOP_LIGHT: "#86be72",
  HILL_TOP_DARK: "#6eaa5b",
  HILL_CLIFF_LIGHT: "#8a6a4a",
  HILL_CLIFF_DARK: "#62462f",
  BED_FRAME: "#6b4a30",
  BED_SHEET: "#f1e9d2",
  BED_BLANKET: "#b56576",
  TV_FRAME: "#27272d",
  TV_SCREEN: "#5ea2b8",
  TV_GLOW: "rgba(170, 233, 255, 0.35)",
  HIFI_BODY: "#3d3b46",
  HIFI_SPEAKER: "#222127",
  HIFI_ACCENT: "#93b7d8",
  TRAINING_FLOOR_LIGHT: "#8d7964",
  TRAINING_FLOOR_DARK: "#6d5b4c",
  CHERRY_LIGHT: "#f4bfd5",
  CHERRY_MID: "#d982ad",
  CHERRY_DARK: "#b45687",
  PLAYER_BODY: "#2b2b2b",
  PLAYER_FACE: "#ffffff",
  NPC_BODY: "#7b1fa2",
  NPC_FACE: "#ffe0b2",
  NPC_LEGS: "#4a148c",
  DIALOGUE_BG: "rgba(0,0,0,0.75)",
  DIALOGUE_BORDER: "#ffffff",
  TEXT: "#ffffff",
  TEXT_SHADOW: "rgba(0,0,0,0.4)",
  POPUP_BG: "rgba(12,18,28,0.9)",
  POPUP_BORDER: "#ffffff",
  POPUP_BAR_BG: "#263238",
  POPUP_BAR_FILL: "#4caf50",
  PANEL_SURFACE_TOP: "#2f3f35",
  PANEL_SURFACE_BOTTOM: "#1f2c25",
  PANEL_INNER: "#3f5144",
  PANEL_BORDER_LIGHT: "#d8c590",
  PANEL_BORDER_DARK: "#665435",
  PANEL_ACCENT: "#b29b65",
  INVENTORY_BG: "rgba(22,28,38,0.96)",
  INVENTORY_OVERLAY: "rgba(0,0,0,0.6)",
  INVENTORY_BAR_FILL: "#66bb6a",
  INVENTORY_SLOT_BG: "rgba(255,255,255,0.1)",
  INVENTORY_SLOT_BORDER: "#d8bf89",
  SHADOW: "rgba(0,0,0,0.25)",
  GROUND_SHADOW: "rgba(0,0,0,0.2)",
  AMBIENT_TOP: "rgba(255, 234, 192, 0.11)",
  AMBIENT_BOTTOM: "rgba(58, 91, 52, 0.18)",
  VIGNETTE: "rgba(0,0,0,0.15)"
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
