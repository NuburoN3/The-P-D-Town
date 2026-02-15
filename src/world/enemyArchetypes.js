export const ENEMY_ARCHETYPES = Object.freeze({
  dojoFighter: {
    maxHp: 38,
    damage: 8,
    speed: 1.02,
    aggroRangeTiles: 6,
    attackRangeTiles: 1.15,
    attackCooldownMs: 900,
    attackWindupMs: 240,
    attackRecoveryMs: 320,
    respawnDelayMs: 5000,
    behaviorType: "meleeChaser",
    attackType: "lightSlash"
  },
  rusher: {
    maxHp: 30,
    damage: 10,
    speed: 1.38,
    aggroRangeTiles: 7,
    attackRangeTiles: 1.0,
    attackCooldownMs: 860,
    attackWindupMs: 170,
    attackRecoveryMs: 240,
    respawnDelayMs: 4200,
    behaviorType: "meleeChaser",
    attackType: "lightSlash"
  },
  tank: {
    maxHp: 62,
    damage: 12,
    speed: 0.78,
    aggroRangeTiles: 5.2,
    attackRangeTiles: 1.2,
    attackCooldownMs: 1020,
    attackWindupMs: 280,
    attackRecoveryMs: 420,
    respawnDelayMs: 6200,
    behaviorType: "meleeChaser",
    attackType: "heavySlash"
  },
  rangedAcolyte: {
    maxHp: 28,
    damage: 7,
    speed: 0.92,
    aggroRangeTiles: 8,
    attackRangeTiles: 3.2,
    attackCooldownMs: 1180,
    attackWindupMs: 320,
    attackRecoveryMs: 360,
    respawnDelayMs: 5400,
    behaviorType: "rangedKiter",
    attackType: "chiBolt"
  }
});
