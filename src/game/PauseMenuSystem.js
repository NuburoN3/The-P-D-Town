import { pointInRect } from "../core/mathUtils.js";
import { InputManager } from "../core/InputManager.js";
import { DEFAULT_USER_SETTINGS } from "../core/Persistence.js";

function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
}

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
        mode: "main", // "main" or "settings"
        soundControls: {
            musicVolume: clamp01(userSettings.musicVolume),
            sfxVolume: clamp01(userSettings.sfxVolume),
            hoveredSlider: "",
            hoveredButton: "",
            draggingSlider: "",
            pendingPersist: false,
            lastSfxPreviewAt: 0,
            controllerFocusPause: "menu",
            controllerFocusTitle: "sound",
            controllerSelectedPause: "music",
            controllerSelectedTitle: "music"
        }
    };

    if (typeof musicManager.setBgmVolume === "function") {
        musicManager.setBgmVolume(state.soundControls.musicVolume, { fadeMs: 0 });
    }
    if (typeof musicManager.setSfxVolume === "function") {
        musicManager.setSfxVolume(state.soundControls.sfxVolume);
    }

    function setSettingsStatus(msg, duration = Infinity) {
        state.settingsUiState.statusText = msg;
        state.settingsUiState.statusUntil = Number.isFinite(duration) ? performance.now() + duration : Infinity;
    }

    const options = state.options;

    function open() {
        state.active = true;
        state.mode = "main";
        state.selected = 0;
        state.soundControls.draggingSlider = "";
        state.soundControls.hoveredSlider = "";
        state.soundControls.hoveredButton = "";
        state.soundControls.pendingPersist = false;
        state.soundControls.controllerFocusPause = "menu";
        state.visibility = 0; // Will animate in
        musicManager.playSfx("menuOpen");
    }

    function close() {
        state.active = false;
        state.mode = "main";
        state.selected = 0;
        state.hovered = -1;
        state.soundControls.draggingSlider = "";
        state.soundControls.hoveredSlider = "";
        state.soundControls.hoveredButton = "";
        state.soundControls.pendingPersist = false;
        state.soundControls.controllerFocusPause = "menu";
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
            setControllerFocusArea("pause", "menu");
            state.soundControls.hoveredSlider = "";
            state.soundControls.hoveredButton = "";
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

    function getPauseMenuLayout() {
        const menuW = 340;
        const optionStartY = 106;
        const optionStep = 46;
        const minMenuH = 392;
        const requiredMenuH = optionStartY + Math.max(0, options.length - 1) * optionStep + 120;
        const menuH = Math.max(minMenuH, requiredMenuH);
        const slideOffset = (1 - Math.max(0, Math.min(1, state.visibility))) * 34;
        const menuX = canvas.width - menuW - 24 + slideOffset;
        const soundBoxH = 148;
        const stackGap = 14;
        const stackH = soundBoxH + stackGap + menuH;
        const stackTop = Math.max(14, Math.round((canvas.height - stackH) * 0.5));
        const menuY = stackTop + soundBoxH + stackGap;
        return { menuW, menuH, menuX, menuY, optionStartY, optionStep };
    }

    function getSoundControlLayout() {
        const { menuW, menuX, menuY } = getPauseMenuLayout();
        const boxW = menuW;
        const boxH = 148;
        const boxX = menuX;
        const boxY = Math.max(14, menuY - boxH - 14);
        const sliderX = boxX + 118;
        const sliderW = boxW - 184;
        const resetButtonW = 144;
        const resetButtonH = 20;
        const resetButtonX = Math.round(boxX + (boxW - resetButtonW) * 0.5);
        const resetButtonY = boxY + 100;
        return {
            boxX,
            boxY,
            boxW,
            boxH,
            sliderX,
            sliderW,
            musicCenterY: boxY + 44,
            sfxCenterY: boxY + 78,
            rowHitH: 18,
            resetButtonX,
            resetButtonY,
            resetButtonW,
            resetButtonH
        };
    }

    function getTitleSoundControlLayout() {
        const boxW = 340;
        const boxH = 148;
        const boxX = canvas.width - boxW - 24;
        const boxY = 14;
        const sliderX = boxX + 118;
        const sliderW = boxW - 184;
        const resetButtonW = 144;
        const resetButtonH = 20;
        const resetButtonX = Math.round(boxX + (boxW - resetButtonW) * 0.5);
        const resetButtonY = boxY + 100;
        return {
            boxX,
            boxY,
            boxW,
            boxH,
            sliderX,
            sliderW,
            musicCenterY: boxY + 44,
            sfxCenterY: boxY + 78,
            rowHitH: 18,
            resetButtonX,
            resetButtonY,
            resetButtonW,
            resetButtonH
        };
    }

    function getSoundControlLayoutForMode(layoutMode = "pause") {
        if (layoutMode === "title") {
            return getTitleSoundControlLayout();
        }
        return getSoundControlLayout();
    }

    function getControllerSelectedSlider(layoutMode = "pause") {
        return layoutMode === "title"
            ? state.soundControls.controllerSelectedTitle
            : state.soundControls.controllerSelectedPause;
    }

    function getControllerFocusArea(layoutMode = "pause") {
        return layoutMode === "title"
            ? state.soundControls.controllerFocusTitle
            : state.soundControls.controllerFocusPause;
    }

    function setControllerFocusArea(layoutMode = "pause", focusArea = "sound") {
        const normalized = focusArea === "menu" ? "menu" : "sound";
        if (layoutMode === "title") {
            state.soundControls.controllerFocusTitle = normalized;
        } else {
            state.soundControls.controllerFocusPause = normalized;
        }
    }

    function setControllerSelectedSlider(layoutMode = "pause", sliderId = "music") {
        const normalized = sliderId === "sfx" || sliderId === "resetDefaults"
            ? sliderId
            : "music";
        if (layoutMode === "title") {
            state.soundControls.controllerSelectedTitle = normalized;
        } else {
            state.soundControls.controllerSelectedPause = normalized;
        }
        state.soundControls.hoveredSlider = normalized === "music" || normalized === "sfx"
            ? normalized
            : "";
        state.soundControls.hoveredButton = normalized === "resetDefaults"
            ? "resetDefaults"
            : "";
        setControllerFocusArea(layoutMode, "sound");
    }

    function getSliderValueForX(mouseX, sliderX, sliderW) {
        const denom = Math.max(1, sliderW);
        return clamp01((mouseX - sliderX) / denom);
    }

    function applyMusicVolume(volume, { persist = false, fadeMs = 60 } = {}) {
        const next = clamp01(volume);
        state.soundControls.musicVolume = next;
        userSettings.musicVolume = next;
        if (typeof musicManager.setBgmVolume === "function") {
            musicManager.setBgmVolume(next, { fadeMs });
        }
        if (persist) {
            persistUserSettings();
            state.soundControls.pendingPersist = false;
        } else {
            state.soundControls.pendingPersist = true;
        }
    }

    function applySfxVolume(volume, { persist = false } = {}) {
        const previous = state.soundControls.sfxVolume;
        const next = clamp01(volume);
        state.soundControls.sfxVolume = next;
        userSettings.sfxVolume = next;
        if (typeof musicManager.setSfxVolume === "function") {
            musicManager.setSfxVolume(next);
        }
        maybePlaySfxPreview(previous, next);
        if (persist) {
            persistUserSettings();
            state.soundControls.pendingPersist = false;
        } else {
            state.soundControls.pendingPersist = true;
        }
    }

    function maybePlaySfxPreview(previousVolume, nextVolume) {
        if (Math.abs(nextVolume - previousVolume) < 0.0001) return;
        if (typeof musicManager.playSfx !== "function") return;
        const now = performance.now();
        const lastPreviewAt = Number.isFinite(state.soundControls.lastSfxPreviewAt)
            ? state.soundControls.lastSfxPreviewAt
            : 0;
        if (now - lastPreviewAt < 120) return;
        state.soundControls.lastSfxPreviewAt = now;
        musicManager.playSfx("menuMove");
    }

    function resetSoundControls({ persist = true } = {}) {
        applyMusicVolume(DEFAULT_USER_SETTINGS.musicVolume, { persist: false, fadeMs: 60 });
        applySfxVolume(DEFAULT_USER_SETTINGS.sfxVolume, { persist: false });
        state.soundControls.hoveredSlider = "";
        state.soundControls.hoveredButton = "resetDefaults";
        if (persist) {
            persistUserSettings();
            state.soundControls.pendingPersist = false;
        }
        musicManager.playSfx("menuConfirm");
        return true;
    }

    function getHoveredSlider(mouseX, mouseY, layout = getSoundControlLayout()) {
        const hitX = layout.sliderX - 12;
        const hitW = layout.sliderW + 24;
        if (pointInRect(mouseX, mouseY, hitX, layout.musicCenterY - layout.rowHitH / 2, hitW, layout.rowHitH)) {
            return "music";
        }
        if (pointInRect(mouseX, mouseY, hitX, layout.sfxCenterY - layout.rowHitH / 2, hitW, layout.rowHitH)) {
            return "sfx";
        }
        return "";
    }

    function isResetButtonHovered(mouseX, mouseY, layout = getSoundControlLayout()) {
        return pointInRect(
            mouseX,
            mouseY,
            layout.resetButtonX,
            layout.resetButtonY,
            layout.resetButtonW,
            layout.resetButtonH
        );
    }

    function updateSliderFromPointer(sliderId, mouseX, { persist = false, layout = getSoundControlLayout() } = {}) {
        const value = getSliderValueForX(mouseX, layout.sliderX, layout.sliderW);
        if (sliderId === "music") {
            applyMusicVolume(value, { persist, fadeMs: 60 });
            return true;
        }
        if (sliderId === "sfx") {
            applySfxVolume(value, { persist });
            return true;
        }
        return false;
    }

    function handleSoundControlMouseMove(mouseX, mouseY, { layoutMode = "pause" } = {}) {
        const layout = getSoundControlLayoutForMode(layoutMode);
        if (state.soundControls.draggingSlider) {
            updateSliderFromPointer(state.soundControls.draggingSlider, mouseX, { persist: false, layout });
            state.soundControls.hoveredSlider = state.soundControls.draggingSlider;
            state.soundControls.hoveredButton = "";
            setControllerSelectedSlider(layoutMode, state.soundControls.draggingSlider);
            return true;
        }
        const hoveredSlider = getHoveredSlider(mouseX, mouseY, layout);
        state.soundControls.hoveredSlider = hoveredSlider;
        state.soundControls.hoveredButton = hoveredSlider
            ? ""
            : (isResetButtonHovered(mouseX, mouseY, layout) ? "resetDefaults" : "");
        if (hoveredSlider || state.soundControls.hoveredButton) {
            setControllerFocusArea(layoutMode, "sound");
        }
        if (hoveredSlider) {
            setControllerSelectedSlider(layoutMode, hoveredSlider);
        }
        return Boolean(hoveredSlider || state.soundControls.hoveredButton);
    }

    function handleSoundControlClick(mouseX, mouseY, { layoutMode = "pause" } = {}) {
        const layout = getSoundControlLayoutForMode(layoutMode);
        if (isResetButtonHovered(mouseX, mouseY, layout)) {
            setControllerFocusArea(layoutMode, "sound");
            return resetSoundControls({ persist: true });
        }
        const hoveredSlider = getHoveredSlider(mouseX, mouseY, layout);
        if (!hoveredSlider) return false;
        updateSliderFromPointer(hoveredSlider, mouseX, { persist: true, layout });
        state.soundControls.hoveredSlider = hoveredSlider;
        state.soundControls.hoveredButton = "";
        setControllerSelectedSlider(layoutMode, hoveredSlider);
        return true;
    }

    function handleSoundControlPointerDown(mouseX, mouseY, { layoutMode = "pause" } = {}) {
        const layout = getSoundControlLayoutForMode(layoutMode);
        const hoveredSlider = getHoveredSlider(mouseX, mouseY, layout);
        if (!hoveredSlider) return false;
        state.soundControls.draggingSlider = hoveredSlider;
        state.soundControls.hoveredSlider = hoveredSlider;
        state.soundControls.hoveredButton = "";
        setControllerSelectedSlider(layoutMode, hoveredSlider);
        updateSliderFromPointer(hoveredSlider, mouseX, { persist: false, layout });
        return true;
    }

    function cycleSoundControlSelectionByController(direction, { layoutMode = "pause" } = {}) {
        const dir = Number(direction);
        if (!Number.isFinite(dir) || dir === 0) return false;
        const current = getControllerSelectedSlider(layoutMode);
        const order = ["music", "sfx", "resetDefaults"];
        const currentIndex = Math.max(0, order.indexOf(current));
        const nextIndex = Math.max(0, Math.min(order.length - 1, currentIndex + (dir > 0 ? 1 : -1)));
        const next = order[nextIndex];
        if (next === current) return false;
        setControllerSelectedSlider(layoutMode, next);
        musicManager.playSfx("menuMove");
        return true;
    }

    function adjustSoundControlByController(direction, { layoutMode = "pause", persist = true } = {}) {
        const dir = Number(direction);
        if (!Number.isFinite(dir) || dir === 0) return false;
        const sliderId = getControllerSelectedSlider(layoutMode);
        if (sliderId === "resetDefaults") return false;
        const step = 0.01;
        if (sliderId === "music") {
            const next = clamp01(state.soundControls.musicVolume + (dir > 0 ? step : -step));
            applyMusicVolume(next, { persist, fadeMs: 45 });
            return true;
        }
        const next = clamp01(state.soundControls.sfxVolume + (dir > 0 ? step : -step));
        applySfxVolume(next, { persist });
        return true;
    }

    function activateSoundControlSelection({ layoutMode = "pause" } = {}) {
        if (getControllerFocusArea(layoutMode) !== "sound") return false;
        const selected = getControllerSelectedSlider(layoutMode);
        if (selected !== "resetDefaults") return false;
        return resetSoundControls({ persist: true });
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

        if (state.soundControls.draggingSlider) {
            updateSliderFromPointer(state.soundControls.draggingSlider, mouseX, { persist: false });
            state.soundControls.hoveredSlider = state.soundControls.draggingSlider;
            state.hovered = -1;
            setControllerFocusArea("pause", "sound");
            return;
        }

        const hoveringSoundControls = handleSoundControlMouseMove(mouseX, mouseY, { layoutMode: "pause" });
        if (hoveringSoundControls) {
            state.hovered = -1;
            return;
        }
        state.soundControls.hoveredSlider = "";
        state.soundControls.hoveredButton = "";

        const { menuW, menuX, menuY, optionStartY, optionStep } = getPauseMenuLayout();

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
                setControllerFocusArea("pause", "menu");
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

        if (handleSoundControlClick(mouseX, mouseY, { layoutMode: "pause" })) {
            state.hovered = -1;
            return true;
        }

        handleMouseMove(mouseX, mouseY);
        if (state.hovered >= 0) {
            selectOption(callbacks);
            return true;
        }
        return false;
    }

    function handlePointerDown(mouseX, mouseY) {
        if (state.mode !== "main") return false;
        return handleSoundControlPointerDown(mouseX, mouseY, { layoutMode: "pause" });
    }

    function handlePointerUp() {
        if (!state.soundControls.draggingSlider && !state.soundControls.pendingPersist) return false;
        state.soundControls.draggingSlider = "";
        if (state.soundControls.pendingPersist) {
            persistUserSettings();
            state.soundControls.pendingPersist = false;
        }
        return true;
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
        handleSoundControlMouseMove,
        handleClick,
        handleSoundControlClick,
        cycleSoundControlSelectionByController,
        adjustSoundControlByController,
        activateSoundControlSelection,
        getControllerFocusArea,
        setControllerFocusArea,
        handlePointerDown,
        handleSoundControlPointerDown,
        handlePointerUp,
        handleSettingsWheel,
        setStatus: setSettingsStatus
    };
}
