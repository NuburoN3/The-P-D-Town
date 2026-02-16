// ============================================================================
// CONTENT VALIDATION - Structural/runtime guards for world content
// ============================================================================

import { validateAreas } from "./validation/validateAreas.js";
import { validateDoors } from "./validation/validateDoors.js";
import { validateEnemies } from "./validation/validateEnemies.js";
import { validateNpcs } from "./validation/validateNpcs.js";
import { validateSpawns } from "./validation/validateSpawns.js";

export function validateGameContent(content) {
  const errors = [];
  const warnings = [];

  if (!content || typeof content !== "object") {
    return { errors: ["content must be an object."], warnings };
  }

  const towns = content.towns;
  if (!towns || typeof towns !== "object") {
    return { errors: ["content.towns must be an object."], warnings };
  }

  const townIds = Object.keys(towns);
  if (townIds.length === 0) {
    errors.push("content.towns must contain at least one town.");
    return { errors, warnings };
  }

  for (const townId of townIds) {
    const town = towns[townId];
    const townPath = `content.towns.${townId}`;

    if (!town || typeof town !== "object") {
      errors.push(`${townPath} must be an object.`);
      continue;
    }

    if (!town.name || typeof town.name !== "string") {
      errors.push(`${townPath}.name must be a string.`);
    }

    if (!town.defaultSpawnId || typeof town.defaultSpawnId !== "string") {
      errors.push(`${townPath}.defaultSpawnId must be a string.`);
    }

    if (!town.areas || typeof town.areas !== "object") {
      errors.push(`${townPath}.areas must be an object.`);
      continue;
    }

    if (!town.spawns || typeof town.spawns !== "object") {
      errors.push(`${townPath}.spawns must be an object.`);
      continue;
    }

    validateAreas(town, townPath, errors, warnings);
    validateSpawns(town, townPath, errors);
    validateNpcs(town, townPath, errors);
    validateEnemies(town, townPath, errors, warnings);
  }

  validateDoors(towns, townIds, errors);

  return { errors, warnings };
}

export function assertValidGameContent(content) {
  const { errors, warnings } = validateGameContent(content);
  if (errors.length > 0) {
    const details = errors.map((message) => `- ${message}`).join("\n");
    throw new Error(`Invalid game content:\n${details}`);
  }
  return { warnings };
}
