import { drawTile as drawTileSystem } from "../rendering/TileSystem.js";
import { renderGameFrame } from "../game/RenderSystem.js";

export function createGameRenderer({
  ctx,
  canvas,
  assets,
  worldService,
  featureCoordinator,
  dialogue,
  cam,
  combatFeedback,
  userSettings,
  isFreeExploreState,
  tileTypes,
  cameraZoom,
  tileSize,
  spriteFrameWidth,
  spriteFrameHeight,
  spriteFramesPerRow,
  colors,
  ui,
  doorSequence,
  titleState,
  playerDefeatSequence,
  player,
  npcs,
  enemies,
  gameFlags,
  input,
  settingsUiState,
  settingsItems,
  trainingPopup,
  playerStats,
  playerInventory,
  itemAlert,
  inventoryHint,
  pauseMenuState,
  mouseUiState,
  vfxSystem,
  getCurrentTownId,
  getCurrentAreaId,
  getCurrentMap,
  getCurrentMapW,
  getCurrentMapH,
  getGameState,
  isConditionallyHiddenDoor
}) {
  function drawTile(type, x, y, tileX, tileY) {
    const currentMap = getCurrentMap();
    const currentMapW = getCurrentMapW();
    const currentMapH = getCurrentMapH();
    const currentTownId = getCurrentTownId();
    const currentAreaId = getCurrentAreaId();
    const gameState = getGameState();

    const getTileAt = (tx, ty) => {
      if (ty < 0 || ty >= currentMapH || tx < 0 || tx >= currentMapW) return null;
      const row = currentMap[ty];
      return row ? row[tx] : null;
    };

    let actualType = type;
    if (type === tileTypes.DOOR && isConditionallyHiddenDoor(tileX, tileY)) {
      actualType = tileTypes.INTERIOR_FLOOR;
    }

    drawTileSystem(
      ctx,
      currentTownId,
      currentAreaId,
      gameState,
      doorSequence,
      actualType,
      x,
      y,
      tileX,
      tileY,
      (townId, areaId, tx, ty) => worldService.getBuilding(townId, areaId, tx, ty),
      getTileAt
    );
  }

  function computeRenderCamera(now) {
    const gameState = getGameState();
    const currentTownId = getCurrentTownId();
    const currentAreaId = getCurrentAreaId();

    const renderCam = {
      x: cam.x,
      y: cam.y
    };

    if (!isFreeExploreState(gameState)) return renderCam;

    const mood = worldService.getAreaMoodPreset(currentTownId, currentAreaId);
    const swayStrength = mood === "goldenDawn" ? 0.85 : mood === "amberLounge" ? 0.45 : 0.32;
    renderCam.x += Math.sin(now * 0.00037) * swayStrength;
    renderCam.y += Math.cos(now * 0.00029) * swayStrength * 0.85;

    if (userSettings.screenShake && now < combatFeedback.shakeUntil) {
      const t = 1 - Math.max(0, (combatFeedback.shakeUntil - now) / 220);
      const amplitude = combatFeedback.shakeMagnitude * (1 - t);
      renderCam.x += (Math.random() * 2 - 1) * amplitude;
      renderCam.y += (Math.random() * 2 - 1) * amplitude;
    } else if (now >= combatFeedback.shakeUntil) {
      combatFeedback.shakeMagnitude = 0;
    }

    return renderCam;
  }

  function render() {
    const now = performance.now();
    const renderCam = computeRenderCamera(now);
    const currentTownId = getCurrentTownId();
    const currentAreaId = getCurrentAreaId();
    const currentMap = getCurrentMap();
    const currentMapW = getCurrentMapW();
    const currentMapH = getCurrentMapH();
    const gameState = getGameState();

    renderGameFrame({
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
      getHandstandSprite: () => assets.getSprite("protagonist_handstand"),
      getItemSprite: (name) => assets.getSprite(name),
      drawCustomOverlays: ({ ctx: frameCtx, canvas: frameCanvas, colors: frameColors, ui: frameUi, state: frameState }) => {
        featureCoordinator.renderOverlays({
          ctx: frameCtx,
          canvas: frameCanvas,
          colors: frameColors,
          ui: frameUi,
          state: frameState
        });
      },
      state: {
        currentMap,
        currentMapW,
        currentMapH,
        getBuildingAtWorldTile: (tx, ty) => worldService.getBuilding(currentTownId, currentAreaId, tx, ty),
        moodPreset: worldService.getAreaMoodPreset(currentTownId, currentAreaId),
        currentAreaId,
        currentAreaKind: worldService.getAreaKind(currentTownId, currentAreaId),
        gameState,
        titleState,
        doorSequence,
        playerDefeatSequence,
        player,
        npcs,
        enemies,
        gameFlags,
        cam: renderCam,
        inputPromptMode: input.getInputMethod(),
        keyBindings: input.getBindings(),
        settingsUiState,
        settingsItems,
        userSettings,
        vfxEffects: vfxSystem.effects,
        trainingPopup,
        playerStats,
        playerInventory,
        itemAlert,
        inventoryHint,
        pauseMenuState,
        mouseUiState
      },
      dialogue
    });
  }

  return {
    render
  };
}
