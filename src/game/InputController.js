import { GAME_STATES, isFreeExploreState } from "../core/constants.js";

export function createInputController({
    inputManager,
    titleScreenSystem,
    pauseMenuSystem,
    getGameState,
    actions
}) {
    const gamepadMenuState = {
        heldDirection: 0,
        nextMoveAt: 0,
        confirmHeld: false,
        backHeld: false,
        startHeld: false,
        attackHeld: false
    };

    function resetHeldStates() {
        gamepadMenuState.heldDirection = 0;
        gamepadMenuState.confirmHeld = false;
        gamepadMenuState.backHeld = false;
        gamepadMenuState.startHeld = false;
        gamepadMenuState.attackHeld = false;
    }

    function update(now) {
        if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return;
        const gamepads = navigator.getGamepads();
        const pad = Array.from(gamepads || []).find((candidate) => candidate && candidate.connected);
        if (!pad) {
            resetHeldStates();
            return;
        }
        inputManager.setInputMethod("gamepad");

        const buttons = pad.buttons || [];
        const axisY = Array.isArray(pad.axes) && pad.axes.length > 1 ? pad.axes[1] : 0;
        const upPressed = Boolean(buttons[12]?.pressed) || axisY < -0.58;
        const downPressed = Boolean(buttons[13]?.pressed) || axisY > 0.58;
        const direction = upPressed ? -1 : downPressed ? 1 : 0;

        const confirmPressed = Boolean(buttons[0]?.pressed); // A
        const backPressed = Boolean(buttons[1]?.pressed); // B
        const attackPressed = Boolean(buttons[2]?.pressed); // X
        const startPressed = Boolean(buttons[9]?.pressed); // Start

        const gameState = getGameState();

        if (gameState === GAME_STATES.TITLE_SCREEN) {
            if (direction !== 0 && (direction !== gamepadMenuState.heldDirection || now >= gamepadMenuState.nextMoveAt)) {
                titleScreenSystem.handleKeyDown(direction === 1 ? "arrowdown" : "arrowup", actions.titleCallbacks);
                gamepadMenuState.heldDirection = direction;
                gamepadMenuState.nextMoveAt = now + 170;
            } else if (direction === 0) {
                gamepadMenuState.heldDirection = 0;
            }

            if ((confirmPressed || startPressed) && !gamepadMenuState.confirmHeld) {
                titleScreenSystem.handleKeyDown("enter", actions.titleCallbacks);
            }

            gamepadMenuState.confirmHeld = confirmPressed || startPressed;
            gamepadMenuState.backHeld = backPressed;
            gamepadMenuState.startHeld = startPressed;
            gamepadMenuState.attackHeld = attackPressed;
            return;
        }

        if (gameState === GAME_STATES.PAUSE_MENU) {
            const pauseActions = {
                onResume: actions.onResume,
                onInventory: actions.onInventory,
                onAttributes: actions.onAttributes,
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
            gamepadMenuState.startHeld = startPressed;
            gamepadMenuState.attackHeld = attackPressed;
            return;
        }

        // Settings logic...
        if (gameState === GAME_STATES.SETTINGS) {
            // Similar to PauseMenu logic, but simpler mapping?
            // Previous code called moveSettingsSelection(direction).
            // PauseMenuSystem handles Settings input via handleKeyDown too if mode is settings.
            const settingsActions = { ...actions, inputManager };

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
        } else if (gameState === GAME_STATES.INVENTORY || gameState === GAME_STATES.ATTRIBUTES) {
            if (
                (confirmPressed && !gamepadMenuState.confirmHeld) ||
                (backPressed && !gamepadMenuState.backHeld) ||
                (startPressed && !gamepadMenuState.startHeld)
            ) {
                actions.closePauseMenu(); // returnToPauseMenu
            }
        } else if (isFreeExploreState(gameState)) {
            if (startPressed && !gamepadMenuState.startHeld) {
                actions.openPauseMenu();
            }
            if (attackPressed && !gamepadMenuState.attackHeld) { // Removed canRunCombatSystems check because main.js handles it? 
                // Previous code checked canRunCombatSystems(). I should pass that as a callback or getter?
                // actions.canRunCombatSystems()
                if (actions.canRunCombatSystems && actions.canRunCombatSystems()) {
                    inputManager.triggerAttackPressed();
                }
            }
        }

        gamepadMenuState.confirmHeld = confirmPressed;
        gamepadMenuState.backHeld = backPressed;
        gamepadMenuState.startHeld = startPressed;
        gamepadMenuState.attackHeld = attackPressed;
    }

    return {
        update,
        reset: resetHeldStates
    };
}
