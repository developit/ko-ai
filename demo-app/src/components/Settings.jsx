import { useModel } from '@preact/signals';
import './Settings.css';

export default function Settings({ appModel }) {
  const model = useModel(() => appModel);

  const handleSubmit = (e) => {
    e.preventDefault();
    model.saveConfig();
  };

  if (!model.showSettings.value) return null;

  return (
    <div class="settings-overlay" onClick={() => (model.showSettings.value = false)}>
      <div class="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div class="settings-header">
          <h2>Configuration</h2>
          <button
            class="close-btn"
            onClick={() => (model.showSettings.value = false)}
            aria-label="Close settings"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} class="settings-form">
          <div class="form-group">
            <label htmlFor="apiKey">API Key</label>
            <input
              id="apiKey"
              type="password"
              value={model.apiKey.value}
              onInput={(e) => (model.apiKey.value = e.target.value)}
              placeholder="sk-..."
              required
            />
          </div>
          <div class="form-group">
            <label htmlFor="baseURL">Base URL</label>
            <input
              id="baseURL"
              type="url"
              value={model.baseURL.value}
              onInput={(e) => (model.baseURL.value = e.target.value)}
              placeholder="https://api.openai.com/v1"
              required
            />
          </div>
          <div class="form-group">
            <label htmlFor="model">Model</label>
            <input
              id="model"
              type="text"
              value={model.model.value}
              onInput={(e) => (model.model.value = e.target.value)}
              placeholder="gpt-4o-mini"
              required
            />
          </div>
          <div class="form-group">
            <label htmlFor="instructions">System Instructions</label>
            <textarea
              id="instructions"
              value={model.instructions.value}
              onInput={(e) => (model.instructions.value = e.target.value)}
              rows="4"
              placeholder="You are a helpful AI assistant..."
            />
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-primary">
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
