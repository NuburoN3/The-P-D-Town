// ============================================================================
// WORLD SERVICE - Runtime world graph + town/area lookups
// ============================================================================

import { AREA_KINDS } from "../core/constants.js";
import { GAME_CONTENT } from "./content.js";
import { BUILDING_TYPES } from "./buildingRenderers.js";
import { isFountainWaterTile as isFountainWaterTileInBuilding } from "./fountainGeometry.js";
import { createEnemiesForTown as createTownEnemies, createNPCsForTown as createTownNpcs } from "./runtime/actorFactories.js";
import { buildAreaTracks, buildTowns, pointLookupKey, tileLookupKey } from "./runtime/townBuilder.js";
import { assertValidGameContent } from "./validateContent.js";

export class WorldService {
  constructor({ tileSize, getSprite, content = GAME_CONTENT, validateContent = true }) {
    this.tileSize = tileSize;
    this.getSprite = getSprite;
    this.content = content;
    this.validationWarnings = [];
    if (validateContent) {
      const { warnings } = assertValidGameContent(this.content);
      this.validationWarnings = warnings;
      if (warnings.length > 0) {
        console.warn("[WorldService] Content warnings:\n" + warnings.map((w) => `- ${w}`).join("\n"));
      }
    }
    this.towns = buildTowns(this.content);
    this.areaTracks = buildAreaTracks(this.towns);
  }

  getTown(townId) {
    return this.towns[townId] || null;
  }

  getArea(townId, areaId) {
    const town = this.getTown(townId);
    if (!town) return null;
    return town.areas[areaId] || null;
  }

  getAreaKind(townId, areaId) {
    const area = this.getArea(townId, areaId);
    return area ? area.kind : null;
  }

  getAreaMusicKey(townId, areaId) {
    const area = this.getArea(townId, areaId);
    return area ? area.musicAreaKey : null;
  }

  getAreaMoodPreset(townId, areaId) {
    const area = this.getArea(townId, areaId);
    if (!area || typeof area.mood !== "string") return null;
    return area.mood;
  }

  getInitialSpawn(townId) {
    const town = this.getTown(townId);
    if (!town) return null;
    return this.resolveSpawn(townId, town.defaultSpawnId);
  }

  resolveSpawn(townId, spawnId) {
    const town = this.getTown(townId);
    if (!town || !town.spawns[spawnId]) return null;
    const spawn = town.spawns[spawnId];
    return {
      townId,
      areaId: spawn.areaId,
      tileX: spawn.x,
      tileY: spawn.y,
      x: spawn.x * this.tileSize,
      y: spawn.y * this.tileSize,
      dir: spawn.dir || "down"
    };
  }

  resolveDoorDestination(townId, areaId, tileX, tileY) {
    const town = this.getTown(townId);
    if (!town) return null;

    const link = town.doorLookup.get(tileLookupKey(areaId, tileX, tileY));
    if (!link) return null;

    return this.resolveSpawn(link.targetTownId, link.targetSpawnId);
  }

  getSignpostText(townId, areaId, tileX, tileY) {
    const area = this.getArea(townId, areaId);
    if (!area) return null;
    return area.signpostLookup.get(pointLookupKey(tileX, tileY)) || null;
  }

  getTrainingTile(townId, areaId) {
    const area = this.getArea(townId, areaId);
    return area?.trainingTile || null;
  }

  getBuilding(townId, areaId, tileX, tileY) {
    const area = this.getArea(townId, areaId);
    if (!area) return null;
    return area.buildingLookup.get(pointLookupKey(tileX, tileY)) || null;
  }

  isFountainWaterTile(townId, areaId, tileX, tileY) {
    const building = this.getBuilding(townId, areaId, tileX, tileY);
    if (!building || building.type !== BUILDING_TYPES.FOUNTAIN) return false;
    return isFountainWaterTileInBuilding(building, tileX, tileY);
  }

  createNPCsForTown(townId) {
    const town = this.getTown(townId);
    if (!town) return [];
    return createTownNpcs(town, this.tileSize, (spriteName) => this.getSprite(spriteName));
  }

  createEnemiesForTown(townId) {
    const town = this.getTown(townId);
    if (!town) return [];
    return createTownEnemies(town, this.tileSize, (spriteName) => this.getSprite(spriteName));
  }

  getTrainingContent() {
    return this.content.training;
  }
}

export function createWorldService(deps) {
  return new WorldService(deps);
}

export { AREA_KINDS };
