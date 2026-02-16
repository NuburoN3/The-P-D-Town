import { isFreeExploreState } from "../core/constants.js";
import { clamp } from "../core/mathUtils.js";

// clamp imported from ../core/mathUtils.js

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
  enemy.bogDefeatedCounted = false;
}

function beginEnemyWindup(enemy, now, toPlayerX, toPlayerY, onWindupStarted) {
  const enteringWindup = enemy.state !== "attackWindup";
  enemy.state = "attackWindup";
  enemy.attackStrikeAt = now + enemy.attackWindupMs;
  enemy.lastAttackAt = now;
  updateEnemyDirection(enemy, toPlayerX, toPlayerY);
  if (enteringWindup && typeof onWindupStarted === "function") {
    onWindupStarted({ enemy, now, toPlayerX, toPlayerY });
  }
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
    currentMapH,
    dtScale = 1
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
      beginEnemyWindup(enemy, now, toPlayerX, toPlayerY, onWindupStarted);
      return;
    }

    if (distanceToPlayer <= enemy.aggroRange && distanceToPlayer > enemy.attackRange * 0.7) {
      enemy.state = "chase";
      moveEnemy(
        enemy,
        player.x,
        player.y,
        enemy.speed * dtScale,
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
        clamp(enemy.speed * 0.88, 0.7, 2.2) * dtScale,
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

function createOrbitStrikerBehavior({ tileSize, onWindupStarted }) {
  return function updateOrbitStrikerEnemy({
    now,
    enemy,
    player,
    canFight,
    collidesAt,
    currentMap,
    currentMapW,
    currentMapH,
    dtScale = 1
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
      distanceToPlayer <= enemy.attackRange * 0.95 &&
      now - enemy.lastAttackAt >= enemy.attackCooldownMs
    ) {
      beginEnemyWindup(enemy, now, toPlayerX, toPlayerY, onWindupStarted);
      return;
    }

    if (distanceToPlayer <= enemy.aggroRange) {
      enemy.state = "flank";
      const len = Math.max(0.001, distanceToPlayer);
      const normX = toPlayerX / len;
      const normY = toPlayerY / len;
      const orbitDir = enemy.orbitDir === -1 ? -1 : 1;
      const tangentX = -normY * orbitDir;
      const tangentY = normX * orbitDir;
      const desiredDistance = Math.max(enemy.attackRange * 0.95, tileSize * 1.4);

      const targetX = player.x - normX * desiredDistance + tangentX * tileSize * 1.05;
      const targetY = player.y - normY * desiredDistance + tangentY * tileSize * 1.05;

      moveEnemy(
        enemy,
        targetX,
        targetY,
        clamp(enemy.speed * 1.08, 0.8, 2.8) * dtScale,
        collidesAt,
        currentMap,
        currentMapW,
        currentMapH
      );

      // Flip orbit direction periodically so movement is less predictable.
      if (!Number.isFinite(enemy.nextOrbitFlipAt) || now >= enemy.nextOrbitFlipAt) {
        enemy.orbitDir = orbitDir * -1;
        enemy.nextOrbitFlipAt = now + 850 + Math.random() * 700;
      }
      return;
    }

    const spawnDx = enemy.spawnX - enemy.x;
    const spawnDy = enemy.spawnY - enemy.y;
    if (Math.hypot(spawnDx, spawnDy) > tileSize * 0.35) {
      enemy.state = "return";
      moveEnemy(
        enemy,
        enemy.spawnX,
        enemy.spawnY,
        clamp(enemy.speed * 0.9, 0.7, 2.4) * dtScale,
        collidesAt,
        currentMap,
        currentMapW,
        currentMapH
      );
      return;
    }

    enemy.state = "idle";
  };
}

function createZoneKeeperBehavior({ tileSize, onWindupStarted }) {
  return function updateZoneKeeperEnemy({
    now,
    enemy,
    player,
    canFight,
    collidesAt,
    currentMap,
    currentMapW,
    currentMapH,
    dtScale = 1
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
      beginEnemyWindup(enemy, now, toPlayerX, toPlayerY, onWindupStarted);
      return;
    }

    const preferredMin = Math.max(tileSize * 1.2, enemy.attackRange * 0.58);
    const preferredMax = enemy.attackRange * 1.04;

    if (distanceToPlayer < preferredMin) {
      enemy.state = "retreat";
      const len = Math.max(0.001, distanceToPlayer);
      const retreatTargetX = enemy.x - (toPlayerX / len) * tileSize * 1.7;
      const retreatTargetY = enemy.y - (toPlayerY / len) * tileSize * 1.7;
      moveEnemy(
        enemy,
        retreatTargetX,
        retreatTargetY,
        clamp(enemy.speed * 1.05, 0.75, 2.5) * dtScale,
        collidesAt,
        currentMap,
        currentMapW,
        currentMapH
      );
      return;
    }

    if (distanceToPlayer <= enemy.aggroRange * 1.15 && distanceToPlayer > preferredMax) {
      enemy.state = "zone";
      const len = Math.max(0.001, distanceToPlayer);
      const approachTargetX = player.x - (toPlayerX / len) * preferredMax;
      const approachTargetY = player.y - (toPlayerY / len) * preferredMax;
      moveEnemy(
        enemy,
        approachTargetX,
        approachTargetY,
        clamp(enemy.speed * 0.9, 0.65, 2.2) * dtScale,
        collidesAt,
        currentMap,
        currentMapW,
        currentMapH
      );
      return;
    }

    if (distanceToPlayer <= enemy.aggroRange) {
      enemy.state = "strafe";
      const len = Math.max(0.001, distanceToPlayer);
      const orbitDir = enemy.orbitDir === -1 ? -1 : 1;
      const tangentX = (-toPlayerY / len) * orbitDir;
      const tangentY = (toPlayerX / len) * orbitDir;
      moveEnemy(
        enemy,
        enemy.x + tangentX * tileSize,
        enemy.y + tangentY * tileSize,
        clamp(enemy.speed * 0.82, 0.6, 2.0) * dtScale,
        collidesAt,
        currentMap,
        currentMapW,
        currentMapH
      );
      if (!Number.isFinite(enemy.nextOrbitFlipAt) || now >= enemy.nextOrbitFlipAt) {
        enemy.orbitDir = orbitDir * -1;
        enemy.nextOrbitFlipAt = now + 1000 + Math.random() * 600;
      }
      return;
    }

    const spawnDx = enemy.spawnX - enemy.x;
    const spawnDy = enemy.spawnY - enemy.y;
    if (Math.hypot(spawnDx, spawnDy) > tileSize * 0.35) {
      enemy.state = "return";
      moveEnemy(
        enemy,
        enemy.spawnX,
        enemy.spawnY,
        clamp(enemy.speed * 0.86, 0.65, 2.2) * dtScale,
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
    onEnemyAttackWindupStarted: eventHandlers.onEnemyAttackWindupStarted || (() => { })
  };

  const behaviorRegistry = {
    meleeChaser: createMeleeChaserBehavior({
      tileSize,
      onWindupStarted: handlers.onEnemyAttackWindupStarted
    }),
    orbitStriker: createOrbitStrikerBehavior({
      tileSize,
      onWindupStarted: handlers.onEnemyAttackWindupStarted
    }),
    zoneKeeper: createZoneKeeperBehavior({
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
    collidesAt,
    dtScale = 1
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
        tileSize,
        dtScale
      });
    }
  }

  return {
    update,
    registerBehavior
  };
}
