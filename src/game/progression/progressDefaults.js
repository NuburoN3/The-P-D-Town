const DEFAULT_TOWN_PROGRESS = Object.freeze({
  enduranceUnlocked: false,
  membershipAwarded: false,
  challengeKills: 0,
  challengeTarget: 3,
  challengeCompleteAnnounced: false,
  challengePrepared: false,
  rumorQuestOffered: false,
  rumorQuestActive: false,
  rumorQuestCompleted: false,
  rumorQuestReported: false,
  rumorCluePiazza: false,
  rumorClueChapel: false,
  rumorClueBar: false,
  obeySkillAwarded: false,
  eliasQuestOffered: false,
  eliasQuestActive: false,
  eliasVenomSacCollected: false,
  eliasVenomSacTurnedIn: false,
  eliasQuestRewardReady: false,
  eliasQuestClaimed: false,
  bogQuestOffered: false,
  bogQuestActive: false,
  bogQuestKills: 0,
  bogQuestTarget: 3,
  bogQuestCompleted: false,
  bogQuestReported: false,
  bogQuestRewardAwarded: false,
  basicTrainingQuestClaimed: false
});

export function createDefaultTownProgress(overrides = {}) {
  return {
    ...DEFAULT_TOWN_PROGRESS,
    ...(overrides && typeof overrides === "object" ? overrides : {})
  };
}

export function normalizeTownProgress(progress = {}) {
  const next = createDefaultTownProgress(progress);
  next.challengeTarget = Number.isFinite(next.challengeTarget)
    ? Math.max(1, Math.round(next.challengeTarget))
    : DEFAULT_TOWN_PROGRESS.challengeTarget;
  next.challengeKills = Number.isFinite(next.challengeKills)
    ? Math.max(0, Math.min(next.challengeTarget, Math.round(next.challengeKills)))
    : 0;

  next.bogQuestTarget = Number.isFinite(next.bogQuestTarget)
    ? Math.max(1, Math.round(next.bogQuestTarget))
    : DEFAULT_TOWN_PROGRESS.bogQuestTarget;
  next.bogQuestKills = Number.isFinite(next.bogQuestKills)
    ? Math.max(0, Math.min(next.bogQuestTarget, Math.round(next.bogQuestKills)))
    : 0;

  const hasAnyEliasQuestState = (
    next.eliasQuestOffered ||
    next.eliasQuestActive ||
    next.eliasVenomSacCollected ||
    next.eliasVenomSacTurnedIn ||
    next.eliasQuestRewardReady ||
    next.eliasQuestClaimed
  );
  if (next.obeySkillAwarded && !hasAnyEliasQuestState) {
    next.eliasQuestOffered = true;
    next.eliasQuestActive = false;
    next.eliasVenomSacCollected = true;
    next.eliasVenomSacTurnedIn = true;
    next.eliasQuestRewardReady = false;
    next.eliasQuestClaimed = true;
  }
  if (next.eliasQuestClaimed) {
    next.eliasQuestOffered = true;
    next.eliasQuestActive = false;
    next.eliasVenomSacCollected = true;
    next.eliasVenomSacTurnedIn = true;
    next.eliasQuestRewardReady = false;
    next.obeySkillAwarded = true;
  } else if (next.eliasQuestRewardReady) {
    next.eliasQuestOffered = true;
    next.eliasQuestActive = false;
    next.eliasVenomSacCollected = true;
    next.eliasVenomSacTurnedIn = true;
  } else if (next.eliasVenomSacTurnedIn) {
    next.eliasQuestOffered = true;
    next.eliasQuestActive = false;
    next.eliasVenomSacCollected = true;
    next.eliasQuestRewardReady = true;
  } else if (next.eliasQuestActive) {
    next.eliasQuestOffered = true;
  }

  return next;
}

export function normalizeGlobalStoryFlags(gameFlags) {
  if (!gameFlags || typeof gameFlags !== "object") return;
  if (typeof gameFlags.basicTrainingStarted !== "boolean") {
    gameFlags.basicTrainingStarted = Boolean(
      gameFlags.patInnIntroSeen ||
      gameFlags.acceptedTraining ||
      gameFlags.completedTraining
    );
  }
  if (typeof gameFlags.hanamiDojoExitPending !== "boolean") gameFlags.hanamiDojoExitPending = false;
  if (typeof gameFlags.hanamiLeftDojo !== "boolean") gameFlags.hanamiLeftDojo = false;
  if (typeof gameFlags.hanamiBoglandExitPending !== "boolean") gameFlags.hanamiBoglandExitPending = false;
  if (typeof gameFlags.hanamiLeftBogland !== "boolean") gameFlags.hanamiLeftBogland = false;
  if (typeof gameFlags.brogIntroSeen !== "boolean") gameFlags.brogIntroSeen = false;
  if (typeof gameFlags.brogDefeated !== "boolean") gameFlags.brogDefeated = false;
  if (typeof gameFlags.taikoHouseUnlocked !== "boolean") gameFlags.taikoHouseUnlocked = false;
  if (typeof gameFlags.townRumorResolved !== "boolean") gameFlags.townRumorResolved = false;
  if (typeof gameFlags.questTrackerHintDismissed !== "boolean") gameFlags.questTrackerHintDismissed = false;
}
