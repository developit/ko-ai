import { useModel } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { AppModel } from './models/AppModel';
import { ChatModel } from './models/ChatModel';
import Settings from './components/Settings';
import ChatMessage from './components/ChatMessage';
import './app.css';

export function App() {
  const appModel = useModel(AppModel);
  const chatModel = useModel(() => new ChatModel(appModel));
  const messagesEndRef = useRef(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatModel.messages.value.length]);

  const handleSubmit = (e) => {
    e.preventDefault();
    chatModel.sendMessage();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatModel.sendMessage();
    }
  };

  if (!appModel.isConfigured.value) {
    return (
      <div class="app">
        <div class="welcome-screen">
          <div class="welcome-content">
            <h1>🤖 AI Chat Assistant</h1>
            <p>Welcome! Please configure your API settings to get started.</p>
            <button
              class="btn-primary btn-large"
              onClick={() => (appModel.showSettings.value = true)}
            >
              Configure API Settings
            </button>
            <div class="welcome-info">
              <h3>Features:</h3>
              <ul>
                <li>💬 OpenAI-compatible streaming chat</li>
                <li>🖥️ Sandboxed bash shell with just-bash</li>
                <li>📁 File system access via File System Access API</li>
                <li>🔧 Tool calling for enhanced capabilities</li>
              </ul>
            </div>
          </div>
        </div>
        <Settings appModel={appModel} />
      </div>
    );
  }

  return (
    <div class="app">
      <header class="app-header">
        <h1>🤖 AI Chat Assistant</h1>
        <div class="header-actions">
          {chatModel.fileHandle.value && (
            <span class="directory-badge">
              📁 {chatModel.fileHandle.value.name}
            </span>
          )}
          <button
            class="btn-secondary"
            onClick={() => chatModel.clearChat()}
            disabled={chatModel.messages.value.length === 0}
          >
            Clear Chat
          </button>
          <button
            class="btn-secondary"
            onClick={() => (appModel.showSettings.value = true)}
          >
            ⚙️ Settings
          </button>
        </div>
      </header>

      <div class="chat-container">
        <div class="messages-list">
          {chatModel.messages.value.length === 0 ? (
            <div class="empty-state">
              <p>👋 Welcome! Ask me anything or request to access files.</p>
              <div class="suggestions">
                <button
                  class="suggestion-btn"
                  onClick={() => {
                    chatModel.input.value = "List the files in the virtual filesystem";
                  }}
                >
                  List files in virtual filesystem
                </button>
                <button
                  class="suggestion-btn"
                  onClick={() => {
                    chatModel.input.value = "Request access to my local files";
                  }}
                >
                  Access my local files
                </button>
                <button
                  class="suggestion-btn"
                  onClick={() => {
                    chatModel.input.value = "Show me what bash commands are available";
                  }}
                >
                  Show available bash commands
                </button>
              </div>
            </div>
          ) : (
            chatModel.messages.value.map((message, idx) => (
              <ChatMessage key={idx} message={message} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <form class="chat-input-form" onSubmit={handleSubmit}>
          <textarea
            class="chat-input"
            value={chatModel.input.value}
            onInput={(e) => (chatModel.input.value = e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Shift+Enter for new line)"
            rows="3"
            disabled={chatModel.isStreaming.value}
          />
          <button
            type="submit"
            class="btn-primary send-btn"
            disabled={!chatModel.input.value.trim() || chatModel.isStreaming.value}
          >
            {chatModel.isStreaming.value ? '...' : 'Send'}
          </button>
        </form>
      </div>

      <Settings appModel={appModel} />
    </div>
  );
}
