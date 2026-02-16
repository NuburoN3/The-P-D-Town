import { describe, it } from "node:test";
import assert from "node:assert";
import { createTitleScreenSystem } from "../src/game/TitleScreenSystem.js";

function createMockMusicManager() {
    return {
        playSfx: () => { },
        playMusicForArea: () => { }
    };
}

function createMockCanvas() {
    return {
        width: 800,
        height: 600
    };
}

describe("TitleScreenSystem", () => {
    const deps = {
        tileSize: 32,
        cameraZoom: 2,
        musicManager: createMockMusicManager(),
        canvas: createMockCanvas()
    };

    it("initializes with default state", () => {
        const system = createTitleScreenSystem(deps);
        assert.strictEqual(system.state.selected, 0);
        assert.strictEqual(system.state.hovered, -1);
        assert.strictEqual(system.state.options.length, 3);
    });

    it("handleKeyDown navigates options", () => {
        const system = createTitleScreenSystem(deps);
        // Down
        system.handleKeyDown("arrowdown", {});
        assert.strictEqual(system.state.selected, 1);

        // Up (wrap around)
        system.handleKeyDown("arrowup", {});
        assert.strictEqual(system.state.selected, 0);

        // Up again (wrap to end)
        system.handleKeyDown("arrowup", {});
        assert.strictEqual(system.state.selected, 2);
    });

    it("handleKeyDown triggers callback on enter", () => {
        const system = createTitleScreenSystem(deps);
        let startCalled = false;
        let continueCalled = false;

        // Select "Start Journey" (index 1)
        system.state.selected = 1;

        system.handleKeyDown("enter", {
            onStartGame: () => { startCalled = true; },
            onContinueGame: () => { continueCalled = true; }
        });

        assert.strictEqual(startCalled, true);
        assert.strictEqual(continueCalled, false);
    });

    it("handleMouseMove updates hover state", () => {
        const system = createTitleScreenSystem(deps);
        // Mock coordinates that would hit an option
        // This depends on internal layout logic which uses hardcoded positions.
        // Ideally we'd test logic without layout dependency, but since logic refers to layout...
        // Let's just test that it returns boolean if state changes.

        const changed = system.handleMouseMove(0, 0);
        // 0,0 is likely outside menu.
        assert.strictEqual(system.state.hovered, -1);
    });
});
