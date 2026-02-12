import { useSignal } from '@preact/signals';
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
  const sidebarOpen = useSignal(false);

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

  const toggleSidebar = () => {
    sidebarOpen.value = !sidebarOpen.value;
  };

  const closeSidebar = () => {
    sidebarOpen.value = false;
  };

  if (!appModel.isConfigured.value) {
    return (
      <div class="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Animated background orbs */}
        <div class="absolute inset-0 overflow-hidden">
          <div class="absolute top-0 -left-4 w-72 h-72 bg-purple-500 dark:bg-purple-900 rounded-full mix-blend-multiply dark:mix-blend-lighten filter blur-xl opacity-70 dark:opacity-30 animate-blob"></div>
          <div class="absolute top-0 -right-4 w-72 h-72 bg-violet-500 dark:bg-violet-900 rounded-full mix-blend-multiply dark:mix-blend-lighten filter blur-xl opacity-70 dark:opacity-30 animate-blob animation-delay-2000"></div>
          <div class="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-500 dark:bg-indigo-900 rounded-full mix-blend-multiply dark:mix-blend-lighten filter blur-xl opacity-70 dark:opacity-30 animate-blob animation-delay-4000"></div>
        </div>

        <div class="relative bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-3xl shadow-2xl p-6 sm:p-10 max-w-md w-full border border-white/20 dark:border-gray-700/50">
          <div class="text-center mb-6 sm:mb-8">
            <div class="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-indigo-500 dark:to-purple-500 rounded-2xl mb-4 shadow-lg">
              <iconify-icon icon="mdi:robot-happy" class="text-white" width="40" />
            </div>
            <h1 class="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent mb-3">
              AI Chat Assistant
            </h1>
            <p class="text-gray-600 dark:text-gray-300 text-base sm:text-lg">
              Configure your API settings to unlock the full potential of AI
            </p>
          </div>

          <button
            class="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 dark:from-indigo-500 dark:via-purple-500 dark:to-pink-500 dark:hover:from-indigo-600 dark:hover:via-purple-600 dark:hover:to-pink-600 text-white font-semibold py-3 sm:py-4 px-6 rounded-xl transition-all duration-300 shadow-xl hover:shadow-2xl active:scale-95 flex items-center justify-center gap-3"
            onClick={() => (appModel.showSettings.value = true)}
          >
            <iconify-icon icon="mdi:cog" width="24" />
            <span>Configure API Settings</span>
          </button>

          <div class="mt-8 sm:mt-10 space-y-4">
            <h3 class="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Powerful Features
            </h3>
            <div class="space-y-3">
              <div class="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
                <div class="flex-shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-800 rounded-lg flex items-center justify-center">
                  <iconify-icon icon="mdi:message-text" class="text-indigo-600 dark:text-indigo-400" width="18" />
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">Streaming Chat</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">OpenAI-compatible real-time responses</p>
                </div>
              </div>
              <div class="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                <div class="flex-shrink-0 w-8 h-8 bg-purple-100 dark:bg-purple-800 rounded-lg flex items-center justify-center">
                  <iconify-icon icon="mdi:console" class="text-purple-600 dark:text-purple-400" width="18" />
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">Bash Shell</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Sandboxed command execution</p>
                </div>
              </div>
              <div class="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-pink-50 to-indigo-50 dark:from-pink-900/20 dark:to-indigo-900/20">
                <div class="flex-shrink-0 w-8 h-8 bg-pink-100 dark:bg-pink-800 rounded-lg flex items-center justify-center">
                  <iconify-icon icon="mdi:folder-open" class="text-pink-600 dark:text-pink-400" width="18" />
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">File System Access</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Read and write local files securely</p>
                </div>
              </div>
              <div class="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20">
                <div class="flex-shrink-0 w-8 h-8 bg-violet-100 dark:bg-violet-800 rounded-lg flex items-center justify-center">
                  <iconify-icon icon="mdi:function" class="text-violet-600 dark:text-violet-400" width="18" />
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">Tool Calling</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Enhanced AI capabilities</p>
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
    <div class="h-screen flex bg-gray-50 dark:bg-gray-900 relative">
      {/* Mobile overlay for sidebar */}
      {sidebarOpen.value && (
        <div
          class="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar with File Tree */}
      <aside class={`
        fixed lg:relative
        w-80 h-full
        bg-white dark:bg-gray-800
        border-r border-gray-200 dark:border-gray-700
        flex flex-col
        shadow-2xl lg:shadow-lg
        z-50 lg:z-auto
        transition-transform duration-300 ease-in-out
        ${sidebarOpen.value ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div class="p-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 safe-top">
          <div class="flex items-center gap-2 mb-2">
            <button
              class="lg:hidden p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors"
              onClick={closeSidebar}
              aria-label="Close sidebar"
            >
              <iconify-icon icon="mdi:close" width="20" />
            </button>
            <div class="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-indigo-500 dark:to-purple-500 rounded-lg flex items-center justify-center shadow-md">
              <iconify-icon icon="mdi:robot" class="text-white" width="18" />
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="text-base font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent truncate">
                AI Assistant
              </h2>
              <p class="text-xs text-gray-500 dark:text-gray-400">Powered by koai</p>
            </div>
          </div>

          {chatModel.fileHandle.value ? (
            <div class="flex items-center gap-2 px-2 py-1.5 bg-white dark:bg-gray-700 rounded-lg border border-indigo-200 dark:border-indigo-700 shadow-sm">
              <iconify-icon icon="mdi:folder-open" class="text-indigo-600 dark:text-indigo-400 flex-shrink-0" width="16" />
              <span class="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                {chatModel.fileHandle.value.name}
              </span>
            </div>
          ) : (
            <button
              class="w-full flex items-center justify-center gap-2 px-2 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 dark:from-indigo-500 dark:to-purple-500 dark:hover:from-indigo-600 dark:hover:to-purple-600 text-white text-xs font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
              onClick={() => chatModel.requestDirectoryAccess()}
            >
              <iconify-icon icon="mdi:folder-plus" width="16" />
              <span>Select Directory</span>
            </button>
          )}
        </div>

        <div class="flex-1 overflow-hidden">
          <FileTreeViewer fileHandle={chatModel.fileHandle.value} />
        </div>

        <div class="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 safe-bottom">
          <button
            class="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors active:scale-95"
            onClick={() => (appModel.showSettings.value = true)}
          >
            <iconify-icon icon="mdi:cog" width="16" />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main class="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm safe-top">
          <div class="px-4 py-3 flex items-center gap-3">
            <button
              class="lg:hidden p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors active:scale-95"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
            >
              <iconify-icon icon="mdi:menu" width="24" />
            </button>

            <div class="flex-1 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <h1 class="text-lg font-bold text-gray-900 dark:text-gray-100">Chat</h1>
                {chatModel.messages.value.length > 0 && (
                  <span class="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-full">
                    {chatModel.messages.value.length}
                  </span>
                )}
              </div>

              <button
                class="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow active:scale-95"
                onClick={() => chatModel.clearChat()}
                disabled={chatModel.messages.value.length === 0}
              >
                <iconify-icon icon="mdi:trash-can-outline" width="16" />
                <span class="hidden sm:inline">Clear</span>
              </button>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div class="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide">
          {chatModel.messages.value.length === 0 ? (
            <div class="flex flex-col items-center justify-center h-full text-center px-4 max-w-3xl mx-auto">
              <div class="mb-6 sm:mb-8 relative">
                <div class="absolute inset-0 bg-gradient-to-r from-indigo-400 to-purple-400 dark:from-indigo-600 dark:to-purple-600 rounded-full blur-2xl opacity-30"></div>
                <div class="relative w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-indigo-500 dark:to-purple-500 rounded-3xl flex items-center justify-center shadow-2xl">
                  <iconify-icon icon="mdi:robot-happy" class="text-white" width="48" />
                </div>
              </div>

              <h2 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">Welcome to AI Chat</h2>
              <p class="text-gray-600 dark:text-gray-400 text-base sm:text-lg mb-8 sm:mb-12 max-w-2xl">
                I'm your AI assistant with access to file operations and bash commands. How can I help you today?
              </p>

              <div class="grid gap-3 sm:gap-4 w-full max-w-2xl">
                <button
                  class="group text-left px-4 sm:px-6 py-4 sm:py-5 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 rounded-xl sm:rounded-2xl transition-all duration-300 shadow-md hover:shadow-xl active:scale-98"
                  onClick={() => {
                    chatModel.input.value = "List the files in the virtual filesystem";
                  }}
                >
                  <div class="flex items-start gap-3 sm:gap-4">
                    <div class="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <iconify-icon icon="mdi:folder-search" class="text-indigo-600 dark:text-indigo-400" width="20" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold text-gray-900 dark:text-gray-100 mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-sm sm:text-base">
                        List Virtual Files
                      </div>
                      <div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        Explore the sandboxed filesystem environment
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  class="group text-left px-4 sm:px-6 py-4 sm:py-5 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 rounded-xl sm:rounded-2xl transition-all duration-300 shadow-md hover:shadow-xl active:scale-98"
                  onClick={() => {
                    chatModel.input.value = "Request access to my local files";
                  }}
                >
                  <div class="flex items-start gap-3 sm:gap-4">
                    <div class="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/50 dark:to-pink-900/50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <iconify-icon icon="mdi:folder-key" class="text-purple-600 dark:text-purple-400" width="20" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold text-gray-900 dark:text-gray-100 mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors text-sm sm:text-base">
                        Access Local Files
                      </div>
                      <div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        Grant permission to read and write your files
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  class="group text-left px-4 sm:px-6 py-4 sm:py-5 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-pink-300 dark:hover:border-pink-600 rounded-xl sm:rounded-2xl transition-all duration-300 shadow-md hover:shadow-xl active:scale-98"
                  onClick={() => {
                    chatModel.input.value = "Show me what bash commands are available";
                  }}
                >
                  <div class="flex items-start gap-3 sm:gap-4">
                    <div class="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-pink-100 to-indigo-100 dark:from-pink-900/50 dark:to-indigo-900/50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <iconify-icon icon="mdi:console-line" class="text-pink-600 dark:text-pink-400" width="20" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold text-gray-900 dark:text-gray-100 mb-1 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors text-sm sm:text-base">
                        Bash Commands
                      </div>
                      <div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        Discover available shell commands and utilities
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div class="max-w-4xl mx-auto space-y-3">
              {chatModel.messages.value.map((message, idx) => (
                <ChatMessage key={idx} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div class="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 shadow-lg safe-bottom">
          <form onSubmit={handleSubmit} class="max-w-4xl mx-auto">
            <div class="flex gap-2">
              <div class="flex-1 relative">
                <textarea
                  class="w-full resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-indigo-500 dark:focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 transition-all"
                  value={chatModel.input.value}
                  onInput={(e) => (chatModel.input.value = e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message... (Shift+Enter for new line)"
                  rows="1"
                  style={{ minHeight: '44px', maxHeight: '150px' }}
                  disabled={chatModel.isStreaming.value}
                />
              </div>
              <button
                type="submit"
                class="px-4 sm:px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 dark:from-indigo-500 dark:to-purple-500 dark:hover:from-indigo-600 dark:hover:to-purple-600 text-white text-sm font-semibold rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:focus:ring-indigo-400/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2"
                disabled={!chatModel.input.value.trim() || chatModel.isStreaming.value}
                style={{ minHeight: '44px' }}
              >
                {chatModel.isStreaming.value ? (
                  <>
                    <iconify-icon icon="mdi:loading" class="animate-spin" width="18" />
                    <span class="hidden sm:inline">Sending</span>
                  </>
                ) : (
                  <>
                    <iconify-icon icon="mdi:send" width="18" />
                    <span class="hidden sm:inline">Send</span>
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
