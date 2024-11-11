// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { SidebarProvider } from './SideBarProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "tte" is now active!');

	if (vscode.workspace.getConfiguration().get<string>('tte.serverUrl') === "" || vscode.workspace.getConfiguration().get<string>('tte.token') === "") {
		const message = vscode.l10n.t('No TimeTagger Server configured. Please set the server URL in the settings.');
		const openSettings = vscode.l10n.t('To Settings');
		vscode.window.showInformationMessage(message, openSettings).then((selection) => {
			if (selection === openSettings) {
				vscode.commands.executeCommand('workbench.action.openSettings', 'tte.serverUrl && tte.token');
			}
		});
	}

	// Register the Sidebar Panel
	const sidebarProvider = new SidebarProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			"tte-sidebar",
			sidebarProvider
		)
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
