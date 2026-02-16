function createDefaultsForType(type) {
  if (type === "trainingBurst") {
    return {
      durationMs: 720,
      size: 34,
      color: "rgba(255, 219, 145, 0.95)",
      glowColor: "rgba(255, 180, 104, 0.35)"
    };
  }

  if (type === "pickupGlow") {
    return {
      durationMs: 950,
      size: 26,
      color: "rgba(179, 241, 255, 0.95)",
      glowColor: "rgba(104, 200, 255, 0.28)"
    };
  }

  if (type === "doorSwirl") {
    return {
      durationMs: 720,
      size: 30,
      color: "rgba(255, 238, 181, 0.88)",
      glowColor: "rgba(255, 188, 116, 0.28)"
    };
  }

  if (type === "attackSlash") {
    return {
      durationMs: 210,
      size: 30,
      color: "rgba(255, 243, 214, 0.95)",
      glowColor: "rgba(255, 212, 132, 0.22)"
    };
  }

  if (type === "hitSpark") {
    return {
      durationMs: 260,
      size: 20,
      color: "rgba(255, 188, 142, 0.95)",
      glowColor: "rgba(255, 154, 92, 0.24)"
    };
  }

  if (type === "damageText") {
    return {
      durationMs: 560,
      size: 20,
      color: "rgba(255, 224, 184, 0.98)",
      glowColor: "rgba(0, 0, 0, 0)"
    };
  }

  if (type === "warningRing") {
    return {
      durationMs: 280,
      size: 26,
      color: "rgba(255, 166, 132, 0.95)",
      glowColor: "rgba(255, 115, 87, 0.24)"
    };
  }

  return {
    durationMs: 450,
    size: 24,
    color: "rgba(255, 246, 214, 0.9)",
    glowColor: "rgba(255, 223, 145, 0.24)"
  };
}

export function createVfxSystem() {
  const effects = [];

  function spawn(type, options = {}) {
    if (!type) return;
    const defaults = createDefaultsForType(type);
    const now = performance.now();
    effects.push({
      id: `${type}-${Math.floor(now)}-${Math.random().toString(16).slice(2, 8)}`,
      type,
      startedAt: now,
      x: options.x ?? 0,
      y: options.y ?? 0,
      durationMs: options.durationMs ?? defaults.durationMs,
      size: options.size ?? defaults.size,
      color: options.color || defaults.color,
      glowColor: options.glowColor || defaults.glowColor,
      text: options.text || "",
      intensity: options.intensity ?? 1
    });
  }

  function update(now = performance.now()) {
    for (let i = effects.length - 1; i >= 0; i--) {
      const effect = effects[i];
      if (now - effect.startedAt > effect.durationMs) {
        // Swap-remove: O(1) instead of splice O(n)
        effects[i] = effects[effects.length - 1];
        effects.pop();
      }
    }
  }

  function clear() {
    effects.length = 0;
  }

  return {
    effects,
    spawn,
    update,
    clear
  };
}
