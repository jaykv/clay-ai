import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { isProxyServerRunning, isMCPServerRunning } from '../commands';

// Cache for HTML content to avoid reading from disk repeatedly
interface HtmlCache {
  html: string;
  jsUri: string;
  cssUri: string;
  timestamp: number;
}

/**
 * Manages the webview panel for the AI Tools Dashboard with optimized loading
 */
export class OptimizedWebviewProvider {
  public static readonly viewType = 'aiToolsDashboard';
  private static panel: vscode.WebviewPanel | undefined;
  private static extensionUri: vscode.Uri;
  private static htmlCache: HtmlCache | null = null;
  private static readonly CACHE_TTL = 1000 * 60 * 5; // 5 minutes cache TTL

  /**
   * Send a message to the webview
   */
  public static postMessage(message: any): Thenable<boolean> | boolean {
    if (this.panel) {
      return this.panel.webview.postMessage(message);
    }
    return false;
  }

  /**
   * Send the current server status to the webview
   */
  private static sendServerStatus(): void {
    // Send proxy server status
    this.postMessage({
      command: 'serverStatus',
      server: 'proxy',
      status: isProxyServerRunning() ? 'running' : 'stopped'
    });

    // Send MCP server status
    this.postMessage({
      command: 'serverStatus',
      server: 'mcp',
      status: isMCPServerRunning() ? 'running' : 'stopped'
    });
  }

  /**
   * Creates and shows the webview panel, or reveals it if it already exists
   */
  public static createOrShow(extensionUri: vscode.Uri) {
    // Save the extension URI for later use
    this.extensionUri = extensionUri;

    // If we already have a panel, show it
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      this.viewType,
      'AI Tools Dashboard',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'webview-ui'),
          vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist'),
          vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist', 'assets')
        ]
      }
    );

    this.panel = panel;

    // Set the webview's initial html content
    panel.webview.html = this.getHtmlForWebview(panel.webview, extensionUri);

    // Listen for when the panel is disposed
    panel.onDidDispose(() => {
      this.panel = undefined;
      // Clear the cache when the panel is disposed
      this.htmlCache = null;
    }, null, []);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
      message => {
        console.log('Received message from webview:', message);
        switch (message.command) {
          case 'alert':
            vscode.window.showErrorMessage(message.text);
            return;
          case 'startProxyServer':
            vscode.commands.executeCommand('ai-tools.startProxyServer')
              .then(() => this.sendServerStatus());
            return;
          case 'stopProxyServer':
            vscode.commands.executeCommand('ai-tools.stopProxyServer')
              .then(() => this.sendServerStatus());
            return;
          case 'startMCPServer':
            vscode.commands.executeCommand('ai-tools.startMCPServer')
              .then(() => this.sendServerStatus());
            return;
          case 'stopMCPServer':
            vscode.commands.executeCommand('ai-tools.stopMCPServer')
              .then(() => this.sendServerStatus());
            return;
          case 'openRoutesManager':
            vscode.commands.executeCommand('ai-tools.openRoutesManager');
            return;
          case 'refresh':
            // Clear the cache and refresh the webview content
            this.htmlCache = null;
            panel.webview.html = this.getHtmlForWebview(panel.webview, extensionUri);
            return;
          case 'getServerStatus':
            // Send the current server status
            this.sendServerStatus();
            return;
        }
      },
      undefined,
      []
    );

    // Send initial server status
    this.sendServerStatus();
  }

  /**
   * Gets the HTML content for the webview
   */
  private static getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    try {
      const now = Date.now();

      // Check if we have a valid cache
      if (this.htmlCache &&
          now - this.htmlCache.timestamp < this.CACHE_TTL &&
          this.htmlCache.html) {
        console.log('Using cached HTML content for webview');
        return this.htmlCache.html;
      }

      console.log('Generating fresh HTML content for webview');

      // Path to the webview UI dist directory
      const webviewUiDistPath = path.join(extensionUri.fsPath, 'webview-ui', 'dist');
      const indexHtmlPath = path.join(webviewUiDistPath, 'index.html');

      // Check if index.html exists
      if (!fs.existsSync(indexHtmlPath)) {
        return this.getErrorHtml(`Cannot find index.html at ${indexHtmlPath}`);
      }

      // Get the JS file path (required)
      const jsFilePath = path.join(webviewUiDistPath, 'assets', 'index.js');

      // Check if JS file exists (this is required)
      if (!fs.existsSync(jsFilePath)) {
        return this.getErrorHtml(`Missing required JavaScript asset at ${jsFilePath}`);
      }

      // Get the CSS file path (might be inlined in JS with Vite)
      const cssFilePath = path.join(webviewUiDistPath, 'assets', 'index.css');
      const cssExists = fs.existsSync(cssFilePath);

      // Log for debugging
      console.log(`CSS file exists: ${cssExists}, path: ${cssFilePath}`);
      console.log(`JS file exists: true, path: ${jsFilePath}`);

      // Create webview URIs for the assets
      const cssUri = webview.asWebviewUri(vscode.Uri.file(cssFilePath)).toString();
      const jsUri = webview.asWebviewUri(vscode.Uri.file(jsFilePath)).toString();

      // Read the index.html file
      let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

      // Replace the asset references in the HTML
      indexHtml = indexHtml.replace(/src="\.\/(assets\/index\.js)"/, `src="${jsUri}"`);
      indexHtml = indexHtml.replace(/href="\.\/(assets\/index\.css)"/, `href="${cssUri}"`);

      // Add CSP
      const nonce = this.getNonce();
      indexHtml = indexHtml.replace(/<head>/, `<head>
        <meta http-equiv="Content-Security-Policy" content="default-src 'self' ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' ${webview.cspSource}; img-src ${webview.cspSource} data:; font-src ${webview.cspSource}; connect-src 'self' http://localhost:* https://localhost:*; ">`);

      // Add nonce to scripts
      indexHtml = indexHtml.replace(/<script/g, `<script nonce="${nonce}"`);

      // Cache the HTML content
      this.htmlCache = {
        html: indexHtml,
        jsUri,
        cssUri,
        timestamp: now
      };

      return indexHtml;
    } catch (error) {
      console.error('Error generating webview HTML:', error);
      return this.getErrorHtml(`Error generating webview HTML: ${error}`);
    }
  }

  /**
   * Creates a simple error HTML page
   */
  private static getErrorHtml(errorMessage: string): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Error</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          color: #333;
        }
        .error {
          color: #d32f2f;
          background-color: #ffebee;
          padding: 10px;
          border-radius: 4px;
          border-left: 4px solid #d32f2f;
        }
        h1 {
          color: #d32f2f;
        }
        button {
          background-color: #1976d2;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 20px;
        }
        button:hover {
          background-color: #1565c0;
        }
      </style>
    </head>
    <body>
      <h1>Error Loading Dashboard</h1>
      <div class="error">
        <p>${errorMessage}</p>
      </div>
      <p>Please try reloading the extension or check the developer console for more information.</p>
      <button onclick="reload()">Reload</button>
      <script>
        function reload() {
          // Send a message to the extension to refresh the webview
          const vscode = acquireVsCodeApi();
          vscode.postMessage({ command: 'refresh' });
        }
      </script>
    </body>
    </html>`;
  }

  /**
   * Generates a nonce string for CSP
   */
  private static getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
