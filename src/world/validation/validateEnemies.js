import { ENEMY_ARCHETYPES } from "../enemyArchetypes.js";
import { inBounds, isInteger } from "./utils.js";

export function validateEnemies(town, townPath, errors, warnings) {
  if (!Array.isArray(town.enemies)) return;

  for (let i = 0; i < town.enemies.length; i++) {
    const enemy = town.enemies[i];
    const enemyPath = `${townPath}.enemies[${i}]`;
    if (!enemy || typeof enemy !== "object") {
      errors.push(`${enemyPath} must be an object.`);
      continue;
    }

    if (typeof enemy.areaId !== "string" || !town.areas[enemy.areaId]) {
      errors.push(`${enemyPath}.areaId must reference an existing area.`);
      continue;
    }

    if (!isInteger(enemy.x) || !isInteger(enemy.y)) {
      errors.push(`${enemyPath}.x and .y must be integers.`);
      continue;
    }

    const area = town.areas[enemy.areaId];
    if (!inBounds(enemy.x, enemy.y, area.width, area.height)) {
      errors.push(`${enemyPath} is out of bounds for area '${enemy.areaId}'.`);
    }

    if (enemy.maxHp != null && (!Number.isFinite(enemy.maxHp) || enemy.maxHp <= 0)) {
      errors.push(`${enemyPath}.maxHp must be a positive number when provided.`);
    }

    if (enemy.damage != null && (!Number.isFinite(enemy.damage) || enemy.damage < 0)) {
      errors.push(`${enemyPath}.damage must be a non-negative number when provided.`);
    }

    if (enemy.behaviorType != null && (typeof enemy.behaviorType !== "string" || enemy.behaviorType.length === 0)) {
      errors.push(`${enemyPath}.behaviorType must be a non-empty string when provided.`);
    }

    if (enemy.attackType != null && (typeof enemy.attackType !== "string" || enemy.attackType.length === 0)) {
      errors.push(`${enemyPath}.attackType must be a non-empty string when provided.`);
    }

    if (enemy.archetypeId != null && (typeof enemy.archetypeId !== "string" || enemy.archetypeId.length === 0)) {
      errors.push(`${enemyPath}.archetypeId must be a non-empty string when provided.`);
    } else if (typeof enemy.archetypeId === "string" && !ENEMY_ARCHETYPES[enemy.archetypeId]) {
      warnings.push(`${enemyPath}.archetypeId '${enemy.archetypeId}' is not defined in ENEMY_ARCHETYPES.`);
    }
  }
}
