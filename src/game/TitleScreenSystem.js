import { clamp, pointInRect } from "../core/mathUtils.js";
import { GAME_STATES } from "../core/constants.js";

/**
 * TitleScreenSystem — manages title screen state, camera drift, and menu interactions.
 *
 * @param {object} deps
 * @param {number} deps.tileSize
 * @param {object} deps.cameraZoom
 * @param {object} deps.musicManager
 * @param {object} deps.canvas
 */
export function createTitleScreenSystem({ tileSize, cameraZoom, musicManager, canvas }) {
    const state = {
        startedAt: performance.now(),
        selected: 0,
        hovered: -1,
        options: ["Continue", "Start Journey", "How To Play"],
        showHowTo: false,
        fadeOutActive: false,
        fadeOutStartedAt: 0,
        fadeOutDurationMs: 720,
        promptPulseOffset: Math.random() * 1000
    };

    /**
     * Handle mouse movement on the title screen.
     * @returns {boolean} true if hover changed
     */
    function handleMouseMove(mouseX, mouseY) {
        if (state.showHowTo) return false;

        const hoverIndex = getTitleOptionIndexAtPosition(mouseX, mouseY);
        if (hoverIndex !== state.hovered) {
            state.hovered = hoverIndex;
            if (hoverIndex >= 0) {
                state.selected = hoverIndex;
            }
            return true;
        }
        return false;
    }

    /**
     * Handle mouse click on the title screen.
     * @param {object} callbacks - { onStartGame, onContinueGame }
     * @returns {boolean} true if click was handled
     */
    function handleClick(mouseX, mouseY, { onStartGame, onContinueGame }) {
        if (state.showHowTo) {
            // Close "How to Play" on click
            const helpW = Math.min(canvas.width - 120, 520);
            const helpH = 236;
            const helpX = Math.round((canvas.width - helpW) / 2);
            const helpY = Math.round((canvas.height - helpH) / 2);
            if (pointInRect(mouseX, mouseY, helpX, helpY, helpW, helpH)) {
                state.showHowTo = false;
                musicManager.playSfx("menuConfirm");
                return true;
            }
            return false;
        }

        const hoverIndex = getTitleOptionIndexAtPosition(mouseX, mouseY);
        if (hoverIndex >= 0) {
            if (state.selected !== hoverIndex) {
                state.selected = hoverIndex;
                musicManager.playSfx("menuMove");
            }
            state.hovered = hoverIndex;
            confirmSelection({ onStartGame, onContinueGame });
            return true;
        }
        return false;
    }

    function handleKeyDown(key, { onStartGame, onContinueGame }) {
        if (state.showHowTo) {
            if (key === "escape" || key === "enter" || key === " ") {
                state.showHowTo = false;
                musicManager.playSfx("menuConfirm");
            }
            return;
        }

        if (key === "arrowup" || key === "w") {
            state.selected = (state.selected - 1 + state.options.length) % state.options.length;
            musicManager.playSfx("menuMove");
        } else if (key === "arrowdown" || key === "s") {
            state.selected = (state.selected + 1) % state.options.length;
            musicManager.playSfx("menuMove");
        } else if (key === "enter" || key === " " || key === "e") {
            confirmSelection({ onStartGame, onContinueGame });
        }
    }

    function confirmSelection({ onStartGame, onContinueGame }) {
        const option = state.options[state.selected];
        if (option === "How To Play") {
            state.showHowTo = true;
            musicManager.playSfx("menuConfirm");
        } else if (option === "Start Journey") {
            musicManager.playSfx("menuStart");
            state.fadeOutActive = true;
            state.fadeOutStartedAt = performance.now();
            onStartGame(); // Trigger fade out start logic if needed
        } else if (option === "Continue") {
            musicManager.playSfx("loadGame");
            onContinueGame();
        }
    }

    function update(now, { player, cam, currentMapW, currentMapH, onFadeOutComplete }) {
        // Camera drift
        const worldW = currentMapW * tileSize;
        const worldH = currentMapH * tileSize;
        const visibleW = canvas.width / cameraZoom;
        const visibleH = canvas.height / cameraZoom;

        const baseX = player.x - visibleW * 0.5;
        const baseY = player.y - visibleH * 0.5;
        const seconds = (now - state.startedAt) / 1000;
        const driftX = Math.sin(seconds * 0.33) * tileSize * 2.4;
        const driftY = Math.cos(seconds * 0.27) * tileSize * 1.6;

        const minX = Math.min(0, worldW - visibleW);
        const maxX = Math.max(0, worldW - visibleW);
        const minY = Math.min(0, worldH - visibleH);
        const maxY = Math.max(0, worldH - visibleH);

        cam.x = clamp(baseX + driftX, minX, maxX);
        cam.y = clamp(baseY + driftY, minY, maxY);

        // Fade out logic
        if (state.fadeOutActive) {
            const elapsed = now - state.fadeOutStartedAt;
            if (elapsed >= state.fadeOutDurationMs) {
                state.fadeOutActive = false;
                onFadeOutComplete();
            }
        }
    }

    // --- Internals ---

    function getTitleOptionIndexAtPosition(mouseX, mouseY) {
        const panelX = 72;
        const optionCount = state.options.length;
        const panelH = Math.max(188, 144 + Math.max(0, optionCount - 1) * 38);
        const panelY = canvas.height - (panelH + 70);
        const panelW = 372;

        for (let i = 0; i < optionCount; i++) {
            const y = panelY + 64 + i * 38;
            const rowX = panelX + 14;
            const rowY = y - 20;
            const rowW = panelW - 28;
            const rowH = 28;
            if (pointInRect(mouseX, mouseY, rowX, rowY, rowW, rowH)) return i;
        }
        return -1;
    }

    return {
        state,
        handleMouseMove,
        handleClick,
        handleKeyDown,
        update
    };
}
