import { isFreeExploreState } from "../core/constants.js";
import { distance } from "../core/mathUtils.js";
import { createDefaultAttackCatalog, resolveAttackProfile } from "./combat/attackCatalog.js";
import {
  PLAYER_ATTACK_FRAME_TIMINGS,
  PLAYER_ATTACK_HIT_FRAME_INDEX,
  resolvePlayerAttackFrameIndex
} from "./combat/playerAttackAnimationTiming.js";

// distance imported from ../core/mathUtils.js

export function createCombatSystem({
  tileSize,
  attackCatalog = null,
  defaultAttackId = "lightSlash",
  basicAttackManaCost = 0,
  eventHandlers = {},
  spawnVisualEffect = () => { },
  onEnemyDefeated = () => { }
}) {
  const catalog = { ...(attackCatalog || createDefaultAttackCatalog(tileSize)) };
  const hitIdsInCurrentSwing = new Set();
  const npcHitIdsInCurrentSwing = new Set();
  let playerAttackHitFrameCuePlayed = false;
  let lastCombatUpdateAt = 0;
  const handlers = {
    onRequestVfx: eventHandlers.onRequestVfx || spawnVisualEffect,
    onEntityDamaged: eventHandlers.onEntityDamaged || (() => { }),
    onEntityDefeated: eventHandlers.onEntityDefeated || onEnemyDefeated,
    onPlayerDamaged: eventHandlers.onPlayerDamaged || (() => { }),
    onPlayerPoisoned: eventHandlers.onPlayerPoisoned || (() => { }),
    onPlayerDefeated: eventHandlers.onPlayerDefeated || null,
    onPlayerAttackStarted: eventHandlers.onPlayerAttackStarted || (() => { }),
    onPlayerAttackActive: eventHandlers.onPlayerAttackActive || (() => { }),
    onPlayerAttackHitFrame: eventHandlers.onPlayerAttackHitFrame || (() => { }),
    onHitConfirmed: eventHandlers.onHitConfirmed || (() => { }),
    onEnemyProjectileSpawn: eventHandlers.onEnemyProjectileSpawn || (() => { }),
    onBrogLeapImpact: eventHandlers.onBrogLeapImpact || (() => { })
  };
  const FACING_DOT_MIN = Math.cos((70 * Math.PI) / 180);

  function directionToVector(dir) {
    switch (String(dir || "").toLowerCase()) {
      case "left":
        return { x: -1, y: 0 };
      case "right":
        return { x: 1, y: 0 };
      case "up":
        return { x: 0, y: -1 };
      case "down":
      default:
        return { x: 0, y: 1 };
    }
  }

  function resolveCardinalDirection(dx, dy, fallbackDir = "down") {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX > absY) return dx < 0 ? "left" : "right";
    if (absY > 0) return dy < 0 ? "up" : "down";
    return fallbackDir;
  }

  function findBestFacingEnemy({ player, enemies, currentAreaId, pressedFacingDir }) {
    if (!player || !Array.isArray(enemies) || enemies.length === 0) return null;
    const playerCenterX = player.x + tileSize / 2;
    const playerCenterY = player.y + tileSize / 2;
    const facing = directionToVector(pressedFacingDir);
    let best = null;

    for (const enemy of enemies) {
      if (!enemy || enemy.dead || enemy.world !== currentAreaId) continue;
      const enemyCenterX = enemy.x + enemy.width / 2;
      const enemyCenterY = enemy.y + enemy.height / 2;
      const toEnemyX = enemyCenterX - playerCenterX;
      const toEnemyY = enemyCenterY - playerCenterY;
      const dist = Math.hypot(toEnemyX, toEnemyY);
      if (dist <= 0.001) continue;

      const normX = toEnemyX / dist;
      const normY = toEnemyY / dist;
      const facingDot = normX * facing.x + normY * facing.y;
      if (facingDot < FACING_DOT_MIN) continue;

      // Prioritize enemies closest to the pressed facing ray, then shortest actual distance.
      const perpendicularDistance = Math.abs(toEnemyX * facing.y - toEnemyY * facing.x);
      if (
        !best ||
        perpendicularDistance < best.perpendicularDistance ||
        (
          perpendicularDistance === best.perpendicularDistance &&
          dist < best.dist
        )
      ) {
        best = {
          enemy,
          dist,
          perpendicularDistance,
          dir: resolveCardinalDirection(toEnemyX, toEnemyY, pressedFacingDir)
        };
      }
    }

    return best;
  }

  function canApplyHitForProfile(player, profile, now) {
    if (!profile?.damageOnlyOnHitCue) return true;
    const hitWindowUntil = Number.isFinite(player?.attackHitWindowUntil) ? player.attackHitWindowUntil : 0;
    return now <= hitWindowUntil;
  }

  function emitPlayerAttackHitCue(player, profile, now, cueDetails = {}) {
    if (playerAttackHitFrameCuePlayed) return;
    playerAttackHitFrameCuePlayed = true;
    if (profile?.damageOnlyOnHitCue) {
      const hitWindowMs = Number.isFinite(profile.hitWindowMs) ? Math.max(1, profile.hitWindowMs) : 80;
      player.attackHitWindowUntil = now + hitWindowMs;
    }
    handlers.onPlayerAttackHitFrame({
      attacker: player,
      now,
      ...cueDetails
    });
  }

  function resolveWeightedDamage(table, fallbackDamage = 0) {
    const safeFallback = Number.isFinite(fallbackDamage) ? Math.max(0, Math.floor(fallbackDamage)) : 0;
    if (!Array.isArray(table) || table.length === 0) return safeFallback;

    let totalWeight = 0;
    const normalized = [];
    for (const entry of table) {
      const value = Number.isFinite(entry?.value) ? Math.max(0, Math.floor(entry.value)) : NaN;
      const weight = Number.isFinite(entry?.weight) ? Math.max(0, entry.weight) : 0;
      if (!Number.isFinite(value) || weight <= 0) continue;
      totalWeight += weight;
      normalized.push({ value, weight });
    }

    if (normalized.length === 0 || totalWeight <= 0) return safeFallback;
    let roll = Math.random() * totalWeight;
    for (const entry of normalized) {
      roll -= entry.weight;
      if (roll <= 0) return entry.value;
    }
    return normalized[normalized.length - 1].value;
  }

  function resolveEntityDamage(entity, fallbackDamage = 0, rollTableKey = "damageRollTable") {
    return resolveWeightedDamage(entity?.[rollTableKey], fallbackDamage);
  }

  function resolveWeaponBonusDamage(playerEquipment) {
    if (!playerEquipment || typeof playerEquipment !== "object") return 0;
    const equippedWeapon = String(playerEquipment.weapon || "");
    if (equippedWeapon !== "Kendo Stick") return 0;
    return resolveWeightedDamage(
      [
        { value: 2, weight: 2 },
        { value: 3, weight: 6 },
        { value: 4, weight: 3 },
        { value: 5, weight: 1 }
      ],
      0
    );
  }

  function registerAttackProfile(attackId, profile) {
    if (!attackId || !profile || typeof profile !== "object") return false;
    catalog[attackId] = {
      ...profile,
      id: attackId
    };
    return true;
  }

  function getAttackProfileForEntity(entity, attackId = null) {
    const resolvedAttackId = attackId || entity.equippedAttackId || defaultAttackId;
    const profile = resolveAttackProfile(catalog, resolvedAttackId, defaultAttackId);
    if (!profile) return null;

    const pickNumber = (preferred, fallback) => {
      if (Number.isFinite(preferred)) return preferred;
      if (Number.isFinite(fallback)) return fallback;
      return undefined;
    };

    // Preserve compatibility with legacy player fields while enabling catalog-driven attacks.
    const merged = {
      ...profile,
      cooldownMs: pickNumber(profile.cooldownMs, entity.attackCooldownMs),
      windupMs: pickNumber(profile.windupMs, entity.attackWindupMs),
      activeMs: pickNumber(profile.activeMs, entity.attackActiveMs),
      recoveryMs: pickNumber(profile.recoveryMs, entity.attackRecoveryMs),
      range: pickNumber(profile.range, entity.attackRange),
      hitRadius: pickNumber(profile.hitRadius, entity.attackHitRadius),
      damage: pickNumber(profile.damage, entity.attackDamage)
    };

    return merged;
  }

  function beginPlayerAttack(player, profile, now) {
    if (!profile) return;
    player.attackState = "windup";
    player.attackStartedAt = now;
    player.attackActiveAt = now + profile.windupMs;
    player.attackActiveUntil = player.attackActiveAt + profile.activeMs;
    player.attackRecoveryUntil = player.attackActiveUntil + profile.recoveryMs;
    player.lastAttackAt = now;
    player.activeAttackId = profile.id;
    player.attackHitWindowUntil = 0;
    playerAttackHitFrameCuePlayed = false;
    hitIdsInCurrentSwing.clear();

    const vfxOrigin = profile.getVfxOrigin
      ? profile.getVfxOrigin(player)
      : { x: player.x + tileSize / 2, y: player.y + tileSize / 2 };
    handlers.onRequestVfx(profile.vfx?.type || "attackSlash", {
      x: vfxOrigin.x,
      y: vfxOrigin.y,
      size: profile.hitRadius + (profile.vfx?.sizeOffset || 8),
      durationMs: profile.vfx?.durationMs || 190
    });
    handlers.onPlayerAttackStarted({
      attacker: player,
      profile,
      now
    });
  }

  function resolveAttackDtScale(now) {
    if (!Number.isFinite(lastCombatUpdateAt) || lastCombatUpdateAt <= 0) {
      lastCombatUpdateAt = now;
      return 1;
    }
    const dt = Math.max(0, now - lastCombatUpdateAt);
    lastCombatUpdateAt = now;
    return Math.max(0.25, Math.min(3.5, dt / 16.667));
  }

  function updatePlayerLockOnMovement({
    now,
    player,
    enemies,
    currentAreaId,
    profile,
    collidesAt = null
  }) {
    if (!player || !Array.isArray(enemies) || !profile?.lockOnDuringAttack) return;
    if (player.attackState === "idle" || player.attackState === "recovery") return;
    const targetId = player.attackLockedTargetId;
    if (!targetId) return;

    const enemy = enemies.find((candidate) => (
      candidate &&
      candidate.id === targetId &&
      !candidate.dead &&
      candidate.world === currentAreaId
    )) || null;
    if (!enemy) {
      player.attackLockedTargetId = null;
      return;
    }

    const playerCenterX = player.x + tileSize / 2;
    const playerCenterY = player.y + tileSize / 2;
    const enemyCenterX = enemy.x + enemy.width / 2;
    const enemyCenterY = enemy.y + enemy.height / 2;
    const toEnemyX = enemyCenterX - playerCenterX;
    const toEnemyY = enemyCenterY - playerCenterY;
    const dist = Math.hypot(toEnemyX, toEnemyY);
    if (dist <= 0.001) return;

    const targetDir = resolveCardinalDirection(
      toEnemyX,
      toEnemyY,
      player.attackLockedDir || player.dir || "down"
    );
    player.attackLockedDir = targetDir;
    player.dir = targetDir;

    const maxLockDistance = Number.isFinite(profile.lockOnMaxDistance)
      ? Math.max(tileSize * 0.75, profile.lockOnMaxDistance)
      : (profile.range + tileSize * 1.1);
    if (dist > maxLockDistance) return;

    const stopDistance = Number.isFinite(profile.lockOnStopDistance)
      ? Math.max(tileSize * 0.3, profile.lockOnStopDistance)
      : Math.max(tileSize * 0.5, profile.range * 0.85);
    const gap = dist - stopDistance;
    if (gap <= 0) return;

    const dtScale = resolveAttackDtScale(now);
    const moveSpeed = Number.isFinite(profile.lockOnMoveSpeed)
      ? Math.max(0.4, profile.lockOnMoveSpeed)
      : 3.2;
    const step = Math.min(gap, moveSpeed * dtScale);
    if (step <= 0.001) return;

    const moveX = (toEnemyX / dist) * step;
    const moveY = (toEnemyY / dist) * step;
    const targetX = player.x + moveX;
    const targetY = player.y + moveY;

    if (typeof collidesAt === "function") {
      if (!collidesAt(targetX, player.y)) {
        player.x = targetX;
      }
      if (!collidesAt(player.x, targetY)) {
        player.y = targetY;
      }
      return;
    }

    player.x = targetX;
    player.y = targetY;
  }

  function updatePlayerAttackState(player, now) {
    if (player.attackState === "windup" && now >= player.attackActiveAt) {
      player.attackState = "active";
      const profile = getAttackProfileForEntity(player, player.activeAttackId);
      if (profile?.hitCueAtActiveStart) {
        emitPlayerAttackHitCue(player, profile, now, {
          frame: 0,
          hitFrame: 0
        });
      }
      handlers.onPlayerAttackActive({
        attacker: player,
        profile,
        now
      });
      return;
    }

    if (player.attackState === "active" && now >= player.attackActiveUntil) {
      player.attackState = "recovery";
      return;
    }

    if (player.attackState === "recovery" && now >= player.attackRecoveryUntil) {
      player.attackState = "idle";
      player.attackLockedDir = null;
      player.attackLockedTargetId = null;
      player.attackHitWindowUntil = 0;
      playerAttackHitFrameCuePlayed = false;
      hitIdsInCurrentSwing.clear();
      npcHitIdsInCurrentSwing.clear();
    }
  }

  function updatePlayerAttackHitFrameCue(player, now) {
    if (playerAttackHitFrameCuePlayed) return;
    if (!player || player.attackState === "idle") return;

    const totalAttackDuration = Math.max(
      1,
      (Number.isFinite(player.attackRecoveryUntil) ? player.attackRecoveryUntil : now)
      - (Number.isFinite(player.attackStartedAt) ? player.attackStartedAt : now)
    );
    const elapsed = Math.max(
      0,
      now - (Number.isFinite(player.attackStartedAt) ? player.attackStartedAt : now)
    );
    const progress = Math.max(0, Math.min(1, elapsed / totalAttackDuration));
    const availableFrames = Number.isFinite(player.attackAnimationFrameCount)
      ? Math.max(1, Math.floor(player.attackAnimationFrameCount))
      : PLAYER_ATTACK_FRAME_TIMINGS.length;
    const frame = resolvePlayerAttackFrameIndex(progress, availableFrames);
    const hitFrame = Math.min(
      Math.max(0, PLAYER_ATTACK_HIT_FRAME_INDEX),
      Math.max(0, availableFrames - 1)
    );
    const maxReachableFrame = resolvePlayerAttackFrameIndex(1, availableFrames);
    const effectiveHitFrame = Math.min(hitFrame, maxReachableFrame);
    if (frame >= effectiveHitFrame) {
      const profile = getAttackProfileForEntity(player, player.activeAttackId);
      emitPlayerAttackHitCue(player, profile, now, {
        frame,
        hitFrame: effectiveHitFrame
      });
    }
  }

  function reactNpcToAttack(npc, now) {
    npc.hitShakeUntil = now + 220;
    npc.hitBubbleUntil = now + 760;
    npc.hitBubbleText = typeof npc.hitReactionText === "string" && npc.hitReactionText.length > 0
      ? npc.hitReactionText
      : "Ow!";
  }

  function hitEnemy(player, enemy, profile, now, playerEquipment = null) {
    const fallbackDamage = Number.isFinite(profile.damage) ? profile.damage : 0;
    const baseDamage = profile?.useProfileDamageOnly
      ? fallbackDamage
      : resolveEntityDamage(player, fallbackDamage, "attackDamageRollTable");
    const bonusDamage = profile?.ignoreWeaponBonus ? 0 : resolveWeaponBonusDamage(playerEquipment);
    const flatProfileBonus = Number.isFinite(profile?.damageBonusFlat) ? profile.damageBonusFlat : 0;
    const damage = Math.max(0, baseDamage + bonusDamage + flatProfileBonus);
    const interruptsEnemy = profile?.interruptsEnemy === true;
    enemy.hp = Math.max(0, enemy.hp - damage);
    enemy.invulnerableUntil = now + 180;
    if (interruptsEnemy) {
      enemy.hitStunUntil = now + 230;
      enemy.state = "hitStun";
      enemy.pendingStrike = false;
    }

    const ex = enemy.x + enemy.width / 2;
    const ey = enemy.y + enemy.height / 2;
    const playerCenterX = player.x + tileSize / 2;
    const playerCenterY = player.y + tileSize / 2;
    const toPlayerX = playerCenterX - ex;
    const toPlayerY = playerCenterY - ey;
    const toPlayerLength = Math.max(0.001, Math.hypot(toPlayerX, toPlayerY));
    const fromPlayerDirX = toPlayerX / toPlayerLength;
    const fromPlayerDirY = toPlayerY / toPlayerLength;
    const damageTextOffset = tileSize * 0.62;
    const damageTextX = ex + fromPlayerDirX * damageTextOffset;
    const damageTextY = ey + fromPlayerDirY * (damageTextOffset * 0.45) - tileSize * 0.22;
    const enemyContactRadius = Math.max(
      tileSize * 0.18,
      Math.min(
        tileSize * 0.42,
        (Number.isFinite(enemy.width) ? enemy.width : tileSize) * 0.36
      )
    );
    const hitSparkX = ex + fromPlayerDirX * enemyContactRadius;
    const hitSparkY = ey + fromPlayerDirY * enemyContactRadius;
    handlers.onRequestVfx("hitSpark", {
      x: hitSparkX,
      y: hitSparkY,
      size: 18,
      durationMs: 240
    });
    handlers.onRequestVfx("damageText", {
      x: damageTextX,
      y: damageTextY,
      text: `${damage}`,
      color: "#ffffff",
      size: 32,
      durationMs: 620,
      variant: "playerAttack"
    });
    handlers.onEntityDamaged({
      source: player,
      target: enemy,
      damage,
      now
    });
    handlers.onHitConfirmed({
      type: "entityDamaged",
      source: player,
      target: enemy,
      damage,
      now
    });

    if (enemy.hp <= 0) {
      enemy.dead = true;
      enemy.state = "dead";
      enemy.pendingStrike = false;
      enemy.respawnAt = now + enemy.respawnDelayMs;
      handlers.onRequestVfx("pickupGlow", {
        x: ex,
        y: ey - 8,
        size: 28,
        durationMs: 520
      });
      handlers.onEntityDefeated(enemy, now);
    }
  }

  function processPlayerHits({ now, player, enemies, currentAreaId, profile, playerEquipment = null }) {
    if (player.attackState !== "active") return;
    if (!profile) return;
    if (!canApplyHitForProfile(player, profile, now)) return;

    const attackCenter = profile.getAttackCenter
      ? profile.getAttackCenter(player)
      : { x: player.x + tileSize / 2, y: player.y + tileSize / 2 };
    const hitRadius = Number.isFinite(profile.hitRadius) ? profile.hitRadius : tileSize * 0.7;
    const brogId = "thebrog";
    const circleIntersectsRect = (cx, cy, radius, rx, ry, rw, rh) => {
      const clampedX = Math.max(rx, Math.min(cx, rx + rw));
      const clampedY = Math.max(ry, Math.min(cy, ry + rh));
      const dx = cx - clampedX;
      const dy = cy - clampedY;
      return (dx * dx + dy * dy) <= (radius * radius);
    };

    for (const enemy of enemies) {
      if (!enemy || enemy.dead || enemy.world !== currentAreaId) continue;
      if (hitIdsInCurrentSwing.has(enemy.id)) continue;
      if (enemy.invulnerableUntil > now) continue;

      const enemyCenterX = enemy.x + enemy.width / 2;
      const enemyCenterY = enemy.y + enemy.height / 2;
      const enemyId = String(enemy.id || "").toLowerCase();
      let shouldHitEnemy = false;
      if (enemyId === brogId) {
        const visualSize = Number.isFinite(enemy.desiredHeightTiles)
          ? Math.max(tileSize, enemy.desiredHeightTiles * tileSize)
          : tileSize * 4.4;
        const spriteX = enemyCenterX - visualSize * 0.5;
        const spriteY = enemyCenterY - visualSize * 0.5;
        const touchAllowance = Math.max(2, tileSize * 0.1);
        shouldHitEnemy = circleIntersectsRect(
          attackCenter.x,
          attackCenter.y,
          hitRadius + touchAllowance,
          spriteX,
          spriteY,
          visualSize,
          visualSize
        );
      } else {
        const d = distance(attackCenter.x, attackCenter.y, enemyCenterX, enemyCenterY);
        shouldHitEnemy = d <= hitRadius + enemy.width * 0.42;
      }
      if (!shouldHitEnemy) continue;

      hitIdsInCurrentSwing.add(enemy.id);
      hitEnemy(player, enemy, profile, now, playerEquipment);
    }
  }

  function processPlayerNpcHits({ now, player, npcs, currentAreaId, profile }) {
    if (player.attackState !== "active") return;
    if (!profile || !Array.isArray(npcs) || npcs.length === 0) return;
    if (!canApplyHitForProfile(player, profile, now)) return;

    const attackCenter = profile.getAttackCenter
      ? profile.getAttackCenter(player)
      : { x: player.x + tileSize / 2, y: player.y + tileSize / 2 };
    const hitRadius = Number.isFinite(profile.hitRadius) ? profile.hitRadius : tileSize * 0.7;

    for (const npc of npcs) {
      if (!npc || npc.world !== currentAreaId) continue;
      if (npc.isPlayerPet) continue;
      if (npcHitIdsInCurrentSwing.has(npc.id)) continue;

      const npcCenterX = npc.x + npc.width / 2;
      const npcCenterY = npc.y + npc.height / 2;
      const d = distance(attackCenter.x, attackCenter.y, npcCenterX, npcCenterY);
      if (d > hitRadius + npc.width * 0.42) continue;

      npcHitIdsInCurrentSwing.add(npc.id);
      reactNpcToAttack(npc, now);
      handlers.onHitConfirmed({
        type: "npcHit",
        source: player,
        target: npc,
        now
      });
    }
  }

  function processEnemyStrikes({ now, player, enemies, npcs, currentAreaId }) {
    const findPetTarget = (enemy) => {
      if (!Array.isArray(npcs) || !enemy) return null;
      let pet = null;
      if (enemy.targetEntityType === "pet" && enemy.targetEntityId) {
        pet = npcs.find((npc) => npc && npc.id === enemy.targetEntityId && npc.isPlayerPet && npc.world === currentAreaId) || null;
      }
      if (!pet) {
        pet = npcs.find((npc) => npc && npc.isPlayerPet && npc.world === currentAreaId) || null;
      }
      if (!pet) return null;
      const maxHp = Number.isFinite(pet.maxHp) ? Math.max(1, pet.maxHp) : 1;
      const hp = Number.isFinite(pet.hp) ? Math.max(0, Math.min(maxHp, pet.hp)) : maxHp;
      if (hp <= 0) return null;
      return pet;
    };

    for (const enemy of enemies) {
      if (!enemy || enemy.dead || enemy.world !== currentAreaId) continue;
      if (!enemy.pendingStrike) continue;

      enemy.pendingStrike = false;
      const strikeAttackType = enemy.pendingAttackType || enemy.attackType || enemy.equippedAttackId || null;
      const enemyProfile = getAttackProfileForEntity(enemy, strikeAttackType);

      const petTarget = findPetTarget(enemy);
      const strikeTarget = enemy.targetEntityType === "pet" && petTarget ? petTarget : player;
      const targetIsPet = strikeTarget !== player;
      const targetCenterX = strikeTarget.x + (targetIsPet ? ((Number.isFinite(strikeTarget.width) ? strikeTarget.width : tileSize) / 2) : (tileSize / 2));
      const targetCenterY = strikeTarget.y + (targetIsPet ? ((Number.isFinite(strikeTarget.height) ? strikeTarget.height : tileSize) / 2) : (tileSize / 2));
      const enemyCenterX = enemy.x + enemy.width / 2;
      const enemyCenterY = enemy.y + enemy.height / 2;
      const strikeCenter = enemyProfile?.getAttackCenter
        ? enemyProfile.getAttackCenter(enemy)
        : { x: enemyCenterX, y: enemyCenterY };
      if (strikeAttackType === "brogLeap") {
        const landingX = Number.isFinite(enemy.brogLeapTargetX)
          ? enemy.brogLeapTargetX
          : (targetCenterX - enemy.width / 2);
        const landingY = Number.isFinite(enemy.brogLeapTargetY)
          ? enemy.brogLeapTargetY
          : (targetCenterY - enemy.height / 2);
        enemy.x = landingX;
        enemy.y = landingY;
        const landingCenterX = enemy.x + enemy.width / 2;
        const landingCenterY = enemy.y + enemy.height / 2;
        const splashRadius = Number.isFinite(enemy?.leapHitRadius)
          ? Math.max(tileSize * 0.5, enemy.leapHitRadius)
          : (Number.isFinite(enemyProfile?.hitRadius) ? enemyProfile.hitRadius : tileSize * 3);
        const leapDamage = Number.isFinite(enemy?.leapDamage)
          ? Math.max(0, enemy.leapDamage)
          : (Number.isFinite(enemyProfile?.damage) ? Math.max(0, enemyProfile.damage) : 10);
        const leapPoisonChance = Number.isFinite(enemy?.leapPoisonChance)
          ? Math.max(0, Math.min(1, enemy.leapPoisonChance))
          : 0;
        const leapPoisonDurationMs = Number.isFinite(enemy?.leapPoisonDurationMs)
          ? Math.max(0, enemy.leapPoisonDurationMs)
          : 0;

        handlers.onRequestVfx("warningRing", {
          x: landingCenterX,
          y: landingCenterY,
          size: splashRadius,
          durationMs: 260
        });
        handlers.onRequestVfx("hitSpark", {
          x: landingCenterX,
          y: landingCenterY,
          size: 30,
          durationMs: 320
        });
        handlers.onBrogLeapImpact({
          source: enemy,
          x: landingCenterX,
          y: landingCenterY,
          radius: splashRadius,
          now
        });

        const playerCenterX = player.x + tileSize / 2;
        const playerCenterY = player.y + tileSize / 2;
        const playerDistance = distance(playerCenterX, playerCenterY, landingCenterX, landingCenterY);
        if (playerDistance <= splashRadius && player.invulnerableUntil <= now) {
          player.hp = Math.max(0, player.hp - leapDamage);
          player.invulnerableUntil = now + player.invulnerableMs;
          handlers.onPlayerDamaged({
            source: enemy,
            target: player,
            damage: leapDamage,
            now
          });
          handlers.onHitConfirmed({
            type: "playerDamaged",
            source: enemy,
            target: player,
            damage: leapDamage,
            now
          });
          if (leapPoisonChance > 0 && leapPoisonDurationMs > 0 && Math.random() < leapPoisonChance) {
            handlers.onPlayerPoisoned({
              source: enemy,
              target: player,
              now,
              durationMs: leapPoisonDurationMs
            });
          }
          handlers.onRequestVfx("damageText", {
            x: playerCenterX + 8,
            y: playerCenterY - 18,
            text: `-${leapDamage}`,
            color: "#ff3b3b",
            size: 32,
            durationMs: 620
          });
          if (player.hp <= 0) {
            if (typeof handlers.onPlayerDefeated === "function") {
              handlers.onPlayerDefeated({ player, source: enemy, now });
            } else {
              player.hp = player.maxHp;
            }
          }
        }

        if (petTarget) {
          const petCenterX = petTarget.x + (Number.isFinite(petTarget.width) ? petTarget.width : tileSize) / 2;
          const petCenterY = petTarget.y + (Number.isFinite(petTarget.height) ? petTarget.height : tileSize) / 2;
          const petDistance = distance(petCenterX, petCenterY, landingCenterX, landingCenterY);
          if (petDistance <= splashRadius) {
            const maxHp = Number.isFinite(petTarget.maxHp) ? Math.max(1, petTarget.maxHp) : 1;
            const currentHp = Number.isFinite(petTarget.hp) ? Math.max(0, Math.min(maxHp, petTarget.hp)) : maxHp;
            petTarget.hp = Math.max(0, currentHp - leapDamage);
            if (petTarget.hp <= 0) {
              petTarget.passedOut = true;
              petTarget.passedOutAt = now;
            }
            handlers.onHitConfirmed({
              type: "petDamaged",
              source: enemy,
              target: petTarget,
              damage: leapDamage,
              now
            });
          }
        }
        enemy.pendingAttackType = "";
        continue;
      }
      const projectileProfile = enemyProfile?.projectile && typeof enemyProfile.projectile === "object"
        ? enemyProfile.projectile
        : null;
      if (projectileProfile && !targetIsPet) {
        const toTargetX = targetCenterX - enemyCenterX;
        const toTargetY = targetCenterY - enemyCenterY;
        const toTargetLength = Math.max(0.001, Math.hypot(toTargetX, toTargetY));
        const normX = toTargetX / toTargetLength;
        const normY = toTargetY / toTargetLength;
        const projectileSpeed = Number.isFinite(projectileProfile.speedPxPerFrame)
          ? Math.max(0.6, projectileProfile.speedPxPerFrame)
          : 2.4;
        const projectileRange = Number.isFinite(enemyProfile?.range)
          ? Math.max(tileSize * 1.5, enemyProfile.range)
          : Math.max(tileSize * 1.5, Number.isFinite(enemy.attackRange) ? enemy.attackRange : tileSize * 2.5);
        const startX = enemyCenterX + normX * (tileSize * 0.46);
        const startY = enemyCenterY + normY * (tileSize * 0.2) - tileSize * 0.12;
        const projectileDurationMs = Math.max(350, (projectileRange / Math.max(0.001, projectileSpeed)) * 16.667);
        handlers.onEnemyProjectileSpawn({
          source: enemy,
          target: strikeTarget,
          now,
          startX,
          startY,
          velocityX: normX * projectileSpeed,
          velocityY: normY * projectileSpeed,
          range: projectileRange,
          durationMs: projectileDurationMs,
          radius: Number.isFinite(projectileProfile.radius) ? Math.max(2, projectileProfile.radius) : tileSize * 0.2,
          damage: resolveEntityDamage(enemy, Number.isFinite(enemyProfile?.damage) ? enemyProfile.damage : enemy.damage, "damageRollTable"),
          projectileType: String(projectileProfile.type || "enemyProjectile"),
          poisonDurationMs: Number.isFinite(projectileProfile.poisonDurationMs)
            ? Math.max(0, projectileProfile.poisonDurationMs)
            : 0
        });
        enemy.pendingAttackType = "";
        continue;
      }

      const strikeRadius = Number.isFinite(enemyProfile?.hitRadius)
        ? enemyProfile.hitRadius
        : (Number.isFinite(enemy.attackRange) ? enemy.attackRange : tileSize * 0.9);
      const d = distance(targetCenterX, targetCenterY, strikeCenter.x, strikeCenter.y);
      if (d > strikeRadius + tileSize * 0.25) {
        enemy.pendingAttackType = "";
        continue;
      }
      if (!targetIsPet && player.invulnerableUntil > now) {
        enemy.pendingAttackType = "";
        continue;
      }

      const fallbackDamage = Number.isFinite(enemyProfile?.damage)
        ? enemyProfile.damage
        : (Number.isFinite(enemy?.damage) ? enemy.damage : 0);
      const enemyDamage = resolveEntityDamage(enemy, fallbackDamage, "damageRollTable");
      if (targetIsPet) {
        const maxHp = Number.isFinite(strikeTarget.maxHp) ? Math.max(1, strikeTarget.maxHp) : 1;
        const currentHp = Number.isFinite(strikeTarget.hp) ? Math.max(0, Math.min(maxHp, strikeTarget.hp)) : maxHp;
        strikeTarget.hp = Math.max(0, currentHp - enemyDamage);
        if (strikeTarget.hp <= 0) {
          strikeTarget.passedOut = true;
          strikeTarget.passedOutAt = now;
        }
      } else {
        player.hp = Math.max(0, player.hp - enemyDamage);
        player.invulnerableUntil = now + player.invulnerableMs;
      }

      const toEnemyX = enemyCenterX - targetCenterX;
      const toEnemyY = enemyCenterY - targetCenterY;
      const toEnemyLength = Math.max(0.001, Math.hypot(toEnemyX, toEnemyY));
      const fromEnemyDirX = toEnemyX / toEnemyLength;
      const fromEnemyDirY = toEnemyY / toEnemyLength;
      const damageTextOffset = tileSize * 0.62;
      const damageTextX = targetCenterX + fromEnemyDirX * damageTextOffset;
      const damageTextY = targetCenterY + fromEnemyDirY * (damageTextOffset * 0.45) - tileSize * 0.22;

      handlers.onRequestVfx("hitSpark", {
        x: targetCenterX,
        y: targetCenterY - 6,
        size: 20,
        durationMs: 260
      });
      handlers.onRequestVfx("damageText", {
        x: damageTextX,
        y: damageTextY,
        text: `-${enemyDamage}`,
        color: "#ff3b3b",
        size: targetIsPet ? 24 : 32,
        durationMs: 620
      });
      if (targetIsPet) {
        handlers.onHitConfirmed({
          type: "petDamaged",
          source: enemy,
          target: strikeTarget,
          damage: enemyDamage,
          now
        });
      } else {
        handlers.onPlayerDamaged({
          source: enemy,
          target: player,
          damage: enemyDamage,
          now
        });
        handlers.onHitConfirmed({
          type: "playerDamaged",
          source: enemy,
          target: player,
          damage: enemyDamage,
          now
        });

        if (player.hp <= 0) {
          if (typeof handlers.onPlayerDefeated === "function") {
            handlers.onPlayerDefeated({ player, source: enemy, now });
          } else {
            player.hp = player.maxHp;
            player.x = player.spawnX;
            player.y = player.spawnY;
            handlers.onRequestVfx("doorSwirl", {
              x: player.x + tileSize / 2,
              y: player.y + tileSize / 2,
              size: 30,
              durationMs: 500
            });
          }
        }
      }
      enemy.pendingAttackType = "";
    }
  }

  function update({
    now = performance.now(),
    gameState,
    isDialogueActive = false,
    choiceActive = false,
    attackPressed = false,
    requestedAttackId = null,
    player,
    enemies,
    npcs = null,
    currentAreaId,
    playerEquipment = null,
    collidesAt = null
  }) {
    if (!player || !Array.isArray(enemies)) return;
    resolveAttackDtScale(now);

    if (
      !isFreeExploreState(gameState) ||
      isDialogueActive ||
      choiceActive
    ) {
      player.attackState = "idle";
      player.activeAttackId = null;
      player.attackLockedDir = null;
      player.attackLockedTargetId = null;
      player.attackHitWindowUntil = 0;
      lastCombatUpdateAt = now;
      hitIdsInCurrentSwing.clear();
      npcHitIdsInCurrentSwing.clear();
      return;
    }

    const equippedProfile = getAttackProfileForEntity(player, requestedAttackId);
    if (!equippedProfile && attackPressed) return;

    if (
      attackPressed &&
      player.attackState === "idle" &&
      now - player.lastAttackAt >= (equippedProfile?.cooldownMs || 0)
    ) {
      const pressedFacingDir = String(player.dir || "down").toLowerCase();
      const facingEnemy = findBestFacingEnemy({
        player,
        enemies,
        currentAreaId,
        pressedFacingDir
      });
      player.attackLockedDir = facingEnemy?.dir || pressedFacingDir;
      player.attackLockedTargetId = facingEnemy?.enemy?.id || null;
      player.dir = player.attackLockedDir;

      const isBasicAttack = equippedProfile?.id === defaultAttackId;
      const basicManaCost = Number.isFinite(basicAttackManaCost) ? Math.max(0, basicAttackManaCost) : 0;
      if (isBasicAttack && basicManaCost > 0) {
        const currentMana = Number.isFinite(player.mana) ? Math.max(0, player.mana) : 0;
        if (currentMana < basicManaCost) {
          player.attackLockedDir = null;
          player.attackLockedTargetId = null;
          return;
        }
        player.mana = Math.max(0, currentMana - basicManaCost);
      }
      beginPlayerAttack(player, equippedProfile, now);
    }

    updatePlayerAttackState(player, now);
    updatePlayerAttackHitFrameCue(player, now);
    const activeProfile = getAttackProfileForEntity(player, player.activeAttackId);
    updatePlayerLockOnMovement({
      now,
      player,
      enemies,
      currentAreaId,
      profile: activeProfile,
      collidesAt
    });
    processPlayerHits({
      now,
      player,
      enemies,
      currentAreaId,
      profile: player.attackState === "active" ? activeProfile : null,
      playerEquipment
    });
    processPlayerNpcHits({
      now,
      player,
      npcs,
      currentAreaId,
      profile: player.attackState === "active" ? activeProfile : null
    });
    processEnemyStrikes({ now, player, enemies, npcs, currentAreaId });
  }

  return {
    update,
    registerAttackProfile
  };
}
