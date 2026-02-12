import { useModel } from '@preact/signals';

export default function Settings({ appModel }) {
  const model = useModel(() => appModel);

  const handleSubmit = (e) => {
    e.preventDefault();
    model.saveConfig();
  };

  if (!model.showSettings.value) return null;

  return (
    <div
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in safe-area"
      onClick={() => (model.showSettings.value = false)}
    >
      <div
        class="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden transform animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative gradient header */}
        <div class="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600"></div>

        {/* Header */}
        <div class="relative px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-900/20 dark:via-purple-900/20 dark:to-pink-900/20">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-indigo-500 dark:to-purple-500 rounded-xl flex items-center justify-center shadow-md">
                <iconify-icon icon="mdi:cog" class="text-white" width="22" />
              </div>
              <div>
                <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Configuration</h2>
                <p class="text-xs text-gray-500 dark:text-gray-400">Set up your AI assistant</p>
              </div>
            </div>
            <button
              class="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-all duration-200"
              onClick={() => (model.showSettings.value = false)}
              aria-label="Close settings"
            >
              <iconify-icon icon="mdi:close" width="22" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} class="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-10rem)]">
          <div class="space-y-4">
            {/* API Key */}
            <div class="group">
              <label htmlFor="apiKey" class="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <iconify-icon icon="mdi:key" class="text-indigo-600 dark:text-indigo-400" width="16" />
                <span>API Key</span>
                <span class="text-red-500 dark:text-red-400">*</span>
              </label>
              <div class="relative">
                <input
                  id="apiKey"
                  type="password"
                  value={model.apiKey.value}
                  onInput={(e) => (model.apiKey.value = e.target.value)}
                  placeholder="sk-..."
                  required
                  class="w-full px-4 py-2.5 pl-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
                <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                  <iconify-icon icon="mdi:lock" width="16" />
                </div>
              </div>
              <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <iconify-icon icon="mdi:information-outline" width="12" />
                <span>Your OpenAI-compatible API key (stored locally)</span>
              </p>
            </div>

            {/* Base URL */}
            <div class="group">
              <label htmlFor="baseURL" class="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <iconify-icon icon="mdi:web" class="text-purple-600 dark:text-purple-400" width="16" />
                <span>Base URL</span>
                <span class="text-red-500 dark:text-red-400">*</span>
              </label>
              <div class="relative">
                <input
                  id="baseURL"
                  type="url"
                  value={model.baseURL.value}
                  onInput={(e) => (model.baseURL.value = e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  required
                  class="w-full px-4 py-2.5 pl-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 rounded-lg focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-purple-400/20 focus:border-purple-500 dark:focus:border-purple-400 transition-all text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
                <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                  <iconify-icon icon="mdi:link-variant" width="16" />
                </div>
              </div>
              <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <iconify-icon icon="mdi:information-outline" width="12" />
                <span>API endpoint base URL</span>
              </p>
            </div>

            {/* Model */}
            <div class="group">
              <label htmlFor="model" class="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <iconify-icon icon="mdi:brain" class="text-pink-600 dark:text-pink-400" width="16" />
                <span>Model</span>
                <span class="text-red-500 dark:text-red-400">*</span>
              </label>
              <div class="relative">
                <input
                  id="model"
                  type="text"
                  value={model.model.value}
                  onInput={(e) => (model.model.value = e.target.value)}
                  placeholder="gpt-4o-mini"
                  required
                  class="w-full px-4 py-2.5 pl-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 rounded-lg focus:ring-2 focus:ring-pink-500/20 dark:focus:ring-pink-400/20 focus:border-pink-500 dark:focus:border-pink-400 transition-all text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
                <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                  <iconify-icon icon="mdi:chip" width="16" />
                </div>
              </div>
              <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <iconify-icon icon="mdi:information-outline" width="12" />
                <span>Model identifier for completions</span>
              </p>
            </div>

            {/* System Instructions */}
            <div class="group">
              <label htmlFor="instructions" class="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <iconify-icon icon="mdi:text-box" class="text-violet-600 dark:text-violet-400" width="16" />
                <span>System Instructions</span>
              </label>
              <textarea
                id="instructions"
                value={model.instructions.value}
                onInput={(e) => (model.instructions.value = e.target.value)}
                rows="5"
                placeholder="You are a helpful AI assistant..."
                class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 rounded-lg focus:ring-2 focus:ring-violet-500/20 dark:focus:ring-violet-400/20 focus:border-violet-500 dark:focus:border-violet-400 transition-all resize-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 font-mono"
              />
              <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <iconify-icon icon="mdi:information-outline" width="12" />
                <span>Custom instructions for the AI assistant (respects .gitignore by default)</span>
              </p>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div class="flex items-center justify-end gap-2 px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
          <button
            type="button"
            onClick={() => (model.showSettings.value = false)}
            class="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg transition-all duration-200 flex items-center gap-2 active:scale-95"
          >
            <iconify-icon icon="mdi:close" width="16" />
            <span>Cancel</span>
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            class="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 dark:from-indigo-500 dark:via-purple-500 dark:to-pink-500 dark:hover:from-indigo-600 dark:hover:via-purple-600 dark:hover:to-pink-600 rounded-lg transition-all duration-300 flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95"
          >
            <iconify-icon icon="mdi:content-save" width="16" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>
    </div>
  );
}
