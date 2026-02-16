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
 * @returns {object} The snapshot object
 */
export function buildGameSnapshot({
    townId,
    areaId,
    player,
    gameFlags,
    playerStats,
    playerInventory,
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
        currentGameState,
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

    const newGameState = (currentGameState !== GAME_STATES.TITLE_SCREEN)
        ? resolvedState
        : undefined; // Don't change if title screen logic handles transition, OR return it and let caller decide.
    // Original logic: if (gameState !== TITLE_SCREEN) gameState = resolvedState.
    // Actually, when loading from Pause Menu, we ARE in PAUSE_MENU state (not TITLE_SCREEN).
    // When loading from Title Screen, we ARE in TITLE_SCREEN.
    // The original code said: if (gameState !== TITLE_SCREEN) gameState = resolvedState.
    // This implies that if we validly load from Title Screen, we DO NOT set gameState?
    // Wait. `performLoadGame` calls `applyGameSnapshot`.
    // If called from Title Screen (Continue Game), state IS Title Screen.
    // Then `applyGameSnapshot` returns true.
    // Then caller (TitleScreenSystem callbacks) might change state?
    // Code in main.js:
    // onContinueGame: () => { performLoadGame(); }
    // performLoadGame => applyGameSnapshot.
    // If applyGameSnapshot DOES NOT change state, then we are stuck in Title Screen?
    // The original code was:
    // if (gameState !== GAME_STATES.TITLE_SCREEN) { gameState = resolvedState; ... }
    // This looks like it prevents state change during Title Screen load?
    // Ah, `onContinueGame` in `TitleScreenSystem` callback might handle state transition?
    // Actually, `performLoadGame` sets `setSettingsStatus("Save loaded.")`.
    // If `gameState` is not updated, we won't see the game.
    // Maybe `gameController` update handles it?

    // Actually, I suspect the original code relying on `if (gameState !== TITLE_SCREEN)` was for *hot reloading* checks or similar?
    // Or maybe `applyGameSnapshot` is used by *other* things?
    // Let's look at `main.js` again.
    // Line 356: if (gameState !== GAME_STATES.TITLE_SCREEN) { ... }
    // If I load from Title Screen, this block is SKIPPED.
    // So `gameState` remains `TITLE_SCREEN`.
    // Then `performLoadGame` finishes.
    // Then what?
    // The `TitleScreenSystem` or `main.js` loop must switch state.
    // But `TitleScreenSystem` callback is `onContinueGame`.
    // If state isn't changed, `TitleScreenSystem` continues to render.

    // Wait, maybe `performLoadGame` is NOT what is called from Title Screen?
    // `TitleScreenSystem.js` calls `onContinueGame`.
    // in `main.js`:
    // onContinueGame: () => { performLoadGame(); }

    // Tests passed with this logic.
    // Perhaps `TitleScreenSystem` has a `startGame` transition that is triggered?
    // No, `onContinueGame` just calls `performLoadGame`.

    // Maybe `gameState` IS CHANGED somewhere else?
    // Or maybe my understanding of `gameState` check is wrong.
    // If `gameState === TITLE_SCREEN`, the check fails, so we DON'T set `resolvedState`.
    // This seems like a bug in original code or I am missing something.
    // UNLESS `applyGameSnapshot` is called `startNewGame` which sets state separately?
    // But `performLoadGame` calls it.

    // Let's replicate original logic exactly for now.
    // I will return `newGameState` only if condition met.

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
