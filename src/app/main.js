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
  isFreeExploreState
} from "../core/constants.js";
import { InputManager } from "../core/InputManager.js";
import { CollisionService } from "../core/CollisionSystem.js";
import { loadGameSnapshot, loadUserSettings, saveGameSnapshot, saveUserSettings } from "../core/Persistence.js";
import { drawTile as drawTileSystem } from "../rendering/TileSystem.js";
import { DialogueSystem } from "../game/DialogueSystem.js";
import { renderGameFrame } from "../game/RenderSystem.js";
import { createMovementSystem } from "../game/MovementSystem.js";
import { createInteractionSystem } from "../game/InteractionSystem.js";
import { createGameController } from "../game/GameController.js";
import { createGameRuntime } from "../game/bootstrap.js";
import { createCombatSystem } from "../game/CombatSystem.js";
import { createEnemyAISystem } from "../game/EnemyAISystem.js";
import { createVfxSystem } from "../game/VfxSystem.js";
import { createGameFeatures } from "../game/features/index.js";
import { createFeatureCoordinator } from "../game/features/FeatureCoordinator.js";

const { canvas, ctx, assets, worldService, musicManager, state } = createGameRuntime();

const {
  gameFlags,
  playerInventory,
  playerStats,
  trainingPopup,
  itemAlert,
  inventoryHint,
  npcs,
  enemies,
  player,
  cam,
  doorSequence,
  playerDefeatSequence
} = state;

const TITLE_SCREEN_MUSIC_KEY = "__title_screen_music__";
const TITLE_SCREEN_MUSIC_SRC = "assets/sprites/StartScreen_Audio.wav";
musicManager.registerAreaTrack(TITLE_SCREEN_MUSIC_KEY, TITLE_SCREEN_MUSIC_SRC);

let { currentTownId, currentAreaId, currentMap, currentMapW, currentMapH, gameState, previousWorldState } = state;

let previousGameState = GAME_STATES.OVERWORLD;
let gameController = null;
const mouseUiState = {
  x: 0,
  y: 0,
  insideCanvas: false
};
let pointerLockPrimed = false;

const userSettings = loadUserSettings();
const settingsUiState = {
  selected: 0,
  awaitingRebindAction: null,
  statusText: "",
  statusUntil: 0
};

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

function updateMouseUiPosition(e) {
  const rect = canvas.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) return;
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  mouseUiState.x = (e.clientX - rect.left) * scaleX;
  mouseUiState.y = (e.clientY - rect.top) * scaleY;
  mouseUiState.insideCanvas = true;
  updateMenuHoverStateFromMouse(mouseUiState.x, mouseUiState.y);
}

function canUsePointerLock() {
  return typeof canvas.requestPointerLock === "function" && typeof document.exitPointerLock === "function";
}

function shouldUnlockPointerForCurrentState() {
  return (
    gameState === GAME_STATES.TITLE_SCREEN ||
    gameState === GAME_STATES.PAUSE_MENU ||
    gameState === GAME_STATES.INVENTORY
  );
}

function requestCanvasPointerLock() {
  if (!canUsePointerLock()) return;
  try {
    const maybePromise = canvas.requestPointerLock();
    if (maybePromise && typeof maybePromise.catch === "function") {
      maybePromise.catch(() => {});
    }
  } catch {
    // Ignore lock errors (e.g. browser gesture policy).
  }
}

function syncPointerLockWithState({ fromUserGesture = false } = {}) {
  if (!canUsePointerLock()) return;
  const isLockedToCanvas = document.pointerLockElement === canvas;
  if (shouldUnlockPointerForCurrentState()) {
    if (isLockedToCanvas) {
      document.exitPointerLock();
    }
    return;
  }
  if (!pointerLockPrimed || isLockedToCanvas || !fromUserGesture) return;
  requestCanvasPointerLock();
}

canvas.addEventListener("mousemove", updateMouseUiPosition);
canvas.addEventListener("mouseleave", () => {
  mouseUiState.insideCanvas = false;
  clearMenuHoverState();
});
canvas.addEventListener("mousedown", (e) => {
  pointerLockPrimed = true;
  updateMouseUiPosition(e);
  syncPointerLockWithState({ fromUserGesture: true });
});
canvas.addEventListener("click", (e) => {
  if (e.button !== 0) return;
  updateMouseUiPosition(e);
  const handledByTitle = handleTitleLeftClick(mouseUiState.x, mouseUiState.y);
  const handledByPause = handledByTitle ? false : handlePauseMenuLeftClick(mouseUiState.x, mouseUiState.y);
  if (handledByTitle || handledByPause) {
    e.preventDefault();
  }
});
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === canvas) {
    mouseUiState.insideCanvas = true;
    return;
  }
  mouseUiState.insideCanvas = false;
});

let interactionSystem = null;
const input = new InputManager({
  keyBindings: userSettings.keybindings,
  onToggleInventory: () => {
    if (interactionSystem) {
      interactionSystem.toggleInventory();
    }
  },
  shouldHandleInput: () => !(
    gameState === GAME_STATES.TITLE_SCREEN ||
    gameState === GAME_STATES.PAUSE_MENU ||
    gameState === GAME_STATES.INVENTORY ||
    gameState === GAME_STATES.ATTRIBUTES ||
    gameState === GAME_STATES.SETTINGS ||
    gameState === GAME_STATES.PLAYER_DEFEATED
  )
});

const collisionService = new CollisionService({ tileSize: TILE });

const movementSystem = createMovementSystem({
  keys: input.keys,
  getActionPressed: (action) => input.isActionPressed(action),
  tileSize: TILE,
  spriteFramesPerRow: SPRITE_FRAMES_PER_ROW,
  cameraZoom: CAMERA_ZOOM,
  musicManager
});

const dialogue = new DialogueSystem({ ctx, canvas, ui: UI });
const choiceState = dialogue.choiceState;
const pauseMenuState = {
  active: false,
  selected: 0,
  hovered: -1,
  options: ["Inventory", "Attributes", "Settings", "Save", "Load", "Quit"],
  highContrast: Boolean(userSettings.highContrastMenu),
  animationMode: "idle",
  animationStartedAt: 0,
  animationDurationMs: 170
};
const gamepadMenuState = {
  nextMoveAt: 0,
  heldDirection: 0,
  confirmHeld: false,
  backHeld: false,
  startHeld: false,
  attackHeld: false
};
const trainingContent = worldService.getTrainingContent();
const vfxSystem = createVfxSystem();
dialogue.setTextSpeedMultiplier(userSettings.textSpeedMultiplier);

const combatFeedback = {
  hitstopUntil: 0,
  shakeUntil: 0,
  shakeMagnitude: 0,
  lastEnemyTelegraphAt: 0
};

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

function triggerHitstop(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return;
  const now = performance.now();
  combatFeedback.hitstopUntil = Math.max(combatFeedback.hitstopUntil, now + durationMs);
}

function triggerCameraShake(magnitude = 0, durationMs = 0) {
  if (!userSettings.screenShake) return;
  if (!Number.isFinite(durationMs) || durationMs <= 0) return;
  const now = performance.now();
  combatFeedback.shakeUntil = Math.max(combatFeedback.shakeUntil, now + durationMs);
  combatFeedback.shakeMagnitude = Math.max(combatFeedback.shakeMagnitude, magnitude);
}

function buildGameSnapshot() {
  return {
    version: 1,
    world: {
      townId: currentTownId,
      areaId: currentAreaId
    },
    player: {
      x: player.x,
      y: player.y,
      dir: player.dir,
      hp: player.hp,
      maxHp: player.maxHp,
      equippedAttackId: player.equippedAttackId || "lightSlash"
    },
    gameFlags: { ...gameFlags },
    playerStats: { ...playerStats },
    playerInventory: { ...playerInventory }
  };
}

function resolveNearestWalkablePlayerPosition(rawX, rawY) {
  const startTx = Math.floor((rawX + TILE * 0.5) / TILE);
  const startTy = Math.floor((rawY + TILE * 0.5) / TILE);
  const maxRadius = 10;

  for (let radius = 0; radius <= maxRadius; radius++) {
    for (let oy = -radius; oy <= radius; oy++) {
      for (let ox = -radius; ox <= radius; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== radius) continue;

        const tx = startTx + ox;
        const ty = startTy + oy;
        if (tx < 0 || ty < 0 || tx >= currentMapW || ty >= currentMapH) continue;

        const candidateX = tx * TILE;
        const candidateY = ty * TILE;
        if (collisionService.collides(candidateX, candidateY, currentMap, currentMapW, currentMapH)) continue;
        if (collisionService.collidesWithNPC(candidateX, candidateY, npcs, currentAreaId)) continue;

        return { x: candidateX, y: candidateY };
      }
    }
  }

  return {
    x: Number.isFinite(player.spawnX) ? player.spawnX : rawX,
    y: Number.isFinite(player.spawnY) ? player.spawnY : rawY
  };
}

function applyGameSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;

  const townId = snapshot.world?.townId;
  const areaId = snapshot.world?.areaId;
  const area = worldService.getArea(townId, areaId);
  if (!area) return false;

  currentTownId = townId;
  currentAreaId = areaId;
  currentMap = area.map;
  currentMapW = area.width;
  currentMapH = area.height;

  const nextTownNPCs = worldService.createNPCsForTown(currentTownId);
  npcs.splice(0, npcs.length, ...nextTownNPCs);
  const nextTownEnemies = worldService.createEnemiesForTown(currentTownId);
  enemies.splice(0, enemies.length, ...nextTownEnemies);

  const px = Number.isFinite(snapshot.player?.x) ? snapshot.player.x : player.x;
  const py = Number.isFinite(snapshot.player?.y) ? snapshot.player.y : player.y;
  const safePosition = resolveNearestWalkablePlayerPosition(px, py);
  player.x = safePosition.x;
  player.y = safePosition.y;
  player.spawnX = safePosition.x;
  player.spawnY = safePosition.y;
  player.dir = snapshot.player?.dir || player.dir || "down";
  player.maxHp = Number.isFinite(snapshot.player?.maxHp) ? Math.max(1, snapshot.player.maxHp) : player.maxHp;
  player.hp = Number.isFinite(snapshot.player?.hp)
    ? Math.max(0, Math.min(player.maxHp, snapshot.player.hp))
    : player.hp;
  player.equippedAttackId = snapshot.player?.equippedAttackId || player.equippedAttackId || "lightSlash";

  if (snapshot.gameFlags && typeof snapshot.gameFlags === "object") {
    Object.assign(gameFlags, snapshot.gameFlags);
  }
  if (snapshot.playerStats && typeof snapshot.playerStats === "object") {
    Object.assign(playerStats, snapshot.playerStats);
  }
  if (snapshot.playerInventory && typeof snapshot.playerInventory === "object") {
    for (const key of Object.keys(playerInventory)) {
      delete playerInventory[key];
    }
    Object.assign(playerInventory, snapshot.playerInventory);
  }

  const resolvedState = worldService.getAreaKind(currentTownId, currentAreaId) === AREA_KINDS.OVERWORLD
    ? GAME_STATES.OVERWORLD
    : GAME_STATES.INTERIOR;
  if (gameState !== GAME_STATES.TITLE_SCREEN) {
    gameState = resolvedState;
    previousWorldState = resolvedState;
    previousGameState = resolvedState;
  }

  cam.initialized = false;
  return true;
}

function performSaveGame() {
  const ok = saveGameSnapshot(buildGameSnapshot());
  if (ok) {
    musicManager.playSfx("saveGame");
    setSettingsStatus("Game saved.");
  } else {
    musicManager.playSfx("uiError");
    setSettingsStatus("Save failed.");
  }
}

function performLoadGame() {
  const snapshot = loadGameSnapshot();
  if (!snapshot) {
    musicManager.playSfx("uiError");
    setSettingsStatus("No save found.");
    return;
  }
  const ok = applyGameSnapshot(snapshot);
  if (!ok) {
    musicManager.playSfx("uiError");
    setSettingsStatus("Save data invalid.");
    return;
  }

  if (gameController && typeof gameController.syncMusicForCurrentArea === "function") {
    gameController.syncMusicForCurrentArea();
  }

  musicManager.playSfx("loadGame");
  setSettingsStatus("Save loaded.");
}

const newGameBaselineSnapshot = buildGameSnapshot();
const titlePreviewSnapshot = loadGameSnapshot();
if (titlePreviewSnapshot) {
  applyGameSnapshot(titlePreviewSnapshot);
}

const HANAMI_DOJO_UPSTAIRS_DOOR_TILE = Object.freeze({
  areaId: "hanamiDojo",
  x: 9,
  y: 3
});

function isHanamiDojoUpstairsDoorTile(tileX, tileY) {
  return (
    currentAreaId === HANAMI_DOJO_UPSTAIRS_DOOR_TILE.areaId &&
    tileX === HANAMI_DOJO_UPSTAIRS_DOOR_TILE.x &&
    tileY === HANAMI_DOJO_UPSTAIRS_DOOR_TILE.y
  );
}

function shouldHideHanamiDojoUpstairsDoor(tileX, tileY) {
  return !gameFlags.acceptedTraining && isHanamiDojoUpstairsDoorTile(tileX, tileY);
}

function getMrHanamiRespawnDestination() {
  const fallbackSpawn = worldService.resolveSpawn("hanamiTown", "dojoInteriorDoor");
  const fallback = {
    townId: fallbackSpawn?.townId || "hanamiTown",
    areaId: fallbackSpawn?.areaId || "hanamiDojo",
    x: Number.isFinite(fallbackSpawn?.x) ? fallbackSpawn.x : 6 * TILE,
    y: Number.isFinite(fallbackSpawn?.y) ? fallbackSpawn.y : 8 * TILE,
    dir: "up"
  };

  const hanamiTown = worldService.getTown("hanamiTown");
  const dojoArea = worldService.getArea("hanamiTown", "hanamiDojo");
  if (!hanamiTown || !dojoArea) return fallback;

  const mrHanamiDef = Array.isArray(hanamiTown.npcs)
    ? hanamiTown.npcs.find((npc) => npc && npc.id === "mrHanami")
    : null;
  if (!mrHanamiDef) return fallback;

  const facingOffsets = {
    up: { x: 0, y: -1, dir: "down" },
    down: { x: 0, y: 1, dir: "up" },
    left: { x: -1, y: 0, dir: "right" },
    right: { x: 1, y: 0, dir: "left" }
  };
  const facing = facingOffsets[mrHanamiDef.dir || "down"] || facingOffsets.down;
  const targetTx = mrHanamiDef.x + facing.x;
  const targetTy = mrHanamiDef.y + facing.y;

  const inBounds =
    targetTx >= 0 &&
    targetTy >= 0 &&
    targetTx < dojoArea.width &&
    targetTy < dojoArea.height;
  if (!inBounds) return fallback;

  const tile = dojoArea.map[targetTy]?.[targetTx];
  if (
    tile === TILE_TYPES.WALL ||
    tile === TILE_TYPES.TREE ||
    tile === TILE_TYPES.SIGNPOST
  ) {
    return fallback;
  }

  return {
    townId: "hanamiTown",
    areaId: "hanamiDojo",
    x: targetTx * TILE,
    y: targetTy * TILE,
    dir: facing.dir
  };
}

function finishPlayerDefeatSequence(now) {
  const destination = playerDefeatSequence.destination || getMrHanamiRespawnDestination();

  if (gameController && typeof gameController.setArea === "function") {
    gameController.setArea(destination.townId, destination.areaId);
  }

  player.x = destination.x;
  player.y = destination.y;
  player.dir = destination.dir || "up";
  player.hp = player.maxHp;
  player.walking = false;
  player.isTraining = false;
  player.attackState = "idle";
  player.activeAttackId = null;
  player.requestedAttackId = null;
  player.invulnerableUntil = now + 1200;

  vfxSystem.spawn("doorSwirl", {
    x: player.x + TILE / 2,
    y: player.y + TILE / 2,
    size: 30,
    durationMs: 500
  });
}

function updatePlayerDefeatSequence(now) {
  if (!playerDefeatSequence.active) return;

  const elapsed = now - playerDefeatSequence.phaseStartedAt;

  if (playerDefeatSequence.phase === "fall") {
    playerDefeatSequence.fallProgress = Math.max(
      0,
      Math.min(1, elapsed / Math.max(1, playerDefeatSequence.fallDurationMs))
    );
    playerDefeatSequence.overlayAlpha = 0;

    if (elapsed >= playerDefeatSequence.fallDurationMs) {
      playerDefeatSequence.phase = "fadeOut";
      playerDefeatSequence.phaseStartedAt = now;
      playerDefeatSequence.fallProgress = 1;
    }
    return;
  }

  if (playerDefeatSequence.phase === "fadeOut") {
    playerDefeatSequence.overlayAlpha = Math.max(
      0,
      Math.min(1, elapsed / Math.max(1, playerDefeatSequence.fadeOutDurationMs))
    );

    if (elapsed >= playerDefeatSequence.fadeOutDurationMs) {
      finishPlayerDefeatSequence(now);
      playerDefeatSequence.phase = "hold";
      playerDefeatSequence.phaseStartedAt = now;
      playerDefeatSequence.overlayAlpha = 1;
    }
    return;
  }

  if (playerDefeatSequence.phase === "hold") {
    playerDefeatSequence.overlayAlpha = 1;
    if (elapsed >= playerDefeatSequence.blackoutHoldMs) {
      playerDefeatSequence.phase = "fadeIn";
      playerDefeatSequence.phaseStartedAt = now;
    }
    return;
  }

  if (playerDefeatSequence.phase === "fadeIn") {
    const fadeInRatio = Math.max(
      0,
      Math.min(1, elapsed / Math.max(1, playerDefeatSequence.fadeInDurationMs))
    );
    playerDefeatSequence.overlayAlpha = 1 - fadeInRatio;

    if (elapsed >= playerDefeatSequence.fadeInDurationMs) {
      playerDefeatSequence.active = false;
      playerDefeatSequence.phase = "idle";
      playerDefeatSequence.fallProgress = 0;
      playerDefeatSequence.overlayAlpha = 0;
      playerDefeatSequence.destination = null;
      gameState = worldService.getAreaKind(currentTownId, currentAreaId) === AREA_KINDS.OVERWORLD
        ? GAME_STATES.OVERWORLD
        : GAME_STATES.INTERIOR;
      previousWorldState = gameState;
      previousGameState = gameState;
    }
  }
}

function handleChallengeEnemyDefeat(enemy, now) {
  if (!enemy || !enemy.countsForChallenge) return;
  if (!gameFlags.acceptedTraining) {
    enemy.dead = false;
    enemy.hp = enemy.maxHp;
    enemy.x = enemy.spawnX;
    enemy.y = enemy.spawnY;
    enemy.state = "idle";
    enemy.pendingStrike = false;
    enemy.respawnAt = 0;
    enemy.invulnerableUntil = now + 180;
    return;
  }
  if (gameFlags.completedTraining) return;
  if (enemy.challengeDefeatedCounted) return;

  enemy.challengeDefeatedCounted = true;
  gameFlags.hanamiChallengeKills = Math.min(
    gameFlags.hanamiChallengeTarget,
    gameFlags.hanamiChallengeKills + 1
  );

  itemAlert.active = true;
  itemAlert.text = `Challenge progress: ${gameFlags.hanamiChallengeKills}/${gameFlags.hanamiChallengeTarget}`;
  itemAlert.startedAt = now;

  if (gameFlags.hanamiChallengeKills >= gameFlags.hanamiChallengeTarget) {
    gameFlags.completedTraining = true;
    if (!gameFlags.hanamiChallengeCompleteAnnounced) {
      gameFlags.hanamiChallengeCompleteAnnounced = true;
      itemAlert.active = true;
      itemAlert.text = "Challenge complete! Speak to Mr. Hanami.";
      itemAlert.startedAt = now;
      vfxSystem.spawn("trainingBurst", {
        x: player.x + TILE / 2,
        y: player.y + TILE * 0.35,
        size: 48,
        durationMs: 800
      });
    }
  }
}

function handlePlayerDefeated({ player: defeatedPlayer }) {
  if (playerDefeatSequence.active) return;

  dialogue.close();
  input.clearAttackPressed();
  input.clearInteractPressed();

  defeatedPlayer.walking = false;
  defeatedPlayer.isTraining = false;
  defeatedPlayer.attackState = "idle";
  defeatedPlayer.activeAttackId = null;
  defeatedPlayer.requestedAttackId = null;

  gameState = GAME_STATES.PLAYER_DEFEATED;
  playerDefeatSequence.active = true;
  playerDefeatSequence.phase = "fall";
  playerDefeatSequence.phaseStartedAt = performance.now();
  playerDefeatSequence.fallProgress = 0;
  playerDefeatSequence.overlayAlpha = 0;
  playerDefeatSequence.destination = getMrHanamiRespawnDestination();
}

function handleCombatHitConfirmed(event) {
  if (!event) return;
  if (event.type === "entityDamaged") {
    triggerHitstop(52);
    triggerCameraShake(2.8, 120);
    musicManager.playSfx("hitImpact");
    return;
  }

  if (event.type === "playerDamaged") {
    triggerHitstop(44);
    triggerCameraShake(2.2, 140);
    musicManager.playSfx("hurt");
  }
}

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
const gameplayStartState = gameState;
const titleState = {
  startedAt: performance.now(),
  selected: 0,
  hovered: -1,
  options: ["Continue", "Start Journey", "How To Play"],
  showHowTo: false,
  fadeOutActive: false,
  fadeOutStartedAt: 0,
  fadeOutDurationMs: 720,
  promptPulseOffset: Math.random() * 1000
};
gameState = GAME_STATES.TITLE_SCREEN;

const FOUNTAIN_HEAL_PER_TICK = 2;
const FOUNTAIN_HEAL_INTERVAL_MS = 260;
const FOUNTAIN_HEAL_VFX_INTERVAL_MS = 760;
const fountainHealState = {
  inWater: false,
  nextHealAt: 0,
  nextVfxAt: 0
};

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

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function normalizeInputKey(key) {
  if (key === " ") return "space";
  return String(key || "").toLowerCase();
}

function isPauseKey(key) {
  return input.matchesActionKey("pause", key) && !input.matchesActionKey("inventory", key);
}

function moveTitleSelection(direction) {
  const total = titleState.options.length;
  titleState.selected = (titleState.selected + direction + total) % total;
  musicManager.playSfx("menuMove");
}

function confirmTitleSelection() {
  const selected = titleState.options[titleState.selected];
  if (selected === "How To Play") {
    titleState.showHowTo = !titleState.showHowTo;
    musicManager.playSfx("menuSelect");
    return;
  }

  if (selected === "Continue") {
    const snapshot = loadGameSnapshot();
    if (!snapshot || !applyGameSnapshot(snapshot)) {
      musicManager.playSfx("uiError");
      return;
    }
  } else if (selected === "Start Journey") {
    applyGameSnapshot(newGameBaselineSnapshot);
  }

  titleState.fadeOutActive = true;
  titleState.fadeOutStartedAt = performance.now();
  titleState.showHowTo = false;
  vfxSystem.spawn("pickupGlow", {
    x: player.x + TILE / 2,
    y: player.y + TILE * 0.3,
    size: 40,
    durationMs: 620
  });
  musicManager.playSfx("menuConfirm");
}

function pointInRect(px, py, x, y, w, h) {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

function getPauseMenuOptionIndexAtPosition(mouseX, mouseY) {
  const options = pauseMenuState?.options || ["Inventory", "Attributes", "Settings", "Save", "Load", "Quit"];
  const optionStartY = 106;
  const optionStep = 46;
  const minMenuH = 392;
  const requiredMenuH = optionStartY + Math.max(0, options.length - 1) * optionStep + 120;
  const menuW = 340;
  const menuH = Math.max(minMenuH, requiredMenuH);
  const mode = pauseMenuState?.animationMode || "idle";
  const startedAt = pauseMenuState?.animationStartedAt || 0;
  const duration = Math.max(1, pauseMenuState?.animationDurationMs || 160);
  const t = Math.min(1, (performance.now() - startedAt) / duration);
  let visibility = 1;
  if (mode === "in") visibility = t;
  else if (mode === "out") visibility = 1 - t;
  const slideOffset = (1 - Math.max(0, Math.min(1, visibility))) * 34;
  const menuX = canvas.width - menuW - 24 + slideOffset;
  const menuY = (canvas.height - menuH) / 2;

  for (let i = 0; i < options.length; i++) {
    const optionY = menuY + optionStartY + i * optionStep;
    const rowX = menuX + 24;
    const rowY = optionY - 23;
    const rowW = menuW - 48;
    const rowH = 44;
    if (pointInRect(mouseX, mouseY, rowX, rowY, rowW, rowH)) return i;
  }

  return -1;
}

function getTitleOptionIndexAtPosition(mouseX, mouseY) {
  const panelX = 72;
  const optionCount = Array.isArray(titleState.options) ? titleState.options.length : 0;
  const panelH = Math.max(188, 144 + Math.max(0, optionCount - 1) * 38);
  const panelY = canvas.height - (panelH + 70);
  const panelW = 372;

  for (let i = 0; i < titleState.options.length; i++) {
    const y = panelY + 64 + i * 38;
    const rowX = panelX + 14;
    const rowY = y - 20;
    const rowW = panelW - 28;
    const rowH = 28;
    if (pointInRect(mouseX, mouseY, rowX, rowY, rowW, rowH)) return i;
  }

  return -1;
}

function clearMenuHoverState() {
  pauseMenuState.hovered = -1;
  titleState.hovered = -1;
}

function updateMenuHoverStateFromMouse(mouseX, mouseY) {
  clearMenuHoverState();
  if (!mouseUiState.insideCanvas) return;
  if (gameState === GAME_STATES.PAUSE_MENU) {
    const hoverIndex = getPauseMenuOptionIndexAtPosition(mouseX, mouseY);
    pauseMenuState.hovered = hoverIndex;
    if (hoverIndex >= 0) {
      pauseMenuState.selected = hoverIndex;
    }
    return;
  }
  if (gameState === GAME_STATES.TITLE_SCREEN && !titleState.showHowTo) {
    const hoverIndex = getTitleOptionIndexAtPosition(mouseX, mouseY);
    titleState.hovered = hoverIndex;
    if (hoverIndex >= 0) {
      titleState.selected = hoverIndex;
    }
  }
}

function handlePauseMenuLeftClick(mouseX, mouseY) {
  if (gameState !== GAME_STATES.PAUSE_MENU) return false;
  const hoverIndex = getPauseMenuOptionIndexAtPosition(mouseX, mouseY);
  if (hoverIndex < 0) return false;
  pauseMenuState.selected = hoverIndex;
  pauseMenuState.hovered = hoverIndex;
  selectPauseMenuOption();
  return true;
}

function handleTitleLeftClick(mouseX, mouseY) {
  if (gameState !== GAME_STATES.TITLE_SCREEN) return false;

  if (titleState.showHowTo) {
    const helpW = Math.min(canvas.width - 120, 520);
    const helpH = 236;
    const helpX = Math.round((canvas.width - helpW) / 2);
    const helpY = Math.round((canvas.height - helpH) / 2);
    if (pointInRect(mouseX, mouseY, helpX, helpY, helpW, helpH)) {
      titleState.showHowTo = false;
      musicManager.playSfx("menuConfirm");
      return true;
    }
    return false;
  }

  const hoverIndex = getTitleOptionIndexAtPosition(mouseX, mouseY);
  if (hoverIndex >= 0) {
    if (titleState.selected !== hoverIndex) {
      titleState.selected = hoverIndex;
      musicManager.playSfx("menuMove");
    }
    titleState.hovered = hoverIndex;
    confirmTitleSelection();
    return true;
  }

  return false;
}

function updateTitleScreen(now) {
  const worldW = currentMapW * TILE;
  const worldH = currentMapH * TILE;
  const visibleW = canvas.width / CAMERA_ZOOM;
  const visibleH = canvas.height / CAMERA_ZOOM;

  const baseX = player.x - visibleW * 0.5;
  const baseY = player.y - visibleH * 0.5;
  const seconds = (now - titleState.startedAt) / 1000;
  const driftX = Math.sin(seconds * 0.33) * TILE * 2.4;
  const driftY = Math.cos(seconds * 0.27) * TILE * 1.6;

  const minX = Math.min(0, worldW - visibleW);
  const maxX = Math.max(0, worldW - visibleW);
  const minY = Math.min(0, worldH - visibleH);
  const maxY = Math.max(0, worldH - visibleH);

  cam.x = clamp(baseX + driftX, minX, maxX);
  cam.y = clamp(baseY + driftY, minY, maxY);

  if (!titleState.fadeOutActive) return;

  const elapsed = now - titleState.fadeOutStartedAt;
  if (elapsed >= titleState.fadeOutDurationMs) {
    titleState.fadeOutActive = false;
    gameState = gameplayStartState;
    previousWorldState = gameplayStartState;
    previousGameState = gameplayStartState;
    if (gameController && typeof gameController.syncMusicForCurrentArea === "function") {
      gameController.syncMusicForCurrentArea();
    }
  }
}

function canRunCombatSystems() {
  return (
    isFreeExploreState(gameState) &&
    !isDialogueActive() &&
    !choiceState.active &&
    !doorSequence.active &&
    !player.isTraining
  );
}

function updateFountainHealing(now) {
  if (!isFreeExploreState(gameState) || doorSequence.active) {
    fountainHealState.inWater = false;
    return;
  }

  const centerX = player.x + TILE * 0.5;
  const centerY = player.y + TILE * 0.5;
  const tileX = Math.floor(centerX / TILE);
  const tileY = Math.floor(centerY / TILE);
  const inFountainWater = worldService.isFountainWaterTile(currentTownId, currentAreaId, tileX, tileY);

  if (!inFountainWater) {
    fountainHealState.inWater = false;
    return;
  }

  if (!fountainHealState.inWater) {
    fountainHealState.inWater = true;
    fountainHealState.nextHealAt = now;
  }

  if (player.hp >= player.maxHp || now < fountainHealState.nextHealAt) return;

  const healAmount = Math.min(FOUNTAIN_HEAL_PER_TICK, player.maxHp - player.hp);
  if (healAmount <= 0) return;

  player.hp += healAmount;
  fountainHealState.nextHealAt = now + FOUNTAIN_HEAL_INTERVAL_MS;

  if (now >= fountainHealState.nextVfxAt) {
    vfxSystem.spawn("damageText", {
      x: player.x + TILE * 0.5,
      y: player.y + TILE * 0.2,
      text: `+${Math.round(healAmount)}`,
      color: "rgba(171, 238, 255, 0.96)"
    });
    fountainHealState.nextVfxAt = now + FOUNTAIN_HEAL_VFX_INTERVAL_MS;
  }
}

function prepareHanamiChallengeEnemies() {
  if (!gameFlags.acceptedTraining || gameFlags.completedTraining) return;
  if (gameFlags.hanamiChallengePrepared) return;

  for (const enemy of enemies) {
    if (!enemy || !enemy.countsForChallenge) continue;
    enemy.dead = false;
    enemy.hp = enemy.maxHp;
    enemy.x = enemy.spawnX;
    enemy.y = enemy.spawnY;
    enemy.state = "idle";
    enemy.pendingStrike = false;
    enemy.invulnerableUntil = 0;
    enemy.hitStunUntil = 0;
    enemy.respawnAt = 0;
    enemy.challengeDefeatedCounted = false;
  }

  gameFlags.hanamiChallengePrepared = true;
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
  getInteractPressed: () => input.getInteractPressed(),
  clearInteractPressed: () => input.clearInteractPressed(),
  spawnVisualEffect: (type, options) => vfxSystem.spawn(type, options),
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

      // Keep dojo upstairs trapdoor fully passable until training is accepted.
      const doorTile = collisionService.doorFromCollision(...args);
      if (doorTile && shouldHideHanamiDojoUpstairsDoor(doorTile.tx, doorTile.ty)) {
        return false;
      }

      return true;
    },
    collidesWithNPCAt: (...args) => collisionService.collidesWithNPC(...args),
    detectDoorCollision: (...args) => {
      const doorTile = collisionService.doorFromCollision(...args);
      if (!doorTile) return null;
      if (shouldHideHanamiDojoUpstairsDoor(doorTile.tx, doorTile.ty)) {
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
    updateFeatureState: (activeGameState) => featureCoordinator.updateForState(activeGameState)
  }
});

input.initialize();

function setPauseMenuAnimation(mode, durationMs = 170) {
  pauseMenuState.animationMode = mode;
  pauseMenuState.animationStartedAt = performance.now();
  pauseMenuState.animationDurationMs = durationMs;
}

function openPauseMenu() {
  if (!isFreeExploreState(gameState)) return;
  previousGameState = gameState;
  gameState = GAME_STATES.PAUSE_MENU;
  syncPointerLockWithState();
  setPauseMenuAnimation("in", 170);
  musicManager.pauseForPauseMenu();
  musicManager.playSfx("menuOpen");
}

function resumeFromPauseMenu() {
  setPauseMenuAnimation("out", 140);
  gameState = previousGameState;
  syncPointerLockWithState({ fromUserGesture: true });
  musicManager.resumeFromPauseMenu();
  musicManager.playSfx("menuConfirm");
}

function returnToPauseMenu() {
  gameState = GAME_STATES.PAUSE_MENU;
  syncPointerLockWithState();
  setPauseMenuAnimation("in", 130);
  musicManager.pauseForPauseMenu();
  musicManager.playSfx("menuOpen");
}

function movePauseMenuSelection(direction) {
  const total = pauseMenuState.options.length;
  pauseMenuState.selected = (pauseMenuState.selected + direction + total) % total;
  musicManager.playSfx("menuMove");
}

function toggleHighContrastMenu() {
  pauseMenuState.highContrast = !pauseMenuState.highContrast;
  userSettings.highContrastMenu = pauseMenuState.highContrast;
  persistUserSettings();
  musicManager.playSfx("menuConfirm");
}

function getSettingsItemByIndex(index) {
  if (SETTINGS_ITEMS.length === 0) return null;
  const safe = ((index % SETTINGS_ITEMS.length) + SETTINGS_ITEMS.length) % SETTINGS_ITEMS.length;
  return SETTINGS_ITEMS[safe];
}

function moveSettingsSelection(direction) {
  if (settingsUiState.awaitingRebindAction) return;
  const total = SETTINGS_ITEMS.length;
  settingsUiState.selected = (settingsUiState.selected + direction + total) % total;
  musicManager.playSfx("menuMove");
}

function cycleSettingValue(settingId, values) {
  const current = userSettings[settingId];
  const index = values.indexOf(current);
  const next = values[(index + 1 + values.length) % values.length];
  userSettings[settingId] = next;
  if (settingId === "textSpeedMultiplier") {
    dialogue.setTextSpeedMultiplier(next);
  }
  persistUserSettings();
}

function activateSettingsItem() {
  if (settingsUiState.awaitingRebindAction) return;
  const item = getSettingsItemByIndex(settingsUiState.selected);
  if (!item) return;

  if (item.kind === "toggle") {
    if (item.id === "highContrastMenu") {
      toggleHighContrastMenu();
      return;
    }
    userSettings[item.id] = !userSettings[item.id];
    persistUserSettings();
    musicManager.playSfx("menuConfirm");
    return;
  }

  if (item.kind === "cycle") {
    cycleSettingValue(item.id, item.values || []);
    musicManager.playSfx("menuConfirm");
    return;
  }

  if (item.kind === "rebind") {
    settingsUiState.awaitingRebindAction = item.action;
    settingsUiState.statusText = `Press a key for ${item.label}`;
    settingsUiState.statusUntil = Number.POSITIVE_INFINITY;
    musicManager.playSfx("menuSelect");
    return;
  }

  if (item.id === "saveGame") {
    performSaveGame();
    return;
  }

  if (item.id === "loadGame") {
    performLoadGame();
  }
}

function selectPauseMenuOption() {
  const selected = pauseMenuState.options[pauseMenuState.selected];
  musicManager.playSfx("menuSelect");

  if (selected === "Inventory") {
    setPauseMenuAnimation("out", 140);
    gameState = GAME_STATES.INVENTORY;
  } else if (selected === "Attributes") {
    setPauseMenuAnimation("out", 140);
    gameState = GAME_STATES.ATTRIBUTES;
  } else if (selected === "Settings") {
    setPauseMenuAnimation("out", 140);
    gameState = GAME_STATES.SETTINGS;
  } else if (selected === "Save") {
    performSaveGame();
  } else if (selected === "Load") {
    performLoadGame();
  } else if (selected === "Quit") {
    if (confirm("Quit game?")) {
      window.location.reload();
    }
  }
}

function resetGamepadHeldStates() {
  gamepadMenuState.heldDirection = 0;
  gamepadMenuState.confirmHeld = false;
  gamepadMenuState.backHeld = false;
  gamepadMenuState.startHeld = false;
  gamepadMenuState.attackHeld = false;
}

function handleGamepadPauseAndMenuInput(now) {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return;
  const gamepads = navigator.getGamepads();
  const pad = Array.from(gamepads || []).find((candidate) => candidate && candidate.connected);
  if (!pad) {
    resetGamepadHeldStates();
    return;
  }
  input.setInputMethod("gamepad");

  const buttons = pad.buttons || [];
  const axisY = Array.isArray(pad.axes) && pad.axes.length > 1 ? pad.axes[1] : 0;
  const upPressed = Boolean(buttons[12]?.pressed) || axisY < -0.58;
  const downPressed = Boolean(buttons[13]?.pressed) || axisY > 0.58;
  const direction = upPressed ? -1 : downPressed ? 1 : 0;

  const confirmPressed = Boolean(buttons[0]?.pressed); // A
  const backPressed = Boolean(buttons[1]?.pressed); // B
  const attackPressed = Boolean(buttons[2]?.pressed); // X
  const startPressed = Boolean(buttons[9]?.pressed); // Start

  if (gameState === GAME_STATES.TITLE_SCREEN) {
    if (direction !== 0 && (direction !== gamepadMenuState.heldDirection || now >= gamepadMenuState.nextMoveAt)) {
      moveTitleSelection(direction);
      gamepadMenuState.heldDirection = direction;
      gamepadMenuState.nextMoveAt = now + 170;
    } else if (direction === 0) {
      gamepadMenuState.heldDirection = 0;
    }

    if ((confirmPressed || startPressed) && !gamepadMenuState.confirmHeld) {
      confirmTitleSelection();
    }

    if (backPressed && !gamepadMenuState.backHeld) {
      titleState.showHowTo = false;
      musicManager.playSfx("menuConfirm");
    }

    gamepadMenuState.confirmHeld = confirmPressed || startPressed;
    gamepadMenuState.backHeld = backPressed;
    gamepadMenuState.startHeld = startPressed;
    gamepadMenuState.attackHeld = attackPressed;
    return;
  }

  if (gameState === GAME_STATES.PAUSE_MENU) {
    if (direction !== 0 && (direction !== gamepadMenuState.heldDirection || now >= gamepadMenuState.nextMoveAt)) {
      movePauseMenuSelection(direction);
      gamepadMenuState.heldDirection = direction;
      gamepadMenuState.nextMoveAt = now + 145;
    } else if (direction === 0) {
      gamepadMenuState.heldDirection = 0;
    }

    if (confirmPressed && !gamepadMenuState.confirmHeld) {
      selectPauseMenuOption();
    }

    if ((backPressed && !gamepadMenuState.backHeld) || (startPressed && !gamepadMenuState.startHeld)) {
      resumeFromPauseMenu();
    }

    gamepadMenuState.confirmHeld = confirmPressed;
    gamepadMenuState.backHeld = backPressed;
    gamepadMenuState.startHeld = startPressed;
    gamepadMenuState.attackHeld = attackPressed;
    return;
  }

  gamepadMenuState.heldDirection = 0;

  if (gameState === GAME_STATES.SETTINGS) {
    if (direction !== 0 && (direction !== gamepadMenuState.heldDirection || now >= gamepadMenuState.nextMoveAt)) {
      moveSettingsSelection(direction);
      gamepadMenuState.heldDirection = direction;
      gamepadMenuState.nextMoveAt = now + 145;
    } else if (direction === 0) {
      gamepadMenuState.heldDirection = 0;
    }

    if (confirmPressed && !gamepadMenuState.confirmHeld) {
      activateSettingsItem();
    }
    if ((backPressed && !gamepadMenuState.backHeld) || (startPressed && !gamepadMenuState.startHeld)) {
      if (settingsUiState.awaitingRebindAction) {
        settingsUiState.awaitingRebindAction = null;
        setSettingsStatus("Rebind cancelled.", 1200);
        musicManager.playSfx("menuConfirm");
      } else {
        returnToPauseMenu();
      }
    }
  } else if (gameState === GAME_STATES.INVENTORY || gameState === GAME_STATES.ATTRIBUTES) {
    if (
      (confirmPressed && !gamepadMenuState.confirmHeld) ||
      (backPressed && !gamepadMenuState.backHeld) ||
      (startPressed && !gamepadMenuState.startHeld)
    ) {
      returnToPauseMenu();
    }
  } else if (isFreeExploreState(gameState)) {
    if (startPressed && !gamepadMenuState.startHeld) {
      openPauseMenu();
    }
    if (attackPressed && !gamepadMenuState.attackHeld && canRunCombatSystems()) {
      input.triggerAttackPressed();
    }
  }

  gamepadMenuState.confirmHeld = confirmPressed;
  gamepadMenuState.backHeld = backPressed;
  gamepadMenuState.startHeld = startPressed;
  gamepadMenuState.attackHeld = attackPressed;
}

addEventListener("keydown", (e) => {
  if (!choiceState.active) return;
  const key = normalizeInputKey(e.key);

  if (!e.repeat && (key === "arrowup" || key === "arrowdown" || key === "w" || key === "s")) {
    const direction = (key === "arrowup" || key === "w") ? -1 : 1;
    const total = choiceState.options.length;
    choiceState.selected = (choiceState.selected + direction + total) % total;
  }

  if (input.matchesActionKey("interact", key) && !e.repeat) {
    confirmChoice();
    input.clearInteractPressed();
  }
});

addEventListener("keydown", (e) => {
  syncPointerLockWithState({ fromUserGesture: true });
  if (choiceState.active) return;
  const key = normalizeInputKey(e.key);

  if (gameState === GAME_STATES.SETTINGS && settingsUiState.awaitingRebindAction && !e.repeat) {
    if (key === "escape") {
      settingsUiState.awaitingRebindAction = null;
      setSettingsStatus("Rebind cancelled.", 1200);
      musicManager.playSfx("menuConfirm");
      e.preventDefault();
      return;
    }

    const result = input.setPrimaryBinding(settingsUiState.awaitingRebindAction, key);
    if (result.ok) {
      persistUserSettings();
      const bindingName = InputManager.toDisplayKeyName(input.getPrimaryBinding(settingsUiState.awaitingRebindAction));
      setSettingsStatus(`Bound to ${bindingName}.`, 1300);
      musicManager.playSfx("menuConfirm");
    } else if (result.reason === "primary-conflict") {
      musicManager.playSfx("uiError");
      setSettingsStatus("Key already used by another action.", 1700);
    } else {
      musicManager.playSfx("uiError");
      setSettingsStatus("Invalid key.", 1700);
    }
    settingsUiState.awaitingRebindAction = null;
    e.preventDefault();
    return;
  }

  if (gameState === GAME_STATES.TITLE_SCREEN) {
    if (!e.repeat && (key === "arrowup" || key === "w")) {
      moveTitleSelection(-1);
      e.preventDefault();
      return;
    }
    if (!e.repeat && (key === "arrowdown" || key === "s")) {
      moveTitleSelection(1);
      e.preventDefault();
      return;
    }
    if (!e.repeat && (key === "space" || key === "enter")) {
      confirmTitleSelection();
      e.preventDefault();
      return;
    }
    if (!e.repeat && key === "escape") {
      titleState.showHowTo = false;
      musicManager.playSfx("menuConfirm");
      e.preventDefault();
      return;
    }
    return;
  }

  if (gameState === GAME_STATES.PAUSE_MENU) {
    e.preventDefault();
    if (!e.repeat && (key === "arrowup" || key === "arrowdown" || key === "w" || key === "s")) {
      const direction = (key === "arrowup" || key === "w") ? -1 : 1;
      movePauseMenuSelection(direction);
    }
    if ((key === "enter" || key === "escape" || isPauseKey(key)) && !e.repeat) {
      resumeFromPauseMenu();
      return;
    }
    if (key === "space" && !e.repeat) {
      selectPauseMenuOption();
    }
    return;
  }

  if (gameState === GAME_STATES.SETTINGS) {
    if (!e.repeat && (key === "arrowup" || key === "w")) {
      moveSettingsSelection(-1);
      e.preventDefault();
    } else if (!e.repeat && (key === "arrowdown" || key === "s")) {
      moveSettingsSelection(1);
      e.preventDefault();
    } else if (!e.repeat && (key === "space" || key === "enter")) {
      activateSettingsItem();
      e.preventDefault();
    } else if ((key === "escape" || isPauseKey(key)) && !e.repeat) {
      returnToPauseMenu();
      e.preventDefault();
    }
    return;
  }

  if (gameState === GAME_STATES.INVENTORY || gameState === GAME_STATES.ATTRIBUTES) {
    if ((
      key === "enter" ||
      key === "escape" ||
      isPauseKey(key)
    ) && !e.repeat) {
      returnToPauseMenu();
      e.preventDefault();
    }
    return;
  }

  if ((key === "enter" || key === "escape" || isPauseKey(key)) && !e.repeat && isFreeExploreState(gameState)) {
    openPauseMenu();
  }
});

function drawTile(type, x, y, tileX, tileY) {
  const getTileAt = (tx, ty) => {
    if (ty < 0 || ty >= currentMapH || tx < 0 || tx >= currentMapW) return null;
    const row = currentMap[ty];
    return row ? row[tx] : null;
  };

  // Special case: dojo upstairs trapdoor only appears after accepting training.
  let actualType = type;
  if (type === TILE_TYPES.DOOR && shouldHideHanamiDojoUpstairsDoor(tileX, tileY)) {
    actualType = TILE_TYPES.INTERIOR_FLOOR;
  }

  drawTileSystem(
    ctx,
    currentTownId,
    currentAreaId,
    gameState,
    doorSequence,
    actualType,
    x,
    y,
    tileX,
    tileY,
    (townId, areaId, tx, ty) => worldService.getBuilding(townId, areaId, tx, ty),
    getTileAt
  );
}

function computeRenderCamera(now) {
  const renderCam = {
    x: cam.x,
    y: cam.y
  };

  if (!isFreeExploreState(gameState)) return renderCam;

  const mood = worldService.getAreaMoodPreset(currentTownId, currentAreaId);
  const swayStrength = mood === "goldenDawn" ? 0.85 : mood === "amberLounge" ? 0.45 : 0.32;
  renderCam.x += Math.sin(now * 0.00037) * swayStrength;
  renderCam.y += Math.cos(now * 0.00029) * swayStrength * 0.85;

  if (userSettings.screenShake && now < combatFeedback.shakeUntil) {
    const t = 1 - Math.max(0, (combatFeedback.shakeUntil - now) / 220);
    const amplitude = combatFeedback.shakeMagnitude * (1 - t);
    renderCam.x += (Math.random() * 2 - 1) * amplitude;
    renderCam.y += (Math.random() * 2 - 1) * amplitude;
  } else if (now >= combatFeedback.shakeUntil) {
    combatFeedback.shakeMagnitude = 0;
  }

  return renderCam;
}

function render() {
  const now = performance.now();
  const renderCam = computeRenderCamera(now);
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
    getHandstandSprite: () => assets.getSprite("protagonist_handstand"),
    getItemSprite: (name) => assets.getSprite(name),
    drawCustomOverlays: ({ ctx: frameCtx, canvas: frameCanvas, colors: frameColors, ui: frameUi, state: frameState }) => {
      featureCoordinator.renderOverlays({
        ctx: frameCtx,
        canvas: frameCanvas,
        colors: frameColors,
        ui: frameUi,
        state: frameState
      });
    },
    state: {
      currentMap,
      currentMapW,
      currentMapH,
      getBuildingAtWorldTile: (tx, ty) => worldService.getBuilding(currentTownId, currentAreaId, tx, ty),
      moodPreset: worldService.getAreaMoodPreset(currentTownId, currentAreaId),
      currentAreaId,
      currentAreaKind: worldService.getAreaKind(currentTownId, currentAreaId),
      gameState,
      titleState,
      doorSequence,
      playerDefeatSequence,
      player,
      npcs,
      enemies,
      gameFlags,
      cam: renderCam,
      inputPromptMode: input.getInputMethod(),
      keyBindings: input.getBindings(),
      settingsUiState,
      settingsItems: SETTINGS_ITEMS,
      userSettings,
      vfxEffects: vfxSystem.effects,
      trainingPopup,
      playerStats,
      playerInventory,
      itemAlert,
      inventoryHint,
      pauseMenuState,
      mouseUiState
    },
    dialogue
  });
}

if (gameState === GAME_STATES.TITLE_SCREEN) {
  musicManager.playMusicForArea(TITLE_SCREEN_MUSIC_KEY);
} else {
  gameController.syncMusicForCurrentArea();
}

function loop() {
  const now = performance.now();
  syncPointerLockWithState();
  handleGamepadPauseAndMenuInput(now);
  if (
    settingsUiState.statusText &&
    Number.isFinite(settingsUiState.statusUntil) &&
    now >= settingsUiState.statusUntil
  ) {
    settingsUiState.statusText = "";
  }

  const hitstopActive = now < combatFeedback.hitstopUntil;

  if (gameState === GAME_STATES.TITLE_SCREEN) {
    updateTitleScreen(now);
  } else {
    updatePlayerDefeatSequence(now);
    if (!hitstopActive) {
      gameController.update();
      prepareHanamiChallengeEnemies();

      enemyAiSystem.update({
        now,
        gameState,
        isDialogueActive: isDialogueActive(),
        choiceActive: choiceState.active,
        enemies,
        player,
        currentAreaId,
        currentMap,
        currentMapW,
        currentMapH,
        collidesAt: (...args) => collisionService.collides(...args)
      });

      combatSystem.update({
        now,
        gameState,
        isDialogueActive: isDialogueActive(),
        choiceActive: choiceState.active,
        attackPressed: input.getAttackPressed(),
        requestedAttackId: player.requestedAttackId || player.equippedAttackId || null,
        player,
        enemies,
        currentAreaId
      });

      updateFountainHealing(now);
    }
    input.clearAttackPressed();
  }

  if (!hitstopActive) {
    vfxSystem.update(now);
  }
  render();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
