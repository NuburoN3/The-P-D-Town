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
import { createDefaultTownProgress } from "./progression/progressDefaults.js";

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
      menuSelect: "assets/audio/MenuSelect_Sound.wav",
      attackSwing: "assets/audio/MenuSelect_Sound.wav",
      enemyTelegraph: "assets/audio/collision_sound.wav",
      hitImpact: "assets/audio/Item_Unlock.wav",
      hurt: "assets/audio/collision_sound.wav",
      saveGame: "assets/audio/EnterDoor_Sound.wav",
      loadGame: "assets/audio/PauseMenu_Sound.wav",
      uiError: "assets/audio/collision_sound.wav"
    },
    fadeDurationMs: 800
  });
  musicManager.attachUnlockHandlers();

  const gameFlags = {
    acceptedTraining: false,
    completedTraining: false,
    taikoHouseUnlocked: false,
    townRumorResolved: false,
    townProgress: {
      hanamiTown: createDefaultTownProgress()
    }
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
  const enemies = worldService.createEnemiesForTown(currentTownId);

  const initialGameState =
    initialArea.kind === AREA_KINDS.OVERWORLD ? GAME_STATES.OVERWORLD : GAME_STATES.INTERIOR;
  const gameState = initialGameState;
  const previousWorldState = initialGameState;

  const player = {
    x: initialSpawn.x,
    y: initialSpawn.y,
    spawnX: initialSpawn.x,
    spawnY: initialSpawn.y,
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
    handstandFrame: 0,
    maxHp: 100,
    hp: 100,
    invulnerableUntil: 0,
    invulnerableMs: 620,
    attackState: "idle",
    attackStartedAt: 0,
    attackActiveAt: 0,
    attackActiveUntil: 0,
    attackRecoveryUntil: 0,
    lastAttackAt: -Infinity,
    attackCooldownMs: 170,
    attackWindupMs: 45,
    attackActiveMs: 80,
    attackRecoveryMs: 85,
    attackRange: TILE * 0.9,
    attackHitRadius: TILE * 0.7,
    attackDamage: 20,
    equippedAttackId: "lightSlash",
    requestedAttackId: null
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
    maxFadeRadius: 0,
    fadeStep: 34
  };

  const playerDefeatSequence = {
    active: false,
    phase: "idle",
    phaseStartedAt: 0,
    fallProgress: 0,
    overlayAlpha: 0,
    destination: null,
    fallDurationMs: 420,
    fadeOutDurationMs: 360,
    blackoutHoldMs: 1000,
    fadeInDurationMs: 420
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
      enemies,
      gameState,
      previousWorldState,
      player,
      cam,
      doorSequence,
      playerDefeatSequence
    }
  };
}
