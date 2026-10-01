/**
 * Pure (VS Code–free) helpers for finding, parsing and formatting
 * 0xRRGGBB / 0xRRGGBBAA (or 0xAARRGGBB) hex colour literals.
 */

export type AlphaPosition = 'start' | 'end';
export type LetterCase = 'auto' | 'upper' | 'lower';

/** A colour as four 0–255 integer channels. */
export interface Rgba {
    r: number;
    g: number;
    b: number;
    a: number;
}

export interface HexColorMatch {
    /** Offset of the leading `0` within the scanned text. */
    start: number;
    /** Offset just past the last hex digit. Trailing literal suffixes (`u`, `UL`, …) are excluded. */
    end: number;
    /** `0x` or `0X`, exactly as written. */
    prefix: string;
    /** The 6 or 8 hex digits, exactly as written. */
    digits: string;
    color: Rgba;
}

export interface FormatOptions {
    prefix: string;
    withAlpha: boolean;
    alphaPosition: AlphaPosition;
    upperCase: boolean;
}

/**
 * - not preceded by a word character, so `a0xFFFFFF` or `10xFFFFFF` are ignored;
 * - exactly 6 or 8 digits: not followed by another hex digit, `_` or `'`, so 3/4/7/9+ digit
 *   literals, `0xFF_FF_FF` and C++ `0xFF'FF'FF` are ignored;
 * - anything else may follow, which keeps `0xFF0000u`, `0xFFFFFFFFULL` and `0xFF0000.toString(16)` working.
 */
const HEX_COLOR_PATTERN = /(?<!\w)(0[xX])([0-9a-fA-F]{8}|[0-9a-fA-F]{6})(?![0-9a-fA-F_'])/g;

/** Find every colour literal in `text`. `shouldStop` is polled so large scans can be cancelled. */
export function findHexColors(
    text: string,
    alphaPosition: AlphaPosition,
    shouldStop: () => boolean = () => false
): HexColorMatch[] {
    const matches: HexColorMatch[] = [];
    const pattern = new RegExp(HEX_COLOR_PATTERN);
    let found: RegExpExecArray | null;
    while ((found = pattern.exec(text)) !== null) {
        if (matches.length % 256 === 255 && shouldStop()) {
            break;
        }
        const [whole, prefix, digits] = found;
        matches.push({
            start: found.index,
            end: found.index + whole.length,
            prefix,
            digits,
            color: parseHexDigits(digits, alphaPosition),
        });
    }
    return matches;
}

/** Parse 6 or 8 hex digits (no prefix). 6-digit values are fully opaque. */
export function parseHexDigits(digits: string, alphaPosition: AlphaPosition): Rgba {
    const byte = (i: number) => parseInt(digits.slice(i * 2, i * 2 + 2), 16);
    if (digits.length === 6) {
        return { r: byte(0), g: byte(1), b: byte(2), a: 255 };
    }
    return alphaPosition === 'start'
        ? { a: byte(0), r: byte(1), g: byte(2), b: byte(3) }
        : { r: byte(0), g: byte(1), b: byte(2), a: byte(3) };
}

/** Format a colour as `<prefix><digits>`, e.g. `0xFF8800` or `0xFF880080`. */
export function formatHexColor(color: Rgba, options: FormatOptions): string {
    const hex = (n: number) => clampByte(n).toString(16).padStart(2, '0');
    const { r, g, b, a } = color;
    let digits: string;
    if (!options.withAlpha) {
        digits = hex(r) + hex(g) + hex(b);
    } else if (options.alphaPosition === 'start') {
        digits = hex(a) + hex(r) + hex(g) + hex(b);
    } else {
        digits = hex(r) + hex(g) + hex(b) + hex(a);
    }
    return options.prefix + (options.upperCase ? digits.toUpperCase() : digits);
}

/**
 * Decide whether to write A–F in upper case. `auto` follows the literal being replaced:
 * lower-case letters → lower, otherwise upper (including when there are no letters to go by).
 */
export function resolveUpperCase(originalDigits: string, letterCase: LetterCase): boolean {
    if (letterCase === 'upper') {
        return true;
    }
    if (letterCase === 'lower') {
        return false;
    }
    const hasLower = /[a-f]/.test(originalDigits);
    const hasUpper = /[A-F]/.test(originalDigits);
    return !(hasLower && !hasUpper);
}

/** Convert a 0–1 float channel (as used by `vscode.Color`) to a 0–255 integer. */
export function toByte(unit: number): number {
    return clampByte(Math.round(unit * 255));
}

function clampByte(n: number): number {
    return Math.min(255, Math.max(0, Math.round(n)));
}
