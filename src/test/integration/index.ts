/**
 * Runs inside the VS Code extension host. Uses the same built-in commands the editor's
 * colour decorators / colour picker use, so a pass here means the real picker gets the
 * right swatches and writes back the right text.
 */
import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

const EXTENSION_ID = 'local.color-picker-for-code';
const CONFIG = 'colorPickerForCode';

const SAMPLE = [
    'const a = 0xFF8800;',
    'const b = 0x11223344;',
    'const c = 0xabcdef;',
    'const d = 0xFFF;', // wrong length: ignored
    'const e = 0xFFFFFFFFF;', // wrong length: ignored
].join('\n');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor<T>(read: () => Thenable<T>, done: (value: T) => boolean): Promise<T> {
    let value = await read();
    for (let i = 0; i < 40 && !done(value); i++) {
        await sleep(100);
        value = await read();
    }
    return value;
}

async function openSample(language = 'javascript', content = SAMPLE): Promise<vscode.TextDocument> {
    return vscode.workspace.openTextDocument({ language, content });
}

const colorsOf = (doc: vscode.TextDocument) =>
    vscode.commands.executeCommand<vscode.ColorInformation[]>('vscode.executeDocumentColorProvider', doc.uri);

async function presentationsFor(
    doc: vscode.TextDocument,
    info: vscode.ColorInformation,
    color: vscode.Color = info.color
): Promise<string[]> {
    const result = await vscode.commands.executeCommand<vscode.ColorPresentation[]>(
        'vscode.executeColorPresentationProvider',
        color,
        { uri: doc.uri, range: info.range }
    );
    return result.map((p) => p.label);
}

const setConfig = (key: string, value: unknown) =>
    vscode.workspace.getConfiguration(CONFIG).update(key, value, vscode.ConfigurationTarget.Global);

const byte = (n: number) => Math.round(n * 255);

const tests: Array<[string, () => Promise<void>]> = [
    [
        'detects 0xRRGGBB and 0xRRGGBBAA literals and nothing else',
        async () => {
            const doc = await openSample();
            const colors = await waitFor(() => colorsOf(doc), (c) => c.length > 0);
            assert.deepEqual(
                colors.map((c) => doc.getText(c.range)),
                ['0xFF8800', '0x11223344', '0xabcdef']
            );
            const [a, b] = colors;
            assert.deepEqual([byte(a.color.red), byte(a.color.green), byte(a.color.blue), byte(a.color.alpha)], [255, 136, 0, 255]);
            assert.deepEqual([byte(b.color.red), byte(b.color.green), byte(b.color.blue), byte(b.color.alpha)], [0x11, 0x22, 0x33, 0x44]);
        },
    ],
    [
        'works in any language, including plain text',
        async () => {
            for (const language of ['plaintext', 'cpp', 'json', 'python']) {
                const doc = await openSample(language, 'x = 0x00FF00');
                const colors = await waitFor(() => colorsOf(doc), (c) => c.length > 0);
                assert.equal(colors.length, 1, language);
            }
        },
    ],
    [
        'picker on a 6-digit value writes 6 digits, keeping the original letter case',
        async () => {
            const doc = await openSample();
            const [a, , c] = await colorsOf(doc);
            assert.deepEqual(await presentationsFor(doc, a, new vscode.Color(1, 0, 1, 1)), ['0xFF00FF', '0xFF00FFFF']);
            assert.deepEqual(await presentationsFor(doc, c, new vscode.Color(1, 0, 1, 1)), ['0xff00ff', '0xff00ffff']);
        },
    ],
    [
        'lowering alpha on a 6-digit value upgrades it to 8 digits',
        async () => {
            const doc = await openSample();
            const [a] = await colorsOf(doc);
            assert.deepEqual(await presentationsFor(doc, a, new vscode.Color(1, 0, 0, 128 / 255)), ['0xFF000080']);
        },
    ],
    [
        'an 8-digit value stays 8 digits even at full opacity',
        async () => {
            const doc = await openSample();
            const [, b] = await colorsOf(doc);
            assert.deepEqual(await presentationsFor(doc, b, new vscode.Color(0, 0, 1, 1)), ['0x0000FFFF', '0x0000FF']);
        },
    ],
    [
        'alphaPosition=start reads and writes 0xAARRGGBB',
        async () => {
            try {
                await setConfig('alphaPosition', 'start');
                const doc = await openSample();
                const [, b] = await waitFor(
                    () => colorsOf(doc),
                    (c) => c.length > 1 && byte(c[1].color.alpha) === 0x11
                );
                assert.deepEqual([byte(b.color.alpha), byte(b.color.red), byte(b.color.green), byte(b.color.blue)], [0x11, 0x22, 0x33, 0x44]);
                assert.deepEqual(await presentationsFor(doc, b, new vscode.Color(1, 0, 0, 128 / 255)), ['0x80FF0000']);
            } finally {
                await setConfig('alphaPosition', undefined);
            }
        },
    ],
    [
        'letterCase=lower / upper override the original literal',
        async () => {
            try {
                const doc = await openSample();
                const [a, , c] = await colorsOf(doc);
                await setConfig('letterCase', 'lower');
                assert.equal((await waitFor(() => presentationsFor(doc, a, new vscode.Color(1, 0, 1, 1)), (p) => p[0] === '0xff00ff'))[0], '0xff00ff');
                await setConfig('letterCase', 'upper');
                assert.equal((await waitFor(() => presentationsFor(doc, c, new vscode.Color(1, 0, 1, 1)), (p) => p[0] === '0xFF00FF'))[0], '0xFF00FF');
            } finally {
                await setConfig('letterCase', undefined);
            }
        },
    ],
    [
        'excludedLanguages hides swatches for that language only',
        async () => {
            try {
                await setConfig('excludedLanguages', ['plaintext']);
                const plain = await openSample('plaintext', 'x = 0x00FF00');
                const js = await openSample('javascript', 'x = 0x00FF00');
                await waitFor(() => colorsOf(plain), (c) => c.length === 0);
                assert.equal((await colorsOf(plain)).length, 0);
                assert.equal((await colorsOf(js)).length, 1);
            } finally {
                await setConfig('excludedLanguages', undefined);
            }
        },
    ],
    [
        'enabled=false removes the swatches and enabled=true brings them back',
        async () => {
            try {
                const doc = await openSample();
                await setConfig('enabled', false);
                assert.equal((await waitFor(() => colorsOf(doc), (c) => c.length === 0)).length, 0);
            } finally {
                await setConfig('enabled', undefined);
            }
            const doc = await openSample();
            assert.equal((await waitFor(() => colorsOf(doc), (c) => c.length === 3)).length, 3);
        },
    ],
    [
        'the "Pick Color at Cursor" command is registered and safe to run off a colour',
        async () => {
            assert.ok((await vscode.commands.getCommands(true)).includes('colorPickerForCode.pickColorAtCursor'));
            const doc = await openSample('javascript', 'no colours here');
            await vscode.window.showTextDocument(doc);
            await vscode.commands.executeCommand('colorPickerForCode.pickColorAtCursor');
        },
    ],
];

export async function run(): Promise<void> {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(extension, `extension ${EXTENSION_ID} not found`);
    await extension.activate();

    let failures = 0;
    for (const [name, body] of tests) {
        try {
            await body();
            console.log(`  ✔ ${name}`);
        } catch (error) {
            failures++;
            console.error(`  ✘ ${name}\n${error instanceof Error ? error.stack : error}`);
        }
    }
    console.log(`\n${tests.length - failures}/${tests.length} integration tests passed`);
    if (failures > 0) {
        throw new Error(`${failures} integration test(s) failed`);
    }
}
