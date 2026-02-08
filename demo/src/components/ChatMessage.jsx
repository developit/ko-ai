export default function ChatMessage({ message }) {
  const { role, content, toolCalls } = message;

  const roleConfig = {
    user: {
      bg: 'bg-gray-100 dark:bg-gray-700',
      text: 'text-gray-900 dark:text-gray-100',
      icon: 'mdi:account-circle',
      label: 'You',
      iconBg: 'bg-gray-200 dark:bg-gray-600',
      iconColor: 'text-gray-600 dark:text-gray-300'
    },
    assistant: {
      bg: 'bg-white dark:bg-gray-800',
      text: 'text-gray-900 dark:text-gray-100',
      icon: 'mdi:robot',
      label: 'Assistant',
      iconBg: 'bg-indigo-100 dark:bg-indigo-900/50',
      iconColor: 'text-indigo-600 dark:text-indigo-400'
    },
    system: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      text: 'text-yellow-900 dark:text-yellow-200',
      icon: 'mdi:information',
      label: 'System',
      iconBg: 'bg-yellow-100 dark:bg-yellow-800',
      iconColor: 'text-yellow-600 dark:text-yellow-400'
    }
  };

  const config = roleConfig[role] || roleConfig.assistant;

  // User messages are in a bubble on the right
  if (role === 'user') {
    return (
      <div class="flex justify-end">
        <div class={`max-w-2xl ${config.bg} ${config.text} rounded-2xl px-4 py-3 shadow-sm`}>
          <div class="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {content}
          </div>
        </div>
      </div>
    );
  }

  // Assistant and system messages take full width
  return (
    <div class="w-full">
      <div class={`${config.bg} ${config.text} py-4`}>
        <div class="flex items-start gap-3">
          <div class={`flex-shrink-0 w-7 h-7 ${config.iconBg} rounded-lg flex items-center justify-center`}>
            <iconify-icon
              icon={config.icon}
              class={config.iconColor}
              width="16"
            />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              {config.label}
            </div>

            {content && (
              <div class="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {content}
              </div>
            )}

            {toolCalls && toolCalls.length > 0 && (
              <div class="mt-3 space-y-2">
                {toolCalls.map((call, idx) => (
                  <div
                    key={idx}
                    class="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                  >
                    <div class="flex items-center gap-2 mb-2">
                      <div class="flex-shrink-0 w-6 h-6 bg-indigo-100 dark:bg-indigo-900/50 rounded flex items-center justify-center">
                        <iconify-icon icon="mdi:function-variant" class="text-indigo-600 dark:text-indigo-400" width="14" />
                      </div>
                      <span class="text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                        {call.function.name}
                      </span>
                    </div>

                    <div class="space-y-2">
                      <div>
                        <div class="flex items-center gap-1.5 mb-1">
                          <iconify-icon icon="mdi:code-braces" class="text-gray-500 dark:text-gray-400" width="12" />
                          <div class="text-xs font-medium text-gray-600 dark:text-gray-400">Arguments</div>
                        </div>
                        <pre class="bg-gray-900 dark:bg-black text-gray-100 dark:text-gray-300 p-2 rounded text-xs font-mono overflow-x-auto">
{call.function.arguments}
                        </pre>
                      </div>

                      {call.result && (
                        <div>
                          <div class="flex items-center gap-1.5 mb-1">
                            <iconify-icon icon="mdi:check-circle" class="text-emerald-500 dark:text-emerald-400" width="12" />
                            <div class="text-xs font-medium text-gray-600 dark:text-gray-400">Result</div>
                          </div>
                          <pre class="bg-gray-900 dark:bg-black text-emerald-400 dark:text-emerald-300 p-2 rounded max-h-48 overflow-y-auto text-xs font-mono">
{JSON.stringify(call.result, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
