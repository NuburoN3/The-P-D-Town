import { inBounds, isInteger } from "./utils.js";

export function validateSpawns(town, townPath, errors) {
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
}
