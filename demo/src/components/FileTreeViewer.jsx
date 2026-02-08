import { signal } from '@preact/signals';
import { useState, useEffect } from 'preact/hooks';

export default function FileTreeViewer({ fileHandle }) {
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [collapsedDirs, setCollapsedDirs] = useState(new Set());

  useEffect(() => {
    if (fileHandle) {
      loadDirectoryTree();
    } else {
      setTree(null);
    }
  }, [fileHandle]);

  const loadDirectoryTree = async () => {
    setLoading(true);
    setError(null);
    try {
      const tree = await buildTree(fileHandle, '');
      setTree(tree);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const buildTree = async (handle, path) => {
    const node = {
      name: handle.name,
      path: path || handle.name,
      kind: handle.kind,
      children: []
    };

    if (handle.kind === 'directory') {
      try {
        const entries = [];
        for await (const entry of handle.values()) {
          entries.push(entry);
        }

        // Sort: directories first, then files, both alphabetically
        entries.sort((a, b) => {
          if (a.kind !== b.kind) {
            return a.kind === 'directory' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

        for (const entry of entries) {
          const childPath = path ? `${path}/${entry.name}` : entry.name;
          if (entry.kind === 'directory') {
            // For directories, just add metadata without loading children yet
            node.children.push({
              name: entry.name,
              path: childPath,
              kind: 'directory',
              children: [],
              handle: entry
            });
          } else {
            node.children.push({
              name: entry.name,
              path: childPath,
              kind: 'file',
              handle: entry
            });
          }
        }
      } catch (err) {
        console.error('Error reading directory:', err);
      }
    }

    return node;
  };

  const toggleDirectory = async (path, node) => {
    const newCollapsed = new Set(collapsedDirs);

    if (newCollapsed.has(path)) {
      newCollapsed.delete(path);
    } else {
      newCollapsed.add(path);
    }

    setCollapsedDirs(newCollapsed);

    // Lazy load children if expanding and not loaded
    if (!newCollapsed.has(path) && node.children.length === 0 && node.handle) {
      const updatedTree = await loadDirectoryChildren(tree, path, node.handle);
      setTree({ ...updatedTree });
    }
  };

  const loadDirectoryChildren = async (treeNode, targetPath, handle) => {
    if (treeNode.path === targetPath) {
      const fullNode = await buildTree(handle, targetPath);
      return { ...treeNode, children: fullNode.children };
    }

    if (treeNode.children) {
      const newChildren = await Promise.all(
        treeNode.children.map(child =>
          loadDirectoryChildren(child, targetPath, handle)
        )
      );
      return { ...treeNode, children: newChildren };
    }

    return treeNode;
  };

  const renderTreeNode = (node, depth = 0) => {
    const isCollapsed = collapsedDirs.has(node.path);
    const hasChildren = node.kind === 'directory';
    const paddingLeft = depth * 16 + 12;

    return (
      <div key={node.path}>
        <div
          class={`flex items-center py-1.5 px-3 hover:bg-gray-100 cursor-pointer rounded-lg transition-colors group ${
            hasChildren ? 'font-medium' : ''
          }`}
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={() => hasChildren && toggleDirectory(node.path, node)}
        >
          {hasChildren && (
            <iconify-icon
              icon={isCollapsed ? 'mdi:chevron-right' : 'mdi:chevron-down'}
              class="text-gray-500 mr-1 transition-transform"
              width="18"
            />
          )}
          <iconify-icon
            icon={
              hasChildren
                ? isCollapsed
                  ? 'mdi:folder'
                  : 'mdi:folder-open'
                : getFileIcon(node.name)
            }
            class={`mr-2 ${hasChildren ? 'text-blue-500' : 'text-gray-600'}`}
            width="18"
          />
          <span class="text-sm text-gray-900 truncate">{node.name}</span>
        </div>
        {/* Smart rendering: only render children if not collapsed */}
        {hasChildren && !isCollapsed && node.children && (
          <div>
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
      js: 'vscode-icons:file-type-js',
      jsx: 'vscode-icons:file-type-reactjs',
      ts: 'vscode-icons:file-type-typescript',
      tsx: 'vscode-icons:file-type-reactts',
      json: 'vscode-icons:file-type-json',
      md: 'vscode-icons:file-type-markdown',
      css: 'vscode-icons:file-type-css',
      html: 'vscode-icons:file-type-html',
      py: 'vscode-icons:file-type-python',
      java: 'vscode-icons:file-type-java',
      go: 'vscode-icons:file-type-go',
      rs: 'vscode-icons:file-type-rust',
      txt: 'mdi:file-document-outline',
      pdf: 'mdi:file-pdf-box',
      png: 'mdi:file-image',
      jpg: 'mdi:file-image',
      jpeg: 'mdi:file-image',
      gif: 'mdi:file-image',
      svg: 'mdi:file-image',
    };
    return iconMap[ext] || 'mdi:file-outline';
  };

  if (!fileHandle) {
    return (
      <div class="flex flex-col items-center justify-center h-full text-center p-6">
        <iconify-icon
          icon="mdi:folder-open-outline"
          class="text-gray-300 mb-4"
          width="64"
        />
        <p class="text-sm text-gray-500">No directory selected</p>
        <p class="text-xs text-gray-400 mt-1">
          Request directory access to view files
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div class="flex items-center justify-center h-full">
        <div class="flex flex-col items-center">
          <iconify-icon
            icon="mdi:loading"
            class="text-indigo-600 animate-spin mb-2"
            width="32"
          />
          <p class="text-sm text-gray-600">Loading directory...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div class="flex flex-col items-center justify-center h-full text-center p-6">
        <iconify-icon
          icon="mdi:alert-circle-outline"
          class="text-red-500 mb-4"
          width="48"
        />
        <p class="text-sm text-red-600 font-medium">Error loading directory</p>
        <p class="text-xs text-gray-500 mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div class="h-full overflow-y-auto py-2">
      {tree && renderTreeNode(tree)}
    </div>
  );
}
