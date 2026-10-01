import * as vscode from 'vscode';
import {
    AlphaPosition,
    LetterCase,
    findHexColors,
    formatHexColor,
    resolveUpperCase,
    toByte,
} from './hexColor';

const CONFIG_SECTION = 'colorPickerForCode';
const PICK_COMMAND = 'colorPickerForCode.pickColorAtCursor';

interface Settings {
    enabled: boolean;
    alphaPosition: AlphaPosition;
    letterCase: LetterCase;
    excludedLanguages: ReadonlySet<string>;
}

function readSettings(): Settings {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return {
        enabled: config.get<boolean>('enabled', true),
        alphaPosition: config.get<AlphaPosition>('alphaPosition', 'end'),
        letterCase: config.get<LetterCase>('letterCase', 'auto'),
        excludedLanguages: new Set(config.get<string[]>('excludedLanguages', [])),
    };
}

class HexColorProvider implements vscode.DocumentColorProvider {
    constructor(private readonly settings: Settings) {}

    provideDocumentColors(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ColorInformation[] {
        if (this.settings.excludedLanguages.has(document.languageId)) {
            return [];
        }
        const matches = findHexColors(
            document.getText(),
            this.settings.alphaPosition,
            () => token.isCancellationRequested
        );
        return matches.map(({ start, end, color }) => {
            const range = new vscode.Range(document.positionAt(start), document.positionAt(end));
            return new vscode.ColorInformation(
                range,
                new vscode.Color(color.r / 255, color.g / 255, color.b / 255, color.a / 255)
            );
        });
    }

    provideColorPresentations(
        color: vscode.Color,
        context: { readonly document: vscode.TextDocument; readonly range: vscode.Range }
    ): vscode.ColorPresentation[] {
        const original = /^(0[xX])([0-9a-fA-F]*)$/.exec(context.document.getText(context.range));
        const prefix = original?.[1] ?? '0x';
        const originalDigits = original?.[2] ?? '';

        const rgba = {
            r: toByte(color.red),
            g: toByte(color.green),
            b: toByte(color.blue),
            a: toByte(color.alpha),
        };
        const upperCase = resolveUpperCase(originalDigits, this.settings.letterCase);
        const format = (withAlpha: boolean) =>
            formatHexColor(rgba, {
                prefix,
                withAlpha,
                alphaPosition: this.settings.alphaPosition,
                upperCase,
            });

        const withAlpha = format(true);
        const withoutAlpha = format(false);

        // The first presentation is what the picker writes while you drag. Keep the literal's
        // existing shape, but never silently drop transparency. The remaining entry (if any)
        // lets you convert between 0xRRGGBB and 0xRRGGBBAA via the picker's format toggle.
        let labels: string[];
        if (rgba.a < 255) {
            labels = [withAlpha];
        } else if (originalDigits.length === 8) {
            labels = [withAlpha, withoutAlpha];
        } else {
            labels = [withoutAlpha, withAlpha];
        }
        return labels.map((label) => new vscode.ColorPresentation(label));
    }
}

async function pickColorAtCursor(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    const settings = readSettings();
    const { document, selection } = editor;
    const cursor = selection.active;

    const lineMatches = findHexColors(document.lineAt(cursor.line).text, settings.alphaPosition);
    const atCursor = lineMatches.find((m) => m.start <= cursor.character && cursor.character <= m.end);
    if (!atCursor || !settings.enabled || settings.excludedLanguages.has(document.languageId)) {
        vscode.window.showInformationMessage(
            'Color Picker For Code: put the cursor on a 0xRRGGBB or 0xRRGGBBAA value first.'
        );
        return;
    }
    if (!vscode.workspace.getConfiguration('editor', document).get<boolean>('colorDecorators', true)) {
        vscode.window.showWarningMessage(
            'Color Picker For Code: the colour picker needs "editor.colorDecorators" to be enabled.'
        );
        return;
    }
    // The colour picker lives in the editor hover, so "Show Hover" opens it on a colour.
    await vscode.commands.executeCommand('editor.action.showHover');
}

export function activate(context: vscode.ExtensionContext): void {
    let registration: vscode.Disposable | undefined;

    // DocumentColorProvider has no change event, so re-registering is how settings
    // changes (alpha position, enabled, excluded languages) refresh existing swatches.
    const register = () => {
        registration?.dispose();
        registration = undefined;
        const settings = readSettings();
        if (settings.enabled) {
            registration = vscode.languages.registerColorProvider('*', new HexColorProvider(settings));
        }
    };
    register();

    context.subscriptions.push(
        new vscode.Disposable(() => registration?.dispose()),
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration(CONFIG_SECTION)) {
                register();
            }
        }),
        vscode.commands.registerCommand(PICK_COMMAND, pickColorAtCursor)
    );
}

export function deactivate(): void {}
