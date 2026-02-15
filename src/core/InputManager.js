// ============================================================================
// INPUT MANAGER - Centralized input handling with explicit lifecycle
// ============================================================================

const MOVEMENT_KEYS = [
  "w", "a", "s", "d",
  "arrowup", "arrowdown", "arrowleft", "arrowright"
];

export class InputManager {
  constructor({ target = window, onToggleInventory = null, shouldHandleInput = null } = {}) {
    this.target = target;
    this.onToggleInventory = onToggleInventory;
    this.shouldHandleInput = shouldHandleInput || (() => true);
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
      if (!this.shouldHandleInput()) return;
      this.keys[key] = true;
      e.preventDefault();
      return;
    }

    if (key === " ") {
      if (!this.shouldHandleInput()) return;
      this.interactPressed = true;
      e.preventDefault();
      return;
    }

    if (key === "i" && !e.repeat) {
      if (this.onToggleInventory) {
        this.onToggleInventory();
      }
    }
  }

  _onKeyUp(e) {
    const key = e.key.toLowerCase();
    if (MOVEMENT_KEYS.includes(key)) {
      this.keys[key] = false;
    }
  }
}
