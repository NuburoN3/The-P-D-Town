/**
 * ChallengeSystem — manages defeat-counting for training challenges.
 *
 * @param {object} deps
 * @param {number} deps.tileSize
 * @param {object} deps.vfxSystem
 */
export function createChallengeSystem({ tileSize, vfxSystem }) {
    /**
     * Called when a challenge-tagged enemy is defeated.
     * @param {object} ctx  – live references to game state
     * @param {object} enemy
     * @param {number} now
     */
    function handleEnemyDefeat({ gameFlags, currentTownId, player, itemAlert }, enemy, now) {
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
        const tp = gameFlags.townProgress?.[currentTownId];
        if (!tp) return;
        tp.challengeKills = Math.min(tp.challengeTarget, tp.challengeKills + 1);

        itemAlert.active = true;
        itemAlert.text = `Challenge progress: ${tp.challengeKills}/${tp.challengeTarget}`;
        itemAlert.startedAt = now;

        if (tp.challengeKills >= tp.challengeTarget) {
            gameFlags.completedTraining = true;
            if (!tp.challengeCompleteAnnounced) {
                tp.challengeCompleteAnnounced = true;
                itemAlert.active = true;
                itemAlert.text = "Challenge complete! Speak to Mr. Hanami.";
                itemAlert.startedAt = now;
                vfxSystem.spawn("trainingBurst", {
                    x: player.x + tileSize / 2,
                    y: player.y + tileSize * 0.35,
                    size: 48,
                    durationMs: 800
                });
            }
        }
    }

    /**
     * Reset challenge enemies when entering a challenge area.
     */
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
        }

        tp.challengePrepared = true;
    }

    return { handleEnemyDefeat, prepareEnemies };
}
