import { AREA_KINDS, GAME_STATES } from "../core/constants.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

export function createBarMinigameSystem({
  state,
  getCurrentAreaKind,
  setGameState,
  showDialogue
}) {
  function resetState() {
    state.active = false;
    state.round = 1;
    state.totalRounds = 5;
    state.requiredWins = 3;
    state.wins = 0;
    state.cursor = 50;
    state.cursorDir = 1;
    state.cursorSpeed = 85;
    state.targetCenter = 50;
    state.targetHalfWidth = 8;
    state.lockUntil = 0;
    state.feedbackText = "";
    state.hostName = "";
    state.winDialogue = "";
    state.loseDialogue = "";
    state.lastUpdateAt = 0;
  }

  function setupRound() {
    state.targetCenter = randomInRange(26, 74);
    state.targetHalfWidth = clamp(10 - Math.floor((state.round - 1) / 2), 6, 10);
    state.cursor = randomInRange(8, 92);
    state.cursorDir = Math.random() < 0.5 ? -1 : 1;
    state.cursorSpeed = 90 + (state.round - 1) * 10;
    state.feedbackText = `Round ${state.round}: Stop the pour in the gold zone.`;
    state.lockUntil = 0;
    state.lastUpdateAt = performance.now();
  }

  function finish() {
    const won = state.wins >= state.requiredWins;
    const areaKind = getCurrentAreaKind();
    setGameState(areaKind === AREA_KINDS.OVERWORLD ? GAME_STATES.OVERWORLD : GAME_STATES.INTERIOR);

    const hostName = state.hostName || "";
    const dialogue = won
      ? state.winDialogue || "Perfect pour. You're welcome behind this bar anytime."
      : state.loseDialogue || "Close. Keep practicing your control and rhythm.";

    resetState();
    showDialogue(hostName, dialogue);
  }

  function canStillWinAfterCurrentRound() {
    const roundsRemaining = state.totalRounds - state.round;
    return state.wins + roundsRemaining >= state.requiredWins;
  }

  function start({
    hostName = "Bartender",
    winDialogue = "",
    loseDialogue = ""
  } = {}) {
    resetState();
    state.active = true;
    state.hostName = hostName;
    state.winDialogue = winDialogue;
    state.loseDialogue = loseDialogue;
    setGameState(GAME_STATES.BAR_MINIGAME);
    setupRound();
  }

  function handleInteract() {
    if (!state.active) return;
    const now = performance.now();
    if (state.lockUntil > now) return;

    const distance = Math.abs(state.cursor - state.targetCenter);
    const success = distance <= state.targetHalfWidth;
    if (success) {
      state.wins += 1;
      state.feedbackText = "Clean pour!";
    } else {
      state.feedbackText = "Spill! Try to time the meter.";
    }

    const roundWonGame = state.wins >= state.requiredWins;
    const roundLostGame = !canStillWinAfterCurrentRound();
    const isLastRound = state.round >= state.totalRounds;

    state.lockUntil = now + 650;
    if (roundWonGame || roundLostGame || isLastRound) {
      state.round = state.totalRounds;
      return;
    }

    state.round += 1;
  }

  function update() {
    if (!state.active) return;

    const now = performance.now();
    const deltaSec = Math.max(0, (now - state.lastUpdateAt) / 1000);
    state.lastUpdateAt = now;

    if (state.lockUntil > 0) {
      if (now < state.lockUntil) return;

      state.lockUntil = 0;
      const won = state.wins >= state.requiredWins;
      const impossibleToWin = !canStillWinAfterCurrentRound();
      const outOfRounds = state.round >= state.totalRounds;
      if (won || impossibleToWin || outOfRounds) {
        finish();
        return;
      }
      setupRound();
      return;
    }

    const drift = Math.sin(now * 0.005 + state.round) * 7;
    state.cursor += (state.cursorDir * state.cursorSpeed + drift) * deltaSec;

    if (state.cursor <= 0) {
      state.cursor = 0;
      state.cursorDir = 1;
    } else if (state.cursor >= 100) {
      state.cursor = 100;
      state.cursorDir = -1;
    }
  }

  return {
    start,
    handleInteract,
    update
  };
}
