import { AudioManager } from "../../music-manager.js";
import {
  TILE,
  OVERWORLD_W,
  OVERWORLD_H,
  INTERIOR_W,
  INTERIOR_H,
  PLAYER_SPRITE_HEIGHT_TILES,
  TRAINING,
  COLORS
} from "../constants.js";
import { AssetManager, initializeAssets } from "../AssetManager.js";
import {
  initializeBuildingRenderers,
  initializeTowns,
  townDefinitions,
  createNPCsForTown
} from "../WorldManager.js";

export function createGameRuntime() {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  initializeBuildingRenderers(ctx, TILE, COLORS);
  initializeAssets();
  initializeTowns();

  const musicManager = new AudioManager({
    areaTracks: {
      hanamiDojo: "Hanami_Game_Audio_BG.wav"
    },
    sfxTracks: {
      enterDoor: "EnterDoor_Sound.wav",
      itemUnlock: "Item_Unlock.wav",
      walking: "walking_sound.wav",
      collision: "collision_sound.wav"
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

  const currentTownId = "hanamiTown";
  const currentTown = townDefinitions[currentTownId];
  const currentAreaType = "overworld";
  const currentMap = currentTown.overworldMap;
  const currentMapW = OVERWORLD_W;
  const currentMapH = OVERWORLD_H;

  const npcs = createNPCsForTown(currentTownId, {
    tileSize: TILE,
    getSprite: (name) => AssetManager.getSprite(name)
  });

  const gameState = "overworld";
  const previousWorldState = "overworld";

  const player = {
    x: 15 * TILE,
    y: 18 * TILE,
    speed: 2.2,
    dir: "down",
    walking: false,
    frame: 0,
    animTimer: 0,
    animFrame: 1,
    sprite: AssetManager.getSprite("protagonist"),
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
    targetAreaType: "",
    targetX: 0,
    targetY: 0,
    transitionPhase: "out",
    fadeRadius: 0,
    maxFadeRadius: 0
  };

  return {
    canvas,
    ctx,
    musicManager,
    state: {
      gameFlags,
      playerInventory,
      playerStats,
      trainingPopup,
      itemAlert,
      inventoryHint,
      currentTownId,
      currentTown,
      currentAreaType,
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
