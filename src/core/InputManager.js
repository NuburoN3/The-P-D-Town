// ============================================================================
// INPUT MANAGER - Centralized input handling with explicit lifecycle
// ============================================================================

export const DEFAULT_KEY_BINDINGS = Object.freeze({
  moveUp: ["w", "arrowup"],
  moveDown: ["s", "arrowdown"],
  moveLeft: ["a", "arrowleft"],
  moveRight: ["d", "arrowright"],
  interact: ["space"],
  attack: ["j", "k"],
  inventory: ["i"],
  pause: ["enter", "escape"]
});

const MOVEMENT_ACTIONS = ["moveUp", "moveDown", "moveLeft", "moveRight"];

function normalizeKey(key) {
  if (typeof key !== "string") return "";
  if (key === " ") return "space";
  return key.toLowerCase();
}

function normalizeBindings(bindings) {
  const output = {};

  for (const [action, defaults] of Object.entries(DEFAULT_KEY_BINDINGS)) {
    const source = Array.isArray(bindings?.[action]) ? bindings[action] : defaults;
    const normalized = source
      .map((key) => normalizeKey(key))
      .filter((key, index, arr) => key.length > 0 && arr.indexOf(key) === index);
    output[action] = normalized.length > 0 ? normalized : [...defaults];
  }

  return output;
}

export class InputManager {
  constructor({
    target = window,
    onToggleInventory = null,
    shouldHandleInput = null,
    keyBindings = null
  } = {}) {
    this.target = target;
    this.onToggleInventory = onToggleInventory;
    this.shouldHandleInput = shouldHandleInput || (() => true);
    this.bindings = normalizeBindings(keyBindings);
    this.keys = {};
    this.actionStates = {
      moveUp: false,
      moveDown: false,
      moveLeft: false,
      moveRight: false
    };
    this.interactPressed = false;
    this.attackPressed = false;
    this.pausePressed = false;
    this.lastInputMethod = "keyboard";
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

  getAttackPressed() {
    return this.attackPressed;
  }

  clearAttackPressed() {
    this.attackPressed = false;
  }

  getPausePressed() {
    return this.pausePressed;
  }

  clearPausePressed() {
    this.pausePressed = false;
  }

  triggerAttackPressed() {
    this.attackPressed = true;
  }

  isActionPressed(action) {
    return Boolean(this.actionStates[action]);
  }

  isMoving() {
    return MOVEMENT_ACTIONS.some((action) => Boolean(this.actionStates[action]));
  }

  getBindings() {
    return {
      ...this.bindings,
      moveUp: [...this.bindings.moveUp],
      moveDown: [...this.bindings.moveDown],
      moveLeft: [...this.bindings.moveLeft],
      moveRight: [...this.bindings.moveRight],
      interact: [...this.bindings.interact],
      attack: [...this.bindings.attack],
      inventory: [...this.bindings.inventory],
      pause: [...this.bindings.pause]
    };
  }

  getPrimaryBinding(action) {
    const keys = this.bindings[action];
    if (!Array.isArray(keys) || keys.length === 0) return null;
    return keys[0];
  }

  getActionBindings(action) {
    const keys = this.bindings[action];
    return Array.isArray(keys) ? [...keys] : [];
  }

  setPrimaryBinding(action, key) {
    if (!Array.isArray(this.bindings[action])) return { ok: false, reason: "unknown-action" };
    const normalized = normalizeKey(key);
    if (!normalized) return { ok: false, reason: "invalid-key" };

    for (const [otherAction, keys] of Object.entries(this.bindings)) {
      if (otherAction === action) continue;
      if (keys[0] === normalized) {
        return { ok: false, reason: "primary-conflict", conflictAction: otherAction };
      }
    }

    const next = this.bindings[action].filter((existing) => existing !== normalized);
    this.bindings[action] = [normalized, ...next].slice(0, 2);
    this._recomputeMovementStates();
    return { ok: true };
  }

  applyBindings(bindings) {
    this.bindings = normalizeBindings(bindings);
    this._recomputeMovementStates();
  }

  matchesActionKey(action, key) {
    const normalized = normalizeKey(key);
    const keys = this.bindings[action];
    return Array.isArray(keys) && keys.includes(normalized);
  }

  setInputMethod(method) {
    if (method !== "keyboard" && method !== "gamepad") return;
    this.lastInputMethod = method;
  }

  getInputMethod() {
    return this.lastInputMethod;
  }

  static toDisplayKeyName(key) {
    const normalized = normalizeKey(key);
    if (normalized === "space") return "Space";
    if (normalized === "arrowup") return "Up Arrow";
    if (normalized === "arrowdown") return "Down Arrow";
    if (normalized === "arrowleft") return "Left Arrow";
    if (normalized === "arrowright") return "Right Arrow";
    if (normalized === "escape") return "Esc";
    if (normalized === "enter") return "Enter";
    return normalized.length === 1 ? normalized.toUpperCase() : normalized;
  }

  _isAnyKeyDownForAction(action) {
    const keys = this.bindings[action];
    if (!Array.isArray(keys)) return false;
    return keys.some((key) => Boolean(this.keys[key]));
  }

  _recomputeMovementStates() {
    for (const action of MOVEMENT_ACTIONS) {
      this.actionStates[action] = this._isAnyKeyDownForAction(action);
    }
  }

  _onKeyDown(e) {
    const key = normalizeKey(e.key);
    if (!key) return;
    this.keys[key] = true;
    this.lastInputMethod = "keyboard";

    if (this.matchesActionKey("moveUp", key)) {
      if (!this.shouldHandleInput()) return;
      this.actionStates.moveUp = true;
      e.preventDefault();
      return;
    }

    if (this.matchesActionKey("moveDown", key)) {
      if (!this.shouldHandleInput()) return;
      this.actionStates.moveDown = true;
      e.preventDefault();
      return;
    }

    if (this.matchesActionKey("moveLeft", key)) {
      if (!this.shouldHandleInput()) return;
      this.actionStates.moveLeft = true;
      e.preventDefault();
      return;
    }

    if (this.matchesActionKey("moveRight", key)) {
      if (!this.shouldHandleInput()) return;
      this.actionStates.moveRight = true;
      e.preventDefault();
      return;
    }

    if (this.matchesActionKey("interact", key)) {
      if (!this.shouldHandleInput()) return;
      this.interactPressed = true;
      e.preventDefault();
      return;
    }

    if (this.matchesActionKey("attack", key) && !e.repeat) {
      if (!this.shouldHandleInput()) return;
      this.attackPressed = true;
      e.preventDefault();
      return;
    }

    if (this.matchesActionKey("pause", key) && !e.repeat) {
      this.pausePressed = true;
    }

    if (this.matchesActionKey("inventory", key) && !e.repeat) {
      if (!this.shouldHandleInput()) return;
      if (this.onToggleInventory) {
        this.onToggleInventory();
      }
    }
  }

  _onKeyUp(e) {
    const key = normalizeKey(e.key);
    if (!key) return;
    this.keys[key] = false;

    if (this.matchesActionKey("moveUp", key)) {
      this.actionStates.moveUp = this._isAnyKeyDownForAction("moveUp");
    }
    if (this.matchesActionKey("moveDown", key)) {
      this.actionStates.moveDown = this._isAnyKeyDownForAction("moveDown");
    }
    if (this.matchesActionKey("moveLeft", key)) {
      this.actionStates.moveLeft = this._isAnyKeyDownForAction("moveLeft");
    }
    if (this.matchesActionKey("moveRight", key)) {
      this.actionStates.moveRight = this._isAnyKeyDownForAction("moveRight");
    }
  }
}
