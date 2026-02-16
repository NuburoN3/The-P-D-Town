// ============================================================================
// CONTENT VALIDATION - Structural/runtime guards for world content
// ============================================================================

import { AREA_KINDS } from "../core/constants.js";
import { ENEMY_ARCHETYPES } from "./enemyArchetypes.js";

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isInteger(value) {
  return Number.isInteger(value);
}

function ensureMapShape(errors, map, width, height, path) {
  if (!Array.isArray(map)) {
    errors.push(`${path} must return an array of rows.`);
    return;
  }

  if (map.length !== height) {
    errors.push(`${path} row count mismatch. Expected ${height}, got ${map.length}.`);
  }

  for (let y = 0; y < map.length; y++) {
    const row = map[y];
    if (!Array.isArray(row)) {
      errors.push(`${path}[${y}] must be an array.`);
      continue;
    }

    if (row.length !== width) {
      errors.push(`${path}[${y}] column count mismatch. Expected ${width}, got ${row.length}.`);
    }

    for (let x = 0; x < row.length; x++) {
      if (typeof row[x] !== "number") {
        errors.push(`${path}[${y}][${x}] must be a number tile id.`);
      }
    }
  }
}

function inBounds(x, y, width, height) {
  return x >= 0 && y >= 0 && x < width && y < height;
}

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

    const areaIds = Object.keys(town.areas);
    if (areaIds.length === 0) {
      errors.push(`${townPath}.areas must contain at least one area.`);
      continue;
    }

    for (const areaId of areaIds) {
      const area = town.areas[areaId];
      const areaPath = `${townPath}.areas.${areaId}`;
      if (!area || typeof area !== "object") {
        errors.push(`${areaPath} must be an object.`);
        continue;
      }

      if (area.id && area.id !== areaId) {
        warnings.push(`${areaPath}.id differs from area key '${areaId}'.`);
      }

      if (area.kind !== AREA_KINDS.OVERWORLD && area.kind !== AREA_KINDS.INTERIOR) {
        errors.push(`${areaPath}.kind must be '${AREA_KINDS.OVERWORLD}' or '${AREA_KINDS.INTERIOR}'.`);
      }

      if (area.mood != null && (typeof area.mood !== "string" || area.mood.length === 0)) {
        errors.push(`${areaPath}.mood must be a non-empty string when provided.`);
      }

      if (!isPositiveInteger(area.width) || !isPositiveInteger(area.height)) {
        errors.push(`${areaPath}.width and .height must be positive integers.`);
      }

      if (typeof area.generateBaseMap !== "function") {
        errors.push(`${areaPath}.generateBaseMap must be a function.`);
      } else if (isPositiveInteger(area.width) && isPositiveInteger(area.height)) {
        try {
          const map = area.generateBaseMap(area.width, area.height);
          ensureMapShape(errors, map, area.width, area.height, `${areaPath}.generateBaseMap()`);
        } catch (error) {
          errors.push(`${areaPath}.generateBaseMap threw an error: ${error?.message || String(error)}`);
        }
      }

      if (Array.isArray(area.buildings)) {
        for (let i = 0; i < area.buildings.length; i++) {
          const building = area.buildings[i];
          const buildingPath = `${areaPath}.buildings[${i}]`;
          if (!building || typeof building !== "object") {
            errors.push(`${buildingPath} must be an object.`);
            continue;
          }

          if (typeof building.type !== "string" || building.type.length === 0) {
            errors.push(`${buildingPath}.type must be a string.`);
          }

          if (
            !isInteger(building.x) ||
            !isInteger(building.y) ||
            !isPositiveInteger(building.width) ||
            !isPositiveInteger(building.height)
          ) {
            errors.push(`${buildingPath} must include integer x/y and positive integer width/height.`);
            continue;
          }

          if (
            !inBounds(building.x, building.y, area.width, area.height) ||
            !inBounds(building.x + building.width - 1, building.y + building.height - 1, area.width, area.height)
          ) {
            errors.push(`${buildingPath} is out of area bounds.`);
          }
        }
      }

      if (Array.isArray(area.signposts)) {
        for (let i = 0; i < area.signposts.length; i++) {
          const signpost = area.signposts[i];
          const signpostPath = `${areaPath}.signposts[${i}]`;
          if (!signpost || typeof signpost !== "object") {
            errors.push(`${signpostPath} must be an object.`);
            continue;
          }

          if (!isInteger(signpost.x) || !isInteger(signpost.y)) {
            errors.push(`${signpostPath}.x and .y must be integers.`);
            continue;
          }

          if (!inBounds(signpost.x, signpost.y, area.width, area.height)) {
            errors.push(`${signpostPath} is out of area bounds.`);
          }

          if (typeof signpost.text !== "string" || signpost.text.length === 0) {
            errors.push(`${signpostPath}.text must be a non-empty string.`);
          }
        }
      }

      if (area.trainingTile) {
        if (!isInteger(area.trainingTile.x) || !isInteger(area.trainingTile.y)) {
          errors.push(`${areaPath}.trainingTile.x and .y must be integers.`);
        } else if (!inBounds(area.trainingTile.x, area.trainingTile.y, area.width, area.height)) {
          errors.push(`${areaPath}.trainingTile is out of bounds.`);
        }
      }
    }

    const spawnIds = Object.keys(town.spawns);
    if (spawnIds.length === 0) {
      errors.push(`${townPath}.spawns must contain at least one spawn.`);
    }

    if (town.defaultSpawnId && !town.spawns[town.defaultSpawnId]) {
      errors.push(`${townPath}.defaultSpawnId '${town.defaultSpawnId}' does not exist in spawns.`);
    }

    for (const spawnId of spawnIds) {
      const spawn = town.spawns[spawnId];
      const spawnPath = `${townPath}.spawns.${spawnId}`;
      if (!spawn || typeof spawn !== "object") {
        errors.push(`${spawnPath} must be an object.`);
        continue;
      }

      if (typeof spawn.areaId !== "string" || !town.areas[spawn.areaId]) {
        errors.push(`${spawnPath}.areaId must reference an existing area.`);
        continue;
      }

      if (!isInteger(spawn.x) || !isInteger(spawn.y)) {
        errors.push(`${spawnPath}.x and .y must be integers.`);
        continue;
      }

      const area = town.areas[spawn.areaId];
      if (!inBounds(spawn.x, spawn.y, area.width, area.height)) {
        errors.push(`${spawnPath} is out of bounds for area '${spawn.areaId}'.`);
      }
    }

    if (Array.isArray(town.npcs)) {
      for (let i = 0; i < town.npcs.length; i++) {
        const npc = town.npcs[i];
        const npcPath = `${townPath}.npcs[${i}]`;
        if (!npc || typeof npc !== "object") {
          errors.push(`${npcPath} must be an object.`);
          continue;
        }

        if (typeof npc.areaId !== "string" || !town.areas[npc.areaId]) {
          errors.push(`${npcPath}.areaId must reference an existing area.`);
          continue;
        }

        if (!isInteger(npc.x) || !isInteger(npc.y)) {
          errors.push(`${npcPath}.x and .y must be integers.`);
          continue;
        }

        const area = town.areas[npc.areaId];
        if (!inBounds(npc.x, npc.y, area.width, area.height)) {
          errors.push(`${npcPath} is out of bounds for area '${npc.areaId}'.`);
        }

        if (typeof npc.name !== "string" || npc.name.length === 0) {
          errors.push(`${npcPath}.name must be a non-empty string.`);
        }

        if (typeof npc.spriteName !== "string" || npc.spriteName.length === 0) {
          errors.push(`${npcPath}.spriteName must be a non-empty string.`);
        }

        const dialogueIsValid =
          typeof npc.dialogue === "string" ||
          (Array.isArray(npc.dialogue) && npc.dialogue.every((line) => typeof line === "string"));
        if (!dialogueIsValid) {
          errors.push(`${npcPath}.dialogue must be a string or array of strings.`);
        }

        if (npc.minigameId != null && (typeof npc.minigameId !== "string" || npc.minigameId.length === 0)) {
          errors.push(`${npcPath}.minigameId must be a non-empty string when provided.`);
        }

        const minigameTextFields = [
          "minigamePrompt",
          "minigameDeclineDialogue",
          "minigameWinDialogue",
          "minigameLoseDialogue"
        ];

        for (const field of minigameTextFields) {
          if (npc[field] != null && typeof npc[field] !== "string") {
            errors.push(`${npcPath}.${field} must be a string when provided.`);
          }
        }
      }
    }

    if (Array.isArray(town.enemies)) {
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
  }

  for (const townId of townIds) {
    const town = towns[townId];
    const doors = Array.isArray(town.doors) ? town.doors : [];
    for (let i = 0; i < doors.length; i++) {
      const door = doors[i];
      const doorPath = `content.towns.${townId}.doors[${i}]`;
      if (!door || typeof door !== "object") {
        errors.push(`${doorPath} must be an object.`);
        continue;
      }

      if (!door.from || typeof door.from !== "object") {
        errors.push(`${doorPath}.from must be an object.`);
      } else {
        if (typeof door.from.areaId !== "string" || !town.areas[door.from.areaId]) {
          errors.push(`${doorPath}.from.areaId must reference an existing area in '${townId}'.`);
        } else {
          const area = town.areas[door.from.areaId];
          if (!isInteger(door.from.x) || !isInteger(door.from.y)) {
            errors.push(`${doorPath}.from.x and .y must be integers.`);
          } else if (!inBounds(door.from.x, door.from.y, area.width, area.height)) {
            errors.push(`${doorPath}.from tile is out of bounds.`);
          }
        }
      }

      if (!door.to || typeof door.to !== "object") {
        errors.push(`${doorPath}.to must be an object.`);
      } else {
        const targetTown = towns[door.to.townId];
        if (typeof door.to.townId !== "string" || !targetTown) {
          errors.push(`${doorPath}.to.townId must reference an existing town.`);
        } else if (typeof door.to.spawnId !== "string" || !targetTown.spawns?.[door.to.spawnId]) {
          errors.push(`${doorPath}.to.spawnId must reference an existing spawn in '${door.to.townId}'.`);
        }
      }
    }
  }

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
