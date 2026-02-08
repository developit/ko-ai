import { useModel } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { AppModel } from './models/AppModel';
import { ChatModel } from './models/ChatModel';
import Settings from './components/Settings';
import ChatMessage from './components/ChatMessage';
import FileTreeViewer from './components/FileTreeViewer';
import 'iconify-icon';

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
      <div class="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Animated background orbs */}
        <div class="absolute inset-0 overflow-hidden">
          <div class="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div class="absolute top-0 -right-4 w-72 h-72 bg-violet-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div class="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>

        <div class="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-10 max-w-md w-full border border-white/20">
          <div class="text-center mb-8">
            <div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl mb-4 shadow-lg">
              <iconify-icon icon="mdi:robot-happy" class="text-white" width="48" />
            </div>
            <h1 class="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-3">
              AI Chat Assistant
            </h1>
            <p class="text-gray-600 text-lg">
              Configure your API settings to unlock the full potential of AI
            </p>
          </div>

          <button
            class="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 flex items-center justify-center gap-3"
            onClick={() => (appModel.showSettings.value = true)}
          >
            <iconify-icon icon="mdi:cog" width="24" />
            <span>Configure API Settings</span>
          </button>

          <div class="mt-10 space-y-4">
            <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Powerful Features
            </h3>
            <div class="space-y-3">
              <div class="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50">
                <div class="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <iconify-icon icon="mdi:message-text" class="text-indigo-600" width="18" />
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-900">Streaming Chat</p>
                  <p class="text-xs text-gray-500">OpenAI-compatible real-time responses</p>
                </div>
              </div>
              <div class="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50">
                <div class="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <iconify-icon icon="mdi:console" class="text-purple-600" width="18" />
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-900">Bash Shell</p>
                  <p class="text-xs text-gray-500">Sandboxed command execution</p>
                </div>
              </div>
              <div class="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-pink-50 to-indigo-50">
                <div class="flex-shrink-0 w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center">
                  <iconify-icon icon="mdi:folder-open" class="text-pink-600" width="18" />
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-900">File System Access</p>
                  <p class="text-xs text-gray-500">Read and write local files securely</p>
                </div>
              </div>
              <div class="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-violet-50 to-indigo-50">
                <div class="flex-shrink-0 w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                  <iconify-icon icon="mdi:function" class="text-violet-600" width="18" />
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-900">Tool Calling</p>
                  <p class="text-xs text-gray-500">Enhanced AI capabilities</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Settings appModel={appModel} />
      </div>
    );
  }

  return (
    <div class="h-screen flex bg-gray-50">
      {/* Sidebar with File Tree */}
      <aside class="w-80 bg-white border-r border-gray-200 flex flex-col shadow-lg">
        <div class="p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div class="flex items-center gap-3 mb-3">
            <div class="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <iconify-icon icon="mdi:robot-happy" class="text-white" width="24" />
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent truncate">
                AI Assistant
              </h2>
              <p class="text-xs text-gray-500">Powered by koai</p>
            </div>
          </div>

          {chatModel.fileHandle.value ? (
            <div class="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-indigo-200 shadow-sm">
              <iconify-icon icon="mdi:folder-open" class="text-indigo-600 flex-shrink-0" width="18" />
              <span class="text-sm font-medium text-gray-900 truncate">
                {chatModel.fileHandle.value.name}
              </span>
            </div>
          ) : (
            <button
              class="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
              onClick={() => chatModel.requestDirectoryAccess()}
            >
              <iconify-icon icon="mdi:folder-plus" width="18" />
              <span>Select Directory</span>
            </button>
          )}
        </div>

        <div class="flex-1 overflow-hidden">
          <FileTreeViewer fileHandle={chatModel.fileHandle.value} />
        </div>

        <div class="p-4 border-t border-gray-200 bg-gray-50">
          <button
            class="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
            onClick={() => (appModel.showSettings.value = true)}
          >
            <iconify-icon icon="mdi:cog" width="18" />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main class="flex-1 flex flex-col">
        {/* Header */}
        <header class="bg-white border-b border-gray-200 shadow-sm backdrop-blur-sm">
          <div class="px-6 py-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <h1 class="text-xl font-bold text-gray-900">Chat</h1>
                {chatModel.messages.value.length > 0 && (
                  <span class="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                    {chatModel.messages.value.length} message{chatModel.messages.value.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <button
                class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow"
                onClick={() => chatModel.clearChat()}
                disabled={chatModel.messages.value.length === 0}
              >
                <iconify-icon icon="mdi:trash-can-outline" width="18" />
                <span>Clear Chat</span>
              </button>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div class="flex-1 overflow-y-auto px-6 py-6">
          {chatModel.messages.value.length === 0 ? (
            <div class="flex flex-col items-center justify-center h-full text-center max-w-3xl mx-auto">
              <div class="mb-8 relative">
                <div class="absolute inset-0 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full blur-2xl opacity-30"></div>
                <div class="relative w-24 h-24 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl">
                  <iconify-icon icon="mdi:robot-happy" class="text-white" width="56" />
                </div>
              </div>

              <h2 class="text-3xl font-bold text-gray-900 mb-3">Welcome to AI Chat</h2>
              <p class="text-gray-600 text-lg mb-12 max-w-2xl">
                I'm your AI assistant with access to file operations and bash commands. How can I help you today?
              </p>

              <div class="grid gap-4 w-full max-w-2xl">
                <button
                  class="group text-left px-6 py-5 bg-white border-2 border-gray-200 hover:border-indigo-300 rounded-2xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:-translate-y-1"
                  onClick={() => {
                    chatModel.input.value = "List the files in the virtual filesystem";
                  }}
                >
                  <div class="flex items-start gap-4">
                    <div class="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <iconify-icon icon="mdi:folder-search" class="text-indigo-600" width="24" />
                    </div>
                    <div class="flex-1">
                      <div class="font-semibold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">
                        List Virtual Files
                      </div>
                      <div class="text-sm text-gray-500">
                        Explore the sandboxed filesystem environment
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  class="group text-left px-6 py-5 bg-white border-2 border-gray-200 hover:border-purple-300 rounded-2xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:-translate-y-1"
                  onClick={() => {
                    chatModel.input.value = "Request access to my local files";
                  }}
                >
                  <div class="flex items-start gap-4">
                    <div class="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <iconify-icon icon="mdi:folder-key" class="text-purple-600" width="24" />
                    </div>
                    <div class="flex-1">
                      <div class="font-semibold text-gray-900 mb-1 group-hover:text-purple-600 transition-colors">
                        Access Local Files
                      </div>
                      <div class="text-sm text-gray-500">
                        Grant permission to read and write your files
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  class="group text-left px-6 py-5 bg-white border-2 border-gray-200 hover:border-pink-300 rounded-2xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:-translate-y-1"
                  onClick={() => {
                    chatModel.input.value = "Show me what bash commands are available";
                  }}
                >
                  <div class="flex items-start gap-4">
                    <div class="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-pink-100 to-indigo-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <iconify-icon icon="mdi:console-line" class="text-pink-600" width="24" />
                    </div>
                    <div class="flex-1">
                      <div class="font-semibold text-gray-900 mb-1 group-hover:text-pink-600 transition-colors">
                        Bash Commands
                      </div>
                      <div class="text-sm text-gray-500">
                        Discover available shell commands and utilities
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div class="max-w-4xl mx-auto space-y-6">
              {chatModel.messages.value.map((message, idx) => (
                <ChatMessage key={idx} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div class="border-t border-gray-200 bg-white/80 backdrop-blur-lg px-6 py-4 shadow-lg">
          <form onSubmit={handleSubmit} class="max-w-4xl mx-auto">
            <div class="flex gap-3">
              <div class="flex-1 relative">
                <textarea
                  class="w-full resize-none rounded-2xl border-2 border-gray-200 px-5 py-4 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 disabled:bg-gray-50 disabled:text-gray-500 transition-all shadow-sm"
                  value={chatModel.input.value}
                  onInput={(e) => (chatModel.input.value = e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message... (Shift+Enter for new line)"
                  rows="1"
                  style={{ minHeight: '56px', maxHeight: '200px' }}
                  disabled={chatModel.isStreaming.value}
                />
              </div>
              <button
                type="submit"
                class="px-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-2xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                disabled={!chatModel.input.value.trim() || chatModel.isStreaming.value}
                style={{ minHeight: '56px' }}
              >
                {chatModel.isStreaming.value ? (
                  <>
                    <iconify-icon icon="mdi:loading" class="animate-spin" width="20" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <iconify-icon icon="mdi:send" width="20" />
                    <span>Send</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      <Settings appModel={appModel} />
    </div>
  );
}
