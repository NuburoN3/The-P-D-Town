/**
 * ChallengeSystem manages kill-count training objectives.
 * It currently handles:
 * - Dojo challenge progression
 * - Bogland trial progression
 */
export function createChallengeSystem({ tileSize, vfxSystem }) {
  function resetEnemyToSpawn(enemy, now) {
    enemy.dead = false;
    enemy.hp = enemy.maxHp;
    enemy.x = enemy.spawnX;
    enemy.y = enemy.spawnY;
    enemy.state = "idle";
    enemy.pendingStrike = false;
    enemy.respawnAt = 0;
    enemy.invulnerableUntil = now + 180;
  }

  function normalizeTownProgressForChallenges(tp) {
    if (!tp || typeof tp !== "object") return;
    if (!Number.isFinite(tp.challengeTarget) || tp.challengeTarget < 1) tp.challengeTarget = 3;
    if (!Number.isFinite(tp.challengeKills) || tp.challengeKills < 0) tp.challengeKills = 0;
    if (!Number.isFinite(tp.bogQuestTarget) || tp.bogQuestTarget < 1) tp.bogQuestTarget = 3;
    if (!Number.isFinite(tp.bogQuestKills) || tp.bogQuestKills < 0) tp.bogQuestKills = 0;
    if (typeof tp.bogQuestActive !== "boolean") tp.bogQuestActive = false;
    if (typeof tp.bogQuestCompleted !== "boolean") tp.bogQuestCompleted = false;
    if (typeof tp.membershipAwarded !== "boolean") tp.membershipAwarded = false;
  }

  function handleDojoChallengeDefeat({ gameFlags, player, itemAlert }, tp, enemy, now, outcome) {
    if (!enemy?.countsForChallenge) return;
    if (!gameFlags.acceptedTraining) {
      resetEnemyToSpawn(enemy, now);
      return;
    }
    if (gameFlags.completedTraining || enemy.challengeDefeatedCounted) return;

    enemy.challengeDefeatedCounted = true;
    tp.challengeKills = Math.min(tp.challengeTarget, tp.challengeKills + 1);
    itemAlert.active = true;
    itemAlert.text = `Challenge progress: ${tp.challengeKills}/${tp.challengeTarget}`;
    itemAlert.startedAt = now;
    outcome.challengeProgressText = `${tp.challengeKills}/${tp.challengeTarget}`;

    if (tp.challengeKills >= tp.challengeTarget) {
      gameFlags.completedTraining = true;
      if (!tp.challengeCompleteAnnounced) {
        tp.challengeCompleteAnnounced = true;
        itemAlert.active = true;
        itemAlert.text = "Challenge complete! Return to Mr. Hanami for your next challenge.";
        itemAlert.startedAt = now;
        vfxSystem.spawn("trainingBurst", {
          x: player.x + tileSize / 2,
          y: player.y + tileSize * 0.35,
          size: 48,
          durationMs: 800
        });
        outcome.completedNow = true;
      }
    }
  }

  function handleBogTrialDefeat({ player, itemAlert }, tp, enemy, now, outcome) {
    const enemyId = typeof enemy?.id === "string" ? enemy.id.toLowerCase() : "";
    const enemyName = typeof enemy?.name === "string" ? enemy.name.toLowerCase() : "";
    const enemyWorld = typeof enemy?.world === "string" ? enemy.world : "";
    const isBogOgre = enemyWorld === "bogland" && (enemyId.includes("ogre") || enemyName.includes("ogre"));
    const countsForBogQuest = Boolean(enemy?.countsForBogTrial) || isBogOgre;
    if (!countsForBogQuest) return;
    if (!tp.membershipAwarded || !tp.bogQuestActive || tp.bogQuestCompleted) {
      if (enemy.respawnMode === "townReentry") return;
      resetEnemyToSpawn(enemy, now);
      return;
    }
    if (enemy.bogDefeatedCounted) return;

    enemy.bogDefeatedCounted = true;
    tp.bogQuestKills = Math.min(tp.bogQuestTarget, tp.bogQuestKills + 1);
    outcome.bogProgressText = `${tp.bogQuestKills}/${tp.bogQuestTarget}`;

    itemAlert.active = true;
    itemAlert.text = `Bog trial progress: ${tp.bogQuestKills}/${tp.bogQuestTarget}`;
    itemAlert.startedAt = now;

    if (tp.bogQuestKills >= tp.bogQuestTarget) {
      tp.bogQuestCompleted = true;
      tp.bogQuestActive = true;
      itemAlert.active = true;
      itemAlert.text = "Bog trial complete! Report to Mr. Hanami in Bogland.";
      itemAlert.startedAt = now;
      vfxSystem.spawn("trainingBurst", {
        x: player.x + tileSize / 2,
        y: player.y + tileSize * 0.35,
        size: 54,
        durationMs: 860
      });
      outcome.bogCompletedNow = true;
    }
  }

  function handleEnemyDefeat({ gameFlags, currentTownId, player, itemAlert }, enemy, now) {
    const tp = gameFlags.townProgress?.[currentTownId];
    if (!tp || !enemy) return null;
    normalizeTownProgressForChallenges(tp);

    const outcome = {
      challengeProgressText: "",
      completedNow: false,
      bogProgressText: "",
      bogCompletedNow: false
    };

    handleDojoChallengeDefeat({ gameFlags, player, itemAlert }, tp, enemy, now, outcome);
    handleBogTrialDefeat({ player, itemAlert }, tp, enemy, now, outcome);

    const changed = outcome.challengeProgressText ||
      outcome.completedNow ||
      outcome.bogProgressText ||
      outcome.bogCompletedNow;
    return changed ? outcome : null;
  }

  function prepareEnemies({ gameFlags, currentTownId, enemies }) {
    if (!gameFlags.acceptedTraining || gameFlags.completedTraining) return;
    const tp = gameFlags.townProgress?.[currentTownId];
    if (!tp || tp.challengePrepared) return;

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
      enemy.bogDefeatedCounted = false;
    }

    tp.challengePrepared = true;
  }

  return { handleEnemyDefeat, prepareEnemies };
}
