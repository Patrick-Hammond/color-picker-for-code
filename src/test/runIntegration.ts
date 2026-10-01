/**
 * Launches a real VS Code with this extension loaded and runs ./integration/index.
 *
 * By default @vscode/test-electron downloads a VS Code build. To use an existing install
 * instead, set VSCODE_EXECUTABLE_PATH (e.g. "C:\Program Files\Microsoft VS Code\Code.exe").
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'color-picker-for-code-'));
    try {
        await runTests({
            vscodeExecutablePath: process.env.VSCODE_EXECUTABLE_PATH,
            extensionDevelopmentPath: path.resolve(__dirname, '..', '..'),
            extensionTestsPath: path.resolve(__dirname, 'integration', 'index'),
            launchArgs: [
                '--disable-extensions',
                '--disable-workspace-trust',
                '--user-data-dir',
                path.join(sandbox, 'user-data'),
                '--extensions-dir',
                path.join(sandbox, 'extensions'),
            ],
        });
    } finally {
        // On Windows VS Code can still hold the folder for a moment after exiting; cleanup is best-effort.
        try {
            fs.rmSync(sandbox, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
        } catch {
            console.warn(`Could not remove temporary folder ${sandbox}`);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
