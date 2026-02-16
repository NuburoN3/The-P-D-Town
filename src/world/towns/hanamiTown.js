// ============================================================================
// HANAMI TOWN - Content definition for the first playable town
// ============================================================================

import { TILE_TYPES } from "../../core/constants.js";
import { BUILDING_TYPES } from "../buildingRenderers.js";
import {
    createFilledMap,
    createWalledInterior,
    paintPath,
    paintRect,
    paintPoints
} from "../mapUtils.js";

// ---------------------------------------------------------------------------
// Map generators
// ---------------------------------------------------------------------------

function generateOverworldBase(width, height) {
    const map = createFilledMap(width, height, TILE_TYPES.GRASS);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
                map[y][x] = TILE_TYPES.TREE;
            }
        }
    }

    // Tree belts and district silhouettes.
    paintRect(map, 34, 3, 17, 2, TILE_TYPES.TREE); // dojo hill north treeline
    paintRect(map, 34, 5, 2, 11, TILE_TYPES.TREE); // dojo hill west treeline
    paintRect(map, 49, 5, 2, 11, TILE_TYPES.TREE); // dojo hill east treeline
    paintRect(map, 6, 4, 6, 6, TILE_TYPES.TREE);
    paintRect(map, 6, 35, 7, 5, TILE_TYPES.TREE);
    paintRect(map, 22, 4, 8, 4, TILE_TYPES.TREE);
    paintRect(map, 37, 33, 11, 7, TILE_TYPES.TREE);

    // District grounds.
    paintRect(map, 21, 15, 15, 15, TILE_TYPES.PATH); // town piazza
    paintRect(map, 8, 8, 11, 10, TILE_TYPES.PATH); // church square
    paintRect(map, 8, 26, 14, 11, TILE_TYPES.PATH); // farm court
    paintRect(map, 48, 35, 7, 7, TILE_TYPES.PATH); // bed and breakfast block
    paintRect(map, 37, 6, 10, 8, TILE_TYPES.HILL); // elevated dojo plateau

    // Main roads and connectors.
    paintPath(map, [{ x: 28, y: 1 }, { x: 28, y: 42 }], 3); // central boulevard
    paintPath(map, [{ x: 28, y: 22 }, { x: 16, y: 22 }, { x: 16, y: 16 }], 2); // church lane
    paintPath(map, [{ x: 28, y: 24 }, { x: 38, y: 24 }, { x: 45, y: 24 }, { x: 45, y: 31 }], 2); // bar lane
    paintPath(map, [{ x: 28, y: 30 }, { x: 20, y: 30 }, { x: 20, y: 32 }, { x: 15, y: 32 }], 2); // farm lane
    paintPath(map, [{ x: 28, y: 34 }, { x: 28, y: 36 }, { x: 51, y: 36 }, { x: 51, y: 40 }], 2); // bed and breakfast lane
    paintPath(map, [{ x: 28, y: 14 }, { x: 34, y: 14 }, { x: 37, y: 12 }, { x: 41, y: 12 }, { x: 41, y: 10 }], 2); // hill path
    paintPath(map, [{ x: 28, y: 22 }, { x: 41, y: 22 }, { x: 48, y: 22 }, { x: 48, y: 21 }], 2); // taiko lane

    // Piazza blossom rings.
    const cherryBlossomPositions = [
        [22, 16], [23, 16], [24, 16], [32, 16], [33, 16], [34, 16],
        [22, 28], [23, 28], [24, 28], [32, 28], [33, 28], [34, 28],
        [20, 22], [20, 23], [36, 22], [36, 23],
        [27, 14], [28, 14], [29, 14], [27, 30], [28, 30], [29, 30]
    ];
    paintPoints(map, cherryBlossomPositions, TILE_TYPES.CHERRY_BLOSSOM);

    // Cherry blossoms around the dojo hilltop.
    const dojoBlossomPositions = [
        [38, 6], [40, 6], [42, 6], [44, 6],
        [37, 8], [45, 8],
        [37, 12], [38, 12], [44, 12], [45, 12],
        [40, 13], [42, 13]
    ];
    paintPoints(map, dojoBlossomPositions, TILE_TYPES.CHERRY_BLOSSOM);

    // Dojo front veranda on hill (walkable wooden porch, 2 tiles deep).
    paintPoints(
        map,
        [
            [39, 10], [40, 10], [41, 10], [42, 10], [43, 10],
            [39, 11], [40, 11], [41, 11], [42, 11], [43, 11]
        ],
        TILE_TYPES.PORCH
    );

    // Ground anchor directly under porch edge + signpost pads.
    paintPoints(
        map,
        [
            [39, 12], [40, 12], [41, 12], [42, 12], [43, 12],
            [38, 11], [12, 17], [10, 32], [43, 31], [28, 29], [47, 21], [48, 40]
        ],
        TILE_TYPES.PATH
    );

    return map;
}

function generateDojoInteriorBase(width, height) {
    return createWalledInterior(width, height);
}

function generateChurchInteriorBase(width, height) {
    const map = createWalledInterior(width, height);

    // Aisle and simple pew layout.
    for (let y = 2; y <= 6; y++) {
        map[y][3] = TILE_TYPES.WALL;
        map[y][4] = TILE_TYPES.WALL;
        map[y][7] = TILE_TYPES.WALL;
        map[y][8] = TILE_TYPES.WALL;
    }

    // Altar backdrop.
    map[1][5] = TILE_TYPES.WALL;
    map[1][6] = TILE_TYPES.WALL;
    map[1][2] = TILE_TYPES.CHURCH_STAINED_GLASS;
    map[1][3] = TILE_TYPES.CHURCH_STAINED_GLASS;
    map[1][8] = TILE_TYPES.CHURCH_STAINED_GLASS;
    map[1][9] = TILE_TYPES.CHURCH_STAINED_GLASS;
    map[3][1] = TILE_TYPES.CHURCH_STAINED_GLASS;
    map[4][1] = TILE_TYPES.CHURCH_STAINED_GLASS;
    map[5][1] = TILE_TYPES.CHURCH_STAINED_GLASS;
    map[3][10] = TILE_TYPES.CHURCH_STAINED_GLASS;
    map[4][10] = TILE_TYPES.CHURCH_STAINED_GLASS;
    map[5][10] = TILE_TYPES.CHURCH_STAINED_GLASS;

    return map;
}

function generateDojoUpstairsBase(width, height) {
    const map = createWalledInterior(width, height);

    // Sparring posts for upstairs challenge room.
    map[3][3] = TILE_TYPES.DOJO_POST;
    map[3][8] = TILE_TYPES.DOJO_POST;
    map[6][3] = TILE_TYPES.DOJO_POST;
    map[6][8] = TILE_TYPES.DOJO_POST;
    map[4][6] = TILE_TYPES.DOJO_POST;

    return map;
}

function generateBarInteriorBase(width, height) {
    const map = createWalledInterior(width, height, TILE_TYPES.BAR_FLOOR);

    // Main serving counter
    for (let x = 2; x <= width - 3; x++) {
        map[3][x] = TILE_TYPES.BAR_COUNTER;
    }

    // Shelves behind counter
    for (let x = 3; x <= width - 4; x += 2) {
        map[1][x] = TILE_TYPES.BAR_DECOR;
    }
    map[1][6] = TILE_TYPES.BAR_POSTER;

    // Counter stools
    map[4][3] = TILE_TYPES.BAR_STOOL;
    map[4][5] = TILE_TYPES.BAR_STOOL;
    map[4][7] = TILE_TYPES.BAR_STOOL;
    map[4][9] = TILE_TYPES.BAR_STOOL;

    // Table area
    map[6][3] = TILE_TYPES.BAR_TABLE;
    map[6][8] = TILE_TYPES.BAR_TABLE;
    map[7][5] = TILE_TYPES.BAR_STOOL;
    map[7][10] = TILE_TYPES.BAR_STOOL;

    // Back room decoration
    map[6][1] = TILE_TYPES.BAR_DECOR;
    map[6][10] = TILE_TYPES.BAR_DECOR;

    return map;
}

function generateTaikoHouseInteriorBase(width, height) {
    const map = createWalledInterior(width, height);

    // A disordered, abandoned interior.
    map[2][2] = TILE_TYPES.WALL;
    map[2][3] = TILE_TYPES.WALL;
    map[3][8] = TILE_TYPES.WALL;
    map[3][9] = TILE_TYPES.WALL;
    map[4][5] = TILE_TYPES.WALL;
    map[5][2] = TILE_TYPES.WALL;
    map[5][8] = TILE_TYPES.WALL;
    map[6][4] = TILE_TYPES.WALL;
    map[7][7] = TILE_TYPES.WALL;

    map[1][9] = TILE_TYPES.BAR_DECOR;
    map[2][9] = TILE_TYPES.BAR_DECOR;
    map[6][1] = TILE_TYPES.BAR_DECOR;
    map[7][2] = TILE_TYPES.BAR_DECOR;

    return map;
}

function generateBnBDownstairsBase(width, height) {
    const map = createWalledInterior(width, height);

    // Kitchen line and serving counter.
    for (let x = 2; x <= 9; x++) {
        map[2][x] = TILE_TYPES.BAR_COUNTER;
    }
    map[1][2] = TILE_TYPES.BAR_DECOR;
    map[1][3] = TILE_TYPES.BAR_DECOR;
    map[1][8] = TILE_TYPES.BAR_DECOR;
    map[1][9] = TILE_TYPES.BAR_DECOR;

    // Cozy dining setup.
    map[6][3] = TILE_TYPES.BAR_TABLE;
    map[6][8] = TILE_TYPES.BAR_TABLE;
    map[7][5] = TILE_TYPES.BAR_STOOL;
    map[7][9] = TILE_TYPES.BAR_STOOL;

    return map;
}

function generateBnBUpstairsBase(width, height) {
    const map = createWalledInterior(width, height);

    // Bedroom furnishings.
    map[2][2] = TILE_TYPES.BED;
    map[2][3] = TILE_TYPES.BED;
    map[3][8] = TILE_TYPES.TV;
    map[5][8] = TILE_TYPES.HIFI;

    return map;
}

// ---------------------------------------------------------------------------
// Town definition
// ---------------------------------------------------------------------------

export const hanamiTown = {
    id: "hanamiTown",
    name: "Hanami Town",
    defaultSpawnId: "bnbBedroomSpawn",
    respawnSpawn: "dojoInteriorDoor",
    respawnNpcId: "mrHanami",
    conditionalDoors: [
        { areaId: "hanamiDojo", x: 9, y: 3, hiddenUntil: "acceptedTraining" }
    ],
    areas: {
        overworld: {
            id: "overworld",
            kind: "overworld",
            mood: "goldenDawn",
            width: 56,
            height: 44,
            musicSrc: "assets/audio/Anticipation_Game_Audio_BG.wav",
            generateBaseMap: generateOverworldBase,
            buildings: [
                {
                    id: "hanamiDojoFront",
                    type: BUILDING_TYPES.DOJO,
                    x: 39,
                    y: 7,
                    width: 5,
                    height: 3
                },
                {
                    id: "hanamiTownFountain",
                    type: BUILDING_TYPES.FOUNTAIN,
                    x: 25,
                    y: 19,
                    width: 7,
                    height: 7
                },
                {
                    id: "stBrigidChapel",
                    type: BUILDING_TYPES.CHURCH,
                    x: 10,
                    y: 10,
                    width: 7,
                    height: 5
                },
                {
                    id: "willowFarmPen",
                    type: BUILDING_TYPES.PEN,
                    x: 11,
                    y: 29,
                    width: 8,
                    height: 6
                },
                {
                    id: "hanamiBarFront",
                    type: BUILDING_TYPES.BAR,
                    x: 43,
                    y: 27,
                    width: 5,
                    height: 4
                },
                {
                    id: "taikoHouseFront",
                    type: BUILDING_TYPES.HOUSE,
                    x: 47,
                    y: 17,
                    width: 4,
                    height: 4
                },
                {
                    id: "patBnBFront",
                    type: BUILDING_TYPES.HOUSE,
                    x: 49,
                    y: 36,
                    width: 5,
                    height: 4
                }
            ],
            signposts: [
                { x: 38, y: 11, text: "Hanami Hill Dojo" },
                { x: 43, y: 31, text: "Hanami Sakaba" },
                { x: 28, y: 29, text: "Hanami Piazza Fountain" },
                { x: 12, y: 17, text: "教会" },
                { x: 10, y: 32, text: "Willow Farm Pen" },
                { x: 47, y: 21, text: "Taiko Residence" },
                { x: 48, y: 40, text: "Pat's Bed & Breakfast" }
            ]
        },
        hanamiDojo: {
            id: "hanamiDojo",
            kind: "interior",
            mood: "inkQuiet",
            width: 12,
            height: 10,
            musicSrc: "assets/audio/Hanami_Game_Audio_BG.wav",
            generateBaseMap: generateDojoInteriorBase,
            trainingTile: { x: 4, y: 5 }
        },
        hanamiDojoUpstairs: {
            id: "hanamiDojoUpstairs",
            kind: "interior",
            mood: "inkQuiet",
            width: 12,
            height: 10,
            generateBaseMap: generateDojoUpstairsBase
        },
        hanamiChurch: {
            id: "hanamiChurch",
            kind: "interior",
            mood: "inkQuiet",
            width: 12,
            height: 10,
            generateBaseMap: generateChurchInteriorBase
        },
        hanamiBar: {
            id: "hanamiBar",
            kind: "interior",
            mood: "amberLounge",
            width: 12,
            height: 10,
            generateBaseMap: generateBarInteriorBase
        },
        taikoHouse: {
            id: "taikoHouse",
            kind: "interior",
            mood: "inkQuiet",
            width: 12,
            height: 10,
            generateBaseMap: generateTaikoHouseInteriorBase
        },
        patBnBDownstairs: {
            id: "patBnBDownstairs",
            kind: "interior",
            mood: "amberLounge",
            width: 12,
            height: 10,
            generateBaseMap: generateBnBDownstairsBase
        },
        patBnBUpstairs: {
            id: "patBnBUpstairs",
            kind: "interior",
            mood: "inkQuiet",
            width: 12,
            height: 10,
            generateBaseMap: generateBnBUpstairsBase
        }
    },
    spawns: {
        bnbBedroomSpawn: { areaId: "patBnBUpstairs", x: 6, y: 6, dir: "down" },
        townGate: { areaId: "overworld", x: 28, y: 40, dir: "up" },
        dojoExteriorDoor: { areaId: "overworld", x: 41, y: 10, dir: "down" },
        dojoInteriorDoor: { areaId: "hanamiDojo", x: 6, y: 8, dir: "up" },
        dojoUpstairsDoor: { areaId: "hanamiDojo", x: 9, y: 4, dir: "left" },
        dojoUpstairsEntry: { areaId: "hanamiDojoUpstairs", x: 6, y: 8, dir: "up" },
        churchExteriorDoor: { areaId: "overworld", x: 13, y: 15, dir: "down" },
        churchInteriorDoor: { areaId: "hanamiChurch", x: 6, y: 8, dir: "up" },
        barExteriorDoor: { areaId: "overworld", x: 45, y: 31, dir: "down" },
        barInteriorDoor: { areaId: "hanamiBar", x: 6, y: 8, dir: "up" },
        taikoHouseExteriorDoor: { areaId: "overworld", x: 48, y: 21, dir: "down" },
        taikoHouseInteriorDoor: { areaId: "taikoHouse", x: 6, y: 8, dir: "up" },
        bnbExteriorDoor: { areaId: "overworld", x: 51, y: 40, dir: "down" },
        bnbLobbyDoor: { areaId: "patBnBDownstairs", x: 6, y: 8, dir: "up" },
        bnbUpstairsDoor: { areaId: "patBnBDownstairs", x: 9, y: 4, dir: "left" },
        bnbUpstairsEntry: { areaId: "patBnBUpstairs", x: 2, y: 8, dir: "right" }
    },
    doors: [
        {
            from: { areaId: "overworld", x: 40, y: 9 },
            to: { townId: "hanamiTown", spawnId: "dojoInteriorDoor" }
        },
        {
            from: { areaId: "overworld", x: 41, y: 9 },
            to: { townId: "hanamiTown", spawnId: "dojoInteriorDoor" }
        },
        {
            from: { areaId: "hanamiDojo", x: 6, y: 9 },
            to: { townId: "hanamiTown", spawnId: "dojoExteriorDoor" }
        },
        {
            from: { areaId: "overworld", x: 13, y: 14 },
            to: { townId: "hanamiTown", spawnId: "churchInteriorDoor" }
        },
        {
            from: { areaId: "hanamiChurch", x: 6, y: 9 },
            to: { townId: "hanamiTown", spawnId: "churchExteriorDoor" }
        },
        {
            from: { areaId: "hanamiDojo", x: 9, y: 3 },
            to: { townId: "hanamiTown", spawnId: "dojoUpstairsEntry" }
        },
        {
            from: { areaId: "hanamiDojoUpstairs", x: 6, y: 9 },
            to: { townId: "hanamiTown", spawnId: "dojoUpstairsDoor" }
        },
        {
            from: { areaId: "overworld", x: 45, y: 30 },
            to: { townId: "hanamiTown", spawnId: "barInteriorDoor" }
        },
        {
            from: { areaId: "hanamiBar", x: 6, y: 9 },
            to: { townId: "hanamiTown", spawnId: "barExteriorDoor" }
        },
        {
            from: { areaId: "overworld", x: 48, y: 20 },
            to: { townId: "hanamiTown", spawnId: "taikoHouseInteriorDoor" }
        },
        {
            from: { areaId: "taikoHouse", x: 6, y: 9 },
            to: { townId: "hanamiTown", spawnId: "taikoHouseExteriorDoor" }
        },
        {
            from: { areaId: "overworld", x: 51, y: 39 },
            to: { townId: "hanamiTown", spawnId: "bnbLobbyDoor" }
        },
        {
            from: { areaId: "patBnBDownstairs", x: 6, y: 9 },
            to: { townId: "hanamiTown", spawnId: "bnbExteriorDoor" }
        },
        {
            from: { areaId: "patBnBDownstairs", x: 9, y: 3 },
            to: { townId: "hanamiTown", spawnId: "bnbUpstairsEntry" }
        },
        {
            from: { areaId: "patBnBUpstairs", x: 2, y: 9 },
            to: { townId: "hanamiTown", spawnId: "bnbUpstairsDoor" }
        }
    ],
    npcs: [
        {
            id: "mrHanami",
            name: "Mr. Hanami",
            spriteName: "mr_hanami",
            spriteFrameWidth: 32,
            spriteFrameHeight: 32,
            spriteFramesPerRow: 3,
            desiredHeightTiles: 1.15,
            areaId: "hanamiDojo",
            x: 7,
            y: 4,
            dir: "down",
            dialogue: [
                "Hello there!",
                "Welcome to the dojo.",
                "I am the President of the Illustrious Dojo.",
                "I train students here",
                "where they practice Hana Sakura style Karate",
                "which means \"the way of the cherry blossom\".",
                "The north has grown unstable, and I am choosing someone strong to protect this town.",
                "Would you like me to teach you?"
            ],
            hasTrainingChoice: true
        },
        {
            id: "innkeeperPat",
            name: "Pat",
            spriteName: "innkeeper_pat",
            desiredHeightTiles: 1.15,
            areaId: "patBnBDownstairs",
            x: 4,
            y: 4,
            dir: "right",
            dialogue: [
                "Good morning, dear. Welcome to Pat's Bed and Breakfast.",
                "I'm making breakfast downstairs right now.",
                "Would you like a warm plate before you head out?"
            ],
            hasTrainingChoice: false
        },
        {
            id: "dojoStudentYori",
            name: "Yori",
            spriteName: "dojo_student_yori",
            desiredHeightTiles: 1.15,
            areaId: "hanamiDojo",
            x: 4,
            y: 3,
            dir: "right",
            dialogue: [
                "Master Hanami is the President of the Illustrious Dojo, but he hardly sleeps now.",
                "Taiko used to be his assistant and Vice President before heading north.",
                "People whisper that the dark cloud began after he left."
            ],
            hasTrainingChoice: false
        },
        {
            id: "dojoCaretakerUme",
            name: "Ume",
            spriteName: "dojo_caretaker_ume",
            desiredHeightTiles: 1.15,
            areaId: "hanamiDojo",
            x: 9,
            y: 6,
            dir: "left",
            dialogue: [
                "Sweep, breathe, repeat.",
                "Even when dark rumors spread, routine keeps the mind clear."
            ],
            hasTrainingChoice: false
        },
        {
            id: "dojoObserverRei",
            name: "Rei",
            spriteName: "dojo_observer_rei",
            desiredHeightTiles: 1.15,
            areaId: "hanamiDojoUpstairs",
            x: 10,
            y: 8,
            dir: "left",
            dialogue: [
                "These upstairs bouts test your calm, not just your fists.",
                "Some think Taiko is behind the dark cloud.",
                "No one has proof, but everyone is watching the mountain."
            ],
            hasTrainingChoice: false
        },
        {
            id: "piazzaKeiko",
            name: "Keiko",
            spriteName: "townsfolk_keiko",
            desiredHeightTiles: 1.15,
            areaId: "overworld",
            x: 23,
            y: 26,
            dir: "right",
            dialogue: [
                "Hanami Piazza is lively today.",
                "Mr. Hanami still carries himself like a leader.",
                "Taiko's house has been dark since he went north."
            ],
            hasTrainingChoice: false
        },
        {
            id: "piazzaDaichi",
            name: "Daichi",
            spriteName: "townsfolk_daichi",
            desiredHeightTiles: 1.15,
            areaId: "overworld",
            x: 33,
            y: 26,
            dir: "left",
            dialogue: [
                "I watched Mr. Hanami walk up that hill at dawn.",
                "He and Taiko used to train side by side.",
                "Now that cloud hangs over the mountain, and Taiko is gone."
            ],
            hasTrainingChoice: false
        },
        {
            id: "cloudWatcherMina",
            name: "Mina",
            spriteName: "cloudwatch_mina",
            desiredHeightTiles: 1.15,
            areaId: "overworld",
            x: 31,
            y: 16,
            dir: "down",
            dialogue: [
                "Do you feel it? That dark cloud past the ridge?",
                "Even the birds changed their routes this morning.",
                "Some blame Taiko, but nobody can prove it yet."
            ],
            hasTrainingChoice: false
        },
        {
            id: "cloudWatcherJun",
            name: "Jun",
            spriteName: "cloudwatch_jun",
            desiredHeightTiles: 1.15,
            areaId: "overworld",
            x: 26,
            y: 16,
            dir: "down",
            dialogue: [
                "People think it's just weather.",
                "But the old lanterns around town have been flickering at noon.",
                "Taiko left as Vice President and never came back."
            ],
            hasTrainingChoice: false
        },
        {
            id: "piazzaDogMochi",
            name: "Mochi",
            spriteName: "town_dog",
            desiredHeightTiles: 0.95,
            areaId: "overworld",
            x: 28,
            y: 26,
            dir: "right",
            canRoam: true,
            blocking: false,
            wanderRadiusTiles: 5,
            wanderSpeed: 1.25,
            dialogue: [
                "*Mochi zooms around the piazza, then wags at you.*",
                "He circles the fountain whenever he hears distant thunder."
            ],
            hasTrainingChoice: false
        },
        {
            id: "hillPilgrimKaito",
            name: "Kaito",
            spriteName: "townsfolk_daichi",
            desiredHeightTiles: 1.15,
            areaId: "overworld",
            x: 38,
            y: 13,
            dir: "up",
            dialogue: [
                "The hill path to the dojo used to be abandoned.",
                "Now it feels like a pilgrimage."
            ],
            hasTrainingChoice: false
        },
        {
            id: "northGuardCaptainSora",
            name: "Guard Sora",
            spriteName: "dojo_student_yori",
            desiredHeightTiles: 1.15,
            areaId: "overworld",
            x: 27,
            y: 1,
            dir: "down",
            dialogue: [
                "Mr. Hanami says no one must go up to the mountain.",
                "Turn back. This path is sealed."
            ],
            hasTrainingChoice: false
        },
        {
            id: "northGuardGoofTama",
            name: "Guard Tama",
            spriteName: "bar_guest_tomo",
            desiredHeightTiles: 1.15,
            areaId: "overworld",
            x: 28,
            y: 1,
            dir: "down",
            dialogue: [
                "Yeah what he said... or whatever.",
                "No mountain trip today."
            ],
            hasTrainingChoice: false
        },
        {
            id: "chapelSisterAgnes",
            name: "Sister Agnes",
            spriteName: "sister_agnes",
            desiredHeightTiles: 1.15,
            areaId: "overworld",
            x: 13,
            y: 17,
            dir: "down",
            dialogue: [
                "Peace be with you, traveler.",
                "We keep a candle lit for the town while that shadow hangs in the distance."
            ],
            hasTrainingChoice: false
        },
        {
            id: "chapelGroundskeeperLuis",
            name: "Luis",
            spriteName: "groundskeeper_luis",
            desiredHeightTiles: 1.15,
            areaId: "overworld",
            x: 18,
            y: 15,
            dir: "left",
            dialogue: [
                "The church bells sounded off-beat last night.",
                "Since Taiko vanished up north, strange things keep happening."
            ],
            hasTrainingChoice: false
        },
        {
            id: "kyokaiAcolyteMara",
            name: "Mara",
            spriteName: "sister_agnes",
            desiredHeightTiles: 1.15,
            areaId: "hanamiChurch",
            x: 2,
            y: 3,
            dir: "right",
            dialogue: [
                "Welcome to the Kyōkai.",
                "We're praying for calm while the dark cloud passes."
            ],
            hasTrainingChoice: false
        },
        {
            id: "kyokaiCaretakerBenoit",
            name: "Benoit",
            spriteName: "groundskeeper_luis",
            desiredHeightTiles: 1.15,
            areaId: "hanamiChurch",
            x: 9,
            y: 4,
            dir: "left",
            dialogue: [
                "Keep your voice low near the altar.",
                "Even fighters need quiet places."
            ],
            hasTrainingChoice: false
        },
        {
            id: "priestMiki",
            name: "Miki",
            spriteName: "priest_miki",
            desiredHeightTiles: 1.15,
            areaId: "hanamiChurch",
            x: 6,
            y: 3,
            dir: "down",
            dialogue: [
                "I am Miki, priest of this church.",
                "The stained glass reminds us that light still reaches us through dark skies.",
                "I haven't seen Taiko in a while. I hope he's not lost."
            ],
            hasTrainingChoice: false
        },
        {
            id: "farmerElias",
            name: "Farmer Elias",
            spriteName: "farmer_elias",
            desiredHeightTiles: 1.15,
            areaId: "overworld",
            x: 15,
            y: 33,
            dir: "down",
            dialogue: [
                "This pen keeps the animals calm when storms gather.",
                "If that dark cloud reaches us, we'll need every hand ready."
            ],
            hasTrainingChoice: false
        },
        {
            id: "farmHorse",
            name: "Bay Horse",
            spriteName: "farm_horse",
            desiredHeightTiles: 1.05,
            areaId: "overworld",
            x: 13,
            y: 31,
            dir: "right",
            dialogue: [
                "*The horse stamps and snorts softly.*",
                "It seems uneasy, like it can sense weather before anyone else."
            ],
            hasTrainingChoice: false
        },
        {
            id: "farmCow",
            name: "Dapple Cow",
            spriteName: "farm_cow",
            desiredHeightTiles: 1.05,
            areaId: "overworld",
            x: 16,
            y: 31,
            dir: "left",
            dialogue: [
                "*Moo.*",
                "The cow keeps glancing toward the northern sky."
            ],
            hasTrainingChoice: false
        },
        {
            id: "farmChicken",
            name: "Speckled Chicken",
            spriteName: "farm_chicken",
            desiredHeightTiles: 0.9,
            areaId: "overworld",
            x: 14,
            y: 32,
            dir: "right",
            dialogue: [
                "*Cluck cluck.*",
                "The chicken pecks in quick circles, then pauses to look uphill."
            ],
            hasTrainingChoice: false
        },
        {
            id: "mikaBartender",
            name: "Mika",
            spriteName: "bartender_mika",
            desiredHeightTiles: 1.15,
            areaId: "hanamiBar",
            x: 6,
            y: 2,
            dir: "down",
            dialogue: [
                "Welcome to Hanami Sakaba.",
                "Long day training at the dojo?",
                "Take a breath. Listen to the room.",
                "Want to try the House Pour Challenge?"
            ],
            hasTrainingChoice: false,
            interactReachBonus: 32,
            minigameId: "housePour",
            minigamePrompt: "Try the House Pour Challenge?",
            minigameDeclineDialogue: "No worries. Come back when your hands are steady.",
            minigameWinDialogue: "That's a clean pour. You'd survive a rush-hour shift.",
            minigameLoseDialogue: "Not bad. Bar work is rhythm, timing, and patience."
        },
        {
            id: "barPatronRiku",
            name: "Riku",
            spriteName: "bar_patron_riku",
            desiredHeightTiles: 1.15,
            areaId: "hanamiBar",
            x: 2,
            y: 5,
            dir: "up",
            dialogue: [
                "I come here after sparring to cool my head.",
                "The trick is breathing before you throw a punch."
            ],
            hasTrainingChoice: false
        },
        {
            id: "barPatronAya",
            name: "Aya",
            spriteName: "bar_patron_aya",
            desiredHeightTiles: 1.15,
            areaId: "hanamiBar",
            x: 9,
            y: 5,
            dir: "up",
            dialogue: [
                "Mika runs the cleanest bar in town.",
                "If you can handle this room, you can handle pressure."
            ],
            hasTrainingChoice: false
        },
        {
            id: "barPatronKenji",
            name: "Kenji",
            spriteName: "bar_patron_kenji",
            desiredHeightTiles: 1.15,
            areaId: "hanamiBar",
            x: 8,
            y: 7,
            dir: "up",
            dialogue: [
                "The dojo sharpens your body.",
                "Places like this sharpen your timing."
            ],
            hasTrainingChoice: false
        },
        {
            id: "barGuestTomo",
            name: "Tomo",
            spriteName: "bar_guest_tomo",
            desiredHeightTiles: 1.15,
            areaId: "hanamiBar",
            x: 4,
            y: 7,
            dir: "up",
            dialogue: [
                "Everyone is whispering about that dark cloud now.",
                "They say Taiko was Mr. Hanami's Vice President before he went north.",
                "Mika says fear spreads faster than weather."
            ],
            hasTrainingChoice: false
        },
        {
            id: "barSideSkepticNori",
            name: "Nori",
            spriteName: "bar_patron_kenji",
            desiredHeightTiles: 1.15,
            areaId: "overworld",
            x: 48,
            y: 29,
            dir: "left",
            dialogue: [
                "Maybe Taiko was right.",
                "Maybe we should listen to him before this gets worse."
            ],
            hasTrainingChoice: false
        }
    ],
    enemies: [
        {
            id: "hanamiChallengeFighterA",
            name: "Dojo Challenger A",
            archetypeId: "dojoFighter",
            areaId: "hanamiDojoUpstairs",
            x: 3,
            y: 2,
            dir: "right",
            maxHp: 38,
            damage: 8,
            speed: 1.0,
            aggroRangeTiles: 6,
            attackRangeTiles: 1.1,
            attackCooldownMs: 900,
            attackWindupMs: 240,
            attackRecoveryMs: 300,
            respawnDelayMs: 5000,
            behaviorType: "meleeChaser",
            attackType: "lightSlash",
            respawnEnabled: false,
            countsForChallenge: true
        },
        {
            id: "hanamiChallengeFighterB",
            name: "Dojo Challenger B",
            archetypeId: "dojoFighter",
            areaId: "hanamiDojoUpstairs",
            x: 8,
            y: 2,
            dir: "left",
            maxHp: 40,
            damage: 8,
            speed: 1.05,
            aggroRangeTiles: 6,
            attackRangeTiles: 1.2,
            attackCooldownMs: 920,
            attackWindupMs: 240,
            attackRecoveryMs: 320,
            respawnDelayMs: 5000,
            behaviorType: "meleeChaser",
            attackType: "lightSlash",
            respawnEnabled: false,
            countsForChallenge: true
        },
        {
            id: "hanamiChallengeFighterC",
            name: "Dojo Challenger C",
            archetypeId: "dojoFighter",
            areaId: "hanamiDojoUpstairs",
            x: 6,
            y: 5,
            dir: "down",
            maxHp: 44,
            damage: 9,
            speed: 1.08,
            aggroRangeTiles: 6.3,
            attackRangeTiles: 1.2,
            attackCooldownMs: 880,
            attackWindupMs: 220,
            attackRecoveryMs: 320,
            respawnDelayMs: 5000,
            behaviorType: "meleeChaser",
            attackType: "lightSlash",
            respawnEnabled: false,
            countsForChallenge: true
        }
    ]
};
