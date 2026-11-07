import { describe, it, expect } from 'vitest';
import { isBinaryRage, parseRsc7Header } from '../src/rsc7';

describe('RSC7 Binary Detection', () => {
  it('should detect valid RSC7 magic', () => {
    const buf = Buffer.from([0x52, 0x53, 0x43, 0x37, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    expect(isBinaryRage(buf)).toBe(true);
    const header = parseRsc7Header(buf);
    expect(header).not.toBeNull();
    expect(header!.magic).toBe('RSC7');
    expect(header!.version).toBe(8);
  });

  it('should NOT flag XML files as binary', () => {
    const buf = Buffer.from('<?xml version="1.0"?><CMapData></CMapData>');
    expect(isBinaryRage(buf)).toBe(false);
  });

  it('should NOT flag random bytes as RSC7', () => {
    const buf = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    expect(isBinaryRage(buf)).toBe(false);
  });

  it('should return null for buffers shorter than 16 bytes', () => {
    const buf = Buffer.from([0x52, 0x53, 0x43, 0x37]);
    // Magic is valid but header requires 16 bytes
    const header = parseRsc7Header(buf);
    expect(header).toBeNull();
  });
});
