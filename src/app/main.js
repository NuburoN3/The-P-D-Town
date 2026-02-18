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
    if (interactionSystem) {
      setInventoryOpenedFromPauseMenu(false);
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
  marker: null
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
const HANAMI_DOJO_EXIT_Y = 8 * TILE;
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
  lastUpdateAt: 0
};
const doorAccessNoticeState = {
  active: false,
  text: "",
  townId: "",
  areaId: "",
  until: 0
};

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
    normalizedSlots.push({
      slot: i + 1,
      id: source.id || null,
      name: String(source.name || ""),
      manaCost: Number.isFinite(source.manaCost) ? Math.max(0, source.manaCost) : 0,
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

  const manaCost = Number.isFinite(slot.manaCost) ? Math.max(0, slot.manaCost) : 0;
  if (player.mana < manaCost) {
    setSkillHudFeedback(slotIndex, "noMana");
    return false;
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
  playerStats.combatXPNeeded = 6;
}
if (!Number.isFinite(playerStats.combatLevelFxStartedAt) || playerStats.combatLevelFxStartedAt < 0) {
  playerStats.combatLevelFxStartedAt = 0;
}
if (!Number.isFinite(playerStats.combatLevelFxLevelsGained) || playerStats.combatLevelFxLevelsGained < 0) {
  playerStats.combatLevelFxLevelsGained = 0;
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

  if (gameFlags.acceptedTraining && !gameFlags.completedTraining) {
    const kills = Number.isFinite(tp.challengeKills) ? tp.challengeKills : 0;
    const target = Number.isFinite(tp.challengeTarget) ? tp.challengeTarget : 3;
    return {
      id: "dojo-upstairs-challenge",
      text: `Objective: Defeat upstairs opponents (${kills}/${target}).`
    };
  }

  if (gameFlags.completedTraining && !tp.rumorQuestOffered) {
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
      text: `Objective: Defeat Bogland stalkers (${bogKills}/${bogTarget}).`
    };
  }

  if (tp.bogQuestCompleted && !tp.bogQuestReported) {
    return {
      id: "bogland-report-hanami",
      text: "Objective: Report to Mr. Hanami in Bogland."
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
    "bogland-cleansing": [
      { townId: "hanamiTown", areaId: "bogland", tileX: 28, tileY: 24, label: "Corrupted bog zone" }
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
  if (objectiveState.id === next.id && objectiveState.text === next.text && markerUnchanged) return;
  objectiveState.id = next.id;
  objectiveState.text = next.text;
  objectiveState.updatedAt = now;
  objectiveState.marker = nextMarker;
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
  const xpGained = enemy?.countsForChallenge ? 3 : 2;
  let levelsGained = 0;

  playerStats.combatXP += xpGained;
  while (playerStats.combatXP >= playerStats.combatXPNeeded) {
    playerStats.combatXP -= playerStats.combatXPNeeded;
    playerStats.combatLevel += 1;
    playerStats.combatXPNeeded = Math.min(60, playerStats.combatXPNeeded + 4);
    levelsGained += 1;
    player.maxHp += 1;
    player.hp = Math.min(player.maxHp, player.hp + 1);
    musicManager.playSfx("levelUp");
  }
  if (levelsGained > 0) {
    playerStats.combatLevelFxStartedAt = now;
    playerStats.combatLevelFxLevelsGained = levelsGained;
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
    hanamiDojoExitState.active = false;
    removeNpcById(HANAMI_NPC_ID, HANAMI_DOJO_AREA_ID);
  }
}

function getDojoHanamiNpc() {
  return npcs.find((npc) => npc && npc.id === HANAMI_NPC_ID && npc.world === HANAMI_DOJO_AREA_ID) || null;
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
    hanamiDojoExitState.active = false;
    return;
  }

  if (!hanamiDojoExitState.active) {
    hanamiDojoExitState.active = true;
    hanamiDojoExitState.lastUpdateAt = now;
    hanamiNpc.canRoam = false;
    hanamiNpc.blocking = false;
  }

  const rawDt = Number.isFinite(hanamiDojoExitState.lastUpdateAt) ? (now - hanamiDojoExitState.lastUpdateAt) : 16.667;
  hanamiDojoExitState.lastUpdateAt = now;
  const dtScale = Math.max(0.2, Math.min(2.2, rawDt / 16.667));

  const arrived = moveNpcToward(hanamiNpc, HANAMI_DOJO_EXIT_X, HANAMI_DOJO_EXIT_Y, dtScale);
  if (!arrived) return;

  removeNpcById(HANAMI_NPC_ID, HANAMI_DOJO_AREA_ID);
  hanamiDojoExitState.active = false;
  gameFlags.hanamiLeftDojo = true;
  gameFlags.hanamiDojoExitPending = false;
}

function updateRuntimeUi(now) {
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
  if (doorAccessNoticeState.active && now >= doorAccessNoticeState.until) {
    doorAccessNoticeState.active = false;
    doorAccessNoticeState.text = "";
  }

  if (saveNoticeState.active && now - saveNoticeState.startedAt >= saveNoticeState.durationMs) {
    saveNoticeState.active = false;
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
  startedAt: performance.now(),
  blackHoldMs: 700,
  fadeInMs: 2200,
  holdMs: 900,
  fadeOutMs: 900
};
gameState = GAME_STATES.INTRO_CUTSCENE;
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
    const totalDurationMs = intro.blackHoldMs + intro.fadeInMs + intro.holdMs + intro.fadeOutMs;
    const elapsed = now - intro.startedAt;
    if (elapsed >= totalDurationMs) {
      gameState = GAME_STATES.TITLE_SCREEN;
      titleState.startedAt = now;
      musicManager.playMusicForArea(TITLE_SCREEN_MUSIC_KEY);
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
      performStartNewGame();
    },
    onContinueGame: () => {
      performLoadGame();
    }
  });
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
    isPlayerMovementLocked: () => patInnIntroState.active,
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
      onStartGame: performStartNewGame,
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
    canRunCombatSystems
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
  performStartNewGame,
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

