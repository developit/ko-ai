# AI Chat Assistant Demo

A full-featured AI chat application built with Preact, demonstrating the power of **ko-ai** (a minimalist OpenAI-compatible streaming client) combined with:

- 🖥️ **just-bash**: Sandboxed bash environment for safe command execution
- 📁 **File System Access API**: Browser-native file operations
- 🔧 **Tool Calling**: AI agent capabilities with custom tools
- 💬 **Streaming Responses**: Real-time AI interactions
- 🎨 **Preact Models**: Modern state management with signals

## Features

### 🤖 AI Chat
- OpenAI-compatible streaming chat interface
- Multi-turn conversations with context
- Support for any OpenAI-compatible endpoint (OpenAI, OpenRouter, Ollama, etc.)

### 🛠️ Tool Integration
- **Bash Command Execution**: Run bash commands in a safe, sandboxed environment
- **File Operations**: Read, write, and list files from the user's local filesystem (with permission)
- **Real-time Tool Feedback**: See tool calls and results in the chat

### 🏗️ Built with Modern Tech
- **Preact**: Lightweight React alternative (~3KB)
- **Preact Models**: New state management pattern using signals
- **Vite**: Lightning-fast dev server and build tool
- **ko-ai**: Zero-dependency OpenAI client (~1.5KB gzipped)
- **just-bash**: Browser-compatible bash interpreter

## Quick Start

### Prerequisites

- Node.js 18+ or npm
- An OpenAI-compatible API endpoint and key

### Installation

```bash
cd demo-app
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view it in the browser.

### Build for Production

```bash
npm run build
```

The build output will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Configuration

On first launch, you'll be prompted to configure:

1. **API Key**: Your OpenAI API key (or compatible provider)
2. **Base URL**: API endpoint (default: https://api.openai.com/v1)
3. **Model**: Model name (e.g., gpt-4o-mini, gpt-4, etc.)
4. **System Instructions**: Custom system prompt for the AI

Configuration is saved in localStorage and can be changed anytime via the Settings button.

## Usage Examples

### Bash Commands
```
User: List all files in the virtual filesystem
AI: *executes bash tool with 'ls -la'*
```

### File Operations
```
User: Request access to my local files
AI: *requests directory access via File System Access API*

User: Read the contents of README.md
AI: *reads file using the read_file tool*
```

### Combined Operations
```
User: Create a JSON file with my project structure
AI: *uses bash to explore, then writes a JSON file*
```

## Architecture

### Preact Models
The app uses Preact Models for state management, providing reactive state with a clean class-based API:

```javascript
// AppModel.js - Configuration state
const AppModel = createModel(function AppModel() {
  this.apiKey = signal('');
  this.baseURL = signal('');
  // ... methods and computed values
});

// ChatModel.js - Chat state and logic
const ChatModel = createModel(function ChatModel(appModel) {
  this.messages = signal([]);
  this.sendMessage = async () => { /* ... */ };
});
```

### Tool Architecture
Tools are defined as functions that the AI can call:

- **bash**: Execute commands in just-bash sandbox
- **request_directory_access**: Request file system permissions
- **read_file**: Read files from user's filesystem
- **write_file**: Write files to user's filesystem
- **list_files**: List directory contents

### Component Structure
```
src/
├── models/
│   ├── AppModel.js      # App configuration state
│   └── ChatModel.js     # Chat and AI interaction logic
├── components/
│   ├── Settings.jsx     # Configuration modal
│   ├── ChatMessage.jsx  # Message display with tool calls
│   └── *.css           # Component styles
├── app.jsx             # Main app component
└── main.jsx            # Entry point
```

## Security

- **Sandboxed Bash**: just-bash provides a fully sandboxed environment with no access to the real filesystem
- **Permission-based File Access**: File System Access API requires explicit user permission
- **No Arbitrary Code Execution**: All tools are pre-defined and controlled
- **API Key Security**: Keys are stored in localStorage (client-side only)

## Browser Support

The File System Access API requires a modern browser:
- Chrome/Edge 86+
- Opera 72+
- Safari 15.2+ (partial support)

The bash tool (just-bash) works in all modern browsers.

## Learn More

- [ko-ai](https://github.com/developit/ko-ai) - The streaming AI client
- [just-bash](https://github.com/vercel-labs/just-bash) - Sandboxed bash for JavaScript
- [Preact](https://preactjs.com) - Fast 3KB alternative to React
- [Preact Signals](https://preactjs.com/guide/v10/signals/) - Reactive state management
- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) - Browser filesystem access

## License

MIT
