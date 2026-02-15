import { AudioManager } from "../audio/AudioManager.js";
import {
  TILE,
  PLAYER_SPRITE_HEIGHT_TILES,
  TRAINING,
  GAME_STATES,
  AREA_KINDS
} from "../core/constants.js";
import { createDefaultAssetManager } from "../core/AssetManager.js";
import {
  initializeBuildingRenderers,
  createWorldService
} from "../WorldManager.js";

export function createGameRuntime() {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  initializeBuildingRenderers(ctx, TILE);

  const assets = createDefaultAssetManager();
  const worldService = createWorldService({
    tileSize: TILE,
    getSprite: (name) => assets.getSprite(name)
  });

  const initialTownId = Object.keys(worldService.towns)[0];
  if (!initialTownId) {
    throw new Error("World configuration has no towns.");
  }

  const initialSpawn = worldService.getInitialSpawn(initialTownId);
  if (!initialSpawn) {
    throw new Error(`Town '${initialTownId}' has no valid default spawn.`);
  }

  const initialArea = worldService.getArea(initialTownId, initialSpawn.areaId);
  if (!initialArea) {
    throw new Error(`Spawn area '${initialSpawn.areaId}' is missing for town '${initialTownId}'.`);
  }

  const musicManager = new AudioManager({
    areaTracks: worldService.areaTracks,
    sfxTracks: {
      enterDoor: "assets/audio/EnterDoor_Sound.wav",
      itemUnlock: "assets/audio/Item_Unlock.wav",
      walking: "assets/audio/walking_sound.wav",
      collision: "assets/audio/collision_sound.wav",
      menuOpen: "assets/audio/PauseMenu_Sound.wav",
      menuMove: "assets/audio/collision_sound.wav",
      menuConfirm: "assets/audio/EnterDoor_Sound.wav",
      menuSelect: "assets/audio/MenuSelect_Sound.wav"
    },
    fadeDurationMs: 800
  });
  musicManager.attachUnlockHandlers();

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

  const itemAlert = {
    active: false,
    text: "",
    startedAt: 0,
    durationMs: 3000
  };

  const inventoryHint = {
    active: false,
    startedAt: 0,
    durationMs: 4500
  };

  const currentTownId = initialTownId;
  const currentAreaId = initialSpawn.areaId;
  const currentMap = initialArea.map;
  const currentMapW = initialArea.width;
  const currentMapH = initialArea.height;

  const npcs = worldService.createNPCsForTown(currentTownId);

  const initialGameState =
    initialArea.kind === AREA_KINDS.OVERWORLD ? GAME_STATES.OVERWORLD : GAME_STATES.INTERIOR;
  const gameState = initialGameState;
  const previousWorldState = initialGameState;

  const player = {
    x: initialSpawn.x,
    y: initialSpawn.y,
    speed: 2.2,
    dir: initialSpawn.dir,
    walking: false,
    frame: 0,
    animTimer: 0,
    animFrame: 1,
    sprite: assets.getSprite("protagonist"),
    desiredHeightTiles: PLAYER_SPRITE_HEIGHT_TILES,
    isTraining: false,
    handstandAnimTimer: 0,
    handstandFrame: 0
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
    targetTownId: "",
    targetAreaId: "",
    targetX: 0,
    targetY: 0,
    targetDir: "down",
    transitionPhase: "out",
    fadeRadius: 0,
    maxFadeRadius: 0
  };

  return {
    canvas,
    ctx,
    assets,
    worldService,
    musicManager,
    state: {
      gameFlags,
      playerInventory,
      playerStats,
      trainingPopup,
      itemAlert,
      inventoryHint,
      currentTownId,
      currentAreaId,
      currentMap,
      currentMapW,
      currentMapH,
      npcs,
      gameState,
      previousWorldState,
      player,
      cam,
      doorSequence
    }
  };
}
