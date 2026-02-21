import { ENEMY_ARCHETYPES } from "../enemyArchetypes.js";

export function createNPCsForTown(town, tileSize, getSprite) {
  const npcDefinitions = Array.isArray(town?.npcs) ? town.npcs : [];

  return npcDefinitions.map((npc) => {
    const {
      id,
      areaId,
      x,
      y,
      desiredHeightTiles,
      name,
      spriteName,
      dialogue,
      hasTrainingChoice,
      dir,
      ...customFields
    } = npc;
    const obeyAnimal = Boolean(customFields.obeyAnimal);
    const resolvedLevel = Number.isFinite(customFields.level)
      ? Math.max(1, Math.floor(customFields.level))
      : (obeyAnimal ? 1 : null);
    const resolvedMaxHp = Number.isFinite(customFields.maxHp)
      ? Math.max(1, customFields.maxHp)
      : (obeyAnimal ? 15 : null);
    const resolvedHp = Number.isFinite(customFields.hp)
      ? Math.max(0, Math.min(Number.isFinite(resolvedMaxHp) ? resolvedMaxHp : customFields.hp, customFields.hp))
      : (Number.isFinite(resolvedMaxHp) ? resolvedMaxHp : null);

    return {
      ...customFields,
      id,
      world: areaId,
      x: x * tileSize,
      y: y * tileSize,
      width: tileSize,
      height: tileSize,
      desiredHeightTiles,
      name,
      sprite: getSprite(spriteName),
      dialogue: Array.isArray(dialogue) ? [...dialogue] : [String(dialogue ?? "")],
      hasTrainingChoice: Boolean(hasTrainingChoice),
      dir: dir || "down",
      ...(Number.isFinite(resolvedLevel) ? { level: resolvedLevel } : {}),
      ...(Number.isFinite(resolvedMaxHp) ? { maxHp: resolvedMaxHp } : {}),
      ...(Number.isFinite(resolvedHp) ? { hp: resolvedHp } : {})
    };
  });
}

export function createEnemiesForTown(town, tileSize, getSprite) {
  const enemyDefinitions = Array.isArray(town?.enemies) ? town.enemies : [];

  return enemyDefinitions.map((enemy, index) => {
    const archetypeId = typeof enemy.archetypeId === "string" ? enemy.archetypeId : null;
    const archetypeDefaults = archetypeId && ENEMY_ARCHETYPES[archetypeId]
      ? ENEMY_ARCHETYPES[archetypeId]
      : null;
    const resolved = {
      ...(archetypeDefaults || {}),
      ...enemy
    };

    const {
      id,
      areaId,
      x,
      y,
      dir,
      spriteName,
      maxHp,
      damage,
      speed,
      aggroRangeTiles,
      attackRangeTiles,
      attackCooldownMs,
      attackWindupMs,
      attackRecoveryMs,
      respawnDelayMs,
      archetypeId: resolvedArchetypeId,
      ...customFields
    } = resolved;

    const spawnX = x * tileSize;
    const spawnY = y * tileSize;
    const resolvedMaxHp = Number.isFinite(maxHp) ? Math.max(1, maxHp) : 35;

    return {
      ...customFields,
      id: id || `enemy-${index + 1}`,
      name: enemy.name || `Enemy ${index + 1}`,
      world: areaId,
      x: spawnX,
      y: spawnY,
      spawnX,
      spawnY,
      width: tileSize,
      height: tileSize,
      dir: dir || "down",
      sprite: spriteName ? getSprite(spriteName) : null,
      maxHp: resolvedMaxHp,
      hp: resolvedMaxHp,
      damage: Number.isFinite(damage) ? Math.max(0, damage) : 8,
      speed: Number.isFinite(speed) ? Math.max(0.4, speed) : 1.1,
      aggroRange: (Number.isFinite(aggroRangeTiles) ? aggroRangeTiles : 5.5) * tileSize,
      attackRange: (Number.isFinite(attackRangeTiles) ? attackRangeTiles : 1.1) * tileSize,
      attackCooldownMs: Number.isFinite(attackCooldownMs) ? Math.max(120, attackCooldownMs) : 900,
      attackWindupMs: Number.isFinite(attackWindupMs) ? Math.max(60, attackWindupMs) : 220,
      attackRecoveryMs: Number.isFinite(attackRecoveryMs) ? Math.max(60, attackRecoveryMs) : 300,
      respawnDelayMs: Number.isFinite(respawnDelayMs) ? Math.max(1000, respawnDelayMs) : 5000,
      behaviorType: typeof resolved.behaviorType === "string" && resolved.behaviorType.length > 0
        ? resolved.behaviorType
        : "meleeChaser",
      attackType: typeof resolved.attackType === "string" && resolved.attackType.length > 0
        ? resolved.attackType
        : "lightSlash",
      archetypeId: resolvedArchetypeId || null,
      respawnEnabled: resolved.respawnEnabled !== false,
      countsForChallenge: Boolean(resolved.countsForChallenge),
      countsForBogTrial: Boolean(resolved.countsForBogTrial),
      challengeDefeatedCounted: false,
      bogDefeatedCounted: false,
      invulnerableUntil: 0,
      hitStunUntil: 0,
      state: "idle",
      dead: false,
      respawnAt: 0,
      lastAttackAt: -Infinity,
      attackStrikeAt: 0,
      recoverUntil: 0,
      pendingStrike: false
    };
  });
}
