import { describe, it } from "node:test";
import assert from "node:assert";
import { createPauseMenuSystem } from "../src/game/PauseMenuSystem.js";

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

function createMockInputManager() {
    return {
        matchesActionKey: (action, key) => action === "pause" && key === "escape",
        setPrimaryBinding: () => ({ ok: true }),
        getPrimaryBinding: () => "mockKey",
        toDisplayKeyName: (k) => k
    };
}

describe("PauseMenuSystem", () => {
    const deps = {
        musicManager: createMockMusicManager(),
        canvas: createMockCanvas(),
        settingsItems: [{ id: "testToggle", kind: "toggle", label: "Test" }],
        userSettings: { testToggle: false },
        loadUserSettings: () => ({}),
        persistUserSettings: () => { },
        setSettingsStatus: () => { }
    };

    it("initializes inactive", () => {
        const system = createPauseMenuSystem(deps);
        assert.strictEqual(system.state.active, false);
        assert.strictEqual(system.state.mode, "main");
    });

    it("opens and closes", () => {
        const system = createPauseMenuSystem(deps);
        system.open();
        assert.strictEqual(system.state.active, true);
        system.close();
        assert.strictEqual(system.state.active, false);
    });

    it("navigates main menu", () => {
        const system = createPauseMenuSystem(deps);
        system.open();
        // Default selection 0 ("Resume")

        // Down -> Save Game (1)
        system.handleKeyDown("arrowdown", { inputManager: createMockInputManager() });
        assert.strictEqual(system.state.selected, 1);

        // Down -> Load Game (2)
        system.handleKeyDown("arrowdown", { inputManager: createMockInputManager() });
        assert.strictEqual(system.state.selected, 2);
    });

    it("enters settings mode", () => {
        const system = createPauseMenuSystem(deps);
        system.open();
        const mockInput = createMockInputManager();
        // Select "Settings" (index 3)
        system.state.selected = 3;

        system.handleKeyDown("enter", { inputManager: mockInput });
        assert.strictEqual(system.state.mode, "settings");
        assert.strictEqual(system.state.settingsUiState.selected, 0);
    });

    it("toggles setting via keyboard", () => {
        const system = createPauseMenuSystem(deps);
        system.open();
        system.state.mode = "settings";
        system.state.settingsUiState.selected = 0; // "testToggle"

        // Before toggle
        assert.strictEqual(deps.userSettings.testToggle, false);

        system.handleKeyDown("enter", { inputManager: createMockInputManager() });

        // After toggle
        assert.strictEqual(deps.userSettings.testToggle, true);
    });
});
