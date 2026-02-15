import { GAME_STATES } from "../../core/constants.js";
import { createBarMinigameSystem } from "../BarMinigameSystem.js";

const FONT_16 = "600 16px 'Trebuchet MS', 'Verdana', sans-serif";
const FONT_20 = "600 20px 'Trebuchet MS', 'Verdana', sans-serif";
const FONT_28 = "700 28px 'Trebuchet MS', 'Verdana', sans-serif";

function drawSkinnedPanel(ctx, x, y, width, height, colors, { titleBand = false } = {}) {
  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, colors.PANEL_SURFACE_TOP || colors.POPUP_BG);
  gradient.addColorStop(1, colors.PANEL_SURFACE_BOTTOM || colors.DIALOGUE_BG);
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = colors.PANEL_INNER || "rgba(255,255,255,0.04)";
  ctx.fillRect(x + 2, y + 2, width - 4, height - 4);

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
}

function drawUiText(ctx, text, x, y, colors) {
  ctx.fillStyle = colors.TEXT_SHADOW || "rgba(0,0,0,0.4)";
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = colors.TEXT;
  ctx.fillText(text, x, y);
}

function getPromptLines(npc) {
  const lines = Array.isArray(npc.dialogue) ? [...npc.dialogue] : [String(npc.dialogue ?? "")];
  const prompt = String(npc.minigamePrompt || "").trim();
  if (prompt.length > 0 && lines[lines.length - 1] !== prompt) {
    lines.push(prompt);
  }
  return lines;
}

export function createHousePourFeature({
  state = {
    active: false,
    round: 1,
    totalRounds: 5,
    requiredWins: 3,
    wins: 0,
    cursor: 50,
    cursorDir: 1,
    cursorSpeed: 85,
    targetCenter: 50,
    targetHalfWidth: 8,
    lockUntil: 0,
    feedbackText: "",
    hostName: "",
    winDialogue: "",
    loseDialogue: "",
    lastUpdateAt: 0
  },
  getCurrentAreaKind,
  setGameState,
  showDialogue,
  openYesNoChoice,
  closeDialogue
}) {
  const minigame = createBarMinigameSystem({
    state,
    getCurrentAreaKind,
    setGameState,
    showDialogue
  });

  function tryHandleNPCInteraction(npc) {
    if (!npc || npc.minigameId !== "housePour") return false;

    showDialogue(npc.name, getPromptLines(npc), () => {
      openYesNoChoice((selectedOption) => {
        if (selectedOption === "Yes") {
          closeDialogue();
          minigame.start({
            hostName: npc.name,
            winDialogue: npc.minigameWinDialogue,
            loseDialogue: npc.minigameLoseDialogue
          });
          return;
        }

        showDialogue(
          npc.name,
          npc.minigameDeclineDialogue || "No problem. Come back when you're ready."
        );
      });
    });

    return true;
  }

  function isInGameState(gameState) {
    return gameState === GAME_STATES.BAR_MINIGAME;
  }

  function handleInteract() {
    minigame.handleInteract();
  }

  function update() {
    minigame.update();
  }

  function renderOverlay({ ctx, canvas, colors, gameState }) {
    if (gameState !== GAME_STATES.BAR_MINIGAME) return;
    if (!state.active) return;

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
      `Round ${state.round}/${state.totalRounds}   Wins ${state.wins}/${state.requiredWins}`,
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

    const targetMin = Math.max(0, state.targetCenter - state.targetHalfWidth);
    const targetMax = Math.min(100, state.targetCenter + state.targetHalfWidth);
    const targetX = meterX + (targetMin / 100) * meterW;
    const targetW = ((targetMax - targetMin) / 100) * meterW;

    const targetGradient = ctx.createLinearGradient(0, meterY, 0, meterY + meterH);
    targetGradient.addColorStop(0, "#ffe28f");
    targetGradient.addColorStop(1, "#d6a43a");
    ctx.fillStyle = targetGradient;
    ctx.fillRect(targetX, meterY + 3, targetW, meterH - 6);

    const cursorX = meterX + (Math.max(0, Math.min(100, state.cursor)) / 100) * meterW;
    ctx.strokeStyle = "#f5f9ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cursorX, meterY - 4);
    ctx.lineTo(cursorX, meterY + meterH + 4);
    ctx.stroke();

    ctx.font = FONT_20;
    drawUiText(ctx, state.feedbackText || "Press ENTER to pour", panelX + 22, panelY + 156, colors);

    ctx.font = FONT_16;
    drawUiText(ctx, "Press ENTER to pour", panelX + 22, panelY + 182, colors);

    ctx.restore();
  }

  return {
    id: "housePour",
    tryHandleNPCInteraction,
    isInGameState,
    handleInteract,
    update,
    renderOverlay
  };
}
