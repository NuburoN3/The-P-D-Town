// ============================================================================
// GAME STATE - Centralized game state management
// ============================================================================

import { TRAINING } from './constants.js';

// Game state variables
export let gameState = "overworld"; // "overworld", "interior", "inventory", "enteringDoor", "transition"
export let previousWorldState = "overworld";

export const gameFlags = {
  acceptedTraining: false,
  completedTraining: false
};

export const playerInventory = {};

export const playerStats = {
  disciplineLevel: 1,
  disciplineXP: 0,
  disciplineXPNeeded: TRAINING.INITIAL_XP_NEEDED
};

export const trainingPopup = {
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

// Dialogue state
export let dialogueName = "";
export let dialogueLines = [];
export let dialogueIndex = 0;
export let dialogueEndAction = null;
export let visibleCharacters = 0;

export const choiceState = {
  active: false,
  selected: 0,
  options: [],
  onConfirm: null
};

// Door sequence
export const doorSequence = {
  active: false,
  tx: 0,
  ty: 0,
  stepDx: 0,
  stepDy: 0,
  stepFrames: 0,
  frame: 0,
  targetAreaType: 'overworld',
  targetX: 0,
  targetY: 0,
  maxFadeRadius: 0,
  fadeRadius: 0,
  transitionPhase: "out"
};

// Update functions
export function setGameState(newState) {
  gameState = newState;
}

export function gotoOverworld() {
  gameState = "overworld";
}

export function gotoInterior() {
  gameState = "interior";
}

export function isDialogueActive() {
  return dialogueLines.length > 0 && dialogueIndex < dialogueLines.length;
}

export function isChoiceActive() {
  return choiceState.active;
}

export const defaultGameState = "overworld";
