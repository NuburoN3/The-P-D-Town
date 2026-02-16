import { TILE_TYPES } from "../../core/constants.js";
import { BUILDING_TYPES } from "../buildingRenderers.js";
import { isFountainSolidTile } from "../fountainGeometry.js";

function keyForTile(x, y) {
  return `${x},${y}`;
}

function resolveBuildingTileType(building, tileX, tileY) {
  if (building.type === BUILDING_TYPES.FOUNTAIN) {
    return isFountainSolidTile(building, tileX, tileY) ? TILE_TYPES.WALL : TILE_TYPES.PATH;
  }

  if (building.type === BUILDING_TYPES.PEN) {
    const localX = tileX - building.x;
    const localY = tileY - building.y;
    const onBorder =
      localX === 0 ||
      localY === 0 ||
      localX === building.width - 1 ||
      localY === building.height - 1;
    if (!onBorder) return TILE_TYPES.PATH;

    const gateCenter = Math.floor(building.width / 2);
    const isGate =
      localY === building.height - 1 &&
      (localX === gateCenter || (building.width % 2 === 0 && localX === gateCenter - 1));
    return isGate ? TILE_TYPES.PATH : TILE_TYPES.WALL;
  }

  return TILE_TYPES.WALL;
}

export function buildTowns(content) {
  const towns = {};

  for (const [townId, townDef] of Object.entries(content.towns)) {
    const areas = {};
    const doorLookup = new Map();

    for (const [areaId, areaDef] of Object.entries(townDef.areas)) {
      const map = areaDef.generateBaseMap(areaDef.width, areaDef.height);
      areas[areaId] = {
        ...areaDef,
        id: areaId,
        map,
        signpostLookup: new Map(),
        buildingLookup: new Map(),
        musicAreaKey: areaDef.musicSrc ? `${townId}:${areaId}` : null
      };
    }

    for (const [areaId, area] of Object.entries(areas)) {
      if (Array.isArray(area.buildings)) {
        for (const building of area.buildings) {
          for (let y = building.y; y < building.y + building.height; y++) {
            for (let x = building.x; x < building.x + building.width; x++) {
              area.map[y][x] = resolveBuildingTileType(building, x, y);
              area.buildingLookup.set(keyForTile(x, y), building);
            }
          }
        }
      }

      if (Array.isArray(area.signposts)) {
        for (const signpost of area.signposts) {
          area.map[signpost.y][signpost.x] = TILE_TYPES.SIGNPOST;
          area.signpostLookup.set(keyForTile(signpost.x, signpost.y), signpost.text);
        }
      }

      if (area.trainingTile) {
        area.map[area.trainingTile.y][area.trainingTile.x] = TILE_TYPES.TRAINING_FLOOR;
      }
    }

    if (Array.isArray(townDef.doors)) {
      for (const link of townDef.doors) {
        const fromArea = areas[link.from.areaId];
        if (!fromArea) continue;

        fromArea.map[link.from.y][link.from.x] = TILE_TYPES.DOOR;
        doorLookup.set(
          `${link.from.areaId}:${keyForTile(link.from.x, link.from.y)}`,
          {
            targetTownId: link.to.townId,
            targetSpawnId: link.to.spawnId
          }
        );
      }
    }

    towns[townId] = {
      ...townDef,
      id: townId,
      areas,
      doorLookup
    };
  }

  return towns;
}

export function buildAreaTracks(towns) {
  const tracks = {};
  for (const town of Object.values(towns)) {
    for (const area of Object.values(town.areas)) {
      if (area.musicSrc) {
        tracks[area.musicAreaKey] = area.musicSrc;
      }
    }
  }
  return tracks;
}

export function tileLookupKey(areaId, tileX, tileY) {
  return `${areaId}:${keyForTile(tileX, tileY)}`;
}

export function pointLookupKey(tileX, tileY) {
  return keyForTile(tileX, tileY);
}
