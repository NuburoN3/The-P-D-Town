import test from "node:test";
import assert from "node:assert/strict";

import { GAME_STATES } from "../src/core/constants.js";
import { createEnemyAISystem } from "../src/game/EnemyAISystem.js";

test("EnemyAISystem supports registering custom behaviors", () => {
  const ai = createEnemyAISystem({ tileSize: 32 });
  const registered = ai.registerBehavior("testBoss", ({ enemy }) => {
    enemy.state = "special";
    enemy.customTicks = (enemy.customTicks || 0) + 1;
  });
  assert.equal(registered, true);

  const enemy = {
    id: "boss-1",
    world: "arena",
    behaviorType: "testBoss",
    dead: false,
    state: "idle",
    x: 0,
    y: 0,
    width: 32,
    height: 32,
    spawnX: 0,
    spawnY: 0,
    speed: 1,
    attackRange: 20,
    aggroRange: 100,
    attackCooldownMs: 1000,
    attackWindupMs: 100,
    attackRecoveryMs: 100,
    lastAttackAt: -Infinity,
    attackStrikeAt: 0,
    recoverUntil: 0,
    pendingStrike: false,
    invulnerableUntil: 0,
    hitStunUntil: 0,
    respawnEnabled: false
  };

  ai.update({
    now: 200,
    gameState: GAME_STATES.OVERWORLD,
    enemies: [enemy],
    player: { x: 200, y: 200 },
    currentAreaId: "arena",
    currentMap: Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => 0)),
    currentMapW: 3,
    currentMapH: 3,
    collidesAt: () => false
  });

  assert.equal(enemy.state, "special");
  assert.equal(enemy.customTicks, 1);
});
