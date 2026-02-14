// ============================================================================
// INPUT MANAGER - Centralized input handling with explicit lifecycle
// ============================================================================

const MOVEMENT_KEYS = [
  "w", "a", "s", "d",
  "arrowup", "arrowdown", "arrowleft", "arrowright"
];

export class InputManager {
  constructor({ target = window, doc = document } = {}) {
    this.target = target;
    this.doc = doc;
    this.keys = {};
    this.interactPressed = false;
    this.initialized = false;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
  }

  initialize() {
    if (this.initialized) return;
    this.initialized = true;
    this.target.addEventListener("keydown", this._onKeyDown);
    this.target.addEventListener("keyup", this._onKeyUp);
  }

  dispose() {
    if (!this.initialized) return;
    this.initialized = false;
    this.target.removeEventListener("keydown", this._onKeyDown);
    this.target.removeEventListener("keyup", this._onKeyUp);
  }

  getInteractPressed() {
    return this.interactPressed;
  }

  clearInteractPressed() {
    this.interactPressed = false;
  }

  isMoving() {
    return MOVEMENT_KEYS.some((key) => Boolean(this.keys[key]));
  }

  _onKeyDown(e) {
    const key = e.key.toLowerCase();

    if (MOVEMENT_KEYS.includes(key)) {
      this.keys[key] = true;
      e.preventDefault();
      return;
    }

    if (key === "enter" || key === " ") {
      this.interactPressed = true;
      e.preventDefault();
      return;
    }

    if (key === "i") {
      this.doc.dispatchEvent(new Event("toggleInventory"));
    }
  }

  _onKeyUp(e) {
    const key = e.key.toLowerCase();
    if (MOVEMENT_KEYS.includes(key)) {
      this.keys[key] = false;
    }
  }
}

const defaultInputManager = new InputManager();

export const keys = defaultInputManager.keys;

export function initializeInput() {
  defaultInputManager.initialize();
}

export function getInteractPressed() {
  return defaultInputManager.getInteractPressed();
}

export function clearInteractPressed() {
  defaultInputManager.clearInteractPressed();
}

export function isMoving() {
  return defaultInputManager.isMoving();
}
