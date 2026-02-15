import { isFreeExploreState } from "../core/constants.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function updateEnemyDirection(enemy, dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) {
    enemy.dir = dx < 0 ? "left" : "right";
  } else if (Math.abs(dy) > 0.001) {
    enemy.dir = dy < 0 ? "up" : "down";
  }
}

function moveEnemy(enemy, targetX, targetY, speed, collidesAt, currentMap, currentMapW, currentMapH) {
  const dx = targetX - enemy.x;
  const dy = targetY - enemy.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return;

  const stepX = (dx / len) * speed;
  const stepY = (dy / len) * speed;
  updateEnemyDirection(enemy, stepX, stepY);

  const nx = enemy.x + stepX;
  const ny = enemy.y + stepY;

  if (!collidesAt(nx, enemy.y, currentMap, currentMapW, currentMapH)) {
    enemy.x = nx;
  }
  if (!collidesAt(enemy.x, ny, currentMap, currentMapW, currentMapH)) {
    enemy.y = ny;
  }
}

function resetEnemy(enemy) {
  enemy.dead = false;
  enemy.hp = enemy.maxHp;
  enemy.x = enemy.spawnX;
  enemy.y = enemy.spawnY;
  enemy.state = "idle";
  enemy.pendingStrike = false;
  enemy.invulnerableUntil = 0;
  enemy.hitStunUntil = 0;
  enemy.attackStrikeAt = 0;
  enemy.recoverUntil = 0;
  enemy.challengeDefeatedCounted = false;
}

function createMeleeChaserBehavior({ tileSize, onWindupStarted }) {
  return function updateMeleeChaserEnemy({
    now,
    enemy,
    player,
    canFight,
    collidesAt,
    currentMap,
    currentMapW,
    currentMapH
  }) {
    if (!canFight) {
      if (enemy.state !== "idle") enemy.state = "idle";
      return;
    }

    const playerCenterX = player.x + tileSize / 2;
    const playerCenterY = player.y + tileSize / 2;
    const enemyCenterX = enemy.x + enemy.width / 2;
    const enemyCenterY = enemy.y + enemy.height / 2;
    const toPlayerX = playerCenterX - enemyCenterX;
    const toPlayerY = playerCenterY - enemyCenterY;
    const distanceToPlayer = Math.hypot(toPlayerX, toPlayerY);

    if (
      distanceToPlayer <= enemy.attackRange &&
      now - enemy.lastAttackAt >= enemy.attackCooldownMs
    ) {
      const enteringWindup = enemy.state !== "attackWindup";
      enemy.state = "attackWindup";
      enemy.attackStrikeAt = now + enemy.attackWindupMs;
      enemy.lastAttackAt = now;
      updateEnemyDirection(enemy, toPlayerX, toPlayerY);
      if (enteringWindup && typeof onWindupStarted === "function") {
        onWindupStarted({ enemy, now, toPlayerX, toPlayerY });
      }
      return;
    }

    if (distanceToPlayer <= enemy.aggroRange && distanceToPlayer > enemy.attackRange * 0.7) {
      enemy.state = "chase";
      moveEnemy(
        enemy,
        player.x,
        player.y,
        enemy.speed,
        collidesAt,
        currentMap,
        currentMapW,
        currentMapH
      );
      return;
    }

    const spawnDx = enemy.spawnX - enemy.x;
    const spawnDy = enemy.spawnY - enemy.y;
    const distanceToSpawn = Math.hypot(spawnDx, spawnDy);
    if (distanceToSpawn > tileSize * 0.35) {
      enemy.state = "return";
      moveEnemy(
        enemy,
        enemy.spawnX,
        enemy.spawnY,
        clamp(enemy.speed * 0.88, 0.7, 2.2),
        collidesAt,
        currentMap,
        currentMapW,
        currentMapH
      );
    } else {
      enemy.state = "idle";
    }
  };
}

export function createEnemyAISystem({
  tileSize,
  behaviors = {},
  eventHandlers = {}
}) {
  const handlers = {
    onEnemyAttackWindupStarted: eventHandlers.onEnemyAttackWindupStarted || (() => {})
  };

  const behaviorRegistry = {
    meleeChaser: createMeleeChaserBehavior({
      tileSize,
      onWindupStarted: handlers.onEnemyAttackWindupStarted
    }),
    ...behaviors
  };

  function registerBehavior(behaviorType, behaviorFn) {
    if (!behaviorType || typeof behaviorFn !== "function") return false;
    behaviorRegistry[behaviorType] = behaviorFn;
    return true;
  }

  function updateEnemyLifecycle(enemy, now) {
    if (enemy.dead) {
      if (enemy.respawnEnabled === false) {
        return false;
      }
      if (now >= enemy.respawnAt) {
        resetEnemy(enemy);
      }
      return false;
    }

    if (enemy.hitStunUntil > now) {
      enemy.state = "hitStun";
      return false;
    }

    if (enemy.state === "attackWindup") {
      if (now >= enemy.attackStrikeAt) {
        enemy.pendingStrike = true;
        enemy.state = "recover";
        enemy.recoverUntil = now + enemy.attackRecoveryMs;
      }
      return false;
    }

    if (enemy.state === "recover") {
      if (now >= enemy.recoverUntil) {
        enemy.state = "idle";
        return true;
      }
      return false;
    }

    return true;
  }

  function update({
    now = performance.now(),
    gameState,
    isDialogueActive = false,
    choiceActive = false,
    enemies,
    player,
    currentAreaId,
    currentMap,
    currentMapW,
    currentMapH,
    collidesAt
  }) {
    if (!Array.isArray(enemies) || !player) return;

    const canFight =
      isFreeExploreState(gameState) &&
      !isDialogueActive &&
      !choiceActive;

    for (const enemy of enemies) {
      if (!enemy || enemy.world !== currentAreaId) continue;
      if (!updateEnemyLifecycle(enemy, now)) continue;

      const behaviorType = enemy.behaviorType || "meleeChaser";
      const behaviorFn = behaviorRegistry[behaviorType] || behaviorRegistry.meleeChaser;
      if (typeof behaviorFn !== "function") continue;

      behaviorFn({
        now,
        enemy,
        player,
        canFight,
        collidesAt,
        currentMap,
        currentMapW,
        currentMapH,
        tileSize
      });
    }
  }

  return {
    update,
    registerBehavior
  };
}
