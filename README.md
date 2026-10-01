# Color Picker For Code

Colour swatches and a visual colour picker for hex colour literals written as `0xRRGGBB` or `0xRRGGBBAA`, in **any language** (C, C++, C#, Java, Kotlin, JavaScript, Python, Lua, GDScript, Rust, plain text, …).

```cpp
Color red   = 0xFF0000;      // swatch ■ — click it to open the picker
Color tint  = 0x3399FF80;    // 8 digits: alpha is part of the picker
```

## How it works

Every `0x` literal with exactly **6 or 8 hex digits** gets a colour swatch in the editor. Click (or hover) the swatch to open VS Code's built-in colour picker, drag around, and the number in your source is rewritten live.

- **Alpha** – the picker has an alpha slider. Lowering alpha on a 6-digit value upgrades it to 8 digits (`0xFF8800` → `0xFF880080`); an 8-digit value stays 8 digits even at full opacity.
- **Convert between forms** – use the picker's format toggle (the button in its header) to switch a value between `0xRRGGBB` and `0xRRGGBBAA`.
- **Keyboard** – put the cursor on a value and run **Color Picker For Code: Pick Color at Cursor** from the Command Palette. (You can bind it to a key in *Keyboard Shortcuts*.)
- The `0x`/`0X` prefix and the case of the letters are preserved (see `letterCase`).

What counts as a colour: `0x` followed by exactly 6 or 8 hex digits, not glued to an identifier, so `0xFFF`, `0xFFFFFFF`, `0xFF_FF_FF`, `0xFF'FF'FF` and `foo0xFFFFFF` are ignored. Integer suffixes are fine (`0xFF0000u`, `0xFFFFFFFFUL`) and are left untouched when the picker edits the value.

> **Heads-up:** any 6- or 8-digit hex number looks like a colour, so things like `0xDEADBEEF` will get a swatch too. Use `excludedLanguages` to switch the extension off for languages where that is noisy.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `colorPickerForCode.enabled` | `true` | Turn detection and the picker on or off. |
| `colorPickerForCode.alphaPosition` | `"end"` | `"end"` → `0xRRGGBBAA` (CSS-style). `"start"` → `0xAARRGGBB` (Android / Flutter / .NET style). |
| `colorPickerForCode.letterCase` | `"auto"` | Letters written by the picker: `"auto"` matches the value being edited (upper-case when it has no letters), or force `"upper"` / `"lower"`. |
| `colorPickerForCode.excludedLanguages` | `[]` | Language ids (e.g. `["plaintext", "log"]`) in which 0x literals are not treated as colours. |

The swatches rely on VS Code's own `editor.colorDecorators` setting (on by default); `editor.colorDecoratorsActivatedOn` controls whether a click, a hover, or either opens the picker.

## Development

```bash
npm install
npm run compile            # build to ./out
npm run test:unit          # pure parsing/formatting tests (node:test)
npm run test:integration   # launches a real VS Code and drives the colour provider
npm run package            # produces color-picker-for-code-<version>.vsix
```

Press **F5** in VS Code to launch an Extension Development Host, then open `examples/demo.cpp`.

`test:integration` downloads a VS Code build on first run. To use an installed one instead, set `VSCODE_EXECUTABLE_PATH` to its `Code.exe` / `code` binary.

To install the packaged extension: *Extensions view → … menu → Install from VSIX…*, or `code --install-extension color-picker-for-code-0.1.0.vsix`.

Before publishing to the Marketplace, change `publisher` in `package.json` to your own publisher id and add a `repository` and `LICENSE`.
