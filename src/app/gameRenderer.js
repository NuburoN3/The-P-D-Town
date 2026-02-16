import { drawTile as drawTileSystem } from "../rendering/TileSystem.js";
import { renderGameFrame } from "../game/RenderSystem.js";
import { ASSET_KEYS } from "../core/constants.js";

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
  function buildDoorHintText(currentTownId, currentAreaId, currentMap) {
    const playerTx = Math.floor((player.x + tileSize * 0.5) / tileSize);
    const playerTy = Math.floor((player.y + tileSize * 0.5) / tileSize);

    for (let ty = playerTy - 1; ty <= playerTy + 1; ty++) {
      const row = currentMap[ty];
      if (!row) continue;
      for (let tx = playerTx - 1; tx <= playerTx + 1; tx++) {
        if (row[tx] !== tileTypes.DOOR) continue;
        if (isConditionallyHiddenDoor(tx, ty)) continue;

        const destination = worldService.resolveDoorDestination(currentTownId, currentAreaId, tx, ty);
        if (!destination) continue;

        const targetTown = worldService.getTown(destination.townId);
        const targetArea = worldService.getArea(destination.townId, destination.areaId);
        const townLabel = targetTown?.name || destination.townId;
        const areaLabel = targetArea?.id || destination.areaId;
        return `Door: ${townLabel} / ${areaLabel}`;
      }
    }

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
