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
  bogQuestOffered: false,
  bogQuestActive: false,
  bogQuestKills: 0,
  bogQuestTarget: 3,
  bogQuestCompleted: false,
  bogQuestReported: false
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

  return next;
}

export function normalizeGlobalStoryFlags(gameFlags) {
  if (!gameFlags || typeof gameFlags !== "object") return;
  if (typeof gameFlags.taikoHouseUnlocked !== "boolean") gameFlags.taikoHouseUnlocked = false;
  if (typeof gameFlags.townRumorResolved !== "boolean") gameFlags.townRumorResolved = false;
}
