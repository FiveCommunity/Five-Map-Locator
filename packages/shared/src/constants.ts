import type { GtaRegion, Vec3 } from './types';

// ---- GTA V World Bounds ----
export const GTA_WORLD_BOUNDS = {
  xMin: -4000,
  xMax: 5000,
  yMin: -5000,
  yMax: 9000,
  zMin: -500,
  zMax: 2000,
} as const;

// ---- Known GTA V Regions ----
export const GTA_REGIONS: GtaRegion[] = [
  { id: 'downtown_ls', name: 'Downtown Los Santos', xMin: -800, xMax: 400, yMin: -1500, yMax: -300, description: 'Central business district of Los Santos' },
  { id: 'vespucci', name: 'Vespucci Beach', xMin: -1800, xMax: -800, yMin: -1600, yMax: -600, description: 'Beach area west of downtown' },
  { id: 'lsia', name: 'Los Santos International Airport', xMin: -1700, xMax: -400, yMin: -3200, yMax: -2000, description: 'Main airport of Los Santos' },
  { id: 'la_puerta', name: 'La Puerta / Port', xMin: -800, xMax: 400, yMin: -3000, yMax: -1800, description: 'Industrial port area' },
  { id: 'east_ls', name: 'East Los Santos', xMin: 400, xMax: 1200, yMin: -1500, yMax: -200, description: 'Eastern residential area' },
  { id: 'strawberry', name: 'Strawberry / Davis', xMin: -600, xMax: 400, yMin: -1800, yMax: -1200, description: 'Southern residential neighborhoods' },
  { id: 'rockford', name: 'Rockford Hills', xMin: -900, xMax: -300, yMin: -600, yMax: 200, description: 'Wealthy hillside area' },
  { id: 'vinewood', name: 'Vinewood Hills', xMin: -300, xMax: 600, yMin: 200, yMax: 1000, description: 'Hollywood-style hills north of LS' },
  { id: 'north_ls', name: 'North Los Santos', xMin: -300, xMax: 800, yMin: -300, yMax: 500, description: 'Northern Los Santos area' },
  { id: 'grand_senora', name: 'Grand Senora Desert', xMin: 500, xMax: 2500, yMin: 1000, yMax: 4000, description: 'Central desert of Blaine County' },
  { id: 'sandy_shores', name: 'Sandy Shores', xMin: 1200, xMax: 2200, yMin: 2800, yMax: 3800, description: 'Sandy Shores town and airfield' },
  { id: 'alamo_sea', name: 'Alamo Sea', xMin: 500, xMax: 2000, yMin: 2500, yMax: 4000, description: 'Inland lake area' },
  { id: 'paleto_bay', name: 'Paleto Bay', xMin: -900, xMax: 400, yMin: 6000, yMax: 7200, description: 'Northern coastal town' },
  { id: 'mount_chiliad', name: 'Mount Chiliad', xMin: 200, xMax: 900, yMin: 5000, yMax: 6500, description: 'Highest peak in GTA V' },
  { id: 'zancudo', name: 'Fort Zancudo', xMin: -2500, xMax: -1500, yMin: 2500, yMax: 3800, description: 'Military base' },
  { id: 'chumash', name: 'Chumash / Great Ocean', xMin: -3200, xMax: -1800, yMin: -1000, yMax: 1500, description: 'Pacific coastal area' },
  { id: 'grapeseed', name: 'Grapeseed', xMin: 1200, xMax: 2200, yMin: 500, yMax: 1500, description: 'Rural farming area' },
  { id: 'del_perro', name: 'Del Perro / Morningwood', xMin: -1700, xMax: -900, yMin: -600, yMax: 200, description: 'Coastal area west of downtown' },
  { id: 'ocean', name: 'Ocean / Offshore', xMin: -4000, xMax: 5000, yMin: -5000, yMax: 9000, description: 'Ocean or unmapped area' },
];

// ---- Known GTA V Map Sectors (for binary RSC7 / un-exported mod location) ----
export const GTA_SECTORS: Record<string, { pos: Vec3; regionId: string; description: string }> = {
  cs4_03: { pos: { x: -1080.0, y: -1260.0, z: 5.5 }, regionId: 'vespucci', description: 'Vespucci Beach & Market sector (cs4_03)' },
  cs4_01: { pos: { x: -1300.0, y: -1100.0, z: 5.0 }, regionId: 'del_perro', description: 'Del Perro Pier / Coastal sector (cs4_01)' },
  cs4_02: { pos: { x: -1100.0, y: -1400.0, z: 5.0 }, regionId: 'vespucci', description: 'Vespucci Canals sector (cs4_02)' },
  cs2_06: { pos: { x: 700.0, y: -900.0, z: 25.0 }, regionId: 'east_ls', description: 'East Los Santos sector (cs2_06)' },
  cs6_01: { pos: { x: -100.0, y: -800.0, z: 38.0 }, regionId: 'downtown_ls', description: 'Downtown Los Santos sector (cs6_01)' },
  ap1_01: { pos: { x: -1033.0, y: -2729.0, z: 13.0 }, regionId: 'lsia', description: 'LSIA Airport sector (ap1_01)' },
  ch1_01: { pos: { x: 450.0, y: 5500.0, z: 750.0 }, regionId: 'mount_chiliad', description: 'Mount Chiliad sector (ch1_01)' },
  id1_01: { pos: { x: 200.0, y: -2200.0, z: 10.0 }, regionId: 'la_puerta', description: 'Port & Industrial sector (id1_01)' },
};

// ---- Known GTA V Landmarks (for coordinate validation) ----
export const GTA_LANDMARKS = [
  { name: 'Maze Bank Tower', position: { x: -75.0, y: -818.0, z: 326.0 } },
  { name: 'LSIA Center', position: { x: -1033.0, y: -2729.0, z: 13.0 } },
  { name: 'Mount Chiliad Peak', position: { x: 450.7, y: 5566.6, z: 806.2 } },
  { name: 'Sandy Shores Airfield', position: { x: 1739.0, y: 3259.0, z: 41.0 } },
  { name: 'Paleto Bay Center', position: { x: -108.0, y: 6479.0, z: 31.0 } },
  { name: 'Del Perro Pier', position: { x: -1670.0, y: -1125.0, z: 13.0 } },
  { name: 'Rockford Hills PD', position: { x: -449.0, y: 100.0, z: 60.0 } },
  { name: 'Fort Zancudo Gate', position: { x: -2117.0, y: 3215.0, z: 32.0 } },
] as const;

// ---- File Extension → Format mapping ----
export const EXTENSION_MAP: Record<string, string> = {
  '.ymap': 'YMAP',
  '.ytyp': 'YTYP',
  '.ydr': 'YDR_BINARY',
  '.ydd': 'YDD_BINARY',
  '.ybn': 'YBN_BINARY',
  '.ytd': 'YTD_BINARY',
  '.yft': 'YFT_BINARY',
  '.ymf': 'YMF_BINARY',
  '.meta': 'META_XML',
  '.xml': 'XML_GENERIC',
  '.obj': 'OBJ',
  '.fbx': 'FBX',
  '.gltf': 'GLTF',
  '.glb': 'GLB',
};

// ---- RSC7 Binary Magic ----
export const RSC7_MAGIC = Buffer.from([0x52, 0x53, 0x43, 0x37]); // "RSC7"

// ---- XML declaration prefix ----
export const XML_MAGIC = '<?xml';

// ---- Confidence score weights ----
export const CONFIDENCE_WEIGHTS = {
  YMF_MANIFEST: 0.95,    // MLO interior positions / bounds in manifest — highest precision
  YMAP_EXTENTS: 0.9,     // streamingExtents in YMAP root — very reliable
  ENTITY_POSITIONS: 0.85, // positions from entities inside YMAP
  YTYP_BOUNDS: 0.5,       // archetype bounding boxes (relative, not world)
  FILENAME: 0.2,           // archetype/file name matches known GTA regions
  ARCHETYPE_MATCH: 0.4,    // known vanilla GTA archetype names
  GEOMETRY: 0.3,           // size/scale analysis of bounding box
} as const;

// ---- GTA V vanilla archetype prefixes (known original game models) ----
export const VANILLA_ARCHETYPE_PREFIXES = [
  'prop_', 'v_ilev_', 'v_res_', 'v_corp_', 'cs_', 'ig_', 'a_', 'mp_',
  'hei_', 'bkr_', 'ch_', 'dt_', 'xs_', 'bh1_', 'apa_', 'rm_', 'rh_',
  'smpa_', 'vb_', 'ex_', 'tr_', 'tat_', 'ab_', 'fb_', 'fbi_', 'pol_',
  'lo_', 'mi_', 'nb_', 'old_', 'grp_', 'gar_', 'pbus_', 'prop_tree_',
];

// ---- Worker config ----
export const WORKER_MEMORY_LIMIT_MB = 512;
export const MAX_ZIP_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
export const MAX_SINGLE_FILE_SIZE_BYTES = 512 * 1024 * 1024; // 512MB
