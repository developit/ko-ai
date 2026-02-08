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
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
      onClick={() => (model.showSettings.value = false)}
    >
      <div
        class="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden transform animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative gradient header */}
        <div class="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600"></div>

        {/* Header */}
        <div class="relative px-8 py-6 border-b border-gray-200 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <iconify-icon icon="mdi:cog" class="text-white" width="28" />
              </div>
              <div>
                <h2 class="text-2xl font-bold text-gray-900">Configuration</h2>
                <p class="text-sm text-gray-500">Set up your AI assistant</p>
              </div>
            </div>
            <button
              class="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-all duration-200"
              onClick={() => (model.showSettings.value = false)}
              aria-label="Close settings"
            >
              <iconify-icon icon="mdi:close" width="24" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} class="p-8 space-y-6 overflow-y-auto max-h-[calc(90vh-12rem)]">
          <div class="space-y-6">
            {/* API Key */}
            <div class="group">
              <label htmlFor="apiKey" class="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                <iconify-icon icon="mdi:key" class="text-indigo-600" width="18" />
                <span>API Key</span>
                <span class="text-red-500">*</span>
              </label>
              <div class="relative">
                <input
                  id="apiKey"
                  type="password"
                  value={model.apiKey.value}
                  onInput={(e) => (model.apiKey.value = e.target.value)}
                  placeholder="sk-..."
                  required
                  class="w-full px-5 py-3.5 pl-12 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-gray-900 placeholder-gray-400 shadow-sm"
                />
                <div class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <iconify-icon icon="mdi:lock" width="18" />
                </div>
              </div>
              <p class="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
                <iconify-icon icon="mdi:information-outline" width="14" />
                <span>Your OpenAI-compatible API key (stored locally)</span>
              </p>
            </div>

            {/* Base URL */}
            <div class="group">
              <label htmlFor="baseURL" class="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                <iconify-icon icon="mdi:web" class="text-purple-600" width="18" />
                <span>Base URL</span>
                <span class="text-red-500">*</span>
              </label>
              <div class="relative">
                <input
                  id="baseURL"
                  type="url"
                  value={model.baseURL.value}
                  onInput={(e) => (model.baseURL.value = e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  required
                  class="w-full px-5 py-3.5 pl-12 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-gray-900 placeholder-gray-400 shadow-sm"
                />
                <div class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <iconify-icon icon="mdi:link-variant" width="18" />
                </div>
              </div>
              <p class="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
                <iconify-icon icon="mdi:information-outline" width="14" />
                <span>API endpoint base URL</span>
              </p>
            </div>

            {/* Model */}
            <div class="group">
              <label htmlFor="model" class="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                <iconify-icon icon="mdi:brain" class="text-pink-600" width="18" />
                <span>Model</span>
                <span class="text-red-500">*</span>
              </label>
              <div class="relative">
                <input
                  id="model"
                  type="text"
                  value={model.model.value}
                  onInput={(e) => (model.model.value = e.target.value)}
                  placeholder="gpt-4o-mini"
                  required
                  class="w-full px-5 py-3.5 pl-12 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-gray-900 placeholder-gray-400 shadow-sm"
                />
                <div class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <iconify-icon icon="mdi:chip" width="18" />
                </div>
              </div>
              <p class="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
                <iconify-icon icon="mdi:information-outline" width="14" />
                <span>Model identifier for completions</span>
              </p>
            </div>

            {/* System Instructions */}
            <div class="group">
              <label htmlFor="instructions" class="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                <iconify-icon icon="mdi:text-box" class="text-violet-600" width="18" />
                <span>System Instructions</span>
              </label>
              <textarea
                id="instructions"
                value={model.instructions.value}
                onInput={(e) => (model.instructions.value = e.target.value)}
                rows="6"
                placeholder="You are a helpful AI assistant..."
                class="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-violet-500/20 focus:border-violet-500 transition-all resize-none text-gray-900 placeholder-gray-400 shadow-sm font-mono text-sm"
              />
              <p class="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
                <iconify-icon icon="mdi:information-outline" width="14" />
                <span>Custom instructions for the AI assistant (respects .gitignore by default)</span>
              </p>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div class="flex items-center justify-end gap-3 px-8 py-6 border-t border-gray-200 bg-gray-50/50 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => (model.showSettings.value = false)}
            class="px-6 py-3 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-100 border-2 border-gray-300 rounded-xl transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow"
          >
            <iconify-icon icon="mdi:close" width="18" />
            <span>Cancel</span>
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            class="px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <iconify-icon icon="mdi:content-save" width="18" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>
    </div>
  );
}
