import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { computeFileHash, computeStringHash, hashesMatch } from './sha256.js';

// ── computeStringHash ─────────────────────────────────────────────────────────

describe('computeStringHash', () => {
  test('returns a 64-char hex string', () => {
    const hash = computeStringHash('hello');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('is deterministic for the same input', () => {
    expect(computeStringHash('hello')).toBe(computeStringHash('hello'));
  });

  test('differs for different inputs', () => {
    expect(computeStringHash('hello')).not.toBe(computeStringHash('world'));
  });

  test('empty string has a known SHA256', () => {
    // SHA256('') = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(computeStringHash('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});

// ── hashesMatch ───────────────────────────────────────────────────────────────

describe('hashesMatch', () => {
  test('returns true for identical hashes', () => {
    const h = computeStringHash('test');
    expect(hashesMatch(h, h)).toBe(true);
  });

  test('returns false for different hashes', () => {
    expect(hashesMatch(computeStringHash('a'), computeStringHash('b'))).toBe(false);
  });

  test('is case-insensitive', () => {
    const lower = 'abc123def456';
    const upper = 'ABC123DEF456';
    expect(hashesMatch(lower, upper)).toBe(true);
  });
});

// ── computeFileHash ───────────────────────────────────────────────────────────

describe('computeFileHash', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'oac-sha256-test-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('returns the SHA256 of a file matching computeStringHash', async () => {
    const content = 'hello world';
    const filePath = join(tmpDir, 'test.txt');
    await writeFile(filePath, content, 'utf8');

    const fileHash = await computeFileHash(filePath);
    const stringHash = computeStringHash(content);
    expect(fileHash).toBe(stringHash);
  });

  test('throws a descriptive error for a missing file', async () => {
    const missing = join(tmpDir, 'does-not-exist.txt');
    await expect(computeFileHash(missing)).rejects.toThrow('computeFileHash: cannot read');
  });

  test('is deterministic across two reads of the same file', async () => {
    const filePath = join(tmpDir, 'stable.txt');
    await writeFile(filePath, 'stable content', 'utf8');
    const h1 = await computeFileHash(filePath);
    const h2 = await computeFileHash(filePath);
    expect(h1).toBe(h2);
  });
});
