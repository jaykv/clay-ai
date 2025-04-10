import React from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { postMessage } from '@/utils/vscode';

const AugmentContextEngine: React.FC = () => {
  // Function to trigger VS Code commands
  const executeCommand = (command: string) => {
    postMessage({ command });
  };

  return (
    <Card title="Augment Context Engine">
      <div className="space-y-6">
        <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
          <h3 className="font-medium mb-2">Search Codebase</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Search your entire codebase for specific code patterns, functions, or text.
          </p>
          <div className="flex items-center space-x-2">
            <Button 
              onClick={() => executeCommand('clay.searchCodebase')}
              leftIcon={<span className="material-icons text-sm">search</span>}
            >
              Search Codebase
            </Button>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Keyboard: Ctrl+Shift+F / Cmd+Shift+F (Mac)
            </div>
          </div>
        </div>

        <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
          <h3 className="font-medium mb-2">Symbol Navigation</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Navigate to symbol definitions and find references across your codebase.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Button 
                onClick={() => executeCommand('clay.getSymbolDefinition')}
                variant="secondary"
                className="w-full"
                leftIcon={<span className="material-icons text-sm">code</span>}
              >
                Go to Definition
              </Button>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                Ctrl+Shift+G / Cmd+Shift+G (Mac)
              </div>
            </div>
            <div>
              <Button 
                onClick={() => executeCommand('clay.findReferences')}
                variant="secondary"
                className="w-full"
                leftIcon={<span className="material-icons text-sm">link</span>}
              >
                Find References
              </Button>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                Ctrl+Shift+R / Cmd+Shift+R (Mac)
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
          <h3 className="font-medium mb-2">Codebase Indexing</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Manage the codebase index used by the Augment Context Engine.
          </p>
          <div className="flex items-center space-x-2">
            <Button 
              onClick={() => executeCommand('clay.reindexCodebase')}
              variant="secondary"
              leftIcon={<span className="material-icons text-sm">refresh</span>}
            >
              Reindex Codebase
            </Button>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Keyboard: Ctrl+Shift+I / Cmd+Shift+I (Mac)
            </div>
          </div>
        </div>

        <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <h3 className="font-medium mb-2 text-blue-700 dark:text-blue-400">About Augment Context Engine</h3>
          <p className="text-sm text-blue-600 dark:text-blue-300 mb-2">
            The Augment Context Engine provides powerful code intelligence features to help you navigate and understand your codebase.
          </p>
          <ul className="list-disc list-inside text-sm text-blue-600 dark:text-blue-300 space-y-1">
            <li>Intelligent code search across your entire codebase</li>
            <li>Symbol definition and reference finding</li>
            <li>Integration with VS Code's language services</li>
            <li>Available as an MCP tool for AI extensions</li>
          </ul>
        </div>
      </div>
    </Card>
  );
};

export default AugmentContextEngine;
