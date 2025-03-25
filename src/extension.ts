// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import vscode from 'vscode';
import {parseMwFile} from './paserser.ts';
import path from 'path';
import {JSDOM} from 'jsdom';
import fs from 'fs';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

type Snippet = {
    label: string,
    wordMatch: string,
    insertText: string,
    detail: string,
    detailHeader: string
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context:vscode.ExtensionContext) {
    let panel:vscode.WebviewPanel; // Store the webview panel
    let doc_panel:vscode.WebviewPanel;
    // Load snippets.json
    const snippetsPath = path.join(context.extensionPath, 'media', 'snippets.json');
    let snippets: Snippet[] = [];
    try {
        const data = fs.readFileSync(snippetsPath, 'utf8');
        snippets = JSON.parse(data);
    } catch (error) {
        console.error("Error reading snippets.json:", error);
    }

    let disposable = vscode.commands.registerCommand('mwPreview.start', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor found.");
            return;
        }

        const document = editor.document;
        if (document.languageId !== 'mw') {
            vscode.window.showErrorMessage("This is not a .mw file.");
            return;
        }

        try {
            const parsedContent = await parseMwFile(document.uri.fsPath);
            panel = createPreviewPanel(parsedContent, context, `Myrimark Preview [${path.basename(document.fileName)}]`);
        } catch (error) {
            console.error("Failed to parse .mw file:", error);
        }
    });

    // Listen for file changes
    let onchange_disposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
        if (panel && event.document.languageId === 'mw') {
            const parsedContent = await parseMwFile(event.document.uri.fsPath);
            panel.webview.html = getWebviewContent(parsedContent, panel, context);
        }
    });

    let open_docs_disposable = vscode.commands.registerCommand('mwPreview.documentation', async () => {
        try {
            doc_panel = createPreviewPanel(
                await parseMwFile(path.join(context.extensionPath, 'media', 'help.mw')), 
                context, "Myrimark Packaged Documentation");
        } catch (error) {
            console.error("Failed to open Packaged Help: ", error);
        }
    });

    context.subscriptions.push(disposable, onchange_disposable, open_docs_disposable);
    
    // Register completion provider
    const completionProvider = vscode.languages.registerCompletionItemProvider(
        'mw',
        {
            provideCompletionItems(document, position, token, context) {
                return snippets.map(snippet => {
                    const item = new vscode.CompletionItem(snippet.label, vscode.CompletionItemKind.Snippet);
                    item.insertText = new vscode.SnippetString(snippet.insertText);
                    item.detail = snippet.detail;
                    return item;
                });
            }
        },
        "$", ":", '\\' // Triggers
    );

    // Register hover provider
    const hoverProvider = vscode.languages.registerHoverProvider('mw', {
        provideHover(document, position, token) {
            const range = document.getWordRangeAtPosition(position);
            if (!range) return;

            const word = document.getText(range);
            //const snippet = snippets.find(s => { s.wordMatch === word });
            let snippet;
            for (const snip of snippets) {
                if (snip.wordMatch == word) { snippet = snip; break; }
                else snippet = null;
            }
            if (snippet) {
                return new vscode.Hover(new vscode.MarkdownString(`\`\`\`${(snippet.detailHeader) ? snippet.detailHeader : snippet.label}\`\`\`\n\n${snippet.detail}`));
            }
        }
    });

    context.subscriptions.push(completionProvider, hoverProvider);
}

/**
 * @param {string} content
 * @param {vscode.ExtensionContext} context
 */
function createPreviewPanel(content:string, context:vscode.ExtensionContext, title:string): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
        'mwPreview', // Internal ID
        title, // Title
        vscode.ViewColumn.Beside, // Open beside the editor
        {
            enableScripts: true, // Allows JavaScript execution
            localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
        }
    );

    // Load HTML content
    panel.webview.html = getWebviewContent(content, panel, context);
    panel.iconPath = vscode.Uri.file(path.join(context.extensionPath, 'media', 'MyrimarkLangIcon.svg'));

    return panel;
}

/**
 * 
 * @param {string} content 
 * @param {vscode.ExtensionContext} context 
 * @returns {string}
 */
function getWebviewContent(content, panel, context) {
    //const scriptUri = vscode.Uri.file(path.join(context.extensionPath, 'media', 'preview.js')).with({ scheme: 'vscode-resource' });
    //const styleUri = vscode.Uri.file(path.join(context.extensionPath, 'media', 'myrimark.css')).with({ scheme: 'vscode-resource' });
	const styleUri = panel.webview.asWebviewUri(
        vscode.Uri.file(path.join(context.extensionPath, 'media', 'myrimark.css'))
    );
	//const scriptUri = vscode.Uri.file(path.join(context.extensionPath, 'media', 'page.js')).with({ scheme: 'vscode-resource' });
    const html = `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>MW Preview</title>
		<link rel="stylesheet" type="text/css" href="${styleUri}">
	</head>
	<body>
		<div class="myrimark-container"></div>
	</body>
	</html>`;
	const dom = new JSDOM(html);
	dom.window.document.querySelector('div.myrimark-container').append(content);
	const ret = dom.window.document.documentElement.outerHTML;
	return ret;
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
