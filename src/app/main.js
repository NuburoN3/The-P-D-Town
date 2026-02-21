import {
  TILE,
  CAMERA_ZOOM,
  SPRITE_FRAME_WIDTH,
  SPRITE_FRAME_HEIGHT,
  SPRITE_FRAMES_PER_ROW,
  COLORS,
  UI,
  TRAINING,
  AREA_KINDS,
  GAME_STATES,
  TILE_TYPES,
  AUDIO_TRACKS,
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
import { normalizeGlobalStoryFlags, normalizeTownProgress } from "../game/progression/progressDefaults.js";
import { isFountainSpriteOpaqueAtWorldPixel } from "../world/buildings/fountainSprite.js";

const { canvas, ctx, assets, worldService, musicManager, state } = createGameRuntime();

const {
  gameFlags,
  playerInventory,
  playerCurrency,
  playerEquipment,
  playerStats,
  trainingPopup,
  itemAlert,
  inventoryHint,
  npcs,
  enemies,
  player,
  cam,
  doorSequence,
  playerDefeatSequence,
  leftoversState
} = state;

const TITLE_SCREEN_MUSIC_KEY = "__title_screen_music__";
const TITLE_SCREEN_MUSIC_SRC = AUDIO_TRACKS.TITLE_SCREEN;
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
let inventoryOpenedFromPauseMenu = false;
const setInventoryOpenedFromPauseMenu = (openedFromPause) => {
  inventoryOpenedFromPauseMenu = Boolean(openedFromPause);
};
const isInventoryOpenedFromPauseMenu = () => inventoryOpenedFromPauseMenu;
const getSimulationGameState = (stateToEvaluate = gameState) => {
  if (stateToEvaluate !== GAME_STATES.INVENTORY || inventoryOpenedFromPauseMenu) return stateToEvaluate;
  if (isFreeExploreState(previousWorldState)) return previousWorldState;
  const currentAreaKind = worldService.getAreaKind(currentTownId, currentAreaId);
  return currentAreaKind === AREA_KINDS.OVERWORLD ? GAME_STATES.OVERWORLD : GAME_STATES.INTERIOR;
};
const closeInventoryToWorld = () => {
  if (gameState !== GAME_STATES.INVENTORY) return;
  setInventoryOpenedFromPauseMenu(false);
  leftoversUiState.active = false;
  leftoversUiState.leftoverId = "";
  leftoversUiState.openedFromInteraction = false;
  leftoversUiState.requestCloseInventory = false;
  if (interactionSystem) interactionSystem.toggleInventory();
};
const openInventoryFromPauseMenu = () => {
  setInventoryOpenedFromPauseMenu(true);
  gameState = GAME_STATES.INVENTORY;
};
const mouseUiState = {
  x: 0,
  y: 0,
  insideCanvas: false,
  sprintPressed: false,
  inventoryLeftDown: false,
  inventoryDragStartRequest: false,
  inventoryDragReleaseRequest: false,
  inventoryDragItemName: "",
  inventoryDragSource: "",
  inventoryDragSourceSlot: "",
  inventoryClickRequest: false,
  inventoryDoubleClickRequest: false,
  inventoryDetailsRequest: false,
  inventoryDetailsIndex: -1,
  inventoryDetailsSource: "",
  inventoryDetailsEquipmentSlot: "",
  inventoryDetailsAnchorX: -1,
  inventoryDetailsAnchorY: -1,
  inventoryDetailsCloseGraceUntil: 0,
  inventoryPage: 0,
  inventorySlotOrder: [],
  inventoryPanelDragTarget: "",
  inventoryPanelDragOffsetX: 0,
  inventoryPanelDragOffsetY: 0
};
let menuStateController = null;
let interactionInputLockedUntil = 0;
const openPauseMenu = () => {
  setInventoryOpenedFromPauseMenu(false);
  if (menuStateController) menuStateController.openPauseMenu();
};
const resumeFromPauseMenu = () => {
  setInventoryOpenedFromPauseMenu(false);
  if (menuStateController) menuStateController.resumeFromPauseMenu();
};
const returnToPauseMenu = () => {
  setInventoryOpenedFromPauseMenu(false);
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
    if (isHanamiDojoExitControlLockActive()) return;
    if (interactionSystem) {
      setInventoryOpenedFromPauseMenu(false);
      interactionSystem.toggleInventory();
    }
  },
  shouldHandleInput: () => !(
    isHanamiDojoExitControlLockActive() ||
    gameState === GAME_STATES.TITLE_SCREEN ||
    gameState === GAME_STATES.PAUSE_MENU ||
    gameState === GAME_STATES.INVENTORY ||
    gameState === GAME_STATES.ATTRIBUTES ||
    gameState === GAME_STATES.SETTINGS ||
    gameState === GAME_STATES.PLAYER_DEFEATED
  )
});

const collisionService = new CollisionService({
  tileSize: TILE,
  isTileBlocked: (tx, ty, px, py) => {
    const building = worldService.getBuilding(currentTownId, currentAreaId, tx, ty);
    if (!building || building.type !== "FOUNTAIN") return false;
    return isFountainSpriteOpaqueAtWorldPixel({
      building,
      tileSize: TILE,
      worldX: px,
      worldY: py
    });
  }
});

const movementSystem = createMovementSystem({
  keys: input.keys,
  getActionPressed: (action) => input.isActionPressed(action),
  getSprintPressed: () => mouseUiState.sprintPressed,
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
  lastEnemyTelegraphAt: 0,
  playerDamageFlashUntil: 0
};

const objectiveState = {
  id: "",
  text: "",
  updatedAt: 0,
  marker: null,
  markerArea: null
};

const OBEY_SKILL_ID = "obey";
const OBEY_CAST_RADIUS_TILES = 4;
const OBEY_CHANNEL_DURATION_MS = 10000;
const OBEY_PET_FOLLOW_DISTANCE_TILES = 1;
const OBEY_PET_TELEPORT_DISTANCE_TILES = 8;

const obeyState = {
  active: false,
  startedAt: 0,
  durationMs: OBEY_CHANNEL_DURATION_MS,
  targetNpcId: "",
  targetTownId: "",
  targetAreaId: "",
  petId: "",
  petSpriteName: "",
  petWidth: 25,
  petHeight: 16,
  lastFollowUpdateAt: 0
};

const uiMotionState = {
  minimapRevealAt: performance.now()
};

const inventoryUiLayout = {
  inventoryPanelX: null,
  inventoryPanelY: null,
  equipmentPanelX: null,
  equipmentPanelY: null
};
const leftoversUiState = {
  active: false,
  leftoverId: "",
  openedFromInteraction: false,
  requestCloseInventory: false
};

const minimapDiscoveryState = {
  discoveredDoors: {}
};

const saveNoticeState = {
  active: false,
  text: "",
  type: "save",
  startedAt: 0,
  durationMs: 1700
};

const combatRewardPanel = {
  active: false,
  title: "",
  lines: [],
  startedAt: 0,
  durationMs: 2200,
  queue: []
};
const SKILL_SLOT_COUNT = 9;
const HUD_FEEDBACK_DURATION_MS = 420;

const PAT_INN_TOWN_ID = "hanamiTown";
const PAT_INN_AREA_ID = "patBnBDownstairs";
const PAT_INNKEEPER_ID = "innkeeperPat";
const HANAMI_NPC_ID = "mrHanami";
const HANAMI_DOJO_AREA_ID = "hanamiDojo";
const HANAMI_DOJO_UPSTAIRS_AREA_ID = "hanamiDojoUpstairs";
const HANAMI_DOJO_UPSTAIRS_DOOR_X = 9;
const HANAMI_DOJO_UPSTAIRS_DOOR_Y = 3;
const HANAMI_DOJO_EXIT_X = 6 * TILE;
const HANAMI_DOJO_EXIT_Y = 9 * TILE;
const BASE_COMBAT_XP_NEEDED = 150;
const COMBAT_XP_GROWTH_MULTIPLIER = 1.25;
const patInnIntroState = {
  pendingStart: false,
  active: false,
  phase: "idle",
  targetX: 0,
  targetY: 0,
  homeX: 0,
  homeY: 0,
  dialogueAutoCloseAt: 0,
  lastUpdateAt: 0,
  previousCanRoam: false
};
const hanamiDojoExitState = {
  active: false,
  lastUpdateAt: 0,
  pathTiles: [],
  nextPathIndex: 0,
  nextRepathAt: 0,
  ignoreDynamicBlockers: false,
  startedAt: 0,
  lastProgressAt: 0,
  lastX: 0,
  lastY: 0
};
const doorAccessNoticeState = {
  active: false,
  text: "",
  townId: "",
  areaId: "",
  until: 0
};

function getCombatXpNeededForLevel(level) {
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  let xpNeeded = BASE_COMBAT_XP_NEEDED;
  for (let currentLevel = 1; currentLevel < safeLevel; currentLevel += 1) {
    xpNeeded = Math.ceil(xpNeeded * COMBAT_XP_GROWTH_MULTIPLIER);
  }
  return xpNeeded;
}

function ensurePlayerSkillState(targetPlayer) {
  if (!targetPlayer || typeof targetPlayer !== "object") return;

  targetPlayer.maxMana = Number.isFinite(targetPlayer.maxMana) ? Math.max(1, targetPlayer.maxMana) : 10;
  targetPlayer.mana = Number.isFinite(targetPlayer.mana)
    ? Math.max(0, Math.min(targetPlayer.maxMana, targetPlayer.mana))
    : targetPlayer.maxMana;
  targetPlayer.manaRegenPerSecond = Number.isFinite(targetPlayer.manaRegenPerSecond)
    ? Math.max(0, targetPlayer.manaRegenPerSecond)
    : 0.65;

  const currentSlots = Array.isArray(targetPlayer.skillSlots) ? targetPlayer.skillSlots : [];
  const normalizedSlots = [];
  for (let i = 0; i < SKILL_SLOT_COUNT; i++) {
    const source = currentSlots[i] && typeof currentSlots[i] === "object" ? currentSlots[i] : {};
    const normalizedSkillId = source.id || null;
    const normalizedManaCost = Number.isFinite(source.manaCost) ? Math.max(0, source.manaCost) : 0;
    normalizedSlots.push({
      slot: i + 1,
      id: normalizedSkillId,
      name: String(source.name || ""),
      manaCost: normalizedSkillId === "obey" ? 5 : normalizedManaCost,
      cooldownMs: Number.isFinite(source.cooldownMs) ? Math.max(0, source.cooldownMs) : 0,
      lastUsedAt: Number.isFinite(source.lastUsedAt) ? source.lastUsedAt : -Infinity
    });
  }
  targetPlayer.skillSlots = normalizedSlots;
  targetPlayer.lastSkillUsedAt = Number.isFinite(targetPlayer.lastSkillUsedAt) ? targetPlayer.lastSkillUsedAt : -Infinity;
  targetPlayer.skillHudFeedback = targetPlayer.skillHudFeedback && typeof targetPlayer.skillHudFeedback === "object"
    ? targetPlayer.skillHudFeedback
    : { slotIndex: -1, status: "", until: 0 };
}

function setSkillHudFeedback(slotIndex, status, durationMs = HUD_FEEDBACK_DURATION_MS) {
  player.skillHudFeedback = {
    slotIndex,
    status,
    until: performance.now() + Math.max(120, durationMs)
  };
}

function getNearestObeyAnimalInRange(radiusTiles = OBEY_CAST_RADIUS_TILES) {
  const radiusPx = Math.max(TILE, radiusTiles * TILE);
  const radiusSq = radiusPx * radiusPx;
  const playerCenterX = player.x + TILE * 0.5;
  const playerCenterY = player.y + TILE * 0.5;
  let nearest = null;
  let nearestDistSq = Infinity;

  for (const npc of npcs) {
    if (!npc || npc.world !== currentAreaId) continue;
    if (!npc.obeyAnimal) continue;
    if (npc.isPlayerPet) continue;
    const npcCenterX = npc.x + (Number.isFinite(npc.width) ? npc.width : TILE) * 0.5;
    const npcCenterY = npc.y + (Number.isFinite(npc.height) ? npc.height : TILE) * 0.5;
    const dx = npcCenterX - playerCenterX;
    const dy = npcCenterY - playerCenterY;
    const distSq = dx * dx + dy * dy;
    if (distSq > radiusSq) continue;
    if (distSq < nearestDistSq) {
      nearest = npc;
      nearestDistSq = distSq;
    }
  }

  return nearest;
}

function cancelObeyChannel() {
  obeyState.active = false;
  obeyState.startedAt = 0;
  obeyState.targetNpcId = "";
  obeyState.targetTownId = "";
  obeyState.targetAreaId = "";
}

function beginObeyChannel(targetNpc) {
  if (!targetNpc) return false;
  obeyState.active = true;
  obeyState.startedAt = performance.now();
  obeyState.durationMs = OBEY_CHANNEL_DURATION_MS;
  obeyState.targetNpcId = targetNpc.id || "";
  obeyState.targetTownId = currentTownId;
  obeyState.targetAreaId = currentAreaId;
  return true;
}

function completeObeyChannelIfReady(now) {
  if (!obeyState.active || !Number.isFinite(obeyState.startedAt)) return;
  const elapsed = Math.max(0, now - obeyState.startedAt);
  if (elapsed < obeyState.durationMs) return;

  const targetNpc = npcs.find((npc) =>
    npc &&
    npc.id === obeyState.targetNpcId &&
    npc.world === obeyState.targetAreaId &&
    npc.obeyAnimal
  );
  if (!targetNpc) {
    cancelObeyChannel();
    return;
  }

  targetNpc.canRoam = false;
  targetNpc.blocking = false;
  targetNpc.isPlayerPet = true;
  targetNpc.petOwner = "player";
  targetNpc.world = currentAreaId;
  obeyState.petId = targetNpc.id;
  obeyState.petSpriteName = targetNpc.spriteName || "possum";
  obeyState.petWidth = Number.isFinite(targetNpc.spriteWidth) ? targetNpc.spriteWidth : 25;
  obeyState.petHeight = Number.isFinite(targetNpc.spriteHeight) ? targetNpc.spriteHeight : 16;
  cancelObeyChannel();

  itemAlert.active = true;
  itemAlert.text = "A Possum now follows you as your pet.";
  itemAlert.startedAt = now;
  vfxSystem.spawn("pickupGlow", {
    x: player.x + TILE / 2,
    y: player.y + TILE * 0.35,
    size: 30
  });
}

function ensurePetExistsInCurrentArea() {
  if (!obeyState.petId) return null;
  let pet = npcs.find((npc) => npc && npc.id === obeyState.petId);
  if (pet) return pet;

  const petSpriteName = obeyState.petSpriteName || "possum";
  pet = {
    id: obeyState.petId,
    name: "Possum",
    world: currentAreaId,
    x: player.x - TILE,
    y: player.y,
    width: TILE,
    height: TILE,
    dir: "left",
    canRoam: false,
    blocking: false,
    obeyAnimal: true,
    isPlayerPet: true,
    petOwner: "player",
    spriteName: petSpriteName,
    sprite: assets.getSprite(petSpriteName),
    spriteWidth: obeyState.petWidth,
    spriteHeight: obeyState.petHeight,
    dialogue: ["*Your possum companion watches you closely.*"],
    hasTrainingChoice: false
  };
  npcs.push(pet);
  return pet;
}

function updatePetFollow(now) {
  const pet = ensurePetExistsInCurrentArea();
  if (!pet) return;
  if (pet.world !== currentAreaId) pet.world = currentAreaId;
  pet.canRoam = false;
  pet.blocking = false;
  pet.isPlayerPet = true;

  const last = Number.isFinite(obeyState.lastFollowUpdateAt) ? obeyState.lastFollowUpdateAt : now;
  const dtScale = Math.max(0, Math.min(3, (now - last) / 16.667));
  obeyState.lastFollowUpdateAt = now;

  const dirVec = player.dir === "up"
    ? { x: 0, y: -1 }
    : player.dir === "left"
      ? { x: -1, y: 0 }
      : player.dir === "right"
        ? { x: 1, y: 0 }
        : { x: 0, y: 1 };
  const sideVec = { x: -dirVec.y, y: dirVec.x };
  const desiredDist = OBEY_PET_FOLLOW_DISTANCE_TILES * TILE;
  const targetX = player.x - dirVec.x * desiredDist + sideVec.x * TILE * 0.28;
  const targetY = player.y - dirVec.y * desiredDist + sideVec.y * TILE * 0.28;

  const dx = targetX - pet.x;
  const dy = targetY - pet.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.001) return;

  if (distance > OBEY_PET_TELEPORT_DISTANCE_TILES * TILE) {
    pet.x = targetX;
    pet.y = targetY;
    return;
  }

  const step = Math.min(distance, Math.max(0.35, 1.8 * dtScale));
  const vx = (dx / distance) * step;
  const vy = (dy / distance) * step;

  const tryX = pet.x + vx;
  const tryY = pet.y + vy;
  if (!collisionService.collidesAt(tryX, pet.y, currentMap, currentMapW, currentMapH)) {
    pet.x = tryX;
  }
  if (!collisionService.collidesAt(pet.x, tryY, currentMap, currentMapW, currentMapH)) {
    pet.y = tryY;
  }

  if (Math.abs(vx) >= Math.abs(vy)) {
    pet.dir = vx >= 0 ? "right" : "left";
  } else {
    pet.dir = vy >= 0 ? "down" : "up";
  }
}

function updateObeySystem(now) {
  if (
    obeyState.active &&
    (
      !isFreeExploreState(getSimulationGameState(gameState)) ||
      obeyState.targetTownId !== currentTownId ||
      obeyState.targetAreaId !== currentAreaId
    )
  ) {
    cancelObeyChannel();
  }

  if (obeyState.active) {
    completeObeyChannelIfReady(now);
  }

  if (obeyState.petId) {
    updatePetFollow(now);
  }
}

function tryActivateSkillSlot(slotIndex) {
  ensurePlayerSkillState(player);
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= SKILL_SLOT_COUNT) return false;
  if (!isFreeExploreState(gameState)) return false;
  if (isDialogueActive() || choiceState.active) return false;
  if (player.attackState && player.attackState !== "idle") return false;

  const slot = player.skillSlots[slotIndex];
  const now = performance.now();
  if (!slot || !slot.id) {
    setSkillHudFeedback(slotIndex, "empty");
    return false;
  }

  if (slot.id === OBEY_SKILL_ID) {
    if (obeyState.active) {
      setSkillHudFeedback(slotIndex, "used");
      return false;
    }
    const obeyTarget = getNearestObeyAnimalInRange();
    if (!obeyTarget) {
      setSkillHudFeedback(slotIndex, "empty");
      return false;
    }
  }

  const manaCost = Number.isFinite(slot.manaCost) ? Math.max(0, slot.manaCost) : 0;
  if (player.mana < manaCost) {
    setSkillHudFeedback(slotIndex, "noMana");
    return false;
  }

  if (slot.id === OBEY_SKILL_ID) {
    const obeyTarget = getNearestObeyAnimalInRange();
    if (!beginObeyChannel(obeyTarget)) {
      setSkillHudFeedback(slotIndex, "empty");
      return false;
    }
  }

  player.mana = Math.max(0, player.mana - manaCost);
  slot.lastUsedAt = now;
  player.lastSkillUsedAt = now;
  setSkillHudFeedback(slotIndex, "used");
  return true;
}

function regenerateMana(now) {
  ensurePlayerSkillState(player);
  if (!isFreeExploreState(gameState)) {
    player.lastManaRegenTickAt = now;
    return;
  }
  if (!Number.isFinite(player.maxMana) || player.maxMana <= 0) return;
  if (player.mana >= player.maxMana) return;

  const previousTick = Number.isFinite(player.lastManaRegenTickAt) ? player.lastManaRegenTickAt : now;
  const dtMs = Math.max(0, now - previousTick);
  player.lastManaRegenTickAt = now;
  if (dtMs <= 0) return;

  const regenPerSecond = Number.isFinite(player.manaRegenPerSecond) ? player.manaRegenPerSecond : 0;
  if (regenPerSecond <= 0) return;
  player.mana = Math.min(player.maxMana, player.mana + (regenPerSecond * dtMs) / 1000);
}

ensurePlayerSkillState(player);
player.lastManaRegenTickAt = performance.now();

if (!Number.isFinite(playerStats.combatLevel) || playerStats.combatLevel < 1) {
  playerStats.combatLevel = 1;
}
if (!Number.isFinite(playerStats.combatXP) || playerStats.combatXP < 0) {
  playerStats.combatXP = 0;
}
if (!Number.isFinite(playerStats.combatXPNeeded) || playerStats.combatXPNeeded < 1) {
  playerStats.combatXPNeeded = getCombatXpNeededForLevel(playerStats.combatLevel);
} else if (playerStats.combatXPNeeded < BASE_COMBAT_XP_NEEDED) {
  // Migrate older saves that used the previous low-XP combat curve.
  playerStats.combatXPNeeded = getCombatXpNeededForLevel(playerStats.combatLevel);
}
if (!Number.isFinite(playerStats.combatLevelFxStartedAt) || playerStats.combatLevelFxStartedAt < 0) {
  playerStats.combatLevelFxStartedAt = 0;
}
if (!Number.isFinite(playerStats.combatLevelFxLevelsGained) || playerStats.combatLevelFxLevelsGained < 0) {
  playerStats.combatLevelFxLevelsGained = 0;
}
if (!Number.isFinite(playerStats.combatLevelCelebrationStartedAt) || playerStats.combatLevelCelebrationStartedAt < 0) {
  playerStats.combatLevelCelebrationStartedAt = 0;
}
if (!Number.isFinite(playerStats.combatLevelCelebrationLevel) || playerStats.combatLevelCelebrationLevel < 0) {
  playerStats.combatLevelCelebrationLevel = 0;
}
if (!Number.isFinite(playerStats.combatLevelCelebrationLevelsGained) || playerStats.combatLevelCelebrationLevelsGained < 0) {
  playerStats.combatLevelCelebrationLevelsGained = 0;
}
if (!Number.isFinite(playerStats.combatLevelCelebrationLastFireworkAt) || playerStats.combatLevelCelebrationLastFireworkAt < 0) {
  playerStats.combatLevelCelebrationLastFireworkAt = 0;
}

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

function setDoorAccessNotice(text, durationMs = 1700) {
  if (!text) return;
  doorAccessNoticeState.active = true;
  doorAccessNoticeState.text = text;
  doorAccessNoticeState.townId = currentTownId;
  doorAccessNoticeState.areaId = currentAreaId;
  doorAccessNoticeState.until = performance.now() + Math.max(900, durationMs);
}

function pushSaveNotice({ text, type = "save", durationMs = 1700 }) {
  if (!text) return;
  saveNoticeState.active = true;
  saveNoticeState.text = text;
  saveNoticeState.type = type;
  saveNoticeState.startedAt = performance.now();
  saveNoticeState.durationMs = Math.max(700, durationMs);
}

function getTownProgressForCurrentTown() {
  const townId = currentTownId;
  if (!gameFlags.townProgress[townId]) {
    gameFlags.townProgress[townId] = {};
  }
  normalizeGlobalStoryFlags(gameFlags);
  const normalized = normalizeTownProgress(gameFlags.townProgress[townId]);
  const challengeKills = Number.isFinite(normalized.challengeKills) ? normalized.challengeKills : 0;
  const challengeTarget = Number.isFinite(normalized.challengeTarget) ? normalized.challengeTarget : 3;
  const dojoChallengeComplete = challengeKills >= challengeTarget;
  if (dojoChallengeComplete) {
    if (!gameFlags.completedTraining) gameFlags.completedTraining = true;
  } else if (gameFlags.completedTraining) {
    gameFlags.completedTraining = false;
  }
  const configuredBogTarget = Number.isFinite(trainingContent?.bogQuest?.targetKills)
    ? Math.max(1, Math.round(trainingContent.bogQuest.targetKills))
    : normalized.bogQuestTarget;
  normalized.bogQuestTarget = configuredBogTarget;
  normalized.bogQuestKills = Math.max(0, Math.min(normalized.bogQuestTarget, normalized.bogQuestKills));
  const rumorClues = getRumorCluesFound(normalized);
  if (rumorClues >= 3) normalized.rumorQuestCompleted = true;
  if (normalized.rumorQuestReported) {
    normalized.rumorQuestCompleted = true;
    normalized.rumorQuestActive = false;
    normalized.enduranceUnlocked = true;
  }
  if (gameFlags.completedTraining && normalized.rumorQuestOffered && !normalized.rumorQuestCompleted && !normalized.rumorQuestActive) {
    normalized.rumorQuestActive = true;
  }
  gameFlags.townProgress[townId] = normalized;
  return normalized;
}

function getRumorCluesFound(tp) {
  return Number(tp.rumorCluePiazza) + Number(tp.rumorClueChapel) + Number(tp.rumorClueBar);
}

function getBogQuestTarget(tp) {
  if (Number.isFinite(tp?.bogQuestTarget) && tp.bogQuestTarget > 0) {
    return Math.round(tp.bogQuestTarget);
  }
  if (Number.isFinite(trainingContent?.bogQuest?.targetKills)) {
    return Math.max(1, Math.round(trainingContent.bogQuest.targetKills));
  }
  return 3;
}

function getNextMissingRumorClue(tp) {
  if (!tp.rumorCluePiazza) {
    return {
      objectiveId: "rumor-clue-piazza",
      text: "Objective: Investigate the piazza watchers about the northern threat."
    };
  }
  if (!tp.rumorClueChapel) {
    return {
      objectiveId: "rumor-clue-chapel",
      text: "Objective: Ask the chapel priest what changed before Taiko vanished."
    };
  }
  if (!tp.rumorClueBar) {
    return {
      objectiveId: "rumor-clue-bar",
      text: "Objective: Ask bar regulars what they heard before the mountain darkened."
    };
  }
  return null;
}

function deriveObjective() {
  const tp = getTownProgressForCurrentTown();
  const rumorClues = getRumorCluesFound(tp);
  const bogTarget = getBogQuestTarget(tp);
  const bogKills = Number.isFinite(tp.bogQuestKills) ? tp.bogQuestKills : 0;

  if (!gameFlags.acceptedTraining) {
    return {
      id: "talk-hanami",
      text: "Objective: Find Mr. Hanami at the dojo and speak with him."
    };
  }

  const kills = Number.isFinite(tp.challengeKills) ? tp.challengeKills : 0;
  const target = Number.isFinite(tp.challengeTarget) ? tp.challengeTarget : 3;
  const dojoChallengeComplete = kills >= target;

  if (!dojoChallengeComplete) {
    return {
      id: "dojo-upstairs-challenge",
      text: `Objective: Defeat upstairs opponents (${kills}/${target}).`
    };
  }

  if (!tp.rumorQuestOffered) {
    return {
      id: "start-investigation",
      text: "Objective: Speak to Mr. Hanami to accept your next challenge."
    };
  }

  if (tp.rumorQuestActive && !tp.rumorQuestCompleted) {
    const nextClue = getNextMissingRumorClue(tp);
    if (nextClue) {
      return {
        id: nextClue.objectiveId,
        text: `${nextClue.text} (${rumorClues}/3 clues).`
      };
    }
    return {
      id: "rumor-report-hanami",
      text: "Objective: Report your rumor findings to Mr. Hanami."
    };
  }

  if (tp.rumorQuestCompleted && !tp.rumorQuestReported) {
    return {
      id: "rumor-report-hanami",
      text: "Objective: Report your rumor findings to Mr. Hanami."
    };
  }

  if (tp.rumorQuestReported && !tp.enduranceUnlocked) {
    return {
      id: "unlock-endurance",
      text: "Objective: Speak to Mr. Hanami for your endurance assignment."
    };
  }

  if (tp.enduranceUnlocked && playerStats.disciplineLevel < 2) {
    return {
      id: "endurance-training",
      text: `Objective: Train on the mat to reach discipline Lv.2 (current Lv.${playerStats.disciplineLevel}).`
    };
  }

  if (tp.enduranceUnlocked && playerStats.disciplineLevel >= 2 && !tp.membershipAwarded) {
    return {
      id: "collect-membership",
      text: "Objective: Speak to Mr. Hanami to receive your membership card."
    };
  }

  if (tp.membershipAwarded && !tp.bogQuestOffered) {
    return {
      id: "south-path",
      text: "Objective: Meet with Mr. Hanami at Bogland Training Ground, South of the dojo."
    };
  }

  if (tp.bogQuestOffered && !tp.bogQuestActive && !tp.bogQuestCompleted) {
    return {
      id: "bogland-accept",
      text: "Objective: Speak to Mr. Hanami in Bogland when you are ready for the swamp trial."
    };
  }

  if (tp.bogQuestActive && !tp.bogQuestCompleted) {
    return {
      id: "bogland-cleansing",
      text: `Objective: Kill 3 ogres (${bogKills}/${bogTarget}).`
    };
  }

  if (tp.bogQuestCompleted && !tp.bogQuestReported) {
    return {
      id: "bogland-report-hanami",
      text: "Objective: Return to Mr. Hanami in Bogland."
    };
  }

  if (tp.bogQuestReported) {
    return {
      id: "taiko-preparation",
      text: "Objective: Return to Hanami Town and prepare for the road toward Taiko."
    };
  }

  return {
    id: "town-discipline",
    text: "Objective: Continue building your discipline and speak with Mr. Hanami for guidance."
  };
}

function resolveObjectiveMarker(objectiveId) {
  if (objectiveId === "bogland-cleansing") return null;
  const markers = {
    "talk-hanami": [
      { townId: "hanamiTown", areaId: "overworld", tileX: 41, tileY: 10, label: "Dojo entrance" },
      { townId: "hanamiTown", areaId: "hanamiDojo", tileX: 7, tileY: 4, label: "Mr. Hanami" }
    ],
    "dojo-upstairs-challenge": [
      { townId: "hanamiTown", areaId: "hanamiDojo", tileX: 9, tileY: 3, label: "Upstairs challenge" },
      { townId: "hanamiTown", areaId: "hanamiDojoUpstairs", tileX: 6, tileY: 5, label: "Challenge room" }
    ],
    "report-to-hanami": [
      { townId: "hanamiTown", areaId: "hanamiDojo", tileX: 7, tileY: 4, label: "Mr. Hanami" }
    ],
    "start-investigation": [
      { townId: "hanamiTown", areaId: "hanamiDojo", tileX: 7, tileY: 4, label: "Mr. Hanami" }
    ],
    "unlock-endurance": [
      { townId: "hanamiTown", areaId: "hanamiDojo", tileX: 7, tileY: 4, label: "Mr. Hanami" }
    ],
    "rumor-clue-piazza": [
      { townId: "hanamiTown", areaId: "overworld", tileX: 31, tileY: 16, label: "Mina in the piazza" }
    ],
    "rumor-clue-chapel": [
      { townId: "hanamiTown", areaId: "overworld", tileX: 13, tileY: 15, label: "Chapel entrance" },
      { townId: "hanamiTown", areaId: "hanamiChurch", tileX: 6, tileY: 3, label: "Priest Miki" }
    ],
    "rumor-clue-bar": [
      { townId: "hanamiTown", areaId: "overworld", tileX: 45, tileY: 31, label: "Bar entrance" },
      { townId: "hanamiTown", areaId: "hanamiBar", tileX: 4, tileY: 7, label: "Tomo at the bar" }
    ],
    "rumor-report-hanami": [
      { townId: "hanamiTown", areaId: "hanamiDojo", tileX: 7, tileY: 4, label: "Mr. Hanami" }
    ],
    "endurance-training": [
      { townId: "hanamiTown", areaId: "hanamiDojo", tileX: 4, tileY: 5, label: "Training mat" }
    ],
    "collect-membership": [
      { townId: "hanamiTown", areaId: "hanamiDojo", tileX: 7, tileY: 4, label: "Mr. Hanami" }
    ],
    "south-path": [
      { townId: "hanamiTown", areaId: "overworld", tileX: 28, tileY: 42, label: "Bogland gate" }
    ],
    "bogland-accept": [
      { townId: "hanamiTown", areaId: "bogland", tileX: 28, tileY: 6, label: "Mr. Hanami" }
    ],
    "bogland-report-hanami": [
      { townId: "hanamiTown", areaId: "bogland", tileX: 28, tileY: 6, label: "Mr. Hanami" }
    ],
    "taiko-preparation": [
      { townId: "hanamiTown", areaId: "hanamiDojo", tileX: 7, tileY: 4, label: "Mr. Hanami" }
    ],
    "town-discipline": [
      { townId: "hanamiTown", areaId: "overworld", tileX: 28, tileY: 29, label: "Town center" }
    ]
  };

  const options = markers[objectiveId];
  if (!Array.isArray(options)) return null;
  return options.find((marker) => marker.townId === currentTownId && marker.areaId === currentAreaId) || null;
}

function resolveObjectiveMarkerArea(objectiveId) {
  const areas = {
    "bogland-cleansing": {
      townId: "hanamiTown",
      areaId: "bogland",
      tileX: 20,
      tileY: 17,
      tileW: 18,
      tileH: 12,
      label: "Ogre territory"
    }
  };
  const area = areas[objectiveId];
  if (!area) return null;
  if (area.townId !== currentTownId || area.areaId !== currentAreaId) return null;
  return area;
}

function getAreaDoorDiscoveryKey(townId, areaId) {
  return `${townId}:${areaId}`;
}

function markNearbyDoorsDiscovered() {
  const key = getAreaDoorDiscoveryKey(currentTownId, currentAreaId);
  if (!minimapDiscoveryState.discoveredDoors[key]) {
    minimapDiscoveryState.discoveredDoors[key] = {};
  }
  const discovered = minimapDiscoveryState.discoveredDoors[key];

  const playerTx = Math.floor((player.x + TILE * 0.5) / TILE);
  const playerTy = Math.floor((player.y + TILE * 0.5) / TILE);
  const radius = 7;

  for (let ty = Math.max(0, playerTy - radius); ty <= Math.min(currentMapH - 1, playerTy + radius); ty++) {
    const row = currentMap[ty];
    if (!row) continue;
    for (let tx = Math.max(0, playerTx - radius); tx <= Math.min(currentMapW - 1, playerTx + radius); tx++) {
      if (row[tx] !== TILE_TYPES.DOOR) continue;
      if (isConditionallyHiddenDoor(tx, ty)) continue;
      discovered[`${tx},${ty}`] = true;
    }
  }
}

function syncObjectiveState(now = performance.now()) {
  const next = deriveObjective();
  const nextMarker = resolveObjectiveMarker(next.id);
  const nextMarkerArea = resolveObjectiveMarkerArea(next.id);
  const markerUnchanged = (
    (objectiveState.marker == null && nextMarker == null) ||
    (
      objectiveState.marker &&
      nextMarker &&
      objectiveState.marker.townId === nextMarker.townId &&
      objectiveState.marker.areaId === nextMarker.areaId &&
      objectiveState.marker.tileX === nextMarker.tileX &&
      objectiveState.marker.tileY === nextMarker.tileY
    )
  );
  const markerAreaUnchanged = (
    (objectiveState.markerArea == null && nextMarkerArea == null) ||
    (
      objectiveState.markerArea &&
      nextMarkerArea &&
      objectiveState.markerArea.townId === nextMarkerArea.townId &&
      objectiveState.markerArea.areaId === nextMarkerArea.areaId &&
      objectiveState.markerArea.tileX === nextMarkerArea.tileX &&
      objectiveState.markerArea.tileY === nextMarkerArea.tileY &&
      objectiveState.markerArea.tileW === nextMarkerArea.tileW &&
      objectiveState.markerArea.tileH === nextMarkerArea.tileH
    )
  );
  if (objectiveState.id === next.id && objectiveState.text === next.text && markerUnchanged && markerAreaUnchanged) return;
  objectiveState.id = next.id;
  objectiveState.text = next.text;
  objectiveState.updatedAt = now;
  objectiveState.marker = nextMarker;
  objectiveState.markerArea = nextMarkerArea;
}

function showNextCombatReward(now = performance.now()) {
  const next = combatRewardPanel.queue.shift();
  if (!next) {
    combatRewardPanel.active = false;
    combatRewardPanel.title = "";
    combatRewardPanel.lines = [];
    return;
  }

  combatRewardPanel.active = true;
  combatRewardPanel.title = next.title;
  combatRewardPanel.lines = Array.isArray(next.lines) ? next.lines : [];
  combatRewardPanel.startedAt = now;
  combatRewardPanel.durationMs = Number.isFinite(next.durationMs) ? Math.max(900, next.durationMs) : 2200;
}

function queueCombatReward(reward) {
  if (!reward || !reward.title) return;
  combatRewardPanel.queue.push(reward);
  if (!combatRewardPanel.active) {
    showNextCombatReward(performance.now());
  }
}

function normalizeLootEntries(entries) {
  if (!Array.isArray(entries)) return [];
  const normalized = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const amount = Number.isFinite(entry.amount) ? Math.max(0, Math.floor(entry.amount)) : 0;
    if (!name || amount <= 0) continue;
    normalized.push({ name, amount });
  }
  return normalized;
}

function resolveEnemyLootDrop(enemy) {
  if (!enemy || typeof enemy !== "object") return null;
  const chancePercentRaw = Number(enemy.lootDropChancePercent);
  const hasChance = Number.isFinite(chancePercentRaw) && chancePercentRaw > 0;
  if (!hasChance) return null;
  const chancePercent = Math.max(0, Math.min(100, chancePercentRaw));
  if (Math.random() * 100 >= chancePercent) return null;

  const items = [];
  const lootTable = Array.isArray(enemy.lootTable) ? enemy.lootTable : [];
  for (const entry of lootTable) {
    if (!entry || typeof entry !== "object") continue;
    const itemName = typeof entry.item === "string" ? entry.item.trim() : "";
    if (!itemName) continue;
    const entryChanceRaw = Number(entry.chancePercent);
    const entryChance = Number.isFinite(entryChanceRaw)
      ? Math.max(0, Math.min(100, entryChanceRaw))
      : 100;
    if (Math.random() * 100 >= entryChance) continue;
    const min = Number.isFinite(entry.min) ? Math.max(1, Math.floor(entry.min)) : 1;
    const max = Number.isFinite(entry.max) ? Math.max(min, Math.floor(entry.max)) : min;
    const amount = min + Math.floor(Math.random() * (max - min + 1));
    if (amount > 0) {
      items.push({ name: itemName, amount });
    }
  }

  const rollCoinFromRange = (range) => {
    if (!Array.isArray(range) || range.length < 2) return 0;
    const min = Number.isFinite(range[0]) ? Math.max(0, Math.floor(range[0])) : 0;
    const max = Number.isFinite(range[1]) ? Math.max(min, Math.floor(range[1])) : min;
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  const silver = rollCoinFromRange(enemy.lootSilverRange);
  const gold = rollCoinFromRange(enemy.lootGoldRange);
  if (items.length === 0 && silver <= 0 && gold <= 0) return null;
  return {
    items: normalizeLootEntries(items),
    silver,
    gold
  };
}

function spawnEnemyLeftovers(enemy, now = performance.now()) {
  const loot = resolveEnemyLootDrop(enemy);
  if (!loot) return null;

  const enemyWidth = Number.isFinite(enemy?.width) ? enemy.width : TILE;
  const enemyHeight = Number.isFinite(enemy?.height) ? enemy.height : TILE;
  const centerX = (Number.isFinite(enemy?.x) ? enemy.x : player.x) + enemyWidth * 0.5;
  const centerY = (Number.isFinite(enemy?.y) ? enemy.y : player.y) + enemyHeight * 0.68;
  const COIN_MERGE_RADIUS = TILE * 1.8;
  const mergeRadiusSq = COIN_MERGE_RADIUS * COIN_MERGE_RADIUS;
  const hasIncomingCoins = Number(loot.silver) > 0 || Number(loot.gold) > 0;
  const entries = Array.isArray(leftoversState?.entries) ? leftoversState.entries : [];
  let mergeTarget = null;
  if (hasIncomingCoins && entries.length > 0) {
    let bestDistSq = Number.POSITIVE_INFINITY;
    for (const entry of entries) {
      if (!entry || entry.townId !== currentTownId || entry.areaId !== currentAreaId) continue;
      if (entry.depleted) continue;
      const hasLoot = (Number(entry.gold) > 0) || (Number(entry.silver) > 0) || (Array.isArray(entry.items) && entry.items.length > 0);
      if (!hasLoot) continue;
      const dx = (Number(entry.x) || 0) - centerX;
      const dy = (Number(entry.y) || 0) - centerY;
      const distSq = dx * dx + dy * dy;
      if (distSq > mergeRadiusSq) continue;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        mergeTarget = entry;
      }
    }
  }

  if (mergeTarget) {
    mergeTarget.silver = (Number(mergeTarget.silver) || 0) + (Number(loot.silver) || 0);
    mergeTarget.gold = (Number(mergeTarget.gold) || 0) + (Number(loot.gold) || 0);
    loot.silver = 0;
    loot.gold = 0;
  }

  const hasRemainingLoot = loot.items.length > 0 || loot.silver > 0 || loot.gold > 0;
  if (!hasRemainingLoot) return mergeTarget;

  const nextId = Number.isFinite(leftoversState?.nextId) ? leftoversState.nextId : 1;
  leftoversState.nextId = nextId + 1;
  const leftover = {
    id: `leftovers-${nextId}`,
    townId: currentTownId,
    areaId: currentAreaId,
    x: centerX,
    y: centerY,
    items: loot.items,
    silver: loot.silver,
    gold: loot.gold,
    createdAt: now
  };
  leftoversState.entries.push(leftover);
  return leftover;
}

function respawnEnemyAtSpawn(enemy) {
  if (!enemy || typeof enemy !== "object") return;
  enemy.dead = false;
  enemy.hp = enemy.maxHp;
  enemy.x = enemy.spawnX;
  enemy.y = enemy.spawnY;
  enemy.state = "idle";
  enemy.pendingStrike = false;
  enemy.invulnerableUntil = 0;
  enemy.hitStunUntil = 0;
  enemy.attackStrikeAt = 0;
  enemy.recoverUntil = 0;
  enemy.challengeDefeatedCounted = false;
  enemy.bogDefeatedCounted = false;
  enemy.respawnAt = 0;
}

function updateTownReentryEnemyRespawnsOnAreaChange({ previousAreaId, areaId }) {
  if (!Array.isArray(enemies) || previousAreaId === areaId) return;
  const enteredAreaKind = worldService.getAreaKind(currentTownId, areaId);
  const enteredTownArea = enteredAreaKind === AREA_KINDS.OVERWORLD;
  if (!enteredTownArea) return;

  for (const enemy of enemies) {
    if (!enemy || enemy.respawnMode !== "townReentry" || !enemy.dead) continue;
    respawnEnemyAtSpawn(enemy);
    enemy.townVisitedSinceDefeat = false;
  }
}

function openLeftoversInventory(leftover) {
  if (!leftover || !leftover.id) return;
  if (!isFreeExploreState(gameState)) return;
  setPreviousWorldState(gameState);
  setInventoryOpenedFromPauseMenu(false);
  leftoversUiState.active = true;
  leftoversUiState.leftoverId = leftover.id;
  leftoversUiState.openedFromInteraction = true;
  leftoversUiState.requestCloseInventory = false;
  gameState = GAME_STATES.INVENTORY;
}

function findClosestNearbyLeftoverForInteraction() {
  if (!Array.isArray(leftoversState?.entries) || leftoversState.entries.length === 0) return null;
  const playerCenterX = player.x + TILE * 0.5;
  const playerCenterY = player.y + TILE * 0.5;
  let closest = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const entry of leftoversState.entries) {
    if (!entry) continue;
    if (entry.depleted) continue;
    const hasLoot = (Number(entry.gold) > 0) || (Number(entry.silver) > 0) || (Array.isArray(entry.items) && entry.items.length > 0);
    if (!hasLoot) continue;
    if (entry.townId !== currentTownId || entry.areaId !== currentAreaId) continue;
    const lx = Number.isFinite(entry.x) ? entry.x : 0;
    const ly = Number.isFinite(entry.y) ? entry.y : 0;
    const dx = Math.abs(playerCenterX - lx);
    const dy = Math.abs(playerCenterY - ly);
    if (dx > UI.INTERACT_REACH || dy > UI.INTERACT_REACH) continue;
    const d = Math.hypot(playerCenterX - lx, playerCenterY - ly);
    if (d < closestDistance) {
      closest = entry;
      closestDistance = d;
    }
  }
  return closest;
}

function grantCombatXpAndCollectSummary(enemy, now) {
  const enemyId = typeof enemy?.id === "string" ? enemy.id.toLowerCase() : "";
  const enemyName = typeof enemy?.name === "string" ? enemy.name.toLowerCase() : "";
  const isOgre = enemyId.includes("ogre") || enemyName.includes("ogre");
  const xpGained = isOgre ? 9 : (enemy?.countsForChallenge ? 3 : 2);
  let levelsGained = 0;

  playerStats.combatXP += xpGained;
  while (playerStats.combatXP >= playerStats.combatXPNeeded) {
    playerStats.combatXP -= playerStats.combatXPNeeded;
    playerStats.combatLevel += 1;
    playerStats.combatXPNeeded = Math.ceil(playerStats.combatXPNeeded * COMBAT_XP_GROWTH_MULTIPLIER);
    levelsGained += 1;
    player.maxHp += 1;
    player.hp = Math.min(player.maxHp, player.hp + 1);
    musicManager.playSfx("levelUp");
  }
  if (levelsGained > 0) {
    playerStats.combatLevelFxStartedAt = now;
    playerStats.combatLevelFxLevelsGained = levelsGained;
    playerStats.combatLevelCelebrationStartedAt = now;
    playerStats.combatLevelCelebrationLevel = playerStats.combatLevel;
    playerStats.combatLevelCelebrationLevelsGained = levelsGained;
    playerStats.combatLevelCelebrationLastFireworkAt = now;
    musicManager.playSfx("celebrationChime");
    musicManager.playSfx("fireworkBurst");
  }

  return {
    xpGained,
    completedLevelUp: levelsGained > 0
  };
}

function getPatInnkeeperNpc() {
  return npcs.find((npc) => npc && npc.id === PAT_INNKEEPER_ID && npc.world === PAT_INN_AREA_ID) || null;
}

function clearPlayerActionInputs() {
  input.actionStates.moveUp = false;
  input.actionStates.moveDown = false;
  input.actionStates.moveLeft = false;
  input.actionStates.moveRight = false;
  player.walking = false;
}

function orientEntityTowardTarget(entity, targetX, targetY) {
  const dx = targetX - entity.x;
  const dy = targetY - entity.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    entity.dir = dx >= 0 ? "right" : "left";
  } else {
    entity.dir = dy >= 0 ? "down" : "up";
  }
}

function moveNpcToward(npc, targetX, targetY, dtScale) {
  const dx = targetX - npc.x;
  const dy = targetY - npc.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.5) {
    npc.x = targetX;
    npc.y = targetY;
    return true;
  }

  const speedPxPerFrame = 1.2;
  const step = Math.min(distance, speedPxPerFrame * dtScale);
  npc.x += (dx / distance) * step;
  npc.y += (dy / distance) * step;
  orientEntityTowardTarget(npc, targetX, targetY);
  return false;
}

function removeNpcById(npcId, areaId = null) {
  for (let i = npcs.length - 1; i >= 0; i--) {
    const npc = npcs[i];
    if (!npc || npc.id !== npcId) continue;
    if (areaId && npc.world !== areaId) continue;
    npcs.splice(i, 1);
  }
}

function applyStoryNpcVisibility() {
  if (gameFlags.hanamiLeftDojo) {
    gameFlags.hanamiDojoExitPending = false;
    resetHanamiDojoExitState();
    removeNpcById(HANAMI_NPC_ID, HANAMI_DOJO_AREA_ID);
  }
}

function getDojoHanamiNpc() {
  return npcs.find((npc) => npc && npc.id === HANAMI_NPC_ID && npc.world === HANAMI_DOJO_AREA_ID) || null;
}

function isHanamiDojoExitControlLockActive() {
  if (currentTownId !== PAT_INN_TOWN_ID || currentAreaId !== HANAMI_DOJO_AREA_ID) return false;
  return Boolean(gameFlags.hanamiDojoExitPending) && !Boolean(gameFlags.hanamiLeftDojo);
}

function getEntityTilePosition(entity) {
  return {
    tx: Math.floor((entity.x + TILE * 0.5) / TILE),
    ty: Math.floor((entity.y + TILE * 0.5) / TILE)
  };
}

function isHanamiExitTileWalkable(tx, ty, hanamiNpc, ignoreDynamicBlockers = false) {
  if (tx < 0 || ty < 0 || tx >= currentMapW || ty >= currentMapH) return false;

  const worldX = tx * TILE;
  const worldY = ty * TILE;
  if (collisionService.collides(worldX, worldY, currentMap, currentMapW, currentMapH)) return false;
  if (ignoreDynamicBlockers) return true;

  for (const npc of npcs) {
    if (!npc || npc === hanamiNpc || npc.world !== currentAreaId) continue;
    if (Math.abs(npc.x - worldX) < TILE * 0.6 && Math.abs(npc.y - worldY) < TILE * 0.6) {
      return false;
    }
  }

  if (Math.abs(player.x - worldX) < TILE * 0.6 && Math.abs(player.y - worldY) < TILE * 0.6) {
    return false;
  }

  return true;
}

function buildHanamiExitPath(hanamiNpc, targetTx, targetTy, ignoreDynamicBlockers = false) {
  const start = getEntityTilePosition(hanamiNpc);
  if (start.tx === targetTx && start.ty === targetTy) {
    return [{ tx: targetTx, ty: targetTy }];
  }

  const keyFor = (tx, ty) => `${tx},${ty}`;
  const queue = [{ tx: start.tx, ty: start.ty }];
  const visited = new Set([keyFor(start.tx, start.ty)]);
  const parent = new Map();
  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 }
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    if (current.tx === targetTx && current.ty === targetTy) {
      const path = [{ tx: current.tx, ty: current.ty }];
      let traceKey = keyFor(current.tx, current.ty);
      while (parent.has(traceKey)) {
        const prev = parent.get(traceKey);
        if (!prev) break;
        path.push(prev);
        traceKey = keyFor(prev.tx, prev.ty);
      }
      path.reverse();
      return path;
    }

    for (const dir of dirs) {
      const nextTx = current.tx + dir.dx;
      const nextTy = current.ty + dir.dy;
      const nextKey = keyFor(nextTx, nextTy);
      if (visited.has(nextKey)) continue;

      const isTarget = nextTx === targetTx && nextTy === targetTy;
      if (!isTarget && !isHanamiExitTileWalkable(nextTx, nextTy, hanamiNpc, ignoreDynamicBlockers)) continue;

      visited.add(nextKey);
      parent.set(nextKey, { tx: current.tx, ty: current.ty });
      queue.push({ tx: nextTx, ty: nextTy });
    }
  }

  return null;
}

function moveNpcAxisAlignedToward(npc, targetX, targetY, dtScale) {
  const dx = targetX - npc.x;
  const dy = targetY - npc.y;
  if (Math.abs(dx) <= 0.5 && Math.abs(dy) <= 0.5) {
    npc.x = targetX;
    npc.y = targetY;
    return true;
  }

  const speedPxPerFrame = 1.2;
  const step = speedPxPerFrame * dtScale;
  if (Math.abs(dx) >= Math.abs(dy) && Math.abs(dx) > 0.5) {
    const moveX = Math.sign(dx) * Math.min(Math.abs(dx), step);
    npc.x += moveX;
    npc.dir = moveX >= 0 ? "right" : "left";
    if (Math.abs(targetY - npc.y) <= 0.5) npc.y = targetY;
  } else if (Math.abs(dy) > 0.5) {
    const moveY = Math.sign(dy) * Math.min(Math.abs(dy), step);
    npc.y += moveY;
    npc.dir = moveY >= 0 ? "down" : "up";
    if (Math.abs(targetX - npc.x) <= 0.5) npc.x = targetX;
  }

  if (Math.abs(targetX - npc.x) <= 0.5 && Math.abs(targetY - npc.y) <= 0.5) {
    npc.x = targetX;
    npc.y = targetY;
    return true;
  }
  return false;
}

function resetHanamiDojoExitState() {
  hanamiDojoExitState.active = false;
  hanamiDojoExitState.lastUpdateAt = 0;
  hanamiDojoExitState.pathTiles = [];
  hanamiDojoExitState.nextPathIndex = 0;
  hanamiDojoExitState.nextRepathAt = 0;
  hanamiDojoExitState.ignoreDynamicBlockers = false;
  hanamiDojoExitState.startedAt = 0;
  hanamiDojoExitState.lastProgressAt = 0;
  hanamiDojoExitState.lastX = 0;
  hanamiDojoExitState.lastY = 0;
}

function isPatIntroTileWalkable(tx, ty, patNpc) {
  if (tx < 0 || ty < 0 || tx >= currentMapW || ty >= currentMapH) return false;

  const worldX = tx * TILE;
  const worldY = ty * TILE;
  if (collisionService.collides(worldX, worldY, currentMap, currentMapW, currentMapH)) return false;

  for (const npc of npcs) {
    if (!npc || npc === patNpc || npc.world !== currentAreaId) continue;
    if (npc.blocking === false) continue;
    if (Math.abs(npc.x - worldX) < TILE * 0.6 && Math.abs(npc.y - worldY) < TILE * 0.6) {
      return false;
    }
  }

  if (Math.abs(player.x - worldX) < TILE * 0.6 && Math.abs(player.y - worldY) < TILE * 0.6) {
    return false;
  }

  return true;
}

function findPatApproachTarget(patNpc) {
  const playerTileX = Math.floor((player.x + TILE * 0.5) / TILE);
  const playerTileY = Math.floor((player.y + TILE * 0.5) / TILE);
  const candidates = [
    { tx: playerTileX, ty: playerTileY - 1 },
    { tx: playerTileX, ty: playerTileY + 1 },
    { tx: playerTileX - 1, ty: playerTileY },
    { tx: playerTileX + 1, ty: playerTileY }
  ];

  const viable = candidates
    .filter((candidate) => isPatIntroTileWalkable(candidate.tx, candidate.ty, patNpc))
    .sort((a, b) => {
      const ax = a.tx * TILE;
      const ay = a.ty * TILE;
      const bx = b.tx * TILE;
      const by = b.ty * TILE;
      const ad = Math.hypot(ax - patNpc.x, ay - patNpc.y);
      const bd = Math.hypot(bx - patNpc.x, by - patNpc.y);
      return ad - bd;
    });

  if (viable.length === 0) return null;
  return {
    x: viable[0].tx * TILE,
    y: viable[0].ty * TILE
  };
}

function updatePatInnIntroSequence(now) {
  if (currentTownId !== PAT_INN_TOWN_ID || currentAreaId !== PAT_INN_AREA_ID) {
    if (patInnIntroState.active || patInnIntroState.pendingStart) {
      const patNpc = getPatInnkeeperNpc();
      if (patNpc) {
        patNpc.canRoam = patInnIntroState.previousCanRoam;
      }
    }
    patInnIntroState.pendingStart = false;
    patInnIntroState.active = false;
    patInnIntroState.phase = "idle";
    patInnIntroState.dialogueAutoCloseAt = 0;
    return;
  }

  if (gameFlags.patInnIntroSeen) {
    return;
  }

  if (
    !isFreeExploreState(gameState) &&
    gameState !== GAME_STATES.TRANSITION &&
    gameState !== GAME_STATES.ENTERING_DOOR
  ) {
    return;
  }

  if (patInnIntroState.pendingStart) {
    if (doorSequence.active || gameState === GAME_STATES.TRANSITION || gameState === GAME_STATES.ENTERING_DOOR) {
      return;
    }

    const patNpc = getPatInnkeeperNpc();
    if (!patNpc) {
      gameFlags.patInnIntroSeen = true;
      patInnIntroState.pendingStart = false;
      return;
    }

    const approachTarget = findPatApproachTarget(patNpc);
    if (!approachTarget) {
      gameFlags.patInnIntroSeen = true;
      patInnIntroState.pendingStart = false;
      return;
    }

    patInnIntroState.pendingStart = false;
    patInnIntroState.active = true;
    patInnIntroState.phase = "walkToPlayer";
    patInnIntroState.targetX = approachTarget.x;
    patInnIntroState.targetY = approachTarget.y;
    patInnIntroState.homeX = patNpc.x;
    patInnIntroState.homeY = patNpc.y;
    patInnIntroState.dialogueAutoCloseAt = 0;
    patInnIntroState.lastUpdateAt = now;
    patInnIntroState.previousCanRoam = Boolean(patNpc.canRoam);
    patNpc.canRoam = false;
  }

  if (!patInnIntroState.active) return;

  const patNpc = getPatInnkeeperNpc();
  if (!patNpc) {
    patInnIntroState.active = false;
    patInnIntroState.phase = "idle";
    patInnIntroState.dialogueAutoCloseAt = 0;
    gameFlags.patInnIntroSeen = true;
    return;
  }

  const rawDt = Number.isFinite(patInnIntroState.lastUpdateAt) ? (now - patInnIntroState.lastUpdateAt) : 16.667;
  patInnIntroState.lastUpdateAt = now;
  const dtScale = Math.max(0.2, Math.min(2.2, rawDt / 16.667));

  if (patInnIntroState.phase === "walkToPlayer") {
    clearPlayerActionInputs();
    input.clearInteractPressed();
    input.clearAttackPressed();

    const arrived = moveNpcToward(patNpc, patInnIntroState.targetX, patInnIntroState.targetY, dtScale);
    if (arrived) {
      orientEntityTowardTarget(patNpc, player.x, player.y);
      orientEntityTowardTarget(player, patNpc.x, patNpc.y);
      patInnIntroState.phase = "dialogue";
      patInnIntroState.dialogueAutoCloseAt = 0;
      showDialogue(patNpc.name, patNpc.dialogue);
    }
    return;
  }

  if (patInnIntroState.phase === "dialogue") {
    clearPlayerActionInputs();
    input.clearInteractPressed();
    input.clearAttackPressed();

    if (!dialogue.isActive()) {
      dialogue.close();
      patInnIntroState.dialogueAutoCloseAt = 0;
      patInnIntroState.phase = "walkHome";
      patInnIntroState.targetX = patInnIntroState.homeX;
      patInnIntroState.targetY = patInnIntroState.homeY;
      patInnIntroState.lastUpdateAt = performance.now();
    }
    return;
  }

  if (patInnIntroState.phase === "walkHome") {
    clearPlayerActionInputs();
    input.clearInteractPressed();
    input.clearAttackPressed();

    const arrived = moveNpcToward(patNpc, patInnIntroState.targetX, patInnIntroState.targetY, dtScale);
    if (arrived) {
      patNpc.canRoam = patInnIntroState.previousCanRoam;
      patInnIntroState.active = false;
      patInnIntroState.phase = "idle";
      patInnIntroState.dialogueAutoCloseAt = 0;
      gameFlags.patInnIntroSeen = true;
    }
  }
}

function updateHanamiDojoExitSequence(now) {
  applyStoryNpcVisibility();
  if (gameFlags.hanamiLeftDojo || !gameFlags.hanamiDojoExitPending) return;
  if (currentTownId !== PAT_INN_TOWN_ID || currentAreaId !== HANAMI_DOJO_AREA_ID) return;
  if (!isFreeExploreState(gameState)) return;

  const hanamiNpc = getDojoHanamiNpc();
  if (!hanamiNpc) {
    gameFlags.hanamiLeftDojo = true;
    gameFlags.hanamiDojoExitPending = false;
    resetHanamiDojoExitState();
    return;
  }

  if (!hanamiDojoExitState.active) {
    resetHanamiDojoExitState();
    hanamiDojoExitState.active = true;
    hanamiDojoExitState.lastUpdateAt = now;
    hanamiDojoExitState.nextRepathAt = now;
    hanamiDojoExitState.startedAt = now;
    hanamiDojoExitState.lastProgressAt = now;
    hanamiDojoExitState.lastX = hanamiNpc.x;
    hanamiDojoExitState.lastY = hanamiNpc.y;
    hanamiNpc.canRoam = false;
    hanamiNpc.blocking = false;
    dialogue.close();
  }

  const rawDt = Number.isFinite(hanamiDojoExitState.lastUpdateAt) ? (now - hanamiDojoExitState.lastUpdateAt) : 16.667;
  hanamiDojoExitState.lastUpdateAt = now;
  const dtScale = Math.max(0.2, Math.min(2.2, rawDt / 16.667));
  const movedSinceLast = Math.hypot(hanamiNpc.x - hanamiDojoExitState.lastX, hanamiNpc.y - hanamiDojoExitState.lastY);
  if (movedSinceLast >= 0.3) {
    hanamiDojoExitState.lastProgressAt = now;
    hanamiDojoExitState.lastX = hanamiNpc.x;
    hanamiDojoExitState.lastY = hanamiNpc.y;
  }
  const noProgressMs = now - hanamiDojoExitState.lastProgressAt;
  const activeMs = now - hanamiDojoExitState.startedAt;
  if (noProgressMs >= 100 || activeMs >= 9000) {
    removeNpcById(HANAMI_NPC_ID, HANAMI_DOJO_AREA_ID);
    resetHanamiDojoExitState();
    gameFlags.hanamiLeftDojo = true;
    gameFlags.hanamiDojoExitPending = false;
    return;
  }

  const targetTx = Math.floor(HANAMI_DOJO_EXIT_X / TILE);
  const targetTy = Math.floor(HANAMI_DOJO_EXIT_Y / TILE);
  const npcTile = getEntityTilePosition(hanamiNpc);
  const atExitTile = npcTile.tx === targetTx && npcTile.ty === targetTy;
  if (atExitTile && Math.abs(hanamiNpc.x - HANAMI_DOJO_EXIT_X) <= 0.5 && Math.abs(hanamiNpc.y - HANAMI_DOJO_EXIT_Y) <= 0.5) {
    removeNpcById(HANAMI_NPC_ID, HANAMI_DOJO_AREA_ID);
    resetHanamiDojoExitState();
    gameFlags.hanamiLeftDojo = true;
    gameFlags.hanamiDojoExitPending = false;
    return;
  }

  if (
    !Array.isArray(hanamiDojoExitState.pathTiles) ||
    hanamiDojoExitState.pathTiles.length <= 1
  ) {
    let path = buildHanamiExitPath(hanamiNpc, targetTx, targetTy, false);
    let usedFallback = false;
    if (!Array.isArray(path) || path.length <= 1) {
      path = buildHanamiExitPath(hanamiNpc, targetTx, targetTy, true);
      usedFallback = Array.isArray(path) && path.length > 1;
    }
    if (Array.isArray(path) && path.length > 1) {
      hanamiDojoExitState.pathTiles = path;
      hanamiDojoExitState.nextPathIndex = 1;
      hanamiDojoExitState.ignoreDynamicBlockers = usedFallback;
    } else {
      hanamiDojoExitState.pathTiles = [];
      hanamiDojoExitState.nextPathIndex = 0;
      hanamiDojoExitState.ignoreDynamicBlockers = false;
      return;
    }
  }

  const waypoint = hanamiDojoExitState.pathTiles[hanamiDojoExitState.nextPathIndex];
  if (!waypoint) {
    hanamiDojoExitState.pathTiles = [];
    hanamiDojoExitState.nextPathIndex = 0;
    return;
  }

  if (
    !isHanamiExitTileWalkable(waypoint.tx, waypoint.ty, hanamiNpc, hanamiDojoExitState.ignoreDynamicBlockers) &&
    !(waypoint.tx === targetTx && waypoint.ty === targetTy)
  ) {
    if (!hanamiDojoExitState.ignoreDynamicBlockers) {
      hanamiDojoExitState.ignoreDynamicBlockers = true;
    }
    hanamiDojoExitState.pathTiles = [];
    hanamiDojoExitState.nextPathIndex = 0;
    return;
  }

  const waypointWorldX = waypoint.tx * TILE;
  const waypointWorldY = waypoint.ty * TILE;
  const reachedWaypoint = moveNpcAxisAlignedToward(hanamiNpc, waypointWorldX, waypointWorldY, dtScale);
  if (!reachedWaypoint) return;

  if (hanamiDojoExitState.nextPathIndex < hanamiDojoExitState.pathTiles.length - 1) {
    hanamiDojoExitState.nextPathIndex += 1;
    return;
  }

  removeNpcById(HANAMI_NPC_ID, HANAMI_DOJO_AREA_ID);
  resetHanamiDojoExitState();
  gameFlags.hanamiLeftDojo = true;
  gameFlags.hanamiDojoExitPending = false;
}

function updateRuntimeUi(now) {
  if (typeof dialogue.update === "function") {
    dialogue.update(now);
  }
  if (isHanamiDojoExitControlLockActive()) {
    clearPlayerActionInputs();
    input.clearAttackPressed();
    input.clearInteractPressed();
    input.clearPausePressed();
  }

  const isMovementKeyHeldInInventory = () => {
    if (gameState !== GAME_STATES.INVENTORY) return false;
    const keys = input?.keys && typeof input.keys === "object" ? input.keys : null;
    if (!keys) return false;
    const actions = ["moveUp", "moveDown", "moveLeft", "moveRight"];
    for (const action of actions) {
      const bindings = typeof input.getActionBindings === "function" ? input.getActionBindings(action) : [];
      if (!Array.isArray(bindings) || bindings.length === 0) continue;
      for (const key of bindings) {
        if (keys[key]) return true;
      }
    }
    return false;
  };

  if (
    isMovementKeyHeldInInventory()
  ) {
    closeInventoryToWorld();
    clearPlayerActionInputs();
    return;
  }

  if (
    isFreeExploreState(gameState) &&
    !dialogue.isActive() &&
    !choiceState.active &&
    !doorSequence.active &&
    input.getInteractPressed()
  ) {
    const nearbyLeftover = findClosestNearbyLeftoverForInteraction();
    if (nearbyLeftover) {
      openLeftoversInventory(nearbyLeftover);
      input.clearInteractPressed();
    }
  }

  const normalizeCoins = () => {
    const safeGold = Number.isFinite(playerCurrency.gold) ? Math.max(0, Math.floor(playerCurrency.gold)) : 0;
    const safeSilver = Number.isFinite(playerCurrency.silver) ? Math.max(0, Math.floor(playerCurrency.silver)) : 0;
    const gainedGold = Math.floor(safeSilver / 100);
    playerCurrency.gold = safeGold + gainedGold;
    playerCurrency.silver = safeSilver % 100;
  };
  const moveInventoryCoinItemsToCurrency = () => {
    const silverKeys = ["Silver Coin", "Silver Coins"];
    const goldKeys = ["Gold Coin", "Gold Coins"];
    let silverAdded = 0;
    let goldAdded = 0;
    for (const key of silverKeys) {
      const count = Number(playerInventory[key] || 0);
      if (count > 0) {
        silverAdded += Math.floor(count);
        delete playerInventory[key];
      }
    }
    for (const key of goldKeys) {
      const count = Number(playerInventory[key] || 0);
      if (count > 0) {
        goldAdded += Math.floor(count);
        delete playerInventory[key];
      }
    }
    if (silverAdded > 0) playerCurrency.silver = (Number(playerCurrency.silver) || 0) + silverAdded;
    if (goldAdded > 0) playerCurrency.gold = (Number(playerCurrency.gold) || 0) + goldAdded;
  };
  moveInventoryCoinItemsToCurrency();
  normalizeCoins();
  const pruneInvalidLeftovers = () => {
    if (!Array.isArray(leftoversState?.entries)) return;
    const activeLeftoverId = leftoversUiState?.active ? leftoversUiState.leftoverId : "";
    const valid = [];
    for (const entry of leftoversState.entries) {
      if (!entry || typeof entry !== "object") continue;
      const items = normalizeLootEntries(entry.items);
      const silver = Number.isFinite(entry.silver) ? Math.max(0, Math.floor(entry.silver)) : 0;
      const gold = Number.isFinite(entry.gold) ? Math.max(0, Math.floor(entry.gold)) : 0;
      const isEmpty = items.length === 0 && silver <= 0 && gold <= 0;
      if (isEmpty && (!activeLeftoverId || entry.id !== activeLeftoverId)) continue;
      entry.items = items;
      entry.silver = silver;
      entry.gold = gold;
      valid.push(entry);
    }
    leftoversState.entries = valid;
  };
  pruneInvalidLeftovers();
  if (gameState === GAME_STATES.INVENTORY && leftoversUiState.requestCloseInventory) {
    leftoversUiState.requestCloseInventory = false;
    closeInventoryToWorld();
    return;
  }
  if (leftoversUiState.active) {
    const activeLeftover = leftoversState.entries.find((entry) => entry?.id === leftoversUiState.leftoverId) || null;
    if (!activeLeftover) {
      const shouldReturnToWorld =
        leftoversUiState.openedFromInteraction &&
        gameState === GAME_STATES.INVENTORY &&
        !inventoryOpenedFromPauseMenu &&
        isFreeExploreState(previousWorldState);
      leftoversUiState.active = false;
      leftoversUiState.leftoverId = "";
      leftoversUiState.openedFromInteraction = false;
      leftoversUiState.requestCloseInventory = false;
      if (shouldReturnToWorld) {
        gameState = previousWorldState;
      }
    }
  } else if (leftoversUiState.leftoverId) {
    leftoversUiState.leftoverId = "";
    leftoversUiState.openedFromInteraction = false;
    leftoversUiState.requestCloseInventory = false;
  }
  if (gameState !== GAME_STATES.INVENTORY && leftoversUiState.active) {
    leftoversUiState.active = false;
    leftoversUiState.leftoverId = "";
    leftoversUiState.openedFromInteraction = false;
    leftoversUiState.requestCloseInventory = false;
  }
  if (gameState !== GAME_STATES.INVENTORY && Array.isArray(leftoversState?.entries)) {
    leftoversState.entries = leftoversState.entries.filter((entry) => {
      if (!entry) return false;
      const hasLoot = (Number(entry.gold) > 0) || (Number(entry.silver) > 0) || (Array.isArray(entry.items) && entry.items.length > 0);
      return hasLoot;
    });
  }

  updateHanamiDojoExitSequence(now);
  updatePatInnIntroSequence(now);
  syncObjectiveState(now);
  markNearbyDoorsDiscovered();
  regenerateMana(now);
  updateObeySystem(now);
  if (doorAccessNoticeState.active && now >= doorAccessNoticeState.until) {
    doorAccessNoticeState.active = false;
    doorAccessNoticeState.text = "";
  }

  if (saveNoticeState.active && now - saveNoticeState.startedAt >= saveNoticeState.durationMs) {
    saveNoticeState.active = false;
  }

  const celebrationStartedAt = Number.isFinite(playerStats.combatLevelCelebrationStartedAt)
    ? playerStats.combatLevelCelebrationStartedAt
    : 0;
  const celebrationElapsed = now - celebrationStartedAt;
  const celebrationDurationMs = 9000;
  if (
    celebrationStartedAt > 0 &&
    celebrationElapsed >= 0 &&
    celebrationElapsed <= celebrationDurationMs &&
    isFreeExploreState(gameState)
  ) {
    const lastFireworkAt = Number.isFinite(playerStats.combatLevelCelebrationLastFireworkAt)
      ? playerStats.combatLevelCelebrationLastFireworkAt
      : celebrationStartedAt;
    const fireworkIntervalMs = 1150;
    if (now - lastFireworkAt >= fireworkIntervalMs) {
      playerStats.combatLevelCelebrationLastFireworkAt = now;
      musicManager.playSfx("fireworkBurst");
    }
  } else if (celebrationStartedAt > 0 && celebrationElapsed > celebrationDurationMs) {
    playerStats.combatLevelCelebrationLastFireworkAt = 0;
  }

  if (combatRewardPanel.active && now - combatRewardPanel.startedAt >= combatRewardPanel.durationMs) {
    showNextCombatReward(now);
  }
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
    playerCurrency,
    playerEquipment,
    inventoryUiLayout,
    leftoversState,
    objectiveState,
    currentGameState: gameState,
    townId: currentTownId,
    areaId: currentAreaId
  };
}

const {
  performSaveGame,
  performLoadGame,
  performStartNewGame,
  applyTitlePreviewSnapshot,
  applyTitleStartPreview
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
  musicManager,
  onSaveNotice: pushSaveNotice,
  onAfterRestore: () => {
    ensurePlayerSkillState(player);
    player.lastManaRegenTickAt = performance.now();
    leftoversUiState.active = false;
    leftoversUiState.leftoverId = "";
    leftoversUiState.openedFromInteraction = false;
    leftoversUiState.requestCloseInventory = false;
    applyStoryNpcVisibility();
    uiMotionState.minimapRevealAt = performance.now();
    syncObjectiveState(performance.now());
  }
});

const hasTitlePreviewSave = applyTitlePreviewSnapshot();
applyStoryNpcVisibility();

const { isConditionallyHiddenDoor, getRespawnDestination } = createWorldStateHandlers({
  worldService,
  tileSize: TILE,
  gameFlags,
  getCurrentTownId,
  getCurrentAreaId
});

const gameplayStartState = gameState;
const titleScreenSystem = createTitleScreenSystem({ tileSize: TILE, cameraZoom: CAMERA_ZOOM, musicManager, canvas });
titleScreenSystem.syncContinueAvailability(hasTitlePreviewSave);
// Use system state for rendering access
const titleState = titleScreenSystem.state;
const studioIntroState = {
  startedAt: 0,
  fadeToBlackMs: 700,
  blackHoldMs: 2000,
  shineDurationMs: 3000,
  shineFadeOutMs: 1100,
  postShineBlackHoldMs: 500,
  sceneFadeInMs: 1800,
  sceneHoldMs: 4000,
  firstCutsceneSfxPlayed: false
};
gameState = GAME_STATES.TITLE_SCREEN;
titleState.startedAt = performance.now();
let titlePreviewMode = hasTitlePreviewSave ? "continue" : "start";

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
      const reward = grantCombatXpAndCollectSummary(enemy, now);
      spawnEnemyLeftovers(enemy, now);
      const ex = Number.isFinite(enemy?.x) ? enemy.x + (Number(enemy?.width) || TILE) * 0.5 : player.x + TILE * 0.5;
      const ey = Number.isFinite(enemy?.y) ? enemy.y + (Number(enemy?.height) || TILE) * 0.25 : player.y;
      vfxSystem.spawn("xpGainText", {
        x: ex,
        y: ey,
        text: `+${reward.xpGained} xp`,
        color: reward.completedLevelUp ? "#fff2ba" : "#a8e4ff",
        glowColor: reward.completedLevelUp ? "rgba(255, 206, 96, 0.4)" : "rgba(101, 197, 255, 0.34)",
        durationMs: 1450
      });
      syncObjectiveState(now);
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
      const enemyId = typeof enemy?.id === "string" ? enemy.id.toLowerCase() : "";
      const enemyName = typeof enemy?.name === "string" ? enemy.name.toLowerCase() : "";
      const isOgre = enemyId.includes("ogre") || enemyName.includes("ogre");
      if (isOgre) {
        musicManager.playSfx("ogreAttack");
      }
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

function pauseDialogueAdvance(durationMs, options = {}) {
  if (typeof dialogue.lockAdvanceFor === "function") {
    dialogue.lockAdvanceFor(durationMs, options);
  }
}

function lockInteractionInput(durationMs = 0) {
  const ms = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  interactionInputLockedUntil = Math.max(interactionInputLockedUntil, performance.now() + ms);
}

function isInteractionLocked() {
  return performance.now() < interactionInputLockedUntil || isHanamiDojoExitControlLockActive();
}

function clearMenuHoverState() {
  pauseMenuState.hovered = -1;
  titleState.hovered = -1;
}

function updateMenuHoverStateFromMouse(mouseX, mouseY) {
  clearMenuHoverState();
  if (!mouseUiState.insideCanvas) return;
  if (gameState === GAME_STATES.PAUSE_MENU || gameState === GAME_STATES.SETTINGS) {
    pauseMenuSystem.handleMouseMove(mouseX, mouseY);
    return;
  }
  if (gameState === GAME_STATES.TITLE_SCREEN) {
    titleScreenSystem.handleMouseMove(mouseX, mouseY);
  }
}

function getActiveTitleOption() {
  const hovered = Number.isInteger(titleState.hovered) ? titleState.hovered : -1;
  const activeIndex = hovered >= 0 ? hovered : titleState.selected;
  return titleState.options[activeIndex] || "";
}

function syncTitlePreviewBackground() {
  if (gameState !== GAME_STATES.TITLE_SCREEN) return;

  const activeOption = getActiveTitleOption();
  const wantsStartPreview = !hasTitlePreviewSave || activeOption === "Start Journey" || activeOption === "How To Play";
  const desiredMode = wantsStartPreview ? "start" : "continue";
  if (desiredMode === titlePreviewMode) return;

  const applied = desiredMode === "start"
    ? applyTitleStartPreview()
    : applyTitlePreviewSnapshot();
  if (!applied) return;

  titlePreviewMode = desiredMode;
}

function updateTitleScreenWithPreview(now) {
  if (gameState === GAME_STATES.INTRO_CUTSCENE) {
    const intro = studioIntroState;
    const totalDurationMs = intro.fadeToBlackMs
      + intro.blackHoldMs
      + intro.shineDurationMs
      + intro.shineFadeOutMs
      + intro.postShineBlackHoldMs
      + intro.sceneFadeInMs
      + intro.sceneHoldMs;
    const elapsed = now - intro.startedAt;
    const shineStartAt = intro.fadeToBlackMs + intro.blackHoldMs;
    if (!intro.firstCutsceneSfxPlayed && elapsed >= shineStartAt) {
      musicManager.playSfx("firstCutscene");
      intro.firstCutsceneSfxPlayed = true;
    }
    if (elapsed >= totalDurationMs) {
      gameState = gameplayStartState;
      previousWorldState = gameplayStartState;
      previousGameState = gameplayStartState;
      if (gameController && typeof gameController.syncMusicForCurrentArea === "function") {
        gameController.syncMusicForCurrentArea();
      }
    }
    return;
  }
  if (gameState !== GAME_STATES.TITLE_SCREEN) return;
  syncTitlePreviewBackground();
  updateTitleScreen(now);
}

function handlePauseMenuLeftClick(mouseX, mouseY) {
  if (gameState !== GAME_STATES.PAUSE_MENU && gameState !== GAME_STATES.SETTINGS) return false;

  const openInventoryFromPause = () => {
    openInventoryFromPauseMenu();
  };
  const openAttributesFromPause = () => {
    gameState = GAME_STATES.ATTRIBUTES;
  };
  const openSettingsFromPause = () => {
    gameState = GAME_STATES.SETTINGS;
  };

  return pauseMenuSystem.handleClick(mouseX, mouseY, {
    onResume: resumeFromPauseMenu,
    onInventory: openInventoryFromPause,
    onAttributes: openAttributesFromPause,
    onSave: performSaveGame,
    onLoad: performLoadGame,
    onSettings: openSettingsFromPause,
    onQuit: () => {
      location.reload();
    }
  }, input);
}

function handleTitleLeftClick(mouseX, mouseY) {
  if (gameState !== GAME_STATES.TITLE_SCREEN) return false;

  return titleScreenSystem.handleClick(mouseX, mouseY, {
    onStartGame: () => {
      startNewGameWithIntro();
    },
    onContinueGame: () => {
      performLoadGame();
    }
  });
}

function startNewGameWithIntro() {
  performStartNewGame();
  studioIntroState.startedAt = performance.now();
  studioIntroState.firstCutsceneSfxPlayed = false;
  gameState = GAME_STATES.INTRO_CUTSCENE;
  titleState.fadeOutActive = false;
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
  cameraZoom: CAMERA_ZOOM,
  gameFlags,
  playerInventory,
  playerEquipment,
  playerStats,
  trainingPopup,
  itemAlert,
  inventoryHint,
  player,
  npcs,
  leftovers: leftoversState.entries,
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
  pauseDialogueAdvance,
  lockInteractionInput,
  isInteractionLocked,
  getInteractPressed: () => input.getInteractPressed(),
  clearInteractPressed: () => input.clearInteractPressed(),
  syncObjectiveState: () => syncObjectiveState(performance.now()),
  spawnVisualEffect: (type, options) => vfxSystem.spawn(type, options),
  canEnterDoor: ({ doorTile, destination, townId, areaId, playerEquipment: equipment }) => {
    const isDojoUpstairsDoor =
      townId === PAT_INN_TOWN_ID &&
      areaId === HANAMI_DOJO_AREA_ID &&
      doorTile?.tx === HANAMI_DOJO_UPSTAIRS_DOOR_X &&
      doorTile?.ty === HANAMI_DOJO_UPSTAIRS_DOOR_Y &&
      destination?.areaId === HANAMI_DOJO_UPSTAIRS_AREA_ID;
    if (!isDojoUpstairsDoor) {
      return { allowed: true };
    }
    const equippedHead = equipment && typeof equipment === "object" ? equipment.head : null;
    if (equippedHead === "Training Headband") {
      return { allowed: true };
    }
    return {
      allowed: false,
      message: "You must have the training headband equipped to enter"
    };
  },
  onDoorEntryBlocked: ({ doorTile, message }) => {
    const now = performance.now();
    const doorCenterX = doorTile.tx * TILE + TILE * 0.5;
    const doorCenterY = doorTile.ty * TILE + TILE * 0.5;
    const playerCenterX = player.x + TILE * 0.5;
    const playerCenterY = player.y + TILE * 0.5;
    let vx = doorCenterX - playerCenterX;
    let vy = doorCenterY - playerCenterY;
    const length = Math.hypot(vx, vy) || 1;
    vx /= length;
    vy /= length;

    const bounceDistance = TILE * 0.65;
    player.x = Math.max(0, Math.min(currentMapW * TILE - TILE, player.x - vx * bounceDistance));
    player.y = Math.max(0, Math.min(currentMapH * TILE - TILE, player.y - vy * bounceDistance));
    player.walking = false;

    setDoorAccessNotice(message, 1800);
    musicManager.playSfx("collision");
    vfxSystem.spawn("interactionPulse", {
      x: doorCenterX,
      y: doorCenterY,
      size: 20,
      durationMs: 220,
      startedAt: now
    });
  },
  onLeftoversInteracted: (leftover) => {
    openLeftoversInventory(leftover);
  },
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
    resolveGameplayState: () => getSimulationGameState(gameState),
    isPlayerMovementLocked: () => patInnIntroState.active || isHanamiDojoExitControlLockActive(),
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
    updateFeatureState: (activeGameState) => featureCoordinator.updateForState(activeGameState),
    onAreaChanged: ({ previousTownId, previousAreaId, townId, areaId }) => {
      if (previousTownId !== townId || previousAreaId !== areaId) {
        uiMotionState.minimapRevealAt = performance.now();
      }
      if (previousTownId === townId) {
        updateTownReentryEnemyRespawnsOnAreaChange({ previousAreaId, areaId });
      }
      applyStoryNpcVisibility();
      if (
        !gameFlags.patInnIntroSeen &&
        townId === PAT_INN_TOWN_ID &&
        areaId === PAT_INN_AREA_ID &&
        (previousTownId !== townId || previousAreaId !== areaId)
      ) {
        patInnIntroState.pendingStart = true;
      }
      syncObjectiveState(performance.now());
    }
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
      onStartGame: startNewGameWithIntro,
      onContinueGame: performLoadGame
    },
    onResume: resumeFromPauseMenu,
    onInventory: () => {
      openInventoryFromPauseMenu();
    },
    closeInventory: closeInventoryToWorld,
    isInventoryOpenedFromPauseMenu,
    onAttributes: () => {
      gameState = GAME_STATES.ATTRIBUTES;
    },
    onSettings: () => {
      gameState = GAME_STATES.SETTINGS;
    },
    onSave: performSaveGame,
    onLoad: performLoadGame,
    onQuit: () => location.reload(),
    openPauseMenu,
    closePauseMenu: returnToPauseMenu,
    canRunCombatSystems,
    isInputLocked: isHanamiDojoExitControlLockActive,
    isDialogueActive
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
  dialogue,
  confirmChoice,
  settingsUiState,
  setSettingsStatus,
  musicManager,
  persistUserSettings,
  titleScreenSystem,
  pauseMenuSystem,
  performSaveGame,
  performStartNewGame: startNewGameWithIntro,
  performLoadGame,
  resumeFromPauseMenu,
  openInventoryFromPauseMenu,
  closeInventory: closeInventoryToWorld,
  isInventoryOpenedFromPauseMenu,
  isLeftoversInventoryOpen: () => Boolean(leftoversUiState.active && gameState === GAME_STATES.INVENTORY),
  openAttributesFromPauseMenu: () => {
    gameState = GAME_STATES.ATTRIBUTES;
  },
  openSettingsFromPauseMenu: () => {
    gameState = GAME_STATES.SETTINGS;
  },
  returnToPauseMenu,
  openPauseMenu,
  isInputLocked: isHanamiDojoExitControlLockActive,
  isFreeExploreState,
  handleSkillSlotPressed: tryActivateSkillSlot,
  tryOpenLeftoversFromInteract: () => {
    if (!isFreeExploreState(gameState)) return false;
    if (dialogue.isActive() || choiceState.active || doorSequence.active) return false;
    const nearbyLeftover = findClosestNearbyLeftoverForInteraction();
    if (!nearbyLeftover) return false;
    openLeftoversInventory(nearbyLeftover);
    input.clearInteractPressed();
    return true;
  },
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
  studioIntroState,
  playerDefeatSequence,
  player,
  npcs,
  enemies,
  leftoversState,
  gameFlags,
  input,
  settingsUiState,
  settingsItems: SETTINGS_ITEMS,
  trainingPopup,
  obeyState,
  playerStats,
  playerInventory,
  playerCurrency,
  playerEquipment,
  inventoryUiLayout,
  leftoversUiState,
  objectiveState,
  uiMotionState,
  minimapDiscoveryState,
  itemAlert,
  inventoryHint,
  saveNoticeState,
  doorAccessNoticeState,
  combatRewardPanel,
  pauseMenuState,
  mouseUiState,
  vfxSystem,
  getCurrentTownId,
  getCurrentAreaId,
  getCurrentMap,
  getCurrentMapW,
  getCurrentMapH,
  getGameState,
  getSimulationGameState,
  isConditionallyHiddenDoor
});

if (gameState === GAME_STATES.TITLE_SCREEN) {
  musicManager.playMusicForArea(TITLE_SCREEN_MUSIC_KEY);
} else if (gameState !== GAME_STATES.INTRO_CUTSCENE) {
  gameController.syncMusicForCurrentArea();
}

const { startLoop } = createGameLoop({
  gameStates: GAME_STATES,
  getGameState,
  getSimulationGameState,
  syncPointerLockWithState,
  inputController,
  pauseMenuSystem,
  combatFeedback,
  updateTitleScreen: updateTitleScreenWithPreview,
  updatePlayerDefeatSequence,
  gameController,
  prepareChallengeEnemies,
  enemyAiSystem,
  isDialogueActive,
  choiceState,
  enemies,
  npcs,
  player,
  playerEquipment,
  getCurrentAreaId,
  getCurrentMap,
  getCurrentMapW,
  getCurrentMapH,
  collisionService,
  combatSystem,
  input,
  updateFountainHealing,
  vfxSystem,
  updateRuntimeUi,
  render
});

startLoop();

