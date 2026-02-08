export default function ChatMessage({ message }) {
  const { role, content, toolCalls } = message;

  const roleStyles = {
    user: 'bg-indigo-600 text-white',
    assistant: 'bg-white text-gray-900 border border-gray-200',
    system: 'bg-yellow-50 text-yellow-900 border border-yellow-200'
  };

  const roleLabels = {
    user: 'You',
    assistant: 'Assistant',
    system: 'System'
  };

  return (
    <div class={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div class={`max-w-3xl rounded-2xl px-6 py-4 shadow-sm ${roleStyles[role] || roleStyles.assistant}`}>
        <div class="flex items-center mb-2">
          <span class="text-xs font-semibold uppercase tracking-wide opacity-75">
            {roleLabels[role] || role}
          </span>
        </div>

        {content && (
          <div class="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {content}
          </div>
        )}

        {toolCalls && toolCalls.length > 0 && (
          <div class="mt-3 space-y-2">
            {toolCalls.map((call, idx) => (
              <div key={idx} class="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div class="flex items-center mb-2">
                  <span class="text-xs font-semibold text-indigo-600">
                    🔧 {call.function.name}
                  </span>
                </div>

                <div class="text-xs text-gray-600 mb-2">
                  <div class="font-medium mb-1">Arguments:</div>
                  <pre class="bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                    {call.function.arguments}
                  </pre>
                </div>

                {call.result && (
                  <div class="text-xs text-gray-600">
                    <div class="font-medium mb-1">Result:</div>
                    <pre class="bg-white p-2 rounded border border-gray-200 overflow-x-auto max-h-40 overflow-y-auto">
                      {JSON.stringify(call.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
