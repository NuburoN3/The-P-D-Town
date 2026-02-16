import { AREA_KINDS } from "../../core/constants.js";
import { ensureMapShape, inBounds, isInteger, isPositiveInteger } from "./utils.js";

export function validateAreas(town, townPath, errors, warnings) {
  const areaIds = Object.keys(town.areas);
  if (areaIds.length === 0) {
    errors.push(`${townPath}.areas must contain at least one area.`);
    return;
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

    validateBuildings(area, areaPath, errors);
    validateSignposts(area, areaPath, errors);
    validateTrainingTile(area, areaPath, errors);
  }
}

function validateBuildings(area, areaPath, errors) {
  if (!Array.isArray(area.buildings)) return;

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

function validateSignposts(area, areaPath, errors) {
  if (!Array.isArray(area.signposts)) return;

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

function validateTrainingTile(area, areaPath, errors) {
  if (!area.trainingTile) return;

  if (!isInteger(area.trainingTile.x) || !isInteger(area.trainingTile.y)) {
    errors.push(`${areaPath}.trainingTile.x and .y must be integers.`);
  } else if (!inBounds(area.trainingTile.x, area.trainingTile.y, area.width, area.height)) {
    errors.push(`${areaPath}.trainingTile is out of bounds.`);
  }
}
