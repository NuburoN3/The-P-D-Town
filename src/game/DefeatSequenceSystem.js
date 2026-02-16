import { AREA_KINDS, GAME_STATES } from "../core/constants.js";

/**
 * DefeatSequenceSystem — manages the multi-phase player-defeat animation.
 *
 * @param {object} deps
 * @param {number} deps.tileSize
 * @param {object} deps.vfxSystem
 * @param {Function} deps.getRespawnDestination  (townId) => destination
 * @param {object} deps.worldService
 */
export function createDefeatSequenceSystem({ tileSize, vfxSystem, getRespawnDestination, worldService }) {
    /**
     * Start the defeat sequence for a player.
     * @param {object} ctx  live game state refs
     */
    function handlePlayerDefeated({
        playerDefeatSequence,
        player: defeatedPlayer,
        dialogue,
        input,
        currentTownId,
        setGameState
    }) {
        if (playerDefeatSequence.active) return;

        dialogue.close();
        input.clearAttackPressed();
        input.clearInteractPressed();

        defeatedPlayer.walking = false;
        defeatedPlayer.isTraining = false;
        defeatedPlayer.attackState = "idle";
        defeatedPlayer.activeAttackId = null;
        defeatedPlayer.requestedAttackId = null;

        setGameState(GAME_STATES.PLAYER_DEFEATED);
        playerDefeatSequence.active = true;
        playerDefeatSequence.phase = "fall";
        playerDefeatSequence.phaseStartedAt = performance.now();
        playerDefeatSequence.fallProgress = 0;
        playerDefeatSequence.overlayAlpha = 0;
        playerDefeatSequence.destination = getRespawnDestination(currentTownId);
    }

    function finishDefeatSequence(now, { playerDefeatSequence, player, gameController, currentTownId }) {
        const destination = playerDefeatSequence.destination || getRespawnDestination(currentTownId);

        if (gameController && typeof gameController.setArea === "function") {
            gameController.setArea(destination.townId, destination.areaId);
        }

        player.x = destination.x;
        player.y = destination.y;
        player.dir = destination.dir || "up";
        player.hp = player.maxHp;
        player.walking = false;
        player.isTraining = false;
        player.attackState = "idle";
        player.activeAttackId = null;
        player.requestedAttackId = null;
        player.invulnerableUntil = now + 1200;

        vfxSystem.spawn("doorSwirl", {
            x: player.x + tileSize / 2,
            y: player.y + tileSize / 2,
            size: 30,
            durationMs: 500
        });
    }

    /**
     * Tick the defeat sequence state machine.
     * @param {number} now
     * @param {object} ctx  live game state refs
     */
    function update(now, ctx) {
        const { playerDefeatSequence, currentTownId, currentAreaId } = ctx;
        if (!playerDefeatSequence.active) return;

        const elapsed = now - playerDefeatSequence.phaseStartedAt;

        if (playerDefeatSequence.phase === "fall") {
            playerDefeatSequence.fallProgress = Math.max(
                0,
                Math.min(1, elapsed / Math.max(1, playerDefeatSequence.fallDurationMs))
            );
            playerDefeatSequence.overlayAlpha = 0;
            if (elapsed >= playerDefeatSequence.fallDurationMs) {
                playerDefeatSequence.phase = "fadeOut";
                playerDefeatSequence.phaseStartedAt = now;
                playerDefeatSequence.fallProgress = 1;
            }
            return;
        }

        if (playerDefeatSequence.phase === "fadeOut") {
            playerDefeatSequence.overlayAlpha = Math.max(
                0,
                Math.min(1, elapsed / Math.max(1, playerDefeatSequence.fadeOutDurationMs))
            );
            if (elapsed >= playerDefeatSequence.fadeOutDurationMs) {
                finishDefeatSequence(now, ctx);
                playerDefeatSequence.phase = "hold";
                playerDefeatSequence.phaseStartedAt = now;
                playerDefeatSequence.overlayAlpha = 1;
            }
            return;
        }

        if (playerDefeatSequence.phase === "hold") {
            playerDefeatSequence.overlayAlpha = 1;
            if (elapsed >= playerDefeatSequence.blackoutHoldMs) {
                playerDefeatSequence.phase = "fadeIn";
                playerDefeatSequence.phaseStartedAt = now;
            }
            return;
        }

        if (playerDefeatSequence.phase === "fadeIn") {
            const fadeInRatio = Math.max(
                0,
                Math.min(1, elapsed / Math.max(1, playerDefeatSequence.fadeInDurationMs))
            );
            playerDefeatSequence.overlayAlpha = 1 - fadeInRatio;

            if (elapsed >= playerDefeatSequence.fadeInDurationMs) {
                playerDefeatSequence.active = false;
                playerDefeatSequence.phase = "idle";
                playerDefeatSequence.fallProgress = 0;
                playerDefeatSequence.overlayAlpha = 0;
                playerDefeatSequence.destination = null;

                const areaKind = worldService.getAreaKind(currentTownId, currentAreaId);
                const newState = areaKind === AREA_KINDS.OVERWORLD
                    ? GAME_STATES.OVERWORLD
                    : GAME_STATES.INTERIOR;
                ctx.setGameState(newState);
                ctx.setPreviousWorldState(newState);
                ctx.setPreviousGameState(newState);
            }
        }
    }

    return { handlePlayerDefeated, update };
}
