import test from "node:test";
import assert from "node:assert/strict";

import { GAME_STATES } from "../src/core/constants.js";
import { createCombatSystem } from "../src/game/CombatSystem.js";

function createPlayer() {
  return {
    x: 0,
    y: 0,
    dir: "right",
    attackState: "idle",
    attackStartedAt: 0,
    attackActiveAt: 0,
    attackActiveUntil: 0,
    attackRecoveryUntil: 0,
    lastAttackAt: -Infinity,
    equippedAttackId: "lightSlash",
    hp: 100,
    maxHp: 100,
    invulnerableUntil: 0,
    invulnerableMs: 500,
    spawnX: 0,
    spawnY: 0
  };
}

function createEnemy() {
  return {
    id: "enemy-1",
    world: "overworld",
    x: 0,
    y: 0,
    width: 32,
    height: 32,
    hp: 100,
    maxHp: 100,
    damage: 8,
    dead: false,
    state: "idle",
    pendingStrike: false,
    invulnerableUntil: 0,
    hitStunUntil: 0,
    respawnAt: 0,
    respawnDelayMs: 999
  };
}

test("CombatSystem supports registering custom attack profiles", () => {
  const defeated = [];
  const combat = createCombatSystem({
    tileSize: 32,
    eventHandlers: {
      onEntityDefeated: (enemy) => defeated.push(enemy.id)
    }
  });

  const added = combat.registerAttackProfile("testHeavy", {
    cooldownMs: 0,
    windupMs: 0,
    activeMs: 1,
    recoveryMs: 1,
    range: 0,
    hitRadius: 26,
    damage: 120,
    vfx: { type: "attackSlash", durationMs: 1, sizeOffset: 0 },
    getAttackCenter(attacker) {
      return { x: attacker.x + 16, y: attacker.y + 16 };
    },
    getVfxOrigin(attacker) {
      return { x: attacker.x + 16, y: attacker.y + 16 };
    }
  });
  assert.equal(added, true);

  const player = createPlayer();
  const enemy = createEnemy();
  combat.update({
    now: 100,
    gameState: GAME_STATES.OVERWORLD,
    attackPressed: true,
    requestedAttackId: "testHeavy",
    player,
    enemies: [enemy],
    currentAreaId: "overworld"
  });

  assert.equal(enemy.dead, true);
  assert.deepEqual(defeated, ["enemy-1"]);
});
