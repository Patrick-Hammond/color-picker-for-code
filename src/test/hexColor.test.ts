import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { findHexColors, formatHexColor, parseHexDigits, resolveUpperCase, toByte } from '../hexColor';

const digitsIn = (text: string, alpha: 'start' | 'end' = 'end') =>
    findHexColors(text, alpha).map((m) => m.digits);

test('finds 6- and 8-digit literals with correct offsets', () => {
    const text = 'a = 0xFF8800; b = 0x11223344;';
    const [first, second] = findHexColors(text, 'end');
    assert.equal(text.slice(first.start, first.end), '0xFF8800');
    assert.equal(text.slice(second.start, second.end), '0x11223344');
});

test('accepts upper/lower/mixed case and 0X prefix', () => {
    assert.deepEqual(digitsIn('0xabcdef 0XABCDEF 0xAbCdEf'), ['abcdef', 'ABCDEF', 'AbCdEf']);
});

test('ignores literals of any other length', () => {
    assert.deepEqual(digitsIn('0xFFF 0xFFFF 0xFFFFF 0xFFFFFFF 0xFFFFFFFFF 0xFF'), []);
});

test('ignores literals glued to identifiers or digit separators', () => {
    assert.deepEqual(digitsIn('a0xFFFFFF 10xFFFFFF _0xFFFFFF 0xFF_FF_FF 0xFF\'FF\'FF'), []);
});

test('ignores non-hex digits', () => {
    assert.deepEqual(digitsIn('0xGGGGGG 0xFFFFFG'), []);
});

test('still matches with C-style integer suffixes and member access', () => {
    const text = '0xFF0000u 0xFFFFFFFFULL 0xFF0000.toString(16) (0x00FF00)';
    assert.deepEqual(digitsIn(text), ['FF0000', 'FFFFFFFF', 'FF0000', '00FF00']);
    // The suffix is not part of the replaced range.
    const [first] = findHexColors(text, 'end');
    assert.equal(text.slice(first.start, first.end), '0xFF0000');
});

test('matches inside strings, comments and across lines', () => {
    assert.deepEqual(digitsIn('"0x112233"\n// 0x445566\n[0x778899,0xAABBCCDD]'), [
        '112233',
        '445566',
        '778899',
        'AABBCCDD',
    ]);
});

test('parses 6 digits as opaque RGB', () => {
    assert.deepEqual(parseHexDigits('FF8000', 'end'), { r: 255, g: 128, b: 0, a: 255 });
});

test('parses 8 digits as RRGGBBAA by default', () => {
    assert.deepEqual(parseHexDigits('11223344', 'end'), { r: 0x11, g: 0x22, b: 0x33, a: 0x44 });
});

test('parses 8 digits as AARRGGBB when alpha is first', () => {
    assert.deepEqual(parseHexDigits('44112233', 'start'), { r: 0x11, g: 0x22, b: 0x33, a: 0x44 });
});

test('formats with and without alpha, in both alpha positions', () => {
    const color = { r: 0x11, g: 0x22, b: 0x33, a: 0x44 };
    const base = { prefix: '0x', upperCase: true };
    assert.equal(formatHexColor(color, { ...base, withAlpha: false, alphaPosition: 'end' }), '0x112233');
    assert.equal(formatHexColor(color, { ...base, withAlpha: true, alphaPosition: 'end' }), '0x11223344');
    assert.equal(formatHexColor(color, { ...base, withAlpha: true, alphaPosition: 'start' }), '0x44112233');
});

test('formats letter case and keeps the prefix as given', () => {
    const color = { r: 0xab, g: 0xcd, b: 0xef, a: 0xff };
    const opts = { withAlpha: false, alphaPosition: 'end' as const };
    assert.equal(formatHexColor(color, { ...opts, prefix: '0x', upperCase: false }), '0xabcdef');
    assert.equal(formatHexColor(color, { ...opts, prefix: '0X', upperCase: true }), '0XABCDEF');
});

test('format zero-pads and clamps', () => {
    const out = formatHexColor(
        { r: 0, g: 5, b: 300, a: -4 },
        { prefix: '0x', withAlpha: true, alphaPosition: 'end', upperCase: true }
    );
    assert.equal(out, '0x0005FF00');
});

test('format(parse(x)) round-trips for every alpha position', () => {
    for (const alphaPosition of ['start', 'end'] as const) {
        for (const digits of ['00000000', 'FFFFFFFF', '12345678', 'DEADBEEF', '010203']) {
            const color = parseHexDigits(digits, alphaPosition);
            const out = formatHexColor(color, {
                prefix: '0x',
                withAlpha: digits.length === 8,
                alphaPosition,
                upperCase: true,
            });
            assert.equal(out, '0x' + digits);
        }
    }
});

test('every byte survives the 0–255 → 0–1 → 0–255 float round trip', () => {
    for (let byte = 0; byte <= 255; byte++) {
        assert.equal(toByte(byte / 255), byte);
    }
});

test('toByte clamps out-of-range floats', () => {
    assert.equal(toByte(-0.5), 0);
    assert.equal(toByte(1.5), 255);
});

test('letter case: auto follows the original, falls back to upper', () => {
    assert.equal(resolveUpperCase('abcdef', 'auto'), false);
    assert.equal(resolveUpperCase('ABCDEF', 'auto'), true);
    assert.equal(resolveUpperCase('123456', 'auto'), true);
    assert.equal(resolveUpperCase('AbCdEf', 'auto'), true);
    assert.equal(resolveUpperCase('abcdef', 'upper'), true);
    assert.equal(resolveUpperCase('ABCDEF', 'lower'), false);
});

test('scan can be cancelled', () => {
    const text = '0x112233 '.repeat(1000);
    const found = findHexColors(text, 'end', () => true);
    assert.ok(found.length < 1000);
});
