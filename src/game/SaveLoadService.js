import { TILE, AREA_KINDS, GAME_STATES } from "../core/constants.js";

/**
 * Creates a serializable snapshot of the current game state.
 * @param {object} context
 * @param {string} context.townId
 * @param {string} context.areaId
 * @param {object} context.player
 * @param {object} context.gameFlags
 * @param {object} context.playerStats
 * @param {object} context.playerInventory
 * @param {object} context.playerEquipment
 * @returns {object} The snapshot object
 */
export function buildGameSnapshot({
    townId,
    areaId,
    player,
    gameFlags,
    playerStats,
    playerInventory,
    playerEquipment,
    objectiveState = null
}) {
    const snapshotObjective = objectiveState && typeof objectiveState === "object"
        ? {
            id: String(objectiveState.id || ""),
            text: String(objectiveState.text || ""),
            updatedAt: Number.isFinite(objectiveState.updatedAt) ? objectiveState.updatedAt : 0
        }
        : null;

    return {
        version: 1,
        world: {
            townId,
            areaId
        },
        player: {
            x: player.x,
            y: player.y,
            dir: player.dir,
            hp: player.hp,
            maxHp: player.maxHp,
            equippedAttackId: player.equippedAttackId || "lightSlash"
        },
        gameFlags: {
            ...gameFlags,
            townProgress: JSON.parse(JSON.stringify(gameFlags.townProgress || {})) // Deep copy
        },
        playerStats: { ...playerStats },
        playerInventory: { ...playerInventory },
        playerEquipment: { ...(playerEquipment || {}) },
        objectiveState: snapshotObjective
    };
}

/**
 * Applies a snapshot to the current game state.
 * @param {object} snapshot
 * @param {object} context
 * @param {object} context.worldService
 * @param {object} context.collisionService
 * @param {object} context.player
 * @param {object} context.gameFlags
 * @param {object} context.playerStats
 * @param {object} context.playerInventory
 * @param {object} context.playerEquipment
 * @param {Array} context.npcs
 * @param {Array} context.enemies
 * @param {object} context.camera
 * @param {string} context.currentGameState
 * @returns {object} Result object { success: boolean, newWorldState?: { townId, areaId, map, width, height }, newGameState?: string }
 */
export function applyGameSnapshot(snapshot, context) {
    if (!snapshot || typeof snapshot !== "object") return { success: false };

    const {
        worldService,
        collisionService,
        player,
        npcs,
        enemies,
        camera,
        gameFlags,
        playerStats,
        playerInventory,
        playerEquipment,
        objectiveState
    } = context;

    const townId = snapshot.world?.townId;
    const areaId = snapshot.world?.areaId;
    const area = worldService.getArea(townId, areaId);
    if (!area) return { success: false };

    // Generate NPCs and Enemies for the destination town
    const nextTownNPCs = worldService.createNPCsForTown(townId);
    npcs.splice(0, npcs.length, ...nextTownNPCs);

    const nextTownEnemies = worldService.createEnemiesForTown(townId);
    enemies.splice(0, enemies.length, ...nextTownEnemies);

    // Restore Player State
    const px = Number.isFinite(snapshot.player?.x) ? snapshot.player.x : player.x;
    const py = Number.isFinite(snapshot.player?.y) ? snapshot.player.y : player.y;

    // Resolve safe position requires map dimensions which come from 'area'
    const safePosition = resolveNearestWalkablePlayerPosition(
        px, py,
        area.map, area.width, area.height,
        npcs, townId, collisionService
    );

    player.x = safePosition.x;
    player.y = safePosition.y;
    player.spawnX = safePosition.x;
    player.spawnY = safePosition.y;
    player.dir = snapshot.player?.dir || player.dir || "down";
    player.maxHp = Number.isFinite(snapshot.player?.maxHp) ? Math.max(1, snapshot.player.maxHp) : player.maxHp;
    player.hp = Number.isFinite(snapshot.player?.hp)
        ? Math.max(0, Math.min(player.maxHp, snapshot.player.hp))
        : player.hp;
    player.equippedAttackId = snapshot.player?.equippedAttackId || player.equippedAttackId || "lightSlash";

    // Restore Game Flags
    if (snapshot.gameFlags && typeof snapshot.gameFlags === "object") {
        // Clear existing keys? No, merge is safer, but snapshot usually overrides.
        // Original code used Object.assign. But deeper merging might be needed for townProgress?
        // Original code: Object.assign(gameFlags, snapshot.gameFlags).
        // Note: townProgress is inside gameFlags. 
        // If we want to replace it completely, we rely on snapshot having complete state.
        Object.assign(gameFlags, snapshot.gameFlags);
    }

    // Restore Player Stats
    if (snapshot.playerStats && typeof snapshot.playerStats === "object") {
        Object.assign(playerStats, snapshot.playerStats);
    }

    // Restore Inventory
    if (snapshot.playerInventory && typeof snapshot.playerInventory === "object") {
        for (const key of Object.keys(playerInventory)) {
            delete playerInventory[key];
        }
        Object.assign(playerInventory, snapshot.playerInventory);
    }

    if (playerEquipment && typeof playerEquipment === "object") {
        const nextEquipment = snapshot.playerEquipment && typeof snapshot.playerEquipment === "object"
            ? snapshot.playerEquipment
            : {};
        playerEquipment.head = typeof nextEquipment.head === "string" ? nextEquipment.head : null;
        playerEquipment.torso = typeof nextEquipment.torso === "string" ? nextEquipment.torso : null;
        playerEquipment.weapon = typeof nextEquipment.weapon === "string" ? nextEquipment.weapon : null;
        playerEquipment.shield = typeof nextEquipment.shield === "string" ? nextEquipment.shield : null;
        playerEquipment.legs = typeof nextEquipment.legs === "string" ? nextEquipment.legs : null;
        playerEquipment.feet = typeof nextEquipment.feet === "string" ? nextEquipment.feet : null;
    }

    if (objectiveState && snapshot.objectiveState && typeof snapshot.objectiveState === "object") {
        objectiveState.id = String(snapshot.objectiveState.id || "");
        objectiveState.text = String(snapshot.objectiveState.text || "");
        objectiveState.updatedAt = Number.isFinite(snapshot.objectiveState.updatedAt)
            ? snapshot.objectiveState.updatedAt
            : 0;
    }

    // Determine Game State
    const areaKind = worldService.getAreaKind(townId, areaId);
    const resolvedState = areaKind === AREA_KINDS.OVERWORLD
        ? GAME_STATES.OVERWORLD
        : GAME_STATES.INTERIOR;

    const newGameState = resolvedState;
    if (camera) camera.initialized = false;

    return {
        success: true,
        newWorldState: {
            townId,
            areaId,
            map: area.map,
            width: area.width,
            height: area.height
        },
        newGameState
    };
}

function resolveNearestWalkablePlayerPosition(rawX, rawY, map, mapW, mapH, npcs, areaId, collisionService) {
    const startTx = Math.floor((rawX + TILE * 0.5) / TILE);
    const startTy = Math.floor((rawY + TILE * 0.5) / TILE);
    const maxRadius = 10;

    for (let radius = 0; radius <= maxRadius; radius++) {
        for (let oy = -radius; oy <= radius; oy++) {
            for (let ox = -radius; ox <= radius; ox++) {
                if (Math.max(Math.abs(ox), Math.abs(oy)) !== radius) continue;

                const tx = startTx + ox;
                const ty = startTy + oy;
                if (tx < 0 || ty < 0 || tx >= mapW || ty >= mapH) continue;

                const candidateX = tx * TILE;
                const candidateY = ty * TILE;
                if (collisionService.collides(candidateX, candidateY, map, mapW, mapH)) continue;
                if (collisionService.collidesWithNPC(candidateX, candidateY, npcs, areaId)) continue; // areaId from context? townId?
                // Note: collidesWithNPC expects areaId. In original code it used `currentAreaId`.
                // Here we pass areaId.

                return { x: candidateX, y: candidateY };
            }
        }
    }

    return { x: rawX, y: rawY }; // Fallback
}
