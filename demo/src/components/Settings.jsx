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
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm"
      onClick={() => (model.showSettings.value = false)}
    >
      <div
        class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <h2 class="text-2xl font-bold text-gray-900">⚙️ Configuration</h2>
          <button
            class="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-white rounded-lg"
            onClick={() => (model.showSettings.value = false)}
            aria-label="Close settings"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} class="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-8rem)]">
          <div class="space-y-4">
            <div>
              <label htmlFor="apiKey" class="block text-sm font-semibold text-gray-700 mb-2">
                API Key <span class="text-red-500">*</span>
              </label>
              <input
                id="apiKey"
                type="password"
                value={model.apiKey.value}
                onInput={(e) => (model.apiKey.value = e.target.value)}
                placeholder="sk-..."
                required
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
              <p class="mt-1 text-xs text-gray-500">Your OpenAI-compatible API key</p>
            </div>

            <div>
              <label htmlFor="baseURL" class="block text-sm font-semibold text-gray-700 mb-2">
                Base URL <span class="text-red-500">*</span>
              </label>
              <input
                id="baseURL"
                type="url"
                value={model.baseURL.value}
                onInput={(e) => (model.baseURL.value = e.target.value)}
                placeholder="https://api.openai.com/v1"
                required
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
              <p class="mt-1 text-xs text-gray-500">API endpoint base URL</p>
            </div>

            <div>
              <label htmlFor="model" class="block text-sm font-semibold text-gray-700 mb-2">
                Model <span class="text-red-500">*</span>
              </label>
              <input
                id="model"
                type="text"
                value={model.model.value}
                onInput={(e) => (model.model.value = e.target.value)}
                placeholder="gpt-4o-mini"
                required
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
              <p class="mt-1 text-xs text-gray-500">Model name to use for completions</p>
            </div>

            <div>
              <label htmlFor="instructions" class="block text-sm font-semibold text-gray-700 mb-2">
                System Instructions
              </label>
              <textarea
                id="instructions"
                value={model.instructions.value}
                onInput={(e) => (model.instructions.value = e.target.value)}
                rows="5"
                placeholder="You are a helpful AI assistant..."
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
              />
              <p class="mt-1 text-xs text-gray-500">Custom instructions for the AI assistant</p>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={() => (model.showSettings.value = false)}
            class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            class="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all shadow-lg hover:shadow-xl"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
