import { useModel } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { AppModel } from './models/AppModel';
import { ChatModel } from './models/ChatModel';
import Settings from './components/Settings';
import ChatMessage from './components/ChatMessage';

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
      <div class="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div class="text-center mb-6">
            <div class="text-6xl mb-4">🤖</div>
            <h1 class="text-3xl font-bold text-gray-900 mb-2">AI Chat Assistant</h1>
            <p class="text-gray-600">Welcome! Please configure your API settings to get started.</p>
          </div>

          <button
            class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            onClick={() => (appModel.showSettings.value = true)}
          >
            Configure API Settings
          </button>

          <div class="mt-8 text-left">
            <h3 class="text-lg font-semibold text-gray-900 mb-3">Features:</h3>
            <ul class="space-y-2 text-sm text-gray-600">
              <li class="flex items-start">
                <span class="mr-2">💬</span>
                <span>OpenAI-compatible streaming chat</span>
              </li>
              <li class="flex items-start">
                <span class="mr-2">🖥️</span>
                <span>Sandboxed bash shell with just-bash</span>
              </li>
              <li class="flex items-start">
                <span class="mr-2">📁</span>
                <span>File system access via File System Access API</span>
              </li>
              <li class="flex items-start">
                <span class="mr-2">🔧</span>
                <span>Tool calling for enhanced capabilities</span>
              </li>
            </ul>
          </div>
        </div>
        <Settings appModel={appModel} />
      </div>
    );
  }

  return (
    <div class="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header class="bg-white border-b border-gray-200 shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-16">
            <div class="flex items-center space-x-3">
              <span class="text-2xl">🤖</span>
              <h1 class="text-xl font-bold text-gray-900">AI Chat Assistant</h1>
            </div>

            <div class="flex items-center space-x-3">
              {chatModel.fileHandle.value && (
                <span class="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  📁 {chatModel.fileHandle.value.name}
                </span>
              )}
              <button
                class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => chatModel.clearChat()}
                disabled={chatModel.messages.value.length === 0}
              >
                Clear Chat
              </button>
              <button
                class="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                onClick={() => (appModel.showSettings.value = true)}
              >
                ⚙️ Settings
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Container */}
      <div class="flex-1 overflow-hidden">
        <div class="h-full max-w-5xl mx-auto flex flex-col">
          {/* Messages */}
          <div class="flex-1 overflow-y-auto px-4 py-6">
            {chatModel.messages.value.length === 0 ? (
              <div class="flex flex-col items-center justify-center h-full text-center px-4">
                <div class="max-w-2xl">
                  <div class="text-6xl mb-6">👋</div>
                  <h2 class="text-2xl font-semibold text-gray-900 mb-4">Welcome to AI Chat</h2>
                  <p class="text-gray-600 mb-8">Ask me anything or request to access files. I can help you with various tasks using bash commands and file operations.</p>

                  <div class="grid gap-3 max-w-xl mx-auto">
                    <button
                      class="text-left px-6 py-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200 shadow-sm hover:shadow-md group"
                      onClick={() => {
                        chatModel.input.value = "List the files in the virtual filesystem";
                      }}
                    >
                      <div class="font-medium text-gray-900 group-hover:text-indigo-600">List files in virtual filesystem</div>
                      <div class="text-sm text-gray-500 mt-1">See what's available in the sandboxed environment</div>
                    </button>
                    <button
                      class="text-left px-6 py-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200 shadow-sm hover:shadow-md group"
                      onClick={() => {
                        chatModel.input.value = "Request access to my local files";
                      }}
                    >
                      <div class="font-medium text-gray-900 group-hover:text-indigo-600">Access my local files</div>
                      <div class="text-sm text-gray-500 mt-1">Grant access to read and write local files</div>
                    </button>
                    <button
                      class="text-left px-6 py-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200 shadow-sm hover:shadow-md group"
                      onClick={() => {
                        chatModel.input.value = "Show me what bash commands are available";
                      }}
                    >
                      <div class="font-medium text-gray-900 group-hover:text-indigo-600">Show available bash commands</div>
                      <div class="text-sm text-gray-500 mt-1">Explore the sandboxed bash environment capabilities</div>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div class="space-y-4">
                {chatModel.messages.value.map((message, idx) => (
                  <ChatMessage key={idx} message={message} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Form */}
          <div class="border-t border-gray-200 bg-white px-4 py-4">
            <form onSubmit={handleSubmit} class="max-w-4xl mx-auto">
              <div class="flex gap-3">
                <textarea
                  class="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                  value={chatModel.input.value}
                  onInput={(e) => (chatModel.input.value = e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message... (Shift+Enter for new line)"
                  rows="3"
                  disabled={chatModel.isStreaming.value}
                />
                <button
                  type="submit"
                  class="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed self-end"
                  disabled={!chatModel.input.value.trim() || chatModel.isStreaming.value}
                >
                  {chatModel.isStreaming.value ? (
                    <div class="flex items-center space-x-2">
                      <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Sending...</span>
                    </div>
                  ) : (
                    'Send'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <Settings appModel={appModel} />
    </div>
  );
}
