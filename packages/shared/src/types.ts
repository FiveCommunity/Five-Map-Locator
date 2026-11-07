// ============================================================
// FIVE MAP LOCATOR — Shared Types
// GTA V world coords: X[-4000,5000] Y[-5000,9000] Z[-500,2000]
// ============================================================

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec4 extends Vec3 {
  w: number;
}

export interface BoundingBox {
  min: Vec3;
  max: Vec3;
}

// ---- Real 3D Geometry and Material Structures ----

export interface GeometryMesh {
  name?: string;
  positions: number[]; // Flat array [x,y,z, x,y,z, ...]
  indices: number[];   // Triangle face indices [0,1,2, ...]
  normals?: number[];  // [nx,ny,nz, ...]
  uvs?: number[];      // [u,v, u,v, ...]
  colors?: number[];   // [r,g,b,a, ...]
  materialIndex?: number;
  bbMin?: Vec3;
  bbMax?: Vec3;
}

export interface MaterialDef {
  name: string;
  diffuseColor?: [number, number, number]; // [r, g, b] 0-1
  roughness?: number;
  metalness?: number;
  mapTextureName?: string;
  textureDataUrl?: string;
  opacity?: number;
  wireframe?: boolean;
}

export interface TextureDef {
  name: string;
  width: number;
  height: number;
  format: 'DXT1' | 'DXT5' | 'RGBA' | 'PNG' | 'JPG' | 'RAW';
  dataUrl?: string; // Base64 data URL for direct Three.js texture loading
}

export interface YdrModelData {
  name: string;
  meshes: GeometryMesh[];
  materials: MaterialDef[];
  bbMin: Vec3;
  bbMax: Vec3;
  sourceFile: string;
  vertexCount: number;
  indexCount: number;
  lodDist?: number;
}

export interface YddCollectionData {
  name: string;
  models: YdrModelData[];
  sourceFile: string;
}

export interface YtdTextureData {
  name: string;
  textures: TextureDef[];
  sourceFile: string;
}

// ---- Collision (YBN) Structures ----

export interface CollisionBound {
  type: 'BOX' | 'SPHERE' | 'CAPSULE' | 'CYLINDER' | 'MESH' | 'BVH';
  center: Vec3;
  extents?: Vec3;
  radius?: number;
  height?: number;
  vertices?: number[];
  indices?: number[];
  materialIndex?: number;
}

export interface YbnCollisionData {
  name: string;
  bounds: CollisionBound[];
  sourceFile: string;
  totalPolys: number;
  bbMin: Vec3;
  bbMax: Vec3;
}

// ---- MLO / Interior Structures ----

export interface MloRoom {
  index: number;
  name: string;
  bbMin: Vec3;
  bbMax: Vec3;
  portalCount: number;
  attachedObjects: number[]; // Indices of entities inside this room
}

export interface MloPortal {
  index: number;
  fromRoom: number;
  toRoom: number;
  flags: number;
  corners: Vec3[]; // 4 corners defining portal polygon
  mirror?: boolean;
}

export interface MloInstance {
  name: string;
  archetypeName: string;
  position: Vec3;
  rotation: Vec4;
  rooms: MloRoom[];
  portals: MloPortal[];
  entities: ParsedEntity[];
  bbMin: Vec3;
  bbMax: Vec3;
}

export interface YmfData {
  name: string;
  imapDependencies: string[];
  itypDependencies: string[];
  interiors: {
    name: string;
    position?: Vec3;
    bbMin?: Vec3;
    bbMax?: Vec3;
  }[];
  sourceFile: string;
  parseWarnings: string[];
}

// ---- Parsed Entity ----

export interface ParsedEntity {
  archetypeName: string;
  position: Vec3;
  rotation: Vec4;
  scaleXY: number;
  scaleZ: number;
  lodDist: number;
  flags: number;
  guid: number;
  parentIndex: number;
  lodLevel: string;
  // MLO fields
  isMlo?: boolean;
  mloRoomIndex?: number;
  mloPortalIndex?: number;
  mloInstanceName?: string;
  // Geometry reference if attached or loaded
  resolvedModel?: YdrModelData;
  polygonCount?: number;
}

export interface ParsedArchetype {
  name: string;
  bbMin: Vec3;
  bbMax: Vec3;
  hdTextureDist: number;
  lodDist: number;
  textureDictionary: string;
  drawableDictionary: string;
  physicsDictionary: string;
  assetType: string;
  flags: number;
  // MLO archetype extension
  isMlo?: boolean;
  rooms?: MloRoom[];
  portals?: MloPortal[];
  entities?: ParsedEntity[];
}

export interface YmapData {
  name: string;
  parent: string | null;
  flags: number;
  contentFlags: number;
  streamingExtents: BoundingBox | null;
  entitiesExtents: BoundingBox | null;
  entities: ParsedEntity[];
  mlos: MloInstance[];
  sourceFile: string;
  parseWarnings: string[];
}

export interface YtypData {
  name: string;
  archetypes: ParsedArchetype[];
  mlos: MloInstance[];
  sourceFile: string;
  parseWarnings: string[];
}

// ---- Location Engine ----

export type ConfidenceLevel =
  | 'CONFIRMED'
  | 'ESTIMATED_WITH_REFS'
  | 'MULTIPLE_CANDIDATES'
  | 'UNIDENTIFIED';

export interface Evidence {
  type: 'YMAP_EXTENTS' | 'ENTITY_POSITIONS' | 'YTYP_BOUNDS' | 'YMF_MANIFEST' | 'FILENAME' | 'ARCHETYPE_MATCH' | 'GEOMETRY';
  description: string;
  weight: number;
}

export interface LocationCandidate {
  coordinates: Vec3;
  region: GtaRegion;
  confidence: number;
  evidence: Evidence[];
}

export interface LocationResult {
  status: ConfidenceLevel;
  primaryCoordinates: Vec3 | null;
  primaryRegion: GtaRegion | null;
  boundingBox: BoundingBox | null;
  confidence: number;
  evidence: Evidence[];
  candidates: LocationCandidate[];
  centroid: Vec3 | null;
  entityCount: number;
  warnings: string[];
}

export interface GtaRegion {
  id: string;
  name: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  description: string;
}

// ---- File Analysis ----

export type FileFormat =
  | 'YMAP_XML'
  | 'YMAP_BINARY'
  | 'YTYP_XML'
  | 'YTYP_BINARY'
  | 'YDR_XML'
  | 'YDR_BINARY'
  | 'YDD_BINARY'
  | 'YBN_XML'
  | 'YBN_BINARY'
  | 'YTD_BINARY'
  | 'YFT_BINARY'
  | 'YMF_BINARY'
  | 'META_XML'
  | 'XML_GENERIC'
  | 'OBJ'
  | 'FBX'
  | 'GLTF'
  | 'GLB'
  | 'FXMANIFEST'
  | 'UNKNOWN'
  | 'INVALID_BINARY';

export interface FileAnalysisResult {
  path: string;
  filename: string;
  format: FileFormat;
  size: number;
  parseSuccess: boolean;
  errors: string[];
  warnings: string[];
  ymapData?: YmapData;
  ytypData?: YtypData;
  ydrData?: YdrModelData;
  yddData?: YddCollectionData;
  ytdData?: YtdTextureData;
  ybnData?: YbnCollisionData;
  ymfData?: YmfData;
  mloData?: MloInstance;
  hasCoordinates: boolean;
  entityCount: number;
}

export interface ResourceAnalysis {
  id: string;
  name: string;
  rootPath: string;
  timestamp: number;
  files: FileAnalysisResult[];
  locationResult: LocationResult;
  totalEntities: number;
  totalFiles: number;
  missingDependencies: string[];
  structuralIssues: string[];
  hasFxManifest: boolean;
  streamFolder: boolean;
  dataFolder: boolean;
  mapsFolder: boolean;
  // 3D Scene Assembly
  modelsMap?: Record<string, YdrModelData>;
  texturesMap?: Record<string, TextureDef>;
  collisionsMap?: Record<string, YbnCollisionData>;
  mlos?: MloInstance[];
  status: 'pending' | 'processing' | 'done' | 'error' | 'cancelled';
  progress: number;
}

// ---- Worker IPC ----

export interface AnalysisRequest {
  jobId: string;
  inputPath: string;
  inputType: 'file' | 'folder' | 'zip';
}

export interface AnalysisProgress {
  jobId: string;
  progress: number;
  currentFile: string;
  filesProcessed: number;
  totalFiles: number;
}

export interface WorkerMessage {
  type: 'progress' | 'done' | 'error' | 'cancelled';
  jobId: string;
  data?: ResourceAnalysis | AnalysisProgress | string;
}
