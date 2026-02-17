import { isFreeExploreState } from "../core/constants.js";
import { distance } from "../core/mathUtils.js";
import { createDefaultAttackCatalog, resolveAttackProfile } from "./combat/attackCatalog.js";

// distance imported from ../core/mathUtils.js

export function createCombatSystem({
  tileSize,
  attackCatalog = null,
  defaultAttackId = "lightSlash",
  eventHandlers = {},
  spawnVisualEffect = () => { },
  onEnemyDefeated = () => { }
}) {
  const catalog = { ...(attackCatalog || createDefaultAttackCatalog(tileSize)) };
  const hitIdsInCurrentSwing = new Set();
  const npcHitIdsInCurrentSwing = new Set();
  const handlers = {
    onRequestVfx: eventHandlers.onRequestVfx || spawnVisualEffect,
    onEntityDamaged: eventHandlers.onEntityDamaged || (() => { }),
    onEntityDefeated: eventHandlers.onEntityDefeated || onEnemyDefeated,
    onPlayerDamaged: eventHandlers.onPlayerDamaged || (() => { }),
    onPlayerDefeated: eventHandlers.onPlayerDefeated || null,
    onPlayerAttackStarted: eventHandlers.onPlayerAttackStarted || (() => { }),
    onHitConfirmed: eventHandlers.onHitConfirmed || (() => { })
  };

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

    // Preserve compatibility with legacy player fields while enabling catalog-driven attacks.
    const merged = {
      ...profile,
      cooldownMs: Number.isFinite(entity.attackCooldownMs) ? entity.attackCooldownMs : profile.cooldownMs,
      windupMs: Number.isFinite(entity.attackWindupMs) ? entity.attackWindupMs : profile.windupMs,
      activeMs: Number.isFinite(entity.attackActiveMs) ? entity.attackActiveMs : profile.activeMs,
      recoveryMs: Number.isFinite(entity.attackRecoveryMs) ? entity.attackRecoveryMs : profile.recoveryMs,
      range: Number.isFinite(entity.attackRange) ? entity.attackRange : profile.range,
      hitRadius: Number.isFinite(entity.attackHitRadius) ? entity.attackHitRadius : profile.hitRadius,
      damage: Number.isFinite(entity.attackDamage) ? entity.attackDamage : profile.damage
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

  function updatePlayerAttackState(player, now) {
    if (player.attackState === "windup" && now >= player.attackActiveAt) {
      player.attackState = "active";
      return;
    }

    if (player.attackState === "active" && now >= player.attackActiveUntil) {
      player.attackState = "recovery";
      return;
    }

    if (player.attackState === "recovery" && now >= player.attackRecoveryUntil) {
      player.attackState = "idle";
      hitIdsInCurrentSwing.clear();
      npcHitIdsInCurrentSwing.clear();
    }
  }

  function reactNpcToAttack(npc, now) {
    npc.hitShakeUntil = now + 220;
    npc.hitBubbleUntil = now + 760;
    npc.hitBubbleText = "Ow!";
  }

  function hitEnemy(player, enemy, profile, now) {
    const damage = Number.isFinite(profile.damage) ? profile.damage : 0;
    enemy.hp = Math.max(0, enemy.hp - damage);
    enemy.invulnerableUntil = now + 180;
    enemy.hitStunUntil = now + 230;
    enemy.state = "hitStun";
    enemy.pendingStrike = false;

    const ex = enemy.x + enemy.width / 2;
    const ey = enemy.y + enemy.height / 2;
    handlers.onRequestVfx("hitSpark", { x: ex, y: ey, size: 18, durationMs: 240 });
    handlers.onRequestVfx("damageText", {
      x: ex,
      y: ey - 14,
      text: `-${damage}`,
      color: "#ffd47a",
      durationMs: 560
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

  function processPlayerHits({ now, player, enemies, currentAreaId, profile }) {
    if (player.attackState !== "active") return;
    if (!profile) return;

    const attackCenter = profile.getAttackCenter
      ? profile.getAttackCenter(player)
      : { x: player.x + tileSize / 2, y: player.y + tileSize / 2 };
    const hitRadius = Number.isFinite(profile.hitRadius) ? profile.hitRadius : tileSize * 0.7;

    for (const enemy of enemies) {
      if (!enemy || enemy.dead || enemy.world !== currentAreaId) continue;
      if (hitIdsInCurrentSwing.has(enemy.id)) continue;
      if (enemy.invulnerableUntil > now) continue;

      const enemyCenterX = enemy.x + enemy.width / 2;
      const enemyCenterY = enemy.y + enemy.height / 2;
      const d = distance(attackCenter.x, attackCenter.y, enemyCenterX, enemyCenterY);
      if (d > hitRadius + enemy.width * 0.42) continue;

      hitIdsInCurrentSwing.add(enemy.id);
      hitEnemy(player, enemy, profile, now);
    }
  }

  function processPlayerNpcHits({ now, player, npcs, currentAreaId, profile }) {
    if (player.attackState !== "active") return;
    if (!profile || !Array.isArray(npcs) || npcs.length === 0) return;

    const attackCenter = profile.getAttackCenter
      ? profile.getAttackCenter(player)
      : { x: player.x + tileSize / 2, y: player.y + tileSize / 2 };
    const hitRadius = Number.isFinite(profile.hitRadius) ? profile.hitRadius : tileSize * 0.7;

    for (const npc of npcs) {
      if (!npc || npc.world !== currentAreaId) continue;
      if (npcHitIdsInCurrentSwing.has(npc.id)) continue;

      const npcCenterX = npc.x + npc.width / 2;
      const npcCenterY = npc.y + npc.height / 2;
      const d = distance(attackCenter.x, attackCenter.y, npcCenterX, npcCenterY);
      if (d > hitRadius + npc.width * 0.42) continue;

      npcHitIdsInCurrentSwing.add(npc.id);
      reactNpcToAttack(npc, now);
    }
  }

  function processEnemyStrikes({ now, player, enemies, currentAreaId }) {
    for (const enemy of enemies) {
      if (!enemy || enemy.dead || enemy.world !== currentAreaId) continue;
      if (!enemy.pendingStrike) continue;

      enemy.pendingStrike = false;
      const enemyProfile = getAttackProfileForEntity(enemy, enemy.attackType || enemy.equippedAttackId || null);

      const playerCenterX = player.x + tileSize / 2;
      const playerCenterY = player.y + tileSize / 2;
      const enemyCenterX = enemy.x + enemy.width / 2;
      const enemyCenterY = enemy.y + enemy.height / 2;
      const strikeCenter = enemyProfile?.getAttackCenter
        ? enemyProfile.getAttackCenter(enemy)
        : { x: enemyCenterX, y: enemyCenterY };
      const strikeRadius = Number.isFinite(enemyProfile?.hitRadius)
        ? enemyProfile.hitRadius
        : (Number.isFinite(enemy.attackRange) ? enemy.attackRange : tileSize * 0.9);
      const d = distance(playerCenterX, playerCenterY, strikeCenter.x, strikeCenter.y);
      if (d > strikeRadius + tileSize * 0.25) continue;
      if (player.invulnerableUntil > now) continue;

      const enemyDamage = Number.isFinite(enemyProfile?.damage)
        ? enemyProfile.damage
        : (Number.isFinite(enemy.damage) ? enemy.damage : 0);
      player.hp = Math.max(0, player.hp - enemyDamage);
      player.invulnerableUntil = now + player.invulnerableMs;

      handlers.onRequestVfx("hitSpark", {
        x: playerCenterX,
        y: playerCenterY - 6,
        size: 20,
        durationMs: 260
      });
      handlers.onRequestVfx("damageText", {
        x: playerCenterX,
        y: playerCenterY - 20,
        text: `-${enemyDamage}`,
        color: "#ff8b8b",
        durationMs: 560
      });
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
    currentAreaId
  }) {
    if (!player || !Array.isArray(enemies)) return;

    if (
      !isFreeExploreState(gameState) ||
      isDialogueActive ||
      choiceActive
    ) {
      player.attackState = "idle";
      player.activeAttackId = null;
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
      beginPlayerAttack(player, equippedProfile, now);
    }

    updatePlayerAttackState(player, now);
    const activeProfile = getAttackProfileForEntity(player, player.activeAttackId);
    processPlayerHits({
      now,
      player,
      enemies,
      currentAreaId,
      profile: player.attackState === "active" ? activeProfile : null
    });
    processPlayerNpcHits({
      now,
      player,
      npcs,
      currentAreaId,
      profile: player.attackState === "active" ? activeProfile : null
    });
    processEnemyStrikes({ now, player, enemies, currentAreaId });
  }

  return {
    update,
    registerAttackProfile
  };
}
