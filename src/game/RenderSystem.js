import { AREA_KINDS, BRANDING, DISCIPLINE_UNLOCKS, GAME_STATES, TILE_TYPES, isFreeExploreState } from "../core/constants.js";
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
const DAY_NIGHT_TEST_CYCLE_SECONDS = 30 * 60;

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

function hash01(value) {
  const x = Math.sin(value * 127.1) * 43758.5453123;
  return x - Math.floor(x);
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

function drawSoundControlPanel(ctx, {
  boxX,
  boxY,
  boxW = 340,
  boxH = 148,
  highContrast = false,
  soundControls,
  inputPromptMode = "keyboard",
  layoutMode = "pause",
  showControllerHint = true
}) {
  const sliderX = boxX + 118;
  const sliderW = boxW - 184;
  const musicSliderY = boxY + 44;
  const sfxSliderY = boxY + 78;
  const musicVolume = clamp01(soundControls?.musicVolume);
  const sfxVolume = clamp01(soundControls?.sfxVolume);
  const hoveredSlider = soundControls?.hoveredSlider || "";
  const hoveredButton = soundControls?.hoveredButton || "";
  const draggingSlider = soundControls?.draggingSlider || "";
  const controllerFocusArea = layoutMode === "title"
    ? (soundControls?.controllerFocusTitle || "sound")
    : (soundControls?.controllerFocusPause || "menu");
  const controllerSelectedSlider = layoutMode === "title"
    ? (soundControls?.controllerSelectedTitle || "music")
    : (soundControls?.controllerSelectedPause || "music");
  const activeSlider = draggingSlider
    || hoveredSlider
    || (controllerFocusArea === "sound" ? controllerSelectedSlider : "");

  const soundAura = ctx.createRadialGradient(
    boxX + boxW * 0.45,
    boxY + boxH * 0.35,
    22,
    boxX + boxW * 0.5,
    boxY + boxH * 0.7,
    boxW * 0.9
  );
  soundAura.addColorStop(0, highContrast ? "rgba(96, 182, 234, 0.18)" : "rgba(247, 214, 145, 0.16)");
  soundAura.addColorStop(1, "rgba(247, 214, 145, 0)");
  ctx.fillStyle = soundAura;
  ctx.fillRect(boxX - 14, boxY - 14, boxW + 28, boxH + 28);

  const soundParchment = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxH);
  soundParchment.addColorStop(0, highContrast ? "#212833" : "#efe0b8");
  soundParchment.addColorStop(1, highContrast ? "#101722" : "#d3b57a");
  ctx.fillStyle = soundParchment;
  ctx.fillRect(boxX, boxY, boxW, boxH);

  const soundInner = ctx.createLinearGradient(boxX + 5, boxY + 5, boxX + 5, boxY + boxH - 5);
  soundInner.addColorStop(0, highContrast ? "rgba(48,58,74,0.86)" : "rgba(255,248,222,0.75)");
  soundInner.addColorStop(1, highContrast ? "rgba(26,35,49,0.82)" : "rgba(230,205,146,0.62)");
  ctx.fillStyle = soundInner;
  ctx.fillRect(boxX + 5, boxY + 5, boxW - 10, boxH - 10);

  ctx.strokeStyle = highContrast ? "#a6dfff" : "#6c4b1d";
  ctx.lineWidth = 3;
  ctx.strokeRect(boxX + 1.5, boxY + 1.5, boxW - 3, boxH - 3);

  ctx.strokeStyle = highContrast ? "#eef8ff" : "#f7e1ab";
  ctx.lineWidth = 1;
  ctx.strokeRect(boxX + 6.5, boxY + 6.5, boxW - 13, boxH - 13);

  const soundHeaderGradient = ctx.createLinearGradient(boxX + 8, boxY + 10, boxX + boxW - 8, boxY + 32);
  if (highContrast) {
    soundHeaderGradient.addColorStop(0, "rgba(41, 86, 118, 0.82)");
    soundHeaderGradient.addColorStop(0.5, "rgba(67, 132, 179, 0.74)");
    soundHeaderGradient.addColorStop(1, "rgba(41, 86, 118, 0.82)");
  } else {
    soundHeaderGradient.addColorStop(0, "rgba(116, 74, 32, 0.75)");
    soundHeaderGradient.addColorStop(0.5, "rgba(151, 105, 49, 0.65)");
    soundHeaderGradient.addColorStop(1, "rgba(116, 74, 32, 0.75)");
  }
  ctx.fillStyle = soundHeaderGradient;
  ctx.fillRect(boxX + 8, boxY + 10, boxW - 16, 22);

  ctx.font = FONT_16;
  ctx.fillStyle = highContrast ? "rgba(14, 28, 42, 0.5)" : "rgba(45, 24, 7, 0.45)";
  ctx.fillText("Sound Control", boxX + 20, boxY + 28);
  ctx.fillStyle = highContrast ? "#f7fdff" : "#fff2ca";
  ctx.fillText("Sound Control", boxX + 19, boxY + 27);

  const resetButtonW = 144;
  const resetButtonH = 20;
  const resetButtonX = Math.round(boxX + (boxW - resetButtonW) * 0.5);
  const resetButtonY = boxY + 100;
  const resetHovered = hoveredButton === "resetDefaults"
    || (controllerFocusArea === "sound" && controllerSelectedSlider === "resetDefaults");
  ctx.fillStyle = resetHovered
    ? (highContrast ? "rgba(156, 226, 255, 0.28)" : "rgba(126, 198, 108, 0.26)")
    : (highContrast ? "rgba(214, 240, 255, 0.12)" : "rgba(130, 88, 41, 0.12)");
  ctx.fillRect(resetButtonX, resetButtonY, resetButtonW, resetButtonH);
  ctx.strokeStyle = resetHovered
    ? (highContrast ? "#9dddff" : "#7fd86b")
    : (highContrast ? "rgba(214, 240, 255, 0.66)" : "rgba(126, 88, 41, 0.58)");
  ctx.lineWidth = resetHovered ? 2 : 1;
  ctx.strokeRect(resetButtonX + 0.5, resetButtonY + 0.5, resetButtonW - 1, resetButtonH - 1);
  ctx.font = FONT_12;
  ctx.textAlign = "center";
  ctx.fillStyle = resetHovered
    ? (highContrast ? "#f3fdff" : "#285d25")
    : (highContrast ? "#e8f8ff" : "#6b4520");
  ctx.fillText("Reset to Default", resetButtonX + resetButtonW * 0.5, resetButtonY + 14);
  ctx.textAlign = "left";

  if (showControllerHint) {
    const hintText = "R Stick: Vertical select  Horizontal adjust";
    ctx.font = FONT_12;
    ctx.fillStyle = highContrast ? "rgba(211,238,251,0.95)" : "rgba(88, 56, 26, 0.9)";
    ctx.textAlign = "center";
    ctx.fillText(hintText, boxX + boxW * 0.5, boxY + boxH - 10);
    ctx.textAlign = "left";
  }

  const drawPauseSlider = (label, value, centerY, isActive) => {
    const trackH = 6;
    const knobRadius = isActive ? 8 : 7;
    const fillW = Math.max(0, Math.min(sliderW, sliderW * value));
    if (isActive) {
      const activeGlow = ctx.createLinearGradient(boxX + 10, centerY - 13, boxX + boxW - 10, centerY + 13);
      if (highContrast) {
        activeGlow.addColorStop(0, "rgba(124, 213, 255, 0.08)");
        activeGlow.addColorStop(0.5, "rgba(166, 232, 255, 0.2)");
        activeGlow.addColorStop(1, "rgba(124, 213, 255, 0.08)");
      } else {
        activeGlow.addColorStop(0, "rgba(128, 219, 114, 0.08)");
        activeGlow.addColorStop(0.5, "rgba(160, 237, 145, 0.22)");
        activeGlow.addColorStop(1, "rgba(128, 219, 114, 0.08)");
      }
      ctx.fillStyle = activeGlow;
      ctx.fillRect(boxX + 10, centerY - 13, boxW - 20, 26);
    }
    const trackGradient = ctx.createLinearGradient(sliderX, centerY - 1, sliderX + sliderW, centerY + 1);
    if (highContrast) {
      trackGradient.addColorStop(0, "rgba(95, 138, 171, 0.85)");
      trackGradient.addColorStop(1, "rgba(56, 95, 129, 0.82)");
    } else {
      trackGradient.addColorStop(0, "rgba(142, 102, 58, 0.84)");
      trackGradient.addColorStop(1, "rgba(110, 74, 37, 0.82)");
    }
    ctx.fillStyle = trackGradient;
    ctx.fillRect(sliderX, centerY - trackH / 2, sliderW, trackH);

    const fillGradient = ctx.createLinearGradient(sliderX, centerY - 1, sliderX + fillW, centerY + 1);
    if (highContrast) {
      fillGradient.addColorStop(0, "rgba(171, 236, 255, 0.95)");
      fillGradient.addColorStop(1, "rgba(118, 205, 236, 0.95)");
    } else {
      fillGradient.addColorStop(0, "rgba(255, 229, 165, 0.95)");
      fillGradient.addColorStop(1, "rgba(227, 176, 95, 0.95)");
    }
    ctx.fillStyle = fillGradient;
    ctx.fillRect(sliderX, centerY - trackH / 2, fillW, trackH);

    const knobX = sliderX + fillW;
    ctx.beginPath();
    ctx.arc(knobX, centerY, knobRadius, 0, Math.PI * 2);
    ctx.fillStyle = highContrast ? "#e5f8ff" : "#fff2cf";
    ctx.fill();
    ctx.strokeStyle = highContrast ? "#73b9de" : "#8f5e2c";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = FONT_16;
    ctx.fillStyle = isActive
      ? (highContrast ? "#f3fdff" : "#285d25")
      : (highContrast ? "#e8f8ff" : "#4b2d12");
    ctx.fillText(label, boxX + 20, centerY + 5);
    ctx.font = FONT_12;
    const pct = `${Math.round(value * 100)}%`;
    ctx.fillStyle = isActive
      ? (highContrast ? "#dff7ff" : "#2f6b2c")
      : (highContrast ? "rgba(211,238,251,0.95)" : "rgba(88, 56, 26, 0.9)");
    const prevAlign = ctx.textAlign;
    const pctX = boxX + boxW - 20;
    ctx.textAlign = "right";
    ctx.fillText(pct, pctX, centerY + 4);
    ctx.textAlign = prevAlign;
  };

  drawPauseSlider("Music", musicVolume, musicSliderY, activeSlider === "music");
  drawPauseSlider("SFX", sfxVolume, sfxSliderY, activeSlider === "sfx");
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
  const soundBoxH = 148;
  const soundStackGap = 14;
  const soundStackH = soundBoxH + soundStackGap + menuH;
  const soundStackTop = Math.max(14, Math.round((canvas.height - soundStackH) * 0.5));
  const menuY = soundStackTop + soundBoxH + soundStackGap;
  const soundBoxW = menuW;
  const soundBoxX = menuX;
  const soundBoxY = soundStackTop;
  const soundControls = pauseMenuState?.soundControls || {};

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

  drawSoundControlPanel(ctx, {
    boxX: soundBoxX,
    boxY: soundBoxY,
    boxW: soundBoxW,
    boxH: soundBoxH,
    highContrast,
    soundControls,
    inputPromptMode: state.inputPromptMode,
    layoutMode: "pause",
    showControllerHint: true
  });

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

  const disciplineLevel = Number.isFinite(playerStats?.disciplineLevel)
    ? Math.max(1, Math.floor(playerStats.disciplineLevel))
    : 1;
  const disciplineXP = Number.isFinite(playerStats?.disciplineXP) ? Math.max(0, playerStats.disciplineXP) : 0;
  const disciplineXPNeeded = Number.isFinite(playerStats?.disciplineXPNeeded) ? Math.max(1, playerStats.disciplineXPNeeded) : 1;
  const progressRatio = clamp01(disciplineXP / disciplineXPNeeded);
  const unlocks = Array.isArray(DISCIPLINE_UNLOCKS)
    ? [...DISCIPLINE_UNLOCKS].sort((a, b) => {
      const levelA = Number.isFinite(a?.level) ? a.level : 9999;
      const levelB = Number.isFinite(b?.level) ? b.level : 9999;
      return levelA - levelB;
    })
    : [];
  const nextUnlock = unlocks.find((unlock) => Number.isFinite(unlock?.level) && unlock.level > disciplineLevel) || null;
  const unlockedCount = unlocks.filter((unlock) => Number.isFinite(unlock?.level) && unlock.level <= disciplineLevel).length;

  ctx.save();
  const backdropGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  backdropGradient.addColorStop(0, "rgba(4, 10, 17, 0.74)");
  backdropGradient.addColorStop(1, "rgba(6, 16, 28, 0.86)");
  ctx.fillStyle = backdropGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const panelW = Math.min(canvas.width - 64, 860);
  const panelH = Math.min(canvas.height - 64, 560);
  const panelX = Math.round((canvas.width - panelW) * 0.5);
  const panelY = Math.round((canvas.height - panelH) * 0.5);
  drawSkinnedPanel(ctx, panelX, panelY, panelW, panelH, colors, { titleBand: true });

  const panelShine = ctx.createRadialGradient(
    panelX + panelW * 0.78,
    panelY + panelH * 0.18,
    8,
    panelX + panelW * 0.78,
    panelY + panelH * 0.18,
    panelW * 0.68
  );
  panelShine.addColorStop(0, "rgba(134, 225, 255, 0.18)");
  panelShine.addColorStop(1, "rgba(134, 225, 255, 0)");
  ctx.fillStyle = panelShine;
  ctx.fillRect(panelX, panelY, panelW, panelH);

  ctx.font = FONT_28;
  drawUiText(ctx, "Discipline Progression", panelX + 24, panelY + 42, colors);
  ctx.font = FONT_12;
  drawUiText(ctx, "Unlock abilities as your discipline grows", panelX + 24, panelY + 62, colors);

  const levelBadgeW = 128;
  const levelBadgeH = 34;
  const levelBadgeX = panelX + panelW - levelBadgeW - 22;
  const levelBadgeY = panelY + 18;
  ctx.beginPath();
  drawRoundedRectPath(ctx, levelBadgeX, levelBadgeY, levelBadgeW, levelBadgeH, 12);
  const levelBadgeGrad = ctx.createLinearGradient(levelBadgeX, levelBadgeY, levelBadgeX, levelBadgeY + levelBadgeH);
  levelBadgeGrad.addColorStop(0, "rgba(38, 91, 112, 0.88)");
  levelBadgeGrad.addColorStop(1, "rgba(18, 50, 64, 0.9)");
  ctx.fillStyle = levelBadgeGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(162, 234, 255, 0.74)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.font = FONT_16;
  ctx.fillStyle = "#dff7ff";
  ctx.fillText(`Lv ${disciplineLevel}`, levelBadgeX + 40, levelBadgeY + 22);

  const contentX = panelX + 22;
  const contentY = panelY + 76;
  const contentW = panelW - 44;
  const contentH = panelH - 112;
  const summaryW = Math.max(250, Math.min(332, Math.floor(contentW * 0.4)));
  const summaryH = contentH;
  const roadmapX = contentX + summaryW + 16;
  const roadmapW = contentW - summaryW - 16;

  ctx.beginPath();
  drawRoundedRectPath(ctx, contentX, contentY, summaryW, summaryH, 16);
  const summaryGrad = ctx.createLinearGradient(contentX, contentY, contentX, contentY + summaryH);
  summaryGrad.addColorStop(0, "rgba(18, 33, 52, 0.93)");
  summaryGrad.addColorStop(1, "rgba(11, 23, 38, 0.94)");
  ctx.fillStyle = summaryGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(130, 202, 235, 0.42)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = FONT_20;
  ctx.fillStyle = "#ecf8ff";
  ctx.fillText("Current Growth", contentX + 16, contentY + 30);

  ctx.font = FONT_16;
  ctx.fillStyle = "#b7deef";
  ctx.fillText(`Discipline Lv. ${disciplineLevel}`, contentX + 16, contentY + 56);

  const xpBarX = contentX + 16;
  const xpBarY = contentY + 70;
  const xpBarW = summaryW - 32;
  const xpBarH = 24;
  ctx.beginPath();
  drawRoundedRectPath(ctx, xpBarX, xpBarY, xpBarW, xpBarH, 10);
  ctx.fillStyle = "rgba(15, 28, 42, 0.9)";
  ctx.fill();
  ctx.strokeStyle = "rgba(159, 220, 247, 0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();

  if (progressRatio > 0) {
    ctx.beginPath();
    drawRoundedRectPath(ctx, xpBarX + 2, xpBarY + 2, Math.max(0, (xpBarW - 4) * progressRatio), xpBarH - 4, 8);
    const fillGrad = ctx.createLinearGradient(xpBarX, xpBarY, xpBarX, xpBarY + xpBarH);
    fillGrad.addColorStop(0, "#73e7ca");
    fillGrad.addColorStop(1, "#2f8f9e");
    ctx.fillStyle = fillGrad;
    ctx.fill();
  }

  ctx.font = FONT_12;
  ctx.fillStyle = "#e9fbff";
  const xpText = `${disciplineXP} / ${disciplineXPNeeded} XP`;
  const xpTextW = ctx.measureText(xpText).width;
  ctx.fillText(xpText, xpBarX + (xpBarW - xpTextW) * 0.5, xpBarY + 16);

  ctx.font = FONT_16;
  ctx.fillStyle = "#d5ecf9";
  ctx.fillText(`Unlocks active: ${unlockedCount}/${unlocks.length}`, contentX + 16, xpBarY + 52);

  const nextUnlockText = nextUnlock
    ? `Next: Lv.${nextUnlock.level} ${String(nextUnlock.title || "Unlock")}`
    : "All listed unlocks are active";
  ctx.font = FONT_12;
  ctx.fillStyle = "#9dc2d8";
  const nextUnlockLines = wrapTextLines(ctx, nextUnlockText, summaryW - 32).slice(0, 2);
  for (let i = 0; i < nextUnlockLines.length; i += 1) {
    ctx.fillText(nextUnlockLines[i], contentX + 16, xpBarY + 78 + i * 16);
  }

  ctx.font = FONT_12;
  ctx.fillStyle = "rgba(192, 225, 239, 0.86)";
  ctx.fillText("Future unlocks can be added in core constants.", contentX + 16, contentY + summaryH - 18);

  ctx.beginPath();
  drawRoundedRectPath(ctx, roadmapX, contentY, roadmapW, contentH, 16);
  const roadmapGrad = ctx.createLinearGradient(roadmapX, contentY, roadmapX, contentY + contentH);
  roadmapGrad.addColorStop(0, "rgba(17, 40, 60, 0.9)");
  roadmapGrad.addColorStop(1, "rgba(8, 20, 34, 0.93)");
  ctx.fillStyle = roadmapGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(138, 206, 236, 0.42)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = FONT_20;
  ctx.fillStyle = "#ecf8ff";
  ctx.fillText("Unlock Roadmap", roadmapX + 16, contentY + 30);

  const listX = roadmapX + 16;
  const listY = contentY + 44;
  const listW = roadmapW - 32;
  const cardGap = 10;
  const cardH = 76;
  const maxCards = Math.max(1, Math.floor((contentH - 58) / (cardH + cardGap)));
  const displayUnlocks = unlocks.slice(0, maxCards);

  for (let i = 0; i < displayUnlocks.length; i += 1) {
    const unlock = displayUnlocks[i];
    const unlockLevel = Number.isFinite(unlock?.level) ? Math.max(1, Math.floor(unlock.level)) : 1;
    const unlocked = disciplineLevel >= unlockLevel;
    const currentGoal = !unlocked && nextUnlock && unlock.id === nextUnlock.id;
    const cardY = listY + i * (cardH + cardGap);

    ctx.beginPath();
    drawRoundedRectPath(ctx, listX, cardY, listW, cardH, 12);
    const cardGrad = ctx.createLinearGradient(listX, cardY, listX, cardY + cardH);
    if (unlocked) {
      cardGrad.addColorStop(0, "rgba(29, 94, 85, 0.86)");
      cardGrad.addColorStop(1, "rgba(17, 57, 52, 0.9)");
    } else if (currentGoal) {
      cardGrad.addColorStop(0, "rgba(64, 87, 120, 0.86)");
      cardGrad.addColorStop(1, "rgba(37, 56, 88, 0.9)");
    } else {
      cardGrad.addColorStop(0, "rgba(34, 46, 64, 0.86)");
      cardGrad.addColorStop(1, "rgba(21, 30, 43, 0.9)");
    }
    ctx.fillStyle = cardGrad;
    ctx.fill();
    ctx.strokeStyle = unlocked
      ? "rgba(118, 236, 200, 0.74)"
      : (currentGoal ? "rgba(167, 206, 255, 0.68)" : "rgba(129, 156, 184, 0.45)");
    ctx.lineWidth = unlocked ? 1.4 : 1;
    ctx.stroke();

    const statusText = unlocked ? "Unlocked" : (currentGoal ? "Current Goal" : "Locked");
    ctx.font = FONT_12;
    ctx.fillStyle = unlocked ? "#b8ffe8" : (currentGoal ? "#d4ebff" : "#9cb8d1");
    ctx.fillText(statusText, listX + 14, cardY + 18);

    ctx.font = FONT_16;
    ctx.fillStyle = "#edf7ff";
    ctx.fillText(String(unlock?.title || "Unknown Unlock"), listX + 14, cardY + 39);

    const tagText = String(unlock?.tag || "Ability");
    ctx.font = FONT_12;
    ctx.fillStyle = "#d1e7f3";
    ctx.fillText(tagText, listX + 14, cardY + 56);

    const levelPillW = 72;
    const levelPillH = 24;
    const levelPillX = listX + listW - levelPillW - 10;
    const levelPillY = cardY + 10;
    ctx.beginPath();
    drawRoundedRectPath(ctx, levelPillX, levelPillY, levelPillW, levelPillH, 10);
    ctx.fillStyle = unlocked ? "rgba(116, 228, 178, 0.24)" : "rgba(129, 164, 198, 0.22)";
    ctx.fill();
    ctx.strokeStyle = unlocked ? "rgba(127, 244, 195, 0.62)" : "rgba(150, 184, 215, 0.48)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = unlocked ? "#c8ffe9" : "#d8ebff";
    ctx.font = FONT_12;
    ctx.fillText(`Level ${unlockLevel}`, levelPillX + 10, levelPillY + 16);

    ctx.font = FONT_12;
    ctx.fillStyle = "rgba(219, 240, 255, 0.85)";
    const descriptionLines = wrapTextLines(ctx, String(unlock?.description || ""), listW - 110).slice(0, 1);
    if (descriptionLines.length > 0) ctx.fillText(descriptionLines[0], listX + 14, cardY + 69);
  }

  if (displayUnlocks.length < unlocks.length) {
    const hiddenCount = unlocks.length - displayUnlocks.length;
    ctx.font = FONT_12;
    ctx.fillStyle = "rgba(171, 207, 233, 0.84)";
    ctx.fillText(`+${hiddenCount} more unlock${hiddenCount > 1 ? "s" : ""}`, listX, contentY + contentH - 12);
  }

  ctx.font = FONT_12;
  drawUiText(ctx, "Press Esc to close", panelX + panelW - 140, panelY + panelH - 12, colors);
  ctx.restore();
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

  const slotCount = 8;
  const slotGap = 6;
  const desiredSlotSize = 54;
  const minSlotSize = 40;
  const maxSlotsWidth = Math.max(120, ctx.canvas.width - 24);
  const slotSize = Math.max(
    minSlotSize,
    Math.min(desiredSlotSize, Math.floor((maxSlotsWidth - (slotCount - 1) * slotGap) / slotCount))
  );
  const slotsW = slotCount * slotSize + (slotCount - 1) * slotGap;
  const slotsX = Math.round((ctx.canvas.width - slotsW) / 2);
  const bottomMargin = 12;
  const slotToBarsGap = 10;

  const legacySlotsWidth = (8 * 36) + (7 * 4);
  const barW = Math.min(Math.max(250, legacySlotsWidth), ctx.canvas.width - 34);
  const barH = 12;
  const barX = Math.round((ctx.canvas.width - barW) / 2);
  const barsPanelH = 74;
  const barsPanelY = ctx.canvas.height - barsPanelH - bottomMargin;
  const hpBarY = barsPanelY + 24;
  const manaBarY = barsPanelY + 50;
  const barsPanelX = barX - 12;
  const barsPanelW = barW + 24;
  const slotsY = barsPanelY - slotSize - slotToBarsGap;

  const hpRatio = Math.max(0, Math.min(1, state.player.hp / Math.max(1, state.player.maxHp)));
  const maxMana = Number.isFinite(state.player.maxMana) ? Math.max(1, state.player.maxMana) : 10;
  const mana = Number.isFinite(state.player.mana) ? state.player.mana : maxMana;
  const manaRatio = Math.max(0, Math.min(1, mana / maxMana));
  const now = performance.now();
  const poisonedUntil = Number.isFinite(state.playerStatusEffects?.poisonedUntil)
    ? state.playerStatusEffects.poisonedUntil
    : 0;
  const poisonActive = poisonedUntil > now;
  const poisonPulse = poisonActive ? (0.5 + Math.sin(now * 0.01) * 0.5) : 0;
  const skillSlots = Array.isArray(state.player.skillSlots) ? state.player.skillSlots : [];
  const hasWeaponEquipped = Boolean(String(state.playerEquipment?.weapon || "").trim());
  const feedback = state.player.skillHudFeedback && typeof state.player.skillHudFeedback === "object"
    ? state.player.skillHudFeedback
    : null;
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
  const slotsRight = slotsX + slotsW;
  const slotsBottom = slotsY + slotSize;
  const playerBehindBarsPanel = !(
    playerRight < barsPanelX ||
    playerLeft > panelRight ||
    playerBottom < barsPanelY ||
    playerTop > panelBottom
  );
  const playerBehindSkillSlots = !(
    playerRight < slotsX ||
    playerLeft > slotsRight ||
    playerBottom < slotsY ||
    playerTop > slotsBottom
  );
  const targetBarsAlpha = (playerBehindBarsPanel || playerBehindSkillSlots) ? 0.35 : 1;
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
  drawUiText(ctx, `Mana ${Math.floor(mana)} / ${Math.round(maxMana)}`, barX + 2, manaBarY - 3, colors);

  ctx.fillStyle = "rgba(10, 12, 18, 0.88)";
  ctx.fillRect(barX, hpBarY, barW, barH);
  ctx.fillRect(barX, manaBarY, barW, barH);
  if (poisonActive) {
    const poisonHpGradient = ctx.createLinearGradient(barX, hpBarY, barX + barW, hpBarY + barH);
    poisonHpGradient.addColorStop(0, `rgba(122, 255, 124, ${(0.42 + poisonPulse * 0.14).toFixed(3)})`);
    poisonHpGradient.addColorStop(0.46, "rgba(76, 197, 86, 0.88)");
    poisonHpGradient.addColorStop(1, "rgba(186, 255, 174, 0.58)");
    ctx.fillStyle = poisonHpGradient;
  } else {
    ctx.fillStyle = hpRatio > 0.5 ? "#df4949" : hpRatio > 0.25 ? "#cf3434" : "#b91f1f";
  }
  ctx.fillRect(barX, hpBarY, Math.round(barW * hpRatio), barH);
  if (poisonActive) {
    const sheen = ctx.createLinearGradient(barX, hpBarY, barX, hpBarY + barH);
    sheen.addColorStop(0, `rgba(230, 255, 212, ${(0.16 + poisonPulse * 0.15).toFixed(3)})`);
    sheen.addColorStop(1, "rgba(230, 255, 212, 0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(barX, hpBarY, Math.round(barW * hpRatio), barH);
  }
  ctx.fillStyle = "#4da3ff";
  ctx.fillRect(barX, manaBarY, Math.round(barW * manaRatio), barH);
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(barX + 0.5, hpBarY + 0.5, barW - 1, barH - 1);
  ctx.strokeRect(barX + 0.5, manaBarY + 0.5, barW - 1, barH - 1);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = barsAlpha;
  for (let i = 0; i < slotCount; i++) {
    const slotX = slotsX + i * (slotSize + slotGap);
    const slot = skillSlots[i];
    const isAssigned = Boolean(slot?.id);
    const skillId = String(slot?.id || "").trim().toLowerCase();
    const manaCost = Number.isFinite(slot?.manaCost) ? Math.max(0, slot.manaCost) : 0;
    const hasMana = mana >= manaCost;
    const cooldownMs = Number.isFinite(slot?.cooldownMs) ? Math.max(0, slot.cooldownMs) : 0;
    const lastUsedAt = Number.isFinite(slot?.lastUsedAt) ? slot.lastUsedAt : -Infinity;
    const cooldownElapsed = now - lastUsedAt;
    const cooldownRatio = cooldownMs > 0
      ? Math.max(0, Math.min(1, cooldownElapsed / cooldownMs))
      : 1;
    const isRecharging = isAssigned && cooldownMs > 0 && cooldownElapsed < cooldownMs;
    const blockedByWeapon = isAssigned && skillId === "bonk" && !hasWeaponEquipped;
    const isFeedbackSlot = feedback && feedback.slotIndex === i && feedback.until > now;
    const slotInset = Math.max(6, Math.round(slotSize * 0.16));
    const slotInnerSize = slotSize - slotInset * 2;

    drawSkinnedPanel(ctx, slotX, slotsY, slotSize, slotSize, colors);

    ctx.fillStyle = isAssigned ? "rgba(230, 210, 178, 0.2)" : "rgba(8, 10, 14, 0.55)";
    ctx.fillRect(slotX + slotInset, slotsY + slotInset, slotInnerSize, slotInnerSize);

    if (!isAssigned) {
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      ctx.strokeRect(slotX + slotInset + 0.5, slotsY + slotInset + 0.5, slotInnerSize - 1, slotInnerSize - 1);
    } else if (typeof getItemSprite === "function") {
      const skillSpriteName = skillId || null;
      const skillSprite = skillSpriteName ? getItemSprite(skillSpriteName) : null;
      if (skillSprite && skillSprite.width && skillSprite.height) {
        const iconPadding = 1;
        const iconSize = Math.max(1, slotSize - iconPadding * 2);
        ctx.drawImage(skillSprite, slotX + iconPadding, slotsY + iconPadding, iconSize, iconSize);
      }
    } else if (!hasMana) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(slotX + slotInset, slotsY + slotInset, slotInnerSize, slotInnerSize);
    }

    if (isAssigned && !hasMana) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(slotX + slotInset, slotsY + slotInset, slotInnerSize, slotInnerSize);
    }
    if (isRecharging) {
      const meterX = slotX + 1;
      const meterY = slotsY + 1;
      const meterW = Math.max(1, slotSize - 2);
      const meterH = Math.max(1, slotSize - 2);
      const filledH = Math.max(0, Math.min(meterH, Math.round(meterH * cooldownRatio)));
      const remainingMs = Math.max(0, cooldownMs - cooldownElapsed);
      const remainingSeconds = remainingMs / 1000;
      const cooldownLabel = remainingSeconds >= 10
        ? String(Math.ceil(remainingSeconds))
        : remainingSeconds.toFixed(1);
      ctx.fillStyle = "rgba(4, 8, 16, 0.54)";
      ctx.fillRect(meterX, meterY, meterW, meterH);
      if (filledH > 0) {
        const fillY = meterY + meterH - filledH;
        ctx.fillStyle = "rgba(124, 186, 255, 0.3)";
        ctx.fillRect(meterX, fillY, meterW, filledH);
        ctx.strokeStyle = "rgba(176, 219, 255, 0.62)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(meterX, fillY + 0.5);
        ctx.lineTo(meterX + meterW, fillY + 0.5);
        ctx.stroke();
      }

      const pulse = 0.78 + Math.sin(now * 0.012) * 0.12;
      const labelCx = slotX + slotSize * 0.5;
      const labelCy = slotsY + slotSize * 0.53;
      const chipW = Math.max(22, Math.round(slotSize * 0.54));
      const chipH = Math.max(14, Math.round(slotSize * 0.29));
      const chipX = Math.round(labelCx - chipW * 0.5);
      const chipY = Math.round(labelCy - chipH * 0.58);
      const chipGradient = ctx.createLinearGradient(0, chipY, 0, chipY + chipH);
      chipGradient.addColorStop(0, `rgba(16, 26, 46, ${(0.86 * pulse).toFixed(3)})`);
      chipGradient.addColorStop(1, `rgba(8, 14, 26, ${(0.92 * pulse).toFixed(3)})`);
      ctx.fillStyle = chipGradient;
      ctx.fillRect(chipX, chipY, chipW, chipH);
      ctx.strokeStyle = `rgba(173, 221, 255, ${(0.68 * pulse).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(chipX + 0.5, chipY + 0.5, chipW - 1, chipH - 1);

      ctx.save();
      ctx.font = `700 ${Math.max(11, Math.round(slotSize * 0.3))}px 'Trebuchet MS', 'Verdana', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(4, 8, 14, 0.95)";
      ctx.lineWidth = 3;
      ctx.strokeText(cooldownLabel, labelCx, labelCy);
      ctx.fillStyle = "rgba(202, 235, 255, 0.98)";
      ctx.fillText(cooldownLabel, labelCx, labelCy);
      ctx.restore();
    }
    if (blockedByWeapon) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 88, 88, 0.95)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(slotX + 8, slotsY + 8);
      ctx.lineTo(slotX + slotSize - 8, slotsY + slotSize - 8);
      ctx.moveTo(slotX + slotSize - 8, slotsY + 8);
      ctx.lineTo(slotX + 8, slotsY + slotSize - 8);
      ctx.stroke();
      ctx.restore();
    }

    if (isFeedbackSlot) {
      const status = feedback.status || "";
      ctx.strokeStyle = status === "used"
        ? "rgba(138, 224, 152, 0.95)"
        : status === "noMana"
          ? "rgba(116, 176, 255, 0.95)"
          : status === "cooldown"
            ? "rgba(255, 188, 96, 0.95)"
            : status === "blocked"
              ? "rgba(255, 108, 108, 0.95)"
              : "rgba(255, 220, 128, 0.95)";
      ctx.lineWidth = 2;
      ctx.strokeRect(slotX + 2, slotsY + 2, slotSize - 4, slotSize - 4);
    }

    const slotNumberText = String(i + 1);
    const slotNumberX = slotX + slotSize / 2;
    const slotNumberY = slotsY + slotSize - Math.max(4, Math.round(slotSize * 0.11));
    ctx.save();
    ctx.font = FONT_12;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const slotNumberW = Math.ceil(ctx.measureText(slotNumberText).width);
    const slotChipW = Math.max(12, slotNumberW + 8);
    const slotChipH = 11;
    const slotChipX = Math.round(slotNumberX - slotChipW / 2);
    const slotChipY = Math.round(slotNumberY - slotChipH + 2);
    ctx.fillStyle = "rgba(9, 14, 20, 0.78)";
    ctx.fillRect(slotChipX, slotChipY, slotChipW, slotChipH);
    ctx.strokeStyle = "rgba(228, 212, 182, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(slotChipX + 0.5, slotChipY + 0.5, slotChipW - 1, slotChipH - 1);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
    ctx.lineWidth = 2;
    ctx.strokeText(slotNumberText, slotNumberX, slotNumberY);
    ctx.fillStyle = "rgba(244, 244, 244, 0.98)";
    ctx.fillText(slotNumberText, slotNumberX, slotNumberY);
    ctx.restore();
    ctx.textAlign = "start";

    if (isAssigned && manaCost > 0) {
      const manaText = String(manaCost);
      const manaTextX = slotX + slotSize - Math.max(12, Math.round(slotSize * 0.22));
      const manaTextY = slotsY + Math.max(12, Math.round(slotSize * 0.22));
      ctx.save();
      ctx.font = FONT_12;
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
      const manaTextW = Math.ceil(ctx.measureText(manaText).width);
      const manaChipW = Math.max(12, manaTextW + 8);
      const manaChipH = 11;
      const manaChipX = Math.round(manaTextX - 4);
      const manaChipY = Math.round(manaTextY - manaChipH + 1);
      ctx.fillStyle = "rgba(8, 14, 24, 0.8)";
      ctx.fillRect(manaChipX, manaChipY, manaChipW, manaChipH);
      ctx.strokeStyle = "rgba(132, 194, 255, 0.55)";
      ctx.lineWidth = 1;
      ctx.strokeRect(manaChipX + 0.5, manaChipY + 0.5, manaChipW - 1, manaChipH - 1);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.82)";
      ctx.lineWidth = 2;
      ctx.strokeText(manaText, manaTextX, manaTextY);
      ctx.fillStyle = "rgba(132, 202, 255, 0.98)";
      ctx.fillText(manaText, manaTextX, manaTextY);
      ctx.restore();
    }
  }
  ctx.restore();

}

function drawPlayerPoisonStatus(ctx, state, tileSize, getItemSprite = null) {
  if (!state?.player || !state?.cam) return;
  const poison = state.playerStatusEffects && typeof state.playerStatusEffects === "object"
    ? state.playerStatusEffects
    : null;
  if (!poison) return;
  const now = performance.now();
  const poisonedUntil = Number.isFinite(poison.poisonedUntil) ? poison.poisonedUntil : 0;
  if (poisonedUntil <= now) return;

  const durationMs = Number.isFinite(poison.poisonDurationMs) ? Math.max(1, poison.poisonDurationMs) : 15000;
  const remainingMs = Math.max(0, poisonedUntil - now);
  const ratio = Math.max(0, Math.min(1, remainingMs / durationMs));
  const player = state.player;
  const cam = state.cam;
  const px = player.x - cam.x + tileSize * 0.5;
  const py = player.y - cam.y - tileSize * 1.48;

  const iconSize = Math.max(16, Math.round(tileSize * 0.78));
  const panelSize = iconSize + 4;
  const panelX = Math.round(px - panelSize * 0.5);
  const panelY = Math.round(py - panelSize * 0.5);
  const sprite = typeof getItemSprite === "function" ? getItemSprite("poisoned") : null;

  ctx.save();
  ctx.fillStyle = "rgba(10, 16, 10, 0.78)";
  ctx.fillRect(panelX, panelY, panelSize, panelSize);
  ctx.strokeStyle = "rgba(173, 255, 169, 0.88)";
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelSize - 1, panelSize - 1);
  if (sprite && sprite.width && sprite.height) {
    ctx.drawImage(sprite, panelX + 2, panelY + 2, iconSize, iconSize);
  }

  const barW = Math.max(24, Math.round(tileSize * 1.38));
  const barH = 4;
  const barX = Math.round(px - barW * 0.5);
  const barY = panelY - 8;
  ctx.fillStyle = "rgba(5, 10, 8, 0.84)";
  ctx.fillRect(barX, barY, barW, barH);
  const poisonBar = ctx.createLinearGradient(barX, barY, barX + barW, barY);
  poisonBar.addColorStop(0, "rgba(183, 255, 165, 0.95)");
  poisonBar.addColorStop(1, "rgba(76, 196, 84, 0.95)");
  ctx.fillStyle = poisonBar;
  ctx.fillRect(barX, barY, Math.round(barW * ratio), barH);
  ctx.strokeStyle = "rgba(221, 255, 216, 0.78)";
  ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
  ctx.restore();
}

function drawControllerSkillWheel(ctx, state, tileSize, getItemSprite = null) {
  if (!isFreeExploreState(state.gameState)) return;
  if (!state.player || !state.controllerSkillWheelState?.active) return;

  const wheelState = state.controllerSkillWheelState;
  const skillSlots = Array.isArray(state.player.skillSlots) ? state.player.skillSlots : [];
  const desiredHeightTiles = Number.isFinite(state.player.desiredHeightTiles)
    ? Math.max(1, state.player.desiredHeightTiles)
    : 1;

  const centerX = state.player.x + tileSize * 0.5 - state.cam.x;
  const playerDrawHeight = tileSize * desiredHeightTiles;
  const centerY = state.player.y + tileSize - (playerDrawHeight * 0.5) - state.cam.y;
  const radius = tileSize * 1.95;
  const slotRadius = Math.max(10, tileSize * 0.5);
  const selectedIndex = Number.isFinite(wheelState.selectedIndex) ? wheelState.selectedIndex : -1;
  const wheelSkin = typeof getItemSprite === "function"
    ? (getItemSprite("controllerSkillWheel2") || getItemSprite("controllerSkillWheel"))
    : null;
  const hasWheelSkin = Boolean(wheelSkin && wheelSkin.width && wheelSkin.height);
  const wheelDrawSize = Math.round(tileSize * 5.9);
  const wheelHalf = wheelDrawSize * 0.5;
  const iconRadiusFromSkin = wheelDrawSize * 0.315;
  const iconRadius = hasWheelSkin ? iconRadiusFromSkin : radius;
  const iconSize = hasWheelSkin
    ? Math.max(12, wheelDrawSize * 0.188)
    : Math.max(8, slotRadius * 1.4);
  const skinSlotMaskRadius = hasWheelSkin ? Math.max(10, wheelDrawSize * 0.072) : 0;
  const maxMana = Number.isFinite(state.player?.maxMana) ? Math.max(1, state.player.maxMana) : 10;
  const mana = Number.isFinite(state.player?.mana) ? state.player.mana : maxMana;
  const hasWeaponEquipped = Boolean(String(state.playerEquipment?.weapon || "").trim());
  const now = performance.now();

  ctx.save();
  if (!hasWheelSkin) {
    ctx.fillStyle = "rgba(8, 14, 20, 0.58)";
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + slotRadius * 0.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 236, 194, 0.55)";
    ctx.lineWidth = Math.max(1, tileSize * 0.055);
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + slotRadius * 0.18, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let i = 0; i < 8; i++) {
    const angle = (-Math.PI / 2) + i * (Math.PI / 4);
    const slotX = centerX + Math.cos(angle) * iconRadius;
    const slotY = centerY + Math.sin(angle) * iconRadius;
    const selected = i === selectedIndex;
    const slot = skillSlots[i] && typeof skillSlots[i] === "object" ? skillSlots[i] : null;
    const hasSkill = Boolean(slot?.id);
    const skillId = String(slot?.id || "").trim().toLowerCase();
    const manaCost = Number.isFinite(slot?.manaCost) ? Math.max(0, slot.manaCost) : 0;
    const hasMana = mana >= manaCost;
    const cooldownMs = Number.isFinite(slot?.cooldownMs) ? Math.max(0, slot.cooldownMs) : 0;
    const lastUsedAt = Number.isFinite(slot?.lastUsedAt) ? slot.lastUsedAt : -Infinity;
    const cooldownElapsed = now - lastUsedAt;
    const isRecharging = hasSkill && cooldownMs > 0 && cooldownElapsed < cooldownMs;
    const blockedByWeapon = hasSkill && skillId === "bonk" && !hasWeaponEquipped;
    const isUnavailable = hasSkill && (isRecharging || !hasMana || blockedByWeapon);
    const showRedSlotGlow = !hasSkill || isUnavailable;

    if (!hasWheelSkin) {
      ctx.fillStyle = selected ? "rgba(255, 233, 164, 0.9)" : "rgba(15, 23, 36, 0.86)";
      ctx.beginPath();
      ctx.arc(slotX, slotY, slotRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = selected ? "rgba(255, 249, 231, 0.98)" : "rgba(228, 205, 157, 0.6)";
      ctx.lineWidth = selected ? 2 : 1;
      ctx.beginPath();
      ctx.arc(slotX, slotY, slotRadius - 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (hasSkill && typeof getItemSprite === "function") {
      const sprite = getItemSprite(skillId);
      if (sprite && sprite.width && sprite.height) {
        if (hasWheelSkin) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(slotX, slotY, skinSlotMaskRadius, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(sprite, slotX - iconSize / 2, slotY - iconSize / 2, iconSize, iconSize);

          // Feather icon edges so artwork blends behind transparent slot borders.
          const fade = ctx.createRadialGradient(
            slotX,
            slotY,
            skinSlotMaskRadius * 0.58,
            slotX,
            slotY,
            skinSlotMaskRadius
          );
          fade.addColorStop(0, "rgba(0, 0, 0, 0)");
          fade.addColorStop(0.78, "rgba(0, 0, 0, 0)");
          fade.addColorStop(1, "rgba(0, 0, 0, 0.42)");
          ctx.globalCompositeOperation = "destination-out";
          ctx.fillStyle = fade;
          ctx.beginPath();
          ctx.arc(slotX, slotY, skinSlotMaskRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.drawImage(sprite, slotX - iconSize / 2, slotY - iconSize / 2, iconSize, iconSize);
        }
      }
    }

    if (showRedSlotGlow) {
      const glowRadius = hasWheelSkin ? Math.max(14, wheelDrawSize * 0.112) : Math.max(10, slotRadius * 1.14);
      const innerAlpha = hasSkill ? 0.34 : 0.44;
      const outerAlpha = hasSkill ? 0.13 : 0.2;
      const redGlow = ctx.createRadialGradient(slotX, slotY, glowRadius * 0.2, slotX, slotY, glowRadius);
      redGlow.addColorStop(0, `rgba(255, 72, 72, ${innerAlpha})`);
      redGlow.addColorStop(0.72, `rgba(230, 42, 42, ${outerAlpha})`);
      redGlow.addColorStop(1, "rgba(180, 24, 24, 0)");
      ctx.fillStyle = redGlow;
      ctx.beginPath();
      ctx.arc(slotX, slotY, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (hasWheelSkin) {
    // Draw the frame after icons so transparent slot windows naturally mask icon edges.
    ctx.drawImage(wheelSkin, centerX - wheelHalf, centerY - wheelHalf, wheelDrawSize, wheelDrawSize);
    if (selectedIndex >= 0) {
      const selectedAngle = (-Math.PI / 2) + selectedIndex * (Math.PI / 4);
      const selectedX = centerX + Math.cos(selectedAngle) * iconRadius;
      const selectedY = centerY + Math.sin(selectedAngle) * iconRadius;
      ctx.strokeStyle = "rgba(255, 245, 213, 0.95)";
      ctx.lineWidth = Math.max(2, wheelDrawSize * 0.008);
      ctx.beginPath();
      ctx.arc(selectedX, selectedY, wheelDrawSize * 0.075, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (selectedIndex >= 0) {
    const selectedAngle = (-Math.PI / 2) + selectedIndex * (Math.PI / 4);
    const markerRadius = hasWheelSkin ? (iconRadius - wheelDrawSize * 0.07) : (radius - slotRadius * 0.62);
    const markerX = centerX + Math.cos(selectedAngle) * markerRadius;
    const markerY = centerY + Math.sin(selectedAngle) * markerRadius;
    ctx.fillStyle = "rgba(255, 246, 218, 0.95)";
    ctx.beginPath();
    ctx.arc(markerX, markerY, Math.max(2, tileSize * 0.08), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
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

function drawFriendliesHud(ctx, state, colors) {
  if (!isFreeExploreState(state.gameState)) return;
  const obeyState = state.obeyState && typeof state.obeyState === "object" ? state.obeyState : null;
  if (!obeyState?.petId) return;
  const isPetWaitingOutside = Boolean(obeyState.petWaitingOutside);
  const npcs = Array.isArray(state.npcs) ? state.npcs : [];
  const pet = npcs.find((npc) => npc && npc.id === obeyState.petId) || null;
  if (!pet && !isPetWaitingOutside) return;

  const petType = String((pet && pet.name) || obeyState.petTypeName || "Companion").trim() || "Companion";
  const petName = `Pet ${petType}`;
  const petLevel = Number.isFinite(pet?.level)
    ? Math.max(1, Math.floor(pet.level))
    : (Number.isFinite(obeyState.petLevel) ? Math.max(1, Math.floor(obeyState.petLevel)) : 1);
  const petXp = Number.isFinite(pet?.xp)
    ? Math.max(0, pet.xp)
    : (Number.isFinite(obeyState.petXp) ? Math.max(0, obeyState.petXp) : 0);
  const petXpNeeded = Number.isFinite(pet?.xpNeeded)
    ? Math.max(1, pet.xpNeeded)
    : (Number.isFinite(obeyState.petXpNeeded) ? Math.max(1, obeyState.petXpNeeded) : 1);
  const petXpRemaining = Math.max(0, petXpNeeded - petXp);
  const petMaxHp = Number.isFinite(pet?.maxHp)
    ? Math.max(1, pet.maxHp)
    : (Number.isFinite(obeyState.petMaxHp) ? Math.max(1, obeyState.petMaxHp) : 15);
  const petHp = Number.isFinite(pet?.hp)
    ? Math.max(0, Math.min(petMaxHp, pet.hp))
    : (Number.isFinite(obeyState.petHp) ? Math.max(0, Math.min(petMaxHp, obeyState.petHp)) : petMaxHp);
  const petPassedOut = Boolean((pet && pet.passedOut) || obeyState.petPassedOut) || petHp <= 0;
  const hpRatio = Math.max(0, Math.min(1, petHp / petMaxHp));

  const panelW = Math.min(232, ctx.canvas.width - 28);
  const panelH = 82;
  const panelX = ctx.canvas.width - panelW - 14;
  const panelY = 148;
  const barX = panelX + 12;
  const barY = panelY + 36;
  const barW = panelW - 24;
  const barH = 12;

  drawSkinnedPanel(ctx, panelX, panelY, panelW, panelH, colors, { titleBand: true });
  ctx.font = FONT_12;
  drawUiText(ctx, "Friendlies", panelX + 10, panelY + 16, colors);
  ctx.font = FONT_16;
  drawUiText(ctx, petName, panelX + 10, panelY + 30, colors);

  ctx.fillStyle = "rgba(10, 12, 18, 0.9)";
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = hpRatio > 0.5 ? "#df4949" : hpRatio > 0.25 ? "#cf3434" : "#b91f1f";
  ctx.fillRect(barX, barY, Math.round(barW * hpRatio), barH);
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
  if (isPetWaitingOutside) {
    const previousAlign = ctx.textAlign;
    const previousBaseline = ctx.textBaseline;
    ctx.font = FONT_12;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(236, 241, 255, 0.96)";
    ctx.fillText("Waiting Outside", barX + barW * 0.5, barY + barH * 0.5 + 0.5);
    ctx.textAlign = previousAlign;
    ctx.textBaseline = previousBaseline;
  } else if (petPassedOut) {
    const previousAlign = ctx.textAlign;
    const previousBaseline = ctx.textBaseline;
    ctx.font = FONT_12;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255, 232, 232, 0.95)";
    ctx.fillText("passed out", barX + barW * 0.5, barY + barH * 0.5 + 0.5);
    ctx.textAlign = previousAlign;
    ctx.textBaseline = previousBaseline;
  }

  ctx.font = FONT_12;
  ctx.textAlign = "right";
  drawUiText(ctx, `${Math.round(petHp)} / ${Math.round(petMaxHp)}`, panelX + panelW - 10, panelY + 61, colors);
  ctx.textAlign = "start";
  drawUiText(ctx, `Lvl ${petLevel} - ${Math.ceil(petXpRemaining)} xp to next`, panelX + 10, panelY + panelH - 8, colors);
  ctx.textAlign = "start";
}

function drawPlayerSkillChannelBar(ctx, state, tileSize, getItemSprite = null) {
  if (!state?.player || !state?.cam) return;
  const player = state.player;
  const now = performance.now();
  const obeyState = state.obeyState && typeof state.obeyState === "object" ? state.obeyState : null;
  let ratio = 0;
  let label = "";
  let barFillColor = "#7ecf9a";
  let iconId = "";

  if (obeyState?.active && Number.isFinite(obeyState.startedAt) && Number.isFinite(obeyState.durationMs) && obeyState.durationMs > 0) {
    const elapsed = Math.max(0, now - obeyState.startedAt);
    ratio = Math.max(0, Math.min(1, elapsed / obeyState.durationMs));
    label = "Obey";
    barFillColor = "#7ecf9a";
    iconId = "obey";
  } else if (
    String(player?.activeAttackId || "").toLowerCase() === "bonkstrike" &&
    player?.attackState === "windup" &&
    Number.isFinite(player.attackStartedAt) &&
    Number.isFinite(player.attackActiveAt) &&
    player.attackActiveAt > player.attackStartedAt
  ) {
    const elapsed = Math.max(0, now - player.attackStartedAt);
    const durationMs = Math.max(1, player.attackActiveAt - player.attackStartedAt);
    ratio = Math.max(0, Math.min(1, elapsed / durationMs));
    label = "Bonk";
    barFillColor = "#f0c266";
    iconId = "bonk";
  } else {
    return;
  }

  const playerX = Number.isFinite(player.x) ? player.x : 0;
  const playerY = Number.isFinite(player.y) ? player.y : 0;
  const camX = Number.isFinite(state.cam.x) ? state.cam.x : 0;
  const camY = Number.isFinite(state.cam.y) ? state.cam.y : 0;
  const barW = Math.max(18, tileSize * 1.18);
  const barH = Math.max(3, Math.round(tileSize * 0.13));
  const barX = Math.round(playerX - camX + (tileSize - barW) * 0.5);
  const barY = Math.round(playerY - camY + tileSize + Math.max(2, Math.round(tileSize * 0.05)));
  ctx.fillStyle = "rgba(8, 12, 16, 0.86)";
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = barFillColor;
  ctx.fillRect(barX, barY, Math.round(barW * ratio), barH);
  ctx.strokeStyle = "rgba(245, 250, 236, 0.68)";
  ctx.lineWidth = 1;
  ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);

  const skillIcon = typeof getItemSprite === "function" ? getItemSprite(iconId) : null;
  const iconSize = Math.max(18, Math.round(tileSize * 0.92));
  const iconX = Math.round(barX + (barW - iconSize) * 0.5);
  const iconY = Math.round(barY + barH + 4);
  if (skillIcon && skillIcon.width && skillIcon.height) {
    ctx.fillStyle = "rgba(10, 14, 18, 0.72)";
    ctx.fillRect(iconX - 2, iconY - 2, iconSize + 4, iconSize + 4);
    ctx.drawImage(skillIcon, iconX, iconY, iconSize, iconSize);
  }

  ctx.font = FONT_12;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(245, 250, 236, 0.95)";
  ctx.fillText(label, Math.round(barX + barW * 0.5), iconY + iconSize + 10);
  ctx.textAlign = "start";
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

function drawQuestTrackerHint(ctx, state, colors) {
  if (!isFreeExploreState(state.gameState)) return;
  const flags = state.gameFlags && typeof state.gameFlags === "object" ? state.gameFlags : null;
  if (!flags?.patInnIntroSeen || flags.questTrackerHintDismissed) return;

  const hintText = "Press 'G' to track quests";
  const pulse = 0.92 + Math.sin(performance.now() * 0.006) * 0.08;
  ctx.save();
  ctx.font = "700 22px 'Cinzel', 'Palatino Linotype', 'Book Antiqua', serif";
  const panelW = Math.max(420, Math.ceil(ctx.measureText(hintText).width) + 48);
  const panelH = 50;
  const panelX = Math.round((ctx.canvas.width - panelW) * 0.5);
  const panelY = 8;

  ctx.globalAlpha = 0.94;
  const glow = ctx.createRadialGradient(
    panelX + panelW * 0.5,
    panelY + panelH * 0.5,
    12,
    panelX + panelW * 0.5,
    panelY + panelH * 0.5,
    panelW * 0.62
  );
  glow.addColorStop(0, `rgba(136, 197, 255, ${(0.2 * pulse).toFixed(3)})`);
  glow.addColorStop(1, "rgba(136, 197, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(panelX - 18, panelY - 10, panelW + 36, panelH + 20);

  const hintGradient = ctx.createLinearGradient(0, panelY, 0, panelY + panelH);
  hintGradient.addColorStop(0, "rgba(18, 34, 58, 0.96)");
  hintGradient.addColorStop(1, "rgba(9, 16, 28, 0.92)");
  ctx.fillStyle = hintGradient;
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = `rgba(175, 225, 255, ${(0.92 * pulse).toFixed(3)})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);

  const oldAlign = ctx.textAlign;
  const oldBaseline = ctx.textBaseline;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const textX = panelX + panelW * 0.5;
  const textY = panelY + panelH * 0.54;
  ctx.strokeStyle = "rgba(4, 10, 18, 0.92)";
  ctx.lineWidth = 4;
  ctx.strokeText(hintText, textX, textY);
  ctx.fillStyle = `rgba(226, 244, 255, ${(0.98 * pulse).toFixed(3)})`;
  ctx.fillText(hintText, textX, textY);
  ctx.textAlign = oldAlign;
  ctx.textBaseline = oldBaseline;
  ctx.restore();
}

function wrapTextLines(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
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
  }
  if (line) lines.push(line);
  return lines;
}

function drawQuestTrackerOverlay(ctx, state, canvas, ui, colors) {
  if (state.gameState !== GAME_STATES.QUEST_TRACKER) return;
  const quests = Array.isArray(state.questTrackerState?.quests) ? state.questTrackerState.quests : [];
  const mouseUiState = state.mouseUiState;
  const mouseX = Number.isFinite(mouseUiState?.x) ? mouseUiState.x : -1;
  const mouseY = Number.isFinite(mouseUiState?.y) ? mouseUiState.y : -1;
  let clickRequested = Boolean(mouseUiState?.questTrackerClickRequest);
  const wasInsideCanvas = Boolean(mouseUiState?.insideCanvas);

  ctx.save();
  ctx.fillStyle = "rgba(6, 7, 12, 0.62)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const panelW = Math.min(canvas.width - 56, 740);
  const panelH = Math.min(canvas.height - 56, 520);
  const panelX = Math.round((canvas.width - panelW) * 0.5);
  const panelY = Math.round((canvas.height - panelH) * 0.5);
  drawSkinnedPanel(ctx, panelX, panelY, panelW, panelH, colors, { titleBand: true });

  ctx.font = FONT_28;
  drawUiText(ctx, "Quest Tracker", panelX + 18, panelY + 40, colors);
  ctx.font = FONT_12;
  drawUiText(ctx, "Press G or Esc to close", panelX + panelW - 190, panelY + 24, colors);

  const questListX = panelX + 14;
  const questListY = panelY + 58;
  const questListW = panelW - 28;
  const questListH = panelH - 76;
  ctx.fillStyle = "rgba(16, 19, 26, 0.45)";
  ctx.fillRect(questListX, questListY, questListW, questListH);
  ctx.strokeStyle = colors.PANEL_BORDER_DARK || colors.DIALOGUE_BORDER;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(questListX + 0.5, questListY + 0.5, questListW - 1, questListH - 1);

  let cursorY = questListY + 10;
  for (const quest of quests) {
    const id = String(quest?.id || "");
    const isActiveQuest = id.length > 0 && id === String(state.questTrackerState?.activeQuestId || "");
    const rowX = questListX + 8;
    const rowW = questListW - 16;
    const rowH = 32;
    const setActiveLabel = isActiveQuest ? "Active" : "Set Active";
    ctx.font = FONT_12;
    const setActiveW = Math.ceil(ctx.measureText(setActiveLabel).width) + 14;
    const setActiveH = 18;
    const setActiveX = rowX + rowW - setActiveW - 8;
    const setActiveY = cursorY + 7;
    const isHeaderHovered = wasInsideCanvas &&
      mouseX >= rowX && mouseX <= rowX + rowW &&
      mouseY >= cursorY && mouseY <= cursorY + rowH;
    const isSetActiveHovered = wasInsideCanvas &&
      mouseX >= setActiveX && mouseX <= setActiveX + setActiveW &&
      mouseY >= setActiveY && mouseY <= setActiveY + setActiveH;
    if (isActiveQuest) {
      ctx.fillStyle = "rgba(140, 220, 255, 0.12)";
      ctx.fillRect(rowX, cursorY, rowW, rowH);
    }
    if (isHeaderHovered) {
      ctx.fillStyle = "rgba(255, 238, 190, 0.12)";
      ctx.fillRect(rowX, cursorY, rowW, rowH);
    }
    if (clickRequested && isSetActiveHovered) {
      if (id && state.questTrackerState) {
        state.questTrackerState.activeQuestId = id;
      }
      clickRequested = false;
    } else if (clickRequested && isHeaderHovered) {
      if (id && state.questTrackerState?.collapsedById) {
        const wasCollapsed = Boolean(state.questTrackerState.collapsedById[id]);
        if (wasCollapsed) {
          state.questTrackerState.collapsedById[id] = false;
        } else {
          state.questTrackerState.collapsedById[id] = true;
          if (state.questTrackerState.preferredOpenQuestId === id) {
            state.questTrackerState.preferredOpenQuestId = "";
          }
        }
      }
      clickRequested = false;
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    const collapsed = Boolean(quest?.collapsed);
    const questCompleted = Boolean(quest?.completed);
    const caret = collapsed ? "+" : "-";
    const questName = String(quest?.name || "Quest");
    const questTitleColors = questCompleted
      ? {
        ...colors,
        TEXT: "rgba(222, 228, 236, 0.76)",
        TEXT_SHADOW: "rgba(0, 0, 0, 0.55)"
      }
      : colors;
    ctx.font = FONT_20;
    drawUiText(ctx, caret, rowX + 4, cursorY + 20, colors);
    drawUiText(ctx, questName, rowX + 26, cursorY + 20, questTitleColors);
    ctx.fillStyle = isActiveQuest
      ? "rgba(114, 201, 245, 0.3)"
      : (isSetActiveHovered ? "rgba(255, 236, 194, 0.2)" : "rgba(255, 236, 194, 0.12)");
    ctx.fillRect(setActiveX, setActiveY, setActiveW, setActiveH);
    ctx.strokeStyle = isActiveQuest
      ? "rgba(114, 201, 245, 0.9)"
      : "rgba(255, 236, 194, 0.7)";
    ctx.lineWidth = 1;
    ctx.strokeRect(setActiveX + 0.5, setActiveY + 0.5, setActiveW - 1, setActiveH - 1);
    ctx.font = FONT_12;
    drawUiText(ctx, setActiveLabel, setActiveX + 7, setActiveY + 13, colors);
    if (isActiveQuest) {
      ctx.font = FONT_12;
      drawUiText(ctx, "[Active]", Math.max(rowX + 26, setActiveX - 72), cursorY + 20, colors);
    }
    if (questCompleted) {
      const questNameWidth = Math.ceil(ctx.measureText(questName).width);
      const strikeY = cursorY + 13;
      const strikeStartX = rowX + 26;
      const strikeEndX = strikeStartX + questNameWidth;
      ctx.save();
      ctx.strokeStyle = "rgba(6, 6, 8, 0.94)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(strikeStartX, strikeY);
      ctx.lineTo(strikeEndX, strikeY);
      ctx.stroke();

      const tickBaseX = Math.min(rowX + rowW - 18, strikeEndX + 12);
      const tickBaseY = cursorY + 12;
      ctx.strokeStyle = "rgba(102, 226, 124, 0.98)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(tickBaseX - 6, tickBaseY + 2);
      ctx.lineTo(tickBaseX - 2, tickBaseY + 6);
      ctx.lineTo(tickBaseX + 7, tickBaseY - 3);
      ctx.stroke();
      ctx.restore();
    }

    const steps = Array.isArray(quest?.steps) ? quest.steps : [];
    const currentStepIndex = Number.isFinite(quest?.currentStepIndex)
      ? Math.max(0, Math.min(steps.length - 1, Math.floor(quest.currentStepIndex)))
      : 0;
    if (!collapsed) {
      const visibleSteps = quest?.completed ? steps : steps.slice(0, currentStepIndex + 1);
      const currentStep = visibleSteps.length > 0 ? visibleSteps[Math.min(currentStepIndex, visibleSteps.length - 1)] : null;
      const currentText = quest?.completed
        ? "Current Part: Complete"
        : `Current Part: ${currentStep?.text || "In progress"}`;
      ctx.font = FONT_12;
      drawUiText(ctx, currentText, rowX + 26, cursorY + 34, colors);

      let stepY = cursorY + 56;
      for (let i = 0; i < visibleSteps.length; i++) {
        const step = visibleSteps[i];
        const isCurrent = !quest?.completed && i === currentStepIndex;
        const mark = step?.done ? "[x]" : "[ ]";
        const stepColors = step?.done
          ? {
            ...colors,
            TEXT: "rgba(224, 230, 236, 0.58)",
            TEXT_SHADOW: "rgba(0, 0, 0, 0.36)"
          }
          : colors;
        ctx.font = FONT_12;
        drawUiText(ctx, mark, rowX + 28, stepY, stepColors);
        const wrapped = wrapTextLines(ctx, String(step?.text || ""), rowW - 72);
        for (let w = 0; w < wrapped.length; w++) {
          const textY = stepY + w * 14;
          if (isCurrent) {
            ctx.fillStyle = "rgba(255, 236, 179, 0.26)";
            ctx.fillRect(rowX + 44, textY - 11, rowW - 52, 14);
          }
          drawUiText(ctx, wrapped[w], rowX + 48, textY, stepColors);
        }
        stepY += Math.max(18, wrapped.length * 14 + 4);
      }
      cursorY = stepY + 8;
    } else {
      cursorY += rowH + 8;
    }
  }

  ctx.restore();
  if (mouseUiState) {
    mouseUiState.questTrackerClickRequest = false;
  }
}

function drawQuestCompletionOverlay(ctx, state, canvas, ui, colors, getItemSprite = () => null) {
  if (state.gameState !== GAME_STATES.QUEST_COMPLETION) return;
  const completion = state.questCompletionState && typeof state.questCompletionState === "object"
    ? state.questCompletionState
    : null;
  if (!completion?.active) return;
  const mouseUiState = state.mouseUiState;
  const mouseInside = Boolean(mouseUiState?.insideCanvas);
  const mouseX = Number.isFinite(mouseUiState?.x) ? mouseUiState.x : -1;
  const mouseY = Number.isFinite(mouseUiState?.y) ? mouseUiState.y : -1;
  const clickRequested = Boolean(mouseUiState?.questCompletionClickRequest);

  ctx.save();
  ctx.fillStyle = "rgba(5, 8, 12, 0.68)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const panelW = Math.min(canvas.width - 90, 640);
  const panelH = Math.min(canvas.height - 90, 430);
  const panelX = Math.round((canvas.width - panelW) * 0.5);
  const panelY = Math.round((canvas.height - panelH) * 0.5);
  drawSkinnedPanel(ctx, panelX, panelY, panelW, panelH, colors, { titleBand: true });

  ctx.font = FONT_28;
  drawUiText(ctx, String(completion.questName || "Quest Complete"), panelX + 18, panelY + 40, colors);

  const summary = String(completion.summary || "");
  ctx.font = FONT_12;
  const summaryLines = wrapTextLines(ctx, summary, panelW - 36, 4);
  let summaryY = panelY + 66;
  for (const line of summaryLines) {
    drawUiText(ctx, line, panelX + 18, summaryY, colors);
    summaryY += 14;
  }

  ctx.font = FONT_16;
  drawUiText(ctx, "Completion Rewards", panelX + 18, summaryY + 16, colors);

  const rewards = Array.isArray(completion.rewards) ? completion.rewards : [];
  const rewardCardW = 112;
  const rewardCardH = 122;
  const rewardGap = 14;
  const totalRewardsW = rewards.length * rewardCardW + Math.max(0, rewards.length - 1) * rewardGap;
  let rewardX = panelX + Math.max(18, Math.round((panelW - totalRewardsW) * 0.5));
  const rewardY = summaryY + 30;
  for (const reward of rewards) {
    ctx.fillStyle = "rgba(10, 14, 22, 0.72)";
    ctx.fillRect(rewardX, rewardY, rewardCardW, rewardCardH);
    ctx.strokeStyle = "rgba(255, 229, 170, 0.52)";
    ctx.lineWidth = 1;
    ctx.strokeRect(rewardX + 0.5, rewardY + 0.5, rewardCardW - 1, rewardCardH - 1);

    const iconBoxSize = 56;
    const iconX = rewardX + Math.round((rewardCardW - iconBoxSize) * 0.5);
    const iconY = rewardY + 12;
    ctx.fillStyle = "rgba(22, 28, 37, 0.82)";
    ctx.fillRect(iconX, iconY, iconBoxSize, iconBoxSize);
    ctx.strokeStyle = "rgba(255,255,255,0.26)";
    ctx.strokeRect(iconX + 0.5, iconY + 0.5, iconBoxSize - 1, iconBoxSize - 1);

    const spriteKey = String(reward?.sprite || "");
    const sprite = spriteKey ? getItemSprite(spriteKey) : null;
    if (sprite && (sprite.width > 0 || sprite.naturalWidth > 0)) {
      ctx.drawImage(sprite, iconX + 2, iconY + 2, iconBoxSize - 4, iconBoxSize - 4);
    } else {
      // Fallback XP-style icon.
      ctx.fillStyle = "rgba(250, 214, 110, 0.92)";
      ctx.beginPath();
      ctx.arc(iconX + iconBoxSize * 0.5, iconY + iconBoxSize * 0.5, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = FONT_12;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(40, 22, 8, 0.95)";
      ctx.fillText("XP", iconX + iconBoxSize * 0.5, iconY + iconBoxSize * 0.5 + 4);
      ctx.textAlign = "start";
    }

    ctx.font = FONT_12;
    const label = String(reward?.label || "");
    const labelLines = wrapTextLines(ctx, label, rewardCardW - 12, 2);
    let labelY = rewardY + 84;
    for (const line of labelLines) {
      const lineW = ctx.measureText(line).width;
      drawUiText(ctx, line, rewardX + (rewardCardW - lineW) * 0.5, labelY, colors);
      labelY += 14;
    }

    rewardX += rewardCardW + rewardGap;
  }

  const buttonW = panelW - 48;
  const buttonH = 38;
  const buttonX = panelX + 24;
  const buttonY = panelY + panelH - buttonH - 20;
  const buttonHovered = mouseInside &&
    mouseX >= buttonX && mouseX <= buttonX + buttonW &&
    mouseY >= buttonY && mouseY <= buttonY + buttonH;
  ctx.fillStyle = buttonHovered ? "rgba(119, 169, 107, 0.92)" : "rgba(94, 146, 84, 0.9)";
  ctx.fillRect(buttonX, buttonY, buttonW, buttonH);
  ctx.strokeStyle = "rgba(14, 28, 12, 0.86)";
  ctx.lineWidth = 2;
  ctx.strokeRect(buttonX + 0.5, buttonY + 0.5, buttonW - 1, buttonH - 1);
  ctx.font = FONT_16;
  const buttonText = "Complete Quest";
  const buttonTextW = ctx.measureText(buttonText).width;
  drawUiText(ctx, buttonText, buttonX + (buttonW - buttonTextW) * 0.5, buttonY + 24, colors);

  if (clickRequested && buttonHovered) {
    completion.requestComplete = true;
  }
  if (mouseUiState) {
    mouseUiState.questCompletionClickRequest = false;
  }
  ctx.restore();
}

function drawGamepadVirtualCursor(ctx, state) {
  const gameState = state.gameState;
  if (state.inputPromptMode !== "gamepad") return;
  if (
    gameState !== GAME_STATES.INVENTORY &&
    gameState !== GAME_STATES.QUEST_TRACKER &&
    gameState !== GAME_STATES.QUEST_COMPLETION
  ) return;
  const mouseX = Number.isFinite(state.mouseUiState?.x) ? state.mouseUiState.x : -1;
  const mouseY = Number.isFinite(state.mouseUiState?.y) ? state.mouseUiState.y : -1;
  if (mouseX < 0 || mouseY < 0) return;

  ctx.save();
  const outerR = 10;
  const innerR = 3;
  const pulse = 0.75 + Math.sin(performance.now() * 0.01) * 0.12;
  ctx.fillStyle = `rgba(9, 14, 24, ${(0.7 * pulse).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(mouseX, mouseY, outerR + 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 243, 212, 0.95)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mouseX, mouseY, outerR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(145, 214, 255, 0.95)";
  ctx.beginPath();
  ctx.arc(mouseX, mouseY, innerR, 0, Math.PI * 2);
  ctx.fill();
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
  const { inventoryHint } = state;

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

function drawAtmosphere(ctx, canvas, colors, state, cameraZoom = 1) {
  const isOverworld = state.currentAreaKind === AREA_KINDS.OVERWORLD;
  const isBogland = state.currentAreaId === "bogland";
  const reducedFlashes = Boolean(state.userSettings?.reducedFlashes);
  const intensity = reducedFlashes ? 0.58 : 1;
  const atmosphereCam = state?.atmosphereCam || state?.cam || { x: 0, y: 0 };
  const nowSec = Number.isFinite(state?.atmosphereTimeSec)
    ? state.atmosphereTimeSec
    : performance.now() * 0.001;
  const cycleT = ((nowSec % DAY_NIGHT_TEST_CYCLE_SECONDS) + DAY_NIGHT_TEST_CYCLE_SECONDS) % DAY_NIGHT_TEST_CYCLE_SECONDS;
  const cycleRatio = cycleT / DAY_NIGHT_TEST_CYCLE_SECONDS;
  const dayNightWave = 0.5 - 0.5 * Math.cos(cycleRatio * Math.PI * 2);
  const smoothNight = dayNightWave * dayNightWave * (3 - (2 * dayNightWave));
  const presetNightFloor = state?.moodPreset === "inkQuiet" ? 1 : 0;
  // Keep one shared day/night cycle across overworld areas (town + bogland).
  const nightFactor = isOverworld ? smoothNight : presetNightFloor;
  const hasNightMood = nightFactor > 0.02;

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

  if (isOverworld && isBogland) {
    const camX = Number.isFinite(atmosphereCam?.x) ? atmosphereCam.x : 0;
    const camY = Number.isFinite(atmosphereCam?.y) ? atmosphereCam.y : 0;
    const wrapFog = (value, size) => ((value % size) + size) % size;
    const fogSpanX = Math.max(canvas.width * 4.5, 3600);
    const fogSpanY = Math.max(canvas.height * 2.7, 2000);
    const bogMistAlpha = (0.12 + (nightFactor * 0.08)) * intensity;

    ctx.save();
    for (let i = 0; i < 4; i++) {
      const seed = i + 1;
      const driftSpeed = 7 + (seed * 1.9);
      const worldX = (seed * 680) + (nowSec * driftSpeed);
      const baseWorldY = (seed * 240) + (Math.sin(nowSec * (0.12 + seed * 0.03)) * 28);
      const x = wrapFog(worldX - (camX * cameraZoom), fogSpanX) - 520;
      const y = wrapFog(baseWorldY - (camY * cameraZoom), fogSpanY) - 220;
      const rx = 200 + (seed * 38);
      const ry = 40 + (seed * 8);
      const band = ctx.createRadialGradient(x, y, ry * 0.25, x, y, rx);
      band.addColorStop(0, `rgba(96, 118, 103, ${bogMistAlpha * 0.48})`);
      band.addColorStop(0.55, `rgba(74, 92, 81, ${bogMistAlpha * 0.26})`);
      band.addColorStop(1, "rgba(74, 92, 81, 0)");
      ctx.fillStyle = band;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (hasNightMood) {
    const darkenAlpha = (isOverworld ? 0.34 : 0.22) * intensity * nightFactor;
    const blueCastAlpha = (isOverworld ? 0.16 : 0.11) * intensity * nightFactor;
    ctx.fillStyle = `rgba(16, 24, 42, ${blueCastAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = `rgba(0, 0, 0, ${darkenAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (isOverworld && nightFactor > 0.05) {
    const skyAlpha = intensity * nightFactor;
    const skyHeight = canvas.height * 0.58;
    const camX = Number.isFinite(atmosphereCam?.x) ? atmosphereCam.x : 0;
    const camY = Number.isFinite(atmosphereCam?.y) ? atmosphereCam.y : 0;
    const skyParallaxX = 0.22;
    const skyParallaxY = 0.08;
    const fract = (value) => value - Math.floor(value);
    const wrap = (value, size) => ((value % size) + size) % size;

    // Lightweight deterministic skybox: stars + cloud silhouettes.
    ctx.save();
    const starSpanX = Math.max(canvas.width * 3.2, 2600);
    const starSpanY = Math.max(skyHeight * 1.7, 780);
    for (let i = 0; i < 52; i++) {
      const sx = fract(Math.sin((i + 1) * 12.9898) * 43758.5453123);
      const sy = fract(Math.sin((i + 1) * 78.233) * 12345.6789012);
      const worldX = (sx * starSpanX) + (nowSec * (2 + ((i % 5) * 0.25)));
      const worldY = sy * starSpanY;
      const x = wrap(worldX - (camX * skyParallaxX * cameraZoom), starSpanX) - 2;
      const y = wrap(worldY - (camY * skyParallaxY * cameraZoom), starSpanY) - 2;
      if (y > skyHeight) continue;
      const twinkle = 0.45 + (0.55 * (0.5 + Math.sin((nowSec * 1.35) + (i * 0.91)) * 0.5));
      const size = 1 + ((i % 3) * 0.45);
      const alpha = (0.12 + (twinkle * 0.42)) * skyAlpha;
      ctx.fillStyle = `rgba(225, 236, 255, ${alpha})`;
      ctx.fillRect(Math.round(x), Math.round(y), size, size);
    }

    const drawCloud = (x, y, scale, alpha, seed) => {
      const lobeCount = 6 + (seed % 3);
      const cloudW = (170 + ((seed * 31) % 80)) * scale;
      const cloudH = (42 + ((seed * 17) % 20)) * scale;
      const left = x - (cloudW * 0.5);
      const right = x + (cloudW * 0.5);
      const baseAlpha = alpha * skyAlpha;

      const grad = ctx.createRadialGradient(x, y - cloudH * 0.1, cloudH * 0.2, x, y, cloudW * 0.75);
      grad.addColorStop(0, `rgba(20, 28, 42, ${baseAlpha * 1.15})`);
      grad.addColorStop(1, `rgba(8, 12, 19, ${baseAlpha * 0.72})`);
      ctx.fillStyle = grad;

      ctx.beginPath();
      for (let j = 0; j < lobeCount; j++) {
        const t = lobeCount <= 1 ? 0.5 : j / (lobeCount - 1);
        const lobeX = left + (right - left) * t;
        const lobeY = y + Math.sin((seed * 0.53) + (j * 0.9)) * (cloudH * 0.22);
        const rx = (cloudW * (0.14 + (0.05 * Math.sin(seed + j * 1.2))));
        const ry = (cloudH * (0.52 + (0.12 * Math.cos(seed * 0.7 + j))));
        ctx.ellipse(lobeX, lobeY, Math.max(10 * scale, Math.abs(rx)), Math.max(7 * scale, Math.abs(ry)), 0, 0, Math.PI * 2);
      }
      ctx.fill();

      ctx.fillStyle = `rgba(35, 48, 66, ${baseAlpha * 0.22})`;
      ctx.fillRect(left + cloudW * 0.08, y + cloudH * 0.12, cloudW * 0.84, cloudH * 0.12);
    };

    const cloudSpanX = Math.max(canvas.width * 4.4, 3600);
    const cloudSpanY = Math.max(canvas.height * 3.4, 2400);
    for (let i = 0; i < 11; i++) {
      const seedA = fract(Math.sin((i + 1) * 15.379) * 46871.193);
      const seedB = fract(Math.sin((i + 1) * 29.147) * 19435.731);
      const seedC = fract(Math.sin((i + 1) * 43.951) * 95731.629);
      const seedD = fract(Math.sin((i + 1) * 57.613) * 27381.491);
      const seedE = fract(Math.sin((i + 1) * 71.204) * 62913.848);
      const baseWorldX = seedA * cloudSpanX;
      const baseWorldY = seedB * cloudSpanY;
      const scale = 0.7 + (seedC * 0.95);
      const alpha = 0.1 + (seedD * 0.18);
      const driftSpeed = 5 + (seedE * 11);
      const worldX = baseWorldX + (nowSec * driftSpeed);
      const worldY = baseWorldY + Math.sin((nowSec * (0.1 + (seedE * 0.12))) + i) * 9;
      const x = wrap(worldX - (camX * cameraZoom), cloudSpanX) - 380;
      const y = wrap(worldY - (camY * cameraZoom), cloudSpanY) - 180;
      if (y > skyHeight + 120) continue;
      drawCloud(x, y, scale, alpha, i + 1);
    }
    ctx.restore();
  }

  const particleCount = Math.round((isOverworld ? 42 : 18) * intensity);
  const particleSpanX = Math.max(canvas.width * 4.2, 3000);
  const particleSpanY = Math.max(canvas.height * 3.4, 2200);
  const camXForParticles = Number.isFinite(atmosphereCam?.x) ? atmosphereCam.x : 0;
  const camYForParticles = Number.isFinite(atmosphereCam?.y) ? atmosphereCam.y : 0;
  const wrap = (value, size) => ((value % size) + size) % size;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < particleCount; i++) {
    const seed = i * 13.17 + (isOverworld ? 0 : 97.23);
    const speed = isOverworld ? 0.028 + (hash01(seed + 0.2) * 0.048) : 0.012 + (hash01(seed + 0.2) * 0.02);
    const drift = nowSec * speed;
    const worldXBase = hash01(seed + 0.8) * particleSpanX;
    const worldYBase = hash01(seed + 1.7) * particleSpanY;
    const worldX = worldXBase + (drift * particleSpanX * 0.38)
      + Math.sin(nowSec * (0.8 + hash01(seed + 2.4)) + seed) * (isOverworld ? 20 : 10);
    const worldY = worldYBase + Math.sin(nowSec * (0.75 + hash01(seed + 3.6)) + seed * 1.3) * (isOverworld ? 16 : 7);
    const x = wrap(worldX - (camXForParticles * cameraZoom), particleSpanX) - 40;
    const y = wrap(worldY - (camYForParticles * cameraZoom), particleSpanY) - 40;
    if (x < -32 || x > canvas.width + 32 || y < -32 || y > canvas.height + 32) continue;

    const alphaBase = isOverworld ? 0.07 + (hash01(seed + 4.1) * 0.16) : 0.04 + (hash01(seed + 4.1) * 0.08);
    const alpha = alphaBase * intensity;
    const size = isOverworld ? 1.4 + (hash01(seed + 5.5) * 2.6) : 1 + (hash01(seed + 5.5) * 1.6);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(hash01(seed + 6.8) * Math.PI + nowSec * (isOverworld ? 0.35 : 0.12));
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
    const vignetteEdgeAlpha = 0.12 + (0.4 * nightFactor);
    vignette.addColorStop(1, `rgba(0, 0, 0, ${vignetteEdgeAlpha})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawQuestUpdateNotice(ctx, state, cameraZoom, tileSize, colors, options = {}) {
  const notice = state.questUpdateNoticeState;
  if (!notice?.active) return;
  if (!isFreeExploreState(state.gameState)) return;

  const now = performance.now();
  const introMs = Number.isFinite(notice.introMs) ? Math.max(120, notice.introMs) : 320;
  const holdMs = Number.isFinite(notice.holdMs) ? Math.max(400, notice.holdMs) : 4000;
  const outroMs = Number.isFinite(notice.outroMs) ? Math.max(120, notice.outroMs) : 320;
  const elapsed = now - (Number.isFinite(notice.startedAt) ? notice.startedAt : 0);
  const totalMs = introMs + holdMs + outroMs;

  if (elapsed >= totalMs) {
    notice.active = false;
    return;
  }

  const text = typeof notice.text === "string" && notice.text.trim().length > 0
    ? notice.text
    : "Quest updated";
  const objectivePanelH = 80;
  const objectiveBottomReserve = 14;
  const objectivePanelY = Math.max(14, ctx.canvas.height - objectivePanelH - objectiveBottomReserve);
  const textX = 24;
  const defaultTextY = Math.max(34, Math.round(objectivePanelY - 14));
  const dialogueBoxTop = Number.isFinite(options.dialogueBoxTop) ? options.dialogueBoxTop : null;
  const dialogueAwareTextY = Boolean(options.dialogueActive) && dialogueBoxTop != null
    ? Math.round(dialogueBoxTop - 16)
    : defaultTextY;
  const textY = Math.max(34, Math.min(defaultTextY, dialogueAwareTextY));

  ctx.save();
  ctx.font = FONT_20;
  const textW = Math.ceil(ctx.measureText(text).width);
  const glowCenterX = textX + textW * 0.5;

  let alpha = 1;
  let clipX = textX;
  let clipW = textW;
  if (elapsed < introMs) {
    const t = easeOutCubic(elapsed / introMs);
    alpha = t;
    clipW = Math.max(1, Math.round(textW * t));
  } else if (elapsed > introMs + holdMs) {
    const t = easeInCubic((elapsed - introMs - holdMs) / outroMs);
    const keep = 1 - t;
    alpha = keep;
    clipW = Math.max(1, Math.round(textW * keep));
    clipX = Math.round(textX + (textW - clipW));
  }

  // Additional slow opacity envelope on top of wipe animation.
  const slowFadeMs = 2000;
  const fadeInAlpha = Math.max(0, Math.min(1, elapsed / slowFadeMs));
  const remainingMs = Math.max(0, totalMs - elapsed);
  const fadeOutAlpha = Math.max(0, Math.min(1, remainingMs / slowFadeMs));
  alpha *= Math.min(fadeInAlpha, fadeOutAlpha);

  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.beginPath();
  ctx.rect(clipX, textY - 24, clipW, 36);
  ctx.clip();

  // Soft halo + shadowed text for readability with no panel box.
  const glow = ctx.createRadialGradient(glowCenterX, textY - 10, 8, glowCenterX, textY - 8, Math.max(80, textW));
  glow.addColorStop(0, "rgba(137, 209, 255, 0.16)");
  glow.addColorStop(1, "rgba(137, 209, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(textX - 20, textY - 32, textW + 40, 44);

  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.92)";
  ctx.strokeText(text, textX, textY);
  ctx.fillStyle = "rgba(245, 228, 176, 0.98)";
  ctx.fillText(text, textX, textY);
  ctx.restore();
}

function drawBossHealthBanner(ctx, state, colors) {
  if (!isFreeExploreState(state.gameState)) return;
  const enemies = Array.isArray(state.enemies) ? state.enemies : [];
  const currentAreaId = String(state.currentAreaId || "");
  const boss = enemies.find((enemy) => (
    enemy &&
    !enemy.dead &&
    String(enemy.world || "") === currentAreaId &&
    String(enemy.id || "").toLowerCase() === "thebrog"
  ));
  if (!boss) return;
  const bossState = String(boss.state || "idle").toLowerCase();
  const bossAggroActive = bossState !== "idle" && bossState !== "return";
  if (!bossAggroActive) return;

  const maxHp = Number.isFinite(boss.maxHp) ? Math.max(1, boss.maxHp) : 1;
  const hp = Number.isFinite(boss.hp) ? Math.max(0, Math.min(maxHp, boss.hp)) : maxHp;
  const ratio = hp / maxHp;
  const boxW = Math.min(440, ctx.canvas.width - 80);
  const boxH = 54;
  const boxX = Math.round((ctx.canvas.width - boxW) * 0.5);
  const boxY = 10;
  const barX = boxX + 14;
  const barY = boxY + 30;
  const barW = boxW - 28;
  const barH = 12;

  drawSkinnedPanel(ctx, boxX, boxY, boxW, boxH, colors, { titleBand: true });
  ctx.font = FONT_16;
  drawUiText(ctx, `The Brog ${Math.round(hp)} / ${Math.round(maxHp)}`, boxX + 14, boxY + 22, colors);

  ctx.fillStyle = "rgba(8, 10, 14, 0.88)";
  ctx.fillRect(barX, barY, barW, barH);
  const fill = ctx.createLinearGradient(barX, barY, barX + barW, barY + barH);
  fill.addColorStop(0, "rgba(154, 231, 115, 0.95)");
  fill.addColorStop(0.5, "rgba(88, 175, 86, 0.95)");
  fill.addColorStop(1, "rgba(62, 130, 66, 0.95)");
  ctx.fillStyle = fill;
  ctx.fillRect(barX, barY, Math.round(barW * ratio), barH);
  ctx.strokeStyle = "rgba(235, 251, 229, 0.68)";
  ctx.lineWidth = 1;
  ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
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
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const floatY = y - t * Math.max(20, fontPx * 0.9);
      const text = String(effect.text || "");
      if (effect.variant === "playerAttack") {
        const displayFontPx = Math.round(fontPx * 1.22);
        const depthOffset = Math.max(3, Math.round(displayFontPx * 0.12));
        const faceGradient = ctx.createLinearGradient(
          x,
          floatY - displayFontPx,
          x,
          floatY + displayFontPx * 0.35
        );
        faceGradient.addColorStop(0, "#fff8d6");
        faceGradient.addColorStop(0.34, "#ffe66e");
        faceGradient.addColorStop(0.7, "#f9c81f");
        faceGradient.addColorStop(1, "#c88600");

        ctx.font = `italic 900 ${displayFontPx}px Georgia`;
        ctx.lineJoin = "round";
        ctx.shadowColor = "rgba(255, 224, 102, 0.38)";
        ctx.shadowBlur = Math.max(10, Math.round(displayFontPx * 0.28));
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        ctx.fillStyle = "rgba(109, 63, 0, 0.9)";
        ctx.fillText(text, x + depthOffset, floatY + depthOffset);

        ctx.shadowBlur = Math.max(14, Math.round(displayFontPx * 0.34));
        ctx.fillStyle = "rgba(255, 205, 70, 0.32)";
        ctx.fillText(text, x + 1, floatY + 1);

        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(79, 42, 0, 0.92)";
        ctx.lineWidth = Math.max(3, Math.round(displayFontPx * 0.13));
        ctx.strokeText(text, x, floatY);

        ctx.fillStyle = faceGradient;
        ctx.fillText(text, x, floatY);

        ctx.lineWidth = Math.max(1.5, Math.round(displayFontPx * 0.05));
        ctx.strokeStyle = "rgba(255, 248, 204, 0.9)";
        ctx.strokeText(text, x, floatY - Math.max(1, Math.round(displayFontPx * 0.03)));
        ctx.shadowBlur = 0;
        ctx.shadowColor = "transparent";
      } else {
        ctx.font = `bold ${fontPx}px Georgia`;
        ctx.fillStyle = effect.color || "rgba(255, 233, 190, 0.98)";
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = Math.max(2, Math.round(fontPx * 0.12));
        ctx.strokeText(text, x, floatY);
        ctx.fillText(text, x, floatY);
      }
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
  const highContrast = Boolean(state.pauseMenuState?.highContrast);

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

  drawSoundControlPanel(ctx, {
    boxX: canvas.width - 340 - 24,
    boxY: 14,
    boxW: 340,
    boxH: 148,
    highContrast,
    soundControls: state.pauseMenuState?.soundControls || {},
    inputPromptMode: state.inputPromptMode,
    layoutMode: "title",
    showControllerHint: true
  });

  const controlPickerLayout = getTitleControlPickerLayout(canvas);
  const useControllerAsDefault = Boolean(state.userSettings?.controllerInput);
  ctx.font = FONT_16;
  ctx.fillStyle = "rgba(244, 227, 195, 0.9)";
  ctx.fillText("Default Controls", controlPickerLayout.keyboardMouse.x, controlPickerLayout.keyboardMouse.y - 16);
  drawTitleControlOptionCard(ctx, {
    rect: controlPickerLayout.keyboardMouse,
    label: "Mouse & Keyboard",
    iconType: "keyboardMouse",
    isActive: !useControllerAsDefault,
    isFocused: Boolean(titleState.controlPickerFocused && Number(titleState.controlPickerIndex) === 0)
  });
  drawTitleControlOptionCard(ctx, {
    rect: controlPickerLayout.controller,
    label: "Controller",
    iconType: "controller",
    isActive: useControllerAsDefault,
    isFocused: Boolean(titleState.controlPickerFocused && Number(titleState.controlPickerIndex) === 1)
  });

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
  const frameTopH = Math.max(0, Math.floor(drawY));
  const frameBottomY = Math.min(canvas.height, Math.ceil(drawY + drawH));

  ctx.save();
  ctx.beginPath();
  ctx.rect(drawX, drawY, drawW, drawH);
  ctx.clip();
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

  // Cinematic letterbox framing above and below the scene image.
  ctx.fillStyle = "#000";
  if (frameTopH > 0) {
    ctx.fillRect(0, 0, canvas.width, frameTopH);
  }
  if (frameBottomY < canvas.height) {
    ctx.fillRect(0, frameBottomY, canvas.width, canvas.height - frameBottomY);
  }
}

function getTitleControlPickerLayout(canvas) {
  const panelX = 72;
  const panelW = 372;
  const boxW = 206;
  const boxH = 150;
  const gap = 28;
  const totalW = boxW * 2 + gap;
  const minX = panelX + panelW + 26;
  const maxX = Math.max(minX, canvas.width - totalW - 24);
  const preferredX = Math.round(canvas.width * 0.56);
  const baseX = Math.max(minX, Math.min(maxX, preferredX));
  const topY = Math.max(140, Math.round(canvas.height * 0.37));
  return {
    keyboardMouse: { x: baseX, y: topY, w: boxW, h: boxH },
    controller: { x: baseX + boxW + gap, y: topY, w: boxW, h: boxH }
  };
}

function drawTitleControlOptionCard(ctx, { rect, label, iconType, isActive = false, isFocused = false }) {
  const isHighlighted = isFocused || (isActive && !isFocused);
  const inset = isHighlighted ? 8 : 0;
  const x = rect.x + inset;
  const y = rect.y + inset;
  const w = rect.w - inset * 2;
  const h = rect.h - inset * 2;

  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, isFocused ? "rgba(233, 255, 214, 0.28)" : (isActive ? "rgba(255, 243, 206, 0.14)" : "rgba(236, 214, 176, 0.12)"));
  bg.addColorStop(1, isFocused ? "rgba(43, 96, 44, 0.34)" : (isActive ? "rgba(55, 76, 48, 0.18)" : "rgba(16, 19, 24, 0.3)"));
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  if (isFocused) {
    ctx.save();
    ctx.shadowColor = "rgba(120, 235, 116, 0.5)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "rgba(122, 222, 108, 0.12)";
    ctx.fillRect(x - 5, y - 5, w + 10, h + 10);
    ctx.restore();
  }

  ctx.lineWidth = isFocused ? 4 : (isActive ? 2.5 : 2);
  ctx.strokeStyle = isFocused
    ? "#89d483"
    : (isActive ? "rgba(190, 232, 168, 0.88)" : "rgba(238, 215, 174, 0.62)");
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  if (iconType === "controller") {
    drawControllerIcon(ctx, x, y, w, h);
  } else {
    drawKeyboardMouseIcon(ctx, x, y, w, h);
  }

  ctx.font = FONT_16;
  ctx.textAlign = "center";
  ctx.fillStyle = isFocused ? "#f5ffd8" : (isActive ? "rgba(236, 249, 214, 0.95)" : "rgba(248, 230, 201, 0.9)");
  ctx.fillText(label, x + w * 0.5, y + h - 18);
  if (isFocused) {
    ctx.font = FONT_12;
    ctx.fillStyle = "#67d96d";
    ctx.fillText("highlighted", x + w * 0.5, y + h + 18);
  } else if (isActive) {
    ctx.font = FONT_12;
    ctx.fillStyle = "rgba(190, 232, 168, 0.9)";
    ctx.fillText("selected", x + w * 0.5, y + h + 18);
  }
  ctx.textAlign = "left";
}

function drawKeyboardMouseIcon(ctx, x, y, w, h) {
  const keyboardW = Math.round(w * 0.58);
  const keyboardH = Math.round(h * 0.28);
  const keyboardX = Math.round(x + (w - keyboardW) * 0.5);
  const keyboardY = Math.round(y + h * 0.2);
  ctx.fillStyle = "rgba(27, 36, 46, 0.88)";
  ctx.fillRect(keyboardX, keyboardY, keyboardW, keyboardH);
  ctx.strokeStyle = "rgba(220, 236, 247, 0.7)";
  ctx.lineWidth = 2;
  ctx.strokeRect(keyboardX + 0.5, keyboardY + 0.5, keyboardW - 1, keyboardH - 1);
  const cols = 6;
  const rows = 3;
  const keyGap = 4;
  const keyW = Math.floor((keyboardW - keyGap * (cols + 1)) / cols);
  const keyH = Math.floor((keyboardH - keyGap * (rows + 1)) / rows);
  ctx.fillStyle = "rgba(197, 218, 234, 0.65)";
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const kx = keyboardX + keyGap + col * (keyW + keyGap);
      const ky = keyboardY + keyGap + row * (keyH + keyGap);
      ctx.fillRect(kx, ky, keyW, keyH);
    }
  }

  const mouseW = Math.round(w * 0.18);
  const mouseH = Math.round(h * 0.24);
  const mouseX = Math.round(x + w * 0.5 - mouseW * 0.5);
  const mouseY = Math.round(y + h * 0.53);
  ctx.fillStyle = "rgba(231, 240, 248, 0.88)";
  ctx.beginPath();
  drawRoundedRectPath(ctx, mouseX, mouseY, mouseW, mouseH, 9);
  ctx.fill();
  ctx.strokeStyle = "rgba(25, 34, 43, 0.75)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mouseX + mouseW * 0.5, mouseY + 4);
  ctx.lineTo(mouseX + mouseW * 0.5, mouseY + mouseH * 0.48);
  ctx.stroke();
}

function drawControllerIcon(ctx, x, y, w, h) {
  const bodyW = Math.round(w * 0.62);
  const bodyH = Math.round(h * 0.36);
  const bodyX = Math.round(x + (w - bodyW) * 0.5);
  const bodyY = Math.round(y + h * 0.28);
  ctx.fillStyle = "rgba(230, 238, 247, 0.9)";
  ctx.beginPath();
  drawRoundedRectPath(ctx, bodyX, bodyY, bodyW, bodyH, 26);
  ctx.fill();
  ctx.strokeStyle = "rgba(28, 34, 42, 0.78)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const dpadX = bodyX + bodyW * 0.24;
  const dpadY = bodyY + bodyH * 0.5;
  ctx.fillStyle = "rgba(34, 43, 55, 0.92)";
  ctx.fillRect(dpadX - 10, dpadY - 3, 20, 6);
  ctx.fillRect(dpadX - 3, dpadY - 10, 6, 20);

  const buttonsX = bodyX + bodyW * 0.74;
  const buttonsY = bodyY + bodyH * 0.48;
  ctx.fillStyle = "rgba(34, 43, 55, 0.92)";
  ctx.beginPath();
  ctx.arc(buttonsX - 7, buttonsY, 4, 0, Math.PI * 2);
  ctx.arc(buttonsX + 7, buttonsY, 4, 0, Math.PI * 2);
  ctx.arc(buttonsX, buttonsY - 7, 4, 0, Math.PI * 2);
  ctx.arc(buttonsX, buttonsY + 7, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawRoundedRectPath(ctx, x, y, w, h, radius) {
  const r = Math.max(0, Math.min(radius, Math.floor(Math.min(w, h) * 0.5)));
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
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
  atmosphereZoom = cameraZoom,
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
  drawPlayerSkillChannelBar(ctx, state, tileSize, getItemSprite);
  drawPlayerPoisonStatus(ctx, state, tileSize, getItemSprite);
  drawControllerSkillWheel(ctx, state, tileSize, getItemSprite);
  drawForegroundBuildingOccluders(ctx, state, canvas, tileSize, cameraZoom, drawTile);
  drawWorldVfx(ctx, state);
  drawTrainingPopup(ctx, state, canvas, ui, colors, tileSize);
  drawDoorTransition(ctx, state, canvas, tileSize, cameraZoom);
  ctx.restore();

  const uiColors = deriveUiColors(colors, state.moodPreset);
  const dialogueActive = Boolean(dialogue && typeof dialogue.isActive === "function" && dialogue.isActive());
  const nonDialogueUiAlpha = getDialogueUiAlpha(dialogueActive);

  drawItemNotifications(ctx, state, cameraZoom, tileSize, uiColors, getItemSprite);
  drawQuestUpdateNotice(ctx, state, cameraZoom, tileSize, uiColors, {
    dialogueActive,
    dialogueBoxTop: canvas.height - ui.TEXT_BOX_HEIGHT - 20
  });

  if (nonDialogueUiAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha *= nonDialogueUiAlpha;
    drawSaveNotice(ctx, state, uiColors);
    ctx.restore();
  }
  drawAtmosphere(ctx, canvas, colors, state, atmosphereZoom);
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
    drawBossHealthBanner(ctx, state, uiColors);
    drawCombatLevelHud(ctx, state, uiColors);
    drawObjectiveTracker(ctx, state, uiColors);
    drawQuestTrackerHint(ctx, state, uiColors);
    drawMinimap(ctx, state, uiColors);
    drawFriendliesHud(ctx, state, uiColors);
    drawDoorHint(ctx, state, uiColors, dialogue, cameraZoom);
    // Enemy XP feedback now uses world-space floating VFX instead of panel notifications.
    if (typeof drawCustomOverlays === "function") {
      drawCustomOverlays({ ctx, canvas, colors: uiColors, ui, state });
    }
    drawInventoryOverlay(ctx, state, canvas, ui, uiColors, getItemSprite);
    drawPauseMenuOverlay(ctx, state, canvas, ui, uiColors);
    drawAttributesOverlay(ctx, state, canvas, ui, uiColors);
    drawSettingsOverlay(ctx, state, canvas, ui, uiColors);
    drawQuestTrackerOverlay(ctx, state, canvas, ui, uiColors);
    drawQuestCompletionOverlay(ctx, state, canvas, ui, uiColors, getItemSprite);
    drawGamepadVirtualCursor(ctx, state);
    ctx.restore();
  }
  drawCombatLevelCelebrationOverlay(ctx, state);
  drawTextbox(ctx, state, canvas, ui, uiColors, dialogue);
  drawPlayerDefeatOverlay(ctx, state, canvas);
}

