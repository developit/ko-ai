export default function ChatMessage({ message }) {
  const { role, content, toolCalls } = message;

  const roleConfig = {
    user: {
      gradient: 'from-indigo-600 to-purple-600',
      bg: 'bg-gradient-to-r from-indigo-600 to-purple-600',
      text: 'text-white',
      icon: 'mdi:account-circle',
      label: 'You',
      align: 'justify-end'
    },
    assistant: {
      gradient: 'from-gray-100 to-gray-50',
      bg: 'bg-white',
      text: 'text-gray-900',
      icon: 'mdi:robot-happy',
      label: 'Assistant',
      align: 'justify-start',
      border: 'border-2 border-gray-200'
    },
    system: {
      gradient: 'from-yellow-50 to-amber-50',
      bg: 'bg-yellow-50',
      text: 'text-yellow-900',
      icon: 'mdi:information',
      label: 'System',
      align: 'justify-center'
    }
  };

  const config = roleConfig[role] || roleConfig.assistant;

  return (
    <div class={`flex ${config.align}`}>
      <div class={`max-w-3xl ${config.bg} ${config.text} rounded-3xl px-6 py-4 shadow-lg ${config.border || ''} transition-all duration-300 hover:shadow-xl`}>
        <div class="flex items-center gap-3 mb-3">
          <div class={`flex-shrink-0 w-8 h-8 ${role === 'user' ? 'bg-white/20' : 'bg-gradient-to-br from-indigo-100 to-purple-100'} rounded-full flex items-center justify-center`}>
            <iconify-icon
              icon={config.icon}
              class={role === 'user' ? 'text-white' : 'text-indigo-600'}
              width="18"
            />
          </div>
          <span class="text-xs font-bold uppercase tracking-wider opacity-75">
            {config.label}
          </span>
        </div>

        {content && (
          <div class="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
            {content}
          </div>
        )}

        {toolCalls && toolCalls.length > 0 && (
          <div class="mt-4 space-y-3">
            {toolCalls.map((call, idx) => (
              <div
                key={idx}
                class="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-4 border-2 border-slate-200 shadow-inner"
              >
                <div class="flex items-center gap-2 mb-3">
                  <div class="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center shadow-md">
                    <iconify-icon icon="mdi:function-variant" class="text-white" width="16" />
                  </div>
                  <span class="text-sm font-bold text-indigo-700">
                    {call.function.name}
                  </span>
                </div>

                <div class="space-y-3">
                  <div>
                    <div class="flex items-center gap-2 mb-2">
                      <iconify-icon icon="mdi:code-braces" class="text-slate-500" width="14" />
                      <div class="text-xs font-semibold text-slate-600 uppercase tracking-wide">Arguments</div>
                    </div>
                    <pre class="bg-slate-900 text-slate-100 p-3 rounded-xl overflow-x-auto text-xs font-mono shadow-inner border border-slate-700">
{call.function.arguments}
                    </pre>
                  </div>

                  {call.result && (
                    <div>
                      <div class="flex items-center gap-2 mb-2">
                        <iconify-icon icon="mdi:check-circle" class="text-emerald-500" width="14" />
                        <div class="text-xs font-semibold text-slate-600 uppercase tracking-wide">Result</div>
                      </div>
                      <pre class="bg-slate-900 text-emerald-400 p-3 rounded-xl overflow-x-auto max-h-60 overflow-y-auto text-xs font-mono shadow-inner border border-slate-700">
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
  );
}
