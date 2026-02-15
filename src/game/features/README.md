# Feature Modules

This folder is the plug-and-play extension point for gameplay features (minigames, modal interactions, custom overlays).

## Feature Contract

A feature module should return an object with these functions:

- `tryHandleNPCInteraction(npc) => boolean`
- `isInGameState(gameState) => boolean`
- `handleInteract()`
- `update()`
- `renderOverlay({ ctx, canvas, colors, ui, state, gameState })`

Only `isInGameState` is required for state routing. The rest are optional and only called when present.

## How to Add a New Feature

1. Create a new module in this folder (example: `MyNewFeature.js`).
2. Export a factory that returns the feature contract object.
3. Register it in `src/game/features/index.js`.
4. Add NPC/content config in `src/world/content.js` (for example `minigameId: "myNewFeature"`).

No changes are required in:

- `src/game/InteractionSystem.js`
- `src/game/GameController.js`
- `src/game/RenderSystem.js`
- `src/app/main.js`
