export function createInputBindings({
  canvas,
  mouseUiState,
  getGameState,
  gameStates,
  input,
  inputManagerClass,
  choiceState,
  dialogue,
  confirmChoice,
  settingsUiState,
  setSettingsStatus,
  musicManager,
  persistUserSettings,
  titleScreenSystem,
  pauseMenuSystem,
  performSaveGame,
  performStartNewGame,
  performLoadGame,
  resumeFromPauseMenu,
  openInventoryFromPauseMenu,
  closeInventory,
  isInventoryOpenedFromPauseMenu,
  isLeftoversInventoryOpen = () => false,
  openAttributesFromPauseMenu,
  openSettingsFromPauseMenu,
  returnToPauseMenu,
  openPauseMenu,
  isFreeExploreState,
  updateMenuHoverStateFromMouse,
  clearMenuHoverState,
  handleTitleLeftClick,
  handlePauseMenuLeftClick,
  handleSkillSlotPressed,
  tryOpenLeftoversFromInteract = () => false
}) {
  const POINTER_LOCK_ENABLED = true;
  let pointerLockPrimed = false;

  function normalizeInputKey(key) {
    const normalized = String(key || "").toLowerCase();
    if (normalized === " " || normalized === "space" || normalized === "spacebar") {
      return "space";
    }
    return normalized;
  }

  function isPauseKey(key) {
    return input.matchesActionKey("pause", key) && !input.matchesActionKey("inventory", key);
  }

  function getSkillSlotIndexFromKeyboardEvent(e, key) {
    if (/^[1-9]$/.test(key)) return Number.parseInt(key, 10) - 1;
    const code = String(e.code || "");
    if (code.startsWith("Numpad")) {
      const digit = code.slice(6);
      if (/^[1-9]$/.test(digit)) return Number.parseInt(digit, 10) - 1;
    }
    return -1;
  }

  function updateMouseUiPosition(e) {
    const rect = canvas.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouseUiState.x = (e.clientX - rect.left) * scaleX;
    mouseUiState.y = (e.clientY - rect.top) * scaleY;
    mouseUiState.insideCanvas = true;
    updateMenuHoverStateFromMouse(mouseUiState.x, mouseUiState.y);
  }

  function canUsePointerLock() {
    return POINTER_LOCK_ENABLED &&
      typeof canvas.requestPointerLock === "function" &&
      typeof document.exitPointerLock === "function";
  }

  function shouldUnlockPointerForCurrentState() {
    const gameState = getGameState();
    return (
      gameState === gameStates.TITLE_SCREEN ||
      gameState === gameStates.PAUSE_MENU ||
      gameState === gameStates.INVENTORY ||
      gameState === gameStates.ATTRIBUTES ||
      gameState === gameStates.SETTINGS
    );
  }

  function requestCanvasPointerLock() {
    if (!canUsePointerLock()) return;
    try {
      const maybePromise = canvas.requestPointerLock();
      if (maybePromise && typeof maybePromise.catch === "function") {
        maybePromise.catch(() => { });
      }
    } catch {
      // Ignore lock errors (e.g. browser gesture policy).
    }
  }

  function syncPointerLockWithState({ fromUserGesture = false } = {}) {
    if (!canUsePointerLock()) return;

    const isLockedToCanvas = document.pointerLockElement === canvas;
    if (shouldUnlockPointerForCurrentState()) {
      if (isLockedToCanvas) {
        document.exitPointerLock();
      }
      return;
    }

    if (!pointerLockPrimed || isLockedToCanvas || !fromUserGesture) return;
    requestCanvasPointerLock();
  }

  function registerPointerBindings() {
    canvas.addEventListener("mousemove", updateMouseUiPosition);
    canvas.addEventListener("mouseleave", () => {
      mouseUiState.insideCanvas = false;
      mouseUiState.sprintPressed = false;
      mouseUiState.inventoryLeftDown = false;
      mouseUiState.inventoryPanelDragTarget = "";
      mouseUiState.inventoryClickRequest = false;
      mouseUiState.inventoryDoubleClickRequest = false;
      clearMenuHoverState();
    });
    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });
    canvas.addEventListener("mousedown", (e) => {
      pointerLockPrimed = true;
      updateMouseUiPosition(e);
      if (e.button === 0 && getGameState() === gameStates.INVENTORY) {
        mouseUiState.inventoryLeftDown = true;
        mouseUiState.inventoryDragStartRequest = true;
        e.preventDefault();
      }
      if (e.button === 2) {
        if (getGameState() === gameStates.INVENTORY) {
          mouseUiState.inventoryDetailsRequest = true;
        } else {
          mouseUiState.sprintPressed = true;
        }
        e.preventDefault();
      }
      syncPointerLockWithState({ fromUserGesture: true });
    });
    canvas.addEventListener("mouseup", (e) => {
      if (e.button === 0) {
        mouseUiState.inventoryLeftDown = false;
        mouseUiState.inventoryPanelDragTarget = "";
        if (mouseUiState.inventoryDragItemName) {
          mouseUiState.inventoryDragReleaseRequest = true;
        }
      }
      if (e.button === 2) {
        mouseUiState.sprintPressed = false;
      }
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) {
        mouseUiState.inventoryLeftDown = false;
        mouseUiState.inventoryPanelDragTarget = "";
        if (mouseUiState.inventoryDragItemName) {
          mouseUiState.inventoryDragReleaseRequest = true;
        }
      }
      if (e.button === 2) {
        mouseUiState.sprintPressed = false;
      }
    });
    window.addEventListener("blur", () => {
      mouseUiState.sprintPressed = false;
      mouseUiState.inventoryLeftDown = false;
      mouseUiState.inventoryPanelDragTarget = "";
      mouseUiState.inventoryClickRequest = false;
      mouseUiState.inventoryDoubleClickRequest = false;
      if (mouseUiState.inventoryDragItemName) {
        mouseUiState.inventoryDragReleaseRequest = true;
      }
    });
    canvas.addEventListener("click", (e) => {
      if (e.button !== 0) return;
      updateMouseUiPosition(e);
      const gameState = getGameState();
      if (gameState === gameStates.INVENTORY) {
        mouseUiState.inventoryClickRequest = true;
        e.preventDefault();
        return;
      }
      const handledByTitle = handleTitleLeftClick(mouseUiState.x, mouseUiState.y);
      const handledByPause = handledByTitle ? false : handlePauseMenuLeftClick(mouseUiState.x, mouseUiState.y);
      if (handledByTitle || handledByPause) {
        e.preventDefault();
        return;
      }
      if (isFreeExploreState(gameState)) {
        input.triggerAttackPressed();
        e.preventDefault();
      }
    });
    canvas.addEventListener("dblclick", (e) => {
      if (e.button !== 0) return;
      updateMouseUiPosition(e);
      if (getGameState() === gameStates.INVENTORY) {
        mouseUiState.inventoryDoubleClickRequest = true;
        e.preventDefault();
      }
    });
    canvas.addEventListener("wheel", (e) => {
      const gameState = getGameState();
      if (gameState !== gameStates.SETTINGS) return;
      const handled = pauseMenuSystem.handleSettingsWheel(e.deltaY);
      if (handled) {
        e.preventDefault();
      }
    });

    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement === canvas) {
        mouseUiState.insideCanvas = true;
        return;
      }
      mouseUiState.insideCanvas = false;
    });
  }

  function registerKeyboardBindings() {
    addEventListener("keydown", (e) => {
      if (!choiceState.active) return;
      const key = normalizeInputKey(e.key);

      if (!e.repeat && (key === "arrowup" || key === "arrowdown" || key === "w" || key === "s")) {
        const direction = (key === "arrowup" || key === "w") ? -1 : 1;
        const total = choiceState.options.length;
        choiceState.selected = (choiceState.selected + direction + total) % total;
      }

      if (input.matchesActionKey("interact", key) && !e.repeat) {
        confirmChoice();
        input.clearInteractPressed();
      }
    });

    addEventListener("keydown", (e) => {
      syncPointerLockWithState({ fromUserGesture: true });
      if (choiceState.active) return;
      const key = normalizeInputKey(e.key);
      const gameState = getGameState();

      if (
        dialogue &&
        typeof dialogue.isActive === "function" &&
        dialogue.isActive() &&
        !choiceState.active &&
        input.matchesActionKey("attack", key) &&
        !e.repeat
      ) {
        if (typeof dialogue.isCurrentPageFullyVisible === "function" && !dialogue.isCurrentPageFullyVisible()) {
          dialogue.revealCurrentPage();
        } else if (typeof dialogue.advance === "function") {
          dialogue.advance();
        }
        input.clearAttackPressed();
        e.preventDefault();
        return;
      }

      if (gameState === gameStates.SETTINGS && settingsUiState.awaitingRebindAction && !e.repeat) {
        if (key === "escape") {
          settingsUiState.awaitingRebindAction = null;
          setSettingsStatus("Rebind cancelled.", 1200);
          musicManager.playSfx("menuConfirm");
          e.preventDefault();
          return;
        }

        const result = input.setPrimaryBinding(settingsUiState.awaitingRebindAction, key);
        if (result.ok) {
          persistUserSettings();
          const bindingName = inputManagerClass.toDisplayKeyName(input.getPrimaryBinding(settingsUiState.awaitingRebindAction));
          setSettingsStatus(`Bound to ${bindingName}.`, 1300);
          musicManager.playSfx("menuConfirm");
        } else if (result.reason === "primary-conflict") {
          musicManager.playSfx("uiError");
          setSettingsStatus("Key already used by another action.", 1700);
        } else {
          musicManager.playSfx("uiError");
          setSettingsStatus("Invalid key.", 1700);
        }
        settingsUiState.awaitingRebindAction = null;
        e.preventDefault();
        return;
      }

      if (gameState === gameStates.TITLE_SCREEN) {
        titleScreenSystem.handleKeyDown(key, {
          onStartGame: performStartNewGame,
          onContinueGame: performLoadGame
        });
        e.preventDefault();
        return;
      }

      if (gameState === gameStates.INTRO_CUTSCENE) {
        e.preventDefault();
        return;
      }

      if (gameState === gameStates.PAUSE_MENU || gameState === gameStates.SETTINGS) {
        pauseMenuSystem.handleKeyDown(key, {
          onResume: resumeFromPauseMenu,
          onInventory: openInventoryFromPauseMenu,
          onAttributes: openAttributesFromPauseMenu,
          onSettings: openSettingsFromPauseMenu,
          onBackToPause: returnToPauseMenu,
          onSave: performSaveGame,
          onLoad: performLoadGame,
          onQuit: () => {
            location.reload();
          },
          inputManager: input
        });
        e.preventDefault();
        return;
      }

      if (gameState === gameStates.INVENTORY) {
        if (input.matchesActionKey("interact", key) && !e.repeat && isLeftoversInventoryOpen()) {
          if (typeof closeInventory === "function") {
            closeInventory();
          } else {
            returnToPauseMenu();
          }
          e.preventDefault();
          return;
        }
        if ((
          key === "enter" ||
          key === "escape" ||
          isPauseKey(key)
        ) && !e.repeat) {
          if (typeof isInventoryOpenedFromPauseMenu === "function" && isInventoryOpenedFromPauseMenu()) {
            returnToPauseMenu();
          } else if (typeof closeInventory === "function") {
            closeInventory();
          } else {
            returnToPauseMenu();
          }
          e.preventDefault();
        }
        return;
      }

      if (gameState === gameStates.ATTRIBUTES) {
        if ((
          key === "enter" ||
          key === "escape" ||
          isPauseKey(key)
        ) && !e.repeat) {
          returnToPauseMenu();
          e.preventDefault();
        }
        return;
      }

      if (isFreeExploreState(gameState) && !e.repeat) {
        if (input.matchesActionKey("interact", key)) {
          const openedLeftovers = tryOpenLeftoversFromInteract();
          if (openedLeftovers) {
            e.preventDefault();
            return;
          }
        }
        const skillSlotIndex = getSkillSlotIndexFromKeyboardEvent(e, key);
        if (skillSlotIndex >= 0 && typeof handleSkillSlotPressed === "function") {
          handleSkillSlotPressed(skillSlotIndex);
          e.preventDefault();
          return;
        }
      }

      if ((key === "enter" || key === "escape" || isPauseKey(key)) && !e.repeat && isFreeExploreState(gameState)) {
        openPauseMenu();
      }
    });
  }

  function register() {
    if (typeof document !== "undefined" && document.pointerLockElement === canvas && typeof document.exitPointerLock === "function") {
      document.exitPointerLock();
    }
    registerPointerBindings();
    registerKeyboardBindings();
  }

  return {
    syncPointerLockWithState,
    register
  };
}
