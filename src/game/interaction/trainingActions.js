import { AREA_KINDS, isFreeExploreState } from "../../core/constants.js";

export function createTryTrainingAction({
  tileSize,
  training,
  gameFlags,
  playerStats,
  trainingPopup,
  player,
  doorSequence,
  worldService,
  trainingContent,
  musicManager,
  getCurrentTownId,
  getCurrentAreaId,
  getCurrentAreaKind,
  getGameState,
  isDialogueActive,
  choiceState,
  showDialogue,
  spawnVisualEffect,
  playerTilePosition,
  getTownProgress
}) {
  return function tryTrainingAction() {
    const gameState = getGameState();
    if (!isFreeExploreState(gameState)) return;
    if (isDialogueActive() || choiceState.active || doorSequence.active) return;
    if (getCurrentAreaKind() === AREA_KINDS.OVERWORLD) return;
    if (!gameFlags.acceptedTraining) return;

    const currentTownId = getCurrentTownId();
    const currentAreaId = getCurrentAreaId();
    const trainingTile = worldService.getTrainingTile(currentTownId, currentAreaId);
    if (!trainingTile) return;

    const tilePos = playerTilePosition();
    const onTrainingTile = tilePos.x === trainingTile.x && tilePos.y === trainingTile.y;
    if (!onTrainingTile) return;

    const tp = getTownProgress();
    const challengeKills = Number.isFinite(tp.challengeKills) ? tp.challengeKills : 0;
    const challengeTarget = Number.isFinite(tp.challengeTarget) ? tp.challengeTarget : 3;
    const dojoChallengeComplete = challengeKills >= challengeTarget;
    if (dojoChallengeComplete) {
      if (!gameFlags.completedTraining) gameFlags.completedTraining = true;
    } else if (gameFlags.completedTraining) {
      gameFlags.completedTraining = false;
    }

    if (gameFlags.acceptedTraining && !dojoChallengeComplete) {
      if (!isDialogueActive()) {
        showDialogue("", "Mr. Hanami's challenge is upstairs. Defeat three opponents.");
      }
      return;
    }

    if (dojoChallengeComplete && !tp.enduranceUnlocked) {
      if (!isDialogueActive()) {
        if (tp.rumorQuestActive && !tp.rumorQuestReported) {
          showDialogue("", "Investigation comes first. Gather witness leads in this order: piazza, chapel, then bar.");
        } else {
          showDialogue("", trainingContent.enduranceLockedPrompt);
        }
      }
      return;
    }

    if (playerStats.disciplineLevel >= 2) {
      if (!isDialogueActive()) {
        showDialogue("", trainingContent.completedPrompt);
      }
      return;
    }

    if (trainingPopup.active) return;

    const startXP = playerStats.disciplineXP;
    const xpEarned = training.XP_PER_SESSION;
    trainingPopup.xpNeededSnapshot = playerStats.disciplineXPNeeded;

    playerStats.disciplineXP += xpEarned;
    trainingPopup.startXP = startXP;
    trainingPopup.targetXP = playerStats.disciplineXP;
    trainingPopup.xpGained = xpEarned;
    trainingPopup.levelUp = false;
    trainingPopup.pendingLevelUpDialogueAt = null;
    trainingPopup.active = true;
    trainingPopup.startedAt = performance.now();

    player.isTraining = true;
    player.handstandAnimTimer = 0;
    player.handstandFrame = 0;
    player.walking = false;
    spawnVisualEffect("trainingBurst", {
      x: player.x + tileSize / 2,
      y: player.y + tileSize * 0.35,
      size: 38
    });

    if (playerStats.disciplineXP >= playerStats.disciplineXPNeeded) {
      trainingPopup.levelUp = true;
      trainingPopup.pendingLevelUpDialogueAt = trainingPopup.startedAt + trainingPopup.animDurationMs;
      playerStats.disciplineLevel += 1;
      if (musicManager && typeof musicManager.playSfx === "function") {
        musicManager.playSfx("levelUp");
      }
      if (!gameFlags.completedTraining && playerStats.disciplineLevel >= 2) {
        gameFlags.completedTraining = true;
      }
      playerStats.disciplineXP = 0;
      playerStats.disciplineXPNeeded += training.XP_INCREMENT;
    }
  };
}
