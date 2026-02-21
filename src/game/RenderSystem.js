import { AREA_KINDS, BRANDING, GAME_STATES, TILE_TYPES, isFreeExploreState } from "../core/constants.js";
import { hash01 } from "../core/mathUtils.js";
import {
  FONT_12,
  FONT_16,
  FONT_20,
  FONT_22,
  FONT_28,
  getPrimaryBindingLabel,
  getItemSpriteName,
  getItemSpriteScale,
  drawSkinnedPanel,
  drawUiText,
  drawControlChip,
  drawFantasySelectorIcon
} from "./rendering/uiPrimitives.js";
import { drawEntitiesLayer } from "./rendering/entitiesLayer.js";
import { drawInventoryOverlay } from "./rendering/inventoryOverlay.js";
import {
  drawDoorTransition,
  drawPlayerDefeatOverlay,
  drawTextbox,
  drawTrainingPopup
} from "./rendering/overlayCore.js";
import { getFountainRenderSprite } from "../world/buildings/fountainSprite.js";
import { beginBuildingRenderFrame } from "../world/buildingRenderers.js";

// hash01 imported from ../core/mathUtils.js

const MOOD_PRESETS = Object.freeze({
  goldenDawn: {
    topTint: "rgba(255, 223, 159, 0.13)",
    bottomTint: "rgba(112, 73, 32, 0.14)",
    filmTint: "rgba(255, 231, 188, 0.08)"
  },
  inkQuiet: {
    topTint: "rgba(182, 223, 248, 0.08)",
    bottomTint: "rgba(26, 33, 49, 0.16)",
    filmTint: "rgba(140, 177, 214, 0.06)"
  },
  amberLounge: {
    topTint: "rgba(255, 210, 142, 0.12)",
    bottomTint: "rgba(74, 35, 22, 0.2)",
    filmTint: "rgba(255, 178, 109, 0.1)"
  }
});

const PAUSE_OPTION_SUBTITLES = Object.freeze({
  Resume: "Return to your current scene",
  Inventory: "Check your satchel and gathered goods",
  Attributes: "Inspect your discipline and growth",
  Settings: "Tune controls and visual comfort",
  "Save Game": "Save your current game",
  "Load Game": "Restore your last manual save",
  Quit: `Leave ${BRANDING.TITLE} for now`
});

const MOOD_UI_PRESETS = Object.freeze({
  goldenDawn: {
    PANEL_SURFACE_TOP: "#4f5439",
    PANEL_SURFACE_BOTTOM: "#2c2f22",
    PANEL_INNER: "#5e6447",
    PANEL_BORDER_LIGHT: "#ecd9a8",
    PANEL_BORDER_DARK: "#6f5b34",
    PANEL_ACCENT: "#e2c67f"
  },
  inkQuiet: {
    PANEL_SURFACE_TOP: "#2a3949",
    PANEL_SURFACE_BOTTOM: "#151f2c",
    PANEL_INNER: "#35495e",
    PANEL_BORDER_LIGHT: "#b8d7ec",
    PANEL_BORDER_DARK: "#3f5873",
    PANEL_ACCENT: "#8ec7ec"
  },
  amberLounge: {
    PANEL_SURFACE_TOP: "#5a3f2f",
    PANEL_SURFACE_BOTTOM: "#352219",
    PANEL_INNER: "#704f3b",
    PANEL_BORDER_LIGHT: "#efc08a",
    PANEL_BORDER_DARK: "#6f4325",
    PANEL_ACCENT: "#e2a96c"
  }
});

const DIALOGUE_UI_TRANSITION_STATE = {
  wasDialogueActive: false,
  revealStartedAt: 0,
  revealDurationMs: 900
};

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value) {
  const t = clamp01(value);
  return 1 - ((1 - t) ** 3);
}

function easeInCubic(value) {
  const t = clamp01(value);
  return t * t * t;
}

function easeOutBack(value) {
  const t = clamp01(value);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * ((t - 1) ** 3) + c1 * ((t - 1) ** 2);
}

function getFacingAngle(dir) {
  if (dir === "up") return -Math.PI * 0.5;
  if (dir === "left") return Math.PI;
  if (dir === "right") return 0;
  return Math.PI * 0.5;
}

function deriveUiColors(colors, moodPreset) {
  const moodOverrides = MOOD_UI_PRESETS[moodPreset];
  if (!moodOverrides) return colors;
  return {
    ...colors,
    ...moodOverrides
  };
}

function getDialogueUiAlpha(dialogueActive) {
  const now = performance.now();
  if (dialogueActive) {
    DIALOGUE_UI_TRANSITION_STATE.wasDialogueActive = true;
    return 0;
  }

  if (DIALOGUE_UI_TRANSITION_STATE.wasDialogueActive) {
    DIALOGUE_UI_TRANSITION_STATE.wasDialogueActive = false;
    DIALOGUE_UI_TRANSITION_STATE.revealStartedAt = now;
  }

  if (!DIALOGUE_UI_TRANSITION_STATE.revealStartedAt) {
    return 1;
  }

  const raw = clamp01((now - DIALOGUE_UI_TRANSITION_STATE.revealStartedAt) / DIALOGUE_UI_TRANSITION_STATE.revealDurationMs);
  if (raw >= 1) {
    DIALOGUE_UI_TRANSITION_STATE.revealStartedAt = 0;
    return 1;
  }

  return easeOutCubic(raw);
}

function drawPauseMenuOverlay(ctx, state, canvas, ui, colors) {
  const { gameState, pauseMenuState } = state;
  const isPauseActive = gameState === GAME_STATES.PAUSE_MENU;
  const mode = pauseMenuState?.animationMode || "idle";
  const startedAt = pauseMenuState?.animationStartedAt || 0;
  const duration = Math.max(1, pauseMenuState?.animationDurationMs || 160);
  const t = Math.min(1, (performance.now() - startedAt) / duration);

  let visibility = isPauseActive ? 1 : 0;
  if (mode === "in") {
    visibility = isPauseActive ? t : 0;
    if (isPauseActive && t >= 1 && pauseMenuState) pauseMenuState.animationMode = "idle";
  } else if (mode === "out") {
    visibility = 1 - t;
    if (t >= 1 && pauseMenuState) pauseMenuState.animationMode = "idle";
  }

  if (visibility <= 0.01) return;

  const highContrast = Boolean(pauseMenuState?.highContrast);
  const options = pauseMenuState?.options || ["Inventory", "Attributes", "Settings", "Save", "Load", "Quit"];
  const optionStartY = 106;
  const optionStep = 46;
  const minMenuH = 392;
  const requiredMenuH = optionStartY + Math.max(0, options.length - 1) * optionStep + 120;
  const baseDim = state.currentAreaKind === AREA_KINDS.OVERWORLD ? 0.22 : 0.42;
  const dimAlpha = Math.min(0.72, baseDim + (highContrast ? 0.15 : 0));
  ctx.fillStyle = `rgba(18, 14, 24, ${dimAlpha * visibility})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const menuW = 340;
  const menuH = Math.max(minMenuH, requiredMenuH);
  const slideOffset = (1 - visibility) * 34;
  const menuX = canvas.width - menuW - 24 + slideOffset;
  const menuY = (canvas.height - menuH) / 2;

  const aura = ctx.createRadialGradient(
    menuX + menuW * 0.5,
    menuY + menuH * 0.25,
    30,
    menuX + menuW * 0.5,
    menuY + menuH * 0.55,
    menuW
  );
  aura.addColorStop(0, highContrast ? "rgba(96, 182, 234, 0.22)" : "rgba(247, 214, 145, 0.22)");
  aura.addColorStop(1, "rgba(247, 214, 145, 0)");
  ctx.fillStyle = aura;
  ctx.fillRect(menuX - 20, menuY - 20, menuW + 40, menuH + 40);

  const parchment = ctx.createLinearGradient(menuX, menuY, menuX, menuY + menuH);
  parchment.addColorStop(0, highContrast ? "#212833" : "#f2e1b4");
  parchment.addColorStop(1, highContrast ? "#101722" : "#d7bb7d");
  ctx.fillStyle = parchment;
  ctx.fillRect(menuX, menuY, menuW, menuH);

  const inner = ctx.createLinearGradient(menuX + 5, menuY + 5, menuX + 5, menuY + menuH - 5);
  inner.addColorStop(0, highContrast ? "rgba(48,58,74,0.86)" : "rgba(255,248,222,0.75)");
  inner.addColorStop(1, highContrast ? "rgba(26,35,49,0.82)" : "rgba(230,205,146,0.62)");
  ctx.fillStyle = inner;
  ctx.fillRect(menuX + 5, menuY + 5, menuW - 10, menuH - 10);

  ctx.strokeStyle = highContrast ? "#a6dfff" : "#6c4b1d";
  ctx.lineWidth = 3;
  ctx.strokeRect(menuX + 1.5, menuY + 1.5, menuW - 3, menuH - 3);

  ctx.strokeStyle = highContrast ? "#eef8ff" : "#f7e1ab";
  ctx.lineWidth = 1;
  ctx.strokeRect(menuX + 6.5, menuY + 6.5, menuW - 13, menuH - 13);

  ctx.fillStyle = highContrast ? "#8dc9eb" : "#8b632b";
  ctx.fillRect(menuX + 10, menuY + 10, 12, 4);
  ctx.fillRect(menuX + 10, menuY + 10, 4, 12);
  ctx.fillRect(menuX + menuW - 22, menuY + 10, 12, 4);
  ctx.fillRect(menuX + menuW - 14, menuY + 10, 4, 12);
  ctx.fillRect(menuX + 10, menuY + menuH - 14, 12, 4);
  ctx.fillRect(menuX + 10, menuY + menuH - 22, 4, 12);
  ctx.fillRect(menuX + menuW - 22, menuY + menuH - 14, 12, 4);
  ctx.fillRect(menuX + menuW - 14, menuY + menuH - 22, 4, 12);

  const headerGradient = ctx.createLinearGradient(menuX + 8, menuY + 10, menuX + menuW - 8, menuY + 44);
  if (highContrast) {
    headerGradient.addColorStop(0, "rgba(41, 86, 118, 0.82)");
    headerGradient.addColorStop(0.5, "rgba(67, 132, 179, 0.74)");
    headerGradient.addColorStop(1, "rgba(41, 86, 118, 0.82)");
  } else {
    headerGradient.addColorStop(0, "rgba(116, 74, 32, 0.75)");
    headerGradient.addColorStop(0.5, "rgba(151, 105, 49, 0.65)");
    headerGradient.addColorStop(1, "rgba(116, 74, 32, 0.75)");
  }
  ctx.fillStyle = headerGradient;
  ctx.fillRect(menuX + 8, menuY + 10, menuW - 16, 34);

  ctx.font = FONT_28;
  ctx.fillStyle = highContrast ? "rgba(14, 28, 42, 0.5)" : "rgba(45, 24, 7, 0.45)";
  ctx.fillText("Menu", menuX + 25, menuY + 42);
  ctx.fillStyle = highContrast ? "#f7fdff" : "#fff2ca";
  ctx.fillText("Menu", menuX + 24, menuY + 41);

  const selected = pauseMenuState ? pauseMenuState.selected : 0;
  const hovered = pauseMenuState && Number.isInteger(pauseMenuState.hovered) ? pauseMenuState.hovered : -1;
  const activeIndex = hovered >= 0 ? hovered : selected;
  const shimmerPhase = (performance.now() % 1500) / 1500;

  ctx.font = FONT_20;
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    const y = menuY + optionStartY + i * optionStep;
    if (i === activeIndex) {
      const rowGradient = ctx.createLinearGradient(menuX + 24, y - 23, menuX + menuW - 22, y + 21);
      if (highContrast) {
        rowGradient.addColorStop(0, "rgba(82, 150, 196, 0.24)");
        rowGradient.addColorStop(0.5, "rgba(140, 214, 255, 0.5)");
        rowGradient.addColorStop(1, "rgba(82, 150, 196, 0.24)");
      } else {
        rowGradient.addColorStop(0, "rgba(153, 100, 40, 0.22)");
        rowGradient.addColorStop(0.5, "rgba(244, 209, 135, 0.45)");
        rowGradient.addColorStop(1, "rgba(153, 100, 40, 0.22)");
      }
      ctx.fillStyle = rowGradient;
      ctx.fillRect(menuX + 24, y - 23, menuW - 48, 44);

      // Moving light band for a subtle magical shimmer.
      const shimmerX = menuX + 24 + (menuW - 48) * shimmerPhase;
      const shimmer = ctx.createLinearGradient(shimmerX - 28, y - 23, shimmerX + 28, y + 21);
      shimmer.addColorStop(0, "rgba(255,255,255,0)");
      shimmer.addColorStop(0.5, highContrast ? "rgba(229,247,255,0.36)" : "rgba(255,244,212,0.35)");
      shimmer.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = shimmer;
      ctx.fillRect(menuX + 24, y - 23, menuW - 48, 44);

      ctx.strokeStyle = highContrast ? "rgba(166, 222, 255, 0.78)" : "rgba(118, 76, 30, 0.7)";
      ctx.lineWidth = 1;
      ctx.strokeRect(menuX + 24.5, y - 22.5, menuW - 49, 43);

      const pulse = Math.sin(performance.now() * 0.008) * 0.5 + 0.5;
      drawFantasySelectorIcon(ctx, menuX + 29, y - 2, { highContrast, pulse });
    }
    ctx.fillStyle = i === activeIndex ? (highContrast ? "#f7fdff" : "#3f250e") : (highContrast ? "#deeff9" : "#5a3718");
    ctx.fillText(option, menuX + 44, y);

    const subtitle = PAUSE_OPTION_SUBTITLES[option] || "";
    ctx.font = FONT_12;
    ctx.fillStyle = highContrast ? "rgba(207,232,245,0.92)" : "rgba(88, 56, 26, 0.84)";
    ctx.fillText(subtitle, menuX + 44, y + 14);
    ctx.font = FONT_20;

    // Rune-style separator marks between options.
    if (i < options.length - 1) {
      const sepY = y + 30;
      ctx.strokeStyle = highContrast ? "rgba(140, 194, 225, 0.52)" : "rgba(122, 80, 36, 0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(menuX + 34, sepY);
      ctx.lineTo(menuX + menuW - 34, sepY);
      ctx.stroke();

      ctx.fillStyle = highContrast ? "rgba(182, 230, 255, 0.84)" : "rgba(122, 80, 36, 0.8)";
      ctx.fillRect(menuX + menuW / 2 - 10, sepY - 1, 3, 3);
      ctx.fillRect(menuX + menuW / 2 + 7, sepY - 1, 3, 3);
      ctx.beginPath();
      ctx.moveTo(menuX + menuW / 2 - 2, sepY - 4);
      ctx.lineTo(menuX + menuW / 2 - 6, sepY);
      ctx.lineTo(menuX + menuW / 2 - 2, sepY + 4);
      ctx.lineTo(menuX + menuW / 2 + 2, sepY);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.font = FONT_12;
  ctx.fillStyle = highContrast ? "#d9f2ff" : "#5f3b19";
  const instructionX = menuX + 28;
  ctx.fillText("W/S or Arrows: Move   Mouse: Hover", instructionX, menuY + menuH - 60);
  ctx.fillText(`Space/Enter/Left Click: Select   ${getPrimaryBindingLabel(state, "pause")}: Resume`, instructionX, menuY + menuH - 40);
  ctx.fillText("Pad: D-Pad/Stick Move   A Select   B/Start Resume", instructionX, menuY + menuH - 20);
}

function drawAttributesOverlay(ctx, state, canvas, ui, colors) {
  const { gameState, playerStats } = state;
  if (gameState !== GAME_STATES.ATTRIBUTES) return;

  ctx.fillStyle = colors.INVENTORY_OVERLAY;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const boxW = ui.INVENTORY_BOX_WIDTH;
  const boxH = ui.INVENTORY_BOX_HEIGHT;
  const boxX = (canvas.width - boxW) / 2;
  const boxY = (canvas.height - boxH) / 2;

  drawSkinnedPanel(ctx, boxX, boxY, boxW, boxH, colors, { titleBand: true });

  ctx.font = FONT_28;
  ctx.fillStyle = "black";
  ctx.fillText("Attributes", boxX + 24, boxY + 42);

  ctx.font = FONT_20;
  ctx.fillStyle = "black";
  const levelY = boxY + 90;
  ctx.fillText(`Discipline Lv. ${playerStats.disciplineLevel}`, boxX + 24, levelY);

  const barX = boxX + 24;
  const barY = levelY + 18;
  const barW = boxW - 48;
  const barH = 20;
  const progressRatio = Math.min(1, playerStats.disciplineXP / playerStats.disciplineXPNeeded);

  ctx.fillStyle = colors.POPUP_BAR_BG;
  ctx.fillRect(barX, barY, barW, barH);

  ctx.fillStyle = colors.INVENTORY_BAR_FILL;
  ctx.fillRect(barX, barY, barW * progressRatio, barH);

  ctx.strokeStyle = colors.DIALOGUE_BORDER;
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barW, barH);

  ctx.font = FONT_16;
  const progressText = `${playerStats.disciplineXP} / ${playerStats.disciplineXPNeeded}`;
  const textWidth = ctx.measureText(progressText).width;
  ctx.fillStyle = "black";
  ctx.fillText(progressText, barX + (barW - textWidth) / 2, barY + 15);
}

function drawSettingsOverlay(ctx, state, canvas, ui, colors) {
  const { gameState, pauseMenuState, settingsUiState, settingsItems, userSettings } = state;
  if (gameState !== GAME_STATES.SETTINGS) return;

  const highContrast = Boolean(pauseMenuState?.highContrast);
  ctx.fillStyle = highContrast ? "rgba(0,0,0,0.7)" : colors.INVENTORY_OVERLAY;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const boxW = Math.min(canvas.width - 60, 690);
  const boxH = Math.min(canvas.height - 60, 470);
  const boxX = (canvas.width - boxW) / 2;
  const boxY = (canvas.height - boxH) / 2;

  drawSkinnedPanel(ctx, boxX, boxY, boxW, boxH, colors, { titleBand: true });

  ctx.font = FONT_28;
  drawUiText(ctx, "Settings", boxX + 24, boxY + 42, colors);

  const labelColor = highContrast ? "#f2fbff" : "#1f1203";
  const valueOnColor = highContrast ? "#90e4ff" : "#27632a";
  const valueOffColor = highContrast ? "#ffd57c" : "#7a3f1d";
  const entries = Array.isArray(settingsItems) ? settingsItems : [];
  const selected = Number.isFinite(settingsUiState?.selected) ? settingsUiState.selected : 0;
  const statusText = settingsUiState?.statusText || "";
  const awaitingRebindAction = settingsUiState?.awaitingRebindAction || null;

  const listX = boxX + 24;
  const listY = boxY + 76;
  const rowH = 28;
  const visibleRows = Math.max(8, Math.floor((boxH - 170) / rowH));
  const scrollStart = Math.max(0, Math.min(selected - Math.floor(visibleRows / 2), Math.max(0, entries.length - visibleRows)));
  const visibleEnd = Math.min(entries.length, scrollStart + visibleRows);

  ctx.font = FONT_16;
  for (let i = scrollStart; i < visibleEnd; i++) {
    const item = entries[i];
    const rowY = listY + (i - scrollStart) * rowH;
    const isSelected = i === selected;
    const isRebindingThis = awaitingRebindAction && item?.action === awaitingRebindAction;

    if (isSelected) {
      ctx.fillStyle = highContrast ? "rgba(145, 214, 255, 0.25)" : "rgba(255, 228, 164, 0.35)";
      ctx.fillRect(listX - 8, rowY - 18, boxW - 48, 24);
    }

    ctx.fillStyle = labelColor;
    const prefix = isSelected ? "> " : "  ";
    ctx.fillText(`${prefix}${item?.label || "Unknown setting"}`, listX, rowY);

    let valueText = "";
    let valueColor = valueOffColor;
    if (item?.kind === "toggle") {
      const enabled = item.id === "highContrastMenu"
        ? Boolean(pauseMenuState?.highContrast)
        : Boolean(userSettings?.[item.id]);
      valueText = enabled ? "ON" : "OFF";
      valueColor = enabled ? valueOnColor : valueOffColor;
    } else if (item?.kind === "cycle") {
      if (item.id === "textSpeedMultiplier") {
        const multiplier = Number.isFinite(userSettings?.textSpeedMultiplier) ? userSettings.textSpeedMultiplier : 1;
        valueText = `${Math.round(multiplier * 100)}%`;
      }
      valueColor = highContrast ? "#cfeeff" : "#50320f";
    } else if (item?.kind === "rebind") {
      valueText = isRebindingThis ? "[Press key...]" : getPrimaryBindingLabel(state, item.action);
      valueColor = isRebindingThis
        ? (highContrast ? "#90e4ff" : "#245b92")
        : (highContrast ? "#dbeffd" : "#5a3718");
    } else if (item?.kind === "action") {
      valueText = "Run";
      valueColor = highContrast ? "#dbeffd" : "#5a3718";
    }

    if (valueText) {
      ctx.fillStyle = valueColor;
      const valueWidth = ctx.measureText(valueText).width;
      ctx.fillText(valueText, boxX + boxW - 24 - valueWidth, rowY);
    }
  }

  const listRightX = boxX + boxW - 18;
  ctx.font = FONT_12;
  if (scrollStart > 0) {
    ctx.fillStyle = highContrast ? "rgba(210, 244, 255, 0.95)" : "rgba(92, 57, 23, 0.9)";
    ctx.fillText("^ More", listRightX - 40, listY - 8);
  }
  if (visibleEnd < entries.length) {
    const bottomY = listY + visibleRows * rowH + 4;
    ctx.fillStyle = highContrast ? "rgba(210, 244, 255, 0.95)" : "rgba(92, 57, 23, 0.9)";
    ctx.fillText("v More", listRightX - 40, bottomY);
  }

  const instructionsY = boxY + boxH - 74;
  ctx.font = FONT_12;
  ctx.fillStyle = labelColor;
  ctx.fillText("W/S or Arrows: Navigate   Mouse: Hover", boxX + 24, instructionsY);
  ctx.fillText("Space/Enter/Left Click or Gamepad A: Apply/Toggle", boxX + 24, instructionsY + 18);
  ctx.fillText("Esc or Gamepad B/Start: Back", boxX + 24, instructionsY + 36);

  if (statusText) {
    ctx.font = FONT_16;
    ctx.fillStyle = highContrast ? "#ddf5ff" : "#4e3213";
    ctx.fillText(statusText, boxX + 24, boxY + boxH - 16);
  }
}

function drawBarMinigameOverlay(ctx, state, canvas, colors) {
  if (state.gameState !== GAME_STATES.BAR_MINIGAME) return;
  const minigame = state.barMinigame;
  if (!minigame?.active) return;

  const panelW = Math.min(canvas.width - 40, 520);
  const panelH = 210;
  const panelX = Math.round((canvas.width - panelW) / 2);
  const panelY = Math.round((canvas.height - panelH) / 2);

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.52)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawSkinnedPanel(ctx, panelX, panelY, panelW, panelH, colors, { titleBand: true });

  ctx.font = FONT_28;
  drawUiText(ctx, "House Pour Challenge", panelX + 22, panelY + 40, colors);

  ctx.font = FONT_16;
  drawUiText(
    ctx,
    `Round ${minigame.round}/${minigame.totalRounds}   Wins ${minigame.wins}/${minigame.requiredWins}`,
    panelX + 22,
    panelY + 66,
    colors
  );

  const meterX = panelX + 28;
  const meterY = panelY + 96;
  const meterW = panelW - 56;
  const meterH = 34;

  ctx.fillStyle = "rgba(15,18,24,0.95)";
  ctx.fillRect(meterX, meterY, meterW, meterH);
  ctx.strokeStyle = colors.PANEL_BORDER_DARK || colors.DIALOGUE_BORDER;
  ctx.lineWidth = 2;
  ctx.strokeRect(meterX, meterY, meterW, meterH);

  const targetMin = Math.max(0, minigame.targetCenter - minigame.targetHalfWidth);
  const targetMax = Math.min(100, minigame.targetCenter + minigame.targetHalfWidth);
  const targetX = meterX + (targetMin / 100) * meterW;
  const targetW = ((targetMax - targetMin) / 100) * meterW;

  const targetGradient = ctx.createLinearGradient(0, meterY, 0, meterY + meterH);
  targetGradient.addColorStop(0, "#ffe28f");
  targetGradient.addColorStop(1, "#d6a43a");
  ctx.fillStyle = targetGradient;
  ctx.fillRect(targetX, meterY + 3, targetW, meterH - 6);

  const cursorX = meterX + (Math.max(0, Math.min(100, minigame.cursor)) / 100) * meterW;
  ctx.strokeStyle = "#f5f9ff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cursorX, meterY - 4);
  ctx.lineTo(cursorX, meterY + meterH + 4);
  ctx.stroke();

  ctx.font = FONT_20;
  drawUiText(ctx, minigame.feedbackText || "Press ENTER to pour", panelX + 22, panelY + 156, colors);

  ctx.font = FONT_16;
  drawUiText(ctx, "Press ENTER to pour", panelX + 22, panelY + 182, colors);

  ctx.restore();
}

function drawCombatHud(ctx, state, colors, tileSize, cameraZoom, getItemSprite = null) {
  if (!isFreeExploreState(state.gameState)) return;
  if (!state.player || !Number.isFinite(state.player.maxHp)) return;

  const slotCount = 9;
  const slotSize = 36;
  const slotGap = 4;
  const slotsW = slotCount * slotSize + (slotCount - 1) * slotGap;
  const slotsX = Math.round((ctx.canvas.width - slotsW) / 2);
  const slotsY = ctx.canvas.height - slotSize - 12;

  const barW = Math.min(Math.max(250, slotsW), ctx.canvas.width - 34);
  const barH = 12;
  const barX = Math.round((ctx.canvas.width - barW) / 2);
  const hpBarY = slotsY - 64;
  const manaBarY = slotsY - 38;
  const barsPanelY = hpBarY - 24;
  const barsPanelH = (manaBarY + barH) - barsPanelY + 12;
  const barsPanelX = barX - 12;
  const barsPanelW = barW + 24;

  const hpRatio = Math.max(0, Math.min(1, state.player.hp / Math.max(1, state.player.maxHp)));
  const maxMana = Number.isFinite(state.player.maxMana) ? Math.max(1, state.player.maxMana) : 10;
  const mana = Number.isFinite(state.player.mana) ? state.player.mana : maxMana;
  const manaRatio = Math.max(0, Math.min(1, mana / maxMana));
  const skillSlots = Array.isArray(state.player.skillSlots) ? state.player.skillSlots : [];
  const feedback = state.player.skillHudFeedback && typeof state.player.skillHudFeedback === "object"
    ? state.player.skillHudFeedback
    : null;
  const now = performance.now();
  const resolvedZoom = Number.isFinite(cameraZoom) && cameraZoom > 0 ? cameraZoom : 1;
  const resolvedTileSize = Number.isFinite(tileSize) && tileSize > 0 ? tileSize : 32;
  const desiredHeightTiles = Number.isFinite(state.player.desiredHeightTiles) ? Math.max(1, state.player.desiredHeightTiles) : 1;
  const playerScreenX = (state.player.x - state.cam.x) * resolvedZoom;
  const playerScreenY = (state.player.y - state.cam.y) * resolvedZoom;
  const playerScreenW = resolvedTileSize * resolvedZoom;
  const playerScreenH = resolvedTileSize * desiredHeightTiles * resolvedZoom;
  const playerTop = playerScreenY - Math.max(0, playerScreenH - playerScreenW);
  const playerLeft = playerScreenX;
  const playerRight = playerScreenX + playerScreenW;
  const playerBottom = playerTop + playerScreenH;
  const panelRight = barsPanelX + barsPanelW;
  const panelBottom = barsPanelY + barsPanelH;
  const playerBehindBarsPanel = !(
    playerRight < barsPanelX ||
    playerLeft > panelRight ||
    playerBottom < barsPanelY ||
    playerTop > panelBottom
  );
  const targetBarsAlpha = playerBehindBarsPanel ? 0.35 : 1;
  const uiMotionState = state.uiMotionState && typeof state.uiMotionState === "object"
    ? state.uiMotionState
    : null;
  let barsAlpha = targetBarsAlpha;
  if (uiMotionState) {
    const nowMs = now;
    const previousAlpha = Number.isFinite(uiMotionState.hudBarsAlpha) ? uiMotionState.hudBarsAlpha : targetBarsAlpha;
    const previousTick = Number.isFinite(uiMotionState.hudBarsAlphaUpdatedAt) ? uiMotionState.hudBarsAlphaUpdatedAt : nowMs;
    const dtScale = Math.max(0, Math.min(5, (nowMs - previousTick) / 16.667));
    const blend = 1 - Math.pow(0.78, dtScale);
    barsAlpha = previousAlpha + (targetBarsAlpha - previousAlpha) * blend;
    uiMotionState.hudBarsAlpha = barsAlpha;
    uiMotionState.hudBarsAlphaUpdatedAt = nowMs;
  }

  ctx.save();
  ctx.globalAlpha = barsAlpha;
  drawSkinnedPanel(ctx, barsPanelX, barsPanelY, barsPanelW, barsPanelH, colors);

  ctx.font = FONT_12;
  drawUiText(ctx, `Health ${Math.round(state.player.hp)} / ${Math.round(state.player.maxHp)}`, barX + 2, hpBarY - 3, colors);
  drawUiText(ctx, `Mana ${Math.floor(mana * 10) / 10} / ${Math.round(maxMana)}`, barX + 2, manaBarY - 3, colors);

  ctx.fillStyle = "rgba(10, 12, 18, 0.88)";
  ctx.fillRect(barX, hpBarY, barW, barH);
  ctx.fillRect(barX, manaBarY, barW, barH);
  ctx.fillStyle = hpRatio > 0.5 ? "#df4949" : hpRatio > 0.25 ? "#cf3434" : "#b91f1f";
  ctx.fillRect(barX, hpBarY, Math.round(barW * hpRatio), barH);
  ctx.fillStyle = "#4da3ff";
  ctx.fillRect(barX, manaBarY, Math.round(barW * manaRatio), barH);
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(barX + 0.5, hpBarY + 0.5, barW - 1, barH - 1);
  ctx.strokeRect(barX + 0.5, manaBarY + 0.5, barW - 1, barH - 1);
  ctx.restore();

  const obeyState = state.obeyState && typeof state.obeyState === "object" ? state.obeyState : null;
  if (obeyState?.active && Number.isFinite(obeyState.startedAt) && Number.isFinite(obeyState.durationMs) && obeyState.durationMs > 0) {
    const obeyElapsed = Math.max(0, now - obeyState.startedAt);
    const obeyRatio = Math.max(0, Math.min(1, obeyElapsed / obeyState.durationMs));
    const obeyBarW = Math.min(Math.max(180, slotsW), ctx.canvas.width - 44);
    const obeyBarH = 10;
    const obeyBarX = Math.round((ctx.canvas.width - obeyBarW) / 2);
    const obeyBarY = manaBarY - 22;
    ctx.fillStyle = "rgba(8, 12, 16, 0.85)";
    ctx.fillRect(obeyBarX, obeyBarY, obeyBarW, obeyBarH);
    ctx.fillStyle = "#7ecf9a";
    ctx.fillRect(obeyBarX, obeyBarY, Math.round(obeyBarW * obeyRatio), obeyBarH);
    ctx.strokeStyle = "rgba(245, 250, 236, 0.65)";
    ctx.lineWidth = 1;
    ctx.strokeRect(obeyBarX + 0.5, obeyBarY + 0.5, obeyBarW - 1, obeyBarH - 1);
    ctx.font = FONT_12;
    drawUiText(ctx, "Obeying...", obeyBarX + 2, obeyBarY - 3, colors);
  }

  for (let i = 0; i < slotCount; i++) {
    const slotX = slotsX + i * (slotSize + slotGap);
    const slot = skillSlots[i];
    const isAssigned = Boolean(slot?.id);
    const manaCost = Number.isFinite(slot?.manaCost) ? Math.max(0, slot.manaCost) : 0;
    const hasMana = mana >= manaCost;
    const isFeedbackSlot = feedback && feedback.slotIndex === i && feedback.until > now;

    drawSkinnedPanel(ctx, slotX, slotsY, slotSize, slotSize, colors);

    ctx.fillStyle = isAssigned ? "rgba(230, 210, 178, 0.2)" : "rgba(8, 10, 14, 0.55)";
    ctx.fillRect(slotX + 6, slotsY + 6, slotSize - 12, slotSize - 12);

    if (!isAssigned) {
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      ctx.strokeRect(slotX + 6.5, slotsY + 6.5, slotSize - 13, slotSize - 13);
    } else if (typeof getItemSprite === "function") {
      const skillSpriteName = slot.id === "obey" ? "obey" : null;
      const skillSprite = skillSpriteName ? getItemSprite(skillSpriteName) : null;
      if (skillSprite && skillSprite.width && skillSprite.height) {
        const iconSize = slotSize - 12;
        ctx.drawImage(skillSprite, slotX + 6, slotsY + 6, iconSize, iconSize);
      }
    } else if (!hasMana) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(slotX + 6, slotsY + 6, slotSize - 12, slotSize - 12);
    }

    if (isAssigned && !hasMana) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(slotX + 6, slotsY + 6, slotSize - 12, slotSize - 12);
    }

    if (isFeedbackSlot) {
      const status = feedback.status || "";
      ctx.strokeStyle = status === "used"
        ? "rgba(138, 224, 152, 0.95)"
        : status === "noMana"
          ? "rgba(116, 176, 255, 0.95)"
          : "rgba(255, 220, 128, 0.95)";
      ctx.lineWidth = 2;
      ctx.strokeRect(slotX + 2, slotsY + 2, slotSize - 4, slotSize - 4);
    }

    ctx.font = FONT_12;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(238, 238, 238, 0.95)";
    ctx.fillText(String(i + 1), slotX + slotSize / 2, slotsY + slotSize - 4);
    ctx.textAlign = "start";

    if (isAssigned && manaCost > 0) {
      ctx.font = FONT_12;
      ctx.fillStyle = "rgba(142, 198, 255, 0.95)";
      ctx.fillText(String(manaCost), slotX + slotSize - 12, slotsY + 12);
    }
  }

  const showChallenge = state.objectiveState?.id === "dojo-upstairs-challenge";
  if (showChallenge) {
    const tp = state.gameFlags.townProgress?.[state.currentTownId];
    const kills = Number.isFinite(tp?.challengeKills) ? tp.challengeKills : 0;
    const target = Number.isFinite(tp?.challengeTarget) ? tp.challengeTarget : 3;
    ctx.font = FONT_12;
    const challengeText = `Challenge: ${kills}/${target}`;
    drawUiText(ctx, challengeText, barX + 2, barsPanelY - 5, colors);
  }
}

function drawCombatLevelHud(ctx, state, colors) {
  if (!isFreeExploreState(state.gameState)) return;
  const now = performance.now();
  const highContrast = Boolean(state.pauseMenuState?.highContrast);
  const combatLevel = Number.isFinite(state.playerStats?.combatLevel) ? Math.max(1, state.playerStats.combatLevel) : 1;
  const combatXp = Number.isFinite(state.playerStats?.combatXP) ? Math.max(0, state.playerStats.combatXP) : 0;
  const combatXpNeeded = Number.isFinite(state.playerStats?.combatXPNeeded) ? Math.max(1, state.playerStats.combatXPNeeded) : 1;
  const progress = Math.max(0, Math.min(1, combatXp / combatXpNeeded));
  const levelFxStartedAt = Number.isFinite(state.playerStats?.combatLevelFxStartedAt)
    ? state.playerStats.combatLevelFxStartedAt
    : 0;
  const levelFxLevelsGained = Number.isFinite(state.playerStats?.combatLevelFxLevelsGained)
    ? Math.max(1, state.playerStats.combatLevelFxLevelsGained)
    : 1;
  const levelFxDurationMs = 1100;
  const levelFxElapsed = now - levelFxStartedAt;
  const levelFxActive = levelFxStartedAt > 0 && levelFxElapsed >= 0 && levelFxElapsed <= levelFxDurationMs;
  const levelFxIntensity = levelFxActive
    ? Math.min(1.35, 1 + (Math.max(0, levelFxLevelsGained - 1) * 0.12))
    : 1;

  const panelX = 14;
  const panelY = 14;
  const panelW = 252;
  const panelH = 62;

  const frameGlow = ctx.createRadialGradient(
    panelX + panelW * 0.55,
    panelY + 8,
    8,
    panelX + panelW * 0.55,
    panelY + panelH * 0.5,
    panelW
  );
  frameGlow.addColorStop(0, highContrast ? "rgba(96, 182, 234, 0.2)" : "rgba(247, 214, 145, 0.2)");
  frameGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = frameGlow;
  ctx.fillRect(panelX - 2, panelY - 2, panelW + 4, panelH + 4);

  const parchment = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
  parchment.addColorStop(0, highContrast ? "#212833" : "#f2e1b4");
  parchment.addColorStop(1, highContrast ? "#101722" : "#d7bb7d");
  ctx.fillStyle = parchment;
  ctx.fillRect(panelX, panelY, panelW, panelH);

  const innerFrame = ctx.createLinearGradient(panelX + 4, panelY + 4, panelX + 4, panelY + panelH - 4);
  innerFrame.addColorStop(0, highContrast ? "rgba(48,58,74,0.86)" : "rgba(255,248,222,0.75)");
  innerFrame.addColorStop(1, highContrast ? "rgba(26,35,49,0.82)" : "rgba(230,205,146,0.62)");
  ctx.fillStyle = innerFrame;
  ctx.fillRect(panelX + 2, panelY + 2, panelW - 4, panelH - 4);

  const titleBand = ctx.createLinearGradient(panelX + 6, panelY + 7, panelX + panelW - 6, panelY + 28);
  if (highContrast) {
    titleBand.addColorStop(0, "rgba(41, 86, 118, 0.82)");
    titleBand.addColorStop(0.5, "rgba(67, 132, 179, 0.74)");
    titleBand.addColorStop(1, "rgba(41, 86, 118, 0.82)");
  } else {
    titleBand.addColorStop(0, "rgba(116, 74, 32, 0.75)");
    titleBand.addColorStop(0.5, "rgba(151, 105, 49, 0.65)");
    titleBand.addColorStop(1, "rgba(116, 74, 32, 0.75)");
  }
  ctx.fillStyle = titleBand;
  ctx.fillRect(panelX + 6, panelY + 7, panelW - 12, 18);

  ctx.strokeStyle = highContrast ? "#a6dfff" : "#6c4b1d";
  ctx.lineWidth = 1.25;
  ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);
  ctx.strokeStyle = highContrast ? "#eef8ff" : "#f7e1ab";
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX + 3.5, panelY + 3.5, panelW - 7, panelH - 7);

  ctx.font = FONT_16;
  const levelText = `Level ${combatLevel}`;
  if (levelFxActive) {
    const textFlashT = clamp01(levelFxElapsed / 420);
    const textScale = 1 + (0.24 * (1 - easeOutCubic(textFlashT)) * levelFxIntensity);
    const textX = panelX + 14;
    const textY = panelY + 21;
    const textWidth = ctx.measureText(levelText).width;
    const anchorX = textX + textWidth / 2;
    ctx.save();
    ctx.translate(anchorX, textY);
    ctx.scale(textScale, textScale);
    drawUiText(ctx, levelText, -textWidth / 2, 0, colors);
    ctx.restore();
  } else {
    drawUiText(ctx, levelText, panelX + 14, panelY + 21, {
      ...colors,
      TEXT: highContrast ? "#f7fdff" : "#fff2ca",
      TEXT_SHADOW: highContrast ? "rgba(14, 28, 42, 0.5)" : "rgba(45, 24, 7, 0.45)"
    });
  }

  const barX = panelX + 12;
  const barY = panelY + 36;
  const barW = panelW - 24;
  const barH = 14;
  const barBack = ctx.createLinearGradient(barX, barY, barX, barY + barH);
  barBack.addColorStop(0, highContrast ? "rgba(12,18,28,0.96)" : "rgba(71, 47, 24, 0.72)");
  barBack.addColorStop(1, highContrast ? "rgba(25,36,50,0.94)" : "rgba(124, 86, 43, 0.65)");
  ctx.fillStyle = barBack;
  ctx.fillRect(barX, barY, barW, barH);

  const fillW = Math.max(0, Math.round(barW * progress));
  const fillGradient = ctx.createLinearGradient(barX, barY, barX, barY + barH);
  if (highContrast) {
    fillGradient.addColorStop(0, "rgba(140, 214, 255, 0.95)");
    fillGradient.addColorStop(0.55, "rgba(82, 150, 196, 0.96)");
    fillGradient.addColorStop(1, "rgba(45, 95, 132, 0.95)");
  } else {
    fillGradient.addColorStop(0, "rgba(244, 209, 135, 0.97)");
    fillGradient.addColorStop(0.55, "rgba(176, 124, 62, 0.96)");
    fillGradient.addColorStop(1, "rgba(116, 74, 32, 0.95)");
  }
  ctx.fillStyle = fillGradient;
  ctx.fillRect(barX, barY, fillW, barH);

  if (fillW > 4) {
    const fillSheen = ctx.createLinearGradient(barX, barY, barX, barY + barH * 0.65);
    fillSheen.addColorStop(0, "rgba(255, 255, 255, 0.48)");
    fillSheen.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = fillSheen;
    ctx.fillRect(barX + 1, barY + 1, fillW - 2, Math.max(4, barH * 0.55));
  }

  if (levelFxActive) {
    const burstT = clamp01(levelFxElapsed / 540);
    const burstFill = Math.min(1, burstT * 1.25);
    const burstAlpha = (0.1 + (1 - easeOutCubic(burstT)) * 0.68) * Math.min(1, levelFxIntensity);
    ctx.save();
    ctx.beginPath();
    ctx.rect(barX, barY, barW, barH);
    ctx.clip();
    ctx.fillStyle = `rgba(255, 220, 132, ${burstAlpha.toFixed(3)})`;
    ctx.fillRect(barX, barY, Math.round(barW * burstFill), barH);

    const headX = barX + (barW * Math.min(1.18, burstT * 1.3));
    const burstHead = ctx.createLinearGradient(headX - 52, barY, headX + 10, barY + barH);
    burstHead.addColorStop(0, "rgba(255, 245, 210, 0)");
    burstHead.addColorStop(0.55, `rgba(255, 245, 210, ${(0.6 * levelFxIntensity).toFixed(3)})`);
    burstHead.addColorStop(1, "rgba(255, 245, 210, 0)");
    ctx.fillStyle = burstHead;
    ctx.fillRect(barX, barY, barW, barH);
    ctx.restore();

    const shineT = clamp01((levelFxElapsed - 110) / 700);
    if (shineT > 0 && shineT < 1) {
      const shineX = panelX - 48 + ((panelW + 96) * shineT);
      const shine = ctx.createLinearGradient(shineX - 36, panelY, shineX + 18, panelY + panelH);
      shine.addColorStop(0, "rgba(255,255,255,0)");
      shine.addColorStop(0.45, "rgba(255,255,255,0.2)");
      shine.addColorStop(0.65, "rgba(255,224,150,0.35)");
      shine.addColorStop(1, "rgba(255,255,255,0)");
      ctx.save();
      ctx.beginPath();
      ctx.rect(panelX + 2, panelY + 2, panelW - 4, panelH - 4);
      ctx.clip();
      ctx.fillStyle = shine;
      ctx.fillRect(panelX, panelY, panelW, panelH);
      ctx.restore();
    }
  }

  ctx.strokeStyle = highContrast ? "rgba(166, 222, 255, 0.78)" : "rgba(118, 76, 30, 0.7)";
  ctx.lineWidth = 1;
  ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);

  const xpNeededRemaining = Math.max(0, combatXpNeeded - combatXp);
  const xpText = `${xpNeededRemaining} xp required`;
  ctx.font = "600 10px 'Spectral', 'Garamond', 'Trebuchet MS', serif";
  const xpTextW = Math.ceil(ctx.measureText(xpText).width);
  const xpTextX = Math.round(barX + (barW - xpTextW) * 0.5);
  const xpTextY = barY + 10;
  ctx.fillStyle = highContrast ? "rgba(226, 239, 249, 0.98)" : "rgba(63, 37, 14, 0.98)";
  ctx.fillText(xpText, xpTextX, xpTextY);
}

function drawCombatLevelCelebrationOverlay(ctx, state) {
  if (!isFreeExploreState(state.gameState)) return;

  const startedAt = Number.isFinite(state.playerStats?.combatLevelCelebrationStartedAt)
    ? state.playerStats.combatLevelCelebrationStartedAt
    : 0;
  if (startedAt <= 0) return;

  const reachedLevel = Number.isFinite(state.playerStats?.combatLevelCelebrationLevel)
    ? Math.max(1, Math.floor(state.playerStats.combatLevelCelebrationLevel))
    : 1;
  const levelsGained = Number.isFinite(state.playerStats?.combatLevelCelebrationLevelsGained)
    ? Math.max(1, Math.floor(state.playerStats.combatLevelCelebrationLevelsGained))
    : 1;
  const now = performance.now();
  const elapsed = now - startedAt;
  const newLevelDurationMs = 2000;
  const levelCardDurationMs = 7000;
  const totalDurationMs = newLevelDurationMs + levelCardDurationMs;
  if (elapsed < 0 || elapsed > totalDurationMs) return;

  const cx = ctx.canvas.width * 0.5;
  const cy = ctx.canvas.height * 0.5;

  const pyroFadeIn = clamp01(elapsed / 240);
  const pyroFadeOut = 1 - clamp01((elapsed - (totalDurationMs - 760)) / 760);
  const pyroAlpha = Math.max(0, Math.min(1, pyroFadeIn * pyroFadeOut));
  if (pyroAlpha > 0.01) {
    const burstCount = Math.min(34, 20 + levelsGained * 3);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < burstCount; i++) {
      const cycleMs = 880 + (i % 5) * 140;
      const cycleT = ((elapsed + i * 91) % cycleMs) / cycleMs;
      const ringRadius = 56 + cycleT * 238;
      const swirl = elapsed * (0.0011 + (i % 4) * 0.00017);
      const angle = i * 0.51 + swirl;
      const px = cx + Math.cos(angle) * ringRadius;
      const py = cy + Math.sin(angle * 1.14) * (26 + cycleT * 132) - cycleT * 116;
      const sparkSize = Math.max(1.2, 5.4 * (1 - cycleT));
      const sparkAlpha = (1 - cycleT) * pyroAlpha * (0.42 + ((i % 4) * 0.14));
      const sparkColor = i % 3 === 0
        ? `rgba(255, 226, 142, ${sparkAlpha.toFixed(3)})`
        : i % 3 === 1
          ? `rgba(255, 162, 110, ${sparkAlpha.toFixed(3)})`
          : `rgba(173, 221, 255, ${sparkAlpha.toFixed(3)})`;

      ctx.fillStyle = sparkColor;
      ctx.beginPath();
      ctx.arc(px, py, sparkSize, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = sparkColor;
      ctx.lineWidth = Math.max(1, sparkSize * 0.35);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - Math.cos(angle) * (8 + cycleT * 18), py + (6 + cycleT * 12));
      ctx.stroke();
    }
    ctx.restore();
  }

  const textSizeScale = 0.5;
  const newLevelFontPx = Math.round(Math.max(68, Math.min(124, Math.round(ctx.canvas.width * 0.1))) * textSizeScale);
  if (elapsed <= newLevelDurationMs) {
    const inAlpha = clamp01(elapsed / 340);
    const outAlpha = 1 - clamp01((elapsed - 1360) / 640);
    const alpha = Math.max(0, Math.min(1, inAlpha * outAlpha));
    if (alpha > 0.01) {
      const text = "NEW LEVEL";
      const popT = clamp01(elapsed / 560);
      const textScale = 0.9 + easeOutBack(popT) * 0.2;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy);
      ctx.scale(textScale, textScale);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `900 ${newLevelFontPx}px 'Cinzel', 'Palatino Linotype', 'Book Antiqua', serif`;

      const glow = ctx.createRadialGradient(0, 0, 12, 0, 0, newLevelFontPx * 1.7);
      glow.addColorStop(0, "rgba(255, 233, 163, 0.4)");
      glow.addColorStop(1, "rgba(255, 233, 163, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(-newLevelFontPx * 2.4, -newLevelFontPx * 1.25, newLevelFontPx * 4.8, newLevelFontPx * 2.5);

      ctx.lineWidth = Math.max(3, Math.round(newLevelFontPx * 0.1));
      ctx.strokeStyle = "rgba(31, 17, 7, 0.62)";
      ctx.strokeText(text, 0, 0);
      const fill = ctx.createLinearGradient(0, -newLevelFontPx, 0, newLevelFontPx * 0.4);
      fill.addColorStop(0, "rgba(255, 255, 255, 0.98)");
      fill.addColorStop(0.34, "rgba(255, 238, 176, 0.98)");
      fill.addColorStop(0.72, "rgba(255, 194, 121, 0.96)");
      fill.addColorStop(1, "rgba(179, 101, 48, 0.96)");
      ctx.fillStyle = fill;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
    return;
  }

  const levelElapsed = elapsed - newLevelDurationMs;
  if (levelElapsed < 0 || levelElapsed > levelCardDurationMs) return;
  const levelAlphaIn = clamp01(levelElapsed / 280);
  const levelAlphaOut = 1 - clamp01((levelElapsed - 3000) / 4000);
  const levelAlpha = Math.max(0, Math.min(1, levelAlphaIn * levelAlphaOut));
  if (levelAlpha <= 0.01) return;

  const titleText = `LEVEL ${reachedLevel}`;
  const titleFontPx = Math.round(Math.max(62, Math.min(112, Math.round(ctx.canvas.width * 0.088))) * textSizeScale);
  const shineProgress = ((levelElapsed % 1800) / 1800);
  const shineX = cx - titleFontPx * 2.2 + titleFontPx * 4.4 * shineProgress;

  ctx.save();
  ctx.globalAlpha = levelAlpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 italic ${titleFontPx}px 'Cinzel', 'Palatino Linotype', 'Book Antiqua', serif`;

  const backdrop = ctx.createRadialGradient(cx, cy, titleFontPx * 0.24, cx, cy, titleFontPx * 2.25);
  backdrop.addColorStop(0, "rgba(14, 10, 7, 0.24)");
  backdrop.addColorStop(1, "rgba(14, 10, 7, 0)");
  ctx.fillStyle = backdrop;
  ctx.fillRect(cx - titleFontPx * 2.8, cy - titleFontPx * 1.4, titleFontPx * 5.6, titleFontPx * 2.8);

  ctx.lineWidth = Math.max(2, Math.round(titleFontPx * 0.065));
  ctx.strokeStyle = "rgba(22, 14, 8, 0.6)";
  ctx.strokeText(titleText, cx, cy);

  const reflective = ctx.createLinearGradient(cx, cy - titleFontPx, cx, cy + titleFontPx * 0.45);
  reflective.addColorStop(0, "rgba(255,255,255,0.99)");
  reflective.addColorStop(0.3, "rgba(255,244,201,0.99)");
  reflective.addColorStop(0.5, "rgba(255,218,143,0.99)");
  reflective.addColorStop(0.74, "rgba(228,152,84,0.97)");
  reflective.addColorStop(1, "rgba(139,83,46,0.96)");
  ctx.fillStyle = reflective;
  ctx.fillText(titleText, cx, cy);

  const textWidth = ctx.measureText(titleText).width;
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - textWidth * 0.55, cy - titleFontPx * 0.9, textWidth * 1.1, titleFontPx * 1.3);
  ctx.clip();
  const shimmer = ctx.createLinearGradient(shineX - 90, cy - titleFontPx, shineX + 30, cy + titleFontPx);
  shimmer.addColorStop(0, "rgba(255,255,255,0)");
  shimmer.addColorStop(0.45, "rgba(255,255,255,0.3)");
  shimmer.addColorStop(0.6, "rgba(255,243,191,0.7)");
  shimmer.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shimmer;
  ctx.fillRect(cx - textWidth * 0.6, cy - titleFontPx, textWidth * 1.2, titleFontPx * 1.8);
  ctx.restore();
  ctx.restore();
}

function drawObjectiveTracker(ctx, state, colors) {
  if (!isFreeExploreState(state.gameState)) return;
  const objectiveText = state.objectiveState?.text;
  if (!objectiveText) return;

  const now = performance.now();
  const updatedAt = Number.isFinite(state.objectiveState?.updatedAt) ? state.objectiveState.updatedAt : 0;
  const revealRatio = updatedAt > 0 ? easeOutBack((now - updatedAt) / 360) : 1;
  const revealAlpha = Math.max(0.42, Math.min(1, revealRatio));
  const revealOffsetY = Math.round((1 - revealRatio) * 12);
  const panelH = 80;
  const panelW = Math.min(420, ctx.canvas.width - 28);
  const panelX = 14;
  const bottomReserve = 14;
  const panelY = Math.max(14, ctx.canvas.height - panelH - bottomReserve) + revealOffsetY;

  ctx.save();
  ctx.globalAlpha = revealAlpha;
  drawSkinnedPanel(ctx, panelX, panelY, panelW, panelH, colors);

  ctx.font = FONT_12;
  drawUiText(ctx, "Current Objective", panelX + 12, panelY + 18, colors);

  ctx.font = FONT_16;
  const maxWidth = panelW - 20;
  const words = objectiveText.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || line.length === 0) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
    if (lines.length >= 2) break;
  }
  if (line && lines.length < 2) lines.push(line);
  for (let i = 0; i < lines.length; i++) {
    drawUiText(ctx, lines[i], panelX + 10, panelY + 39 + i * 18, colors);
  }

  const markerLabel = state.objectiveState?.marker?.label;
  if (markerLabel) {
    ctx.font = FONT_12;
    drawUiText(ctx, `Target: ${markerLabel}`, panelX + 10, panelY + panelH - 8, colors);
  }
  ctx.restore();
}

function drawSaveNotice(ctx, state, colors) {
  const notice = state.saveNoticeState;
  if (!notice?.active || !notice.text) return;

  const elapsed = performance.now() - notice.startedAt;
  const duration = Math.max(1, notice.durationMs || 1600);
  const fadeIn = easeOutCubic(elapsed / 180);
  const fadeOutStart = duration - 260;
  const fadeOut = elapsed > fadeOutStart
    ? easeInCubic((elapsed - fadeOutStart) / 260)
    : 0;
  const alpha = fadeIn * (1 - fadeOut);
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = FONT_16;
  const textWidth = ctx.measureText(notice.text).width;
  const boxW = Math.max(140, textWidth + 26);
  const boxH = 32;
  const boxX = Math.round((ctx.canvas.width - boxW) / 2);
  const boxY = 10 + Math.round((1 - fadeIn) * -16 + fadeOut * -10);
  drawSkinnedPanel(ctx, boxX, boxY, boxW, boxH, colors);
  drawUiText(ctx, notice.text, boxX + 12, boxY + 20, colors);
  ctx.restore();
}

function drawCombatRewardPanel(ctx, state, colors) {
  const panel = state.combatRewardPanel;
  if (!panel?.active || !isFreeExploreState(state.gameState)) return;

  const elapsed = performance.now() - panel.startedAt;
  const duration = Math.max(1, panel.durationMs || 2200);
  const introRatio = easeOutBack(elapsed / 220);
  const outroStart = Math.max(200, duration - 320);
  const outroRatio = elapsed > outroStart ? easeInCubic((elapsed - outroStart) / 320) : 0;
  const alpha = introRatio * (1 - outroRatio);
  if (alpha <= 0.01) return;

  const boxW = Math.min(420, ctx.canvas.width - 48);
  const boxH = 108;
  const boxX = Math.round((ctx.canvas.width - boxW) / 2);
  const boxY = 52;
  const centerX = boxX + boxW * 0.5;
  const centerY = boxY + boxH * 0.5;
  const scale = 0.97 + 0.03 * introRatio;
  const offsetY = Math.round((1 - introRatio) * -14 + outroRatio * -10);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(centerX, centerY + offsetY);
  ctx.scale(scale, scale);
  ctx.translate(-centerX, -centerY);
  drawSkinnedPanel(ctx, boxX, boxY, boxW, boxH, colors, { titleBand: true });

  ctx.font = FONT_20;
  drawUiText(ctx, panel.title || "Battle Result", boxX + 14, boxY + 34, colors);

  const lines = Array.isArray(panel.lines) ? panel.lines : [];
  ctx.font = FONT_12;
  for (let i = 0; i < Math.min(lines.length, 4); i++) {
    drawUiText(ctx, String(lines[i]), boxX + 16, boxY + 56 + i * 14, colors);
  }
  ctx.restore();
}

function drawMinimap(ctx, state, colors) {
  if (!isFreeExploreState(state.gameState)) return;
  const minimap = state.minimap;
  if (!minimap?.map || !Number.isFinite(minimap.width) || !Number.isFinite(minimap.height)) return;

  const now = performance.now();
  const revealRatio = easeOutCubic((now - (minimap.revealStartedAt || now)) / 320);
  const revealAlpha = Math.max(0.45, revealRatio);
  const panelSlideOffset = Math.round((1 - revealRatio) * 24);

  const panelW = 156;
  const panelH = 126;
  const panelX = ctx.canvas.width - panelW - 14 + panelSlideOffset;
  const panelY = 14;
  ctx.save();
  ctx.globalAlpha = revealAlpha;
  drawSkinnedPanel(ctx, panelX, panelY, panelW, panelH, colors, { titleBand: true });

  ctx.font = FONT_12;
  drawUiText(ctx, "Map", panelX + 10, panelY + 16, colors);

  const mapX = panelX + 10;
  const mapY = panelY + 26;
  const mapW = panelW - 20;
  const mapH = panelH - 36;
  const cell = Math.max(1, Math.min(mapW / minimap.width, mapH / minimap.height));
  const drawW = Math.floor(minimap.width * cell);
  const drawH = Math.floor(minimap.height * cell);
  const offsetX = mapX + Math.floor((mapW - drawW) / 2);
  const offsetY = mapY + Math.floor((mapH - drawH) / 2);
  const discoveredDoors = Array.isArray(minimap.discoveredDoorTiles) ? minimap.discoveredDoorTiles : [];
  const discoveredSet = new Set(discoveredDoors.map((entry) => `${entry.x},${entry.y}`));

  ctx.fillStyle = "rgba(12, 16, 20, 0.8)";
  ctx.fillRect(offsetX, offsetY, drawW, drawH);

  for (let y = 0; y < minimap.height; y++) {
    const row = minimap.map[y];
    if (!row) continue;
    for (let x = 0; x < minimap.width; x++) {
      const tile = row[x];
      let color = "rgba(92, 138, 91, 0.68)";
      if (tile === TILE_TYPES.PATH || tile === TILE_TYPES.INTERIOR_FLOOR || tile === TILE_TYPES.BAR_FLOOR) {
        color = "rgba(205, 183, 136, 0.75)";
      } else if (tile === TILE_TYPES.WALL || tile === TILE_TYPES.TREE) {
        color = "rgba(54, 64, 70, 0.82)";
      } else if (tile === TILE_TYPES.HILL) {
        color = "rgba(122, 102, 77, 0.78)";
      } else if (tile === TILE_TYPES.DOOR) {
        color = discoveredSet.has(`${x},${y}`)
          ? "rgba(255, 194, 132, 0.92)"
          : "rgba(139, 120, 94, 0.48)";
      }
      ctx.fillStyle = color;
      ctx.fillRect(offsetX + x * cell, offsetY + y * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }

  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1;
  ctx.strokeRect(offsetX + 0.5, offsetY + 0.5, drawW - 1, drawH - 1);

  const doors = Array.isArray(minimap.doorTiles) ? minimap.doorTiles : [];
  for (const door of doors) {
    const discovered = discoveredSet.has(`${door.x},${door.y}`);
    const markerSize = discovered ? Math.max(2, Math.ceil(cell)) : Math.max(1, Math.floor(cell * 0.5));
    const markerOffset = discovered ? 0 : (cell - markerSize) * 0.5;
    ctx.fillStyle = discovered
      ? "rgba(255, 215, 157, 0.98)"
      : "rgba(140, 138, 128, 0.6)";
    ctx.fillRect(
      offsetX + door.x * cell + markerOffset,
      offsetY + door.y * cell + markerOffset,
      markerSize,
      markerSize
    );
  }

  const playerCenterX = offsetX + minimap.playerTileX * cell + cell * 0.5;
  const playerCenterY = offsetY + minimap.playerTileY * cell + cell * 0.5;
  const facingAngle = getFacingAngle(state.player?.dir);
  const coneRadius = Math.max(4, cell * 3.2);

  if (minimap.objectiveArea) {
    const areaX = offsetX + minimap.objectiveArea.x * cell;
    const areaY = offsetY + minimap.objectiveArea.y * cell;
    const areaW = Math.max(cell, minimap.objectiveArea.w * cell);
    const areaH = Math.max(cell, minimap.objectiveArea.h * cell);
    const pulse = 0.5 + Math.sin(now * 0.0045) * 0.5;
    ctx.fillStyle = `rgba(220, 44, 44, ${0.16 + pulse * 0.07})`;
    ctx.fillRect(areaX, areaY, areaW, areaH);
    ctx.strokeStyle = `rgba(255, 122, 122, ${0.42 + pulse * 0.22})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(areaX + 0.5, areaY + 0.5, Math.max(1, areaW - 1), Math.max(1, areaH - 1));
  }

  ctx.fillStyle = "rgba(255, 146, 118, 0.24)";
  ctx.beginPath();
  ctx.moveTo(playerCenterX, playerCenterY);
  ctx.arc(playerCenterX, playerCenterY, coneRadius, facingAngle - 0.32, facingAngle + 0.32);
  ctx.closePath();
  ctx.fill();

  if (minimap.objectiveMarker) {
    const markerX = offsetX + minimap.objectiveMarker.x * cell + cell * 0.5;
    const markerY = offsetY + minimap.objectiveMarker.y * cell + cell * 0.5;
    const pulse = 0.5 + Math.sin(now * 0.01) * 0.5;
    ctx.strokeStyle = `rgba(255, 244, 184, ${0.65 + pulse * 0.3})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(markerX, markerY, Math.max(3, cell * (0.6 + pulse * 0.35)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 235, 158, 0.95)";
    ctx.fillRect(markerX - 1, markerY - 1, 3, 3);
  }

  ctx.fillStyle = "rgba(255, 116, 116, 0.98)";
  ctx.fillRect(
    playerCenterX - Math.max(1, Math.floor(cell * 0.5)),
    playerCenterY - Math.max(1, Math.floor(cell * 0.5)),
    Math.max(2, Math.ceil(cell) + 1),
    Math.max(2, Math.ceil(cell) + 1)
  );

  ctx.font = FONT_12;
  const areaLabel = `${state.currentTownName || ""} / ${state.currentAreaName || ""}`;
  drawUiText(ctx, areaLabel, panelX + 10, panelY + panelH - 4, colors);
  ctx.restore();
}

function drawDoorHint(ctx, state, colors, dialogue, cameraZoom = 1) {
  if (!isFreeExploreState(state.gameState)) return;
  if (dialogue && typeof dialogue.isActive === "function" && dialogue.isActive()) return;
  const text = state.doorHintText;
  if (!text) return;

  const destinationText = text.startsWith("Door:") ? text.slice(5).trim() : text;
  const isLeftoversHint = destinationText.toLowerCase() === "open leftovers";

  if (isLeftoversHint) {
    ctx.font = "500 10px 'Spectral', 'Garamond', 'Trebuchet MS', serif";
    const textW = Math.ceil(ctx.measureText(destinationText).width);
    const boxW = Math.max(104, textW + 14);
    const boxH = 20;
    let boxX = Math.round((ctx.canvas.width - boxW) / 2);
    let boxY = Math.round((ctx.canvas.height - boxH) / 2);

    const leftovers = Array.isArray(state?.leftovers) ? state.leftovers : [];
    const nearest = leftovers
      .filter((entry) => {
        if (!entry) return false;
        if (entry.depleted) return false;
        const hasLoot = (Number(entry.gold) > 0) || (Number(entry.silver) > 0) || (Array.isArray(entry.items) && entry.items.length > 0);
        if (!hasLoot) return false;
        return entry.townId === state.currentTownId && entry.areaId === state.currentAreaId;
      })
      .sort((a, b) => {
        const ax = Number(a.x) || 0;
        const ay = Number(a.y) || 0;
        const bx = Number(b.x) || 0;
        const by = Number(b.y) || 0;
        const px = (Number(state?.player?.x) || 0) + 16;
        const py = (Number(state?.player?.y) || 0) + 16;
        const da = Math.hypot(ax - px, ay - py);
        const db = Math.hypot(bx - px, by - py);
        return da - db;
      })[0];
    if (nearest) {
      const sx = (Number(nearest.x || 0) - (Number(state?.cam?.x) || 0)) * cameraZoom;
      const sy = (Number(nearest.y || 0) - (Number(state?.cam?.y) || 0)) * cameraZoom;
      boxX = Math.round(sx - boxW * 0.5);
      boxY = Math.round(sy - boxH - 14);
      boxX = Math.max(6, Math.min(ctx.canvas.width - boxW - 6, boxX));
      boxY = Math.max(6, Math.min(ctx.canvas.height - boxH - 6, boxY));
    }
    ctx.fillStyle = "rgba(20, 34, 48, 0.5)";
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = "rgba(154, 204, 236, 0.62)";
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
    drawUiText(ctx, destinationText, boxX + 7, boxY + 14, {
      ...colors,
      TEXT: "rgba(231, 245, 255, 0.95)",
      TEXT_SHADOW: "rgba(8, 14, 18, 0.62)"
    });
    return;
  }

  ctx.font = FONT_12;
  const textW = ctx.measureText(destinationText).width;
  const boxW = Math.max(220, textW + 24);
  const boxH = 30;
  const boxX = Math.round((ctx.canvas.width - boxW) / 2);
  const boxY = Math.round((ctx.canvas.height - boxH) / 2);
  drawSkinnedPanel(ctx, boxX, boxY, boxW, boxH, colors);
  drawUiText(ctx, destinationText, boxX + 12, boxY + 19, colors);
}

function drawCombatDamageFlash(ctx, state) {
  const flashUntil = state.combatFeedback?.playerDamageFlashUntil;
  if (!Number.isFinite(flashUntil)) return;
  const remaining = flashUntil - performance.now();
  if (remaining <= 0) return;
  const alpha = Math.max(0, Math.min(0.22, (remaining / 170) * 0.22));
  ctx.fillStyle = `rgba(180, 44, 44, ${alpha})`;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function drawItemNotifications(ctx, state, cameraZoom, tileSize, colors, getItemSprite) {
  const { itemAlert, inventoryHint, player, cam } = state;

  if (itemAlert.active) {
    const elapsed = performance.now() - itemAlert.startedAt;
    const alpha = 1 - Math.max(0, (elapsed - (itemAlert.durationMs - 400)) / 400);

    const screenX = (player.x - cam.x) * cameraZoom + (tileSize * cameraZoom) / 2;
    const screenY = (player.y - cam.y) * cameraZoom - 18;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = FONT_16;

    const padding = 8;
    const text = itemAlert.text;
    const textW = ctx.measureText(text).width;
    const boxW = Math.max(120, textW + padding * 2);
    const boxH = 28;
    const boxX = Math.round(screenX - boxW / 2);
    const boxY = Math.round(screenY - boxH);

    drawSkinnedPanel(ctx, boxX, boxY, boxW, boxH, colors);
    drawUiText(ctx, text, boxX + padding, boxY + 19, colors);
    ctx.restore();
  }

  if (inventoryHint.active) {
    const elapsed = performance.now() - inventoryHint.startedAt;
    const duration = Number.isFinite(inventoryHint.durationMs) ? Math.max(500, inventoryHint.durationMs) : 5000;
    const fadeOut = 1 - Math.max(0, (elapsed - (duration - 700)) / 700);
    const fadeIn = Math.max(0, Math.min(1, elapsed / 180));
    const alpha = fadeOut * fadeIn;
    const itemName = typeof inventoryHint.itemName === "string" ? inventoryHint.itemName.trim() : "";
    const displayText = itemName ? `'${itemName}' acquired` : "Item acquired";

    ctx.save();
    ctx.globalAlpha = alpha * 0.98;
    ctx.font = FONT_16;

    const textW = Math.ceil(ctx.measureText(displayText).width);
    const iconSize = 52;
    const panelW = Math.max(176, Math.max(iconSize, textW) + 26);
    const panelH = 126;
    const groupW = panelW;
    const basePanelX = 12;
    const hiddenPanelX = -groupW - 18;
    const introDurationMs = 220;
    const outroDurationMs = 320;
    const outroStartMs = Math.max(introDurationMs, duration - outroDurationMs);
    let panelX = basePanelX;
    if (elapsed < introDurationMs) {
      const t = Math.max(0, Math.min(1, elapsed / introDurationMs));
      panelX = hiddenPanelX + (basePanelX - hiddenPanelX) * t;
    } else if (elapsed > outroStartMs) {
      const t = Math.max(0, Math.min(1, (elapsed - outroStartMs) / outroDurationMs));
      panelX = basePanelX + (hiddenPanelX - basePanelX) * t;
    }
    panelX = Math.round(panelX);
    const panelY = Math.round((ctx.canvas.height - panelH) * 0.5);

    const glassGradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
    glassGradient.addColorStop(0, "rgba(24, 40, 54, 0.34)");
    glassGradient.addColorStop(1, "rgba(12, 22, 34, 0.24)");
    ctx.fillStyle = glassGradient;
    ctx.fillRect(panelX, panelY, panelW, panelH);

    const topSheen = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH * 0.5);
    topSheen.addColorStop(0, "rgba(180, 230, 255, 0.16)");
    topSheen.addColorStop(1, "rgba(180, 230, 255, 0)");
    ctx.fillStyle = topSheen;
    ctx.fillRect(panelX + 1, panelY + 1, panelW - 2, Math.max(12, panelH * 0.45));

    ctx.strokeStyle = "rgba(159, 222, 255, 0.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);
    ctx.strokeStyle = "rgba(220, 245, 255, 0.28)";
    ctx.strokeRect(panelX + 3.5, panelY + 3.5, panelW - 7, panelH - 7);

    const textX = panelX + Math.round((panelW - textW) / 2);
    drawUiText(ctx, displayText, textX, panelY + 20, colors);

    const spriteName = itemName ? getItemSpriteName(itemName) : null;
    const sprite = spriteName ? getItemSprite(spriteName) : null;
    const iconY = panelY + 42;
    if (sprite && sprite.naturalWidth > 0 && sprite.naturalHeight > 0) {
      const scale = getItemSpriteScale(spriteName);
      const drawSize = iconSize * scale;
      const drawX = Math.round(panelX + (groupW - drawSize) / 2);
      const drawY = Math.round(iconY + (iconSize - drawSize) / 2);
      ctx.drawImage(sprite, drawX, drawY, drawSize, drawSize);
    } else if (itemName) {
      ctx.font = FONT_12;
      drawUiText(ctx, itemName, panelX, iconY + 28, colors);
    }
    ctx.restore();
  }
}

function drawAtmosphere(ctx, canvas, colors, state) {
  const isOverworld = state.currentAreaKind === AREA_KINDS.OVERWORLD;
  const reducedFlashes = Boolean(state.userSettings?.reducedFlashes);
  const intensity = reducedFlashes ? 0.58 : 1;

  if (isOverworld) {
    const topLight = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.65);
    topLight.addColorStop(0, colors.AMBIENT_TOP);
    topLight.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = topLight;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const bottomTint = ctx.createLinearGradient(0, canvas.height * 0.35, 0, canvas.height);
    bottomTint.addColorStop(0, "rgba(0,0,0,0)");
    bottomTint.addColorStop(1, colors.AMBIENT_BOTTOM);
    ctx.fillStyle = bottomTint;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const now = Number.isFinite(state?.atmosphereTimeSec)
    ? state.atmosphereTimeSec
    : performance.now() * 0.001;

  if (isOverworld) {
    // Strong 4-phase cycle for readability: Day -> Dusk -> Night -> Dawn.
    // Full loop is 30s for testing.
    const cycleSec = 30;
    const cycleT = ((now % cycleSec) + cycleSec) % cycleSec / cycleSec; // 0..1
    const phasePos = cycleT * 4;
    const phaseA = Math.floor(phasePos) % 4;
    const phaseB = (phaseA + 1) % 4;
    const blend = phasePos - Math.floor(phasePos);
    const phaseWeights = [0, 0, 0, 0]; // day, dusk, night, dawn
    phaseWeights[phaseA] = 1 - blend;
    phaseWeights[phaseB] = blend;
    const dayWeight = phaseWeights[0];
    const duskWeight = phaseWeights[1];
    const nightWeight = phaseWeights[2];
    const dawnWeight = phaseWeights[3];

    // Off-screen light source moves right->left->right across the cycle.
    const travel = (Math.sin(cycleT * Math.PI * 2 - Math.PI * 0.5) + 1) * 0.5; // 0..1..0
    const lightX = canvas.width * (1.18 - travel * 1.36);
    const lightY = -canvas.height * (0.16 - Math.sin(cycleT * Math.PI * 2) * 0.03);

    const warmBoost = (dayWeight * 0.18 + dawnWeight * 0.12) * intensity;
    const duskBoost = duskWeight * 0.34 * intensity;
    const darken = (nightWeight * 0.66 + duskWeight * 0.26 + dawnWeight * 0.2) * intensity;
    const blueCast = (nightWeight * 0.3 + dawnWeight * 0.14) * intensity;

    if (warmBoost > 0.001) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const warmGlow = ctx.createRadialGradient(
        lightX,
        lightY,
        canvas.width * 0.04,
        lightX,
        lightY,
        canvas.width * 1.1
      );
      warmGlow.addColorStop(0, `rgba(255, 250, 226, ${0.3 * warmBoost})`);
      warmGlow.addColorStop(0.45, `rgba(255, 233, 158, ${0.6 * warmBoost})`);
      warmGlow.addColorStop(1, "rgba(255, 220, 130, 0)");
      ctx.fillStyle = warmGlow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    if (duskBoost > 0.001) {
      ctx.fillStyle = `rgba(255, 120, 28, ${duskBoost})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (blueCast > 0.001) {
      ctx.fillStyle = `rgba(60, 98, 168, ${blueCast})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (darken > 0.001) {
      ctx.fillStyle = `rgba(0, 0, 0, ${darken})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const vignetteAlpha = (nightWeight * 0.6 + duskWeight * 0.24 + dawnWeight * 0.18) * intensity;
    if (vignetteAlpha > 0.001) {
      const nightVignette = ctx.createRadialGradient(
        canvas.width * 0.5,
        canvas.height * 0.52,
        canvas.height * 0.16,
        canvas.width * 0.5,
        canvas.height * 0.55,
        canvas.width * 0.7
      );
      nightVignette.addColorStop(0, "rgba(0,0,0,0)");
      nightVignette.addColorStop(1, `rgba(0,0,0,${vignetteAlpha})`);
      ctx.fillStyle = nightVignette;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

  }

  const particleCount = Math.round((isOverworld ? 42 : 18) * intensity);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < particleCount; i++) {
    const seed = i * 13.17 + (isOverworld ? 0 : 97.23);
    const speed = isOverworld ? 0.028 + hash01(seed + 0.2) * 0.048 : 0.012 + hash01(seed + 0.2) * 0.02;
    const drift = (now * speed + hash01(seed + 0.8)) % 1;
    const xBase = (1 - drift) * (canvas.width + 120) - 60;
    const yBase = hash01(seed + 1.7) * canvas.height;

    const x = xBase + Math.sin(now * (0.8 + hash01(seed + 2.4)) + seed) * (isOverworld ? 20 : 10);
    const y = yBase + Math.sin(now * (0.75 + hash01(seed + 3.6)) + seed * 1.3) * (isOverworld ? 16 : 7);
    const alphaBase = isOverworld ? 0.07 + hash01(seed + 4.1) * 0.16 : 0.04 + hash01(seed + 4.1) * 0.08;
    const alpha = alphaBase * intensity;
    const size = isOverworld ? 1.4 + hash01(seed + 5.5) * 2.6 : 1 + hash01(seed + 5.5) * 1.6;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(hash01(seed + 6.8) * Math.PI + now * (isOverworld ? 0.35 : 0.12));
    ctx.fillStyle = isOverworld
      ? `rgba(255, 222, 239, ${alpha})`
      : `rgba(255, 238, 206, ${alpha})`;
    ctx.fillRect(-size * 0.5, -size, size, size * 1.8);
    ctx.restore();
  }

  ctx.restore();

  if (isOverworld) {
    const vignette = ctx.createRadialGradient(
      canvas.width * 0.5,
      canvas.height * 0.38,
      canvas.height * 0.12,
      canvas.width * 0.5,
      canvas.height * 0.5,
      canvas.width * 0.62
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, colors.VIGNETTE);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawWorldVfx(ctx, state) {
  const effects = Array.isArray(state.vfxEffects) ? state.vfxEffects : null;
  if (!effects || effects.length === 0) return;

  const reducedFlashes = Boolean(state.userSettings?.reducedFlashes);
  const flashScale = reducedFlashes ? 0.58 : 1;
  const now = performance.now();
  for (const effect of effects) {
    const age = now - effect.startedAt;
    const life = Math.max(1, effect.durationMs);
    const t = Math.max(0, Math.min(1, age / life));
    const inv = 1 - t;

    const x = effect.x - state.cam.x;
    const y = effect.y - state.cam.y;
    const baseSize = effect.size || 22;
    const glowSize = baseSize * (1.2 + t * 1.1);

    ctx.save();
    ctx.globalAlpha = Math.max(0.03, inv * 0.95 * flashScale);
    const glow = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
    glow.addColorStop(0, effect.glowColor || "rgba(255,255,255,0.34)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, glowSize, 0, Math.PI * 2);
    ctx.fill();

    if (effect.type === "trainingBurst") {
      ctx.strokeStyle = effect.color || "rgba(255, 224, 157, 0.95)";
      ctx.lineWidth = 2;
      const rays = 8;
      for (let i = 0; i < rays; i++) {
        const angle = i * ((Math.PI * 2) / rays) + t * 0.7;
        const inner = baseSize * (0.2 + t * 0.12);
        const outer = baseSize * (0.75 + t * 0.45);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
        ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
        ctx.stroke();
      }
    } else if (effect.type === "doorSwirl") {
      ctx.strokeStyle = effect.color || "rgba(250, 240, 195, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, baseSize * (0.45 + t * 0.65), t * Math.PI * 2, t * Math.PI * 2 + Math.PI * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, baseSize * (0.22 + t * 0.45), -t * Math.PI * 2, -t * Math.PI * 2 + Math.PI * 1.3);
      ctx.stroke();
    } else if (effect.type === "pickupGlow") {
      ctx.fillStyle = effect.color || "rgba(171, 238, 255, 0.95)";
      for (let i = 0; i < 6; i++) {
        const angle = i * ((Math.PI * 2) / 6) + t * 2.1;
        const dist = baseSize * (0.22 + t * 0.58);
        const sparkleSize = Math.max(1, baseSize * 0.09 * inv);
        ctx.fillRect(
          x + Math.cos(angle) * dist - sparkleSize * 0.5,
          y + Math.sin(angle) * dist - sparkleSize * 0.5 - t * 9,
          sparkleSize,
          sparkleSize
        );
      }
    } else if (effect.type === "attackSlash") {
      const start = Math.PI * 0.15 + t * 1.6;
      const end = start + Math.PI * 0.95;
      ctx.strokeStyle = effect.color || "rgba(255, 238, 198, 0.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, baseSize * (0.72 + t * 0.2), start, end);
      ctx.stroke();
    } else if (effect.type === "hitSpark") {
      const rays = 6;
      ctx.strokeStyle = effect.color || "rgba(255, 191, 142, 0.96)";
      ctx.lineWidth = 2;
      for (let i = 0; i < rays; i++) {
        const angle = i * ((Math.PI * 2) / rays) + t * 0.4;
        const inner = baseSize * 0.12;
        const outer = baseSize * (0.45 + t * 0.36);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
        ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
        ctx.stroke();
      }
    } else if (effect.type === "warningRing") {
      const pulse = 0.5 + Math.sin(t * Math.PI * 2.6) * 0.5;
      ctx.strokeStyle = effect.color || `rgba(255, 163, 131, ${0.46 + pulse * 0.24})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, baseSize * (0.7 + t * 0.45), 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.type === "damageText") {
      const fontPx = Math.max(16, Math.round(baseSize));
      ctx.font = `bold ${fontPx}px Georgia`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const floatY = y - t * Math.max(20, fontPx * 0.9);
      ctx.fillStyle = effect.color || "rgba(255, 233, 190, 0.98)";
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = Math.max(2, Math.round(fontPx * 0.12));
      const text = String(effect.text || "");
      ctx.strokeText(text, x, floatY);
      ctx.fillText(text, x, floatY);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    } else if (effect.type === "xpGainText") {
      const pulse = 0.7 + Math.sin(t * Math.PI * 5) * 0.3;
      const floatY = y - t * 30;
      const halo = ctx.createRadialGradient(x, floatY - 3, 0, x, floatY - 3, baseSize * (0.8 + pulse * 0.4));
      halo.addColorStop(0, effect.glowColor || "rgba(106, 199, 255, 0.38)");
      halo.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, floatY - 3, baseSize * (0.65 + pulse * 0.3), 0, Math.PI * 2);
      ctx.fill();

      ctx.font = FONT_20;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const text = String(effect.text || "");
      ctx.strokeStyle = "rgba(12, 22, 34, 0.72)";
      ctx.lineWidth = 3;
      ctx.strokeText(text, x, floatY);
      ctx.fillStyle = effect.color || "rgba(188, 236, 255, 0.98)";
      ctx.fillText(text, x, floatY);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    } else {
      ctx.strokeStyle = effect.color || "rgba(255, 245, 209, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, baseSize * (0.34 + t * 0.78), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawMoodGrading(ctx, canvas, state) {
  const preset = MOOD_PRESETS[state.moodPreset];
  if (!preset) return;

  const top = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.7);
  top.addColorStop(0, preset.topTint);
  top.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const bottom = ctx.createLinearGradient(0, canvas.height * 0.28, 0, canvas.height);
  bottom.addColorStop(0, "rgba(0,0,0,0)");
  bottom.addColorStop(1, preset.bottomTint);
  ctx.fillStyle = bottom;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = preset.filmTint;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function drawTitleScreenOverlay(ctx, canvas, state, colors) {
  const titleState = state.titleState;
  if (!titleState || state.gameState !== GAME_STATES.TITLE_SCREEN) return;

  const now = performance.now();
  const elapsed = (now - titleState.startedAt) / 1000;
  const pulse = 0.5 + Math.sin((elapsed + titleState.promptPulseOffset * 0.001) * 2.4) * 0.5;

  const topGlow = ctx.createRadialGradient(
    canvas.width * 0.5,
    canvas.height * 0.2,
    20,
    canvas.width * 0.5,
    canvas.height * 0.34,
    canvas.width * 0.7
  );
  topGlow.addColorStop(0, "rgba(255, 214, 158, 0.28)");
  topGlow.addColorStop(1, titleState.hasContinueSave ? "rgba(12, 10, 16, 0.58)" : "rgba(12, 10, 16, 0.78)");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = titleState.hasContinueSave ? "rgba(8, 10, 16, 0.28)" : "rgba(8, 10, 16, 0.45)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = FONT_28;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillText(BRANDING.TITLE, 84, 120);
  const logoGradient = ctx.createLinearGradient(82, 62, 82, 124);
  logoGradient.addColorStop(0, "#fff3d1");
  logoGradient.addColorStop(1, "#e4ba72");
  ctx.fillStyle = logoGradient;
  ctx.fillText(BRANDING.TITLE, 82, 118);

  ctx.font = FONT_20;
  ctx.fillStyle = "rgba(243, 227, 198, 0.92)";
  ctx.fillText(BRANDING.STUDIO, 84, 148);

  const panelX = 72;
  const optionCount = Array.isArray(titleState.options) ? titleState.options.length : 0;
  const panelH = Math.max(188, 144 + Math.max(0, optionCount - 1) * 38);
  const panelY = canvas.height - (panelH + 70);
  const panelW = 372;
  drawSkinnedPanel(ctx, panelX, panelY, panelW, panelH, colors, { titleBand: true });

  ctx.font = FONT_16;
  for (let i = 0; i < titleState.options.length; i++) {
    const y = panelY + 64 + i * 38;
    const hovered = Number.isInteger(titleState.hovered) ? titleState.hovered : -1;
    const useHoverOnly = Boolean(titleState.pointerNavigation);
    const activeIndex = useHoverOnly ? hovered : (hovered >= 0 ? hovered : titleState.selected);
    const isSelected = i === activeIndex;
    if (isSelected) {
      const band = ctx.createLinearGradient(panelX + 14, y - 20, panelX + panelW - 14, y + 7);
      band.addColorStop(0, "rgba(255, 209, 127, 0.14)");
      band.addColorStop(0.5, "rgba(255, 232, 186, 0.32)");
      band.addColorStop(1, "rgba(255, 209, 127, 0.14)");
      ctx.fillStyle = band;
      ctx.fillRect(panelX + 14, y - 20, panelW - 28, 28);
    }
    ctx.fillStyle = isSelected ? "#fff3d3" : "rgba(226, 214, 187, 0.88)";
    ctx.fillText(`${isSelected ? "> " : "  "}${titleState.options[i]}`, panelX + 28, y);
  }

  ctx.font = FONT_12;
  ctx.fillStyle = `rgba(245, 230, 202, ${0.58 + pulse * 0.42})`;
  ctx.fillText("Arrow keys, stick, or mouse hover: Navigate", panelX + 22, panelY + panelH - 38);
  ctx.fillText("Enter/Space/Left Click or A/Start: Confirm", panelX + 22, panelY + panelH - 20);

  if (titleState.showHowTo) {
    const helpW = Math.min(canvas.width - 120, 520);
    const helpH = 252;
    const helpX = Math.round((canvas.width - helpW) / 2);
    const helpY = Math.round((canvas.height - helpH) / 2);
    drawSkinnedPanel(ctx, helpX, helpY, helpW, helpH, colors, { titleBand: true });
    ctx.font = FONT_22;
    drawUiText(ctx, "How To Play", helpX + 20, helpY + 36, colors);
    ctx.font = FONT_16;
    drawUiText(ctx, `Move: ${getPrimaryBindingLabel(state, "moveUp")} ${getPrimaryBindingLabel(state, "moveLeft")} ${getPrimaryBindingLabel(state, "moveDown")} ${getPrimaryBindingLabel(state, "moveRight")} or arrows`, helpX + 20, helpY + 72, colors);
    drawUiText(ctx, `Interact / Advance: ${getPrimaryBindingLabel(state, "interact")}`, helpX + 20, helpY + 96, colors);
    drawUiText(ctx, `Attack: ${getPrimaryBindingLabel(state, "attack")} or Left Click`, helpX + 20, helpY + 120, colors);
    drawUiText(ctx, "Sprint: Hold Right Click", helpX + 20, helpY + 144, colors);
    drawUiText(ctx, `Pause Menu: ${getPrimaryBindingLabel(state, "pause")}`, helpX + 20, helpY + 168, colors);
    drawUiText(ctx, `Inventory: ${getPrimaryBindingLabel(state, "inventory")} (Right Click item to inspect)`, helpX + 20, helpY + 192, colors);
    drawUiText(ctx, "Gamepad: Left Stick + A/X + Start", helpX + 20, helpY + 216, colors);
    ctx.font = FONT_12;
    drawUiText(ctx, "Press ESC/B to close this panel", helpX + 20, helpY + 232, colors);
  }

  if (titleState.fadeOutActive) {
    const fadeElapsed = now - titleState.fadeOutStartedAt;
    const fadeRatio = Math.max(0, Math.min(1, fadeElapsed / Math.max(1, titleState.fadeOutDurationMs)));
    ctx.fillStyle = `rgba(0,0,0,${fadeRatio})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawIntroCutsceneOverlay(ctx, canvas, state) {
  const intro = state.introState;
  if (!intro || state.gameState !== GAME_STATES.INTRO_CUTSCENE) return;

  const now = performance.now();
  const elapsed = Math.max(0, now - (Number.isFinite(intro.startedAt) ? intro.startedAt : now));
  const fadeToBlackMs = Math.max(1, intro.fadeToBlackMs || 1);
  const blackHoldMs = Math.max(0, intro.blackHoldMs || 0);
  const shineDurationMs = Math.max(1, intro.shineDurationMs || 1);
  const shineFadeOutMs = Math.max(1, intro.shineFadeOutMs || 1);
  const postShineBlackHoldMs = Math.max(0, intro.postShineBlackHoldMs || 0);
  const sceneFadeInMs = Math.max(1, intro.sceneFadeInMs || 1);
  const sceneHoldMs = Math.max(0, intro.sceneHoldMs || 0);

  const t0 = fadeToBlackMs;
  const t1 = t0 + blackHoldMs;
  const t2 = t1 + shineDurationMs;
  const t3 = t2 + shineFadeOutMs;
  const t4 = t3 + postShineBlackHoldMs;
  const t5 = t4 + sceneFadeInMs;
  const t6 = t5 + sceneHoldMs;

  // Base black screen throughout timeline.
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Phase 1: quick fade to black (from previous frame).
  if (elapsed < t0) {
    const alpha = easeOutCubic(elapsed / fadeToBlackMs);
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  // Phase 2: black hold.
  if (elapsed < t1) {
    return;
  }

  // Phase 3: blurry top shine, slowly flashing green<->white.
  if (elapsed < t2) {
    const phaseElapsed = elapsed - t1;
    const phaseT = clamp01(phaseElapsed / shineDurationMs);
    const pulse = 0.5 + Math.sin(phaseT * Math.PI * 2) * 0.5;
    const tintMix = pulse;
    const r = Math.round(210 + (255 - 210) * tintMix);
    const g = Math.round(255);
    const b = Math.round(215 + (255 - 215) * tintMix);
    const shineAlpha = 0.5 + (1 - Math.abs(phaseT - 0.5) * 2) * 0.26;

    ctx.save();
    ctx.filter = "blur(56px)";
    const topShine = ctx.createRadialGradient(
      canvas.width * 0.5,
      canvas.height * 0.04,
      12,
      canvas.width * 0.5,
      canvas.height * 0.1,
      canvas.height * 0.72
    );
    topShine.addColorStop(0, `rgba(${r},${g},${b},${shineAlpha})`);
    topShine.addColorStop(0.4, `rgba(${r},${g},${b},${shineAlpha * 0.42})`);
    topShine.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = topShine;
    ctx.fillRect(-canvas.width * 0.2, -canvas.height * 0.2, canvas.width * 1.4, canvas.height * 1.5);
    ctx.restore();
    return;
  }

  // Phase 4: fade shine to complete black.
  if (elapsed < t3) {
    const phaseElapsed = elapsed - t2;
    const fadeT = clamp01(phaseElapsed / shineFadeOutMs);
    const alpha = 1 - easeInCubic(fadeT);
    ctx.save();
    ctx.filter = "blur(56px)";
    const topShine = ctx.createRadialGradient(
      canvas.width * 0.5,
      canvas.height * 0.04,
      12,
      canvas.width * 0.5,
      canvas.height * 0.1,
      canvas.height * 0.72
    );
    topShine.addColorStop(0, `rgba(255,255,255,${0.58 * alpha})`);
    topShine.addColorStop(0.45, `rgba(214,255,220,${0.24 * alpha})`);
    topShine.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = topShine;
    ctx.fillRect(-canvas.width * 0.2, -canvas.height * 0.2, canvas.width * 1.4, canvas.height * 1.5);
    ctx.restore();
    return;
  }

  // Phase 5: brief black hold.
  if (elapsed < t4) {
    return;
  }

  // Phase 6/7: fade into ProtagonistStartScene, then hold 8s with a blink every 3s.
  const sceneImage = state.protagonistStartSceneImage || null;
  if (!sceneImage || !(sceneImage.width > 0 || sceneImage.naturalWidth > 0)) {
    return;
  }

  const imageW = Number(sceneImage.naturalWidth || sceneImage.width || 1);
  const imageH = Number(sceneImage.naturalHeight || sceneImage.height || 1);
  const scale = Math.min(canvas.width / imageW, canvas.height / imageH);
  const drawW = imageW * scale;
  const drawH = imageH * scale;
  const baseDrawX = (canvas.width - drawW) * 0.5;
  const baseDrawY = (canvas.height - drawH) * 0.5;

  let imageAlpha = 1;
  if (elapsed < t5) {
    const fadeInT = clamp01((elapsed - t4) / sceneFadeInMs);
    imageAlpha = easeOutCubic(fadeInT);
  } else if (elapsed < t6) {
    const holdElapsed = elapsed - t5;
    const cycleMs = 3000;
    const blinkPhase = holdElapsed % cycleMs;
    const blinkFadeMs = 110;
    const blinkClosedMs = 120;

    // Blink shape: visible -> quick close -> closed -> quick open -> visible.
    if (blinkPhase < blinkFadeMs) {
      imageAlpha = 1 - easeInCubic(blinkPhase / blinkFadeMs);
    } else if (blinkPhase < blinkFadeMs + blinkClosedMs) {
      imageAlpha = 0;
    } else if (blinkPhase < (blinkFadeMs * 2) + blinkClosedMs) {
      imageAlpha = easeOutCubic((blinkPhase - blinkFadeMs - blinkClosedMs) / blinkFadeMs);
    } else {
      imageAlpha = 1;
    }
  }

  const wakeElapsed = Math.max(0, elapsed - t4);
  const wakeProgress = clamp01(wakeElapsed / 1400);
  const swayAmp = (1 - wakeProgress) * 2.4 + 0.45;
  const swayX = Math.sin(now * 0.0019) * swayAmp;
  const swayY = Math.cos(now * 0.0014) * swayAmp * 0.6;
  const drawX = Math.round(baseDrawX + swayX);
  const drawY = Math.round(baseDrawY + swayY);
  const blurPx = (1 - wakeProgress) * 3.2;

  const clampedAlpha = clamp01(imageAlpha);

  ctx.save();
  // Cream backdrop that blends with the image's transparent/soft background.
  ctx.globalAlpha = clampedAlpha;
  ctx.fillStyle = "#efe3d2";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Just-woke-up look: start slightly out of focus, then sharpen quickly.
  ctx.filter = blurPx > 0.05 ? `blur(${blurPx.toFixed(2)}px)` : "none";
  ctx.globalAlpha = clampedAlpha;
  ctx.drawImage(sceneImage, drawX, drawY, drawW, drawH);
  ctx.filter = "none";

  // Fading morning haze over the mirror image.
  if (wakeProgress < 1) {
    const hazeAlpha = (1 - wakeProgress) * 0.34 * clampedAlpha;
    const haze = ctx.createRadialGradient(
      canvas.width * 0.5,
      canvas.height * 0.44,
      canvas.width * 0.08,
      canvas.width * 0.5,
      canvas.height * 0.52,
      canvas.width * 0.78
    );
    haze.addColorStop(0, `rgba(255,248,234,${hazeAlpha})`);
    haze.addColorStop(0.55, `rgba(244,231,210,${hazeAlpha * 0.55})`);
    haze.addColorStop(1, "rgba(244,231,210,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Eyelid-like darkening that opens away quickly.
  if (wakeProgress < 1) {
    const lidAlpha = (1 - wakeProgress) * 0.52 * clampedAlpha;
    const lidH = canvas.height * (0.24 - wakeProgress * 0.2);
    if (lidH > 0) {
      const topLid = ctx.createLinearGradient(0, 0, 0, lidH);
      topLid.addColorStop(0, `rgba(0,0,0,${lidAlpha})`);
      topLid.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = topLid;
      ctx.fillRect(0, 0, canvas.width, lidH);

      const bottomLid = ctx.createLinearGradient(0, canvas.height - lidH, 0, canvas.height);
      bottomLid.addColorStop(0, "rgba(0,0,0,0)");
      bottomLid.addColorStop(1, `rgba(0,0,0,${lidAlpha})`);
      ctx.fillStyle = bottomLid;
      ctx.fillRect(0, canvas.height - lidH, canvas.width, lidH);
    }
  }
  ctx.restore();
}

function drawForegroundBuildingOccluders(ctx, state, canvas, tileSize, cameraZoom, drawTile) {
  if (typeof state.getBuildingAtWorldTile !== "function") return;
  const drawnFountainForeground = new Set();

  const visibleW = canvas.width / cameraZoom;
  const visibleH = canvas.height / cameraZoom;

  const startX = Math.max(0, Math.floor(state.cam.x / tileSize) - 1);
  const endX = Math.min(state.currentMapW - 1, Math.ceil((state.cam.x + visibleW) / tileSize) + 1);
  const startY = Math.max(0, Math.floor(state.cam.y / tileSize) - 1);
  const endY = Math.min(state.currentMapH - 1, Math.ceil((state.cam.y + visibleH) / tileSize) + 1);

  for (let y = startY; y <= endY; y++) {
    const row = state.currentMap[y];
    if (!row) continue;

    for (let x = startX; x <= endX; x++) {
      const tileType = row[x];
      if (typeof tileType !== "number") continue;

      // Hanami dojo interior: redraw the exit curtain wall after entities so
      // the player appears behind it.
      if (state.currentAreaId === "hanamiDojo" && y === 9 && x === 11) {
        const drawX = x * tileSize - state.cam.x;
        const drawY = y * tileSize - state.cam.y;
        drawTile(tileType, drawX, drawY, x, y);
        continue;
      }

      const building = state.getBuildingAtWorldTile(x, y);
      if (building && building.type === "FOUNTAIN") {
        const localY = y - building.y;
        const depthRows = 2;
        const upperVisualRows = Math.max(0, building.height - depthRows);
        if (localY < upperVisualRows) {
          const key = building.id || `${building.x},${building.y},${building.width},${building.height}`;
          if (!drawnFountainForeground.has(key)) {
            drawnFountainForeground.add(key);
            const sprite = getFountainRenderSprite();
            if (sprite) {
              const drawX = building.x * tileSize - state.cam.x;
              const drawY = building.y * tileSize - state.cam.y;
              const drawW = building.width * tileSize;
              const drawH = building.height * tileSize;
              const buildingBottomWorldY = (building.y + building.height) * tileSize;
              const playerFootWorldY = (Number.isFinite(state.player?.y) ? state.player.y : 0) + tileSize * 0.92;
              // NPC-like depth rule: if protagonist foot-Y is above fountain front edge, protagonist is behind it.
              const playerBehindFountain = playerFootWorldY < buildingBottomWorldY;
              // The fountain's full height (except bottom 2 depth rows) draws in front.
              const clipY = drawY;
              const clipH = Math.max(0, drawH - tileSize * 2);
              if (playerBehindFountain && clipH > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(drawX, clipY, drawW, clipH);
                ctx.clip();
                ctx.drawImage(sprite, drawX, drawY, drawW, drawH);
                ctx.restore();

                // Hide tiny foot/leg bleed-through at the upper/lower fountain seam.
                const seamTop = drawY + clipH - tileSize * 0.34;
                const seamHeight = tileSize * 0.82;
                ctx.save();
                ctx.beginPath();
                ctx.rect(drawX, seamTop, drawW, seamHeight);
                ctx.clip();
                ctx.drawImage(sprite, drawX, drawY, drawW, drawH);
                ctx.restore();
              }
            }
          }
        }
        continue;
      }

      // Redraw dojo top row after entities so roof/eaves occlude player behind it.
      if (!building || building.type !== "DOJO" || y !== building.y) continue;

      const drawX = x * tileSize - state.cam.x;
      const drawY = y * tileSize - state.cam.y;
      drawTile(tileType, drawX, drawY, x, y);
    }
  }
}

export function renderGameFrame({
  ctx,
  canvas,
  cameraZoom,
  tileSize,
  spriteFrameWidth,
  spriteFrameHeight,
  spriteFramesPerRow,
  colors,
  ui,
  drawTile,
  getHandstandSprite,
  getEquippedTrainingHeadbandSprite = () => null,
  getItemSprite = () => null,
  drawCustomOverlays = null,
  state,
  dialogue
}) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  beginBuildingRenderFrame();

  ctx.save();
  ctx.scale(cameraZoom, cameraZoom);
  const visibleW = canvas.width / cameraZoom;
  const visibleH = canvas.height / cameraZoom;

  const startX = Math.max(0, Math.floor(state.cam.x / tileSize) - 1);
  const endX = Math.min(state.currentMapW - 1, Math.ceil((state.cam.x + visibleW) / tileSize) + 1);
  const startY = Math.max(0, Math.floor(state.cam.y / tileSize) - 1);
  const endY = Math.min(state.currentMapH - 1, Math.ceil((state.cam.y + visibleH) / tileSize) + 1);

  for (let y = startY; y <= endY; y++) {
    const row = state.currentMap[y];
    if (!row) continue;
    for (let x = startX; x <= endX; x++) {
      const tileType = row[x];
      if (typeof tileType !== "number") continue;
      const drawX = x * tileSize - state.cam.x;
      const drawY = y * tileSize - state.cam.y;
      drawTile(tileType, drawX, drawY, x, y);
    }
  }

  drawEntitiesLayer({
    ctx,
    state,
    canvas,
    tileSize,
    colors,
    getHandstandSprite,
    getEquippedTrainingHeadbandSprite,
    spriteFrameWidth,
    spriteFrameHeight,
    spriteFramesPerRow
  });
  drawForegroundBuildingOccluders(ctx, state, canvas, tileSize, cameraZoom, drawTile);
  drawWorldVfx(ctx, state);
  drawTrainingPopup(ctx, state, canvas, ui, colors, tileSize);
  drawDoorTransition(ctx, state, canvas, tileSize, cameraZoom);
  ctx.restore();

  const uiColors = deriveUiColors(colors, state.moodPreset);
  const dialogueActive = Boolean(dialogue && typeof dialogue.isActive === "function" && dialogue.isActive());
  const nonDialogueUiAlpha = getDialogueUiAlpha(dialogueActive);

  drawItemNotifications(ctx, state, cameraZoom, tileSize, uiColors, getItemSprite);

  if (nonDialogueUiAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha *= nonDialogueUiAlpha;
    drawSaveNotice(ctx, state, uiColors);
    ctx.restore();
  }
  drawAtmosphere(ctx, canvas, colors, state);
  drawMoodGrading(ctx, canvas, state);
  drawCombatDamageFlash(ctx, state);
  if (state.gameState === GAME_STATES.INTRO_CUTSCENE) {
    drawIntroCutsceneOverlay(ctx, canvas, state);
    return;
  }
  if (state.gameState === GAME_STATES.TITLE_SCREEN) {
    drawTitleScreenOverlay(ctx, canvas, state, colors);
    return;
  }
  if (nonDialogueUiAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha *= nonDialogueUiAlpha;
    drawCombatHud(ctx, state, uiColors, tileSize, cameraZoom, getItemSprite);
    drawCombatLevelHud(ctx, state, uiColors);
    drawObjectiveTracker(ctx, state, uiColors);
    drawMinimap(ctx, state, uiColors);
    drawDoorHint(ctx, state, uiColors, dialogue, cameraZoom);
    // Enemy XP feedback now uses world-space floating VFX instead of panel notifications.
    if (typeof drawCustomOverlays === "function") {
      drawCustomOverlays({ ctx, canvas, colors: uiColors, ui, state });
    }
    drawInventoryOverlay(ctx, state, canvas, ui, uiColors, getItemSprite);
    drawPauseMenuOverlay(ctx, state, canvas, ui, uiColors);
    drawAttributesOverlay(ctx, state, canvas, ui, uiColors);
    drawSettingsOverlay(ctx, state, canvas, ui, uiColors);
    ctx.restore();
  }
  drawCombatLevelCelebrationOverlay(ctx, state);
  drawTextbox(ctx, state, canvas, ui, uiColors, dialogue);
  drawPlayerDefeatOverlay(ctx, state, canvas);
}

