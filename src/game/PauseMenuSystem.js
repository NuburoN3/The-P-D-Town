import { pointInRect } from "../core/mathUtils.js";
import { GAME_STATES } from "../core/constants.js";
import { InputManager } from "../core/InputManager.js";

/**
 * PauseMenuSystem — manages pause menu state, settings UI, and menu navigation.
 *
 * @param {object} deps
 * @param {object} deps.musicManager
 * @param {object} deps.canvas
 * @param {Array} deps.settingsItems
 * @param {object} deps.userSettings
 * @param {Function} deps.loadUserSettings
 * @param {Function} deps.persistUserSettings
 * @param {Function} deps.setSettingsStatus
 */
export function createPauseMenuSystem({
    musicManager,
    canvas,
    settingsItems,
    userSettings,
    loadUserSettings,
    persistUserSettings
}) {
    const state = {
        active: false,
        selected: 0,
        hovered: -1,
        visibility: 0,
        options: ["Resume", "Inventory", "Attributes", "Save Game", "Load Game", "Settings", "Quit"],

        // Settings sub-menu state
        settingsUiState: {
            selected: 0,
            awaitingRebindAction: null,
            statusText: "",
            statusUntil: 0
        },
        mode: "main" // "main" or "settings"
    };

    function setSettingsStatus(msg, duration = Infinity) {
        state.settingsUiState.statusText = msg;
        state.settingsUiState.statusUntil = Number.isFinite(duration) ? performance.now() + duration : Infinity;
    }

    const options = state.options;

    function open() {
        state.active = true;
        state.mode = "main";
        state.selected = 0;
        state.visibility = 0; // Will animate in
        musicManager.playSfx("menuOpen");
    }

    function close() {
        state.active = false;
        state.mode = "main";
        state.selected = 0;
        state.hovered = -1;
        musicManager.playSfx("menuClose");
    }

    function update(dtScale) {
        if (state.active) {
            state.visibility = Math.min(1, state.visibility + 0.14 * dtScale);
        } else {
            state.visibility = Math.max(0, state.visibility - 0.18 * dtScale);
        }

        // Settings status fade out
        const now = performance.now();
        if (
            state.settingsUiState.statusText &&
            Number.isFinite(state.settingsUiState.statusUntil) &&
            now >= state.settingsUiState.statusUntil
        ) {
            state.settingsUiState.statusText = "";
        }
    }

    function handleKeyDown(key, { onResume, onInventory, onAttributes, onSave, onLoad, onSettings, onBackToPause, onQuit, inputManager }) {
        if (state.mode === "settings") {
            handleSettingsKeyDown(key, inputManager, onBackToPause);
            return;
        }

        if (
            key === "arrowup" ||
            key === "w" ||
            key === "arrowdown" ||
            key === "s" ||
            key === "enter" ||
            key === "space" ||
            key === " " ||
            key === "escape" ||
            inputManager.matchesActionKey("pause", key)
        ) {
            state.hovered = -1;
        }

        if (key === "escape" || inputManager.matchesActionKey("pause", key)) {
            onResume();
            return;
        }

        if (key === "arrowup" || key === "w") {
            state.selected = (state.selected - 1 + options.length) % options.length;
            musicManager.playSfx("menuMove");
        } else if (key === "arrowdown" || key === "s") {
            state.selected = (state.selected + 1) % options.length;
            musicManager.playSfx("menuMove");
        } else if (key === "enter" || key === "space") {
            selectOption({ onResume, onInventory, onAttributes, onSave, onLoad, onSettings, onQuit });
        }
    }

    function getSettingsListLayout() {
        const boxW = Math.min(canvas.width - 60, 690);
        const boxH = Math.min(canvas.height - 60, 470);
        const boxX = (canvas.width - boxW) / 2;
        const boxY = (canvas.height - boxH) / 2;
        const listX = boxX + 24;
        const listY = boxY + 76;
        const rowH = 28;
        const itemCount = settingsItems.length;
        const visibleRows = Math.max(8, Math.floor((boxH - 170) / rowH));
        const selected = Number.isFinite(state.settingsUiState.selected) ? state.settingsUiState.selected : 0;
        const scrollStart = Math.max(0, Math.min(selected - Math.floor(visibleRows / 2), Math.max(0, itemCount - visibleRows)));
        const visibleEnd = Math.min(itemCount, scrollStart + visibleRows);
        return {
            boxX,
            boxY,
            boxW,
            boxH,
            listX,
            listY,
            rowH,
            itemCount,
            visibleRows,
            scrollStart,
            visibleEnd
        };
    }

    function getSettingsIndexAtPosition(mouseX, mouseY) {
        const layout = getSettingsListLayout();
        const {
            listX,
            listY,
            rowH,
            boxW,
            scrollStart,
            visibleEnd
        } = layout;
        const rowW = boxW - 48;

        for (let i = scrollStart; i < visibleEnd; i++) {
            const rowY = listY + (i - scrollStart) * rowH - 18;
            const rowHHit = 24;
            if (pointInRect(mouseX, mouseY, listX - 8, rowY, rowW, rowHHit)) {
                return i;
            }
        }
        return -1;
    }

    function handleSettingsKeyDown(key, inputManager, onBackToPause) {
        if (state.settingsUiState.awaitingRebindAction) {
            handleRebindKey(key, inputManager);
            return;
        }

        if (key === "escape" || inputManager.matchesActionKey("pause", key)) {
            // Return to main pause menu
            state.mode = "main";
            musicManager.playSfx("menuClose");
            if (typeof onBackToPause === "function") {
                onBackToPause();
            }
            return;
        }

        const itemCount = settingsItems.length;
        if (key === "arrowup" || key === "w") {
            state.settingsUiState.selected = (state.settingsUiState.selected - 1 + itemCount) % itemCount;
            musicManager.playSfx("menuMove");
        } else if (key === "arrowdown" || key === "s") {
            state.settingsUiState.selected = (state.settingsUiState.selected + 1) % itemCount;
            musicManager.playSfx("menuMove");
        } else if (key === "enter" || key === "space") {
            activateSettingsItem(inputManager);
        }
    }

    function activateSettingsItem(inputManager) {
        const item = settingsItems[state.settingsUiState.selected];
        if (!item) return;

        if (item.kind === "toggle") {
            const newVal = !userSettings[item.id];
            userSettings[item.id] = newVal;
            persistUserSettings();
            musicManager.playSfx(newVal ? "menuConfirm" : "menuBack");
            // Special handling for some settings if needed immediately (e.g. highContrastMenu handled in render)
        } else if (item.kind === "action") {
            if (item.action === "save") persistUserSettings();
        } else if (item.kind === "rebind") {
            state.settingsUiState.awaitingRebindAction = item.action;
            setSettingsStatus("Press any key to rebind...", 5000);
            musicManager.playSfx("menuConfirm");
        }
    }

    function selectOption({ onResume, onInventory, onAttributes, onSave, onLoad, onSettings, onQuit }) {
        const option = options[state.selected];
        if (option === "Resume") {
            onResume();
        } else if (option === "Inventory") {
            onInventory();
        } else if (option === "Attributes") {
            onAttributes();
        } else if (option === "Save Game") {
            onSave();
        } else if (option === "Load Game") {
            onLoad();
        } else if (option === "Settings") {
            state.mode = "settings";
            state.settingsUiState.selected = 0;
            musicManager.playSfx("menuConfirm");
            if (typeof onSettings === "function") {
                onSettings();
            }
        } else if (option === "Quit") {
            onQuit();
        }
    }

    function handleMouseMove(mouseX, mouseY) {
        if (state.mode === "settings") {
            const hoveredSettingsIndex = getSettingsIndexAtPosition(mouseX, mouseY);

            if (
                hoveredSettingsIndex >= 0 &&
                hoveredSettingsIndex !== state.settingsUiState.selected
            ) {
                state.settingsUiState.selected = hoveredSettingsIndex;
                musicManager.playSfx("menuMove");
            }
            return;
        }

        const menuW = 340;
        const optionStartY = 106;
        const optionStep = 46;
        const minMenuH = 392;
        const requiredMenuH = optionStartY + Math.max(0, options.length - 1) * optionStep + 120;
        const menuH = Math.max(minMenuH, requiredMenuH);
        const slideOffset = (1 - Math.max(0, Math.min(1, state.visibility))) * 34;
        const menuX = canvas.width - menuW - 24 + slideOffset;
        const menuY = (canvas.height - menuH) / 2;

        let hovered = -1;
        for (let i = 0; i < options.length; i++) {
            const optionY = menuY + optionStartY + i * optionStep;
            const rowX = menuX + 24;
            const rowY = optionY - 23;
            const rowW = menuW - 48;
            const rowH = 44;
            if (pointInRect(mouseX, mouseY, rowX, rowY, rowW, rowH)) {
                hovered = i;
                break;
            }
        }

        if (hovered !== state.hovered) {
            state.hovered = hovered;
            if (hovered >= 0) {
                state.selected = hovered;
            }
        }
    }

    function handleClick(mouseX, mouseY, callbacks, inputManager = null) {
        if (state.mode === "settings") {
            const hoveredSettingsIndex = getSettingsIndexAtPosition(mouseX, mouseY);
            if (hoveredSettingsIndex < 0) return false;
            if (hoveredSettingsIndex !== state.settingsUiState.selected) {
                state.settingsUiState.selected = hoveredSettingsIndex;
                musicManager.playSfx("menuMove");
            }
            activateSettingsItem(inputManager);
            return true;
        }

        handleMouseMove(mouseX, mouseY);
        if (state.hovered >= 0) {
            selectOption(callbacks);
            return true;
        }
        return false;
    }

    function handleSettingsWheel(deltaY) {
        if (state.mode !== "settings") return false;
        if (!Number.isFinite(deltaY) || deltaY === 0) return false;
        const itemCount = settingsItems.length;
        if (itemCount <= 0) return false;
        const previous = state.settingsUiState.selected;
        if (deltaY > 0) {
            state.settingsUiState.selected = Math.min(itemCount - 1, state.settingsUiState.selected + 1);
        } else {
            state.settingsUiState.selected = Math.max(0, state.settingsUiState.selected - 1);
        }
        if (state.settingsUiState.selected !== previous) {
            musicManager.playSfx("menuMove");
            return true;
        }
        return false;
    }

    function handleRebindKey(key, inputManager) {
        if (key === "escape") {
            state.settingsUiState.awaitingRebindAction = null;
            setSettingsStatus("Rebind cancelled.", 1200);
            musicManager.playSfx("menuConfirm");
            return;
        }

        const result = inputManager.setPrimaryBinding(state.settingsUiState.awaitingRebindAction, key);
        if (result.ok) {
            persistUserSettings();
            const bindingName = InputManager.toDisplayKeyName(inputManager.getPrimaryBinding(state.settingsUiState.awaitingRebindAction));
            setSettingsStatus(`Bound to ${bindingName}.`, 1300);
            musicManager.playSfx("menuConfirm");
        } else if (result.reason === "primary-conflict") {
            musicManager.playSfx("uiError");
            setSettingsStatus("Key already used by another action.", 1700);
        } else {
            musicManager.playSfx("uiError");
            setSettingsStatus("Invalid key.", 1700);
        }
        state.settingsUiState.awaitingRebindAction = null;
    }

    return {
        state,
        open,
        close,
        update,
        handleKeyDown,
        handleMouseMove,
        handleClick,
        handleSettingsWheel,
        setStatus: setSettingsStatus
    };
}
