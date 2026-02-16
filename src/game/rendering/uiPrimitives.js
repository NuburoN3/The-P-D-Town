export const FONT_12 = "600 12px 'Trebuchet MS', 'Segoe UI', sans-serif";
export const FONT_16 = "600 16px 'Trebuchet MS', 'Segoe UI', sans-serif";
export const FONT_20 = "600 20px 'Trebuchet MS', 'Segoe UI', sans-serif";
export const FONT_22 = "700 22px 'Trebuchet MS', 'Segoe UI', sans-serif";
export const FONT_28 = "700 28px 'Palatino Linotype', 'Book Antiqua', serif";

export function keyToDisplayName(key) {
  if (typeof key !== "string" || key.length === 0) return "-";
  if (key === "space") return "Space";
  if (key === "arrowup") return "Up Arrow";
  if (key === "arrowdown") return "Down Arrow";
  if (key === "arrowleft") return "Left Arrow";
  if (key === "arrowright") return "Right Arrow";
  if (key === "escape") return "Esc";
  if (key === "enter") return "Enter";
  return key.length === 1 ? key.toUpperCase() : key;
}

export function getPrimaryBindingLabel(state, action) {
  const keys = state.keyBindings?.[action];
  if (!Array.isArray(keys) || keys.length === 0) return "-";
  return keyToDisplayName(keys[0]);
}

export function getItemSpriteName(itemName) {
  const spriteMap = {
    "Training Headband": "trainingHeadband",
    "Dojo Membership Card": "dojoMembership"
  };
  return spriteMap[itemName] || null;
}

export function getItemSpriteScale(spriteName) {
  const defaultScale = 1.2;
  const scaleOverrides = {
    trainingHeadband: 1.5,
    dojoMembership: 1.0
  };
  return scaleOverrides[spriteName] ?? defaultScale;
}

export function drawEntityShadow(ctx, x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(
    Math.round(x + width / 2),
    Math.round(y + height - 3),
    Math.max(5, Math.round(width * 0.24)),
    Math.max(2, Math.round(height * 0.11)),
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

export function drawSkinnedPanel(ctx, x, y, width, height, colors, { titleBand = false } = {}) {
  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, colors.PANEL_SURFACE_TOP || colors.POPUP_BG);
  gradient.addColorStop(1, colors.PANEL_SURFACE_BOTTOM || colors.DIALOGUE_BG);
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = colors.PANEL_INNER || "rgba(255,255,255,0.04)";
  ctx.fillRect(x + 2, y + 2, width - 4, height - 4);

  const sheen = ctx.createLinearGradient(x + 2, y + 2, x + 2, y + Math.max(4, height * 0.45));
  sheen.addColorStop(0, "rgba(255,255,255,0.14)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(x + 2, y + 2, width - 4, Math.max(10, height * 0.45));

  if (titleBand) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x + 2, y + 2, width - 4, 28);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(x + 2, y + 29, width - 4, 1);
  }

  ctx.strokeStyle = colors.PANEL_BORDER_DARK || colors.DIALOGUE_BORDER;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, width - 3, height - 3);

  ctx.strokeStyle = colors.PANEL_BORDER_LIGHT || "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 4.5, y + 4.5, width - 9, height - 9);

  ctx.fillStyle = colors.PANEL_ACCENT || "rgba(255, 226, 161, 0.8)";
  ctx.fillRect(x + 8, y + 8, 4, 4);
  ctx.fillRect(x + width - 12, y + 8, 4, 4);
  ctx.fillRect(x + 8, y + height - 12, 4, 4);
  ctx.fillRect(x + width - 12, y + height - 12, 4, 4);
}

export function drawUiText(ctx, text, x, y, colors) {
  ctx.fillStyle = colors.TEXT_SHADOW || "rgba(0,0,0,0.4)";
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = colors.TEXT;
  ctx.fillText(text, x, y);
}

export function drawFantasySelectorIcon(ctx, x, y, { highContrast = false, pulse = 0 } = {}) {
  const outer = highContrast ? "#ffffff" : "#7b5124";
  const inner = highContrast ? "#57d4ff" : "#f6d388";
  const glow = highContrast ? "rgba(88,210,255,0.34)" : "rgba(244,208,131,0.34)";

  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 10 + pulse * 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(8, 0);
  ctx.lineTo(0, 8);
  ctx.lineTo(-8, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(5, 0);
  ctx.lineTo(0, 5);
  ctx.lineTo(-5, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = highContrast ? "#ffffff" : "#fff7dc";
  ctx.fillRect(-1, -7, 2, 3);
  ctx.fillRect(5, -1, 3, 2);

  ctx.restore();
}
