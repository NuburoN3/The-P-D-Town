function directionToVector(dir) {
  if (dir === "up") return { x: 0, y: -1 };
  if (dir === "left") return { x: -1, y: 0 };
  if (dir === "right") return { x: 1, y: 0 };
  return { x: 0, y: 1 };
}

export function createDefaultAttackCatalog(tileSize) {
  const lightSlash = {
    id: "lightSlash",
    cooldownMs: 290,
    windupMs: 70,
    activeMs: 110,
    recoveryMs: 160,
    range: tileSize * 0.9,
    hitRadius: tileSize * 0.7,
    damage: 20,
    hitstopMs: 48,
    vfx: {
      type: "attackSlash",
      durationMs: 190,
      sizeOffset: 8
    },
    getAttackCenter(attacker) {
      const facing = directionToVector(attacker.dir);
      return {
        x: attacker.x + tileSize / 2 + facing.x * this.range,
        y: attacker.y + tileSize / 2 + facing.y * this.range
      };
    },
    getVfxOrigin(attacker) {
      const facing = directionToVector(attacker.dir);
      return {
        x: attacker.x + tileSize / 2 + facing.x * (this.range * 0.55),
        y: attacker.y + tileSize / 2 + facing.y * (this.range * 0.55)
      };
    }
  };

  const heavySlash = {
    id: "heavySlash",
    cooldownMs: 460,
    windupMs: 120,
    activeMs: 130,
    recoveryMs: 220,
    range: tileSize * 1.02,
    hitRadius: tileSize * 0.82,
    damage: 34,
    hitstopMs: 72,
    vfx: {
      type: "attackSlash",
      durationMs: 250,
      sizeOffset: 14
    },
    getAttackCenter(attacker) {
      const facing = directionToVector(attacker.dir);
      return {
        x: attacker.x + tileSize / 2 + facing.x * this.range,
        y: attacker.y + tileSize / 2 + facing.y * this.range
      };
    },
    getVfxOrigin(attacker) {
      const facing = directionToVector(attacker.dir);
      return {
        x: attacker.x + tileSize / 2 + facing.x * (this.range * 0.58),
        y: attacker.y + tileSize / 2 + facing.y * (this.range * 0.58)
      };
    }
  };

  const chiBolt = {
    id: "chiBolt",
    cooldownMs: 540,
    windupMs: 100,
    activeMs: 100,
    recoveryMs: 180,
    range: tileSize * 2.8,
    hitRadius: tileSize * 0.65,
    damage: 16,
    hitstopMs: 40,
    vfx: {
      type: "attackSlash",
      durationMs: 180,
      sizeOffset: 6
    },
    getAttackCenter(attacker) {
      const facing = directionToVector(attacker.dir);
      return {
        x: attacker.x + tileSize / 2 + facing.x * this.range,
        y: attacker.y + tileSize / 2 + facing.y * this.range
      };
    },
    getVfxOrigin(attacker) {
      const facing = directionToVector(attacker.dir);
      return {
        x: attacker.x + tileSize / 2 + facing.x * (this.range * 0.4),
        y: attacker.y + tileSize / 2 + facing.y * (this.range * 0.4)
      };
    }
  };

  return {
    [lightSlash.id]: lightSlash,
    [heavySlash.id]: heavySlash,
    [chiBolt.id]: chiBolt
  };
}

export function resolveAttackProfile(catalog, attackId, fallbackId = "lightSlash") {
  if (catalog && attackId && catalog[attackId]) return catalog[attackId];
  if (catalog && fallbackId && catalog[fallbackId]) return catalog[fallbackId];
  const keys = Object.keys(catalog || {});
  return keys.length > 0 ? catalog[keys[0]] : null;
}
