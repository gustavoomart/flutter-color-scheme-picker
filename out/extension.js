import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { argbFromHex, hexFromArgb, Hct, SchemeContent, SchemeExpressive, SchemeFidelity, SchemeFruitSalad, SchemeMonochrome, SchemeNeutral, SchemeRainbow, SchemeTonalSpot, SchemeVibrant } from '@material/material-color-utilities';
import { log } from 'console';
const schemeMap = {
    'content': SchemeContent,
    'expressive': SchemeExpressive,
    'fidelity': SchemeFidelity,
    "fruitSalad": SchemeFruitSalad,
    "monochrome": SchemeMonochrome,
    "neutral": SchemeNeutral,
    "rainbow": SchemeRainbow,
    'tonalSpot': SchemeTonalSpot,
    'vibrant': SchemeVibrant,
};
var activeScheme;
export async function activate(context) {
    console.log('Flutter Seed Color Scheme Picker installed successfully!');
    const setAllCommand = vscode.commands.registerCommand('flutter-color-scheme-picker.setAll', async () => {
        const config = vscode.workspace.getConfiguration('flutterTheme');
        const seedColor = await vscode.window.showInputBox({
            prompt: 'Type the seed color (ex: #FF0000, red)',
            value: config.get('seedColor') || '#FF0000',
            validateInput: (value) => {
                return /^#[0-9A-Fa-f]{6}$/.test(value) ? null : 'Invalid color. Use the format #RRGGBB.';
            }
        });
        if (!seedColor)
            return;
        const brightness = await vscode.window.showQuickPick(['dark', 'light'], {
            placeHolder: 'Choose the brightness',
        });
        if (!brightness)
            return;
        const dynamicSchemeVariant = await vscode.window.showQuickPick([
            "content",
            "expressive",
            "fidelity",
            "fruitSalad",
            "monochrome",
            "neutral",
            "rainbow",
            "tonalSpot",
            "vibrant"
        ], { placeHolder: 'Choose the dynamic scheme variant' });
        if (!dynamicSchemeVariant)
            return;
        const contrastLevelStr = await vscode.window.showInputBox({
            prompt: 'Choose the constrast level',
            value: (config.get('contrastLevel') ?? '1').toString(),
            validateInput: (value) => {
                const n = Number(value);
                if (isNaN(n)) {
                    return 'Must be a number';
                }
                else if (n > 1 || n < -1) {
                    return 'The contrast range is from -1 to 1';
                }
                return null;
            }
        });
        if (!contrastLevelStr)
            return;
        const contrastLevel = Number(contrastLevelStr);
        await config.update('seedColor', seedColor, vscode.ConfigurationTarget.Workspace);
        await config.update('brightness', brightness, vscode.ConfigurationTarget.Workspace);
        await config.update('dynamicSchemeVariant', dynamicSchemeVariant, vscode.ConfigurationTarget.Workspace);
        await config.update('contrastLevel', contrastLevel, vscode.ConfigurationTarget.Workspace);
        generateColorScheme();
    });
    const setSeedColorCommand = vscode.commands.registerCommand('flutter-color-scheme-picker.setSeedColor', async () => {
        const config = vscode.workspace.getConfiguration('flutterTheme');
        const seedColor = await vscode.window.showInputBox({
            prompt: 'Type the seed color (ex: #FF0000, red)',
            value: config.get('seedColor') || '#FF0000',
            validateInput: (value) => {
                return /^#[0-9A-Fa-f]{6}$/.test(value) ? null : 'Invalid color. Use the format #RRGGBB.';
            }
        });
        if (!seedColor)
            return;
        await config.update('seedColor', seedColor, vscode.ConfigurationTarget.Workspace);
        showParamsOnOutput();
        generateColorScheme();
    });
    const setBrightnessCommand = vscode.commands.registerCommand('flutter-color-scheme-picker.setBrightness', async () => {
        const config = vscode.workspace.getConfiguration('flutterTheme');
        const brightness = await vscode.window.showQuickPick(['dark', 'light'], {
            placeHolder: 'Choose the brightness',
        });
        if (!brightness)
            return;
        await config.update('brightness', brightness, vscode.ConfigurationTarget.Workspace);
        showParamsOnOutput();
        generateColorScheme();
    });
    const setDynamicSchemeVariantCommand = vscode.commands.registerCommand('flutter-color-scheme-picker.setDynamicSchemeVariant', async () => {
        const config = vscode.workspace.getConfiguration('flutterTheme');
        const dynamicSchemeVariant = await vscode.window.showQuickPick([
            "content",
            "expressive",
            "fidelity",
            "fruitSalad",
            "monochrome",
            "neutral",
            "rainbow",
            "tonalSpot",
            "vibrant"
        ], { placeHolder: 'Choose the dynamic scheme variant' });
        if (!dynamicSchemeVariant)
            return;
        await config.update('dynamicSchemeVariant', dynamicSchemeVariant, vscode.ConfigurationTarget.Workspace);
        showParamsOnOutput();
        generateColorScheme();
    });
    const setContrastLevel = vscode.commands.registerCommand('flutter-color-scheme-picker.setContrastLevel', async () => {
        const config = vscode.workspace.getConfiguration('flutterTheme');
        const contrastLevelStr = await vscode.window.showInputBox({
            prompt: 'Choose the constrast level',
            value: (config.get('contrastLevel') ?? '1').toString(),
            validateInput: (value) => {
                const n = Number(value);
                if (isNaN(n)) {
                    return 'Must be a number';
                }
                else if (n > 1 || n < -1) {
                    return 'The contrast range is from -1 to 1';
                }
                return null;
            }
        });
        if (!contrastLevelStr)
            return;
        const contrastLevel = Number(contrastLevelStr);
        await config.update('contrastLevel', contrastLevel, vscode.ConfigurationTarget.Workspace);
        showParamsOnOutput();
        generateColorScheme();
    });
    await generateColorScheme();
    const csProvider = vscode.languages.registerCompletionItemProvider({ language: 'dart', scheme: 'file' }, {
        provideCompletionItems(document, position) {
            const prefix = document.lineAt(position).text.substring(0, position.character);
            if (!/cs\.$/.test(prefix)) {
                return undefined;
            }
            const replaceRange = new vscode.Range(position.line, position.character - 3, position.line, position.character);
            return Object.entries(activeScheme).map(([name, hex]) => {
                const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Color);
                item.range = replaceRange;
                // 1) texto que aparece na lista
                item.label = name;
                // 2) texto usado para FILTRAR a sugestão — precisa incluir o "cs."
                item.filterText = `cs.${name}`;
                // 3) pre‐seleciona sua sugestão
                item.preselect = true;
                // 4) snippet que vai substituir "cs."
                item.insertText = new vscode.SnippetString(`Theme.of(context).colorScheme.${name}`);
                // 5) detalhe + preview
                item.detail = hex;
                const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                 <rect width="16" height="16" fill="${hex}"/>
               </svg>`;
                const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
                item.documentation = new vscode.MarkdownString(`![color](${dataUri})  \`${hex}\``);
                return item;
            });
        }
    }, '.');
    context.subscriptions.push(setAllCommand, setSeedColorCommand, setBrightnessCommand, setDynamicSchemeVariantCommand, setContrastLevel, csProvider);
}
async function generateColorScheme() {
    const config = vscode.workspace.getConfiguration('flutterTheme');
    const seedColor = config.get('seedColor');
    const brightness = config.get('brightness');
    const dynamicSchemeVariant = config.get('dynamicSchemeVariant');
    const contrastLevel = config.get('contrastLevel');
    const seedColorARGB = argbFromHex(seedColor);
    const seedHct = Hct.fromInt(seedColorARGB);
    const isDark = brightness.toLowerCase() == 'dark' ? true : false;
    const scheme = new schemeMap[dynamicSchemeVariant](seedHct, isDark, contrastLevel);
    log(`SCHEME: ${scheme.onSecondary}`);
    activeScheme = extractColorHexes(scheme);
    log(`ACTIVE_SCHEME: ${activeScheme.primary}`);
    await writeSnippets(activeScheme);
}
function extractColorHexes(scheme) {
    const result = {};
    result["primary"] = hexFromArgb(scheme.primary);
    result["onPrimary"] = hexFromArgb(scheme.onPrimary);
    result["primaryContainer"] = hexFromArgb(scheme.primaryContainer);
    result["onPrimaryContainer"] = hexFromArgb(scheme.onPrimaryContainer);
    result["primaryFixed"] = hexFromArgb(scheme.primaryFixed);
    result["primaryFixedDim"] = hexFromArgb(scheme.primaryFixedDim);
    result["onPrimaryFixed"] = hexFromArgb(scheme.onPrimaryFixed);
    result["onPrimaryFixedVariant"] = hexFromArgb(scheme.onPrimaryFixedVariant);
    result["secondary"] = hexFromArgb(scheme.secondary);
    result["onSecondary"] = hexFromArgb(scheme.onSecondary);
    result["secondaryContainer"] = hexFromArgb(scheme.secondaryContainer);
    result["onSecondaryContainer"] = hexFromArgb(scheme.onSecondaryContainer);
    result["secondaryFixed"] = hexFromArgb(scheme.secondaryFixed);
    result["secondaryFixedDim"] = hexFromArgb(scheme.secondaryFixedDim);
    result["onSecondaryFixed"] = hexFromArgb(scheme.onSecondaryFixed);
    result["onSecondaryFixedVariant"] = hexFromArgb(scheme.onSecondaryFixedVariant);
    result["tertiary"] = hexFromArgb(scheme.tertiary);
    result["onTertiary"] = hexFromArgb(scheme.onTertiary);
    result["tertiaryContainer"] = hexFromArgb(scheme.tertiaryContainer);
    result["onTertiaryContainer"] = hexFromArgb(scheme.onTertiaryContainer);
    result["tertiaryFixed"] = hexFromArgb(scheme.tertiaryFixed);
    result["tertiaryFixedDim"] = hexFromArgb(scheme.tertiaryFixedDim);
    result["onTertiaryFixed"] = hexFromArgb(scheme.onTertiaryFixed);
    result["onTertiaryFixedVariant"] = hexFromArgb(scheme.onTertiaryFixedVariant);
    result["error"] = hexFromArgb(scheme.error);
    result["onError"] = hexFromArgb(scheme.onError);
    result["errorContainer"] = hexFromArgb(scheme.errorContainer);
    result["onErrorContainer"] = hexFromArgb(scheme.onErrorContainer);
    result["surface"] = hexFromArgb(scheme.surface);
    result["onSurface"] = hexFromArgb(scheme.onSurface);
    result["surfaceDim"] = hexFromArgb(scheme.surfaceDim);
    result["surfaceBright"] = hexFromArgb(scheme.surfaceBright);
    result["surfaceContainerLowest"] = hexFromArgb(scheme.surfaceContainerLowest);
    result["surfaceContainerLow"] = hexFromArgb(scheme.surfaceContainerLow);
    result["surfaceContainer"] = hexFromArgb(scheme.surfaceContainer);
    result["surfaceContainerHigh"] = hexFromArgb(scheme.surfaceContainerHigh);
    result["surfaceContainerHighest"] = hexFromArgb(scheme.surfaceContainerHighest);
    result["onSurfaceVariant"] = hexFromArgb(scheme.onSurfaceVariant);
    result["outline"] = hexFromArgb(scheme.outline);
    result["outlineVariant"] = hexFromArgb(scheme.outlineVariant);
    result["shadow"] = hexFromArgb(scheme.shadow);
    result["scrim"] = hexFromArgb(scheme.scrim);
    result["inverseSurface"] = hexFromArgb(scheme.inverseSurface);
    result["onInverseSurface"] = hexFromArgb(scheme.inverseOnSurface);
    result["inversePrimary"] = hexFromArgb(scheme.inversePrimary);
    result["surfaceTint"] = hexFromArgb(scheme.surfaceTint);
    return result;
}
function showParamsOnOutput() {
    const config = vscode.workspace.getConfiguration('flutterTheme');
    const seedColor = config.get('seedColor');
    const brightness = config.get('brightness');
    const dynamicSchemeVariant = config.get('dynamicSchemeVariant');
    const contrastLevel = config.get('contrastLevel');
    const outputChannel = vscode.window.createOutputChannel('Flutter Theme Picker');
    outputChannel.appendLine(`Seed Color: ${seedColor}`);
    outputChannel.appendLine(`Brightness: ${brightness}`);
    outputChannel.appendLine(`Contrast Level: ${contrastLevel}`);
    outputChannel.appendLine(`Dynamic Scheme Variant: ${dynamicSchemeVariant}`);
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceFolder) {
        const rawSettingsPath = `${workspaceFolder}/.vscode/settings.json`;
        const normalizedPath = rawSettingsPath.replaceAll('\\', '/');
        outputChannel.appendLine(`Parameters saved on: ${normalizedPath}`);
    }
    outputChannel.show(true);
}
async function writeSnippets(scheme) {
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspace) {
        return;
    }
    const snippetsPath = path.join(workspace, '.vscode', 'flutter-color-scheme.code-snippets');
    const snippets = {};
    for (const [name, hex] of Object.entries(scheme)) {
        const key = name[0].toUpperCase() + name.slice(1);
        snippets[key] = {
            prefix: `cs.${name}`,
            body: [`Theme.of(context).colorScheme.${name}`],
        };
    }
    fs.mkdirSync(path.dirname(snippetsPath), { recursive: true });
    fs.writeFileSync(snippetsPath, JSON.stringify(snippets, null, 2), 'utf8');
}
export function deactivate() { }
//# sourceMappingURL=extension.js.map