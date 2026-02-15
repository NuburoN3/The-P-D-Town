import test from "node:test";
import assert from "node:assert/strict";

import { createFeatureCoordinator } from "../src/game/features/FeatureCoordinator.js";

test("routes NPC interaction to matching feature", () => {
  let handledByFeature = false;
  const coordinator = createFeatureCoordinator({
    features: [
      {
        tryHandleNPCInteraction: () => false
      },
      {
        tryHandleNPCInteraction: (npc) => {
          handledByFeature = npc.id === "npc-1";
          return handledByFeature;
        }
      }
    ]
  });

  const handled = coordinator.tryHandleNPCInteraction({ id: "npc-1" });
  assert.equal(handled, true);
  assert.equal(handledByFeature, true);
});

test("updates only features that handle current game state", () => {
  let updated = 0;
  const coordinator = createFeatureCoordinator({
    features: [
      {
        isInGameState: (gameState) => gameState === "modal",
        update: () => {
          updated += 1;
        }
      },
      {
        isInGameState: () => false,
        update: () => {
          updated += 100;
        }
      }
    ]
  });

  const handled = coordinator.updateForState("modal");
  assert.equal(handled, true);
  assert.equal(updated, 1);
});

test("renders overlays only for active state handlers", () => {
  let rendered = 0;
  const coordinator = createFeatureCoordinator({
    features: [
      {
        isInGameState: (gameState) => gameState === "modal",
        renderOverlay: () => {
          rendered += 1;
        }
      }
    ]
  });

  coordinator.renderOverlays({
    ctx: {},
    canvas: {},
    colors: {},
    ui: {},
    state: { gameState: "modal" }
  });

  assert.equal(rendered, 1);
});

test("uses first matching feature as state owner", () => {
  let updates = 0;
  const coordinator = createFeatureCoordinator({
    features: [
      {
        isInGameState: (gameState) => gameState === "modal",
        update: () => {
          updates += 1;
        }
      },
      {
        isInGameState: (gameState) => gameState === "modal",
        update: () => {
          updates += 10;
        }
      }
    ]
  });

  coordinator.updateForState("modal");
  assert.equal(updates, 1);
});
