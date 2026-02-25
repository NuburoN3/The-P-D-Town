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
        heldHorizontalDirection: 0,
        nextHorizontalMoveAt: 0,
        skillsScrollHeldDirection: 0,
        nextSkillsScrollAt: 0,
        lastCursorUpdateAt: 0,
        lastGameState: "",
        lastRightStickFacing: "",
        skillWheelConsumedUntilRelease: false,
        suppressInventoryConfirmUntilRelease: false,
        lastInventoryConfirmPressedAt: -Infinity,
        audioAdjustHeldDirection: 0,
        nextAudioAdjustAt: 0,
        audioSelectHeldDirection: 0,
        nextAudioSelectAt: 0,
        confirmHeld: false,
        backHeld: false,
        questHeld: false,
        leftoversHeld: false,
        startHeld: false,
        attackHeld: false,
        inventoryHeld: false,
        skillConfirmHeld: false
    };
    const LEFT_STICK_MOVE_DEADZONE = 0.17;
    const MENU_NAV_DEADZONE = 0.6;

    function resetButtonHeldStates() {
        gamepadMenuState.confirmHeld = false;
        gamepadMenuState.backHeld = false;
        gamepadMenuState.questHeld = false;
        gamepadMenuState.leftoversHeld = false;
        gamepadMenuState.startHeld = false;
        gamepadMenuState.attackHeld = false;
        gamepadMenuState.inventoryHeld = false;
        gamepadMenuState.skillConfirmHeld = false;
    }

    function resetHeldStates() {
        gamepadMenuState.heldDirection = 0;
        gamepadMenuState.heldHorizontalDirection = 0;
        gamepadMenuState.nextHorizontalMoveAt = 0;
        gamepadMenuState.skillsScrollHeldDirection = 0;
        gamepadMenuState.nextSkillsScrollAt = 0;
        resetButtonHeldStates();
        gamepadMenuState.lastRightStickFacing = "";
        gamepadMenuState.skillWheelConsumedUntilRelease = false;
        gamepadMenuState.suppressInventoryConfirmUntilRelease = false;
        gamepadMenuState.audioAdjustHeldDirection = 0;
        gamepadMenuState.nextAudioAdjustAt = 0;
        gamepadMenuState.audioSelectHeldDirection = 0;
        gamepadMenuState.nextAudioSelectAt = 0;
        gamepadMenuState.lastGameState = "";
    }

    function clearGamepadMovement() {
        if (!inputManager?.actionStates) return;
        inputManager.actionStates.moveUp = false;
        inputManager.actionStates.moveDown = false;
        inputManager.actionStates.moveLeft = false;
        inputManager.actionStates.moveRight = false;
    }

    function updateVirtualCursor(now, axisX, axisY, { enableInventorySnap = false } = {}) {
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
        if (enableInventorySnap) {
            applyInventoryCursorSnap(rawX, rawY, width, height, dtMs);
        }
        mouseUiState.insideCanvas = true;
    }

    function applyInventoryCursorSnap(rawX, rawY, width, height, dtMs) {
        if (!mouseUiState || !Array.isArray(mouseUiState.controllerSnapTargets)) return;
        if (mouseUiState.inventoryDragItemName || mouseUiState.inventoryPanelDragTarget || mouseUiState.inventorySkillsScrollDragging) {
            if (mouseUiState.controllerSnapState && typeof mouseUiState.controllerSnapState === "object") {
                mouseUiState.controllerSnapState.locked = null;
            }
            return;
        }

        const cursorX = Number(mouseUiState.x);
        const cursorY = Number(mouseUiState.y);
        if (!Number.isFinite(cursorX) || !Number.isFinite(cursorY)) return;
        const inputMagnitude = Math.hypot(rawX, rawY);
        if (inputMagnitude < 0.08) return;

        const now = performance.now();
        const snapRadius = 44;
        const hardSnapRadius = 16;
        const escapeMsNeeded = 180;
        const releaseCooldownMs = 130;
        const safeDtMs = Number.isFinite(dtMs) ? Math.max(0, Math.min(50, dtMs)) : 16;
        const state = (
            mouseUiState.controllerSnapState && typeof mouseUiState.controllerSnapState === "object"
        )
            ? mouseUiState.controllerSnapState
            : { locked: null, releaseCooldownUntil: 0 };
        mouseUiState.controllerSnapState = state;

        const calcRectDistance = (target) => {
            const tx = target.x;
            const ty = target.y;
            const tw = target.w;
            const th = target.h;
            const closestX = Math.max(tx, Math.min(cursorX, tx + tw));
            const closestY = Math.max(ty, Math.min(cursorY, ty + th));
            return Math.hypot(cursorX - closestX, cursorY - closestY);
        };
        const findBestTargetNearCursor = () => {
            let best = null;
            let bestDistance = Infinity;
            for (const target of mouseUiState.controllerSnapTargets) {
                if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y) || !Number.isFinite(target.w) || !Number.isFinite(target.h)) continue;
                if (target.w <= 1 || target.h <= 1) continue;
                const distance = calcRectDistance(target);
                if (distance > snapRadius) continue;
                if (distance < bestDistance) {
                    bestDistance = distance;
                    best = target;
                }
            }
            return { target: best, distance: bestDistance };
        };
        const findLockedTarget = () => {
            const lock = state.locked;
            if (!lock || !Number.isFinite(lock.cx) || !Number.isFinite(lock.cy)) return null;
            let best = null;
            let bestDist = Infinity;
            for (const target of mouseUiState.controllerSnapTargets) {
                if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y) || !Number.isFinite(target.w) || !Number.isFinite(target.h)) continue;
                const cx = target.x + target.w * 0.5;
                const cy = target.y + target.h * 0.5;
                const dist = Math.hypot(cx - lock.cx, cy - lock.cy);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = target;
                }
            }
            return bestDist <= 24 ? best : null;
        };

        let activeTarget = findLockedTarget();
        let activeDistance = Infinity;
        let escapeRatio = 0;

        if (activeTarget) {
            activeDistance = calcRectDistance(activeTarget);
            const centerX = activeTarget.x + activeTarget.w * 0.5;
            const centerY = activeTarget.y + activeTarget.h * 0.5;
            const toCursorX = cursorX - centerX;
            const toCursorY = cursorY - centerY;
            const centerDistance = Math.hypot(toCursorX, toCursorY);
            let movingAwayStrength = 0;
            if (centerDistance > 1 && inputMagnitude > 0.18) {
                const nx = toCursorX / centerDistance;
                const ny = toCursorY / centerDistance;
                const inx = rawX / inputMagnitude;
                const iny = rawY / inputMagnitude;
                const dot = inx * nx + iny * ny;
                if (dot > 0.42) {
                    movingAwayStrength = Math.min(1, (dot - 0.42) / 0.58);
                }
            }

            state.locked.escapeMs = Number.isFinite(state.locked.escapeMs) ? state.locked.escapeMs : 0;
            if (movingAwayStrength > 0) {
                state.locked.escapeMs = Math.min(
                    escapeMsNeeded + 120,
                    state.locked.escapeMs + safeDtMs * (0.7 + movingAwayStrength)
                );
            } else {
                state.locked.escapeMs = Math.max(0, state.locked.escapeMs - safeDtMs * 1.25);
            }

            if (state.locked.escapeMs >= escapeMsNeeded) {
                state.locked = null;
                state.releaseCooldownUntil = now + releaseCooldownMs;
                return;
            }
            escapeRatio = Math.max(0, Math.min(1, state.locked.escapeMs / escapeMsNeeded));
        } else if (now >= (Number.isFinite(state.releaseCooldownUntil) ? state.releaseCooldownUntil : 0)) {
            const bestNear = findBestTargetNearCursor();
            activeTarget = bestNear.target;
            activeDistance = bestNear.distance;
            if (activeTarget) {
                state.locked = {
                    cx: activeTarget.x + activeTarget.w * 0.5,
                    cy: activeTarget.y + activeTarget.h * 0.5,
                    escapeMs: 0
                };
            }
        }

        if (!activeTarget) return;

        const targetCenterX = activeTarget.x + activeTarget.w * 0.5;
        const targetCenterY = activeTarget.y + activeTarget.h * 0.5;
        let pull = activeDistance <= hardSnapRadius
            ? 0.55
            : (0.08 + ((snapRadius - activeDistance) / snapRadius) * 0.24);
        // Gradually ease out of magnetic force while the player keeps pushing away.
        pull *= (1 - escapeRatio * 0.7);
        const snappedX = cursorX + (targetCenterX - cursorX) * pull;
        const snappedY = cursorY + (targetCenterY - cursorY) * pull;
        mouseUiState.x = Math.max(0, Math.min(width - 1, snappedX));
        mouseUiState.y = Math.max(0, Math.min(height - 1, snappedY));
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

    function resolveFacingDirectionFromRightStick(axisX, axisY) {
        const x = Number.isFinite(axisX) ? axisX : 0;
        const y = Number.isFinite(axisY) ? axisY : 0;
        const deadzone = 0.34;
        if (Math.hypot(x, y) < deadzone) return "";
        if (Math.abs(x) >= Math.abs(y)) {
            return x >= 0 ? "right" : "left";
        }
        return y >= 0 ? "down" : "up";
    }

    function getMenuConfirmKey() {
        if (inputManager && typeof inputManager.getPrimaryBinding === "function") {
            const interactKey = inputManager.getPrimaryBinding("interact");
            if (typeof interactKey === "string" && interactKey.length > 0) {
                return interactKey;
            }
        }
        return "space";
    }

    function update(now) {
        if (!isControllerInputEnabled()) {
            inputManager.setInputMethod("keyboard");
            setSkillWheelActive(false);
            if (typeof actions.setControllerFacingDirection === "function") {
                actions.setControllerFacingDirection("");
            }
            resetHeldStates();
            return;
        }
        if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return;
        const gamepads = navigator.getGamepads();
        const pad = Array.from(gamepads || []).find((candidate) => candidate && candidate.connected);
        if (!pad) {
            setSkillWheelActive(false);
            if (typeof actions.setControllerFacingDirection === "function") {
                actions.setControllerFacingDirection("");
            }
            resetHeldStates();
            return;
        }
        inputManager.setInputMethod("gamepad");

        const buttons = pad.buttons || [];
        const axisX = Array.isArray(pad.axes) && pad.axes.length > 0 ? pad.axes[0] : 0;
        const axisY = Array.isArray(pad.axes) && pad.axes.length > 1 ? pad.axes[1] : 0;
        const rightAxisX = Array.isArray(pad.axes) && pad.axes.length > 2 ? pad.axes[2] : 0;
        const rightAxisY = Array.isArray(pad.axes) && pad.axes.length > 3 ? pad.axes[3] : 0;
        const upPressed = Boolean(buttons[12]?.pressed) || axisY < -LEFT_STICK_MOVE_DEADZONE;
        const downPressed = Boolean(buttons[13]?.pressed) || axisY > LEFT_STICK_MOVE_DEADZONE;
        const leftPressed = Boolean(buttons[14]?.pressed) || axisX < -LEFT_STICK_MOVE_DEADZONE;
        const rightPressed = Boolean(buttons[15]?.pressed) || axisX > LEFT_STICK_MOVE_DEADZONE;
        const menuUpPressed = Boolean(buttons[12]?.pressed) || axisY < -MENU_NAV_DEADZONE;
        const menuDownPressed = Boolean(buttons[13]?.pressed) || axisY > MENU_NAV_DEADZONE;
        const direction = menuUpPressed ? -1 : menuDownPressed ? 1 : 0;
        const menuLeftPressed = Boolean(buttons[14]?.pressed) || axisX < -MENU_NAV_DEADZONE;
        const menuRightPressed = Boolean(buttons[15]?.pressed) || axisX > MENU_NAV_DEADZONE;
        const horizontalMenuDirection = menuRightPressed ? 1 : (menuLeftPressed ? -1 : 0);
        const audioAdjustDirection = rightAxisX > MENU_NAV_DEADZONE
            ? 1
            : (rightAxisX < -MENU_NAV_DEADZONE ? -1 : 0);
        const audioSelectDirection = rightAxisY > MENU_NAV_DEADZONE
            ? 1
            : (rightAxisY < -MENU_NAV_DEADZONE ? -1 : 0);

        const confirmPressed = Boolean(buttons[0]?.pressed); // A
        const backPressed = Boolean(buttons[1]?.pressed); // B
        const leftoversPressed = Boolean(buttons[2]?.pressed); // X
        const facingLockPressed = Boolean(buttons[4]?.pressed); // LB / L1
        const skillConfirmPressed = Boolean(buttons[5]?.pressed); // RB / R1
        const attackPressed = Boolean(buttons[7]?.pressed) || Number(buttons[7]?.value) > 0.35; // RT
        const inventoryPressed = Boolean(buttons[3]?.pressed); // Y
        const questPressed = Boolean(buttons[8]?.pressed); // View/Select
        const skillWheelPressed = Boolean(buttons[6]?.pressed) || Number(buttons[6]?.value) > 0.35; // LT / L2
        const startPressed = Boolean(buttons[9]?.pressed); // Start
        if (!skillWheelPressed) {
            gamepadMenuState.skillWheelConsumedUntilRelease = false;
        }

        const gameState = getGameState();
        if (gamepadMenuState.lastGameState !== gameState) {
            gamepadMenuState.heldDirection = 0;
            gamepadMenuState.nextMoveAt = now;
            gamepadMenuState.heldHorizontalDirection = 0;
            gamepadMenuState.nextHorizontalMoveAt = now;
            gamepadMenuState.skillsScrollHeldDirection = 0;
            gamepadMenuState.nextSkillsScrollAt = now;
            gamepadMenuState.confirmHeld = confirmPressed;
            gamepadMenuState.backHeld = backPressed;
            gamepadMenuState.questHeld = questPressed;
            gamepadMenuState.leftoversHeld = leftoversPressed;
            gamepadMenuState.startHeld = startPressed;
            gamepadMenuState.attackHeld = attackPressed;
            gamepadMenuState.inventoryHeld = inventoryPressed;
            gamepadMenuState.skillConfirmHeld = skillConfirmPressed;
            gamepadMenuState.suppressInventoryConfirmUntilRelease =
                gameState === GAME_STATES.INVENTORY && confirmPressed;
            gamepadMenuState.audioAdjustHeldDirection = 0;
            gamepadMenuState.nextAudioAdjustAt = now;
            gamepadMenuState.audioSelectHeldDirection = 0;
            gamepadMenuState.nextAudioSelectAt = now;
            gamepadMenuState.lastGameState = gameState;
        }
        const choiceActive = Boolean(typeof actions.isChoiceActive === "function" && actions.isChoiceActive());

        if (gameState === GAME_STATES.INTRO_CUTSCENE) {
            gamepadMenuState.heldDirection = 0;
            gamepadMenuState.confirmHeld = confirmPressed || startPressed;
            gamepadMenuState.backHeld = backPressed;
            gamepadMenuState.questHeld = questPressed;
            gamepadMenuState.leftoversHeld = leftoversPressed;
            gamepadMenuState.startHeld = startPressed;
            gamepadMenuState.attackHeld = attackPressed;
            gamepadMenuState.inventoryHeld = inventoryPressed;
            gamepadMenuState.skillConfirmHeld = skillConfirmPressed;
            return;
        }

        if (choiceActive) {
            if (direction !== 0 && (direction !== gamepadMenuState.heldDirection || now >= gamepadMenuState.nextMoveAt)) {
                if (typeof actions.moveChoiceSelection === "function") {
                    actions.moveChoiceSelection(direction);
                }
                gamepadMenuState.heldDirection = direction;
                gamepadMenuState.nextMoveAt = now + 145;
            } else if (direction === 0) {
                gamepadMenuState.heldDirection = 0;
            }

            if (confirmPressed && !gamepadMenuState.confirmHeld) {
                if (typeof actions.confirmChoice === "function") {
                    actions.confirmChoice();
                }
            }

            gamepadMenuState.confirmHeld = confirmPressed;
            gamepadMenuState.backHeld = backPressed;
            gamepadMenuState.questHeld = questPressed;
            gamepadMenuState.leftoversHeld = leftoversPressed;
            gamepadMenuState.startHeld = startPressed;
            gamepadMenuState.attackHeld = attackPressed;
            gamepadMenuState.inventoryHeld = inventoryPressed;
            gamepadMenuState.skillConfirmHeld = skillConfirmPressed;
            return;
        }

        if (gameState === GAME_STATES.TITLE_SCREEN) {
            const shouldAdjustAudio = typeof pauseMenuSystem.adjustSoundControlByController === "function";
            if (
                shouldAdjustAudio &&
                audioAdjustDirection !== 0 &&
                (
                    audioAdjustDirection !== gamepadMenuState.audioAdjustHeldDirection ||
                    now >= gamepadMenuState.nextAudioAdjustAt
                )
            ) {
                pauseMenuSystem.adjustSoundControlByController(audioAdjustDirection, {
                    layoutMode: "title",
                    persist: true
                });
                gamepadMenuState.audioAdjustHeldDirection = audioAdjustDirection;
                gamepadMenuState.nextAudioAdjustAt = now + 95;
            } else if (audioAdjustDirection === 0) {
                gamepadMenuState.audioAdjustHeldDirection = 0;
            }
            if (
                typeof pauseMenuSystem.cycleSoundControlSelectionByController === "function" &&
                audioSelectDirection !== 0 &&
                (
                    audioSelectDirection !== gamepadMenuState.audioSelectHeldDirection ||
                    now >= gamepadMenuState.nextAudioSelectAt
                )
            ) {
                pauseMenuSystem.cycleSoundControlSelectionByController(audioSelectDirection, {
                    layoutMode: "title"
                });
                gamepadMenuState.audioSelectHeldDirection = audioSelectDirection;
                gamepadMenuState.nextAudioSelectAt = now + 170;
            } else if (audioSelectDirection === 0) {
                gamepadMenuState.audioSelectHeldDirection = 0;
            }

            if (direction !== 0 && (direction !== gamepadMenuState.heldDirection || now >= gamepadMenuState.nextMoveAt)) {
                titleScreenSystem.handleKeyDown(direction === 1 ? "arrowdown" : "arrowup", actions.titleCallbacks);
                gamepadMenuState.heldDirection = direction;
                gamepadMenuState.nextMoveAt = now + 170;
            } else if (direction === 0) {
                gamepadMenuState.heldDirection = 0;
            }
            if (
                horizontalMenuDirection !== 0 &&
                (
                    horizontalMenuDirection !== gamepadMenuState.heldHorizontalDirection ||
                    now >= gamepadMenuState.nextHorizontalMoveAt
                )
            ) {
                titleScreenSystem.handleKeyDown(
                    horizontalMenuDirection === 1 ? "arrowright" : "arrowleft",
                    actions.titleCallbacks
                );
                gamepadMenuState.heldHorizontalDirection = horizontalMenuDirection;
                gamepadMenuState.nextHorizontalMoveAt = now + 170;
            } else if (horizontalMenuDirection === 0) {
                gamepadMenuState.heldHorizontalDirection = 0;
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
            gamepadMenuState.leftoversHeld = leftoversPressed;
            gamepadMenuState.startHeld = startPressed;
            gamepadMenuState.attackHeld = attackPressed;
            gamepadMenuState.inventoryHeld = inventoryPressed;
            gamepadMenuState.skillConfirmHeld = skillConfirmPressed;
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
                pauseMenuSystem.handleKeyDown(getMenuConfirmKey(), pauseActions);
            }
            if (
                typeof pauseMenuSystem.adjustSoundControlByController === "function" &&
                audioAdjustDirection !== 0 &&
                (
                    audioAdjustDirection !== gamepadMenuState.audioAdjustHeldDirection ||
                    now >= gamepadMenuState.nextAudioAdjustAt
                )
            ) {
                pauseMenuSystem.adjustSoundControlByController(audioAdjustDirection, {
                    layoutMode: "pause",
                    persist: true
                });
                gamepadMenuState.audioAdjustHeldDirection = audioAdjustDirection;
                gamepadMenuState.nextAudioAdjustAt = now + 95;
            } else if (audioAdjustDirection === 0) {
                gamepadMenuState.audioAdjustHeldDirection = 0;
            }
            if (
                typeof pauseMenuSystem.cycleSoundControlSelectionByController === "function" &&
                audioSelectDirection !== 0 &&
                (
                    audioSelectDirection !== gamepadMenuState.audioSelectHeldDirection ||
                    now >= gamepadMenuState.nextAudioSelectAt
                )
            ) {
                pauseMenuSystem.cycleSoundControlSelectionByController(audioSelectDirection, {
                    layoutMode: "pause"
                });
                gamepadMenuState.audioSelectHeldDirection = audioSelectDirection;
                gamepadMenuState.nextAudioSelectAt = now + 170;
            } else if (audioSelectDirection === 0) {
                gamepadMenuState.audioSelectHeldDirection = 0;
            }

            if ((backPressed && !gamepadMenuState.backHeld) || (startPressed && !gamepadMenuState.startHeld)) {
                actions.onResume();
            }

            gamepadMenuState.confirmHeld = confirmPressed;
            gamepadMenuState.backHeld = backPressed;
            gamepadMenuState.questHeld = questPressed;
            gamepadMenuState.leftoversHeld = leftoversPressed;
            gamepadMenuState.startHeld = startPressed;
            gamepadMenuState.attackHeld = attackPressed;
            gamepadMenuState.inventoryHeld = inventoryPressed;
            gamepadMenuState.skillConfirmHeld = skillConfirmPressed;
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
                pauseMenuSystem.handleKeyDown(getMenuConfirmKey(), settingsActions);
            }
            if (
                typeof pauseMenuSystem.adjustSoundControlByController === "function" &&
                audioAdjustDirection !== 0 &&
                (
                    audioAdjustDirection !== gamepadMenuState.audioAdjustHeldDirection ||
                    now >= gamepadMenuState.nextAudioAdjustAt
                )
            ) {
                pauseMenuSystem.adjustSoundControlByController(audioAdjustDirection, {
                    layoutMode: "pause",
                    persist: true
                });
                gamepadMenuState.audioAdjustHeldDirection = audioAdjustDirection;
                gamepadMenuState.nextAudioAdjustAt = now + 95;
            } else if (audioAdjustDirection === 0) {
                gamepadMenuState.audioAdjustHeldDirection = 0;
            }
            if (
                typeof pauseMenuSystem.cycleSoundControlSelectionByController === "function" &&
                audioSelectDirection !== 0 &&
                (
                    audioSelectDirection !== gamepadMenuState.audioSelectHeldDirection ||
                    now >= gamepadMenuState.nextAudioSelectAt
                )
            ) {
                pauseMenuSystem.cycleSoundControlSelectionByController(audioSelectDirection, {
                    layoutMode: "pause"
                });
                gamepadMenuState.audioSelectHeldDirection = audioSelectDirection;
                gamepadMenuState.nextAudioSelectAt = now + 170;
            } else if (audioSelectDirection === 0) {
                gamepadMenuState.audioSelectHeldDirection = 0;
            }

            if ((backPressed && !gamepadMenuState.backHeld) || (startPressed && !gamepadMenuState.startHeld)) {
                // Escape logic handled by PauseMenuSystem?
                // Previous code had: if (rebind) cancel; else returnToPauseMenu().
                // pauseMenuSystem.handleKeyDown("escape", ...).
                pauseMenuSystem.handleKeyDown("escape", settingsActions);
            }
        } else if (gameState === GAME_STATES.INVENTORY) {
            updateVirtualCursor(now, axisX, axisY, { enableInventorySnap: true });
            const inventorySkillsScrollDeadzone = 0.45;
            const skillsScrollDirection = rightAxisY > inventorySkillsScrollDeadzone
                ? 1
                : (rightAxisY < -inventorySkillsScrollDeadzone ? -1 : 0);
            const canScrollSkillsPanel = Boolean(
                mouseUiState &&
                mouseUiState.inventorySkillsPanelHovered &&
                !mouseUiState.inventorySkillsScrollDragging
            );
            if (canScrollSkillsPanel) {
                if (
                    skillsScrollDirection !== 0 &&
                    (
                        skillsScrollDirection !== gamepadMenuState.skillsScrollHeldDirection ||
                        now >= gamepadMenuState.nextSkillsScrollAt
                    )
                ) {
                    const nextDelta = (Number(mouseUiState.inventorySkillsScrollDelta) || 0) + skillsScrollDirection;
                    mouseUiState.inventorySkillsScrollDelta = nextDelta;
                    gamepadMenuState.skillsScrollHeldDirection = skillsScrollDirection;
                    gamepadMenuState.nextSkillsScrollAt = now + 110;
                } else if (skillsScrollDirection === 0) {
                    gamepadMenuState.skillsScrollHeldDirection = 0;
                }
            } else {
                gamepadMenuState.skillsScrollHeldDirection = 0;
            }
            if (gamepadMenuState.suppressInventoryConfirmUntilRelease) {
                if (!confirmPressed) {
                    gamepadMenuState.suppressInventoryConfirmUntilRelease = false;
                }
            } else {
                handleInventoryControllerPointer(now, confirmPressed);
            }
            if (
                leftoversPressed &&
                !gamepadMenuState.leftoversHeld &&
                typeof actions.isLeftoversInventoryOpen === "function" &&
                actions.isLeftoversInventoryOpen() &&
                mouseUiState
            ) {
                mouseUiState.leftoversTakeAllRequest = true;
            }
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
        } else if (gameState === GAME_STATES.QUEST_COMPLETION) {
            updateVirtualCursor(now, axisX, axisY);
            if (confirmPressed && !gamepadMenuState.confirmHeld && mouseUiState) {
                mouseUiState.questCompletionClickRequest = true;
            }
            if ((backPressed && !gamepadMenuState.backHeld) || (startPressed && !gamepadMenuState.startHeld)) {
                if (typeof actions.closeQuestCompletionPanel === "function") {
                    actions.closeQuestCompletionPanel();
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
            if (!skillWheelPressed || !wheelAllowed) {
                setSkillWheelActive(false);
            }
            const wheelActive =
                skillWheelPressed &&
                wheelAllowed &&
                !gamepadMenuState.skillWheelConsumedUntilRelease;

            const liveFacingDir = resolveFacingDirectionFromRightStick(rightAxisX, rightAxisY);
            if (facingLockPressed && liveFacingDir) {
                gamepadMenuState.lastRightStickFacing = liveFacingDir;
            }
            if (typeof actions.setControllerFacingDirection === "function") {
                const facingDir = (!inputLocked && !dialogueActive)
                    ? (
                        facingLockPressed
                            ? (liveFacingDir || gamepadMenuState.lastRightStickFacing || "")
                            : ""
                    )
                    : "";
                actions.setControllerFacingDirection(facingDir);
            }

            if (wheelActive) {
                if (skillWheelState && typeof skillWheelState === "object") {
                    skillWheelState.active = true;
                    skillWheelState.aimX = rightAxisX;
                    skillWheelState.aimY = rightAxisY;
                    skillWheelState.selectedIndex = resolveSkillWheelSelection(
                        rightAxisX,
                        rightAxisY,
                        Number.isFinite(skillWheelState.selectedIndex) ? skillWheelState.selectedIndex : -1
                    );
                }
            }

            if (wheelActive && skillConfirmPressed && !gamepadMenuState.skillConfirmHeld) {
                const selectedIndex = Number.isFinite(skillWheelState?.selectedIndex)
                    ? skillWheelState.selectedIndex
                    : -1;
                if (selectedIndex >= 0 && typeof actions.onSkillSlotPressed === "function") {
                    const activated = Boolean(actions.onSkillSlotPressed(selectedIndex));
                    if (activated) {
                        setSkillWheelActive(false);
                        gamepadMenuState.skillWheelConsumedUntilRelease = true;
                    }
                }
            }

            if (wheelActive) {
                if (!inputLocked) {
                    inputManager.actionStates.moveUp = upPressed;
                    inputManager.actionStates.moveDown = downPressed;
                    inputManager.actionStates.moveLeft = leftPressed;
                    inputManager.actionStates.moveRight = rightPressed;
                } else {
                    clearGamepadMovement();
                }
                gamepadMenuState.confirmHeld = confirmPressed;
                gamepadMenuState.backHeld = backPressed;
                gamepadMenuState.questHeld = questPressed;
                gamepadMenuState.leftoversHeld = leftoversPressed;
                gamepadMenuState.startHeld = startPressed;
                gamepadMenuState.attackHeld = attackPressed;
                gamepadMenuState.inventoryHeld = inventoryPressed;
                gamepadMenuState.skillConfirmHeld = skillConfirmPressed;
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
            if (leftoversPressed && !gamepadMenuState.leftoversHeld && !dialogueActive && !inputLocked) {
                if (typeof actions.tryOpenLeftoversFromInteract === "function") {
                    actions.tryOpenLeftoversFromInteract();
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
            if (typeof actions.setControllerFacingDirection === "function") {
                actions.setControllerFacingDirection("");
            }
        }

        gamepadMenuState.confirmHeld = confirmPressed;
        gamepadMenuState.backHeld = backPressed;
        gamepadMenuState.questHeld = questPressed;
        gamepadMenuState.leftoversHeld = leftoversPressed;
        gamepadMenuState.startHeld = startPressed;
        gamepadMenuState.attackHeld = attackPressed;
        gamepadMenuState.inventoryHeld = inventoryPressed;
        gamepadMenuState.skillConfirmHeld = skillConfirmPressed;
    }

    return {
        update,
        reset: resetHeldStates
    };
}
