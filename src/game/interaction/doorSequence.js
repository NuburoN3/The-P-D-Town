import { GAME_STATES } from "../../core/constants.js";

export function createDoorSequenceStarter({
  tileSize,
  canvas,
  cameraZoom = 1,
  player,
  doorSequence,
  musicManager,
  worldService,
  getCurrentTownId,
  getCurrentAreaId,
  getGameState,
  setGameState,
  clearInteractPressed,
  spawnVisualEffect,
  canEnterDoor = () => ({ allowed: true, message: "" }),
  onDoorEntryBlocked = () => { }
}) {
  return function beginDoorSequence(doorTile) {
    const gameState = getGameState();
    if (gameState === GAME_STATES.ENTERING_DOOR || gameState === GAME_STATES.TRANSITION) return;

    const destination = worldService.resolveDoorDestination(
      getCurrentTownId(),
      getCurrentAreaId(),
      doorTile.tx,
      doorTile.ty
    );
    if (!destination) return;

    const gate = canEnterDoor({
      doorTile,
      destination,
      townId: getCurrentTownId(),
      areaId: getCurrentAreaId()
    });
    if (gate && gate.allowed === false) {
      onDoorEntryBlocked({
        doorTile,
        destination,
        message: gate.message || ""
      });
      clearInteractPressed();
      return;
    }

    musicManager.playSfx("enterDoor");

    const playerCenterX = player.x + tileSize / 2;
    const playerCenterY = player.y + tileSize / 2;
    const doorCenterX = doorTile.tx * tileSize + tileSize / 2;
    const doorCenterY = doorTile.ty * tileSize + tileSize / 2;

    let vx = doorCenterX - playerCenterX;
    let vy = doorCenterY - playerCenterY;
    const len = Math.hypot(vx, vy) || 1;
    vx /= len;
    vy /= len;

    doorSequence.active = true;
    doorSequence.tx = doorTile.tx;
    doorSequence.ty = doorTile.ty;
    doorSequence.stepDx = vx * 1.5;
    doorSequence.stepDy = vy * 1.5;
    doorSequence.stepFrames = 12;
    doorSequence.frame = 0;
    doorSequence.targetTownId = destination.townId;
    doorSequence.targetAreaId = destination.areaId;
    doorSequence.targetX = destination.x;
    doorSequence.targetY = destination.y;
    doorSequence.targetDir = destination.dir || "down";
    const safeZoom = Number.isFinite(cameraZoom) && cameraZoom > 0 ? cameraZoom : 1;
    const viewW = canvas.width / safeZoom;
    const viewH = canvas.height / safeZoom;
    doorSequence.maxFadeRadius = Math.hypot(viewW, viewH) * 0.62;
    doorSequence.fadeStep = 34;
    doorSequence.fadeRadius = 0;
    doorSequence.transitionPhase = "out";
    spawnVisualEffect("doorSwirl", {
      x: doorCenterX,
      y: doorCenterY,
      size: 34
    });

    setGameState(GAME_STATES.ENTERING_DOOR);
    clearInteractPressed();
  };
}
