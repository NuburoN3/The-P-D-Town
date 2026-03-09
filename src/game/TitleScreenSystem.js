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
    const CONTINUE_OPTIONS = Object.freeze(["Continue", "Start Journey", "How To Play"]);
    const NEW_GAME_OPTIONS = Object.freeze(["Start Journey", "How To Play"]);
    const state = {
        startedAt: performance.now(),
        selected: 0,
        hovered: -1,
        pointerNavigation: false,
        controlPickerFocused: false,
        controlPickerIndex: 0,
        options: [...CONTINUE_OPTIONS],
        hasContinueSave: true,
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
        state.pointerNavigation = true;

        const controlChoice = getControlChoiceAtPosition(mouseX, mouseY);
        if (controlChoice) {
            const nextIndex = controlChoice === "controller" ? 1 : 0;
            const changed = !state.controlPickerFocused || state.controlPickerIndex !== nextIndex;
            state.controlPickerFocused = true;
            state.controlPickerIndex = nextIndex;
            state.hovered = -1;
            return changed;
        }

        state.controlPickerFocused = false;

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
    function handleClick(mouseX, mouseY, { onStartGame, onContinueGame, onSelectControlMode }) {
        if (state.showHowTo) {
            // Close "How to Play" on click
            const helpW = Math.min(canvas.width - 120, 520);
            const helpH = 252;
            const helpX = Math.round((canvas.width - helpW) / 2);
            const helpY = Math.round((canvas.height - helpH) / 2);
            if (pointInRect(mouseX, mouseY, helpX, helpY, helpW, helpH)) {
                state.showHowTo = false;
                musicManager.playSfx("menuConfirm");
                return true;
            }
            return false;
        }

        const controlChoice = getControlChoiceAtPosition(mouseX, mouseY);
        if (controlChoice) {
            const isControllerChoice = controlChoice === "controller";
            state.controlPickerFocused = true;
            state.controlPickerIndex = isControllerChoice ? 1 : 0;
            if (typeof onSelectControlMode === "function") {
                onSelectControlMode(isControllerChoice);
            }
            musicManager.playSfx("menuConfirm");
            return true;
        }

        const hoverIndex = getTitleOptionIndexAtPosition(mouseX, mouseY);
        if (hoverIndex >= 0) {
            state.controlPickerFocused = false;
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

    function handleKeyDown(key, { onStartGame, onContinueGame, onSelectControlMode, getControllerInputEnabled }) {
        if (state.showHowTo) {
            if (key === "escape" || key === "enter" || key === "space" || key === " ") {
                state.showHowTo = false;
                musicManager.playSfx("menuConfirm");
            }
            return;
        }

        if (state.controlPickerFocused) {
            state.pointerNavigation = false;
            state.hovered = -1;
            if (key === "arrowleft" || key === "a") {
                if (state.controlPickerIndex > 0) {
                    state.controlPickerIndex -= 1;
                    musicManager.playSfx("menuMove");
                } else {
                    state.controlPickerFocused = false;
                    musicManager.playSfx("menuMove");
                }
                return;
            }
            if (key === "arrowright" || key === "d") {
                if (state.controlPickerIndex < 1) {
                    state.controlPickerIndex += 1;
                    musicManager.playSfx("menuMove");
                }
                return;
            }
            if (key === "enter" || key === "space" || key === " " || key === "e") {
                const selectController = state.controlPickerIndex === 1;
                if (typeof onSelectControlMode === "function") {
                    onSelectControlMode(selectController);
                }
                musicManager.playSfx("menuConfirm");
                return;
            }
            return;
        }

        if (key === "arrowright" || key === "d") {
            state.pointerNavigation = false;
            state.hovered = -1;
            state.controlPickerFocused = true;
            state.controlPickerIndex = typeof getControllerInputEnabled === "function" && getControllerInputEnabled()
                ? 1
                : 0;
            musicManager.playSfx("menuMove");
            return;
        }

        if (key === "arrowup" || key === "w") {
            state.pointerNavigation = false;
            state.hovered = -1;
            state.selected = (state.selected - 1 + state.options.length) % state.options.length;
            musicManager.playSfx("menuMove");
        } else if (key === "arrowdown" || key === "s") {
            state.pointerNavigation = false;
            state.hovered = -1;
            state.selected = (state.selected + 1) % state.options.length;
            musicManager.playSfx("menuMove");
        } else if (key === "enter" || key === "space" || key === " " || key === "e") {
            state.pointerNavigation = false;
            state.hovered = -1;
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

    function syncContinueAvailability(hasSave) {
        state.hasContinueSave = Boolean(hasSave);
        state.options = state.hasContinueSave ? [...CONTINUE_OPTIONS] : [...NEW_GAME_OPTIONS];
        if (state.options.length === 0) {
            state.options = [...NEW_GAME_OPTIONS];
        }
        state.selected = Math.max(0, Math.min(state.selected, state.options.length - 1));
        state.hovered = -1;
        state.pointerNavigation = false;
        state.controlPickerFocused = false;
        state.controlPickerIndex = 0;
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

        // If the preview world is smaller than the viewport, keep it centered.
        const targetX = worldW <= visibleW ? (worldW - visibleW) * 0.5 : clamp(baseX + driftX, minX, maxX);
        const targetY = worldH <= visibleH ? (worldH - visibleH) * 0.5 : clamp(baseY + driftY, minY, maxY);
        cam.x = targetX;
        cam.y = targetY;

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

    function getControlChoiceAtPosition(mouseX, mouseY) {
        const layout = getControlPickerLayout();
        const keyboardRect = layout.keyboardMouse;
        if (pointInRect(mouseX, mouseY, keyboardRect.x, keyboardRect.y, keyboardRect.w, keyboardRect.h)) {
            return "keyboardMouse";
        }
        const controllerRect = layout.controller;
        if (pointInRect(mouseX, mouseY, controllerRect.x, controllerRect.y, controllerRect.w, controllerRect.h)) {
            return "controller";
        }
        return "";
    }

    function getControlPickerLayout() {
        const panelX = 72;
        const panelW = 372;
        const boxW = 206;
        const boxH = 150;
        const gap = 28;
        const totalW = boxW * 2 + gap;
        const minX = panelX + panelW + 26;
        const maxX = Math.max(minX, canvas.width - totalW - 24);
        const preferredX = Math.round(canvas.width * 0.56);
        const baseX = Math.max(minX, Math.min(maxX, preferredX));
        const topY = Math.max(140, Math.round(canvas.height * 0.37));
        return {
            keyboardMouse: { x: baseX, y: topY, w: boxW, h: boxH },
            controller: { x: baseX + boxW + gap, y: topY, w: boxW, h: boxH }
        };
    }

    return {
        state,
        handleMouseMove,
        handleClick,
        handleKeyDown,
        update,
        syncContinueAvailability
    };
}
