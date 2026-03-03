import { AUDIO_TRACKS, TILE_TYPES } from "../../core/constants.js";
import {
    createFilledMap,
    createWalledInterior,
    paintPath,
    paintPoints,
    paintRect
} from "../mapUtils.js";
import { BUILDING_TYPES } from "../buildingRenderers.js";

const OVARUN_BUILDINGS = [
    { id: "ovarunNorthwestArcade", type: BUILDING_TYPES.SHOP, style: "modernShop", x: 4, y: 4, width: 6, height: 8, doorX: 7, doorY: 11, doorSide: "south", interiorId: "ovarunNorthwestArcadeInterior", name: "Northwest Arcade" },
    { id: "ovarunNortheastExchange", type: BUILDING_TYPES.SHOP, style: "modernShop", x: 46, y: 5, width: 6, height: 9, doorX: 49, doorY: 13, doorSide: "south", interiorId: "ovarunNortheastExchangeInterior", name: "Northeast Exchange" },
    { id: "ovarunWestBoutique", type: BUILDING_TYPES.SHOP, style: "modernShop", x: 3, y: 15, width: 6, height: 5, doorX: 6, doorY: 19, doorSide: "south", interiorId: "ovarunWestBoutiqueInterior", name: "West Boutique" },
    { id: "ovarunEastTransitShop", type: BUILDING_TYPES.SHOP, style: "modernShop", x: 47, y: 17, width: 5, height: 6, doorX: 49, doorY: 22, doorSide: "south", interiorId: "ovarunEastTransitShopInterior", name: "East Transit Shop" },
    { id: "ovarunSouthwestMarket", type: BUILDING_TYPES.SHOP, style: "modernShop", x: 4, y: 31, width: 6, height: 8, doorX: 7, doorY: 31, doorSide: "north", interiorId: "ovarunSouthwestMarketInterior", name: "Southwest Market" },
    { id: "ovarunSoutheastPlaza", type: BUILDING_TYPES.SHOP, style: "modernShop", x: 45, y: 30, width: 7, height: 9, doorX: 48, doorY: 30, doorSide: "north", interiorId: "ovarunSoutheastPlazaInterior", name: "Southeast Plaza" },
    { id: "ovarunCoreOfficeA", type: BUILDING_TYPES.HOUSE, style: "glassOffice", x: 16, y: 14, width: 5, height: 7, doorX: 18, doorY: 20, doorSide: "south", interiorId: "ovarunCoreOfficeAInterior", name: "Core Office A" },
    { id: "ovarunCoreOfficeB", type: BUILDING_TYPES.HOUSE, style: "glassOffice", x: 23, y: 14, width: 5, height: 6, doorX: 25, doorY: 19, doorSide: "south", interiorId: "ovarunCoreOfficeBInterior", name: "Core Office B" },
    { id: "ovarunCoreOfficeC", type: BUILDING_TYPES.HOUSE, style: "glassOffice", x: 30, y: 14, width: 6, height: 8, doorX: 33, doorY: 21, doorSide: "south", interiorId: "ovarunCoreOfficeCInterior", name: "Core Office C" },
    { id: "ovarunCoreOfficeD", type: BUILDING_TYPES.HOUSE, style: "glassOffice", x: 38, y: 14, width: 3, height: 7, doorX: 39, doorY: 20, doorSide: "south", interiorId: "ovarunCoreOfficeDInterior", name: "Core Office D" },
    { id: "ovarunCoreOfficeE", type: BUILDING_TYPES.HOUSE, style: "glassOffice", x: 17, y: 23, width: 4, height: 6, doorX: 19, doorY: 28, doorSide: "south", interiorId: "ovarunCoreOfficeEInterior", name: "Core Office E" },
    { id: "ovarunCoreOfficeF", type: BUILDING_TYPES.HOUSE, style: "glassOffice", x: 23, y: 23, width: 6, height: 5, doorX: 26, doorY: 27, doorSide: "south", interiorId: "ovarunCoreOfficeFInterior", name: "Core Office F" },
    { id: "ovarunCoreOfficeG", type: BUILDING_TYPES.HOUSE, style: "glassOffice", x: 31, y: 24, width: 5, height: 5, doorX: 33, doorY: 28, doorSide: "south", interiorId: "ovarunCoreOfficeGInterior", name: "Core Office G" },
    { id: "ovarunCoreOfficeH", type: BUILDING_TYPES.HOUSE, style: "glassOffice", x: 38, y: 23, width: 3, height: 6, doorX: 39, doorY: 28, doorSide: "south", interiorId: "ovarunCoreOfficeHInterior", name: "Core Office H" }
];

const OVARUN_CROWD_SPRITES = [
    "overrun_man_1_32",
    "overrun_woman_1_32",
    "overrun_woman_2_32"
];

const OVARUN_CROWD_POINTS = [
    [10, 8], [14, 8], [18, 8], [22, 8], [26, 8], [30, 8], [34, 8], [38, 8], [42, 8], [45, 8],
    [10, 35], [14, 35], [18, 35], [22, 35], [26, 35], [30, 35], [34, 35], [38, 35], [42, 35], [45, 35],
    [8, 12], [8, 16], [8, 20], [8, 24], [8, 28], [8, 32],
    [45, 12], [45, 16], [45, 20], [45, 24], [45, 28], [45, 32],
    [4, 22], [8, 22], [12, 22], [16, 22], [20, 22], [36, 22], [40, 22], [44, 22]
];

function generateOvarunBase(width, height) {
    const map = createFilledMap(width, height, TILE_TYPES.PATH);

    paintRect(map, 0, 0, width, 1, TILE_TYPES.WALL);
    paintRect(map, 0, height - 1, width, 1, TILE_TYPES.WALL);
    paintRect(map, 0, 0, 1, height, TILE_TYPES.WALL);
    paintRect(map, width - 1, 0, 1, height, TILE_TYPES.WALL);

    paintRect(map, 0, 20, 4, 5, TILE_TYPES.PATH);
    paintRect(map, 7, 6, 42, 32, TILE_TYPES.PATH);
    paintRect(map, 12, 10, 32, 24, TILE_TYPES.WALL);
    paintRect(map, 14, 12, 28, 20, TILE_TYPES.PATH);

    for (const building of OVARUN_BUILDINGS) {
        paintRect(map, building.x, building.y, building.width, building.height, TILE_TYPES.WALL);
    }

    paintPath(map, [{ x: 2, y: 22 }, { x: 53, y: 22 }], 3);
    paintPath(map, [{ x: 28, y: 2 }, { x: 28, y: 41 }], 2);
    paintPath(map, [{ x: 9, y: 9 }, { x: 46, y: 9 }], 2);
    paintPath(map, [{ x: 9, y: 34 }, { x: 46, y: 34 }], 2);
    paintPath(map, [{ x: 9, y: 9 }, { x: 9, y: 34 }], 2);
    paintPath(map, [{ x: 46, y: 9 }, { x: 46, y: 34 }], 2);

    paintRect(map, 12, 2, 8, 4, TILE_TYPES.HILL);
    paintRect(map, 36, 2, 8, 4, TILE_TYPES.HILL);
    paintRect(map, 12, 38, 8, 4, TILE_TYPES.HILL);
    paintRect(map, 36, 38, 8, 4, TILE_TYPES.HILL);
    paintRect(map, 25, 20, 6, 4, TILE_TYPES.HILL);

    map[22][0] = TILE_TYPES.DOOR;
    paintPoints(map, [[1, 21], [1, 22], [1, 23], [2, 22]], TILE_TYPES.PATH);

    return map;
}

function generateOvarunShopInteriorBase(width, height) {
    const map = createWalledInterior(width, height, TILE_TYPES.BAR_FLOOR);
    for (let x = 2; x <= width - 3; x++) map[3][x] = TILE_TYPES.BAR_COUNTER;
    map[1][2] = TILE_TYPES.BAR_DECOR;
    map[1][5] = TILE_TYPES.BAR_DECOR;
    map[1][8] = TILE_TYPES.BAR_DECOR;
    map[6][3] = TILE_TYPES.BAR_TABLE;
    map[6][8] = TILE_TYPES.BAR_TABLE;
    map[7][5] = TILE_TYPES.BAR_STOOL;
    map[7][9] = TILE_TYPES.BAR_STOOL;
    return map;
}

function generateOvarunOfficeInteriorBase(width, height) {
    const map = createWalledInterior(width, height, TILE_TYPES.INTERIOR_FLOOR);
    map[2][2] = TILE_TYPES.TV;
    map[2][9] = TILE_TYPES.HIFI;
    map[3][3] = TILE_TYPES.BAR_TABLE;
    map[3][8] = TILE_TYPES.BAR_TABLE;
    map[5][2] = TILE_TYPES.BAR_DECOR;
    map[5][9] = TILE_TYPES.BAR_DECOR;
    map[1][6] = TILE_TYPES.OVAL_MIRROR;
    return map;
}

function buildOvarunCrowdNpcs() {
    const ovarunMap = generateOvarunBase(56, 44);
    const walkableSpawns = OVARUN_CROWD_POINTS.filter(([x, y]) => {
        const tile = ovarunMap[y]?.[x];
        return tile === TILE_TYPES.PATH || tile === TILE_TYPES.HILL;
    });
    const usedKeys = new Set(walkableSpawns.map(([x, y]) => `${x},${y}`));
    if (walkableSpawns.length < 40) {
        for (let y = 1; y < ovarunMap.length - 1; y++) {
            if (walkableSpawns.length >= 40) break;
            for (let x = 1; x < ovarunMap[0].length - 1; x++) {
                if (walkableSpawns.length >= 40) break;
                const key = `${x},${y}`;
                if (usedKeys.has(key)) continue;
                const tile = ovarunMap[y][x];
                if (tile !== TILE_TYPES.PATH && tile !== TILE_TYPES.HILL) continue;
                walkableSpawns.push([x, y]);
                usedKeys.add(key);
            }
        }
    }

    return walkableSpawns.slice(0, 40).map(([x, y], index) => {
        const spriteName = OVARUN_CROWD_SPRITES[Math.floor(Math.random() * OVARUN_CROWD_SPRITES.length)];
        const directions = ["up", "down", "left", "right"];
        return {
            id: `ovarunPedestrian${index + 1}`,
            name: "Ovarun Citizen",
            spriteName,
            desiredHeightTiles: 1.15,
            areaId: "ovarun",
            x,
            y,
            dir: directions[index % directions.length],
            canRoam: true,
            blocking: true,
            wanderRadiusTiles: 2 + (index % 2),
            wanderSpeed: 0.88 + ((index % 5) * 0.08),
            dialogue: [
                "Ovarun never slows down."
            ],
            hasTrainingChoice: false
        };
    });
}

function buildOvarunInteriors() {
    const areas = {};
    const spawns = {};
    const doors = [];
    const npcs = [];

    for (let i = 0; i < OVARUN_BUILDINGS.length; i++) {
        const building = OVARUN_BUILDINGS[i];
        const interiorId = building.interiorId;
        const exteriorSpawnId = `${building.id}ExteriorDoor`;
        const interiorSpawnId = `${building.id}InteriorDoor`;
        const isShop = building.type === BUILDING_TYPES.SHOP;
        const spriteName = OVARUN_CROWD_SPRITES[i % OVARUN_CROWD_SPRITES.length];
        const outsideY = building.doorSide === "south" ? building.doorY + 1 : building.doorY - 1;
        const outsideDir = building.doorSide === "south" ? "up" : "down";
        const insideDir = building.doorSide === "south" ? "up" : "down";

        areas[interiorId] = {
            id: interiorId,
            kind: "interior",
            mood: isShop ? "amberLounge" : "inkQuiet",
            width: 12,
            height: 10,
            generateBaseMap: isShop ? generateOvarunShopInteriorBase : generateOvarunOfficeInteriorBase
        };

        spawns[exteriorSpawnId] = { areaId: "ovarun", x: building.doorX, y: outsideY, dir: outsideDir };
        spawns[interiorSpawnId] = { areaId: interiorId, x: 6, y: 8, dir: insideDir };

        doors.push({
            from: { areaId: "ovarun", x: building.doorX, y: building.doorY },
            to: { townId: "ovarunTown", spawnId: interiorSpawnId }
        });
        doors.push({
            from: { areaId: interiorId, x: 6, y: 9 },
            to: { townId: "ovarunTown", spawnId: exteriorSpawnId }
        });

        npcs.push({
            id: `${building.id}Merchant`,
            name: isShop ? "Store Clerk" : "Office Agent",
            spriteName,
            desiredHeightTiles: 1.15,
            areaId: interiorId,
            x: 6,
            y: 3,
            dir: "down",
            dialogue: [
                isShop
                    ? "Welcome. We can buy and sell here."
                    : "Welcome to Ovarun Office Services."
            ],
            hasTrainingChoice: false,
            isMerchant: true,
            merchantBuyItemName: isShop ? "Energy Drink" : "Office Pass",
            merchantBuyCostSilver: isShop ? 14 : 22,
            merchantSellItemName: isShop ? "Training Headband" : "Kendo Stick",
            merchantSellPayoutSilver: isShop ? 28 : 45
        });
    }

    return { areas, spawns, doors, npcs };
}

const generated = buildOvarunInteriors();

export const ovarunTown = {
    id: "ovarunTown",
    name: "Ovarun",
    defaultSpawnId: "gateEntry",
    respawnSpawn: "gateEntry",
    respawnNpcId: "",
    areas: {
        ovarun: {
            id: "ovarun",
            kind: "overworld",
            mood: "inkQuiet",
            width: 56,
            height: 44,
            musicSrc: AUDIO_TRACKS.OVARUN,
            generateBaseMap: generateOvarunBase,
            buildings: OVARUN_BUILDINGS.map((building) => ({
                id: building.id,
                type: building.type,
                style: building.style,
                x: building.x,
                y: building.y,
                width: building.width,
                height: building.height
            })),
            signposts: [
                { x: 6, y: 22, text: "Ovarun Gate Transit" },
                { x: 27, y: 8, text: "Skyline Ring" },
                { x: 27, y: 34, text: "Commerce Loop" },
                { x: 45, y: 22, text: "Ovarun Central District" }
            ]
        },
        ...generated.areas
    },
    spawns: {
        gateEntry: { areaId: "ovarun", x: 2, y: 22, dir: "right" },
        ...generated.spawns
    },
    doors: [
        {
            from: { areaId: "ovarun", x: 0, y: 22 },
            to: { townId: "hanamiTown", spawnId: "ovarunGate" }
        },
        ...generated.doors
    ],
    npcs: [
        ...buildOvarunCrowdNpcs(),
        ...generated.npcs
    ],
    enemies: []
};
