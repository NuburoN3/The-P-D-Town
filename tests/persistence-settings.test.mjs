import test from "node:test";
import assert from "node:assert/strict";

import { sanitizeUserSettings } from "../src/core/Persistence.js";

test("sanitizeUserSettings normalizes booleans and clamps text speed", () => {
  const normalized = sanitizeUserSettings({
    highContrastMenu: 1,
    screenShake: false,
    reducedFlashes: "yes",
    textSpeedMultiplier: 9,
    keybindings: { attack: ["j"] }
  });

  assert.equal(normalized.highContrastMenu, true);
  assert.equal(normalized.screenShake, false);
  assert.equal(normalized.reducedFlashes, true);
  assert.equal(normalized.textSpeedMultiplier, 2);
  assert.deepEqual(normalized.keybindings, { attack: ["j"] });
});
