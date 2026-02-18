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
 * @param {object} context.playerCurrency
 * @param {object} context.playerEquipment
 * @param {object} context.inventoryUiLayout
 * @param {object} context.leftoversState
 * @returns {object} The snapshot object
 */
export function buildGameSnapshot({
    townId,
    areaId,
    player,
    gameFlags,
    playerStats,
    playerInventory,
    playerCurrency,
    playerEquipment,
    inventoryUiLayout,
    leftoversState,
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
            mana: Number.isFinite(player.mana) ? player.mana : 10,
            maxMana: Number.isFinite(player.maxMana) ? player.maxMana : 10,
            manaRegenPerSecond: Number.isFinite(player.manaRegenPerSecond) ? player.manaRegenPerSecond : 0.65,
            skillSlots: Array.isArray(player.skillSlots)
                ? player.skillSlots.map((slot, index) => ({
                    slot: index + 1,
                    id: slot?.id || null,
                    name: String(slot?.name || ""),
                    manaCost: Number.isFinite(slot?.manaCost) ? Math.max(0, slot.manaCost) : 0,
                    cooldownMs: Number.isFinite(slot?.cooldownMs) ? Math.max(0, slot.cooldownMs) : 0,
                    lastUsedAt: Number.isFinite(slot?.lastUsedAt) ? slot.lastUsedAt : -Infinity
                }))
                : [],
            equippedAttackId: player.equippedAttackId || "lightSlash"
        },
        gameFlags: {
            ...gameFlags,
            townProgress: JSON.parse(JSON.stringify(gameFlags.townProgress || {})) // Deep copy
        },
        playerStats: { ...playerStats },
        playerInventory: { ...playerInventory },
        playerCurrency: {
            gold: Number.isFinite(playerCurrency?.gold) ? Math.max(0, Math.floor(playerCurrency.gold)) : 0,
            silver: Number.isFinite(playerCurrency?.silver) ? Math.max(0, Math.floor(playerCurrency.silver)) : 0
        },
        playerEquipment: { ...(playerEquipment || {}) },
        inventoryUiLayout: {
            inventoryPanelX: Number.isFinite(inventoryUiLayout?.inventoryPanelX) ? inventoryUiLayout.inventoryPanelX : null,
            inventoryPanelY: Number.isFinite(inventoryUiLayout?.inventoryPanelY) ? inventoryUiLayout.inventoryPanelY : null,
            equipmentPanelX: Number.isFinite(inventoryUiLayout?.equipmentPanelX) ? inventoryUiLayout.equipmentPanelX : null,
            equipmentPanelY: Number.isFinite(inventoryUiLayout?.equipmentPanelY) ? inventoryUiLayout.equipmentPanelY : null
        },
        leftoversState: {
            nextId: Number.isFinite(leftoversState?.nextId) ? Math.max(1, Math.floor(leftoversState.nextId)) : 1,
            entries: Array.isArray(leftoversState?.entries)
                ? leftoversState.entries
                    .map((entry) => ({
                        id: String(entry?.id || ""),
                        townId: String(entry?.townId || ""),
                        areaId: String(entry?.areaId || ""),
                        x: Number.isFinite(entry?.x) ? entry.x : 0,
                        y: Number.isFinite(entry?.y) ? entry.y : 0,
                        silver: Number.isFinite(entry?.silver) ? Math.max(0, Math.floor(entry.silver)) : 0,
                        gold: Number.isFinite(entry?.gold) ? Math.max(0, Math.floor(entry.gold)) : 0,
                        createdAt: Number.isFinite(entry?.createdAt) ? entry.createdAt : 0,
                        items: Array.isArray(entry?.items)
                            ? entry.items
                                .map((lootItem) => ({
                                    name: String(lootItem?.name || ""),
                                    amount: Number.isFinite(lootItem?.amount) ? Math.max(0, Math.floor(lootItem.amount)) : 0
                                }))
                                .filter((lootItem) => lootItem.name && lootItem.amount > 0)
                            : []
                    }))
                    .filter((entry) => entry.id && entry.townId && entry.areaId && (entry.gold > 0 || entry.silver > 0 || entry.items.length > 0))
                : []
        },
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
 * @param {object} context.playerCurrency
 * @param {object} context.playerEquipment
 * @param {object} context.inventoryUiLayout
 * @param {object} context.leftoversState
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
        playerCurrency,
        playerEquipment,
        inventoryUiLayout,
        leftoversState,
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
    player.maxMana = Number.isFinite(snapshot.player?.maxMana) ? Math.max(1, snapshot.player.maxMana) : (Number.isFinite(player.maxMana) ? player.maxMana : 10);
    player.mana = Number.isFinite(snapshot.player?.mana)
        ? Math.max(0, Math.min(player.maxMana, snapshot.player.mana))
        : (Number.isFinite(player.mana) ? player.mana : player.maxMana);
    player.manaRegenPerSecond = Number.isFinite(snapshot.player?.manaRegenPerSecond)
        ? Math.max(0, snapshot.player.manaRegenPerSecond)
        : (Number.isFinite(player.manaRegenPerSecond) ? player.manaRegenPerSecond : 0.65);
    if (Array.isArray(snapshot.player?.skillSlots)) {
        player.skillSlots = snapshot.player.skillSlots.map((slot, index) => ({
            slot: index + 1,
            id: slot?.id || null,
            name: String(slot?.name || ""),
            manaCost: Number.isFinite(slot?.manaCost) ? Math.max(0, slot.manaCost) : 0,
            cooldownMs: Number.isFinite(slot?.cooldownMs) ? Math.max(0, slot.cooldownMs) : 0,
            lastUsedAt: Number.isFinite(slot?.lastUsedAt) ? slot.lastUsedAt : -Infinity
        }));
    }
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

    if (playerCurrency && typeof playerCurrency === "object") {
        const nextCurrency = snapshot.playerCurrency && typeof snapshot.playerCurrency === "object"
            ? snapshot.playerCurrency
            : {};
        const safeGold = Number.isFinite(nextCurrency.gold) ? Math.max(0, Math.floor(nextCurrency.gold)) : 0;
        const safeSilver = Number.isFinite(nextCurrency.silver) ? Math.max(0, Math.floor(nextCurrency.silver)) : 0;
        playerCurrency.gold = safeGold + Math.floor(safeSilver / 100);
        playerCurrency.silver = safeSilver % 100;
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

    if (inventoryUiLayout && typeof inventoryUiLayout === "object") {
        const nextLayout = snapshot.inventoryUiLayout && typeof snapshot.inventoryUiLayout === "object"
            ? snapshot.inventoryUiLayout
            : {};
        inventoryUiLayout.inventoryPanelX = Number.isFinite(nextLayout.inventoryPanelX) ? nextLayout.inventoryPanelX : null;
        inventoryUiLayout.inventoryPanelY = Number.isFinite(nextLayout.inventoryPanelY) ? nextLayout.inventoryPanelY : null;
        inventoryUiLayout.equipmentPanelX = Number.isFinite(nextLayout.equipmentPanelX) ? nextLayout.equipmentPanelX : null;
        inventoryUiLayout.equipmentPanelY = Number.isFinite(nextLayout.equipmentPanelY) ? nextLayout.equipmentPanelY : null;
    }

    if (leftoversState && typeof leftoversState === "object") {
        const snapshotLeftovers = snapshot.leftoversState && typeof snapshot.leftoversState === "object"
            ? snapshot.leftoversState
            : {};
        const nextId = Number.isFinite(snapshotLeftovers.nextId) ? Math.max(1, Math.floor(snapshotLeftovers.nextId)) : 1;
        const entries = Array.isArray(snapshotLeftovers.entries) ? snapshotLeftovers.entries : [];
        leftoversState.nextId = nextId;
        leftoversState.entries = entries
            .map((entry) => ({
                id: String(entry?.id || ""),
                townId: String(entry?.townId || ""),
                areaId: String(entry?.areaId || ""),
                x: Number.isFinite(entry?.x) ? entry.x : 0,
                y: Number.isFinite(entry?.y) ? entry.y : 0,
                silver: Number.isFinite(entry?.silver) ? Math.max(0, Math.floor(entry.silver)) : 0,
                gold: Number.isFinite(entry?.gold) ? Math.max(0, Math.floor(entry.gold)) : 0,
                createdAt: Number.isFinite(entry?.createdAt) ? entry.createdAt : 0,
                items: Array.isArray(entry?.items)
                    ? entry.items
                        .map((lootItem) => ({
                            name: String(lootItem?.name || ""),
                            amount: Number.isFinite(lootItem?.amount) ? Math.max(0, Math.floor(lootItem.amount)) : 0
                        }))
                        .filter((lootItem) => lootItem.name && lootItem.amount > 0)
                    : []
            }))
            .filter((entry) => entry.id && entry.townId && entry.areaId && (entry.gold > 0 || entry.silver > 0 || entry.items.length > 0));
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
