import './ChatMessage.css';

export default function ChatMessage({ message }) {
  const { role, content, toolCalls } = message;

  return (
    <div class={`message message-${role}`}>
      <div class="message-role">{role}</div>
      <div class="message-content">
        {content && <div class="message-text">{content}</div>}
        {toolCalls && toolCalls.length > 0 && (
          <div class="tool-calls">
            {toolCalls.map((call, idx) => (
              <div key={idx} class="tool-call">
                <div class="tool-call-header">
                  <span class="tool-name">🔧 {call.function.name}</span>
                </div>
                <div class="tool-call-args">
                  <pre>{call.function.arguments}</pre>
                </div>
                {call.result && (
                  <div class="tool-call-result">
                    <div class="tool-result-label">Result:</div>
                    <pre>{JSON.stringify(call.result, null, 2)}</pre>
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
