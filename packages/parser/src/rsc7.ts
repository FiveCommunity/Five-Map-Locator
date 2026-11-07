// ============================================================
// RSC7 Binary Header Reader
// GTA V binary resource files always start with "RSC7" (0x52 0x53 0x43 0x37)
// Header layout (little-endian):
//   0x00 - 0x03 : Magic "RSC7"
//   0x04        : Version (uint32)
//   0x08        : Virtual flags (uint32) - encodes page counts/sizes
//   0x0C        : Physical flags (uint32)
// After 0x10: compressed/encrypted data block
//
// For YMAPs/YTYPs, streaming extents often appear at known offsets
// within the decompressed block, but full decompression of the DEFLATE
// block requires zlib. We read what we safely can from the header only.
// ============================================================

export interface Rsc7Header {
  magic: string;       // "RSC7"
  version: number;
  virtualFlags: number;
  physicalFlags: number;
  virtualSize: number;  // derived from flags
  physicalSize: number; // derived from flags
}

/** Page size base: GTA V uses 512-byte pages */
const PAGE_SIZE_BASE = 512;

/** Decode page count + shift from RAGE flags */
function decodePageFlags(flags: number): number {
  const shift = (flags >> 28) & 0xF;
  const count0 = (flags >> 0)  & 0x7F;
  const count1 = (flags >> 7)  & 0x3F;
  const count2 = (flags >> 13) & 0x1F;
  const count3 = (flags >> 18) & 0xF;
  const count4 = (flags >> 22) & 0x7;
  const count5 = (flags >> 25) & 0x3;
  const count6 = (flags >> 27) & 0x1;

  const baseSize = PAGE_SIZE_BASE << shift;
  return (
    count0 * baseSize +
    count1 * (baseSize >> 1) +
    count2 * (baseSize >> 2) +
    count3 * (baseSize >> 3) +
    count4 * (baseSize >> 4) +
    count5 * (baseSize >> 5) +
    count6 * (baseSize >> 6)
  );
}

/**
 * Parse RSC7 header from a buffer.
 * Returns null if magic bytes don't match (not a RAGE binary).
 */
export function parseRsc7Header(buf: Buffer): Rsc7Header | null {
  if (buf.length < 16) return null;

  // Validate magic
  if (buf[0] !== 0x52 || buf[1] !== 0x53 || buf[2] !== 0x43 || buf[3] !== 0x37) {
    return null;
  }

  const version      = buf.readUInt32LE(4);
  const virtualFlags = buf.readUInt32LE(8);
  const physFlags    = buf.readUInt32LE(12);

  return {
    magic: 'RSC7',
    version,
    virtualFlags,
    physicalFlags: physFlags,
    virtualSize: decodePageFlags(virtualFlags),
    physicalSize: decodePageFlags(physFlags),
  };
}

/**
 * Detect if buffer is RSC7 binary — HARD GUARD.
 * Never interpret binary files as XML.
 */
export function isBinaryRage(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  return buf[0] === 0x52 && buf[1] === 0x53 && buf[2] === 0x43 && buf[3] === 0x37;
}
