// ============================================================================
// WORLD SERVICE - Runtime world graph + town/area lookups
// ============================================================================

import { TILE_TYPES, AREA_KINDS } from "../core/constants.js";
import { GAME_CONTENT } from "./content.js";
import { assertValidGameContent } from "./validateContent.js";
import { BUILDING_TYPES } from "./buildingRenderers.js";
import { isFountainSolidTile, isFountainWaterTile as isFountainWaterTileInBuilding } from "./fountainGeometry.js";
import { ENEMY_ARCHETYPES } from "./enemyArchetypes.js";

function keyForTile(x, y) {
  return `${x},${y}`;
}

function resolveBuildingTileType(building, tileX, tileY) {
  if (building.type === BUILDING_TYPES.FOUNTAIN) {
    return isFountainSolidTile(building, tileX, tileY) ? TILE_TYPES.WALL : TILE_TYPES.PATH;
  }

  return TILE_TYPES.WALL;
}

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
    this.towns = this.#buildTowns();
    this.areaTracks = this.#buildAreaTracks();
  }

  #buildAreaTracks() {
    const tracks = {};
    for (const town of Object.values(this.towns)) {
      for (const area of Object.values(town.areas)) {
        if (area.musicSrc) {
          tracks[area.musicAreaKey] = area.musicSrc;
        }
      }
    }
    return tracks;
  }

  #buildTowns() {
    const towns = {};

    for (const [townId, townDef] of Object.entries(this.content.towns)) {
      const areas = {};
      const doorLookup = new Map();

      for (const [areaId, areaDef] of Object.entries(townDef.areas)) {
        const map = areaDef.generateBaseMap(areaDef.width, areaDef.height);
        areas[areaId] = {
          ...areaDef,
          id: areaId,
          map,
          signpostLookup: new Map(),
          musicAreaKey: areaDef.musicSrc ? `${townId}:${areaId}` : null
        };
      }

      for (const [areaId, area] of Object.entries(areas)) {
        if (Array.isArray(area.buildings)) {
          for (const building of area.buildings) {
            for (let y = building.y; y < building.y + building.height; y++) {
              for (let x = building.x; x < building.x + building.width; x++) {
                area.map[y][x] = resolveBuildingTileType(building, x, y);
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

    const link = town.doorLookup.get(`${areaId}:${keyForTile(tileX, tileY)}`);
    if (!link) return null;

    return this.resolveSpawn(link.targetTownId, link.targetSpawnId);
  }

  getSignpostText(townId, areaId, tileX, tileY) {
    const area = this.getArea(townId, areaId);
    if (!area) return null;
    return area.signpostLookup.get(keyForTile(tileX, tileY)) || null;
  }

  getTrainingTile(townId, areaId) {
    const area = this.getArea(townId, areaId);
    return area?.trainingTile || null;
  }

  getBuilding(townId, areaId, tileX, tileY) {
    const area = this.getArea(townId, areaId);
    if (!area || !Array.isArray(area.buildings)) return null;

    for (const building of area.buildings) {
      if (
        tileX >= building.x &&
        tileX < building.x + building.width &&
        tileY >= building.y &&
        tileY < building.y + building.height
      ) {
        return building;
      }
    }

    return null;
  }

  isFountainWaterTile(townId, areaId, tileX, tileY) {
    const building = this.getBuilding(townId, areaId, tileX, tileY);
    if (!building || building.type !== BUILDING_TYPES.FOUNTAIN) return false;
    return isFountainWaterTileInBuilding(building, tileX, tileY);
  }

  createNPCsForTown(townId) {
    const town = this.getTown(townId);
    if (!town) return [];
    const npcDefinitions = Array.isArray(town.npcs) ? town.npcs : [];

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

      return {
        ...customFields,
        id,
        world: areaId,
        x: x * this.tileSize,
        y: y * this.tileSize,
        width: this.tileSize,
        height: this.tileSize,
        desiredHeightTiles,
        name,
        sprite: this.getSprite(spriteName),
        dialogue: Array.isArray(dialogue) ? [...dialogue] : [String(dialogue ?? "")],
        hasTrainingChoice: Boolean(hasTrainingChoice),
        dir: dir || "down"
      };
    });
  }

  createEnemiesForTown(townId) {
    const town = this.getTown(townId);
    if (!town) return [];
    const enemyDefinitions = Array.isArray(town.enemies) ? town.enemies : [];

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

      const spawnX = x * this.tileSize;
      const spawnY = y * this.tileSize;
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
        width: this.tileSize,
        height: this.tileSize,
        dir: dir || "down",
        sprite: spriteName ? this.getSprite(spriteName) : null,
        maxHp: resolvedMaxHp,
        hp: resolvedMaxHp,
        damage: Number.isFinite(damage) ? Math.max(0, damage) : 8,
        speed: Number.isFinite(speed) ? Math.max(0.4, speed) : 1.1,
        aggroRange: (Number.isFinite(aggroRangeTiles) ? aggroRangeTiles : 5.5) * this.tileSize,
        attackRange: (Number.isFinite(attackRangeTiles) ? attackRangeTiles : 1.1) * this.tileSize,
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
        challengeDefeatedCounted: false,
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

  getTrainingContent() {
    return this.content.training;
  }
}

export function createWorldService(deps) {
  return new WorldService(deps);
}

export { AREA_KINDS };
