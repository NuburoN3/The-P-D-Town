import {
  TILE,
  CAMERA_ZOOM,
  SPRITE_FRAME_WIDTH,
  SPRITE_FRAME_HEIGHT,
  SPRITE_FRAMES_PER_ROW,
  COLORS,
  UI,
  TRAINING,
  GAME_STATES,
  TILE_TYPES,
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
const mouseUiState = {
  x: 0,
  y: 0,
  insideCanvas: false
};
let menuStateController = null;
const openPauseMenu = () => {
  if (menuStateController) menuStateController.openPauseMenu();
};
const resumeFromPauseMenu = () => {
  if (menuStateController) menuStateController.resumeFromPauseMenu();
};
const returnToPauseMenu = () => {
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

if (!Number.isFinite(playerStats.combatLevel) || playerStats.combatLevel < 1) {
  playerStats.combatLevel = 1;
}
if (!Number.isFinite(playerStats.combatXP) || playerStats.combatXP < 0) {
  playerStats.combatXP = 0;
}
if (!Number.isFinite(playerStats.combatXPNeeded) || playerStats.combatXPNeeded < 1) {
  playerStats.combatXPNeeded = 6;
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
      id: "report-to-hanami",
      text: "Objective: Return to Mr. Hanami for your next challenge."
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
      text: "Objective: Follow the southern path into Bogland and meet Mr. Hanami."
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

  if (gameFlags.completedTraining && !tp.enduranceUnlocked) {
    return {
      id: "choose-next-route",
      text: "Objective: Speak with Mr. Hanami to begin endurance training or continue the investigation."
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
    "choose-next-route": [
      { townId: "hanamiTown", areaId: "hanamiDojo", tileX: 7, tileY: 4, label: "Mr. Hanami" }
    ],
    "rumor-clue-piazza": [
      { townId: "hanamiTown", areaId: "overworld", tileX: 31, tileY: 16, label: "Mina in the piazza" }
    ],
    "rumor-clue-chapel": [
      { townId: "hanamiTown", areaId: "hanamiChurch", tileX: 6, tileY: 3, label: "Priest Miki" }
    ],
    "rumor-clue-bar": [
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

function grantCombatXpAndCollectSummary(enemy, now) {
  const xpGained = enemy?.countsForChallenge ? 3 : 2;
  let levelsGained = 0;

  playerStats.combatXP += xpGained;
  while (playerStats.combatXP >= playerStats.combatXPNeeded) {
    playerStats.combatXP -= playerStats.combatXPNeeded;
    playerStats.combatLevel += 1;
    playerStats.combatXPNeeded = Math.min(60, playerStats.combatXPNeeded + 4);
    levelsGained += 1;
  }

  const lines = [
    `Combat XP +${xpGained}`,
    `Combat Lv.${playerStats.combatLevel} (${playerStats.combatXP}/${playerStats.combatXPNeeded})`
  ];
  if (levelsGained > 0) {
    lines.push(`Level up! +${levelsGained} combat level`);
  }
  lines.push("Items: none");

  return {
    title: `Defeated ${enemy?.name || "Enemy"}`,
    lines,
    completedLevelUp: levelsGained > 0
  };
}

function updateRuntimeUi(now) {
  syncObjectiveState(now);
  markNearbyDoorsDiscovered();

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
  performAutoSave,
  applyTitlePreviewSnapshot
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
    uiMotionState.minimapRevealAt = performance.now();
    syncObjectiveState(performance.now());
  }
});

applyTitlePreviewSnapshot();

const { isConditionallyHiddenDoor, getRespawnDestination } = createWorldStateHandlers({
  worldService,
  tileSize: TILE,
  gameFlags,
  getCurrentTownId,
  getCurrentAreaId
});

const gameplayStartState = gameState;
const titleScreenSystem = createTitleScreenSystem({ tileSize: TILE, cameraZoom: CAMERA_ZOOM, musicManager, canvas });
// Use system state for rendering access
const titleState = titleScreenSystem.state;
gameState = GAME_STATES.TITLE_SCREEN;

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
      const challengeOutcome = handleChallengeEnemyDefeat(enemy, now);
      const reward = grantCombatXpAndCollectSummary(enemy, now);
      if (challengeOutcome?.challengeProgressText) {
        reward.lines.push(`Challenge: ${challengeOutcome.challengeProgressText}`);
      }
      if (challengeOutcome?.bogProgressText) {
        reward.lines.push(`Bog trial: ${challengeOutcome.bogProgressText}`);
      }
      if (challengeOutcome?.completedNow) {
        reward.lines.push("Objective updated: return to Mr. Hanami.");
        performAutoSave("Challenge complete");
      }
      if (challengeOutcome?.bogCompletedNow) {
        reward.lines.push("Objective updated: report to Mr. Hanami in Bogland.");
        performAutoSave("Bog trial complete");
      }
      queueCombatReward(reward);
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
  if (gameState === GAME_STATES.PAUSE_MENU) {
    pauseMenuSystem.handleMouseMove(mouseX, mouseY);
    return;
  }
  if (gameState === GAME_STATES.TITLE_SCREEN) {
    titleScreenSystem.handleMouseMove(mouseX, mouseY);
  }
}

function handlePauseMenuLeftClick(mouseX, mouseY) {
  if (gameState !== GAME_STATES.PAUSE_MENU) return false;

  return pauseMenuSystem.handleClick(mouseX, mouseY, {
    onResume: resumeFromPauseMenu,
    onSave: performSaveGame,
    onLoad: performLoadGame,
    onQuit: () => {
      location.reload();
    }
  });
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
        performAutoSave("Area transition");
        uiMotionState.minimapRevealAt = performance.now();
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
  returnToPauseMenu,
  openPauseMenu,
  isFreeExploreState,
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
  playerDefeatSequence,
  player,
  npcs,
  enemies,
  gameFlags,
  input,
  settingsUiState,
  settingsItems: SETTINGS_ITEMS,
  trainingPopup,
  playerStats,
  playerInventory,
  objectiveState,
  uiMotionState,
  minimapDiscoveryState,
  itemAlert,
  inventoryHint,
  saveNoticeState,
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
  isConditionallyHiddenDoor
});

if (gameState === GAME_STATES.TITLE_SCREEN) {
  musicManager.playMusicForArea(TITLE_SCREEN_MUSIC_KEY);
} else {
  gameController.syncMusicForCurrentArea();
}

const { startLoop } = createGameLoop({
  gameStates: GAME_STATES,
  getGameState,
  syncPointerLockWithState,
  inputController,
  pauseMenuSystem,
  combatFeedback,
  updateTitleScreen,
  updatePlayerDefeatSequence,
  gameController,
  prepareChallengeEnemies,
  enemyAiSystem,
  isDialogueActive,
  choiceState,
  enemies,
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

