import { drawTile as drawTileSystem } from "../rendering/TileSystem.js";
import { renderGameFrame } from "../game/RenderSystem.js";
import { ASSET_KEYS, GAME_STATES } from "../core/constants.js";

const MENU_CURSOR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <defs>
    <linearGradient id="goldTop" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff0be"/>
      <stop offset="0.46" stop-color="#f2c86e"/>
      <stop offset="1" stop-color="#b4762a"/>
    </linearGradient>
    <linearGradient id="goldSide" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ce8f3f"/>
      <stop offset="1" stop-color="#7b4a18"/>
    </linearGradient>
    <linearGradient id="spec" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="rgba(255,255,255,0.9)"/>
      <stop offset="1" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
  </defs>
  <g transform="translate(2 1)">
    <!-- cast shadow -->
    <path d="M2.2 2.8 L16.3 12.5 L10.9 13.9 L13.2 22.8 L10 23.5 L7.7 14.5 L2.5 16.7 Z" fill="rgba(0,0,0,0.34)"/>
    <!-- lower side face for 3D depth -->
    <path d="M8.7 21.9 L12 21.1 L9.8 12.2 L6.8 12.9 Z" fill="url(#goldSide)" stroke="#5f3610" stroke-width="0.75" stroke-linejoin="round"/>
    <!-- top face -->
    <path d="M1 0 L15 9.8 L9.6 11.2 L11.9 20.3 L8.8 21 L6.6 11.9 L1.6 14 Z"
      fill="url(#goldTop)" stroke="#6a4314" stroke-width="1.1" stroke-linejoin="round"/>
    <!-- bevel rim -->
    <path d="M2.6 2.3 L12.7 9.2 L8.7 10.2 L10.6 17.8 L9 18.2 L7.2 10.9 L3.6 11.9 Z"
      fill="none" stroke="#ffe7a9" stroke-width="0.9" stroke-linejoin="round" stroke-linecap="round"/>
    <!-- specular highlight -->
    <path d="M2.1 1.5 L8.9 6.3 L6.4 7 L3.8 4.9 Z" fill="url(#spec)"/>
    <!-- brighter flame glow near tail -->
    <ellipse cx="8.7" cy="19.1" rx="3.2" ry="2.2" fill="#ff7a2d" opacity="0.28"/>
    <ellipse cx="8.8" cy="19.2" rx="2.1" ry="1.4" fill="#ffd27f" opacity="0.32"/>
    <path d="M7.7 17.2 C9.1 15.4 11.1 16.2 11.3 17.9 C11.4 19.5 10.2 20.5 9 20.8 C10 19.9 10.1 18.8 9.3 18 C8.8 17.5 8.2 17.3 7.7 17.2 Z"
      fill="#ff7f2f" opacity="0.94"/>
    <path d="M6.3 18.2 C7.3 17 8.8 17.4 8.9 18.6 C9 19.6 8.2 20.3 7.4 20.5 C8 19.9 8.1 19.2 7.6 18.6 C7.2 18.3 6.8 18.2 6.3 18.2 Z"
      fill="#ffbe5d" opacity="0.9"/>
    <path d="M8.5 18.2 C9 17.5 9.8 17.8 9.9 18.4 C10 19 9.5 19.4 9.1 19.5 C9.4 19.1 9.4 18.7 9.1 18.4 C8.9 18.3 8.7 18.2 8.5 18.2 Z"
      fill="#fff0b3" opacity="0.88"/>
  </g>
</svg>`;
const MENU_CURSOR_CSS = `url("data:image/svg+xml,${encodeURIComponent(MENU_CURSOR_SVG)}") 2 1, auto`;

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
  objectiveState,
  uiMotionState,
  minimapDiscoveryState,
  itemAlert,
  inventoryHint,
  saveNoticeState,
  combatRewardPanel,
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
  function buildDoorHintText() {
    return "";
  }

  function buildMinimapState(currentMap, currentMapW, currentMapH, currentTownId, currentAreaId) {
    const doorTiles = [];
    for (let y = 0; y < currentMapH; y++) {
      const row = currentMap[y];
      if (!row) continue;
      for (let x = 0; x < currentMapW; x++) {
        if (row[x] !== tileTypes.DOOR) continue;
        if (isConditionallyHiddenDoor(x, y)) continue;
        doorTiles.push({ x, y });
      }
    }

    const discoveryKey = `${currentTownId}:${currentAreaId}`;
    const discoveredMap = minimapDiscoveryState?.discoveredDoors?.[discoveryKey] || {};
    const discoveredDoorTiles = Object.keys(discoveredMap).map((key) => {
      const [xRaw, yRaw] = key.split(",");
      return {
        x: Number.parseInt(xRaw, 10),
        y: Number.parseInt(yRaw, 10)
      };
    }).filter((entry) => Number.isFinite(entry.x) && Number.isFinite(entry.y));

    const objectiveMarker = objectiveState?.marker &&
      objectiveState.marker.townId === currentTownId &&
      objectiveState.marker.areaId === currentAreaId
      ? {
        x: objectiveState.marker.tileX,
        y: objectiveState.marker.tileY,
        label: objectiveState.marker.label || "Objective"
      }
      : null;

    return {
      map: currentMap,
      width: currentMapW,
      height: currentMapH,
      playerTileX: Math.floor((player.x + tileSize * 0.5) / tileSize),
      playerTileY: Math.floor((player.y + tileSize * 0.5) / tileSize),
      doorTiles,
      discoveredDoorTiles,
      objectiveMarker,
      revealStartedAt: Number.isFinite(uiMotionState?.minimapRevealAt) ? uiMotionState.minimapRevealAt : performance.now()
    };
  }

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
    const useStylizedMenuCursor = (
      gameState === GAME_STATES.TITLE_SCREEN ||
      gameState === GAME_STATES.PAUSE_MENU ||
      gameState === GAME_STATES.SETTINGS ||
      gameState === GAME_STATES.INVENTORY ||
      gameState === GAME_STATES.ATTRIBUTES
    );
    if (useStylizedMenuCursor) {
      canvas.style.cursor = mouseUiState?.insideCanvas ? MENU_CURSOR_CSS : "default";
    } else {
      canvas.style.cursor = "none";
    }
    const minimap = buildMinimapState(currentMap, currentMapW, currentMapH, currentTownId, currentAreaId);
    const doorHintText = buildDoorHintText(currentTownId, currentAreaId, currentMap);
    const currentTown = worldService.getTown(currentTownId);
    const currentArea = worldService.getArea(currentTownId, currentAreaId);

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
        currentTownId,
        currentTownName: currentTown?.name || currentTownId,
        currentAreaName: currentArea?.id || currentAreaId,
        getBuildingAtWorldTile: (tx, ty) => worldService.getBuilding(currentTownId, currentAreaId, tx, ty),
        moodPreset: worldService.getAreaMoodPreset(currentTownId, currentAreaId),
        currentAreaId,
        currentAreaKind: worldService.getAreaKind(currentTownId, currentAreaId),
        gameState,
        titleState,
        titleHeroImage: assets.getSprite(ASSET_KEYS.TITLE_HERO_IMAGE),
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
        combatFeedback,
        trainingPopup,
        playerStats,
        playerInventory,
        objectiveState,
        itemAlert,
        inventoryHint,
        saveNoticeState,
        combatRewardPanel,
        minimap,
        doorHintText,
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
