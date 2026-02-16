import { AREA_KINDS, BRANDING, GAME_STATES, TILE_TYPES, isFreeExploreState } from "../core/constants.js";
import { hash01 } from "../core/mathUtils.js";
import {
  FONT_12,
  FONT_16,
  FONT_20,
  FONT_22,
  FONT_28,
  getPrimaryBindingLabel,
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
  Inventory: "Check your satchel and gathered goods",
  Attributes: "Inspect your discipline and growth",
  Settings: "Tune controls and visual comfort",
  Save: "Save your current game",
  Load: "Restore your last manual save",
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
  ctx.fillText("W/S or Arrows: Move", instructionX, menuY + menuH - 60);
  ctx.fillText(`Space: Select   ${getPrimaryBindingLabel(state, "pause")}: Resume`, instructionX, menuY + menuH - 40);
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

  const instructionsY = boxY + boxH - 74;
  ctx.font = FONT_12;
  ctx.fillStyle = labelColor;
  ctx.fillText("W/S or Arrows: Navigate", boxX + 24, instructionsY);
  ctx.fillText("Space/Enter or Gamepad A: Apply/Toggle", boxX + 24, instructionsY + 18);
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

function drawCombatHud(ctx, state, colors) {
  if (!isFreeExploreState(state.gameState)) return;
  if (!state.player || !Number.isFinite(state.player.maxHp)) return;

  const showChallenge = Boolean(state.gameFlags?.acceptedTraining);
  const panelX = 14;
  const panelW = 224;
  const panelH = showChallenge ? 62 : 46;
  const panelY = 14;
  drawSkinnedPanel(ctx, panelX, panelY, panelW, panelH, colors);

  const hpRatio = Math.max(0, Math.min(1, state.player.hp / Math.max(1, state.player.maxHp)));
  const hpBarX = panelX + 12;
  const hpBarY = panelY + 28;
  const hpBarW = panelW - 24;
  const hpBarH = 12;

  ctx.font = FONT_12;
  drawUiText(ctx, `HP ${Math.round(state.player.hp)} / ${Math.round(state.player.maxHp)}`, panelX + 12, panelY + 19, colors);

  ctx.fillStyle = "rgba(11, 12, 16, 0.85)";
  ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);
  ctx.fillStyle = hpRatio > 0.5 ? "#7ad080" : hpRatio > 0.25 ? "#ddb95f" : "#d36a6a";
  ctx.fillRect(hpBarX, hpBarY, hpBarW * hpRatio, hpBarH);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(hpBarX + 0.5, hpBarY + 0.5, hpBarW - 1, hpBarH - 1);

  if (showChallenge) {
    const tp = state.gameFlags.townProgress?.[state.currentTownId];
    const kills = Number.isFinite(tp?.challengeKills) ? tp.challengeKills : 0;
    const target = Number.isFinite(tp?.challengeTarget) ? tp.challengeTarget : 3;
    ctx.font = FONT_12;
    const challengeText = state.gameFlags.completedTraining
      ? "Challenge complete"
      : `Challenge: ${kills}/${target}`;
    drawUiText(ctx, challengeText, panelX + 12, panelY + 48, colors);
  }
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
  const bottomReserve = state.doorHintText ? 54 : 14;
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

function drawDoorHint(ctx, state, colors, dialogue) {
  if (!isFreeExploreState(state.gameState)) return;
  if (dialogue && typeof dialogue.isActive === "function" && dialogue.isActive()) return;
  const text = state.doorHintText;
  if (!text) return;

  const interactKey = state.inputPromptMode === "gamepad" ? "A" : getPrimaryBindingLabel(state, "interact");
  const destinationText = text.startsWith("Door:") ? text.slice(5).trim() : text;

  ctx.font = FONT_12;
  const textW = ctx.measureText(destinationText).width;
  const chipW = Math.ceil(ctx.measureText(interactKey).width) + 12;
  const instructionText = "Enter";
  const instructionW = ctx.measureText(instructionText).width;
  const boxW = Math.max(160, chipW + instructionW + textW + 36);
  const boxH = 30;
  const boxX = Math.round((ctx.canvas.width - boxW) / 2);
  const boxY = ctx.canvas.height - 58;
  drawSkinnedPanel(ctx, boxX, boxY, boxW, boxH, colors);

  const chipX = boxX + 10;
  const chipY = boxY + 7;
  const renderedChipW = drawControlChip(ctx, interactKey, chipX, chipY, colors, { highlighted: true });
  let textX = chipX + renderedChipW + 8;
  drawUiText(ctx, instructionText, textX, boxY + 19, colors);
  textX += instructionW + 8;
  drawUiText(ctx, destinationText, textX, boxY + 19, colors);
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

function drawItemNotifications(ctx, state, cameraZoom, tileSize, colors) {
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
    const alpha = 1 - Math.max(0, (elapsed - (inventoryHint.durationMs - 600)) / 600);

    ctx.save();
    ctx.globalAlpha = alpha * 0.95;
    ctx.font = FONT_16;

    const inventoryKey = getPrimaryBindingLabel(state, "inventory");
    const hintText = `New item received - press ${inventoryKey} to view your inventory`;
    const padding = 8;
    const textW = ctx.measureText(hintText).width;
    const boxW = textW + padding * 2;
    const boxH = 28;
    const boxX = Math.round((ctx.canvas.width - boxW) / 2);
    const boxY = 12;

    drawSkinnedPanel(ctx, boxX, boxY, boxW, boxH, colors);
    drawUiText(ctx, hintText, boxX + padding, boxY + 19, colors);
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

  const now = performance.now() * 0.001;
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
      ctx.font = FONT_16;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const floatY = y - t * 22;
      ctx.fillStyle = effect.color || "rgba(255, 233, 190, 0.98)";
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 2;
      const text = String(effect.text || "");
      ctx.strokeText(text, x, floatY);
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
  topGlow.addColorStop(1, "rgba(12, 10, 16, 0.78)");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(8, 10, 16, 0.45)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const heroImage = state.titleHeroImage;
  const heroFrameWidth = Math.min(460, Math.round(canvas.width * 0.38));
  const heroFrameHeight = Math.min(560, Math.round(canvas.height * 0.72));
  const heroFrameX = canvas.width - heroFrameWidth - 70;
  const heroFrameY = Math.max(52, Math.round(canvas.height * 0.12));
  drawSkinnedPanel(ctx, heroFrameX, heroFrameY, heroFrameWidth, heroFrameHeight, colors, { titleBand: false });

  const heroInset = 14;
  const heroX = heroFrameX + heroInset;
  const heroY = heroFrameY + heroInset;
  const heroW = heroFrameWidth - heroInset * 2;
  const heroH = heroFrameHeight - heroInset * 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(heroX, heroY, heroW, heroH);
  ctx.clip();

  if (heroImage && heroImage.complete && heroImage.naturalWidth > 0 && heroImage.naturalHeight > 0) {
    const sourceRatio = heroImage.naturalWidth / heroImage.naturalHeight;
    const targetRatio = heroW / heroH;
    let srcX = 0;
    let srcY = 0;
    let srcW = heroImage.naturalWidth;
    let srcH = heroImage.naturalHeight;

    if (sourceRatio > targetRatio) {
      srcW = Math.round(heroImage.naturalHeight * targetRatio);
      srcX = Math.round((heroImage.naturalWidth - srcW) * 0.5);
    } else if (sourceRatio < targetRatio) {
      srcH = Math.round(heroImage.naturalWidth / targetRatio);
      srcY = Math.round((heroImage.naturalHeight - srcH) * 0.5);
    }

    ctx.drawImage(heroImage, srcX, srcY, srcW, srcH, heroX, heroY, heroW, heroH);
  } else {
    const fallback = ctx.createLinearGradient(heroX, heroY, heroX, heroY + heroH);
    fallback.addColorStop(0, "rgba(245, 222, 173, 0.4)");
    fallback.addColorStop(1, "rgba(26, 34, 46, 0.6)");
    ctx.fillStyle = fallback;
    ctx.fillRect(heroX, heroY, heroW, heroH);
  }

  const heroShade = ctx.createLinearGradient(heroX, heroY, heroX, heroY + heroH);
  heroShade.addColorStop(0, "rgba(10, 12, 19, 0.04)");
  heroShade.addColorStop(1, "rgba(10, 12, 19, 0.32)");
  ctx.fillStyle = heroShade;
  ctx.fillRect(heroX, heroY, heroW, heroH);
  ctx.restore();

  ctx.strokeStyle = "rgba(255, 231, 191, 0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(heroX + 0.5, heroY + 0.5, heroW - 1, heroH - 1);

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
    const activeIndex = hovered >= 0 ? hovered : titleState.selected;
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
  ctx.fillText("Arrow keys or stick: Navigate", panelX + 22, panelY + panelH - 38);
  ctx.fillText("Enter/Space or A/Start: Confirm", panelX + 22, panelY + panelH - 20);

  if (titleState.showHowTo) {
    const helpW = Math.min(canvas.width - 120, 520);
    const helpH = 236;
    const helpX = Math.round((canvas.width - helpW) / 2);
    const helpY = Math.round((canvas.height - helpH) / 2);
    drawSkinnedPanel(ctx, helpX, helpY, helpW, helpH, colors, { titleBand: true });
    ctx.font = FONT_22;
    drawUiText(ctx, "How To Play", helpX + 20, helpY + 36, colors);
    ctx.font = FONT_16;
    drawUiText(ctx, `Move: ${getPrimaryBindingLabel(state, "moveUp")} ${getPrimaryBindingLabel(state, "moveLeft")} ${getPrimaryBindingLabel(state, "moveDown")} ${getPrimaryBindingLabel(state, "moveRight")} or arrows`, helpX + 20, helpY + 72, colors);
    drawUiText(ctx, `Interact / Advance: ${getPrimaryBindingLabel(state, "interact")}`, helpX + 20, helpY + 96, colors);
    drawUiText(ctx, `Attack: ${getPrimaryBindingLabel(state, "attack")}`, helpX + 20, helpY + 120, colors);
    drawUiText(ctx, `Pause Menu: ${getPrimaryBindingLabel(state, "pause")}`, helpX + 20, helpY + 144, colors);
    drawUiText(ctx, `Inventory: ${getPrimaryBindingLabel(state, "inventory")}`, helpX + 20, helpY + 168, colors);
    drawUiText(ctx, "Gamepad: Left Stick + A/X + Start", helpX + 20, helpY + 192, colors);
    ctx.font = FONT_12;
    drawUiText(ctx, "Press ESC/B to close this panel", helpX + 20, helpY + 218, colors);
  }

  if (titleState.fadeOutActive) {
    const fadeElapsed = now - titleState.fadeOutStartedAt;
    const fadeRatio = Math.max(0, Math.min(1, fadeElapsed / Math.max(1, titleState.fadeOutDurationMs)));
    ctx.fillStyle = `rgba(0,0,0,${fadeRatio})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawForegroundBuildingOccluders(ctx, state, canvas, tileSize, cameraZoom, drawTile) {
  if (typeof state.getBuildingAtWorldTile !== "function") return;

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

      const building = state.getBuildingAtWorldTile(x, y);
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
  getItemSprite = () => null,
  drawCustomOverlays = null,
  state,
  dialogue
}) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

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
  drawItemNotifications(ctx, state, cameraZoom, tileSize, uiColors);
  drawSaveNotice(ctx, state, uiColors);
  drawAtmosphere(ctx, canvas, colors, state);
  drawMoodGrading(ctx, canvas, state);
  drawCombatDamageFlash(ctx, state);
  if (state.gameState === GAME_STATES.TITLE_SCREEN) {
    drawTitleScreenOverlay(ctx, canvas, state, colors);
    return;
  }
  drawCombatHud(ctx, state, uiColors);
  drawObjectiveTracker(ctx, state, uiColors);
  drawMinimap(ctx, state, uiColors);
  drawDoorHint(ctx, state, uiColors, dialogue);
  drawCombatRewardPanel(ctx, state, uiColors);
  if (typeof drawCustomOverlays === "function") {
    drawCustomOverlays({ ctx, canvas, colors: uiColors, ui, state });
  }
  drawInventoryOverlay(ctx, state, canvas, ui, uiColors, getItemSprite);
  drawPauseMenuOverlay(ctx, state, canvas, ui, uiColors);
  drawAttributesOverlay(ctx, state, canvas, ui, uiColors);
  drawSettingsOverlay(ctx, state, canvas, ui, uiColors);
  drawTextbox(ctx, state, canvas, ui, uiColors, dialogue);
  drawPlayerDefeatOverlay(ctx, state, canvas);
}

