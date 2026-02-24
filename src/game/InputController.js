import { GAME_STATES, isFreeExploreState } from "../core/constants.js";

export function createInputController({
    inputManager,
    canvas = null,
    mouseUiState = null,
    titleScreenSystem,
    pauseMenuSystem,
    getGameState,
    isControllerInputEnabled = () => true,
    skillWheelState = null,
    actions
}) {
    const gamepadMenuState = {
        heldDirection: 0,
        nextMoveAt: 0,
        lastCursorUpdateAt: 0,
        lastInventoryConfirmPressedAt: -Infinity,
        confirmHeld: false,
        backHeld: false,
        questHeld: false,
        startHeld: false,
        attackHeld: false,
        inventoryHeld: false
    };

    function resetHeldStates() {
        gamepadMenuState.heldDirection = 0;
        gamepadMenuState.confirmHeld = false;
        gamepadMenuState.backHeld = false;
        gamepadMenuState.questHeld = false;
        gamepadMenuState.startHeld = false;
        gamepadMenuState.attackHeld = false;
        gamepadMenuState.inventoryHeld = false;
    }

    function clearGamepadMovement() {
        if (!inputManager?.actionStates) return;
        inputManager.actionStates.moveUp = false;
        inputManager.actionStates.moveDown = false;
        inputManager.actionStates.moveLeft = false;
        inputManager.actionStates.moveRight = false;
    }

    function updateVirtualCursor(now, axisX, axisY) {
        if (!mouseUiState || !canvas) return;
        const width = Number.isFinite(canvas.width) ? canvas.width : 0;
        const height = Number.isFinite(canvas.height) ? canvas.height : 0;
        if (width <= 0 || height <= 0) return;

        if (!Number.isFinite(mouseUiState.x) || !Number.isFinite(mouseUiState.y)) {
            mouseUiState.x = Math.round(width * 0.5);
            mouseUiState.y = Math.round(height * 0.5);
        }

        const prevTick = Number.isFinite(gamepadMenuState.lastCursorUpdateAt)
            ? gamepadMenuState.lastCursorUpdateAt
            : now;
        const dtMs = Math.max(0, Math.min(50, now - prevTick));
        gamepadMenuState.lastCursorUpdateAt = now;

        const deadzone = 0.16;
        const rawX = Math.abs(axisX) > deadzone ? axisX : 0;
        const rawY = Math.abs(axisY) > deadzone ? axisY : 0;
        const magnitude = Math.min(1, Math.hypot(rawX, rawY));
        if (magnitude <= 0) {
            mouseUiState.insideCanvas = true;
            return;
        }

        const speedPxPerSec = 760;
        const accel = 0.28 + Math.pow(magnitude, 1.25) * 0.92;
        const moveScale = (dtMs / 1000) * speedPxPerSec * accel;
        const nextX = mouseUiState.x + rawX * moveScale;
        const nextY = mouseUiState.y + rawY * moveScale;
        mouseUiState.x = Math.max(0, Math.min(width - 1, nextX));
        mouseUiState.y = Math.max(0, Math.min(height - 1, nextY));
        mouseUiState.insideCanvas = true;
    }

    function handleInventoryControllerPointer(now, confirmPressed) {
        if (!mouseUiState) return;
        if (confirmPressed && !gamepadMenuState.confirmHeld) {
            const doubleTapWindowMs = 280;
            const elapsedSinceLastTap = now - (Number.isFinite(gamepadMenuState.lastInventoryConfirmPressedAt)
                ? gamepadMenuState.lastInventoryConfirmPressedAt
                : -Infinity);
            gamepadMenuState.lastInventoryConfirmPressedAt = now;

            if (elapsedSinceLastTap > 0 && elapsedSinceLastTap <= doubleTapWindowMs) {
                mouseUiState.inventoryDoubleClickRequest = true;
                mouseUiState.inventoryClickRequest = false;
                mouseUiState.inventoryDragStartRequest = false;
                mouseUiState.inventoryLeftDown = false;
                return;
            }

            mouseUiState.inventoryLeftDown = true;
            mouseUiState.inventoryDragStartRequest = true;
            mouseUiState.inventoryClickRequest = false;
            mouseUiState.inventoryDoubleClickRequest = false;
            return;
        }

        if (!confirmPressed && gamepadMenuState.confirmHeld) {
            const hadPanelDrag = Boolean(mouseUiState.inventoryPanelDragTarget);
            const hadItemDrag = Boolean(mouseUiState.inventoryDragItemName);
            const wasSkillsDragging = Boolean(mouseUiState.inventorySkillsScrollDragging);
            mouseUiState.inventoryLeftDown = false;
            mouseUiState.inventoryPanelDragTarget = "";
            mouseUiState.inventorySkillsScrollDragging = false;
            if (hadPanelDrag || hadItemDrag || wasSkillsDragging) {
                mouseUiState.inventorySuppressNextClick = true;
            }
            if (wasSkillsDragging) {
                mouseUiState.inventorySkillsScrollSuppressClick = true;
            }
            if (mouseUiState.inventoryDragItemName) {
                mouseUiState.inventoryDragReleaseRequest = true;
            }
            if (!mouseUiState.inventorySuppressNextClick && !mouseUiState.inventorySkillsScrollSuppressClick) {
                mouseUiState.inventoryClickRequest = true;
            }
        }
    }

    function setSkillWheelActive(active) {
        if (!skillWheelState || typeof skillWheelState !== "object") return;
        skillWheelState.active = Boolean(active);
        if (!active) {
            skillWheelState.selectedIndex = -1;
            skillWheelState.aimX = 0;
            skillWheelState.aimY = 0;
        }
    }

    function resolveSkillWheelSelection(axisX, axisY, previous = -1) {
        const x = Number.isFinite(axisX) ? axisX : 0;
        const y = Number.isFinite(axisY) ? axisY : 0;
        const magnitude = Math.hypot(x, y);
        if (magnitude < 0.42) return previous;

        const dirX = x / magnitude;
        const dirY = y / magnitude;
        const directions = [
            { x: 0, y: -1 },   // 1: Up
            { x: 0.7071, y: -0.7071 }, // 2: Up-right
            { x: 1, y: 0 },    // 3: Right
            { x: 0.7071, y: 0.7071 },  // 4: Down-right
            { x: 0, y: 1 },    // 5: Down
            { x: -0.7071, y: 0.7071 }, // 6: Down-left
            { x: -1, y: 0 },   // 7: Left
            { x: -0.7071, y: -0.7071 } // 8: Up-left
        ];

        let bestIndex = 0;
        let bestDot = -Infinity;
        for (let i = 0; i < directions.length; i++) {
            const dir = directions[i];
            const dot = dir.x * dirX + dir.y * dirY;
            if (dot > bestDot) {
                bestDot = dot;
                bestIndex = i;
            }
        }
        return bestIndex;
    }

    function update(now) {
        if (!isControllerInputEnabled()) {
            clearGamepadMovement();
            setSkillWheelActive(false);
            resetHeldStates();
            return;
        }
        if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return;
        const gamepads = navigator.getGamepads();
        const pad = Array.from(gamepads || []).find((candidate) => candidate && candidate.connected);
        if (!pad) {
            clearGamepadMovement();
            setSkillWheelActive(false);
            resetHeldStates();
            return;
        }
        inputManager.setInputMethod("gamepad");

        const buttons = pad.buttons || [];
        const axisX = Array.isArray(pad.axes) && pad.axes.length > 0 ? pad.axes[0] : 0;
        const axisY = Array.isArray(pad.axes) && pad.axes.length > 1 ? pad.axes[1] : 0;
        const upPressed = Boolean(buttons[12]?.pressed) || axisY < -0.58;
        const downPressed = Boolean(buttons[13]?.pressed) || axisY > 0.58;
        const leftPressed = Boolean(buttons[14]?.pressed) || axisX < -0.5;
        const rightPressed = Boolean(buttons[15]?.pressed) || axisX > 0.5;
        const direction = upPressed ? -1 : downPressed ? 1 : 0;

        const confirmPressed = Boolean(buttons[0]?.pressed); // A
        const backPressed = Boolean(buttons[1]?.pressed); // B
        const attackPressed = Boolean(buttons[2]?.pressed); // X
        const inventoryPressed = Boolean(buttons[3]?.pressed); // Y
        const questPressed = Boolean(buttons[8]?.pressed); // View/Select
        const rightTriggerPressed = Boolean(buttons[7]?.pressed) || Number(buttons[7]?.value) > 0.35; // RT
        const startPressed = Boolean(buttons[9]?.pressed); // Start

        const gameState = getGameState();

        if (gameState === GAME_STATES.INTRO_CUTSCENE) {
            gamepadMenuState.heldDirection = 0;
            gamepadMenuState.confirmHeld = confirmPressed || startPressed;
            gamepadMenuState.backHeld = backPressed;
            gamepadMenuState.questHeld = questPressed;
            gamepadMenuState.startHeld = startPressed;
            gamepadMenuState.attackHeld = attackPressed;
            gamepadMenuState.inventoryHeld = inventoryPressed;
            return;
        }

        if (gameState === GAME_STATES.TITLE_SCREEN) {
            if (direction !== 0 && (direction !== gamepadMenuState.heldDirection || now >= gamepadMenuState.nextMoveAt)) {
                titleScreenSystem.handleKeyDown(direction === 1 ? "arrowdown" : "arrowup", actions.titleCallbacks);
                gamepadMenuState.heldDirection = direction;
                gamepadMenuState.nextMoveAt = now + 170;
            } else if (direction === 0) {
                gamepadMenuState.heldDirection = 0;
            }

            if (confirmPressed && !gamepadMenuState.confirmHeld) {
                titleScreenSystem.handleKeyDown("enter", actions.titleCallbacks);
            }
            if (startPressed && !gamepadMenuState.startHeld) {
                titleScreenSystem.handleKeyDown("enter", actions.titleCallbacks);
            }

            gamepadMenuState.confirmHeld = confirmPressed;
            gamepadMenuState.backHeld = backPressed;
            gamepadMenuState.questHeld = questPressed;
            gamepadMenuState.startHeld = startPressed;
            gamepadMenuState.attackHeld = attackPressed;
            gamepadMenuState.inventoryHeld = inventoryPressed;
            return;
        }

        if (gameState === GAME_STATES.PAUSE_MENU) {
            const pauseActions = {
                onResume: actions.onResume,
                onInventory: actions.onInventory,
                onAttributes: actions.onAttributes,
                onSettings: actions.onSettings,
                onBackToPause: actions.closePauseMenu,
                onSave: actions.onSave,
                onLoad: actions.onLoad,
                onQuit: actions.onQuit,
                inputManager
            };

            if (direction !== 0 && (direction !== gamepadMenuState.heldDirection || now >= gamepadMenuState.nextMoveAt)) {
                // PauseMenuSystem handles keydown for navigation?
                // pauseMenuSystem.moveSelection(direction)?
                // Previous code called movePauseMenuSelection(direction).
                // PauseMenuSystem SHOULD expose this.
                // Assuming PauseMenuSystem.handleKeyDown handles "arrowup"/"arrowdown".
                pauseMenuSystem.handleKeyDown(direction === 1 ? "arrowdown" : "arrowup", pauseActions);

                gamepadMenuState.heldDirection = direction;
                gamepadMenuState.nextMoveAt = now + 145;
            } else if (direction === 0) {
                gamepadMenuState.heldDirection = 0;
            }

            if (confirmPressed && !gamepadMenuState.confirmHeld) {
                // selectPauseMenuOption();
                // pauseMenuSystem.handleKeyDown("enter")?
                pauseMenuSystem.handleKeyDown("enter", pauseActions);
            }

            if ((backPressed && !gamepadMenuState.backHeld) || (startPressed && !gamepadMenuState.startHeld)) {
                actions.onResume();
            }

            gamepadMenuState.confirmHeld = confirmPressed;
            gamepadMenuState.backHeld = backPressed;
            gamepadMenuState.questHeld = questPressed;
            gamepadMenuState.startHeld = startPressed;
            gamepadMenuState.attackHeld = attackPressed;
            gamepadMenuState.inventoryHeld = inventoryPressed;
            return;
        }

        // Settings logic...
        if (gameState === GAME_STATES.SETTINGS) {
            // Similar to PauseMenu logic, but simpler mapping?
            // Previous code called moveSettingsSelection(direction).
            // PauseMenuSystem handles Settings input via handleKeyDown too if mode is settings.
            const settingsActions = {
                ...actions,
                onBackToPause: actions.closePauseMenu,
                inputManager
            };

            if (direction !== 0 && (direction !== gamepadMenuState.heldDirection || now >= gamepadMenuState.nextMoveAt)) {
                pauseMenuSystem.handleKeyDown(direction === 1 ? "arrowdown" : "arrowup", settingsActions);
                gamepadMenuState.heldDirection = direction;
                gamepadMenuState.nextMoveAt = now + 145;
            } else if (direction === 0) {
                gamepadMenuState.heldDirection = 0;
            }

            if (confirmPressed && !gamepadMenuState.confirmHeld) {
                pauseMenuSystem.handleKeyDown("enter", settingsActions);
            }

            if ((backPressed && !gamepadMenuState.backHeld) || (startPressed && !gamepadMenuState.startHeld)) {
                // Escape logic handled by PauseMenuSystem?
                // Previous code had: if (rebind) cancel; else returnToPauseMenu().
                // pauseMenuSystem.handleKeyDown("escape", ...).
                pauseMenuSystem.handleKeyDown("escape", settingsActions);
            }
        } else if (gameState === GAME_STATES.INVENTORY) {
            updateVirtualCursor(now, axisX, axisY);
            handleInventoryControllerPointer(now, confirmPressed);
            if (
                (backPressed && !gamepadMenuState.backHeld) ||
                (startPressed && !gamepadMenuState.startHeld)
            ) {
                if (actions.isInventoryOpenedFromPauseMenu && actions.isInventoryOpenedFromPauseMenu()) {
                    actions.closePauseMenu();
                } else if (typeof actions.closeInventory === "function") {
                    actions.closeInventory();
                } else {
                    actions.closePauseMenu();
                }
            }
        } else if (gameState === GAME_STATES.QUEST_TRACKER) {
            updateVirtualCursor(now, axisX, axisY);
            if (confirmPressed && !gamepadMenuState.confirmHeld && mouseUiState) {
                mouseUiState.questTrackerClickRequest = true;
            }
            if (questPressed && !gamepadMenuState.questHeld) {
                if (typeof actions.closeQuestTracker === "function") {
                    actions.closeQuestTracker();
                }
            } else if ((backPressed && !gamepadMenuState.backHeld) || (startPressed && !gamepadMenuState.startHeld)) {
                if (typeof actions.closeQuestTracker === "function") {
                    actions.closeQuestTracker();
                }
            }
        } else if (gameState === GAME_STATES.ATTRIBUTES) {
            if (
                (confirmPressed && !gamepadMenuState.confirmHeld) ||
                (backPressed && !gamepadMenuState.backHeld) ||
                (startPressed && !gamepadMenuState.startHeld)
            ) {
                actions.closePauseMenu(); // returnToPauseMenu
            }
        } else if (isFreeExploreState(gameState)) {
            const inputLocked = Boolean(actions.isInputLocked && actions.isInputLocked());
            const dialogueActive = Boolean(actions.isDialogueActive && actions.isDialogueActive());
            const wheelAllowed = !inputLocked && !dialogueActive;
            if (!rightTriggerPressed || !wheelAllowed) {
                setSkillWheelActive(false);
            }
            const wheelActive = rightTriggerPressed && wheelAllowed;

            if (wheelActive) {
                if (skillWheelState && typeof skillWheelState === "object") {
                    skillWheelState.active = true;
                    skillWheelState.aimX = axisX;
                    skillWheelState.aimY = axisY;
                    skillWheelState.selectedIndex = resolveSkillWheelSelection(
                        axisX,
                        axisY,
                        Number.isFinite(skillWheelState.selectedIndex) ? skillWheelState.selectedIndex : -1
                    );
                }
                clearGamepadMovement();
            }

            if (wheelActive && confirmPressed && !gamepadMenuState.confirmHeld) {
                const selectedIndex = Number.isFinite(skillWheelState?.selectedIndex)
                    ? skillWheelState.selectedIndex
                    : -1;
                if (selectedIndex >= 0 && typeof actions.onSkillSlotPressed === "function") {
                    actions.onSkillSlotPressed(selectedIndex);
                }
            }

            if (wheelActive) {
                gamepadMenuState.confirmHeld = confirmPressed;
                gamepadMenuState.backHeld = backPressed;
                gamepadMenuState.questHeld = questPressed;
                gamepadMenuState.startHeld = startPressed;
                gamepadMenuState.attackHeld = attackPressed;
                gamepadMenuState.inventoryHeld = inventoryPressed;
                return;
            }

            if (!inputLocked) {
                inputManager.actionStates.moveUp = upPressed;
                inputManager.actionStates.moveDown = downPressed;
                inputManager.actionStates.moveLeft = leftPressed;
                inputManager.actionStates.moveRight = rightPressed;
            } else {
                clearGamepadMovement();
            }
            if (confirmPressed && !gamepadMenuState.confirmHeld && !inputLocked) {
                inputManager.triggerInteractPressed();
            }
            if (startPressed && !gamepadMenuState.startHeld && !dialogueActive && !inputLocked) {
                actions.openPauseMenu();
            }
            if (questPressed && !gamepadMenuState.questHeld && !dialogueActive && !inputLocked) {
                if (typeof actions.openQuestTracker === "function") {
                    actions.openQuestTracker();
                }
            }
            if (attackPressed && !gamepadMenuState.attackHeld && !dialogueActive && !inputLocked) { // Removed canRunCombatSystems check because main.js handles it? 
                // Previous code checked canRunCombatSystems(). I should pass that as a callback or getter?
                // actions.canRunCombatSystems()
                if (actions.canRunCombatSystems && actions.canRunCombatSystems()) {
                    inputManager.triggerAttackPressed();
                }
            }
            if (inventoryPressed && !gamepadMenuState.inventoryHeld && !inputLocked && typeof inputManager.onToggleInventory === "function") {
                inputManager.onToggleInventory();
            }
        } else {
            clearGamepadMovement();
            setSkillWheelActive(false);
        }

        gamepadMenuState.confirmHeld = confirmPressed;
        gamepadMenuState.backHeld = backPressed;
        gamepadMenuState.questHeld = questPressed;
        gamepadMenuState.startHeld = startPressed;
        gamepadMenuState.attackHeld = attackPressed;
        gamepadMenuState.inventoryHeld = inventoryPressed;
    }

    return {
        update,
        reset: resetHeldStates
    };
}
