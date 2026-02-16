import { isFreeExploreState } from "../core/constants.js";

const FOUNTAIN_HEAL_PER_TICK = 2;
const FOUNTAIN_HEAL_INTERVAL_MS = 260;
const FOUNTAIN_HEAL_VFX_INTERVAL_MS = 760;

/**
 * Self-contained system for healing the player while standing in fountain water.
 * @param {object} deps
 * @param {number} deps.tileSize
 * @param {object} deps.worldService
 * @param {object} deps.vfxSystem
 */
export function createFountainHealingSystem({ tileSize, worldService, vfxSystem }) {
    const state = {
        inWater: false,
        nextHealAt: 0,
        nextVfxAt: 0
    };

    function update({ now, gameState, doorSequenceActive, player, currentTownId, currentAreaId }) {
        if (!isFreeExploreState(gameState) || doorSequenceActive) {
            state.inWater = false;
            return;
        }

        const centerX = player.x + tileSize * 0.5;
        const centerY = player.y + tileSize * 0.5;
        const tileX = Math.floor(centerX / tileSize);
        const tileY = Math.floor(centerY / tileSize);
        const inFountainWater = worldService.isFountainWaterTile(currentTownId, currentAreaId, tileX, tileY);

        if (!inFountainWater) {
            state.inWater = false;
            return;
        }

        if (!state.inWater) {
            state.inWater = true;
            state.nextHealAt = now;
        }

        if (player.hp >= player.maxHp || now < state.nextHealAt) return;

        const healAmount = Math.min(FOUNTAIN_HEAL_PER_TICK, player.maxHp - player.hp);
        if (healAmount <= 0) return;

        player.hp += healAmount;
        state.nextHealAt = now + FOUNTAIN_HEAL_INTERVAL_MS;

        if (now >= state.nextVfxAt) {
            vfxSystem.spawn("damageText", {
                x: player.x + tileSize * 0.5,
                y: player.y + tileSize * 0.2,
                text: `+${Math.round(healAmount)}`,
                color: "rgba(171, 238, 255, 0.96)"
            });
            state.nextVfxAt = now + FOUNTAIN_HEAL_VFX_INTERVAL_MS;
        }
    }

    return { update };
}
