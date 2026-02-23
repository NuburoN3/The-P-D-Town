export const PLAYER_ATTACK_FRAME_TIMINGS = [0.05, 0.1, 0.05, 0.05, 0.1, 0.5, 0.5];
export const PLAYER_ATTACK_ANIMATION_SLOWDOWN = 7;
export const PLAYER_ATTACK_HIT_FRAME_INDEX = 3;

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function getSlowedAttackProgress(progress) {
  const clamped = clamp01(progress);
  const slowdown = Math.max(1, Number.isFinite(PLAYER_ATTACK_ANIMATION_SLOWDOWN) ? PLAYER_ATTACK_ANIMATION_SLOWDOWN : 1);
  return clamp01(clamped / slowdown);
}

export function resolvePlayerAttackFrameIndex(progress, availableFrames) {
  const frameCount = Number.isFinite(availableFrames)
    ? Math.max(1, Math.floor(availableFrames))
    : PLAYER_ATTACK_FRAME_TIMINGS.length;
  const timingSlice = PLAYER_ATTACK_FRAME_TIMINGS.slice(0, frameCount);
  const weights = timingSlice.length > 0 ? timingSlice : [1];
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const normalizedProgress = getSlowedAttackProgress(progress) * totalWeight;
  let accum = 0;
  let resolvedFrame = 0;
  for (let i = 0; i < weights.length; i++) {
    accum += weights[i];
    if (normalizedProgress <= accum) {
      resolvedFrame = i;
      break;
    }
    resolvedFrame = i;
  }
  return Math.min(frameCount - 1, resolvedFrame);
}
