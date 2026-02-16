import { inBounds, isInteger } from "./utils.js";

export function validateDoors(towns, townIds, errors) {
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
}
