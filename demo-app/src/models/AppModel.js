import { createModel, signal } from '@preact/signals';

export const AppModel = createModel(function AppModel() {
  // API Configuration
  this.apiKey = signal(localStorage.getItem('apiKey') || '');
  this.baseURL = signal(localStorage.getItem('baseURL') || 'https://api.openai.com/v1');
  this.model = signal(localStorage.getItem('model') || 'gpt-4o-mini');
  this.instructions = signal(
    localStorage.getItem('instructions') ||
    'You are a helpful AI assistant. You have access to file operations and a bash shell.'
  );

  // UI State
  this.showSettings = signal(false);
  this.isConfigured = signal(
    Boolean(localStorage.getItem('apiKey'))
  );

  // Save configuration
  this.saveConfig = () => {
    localStorage.setItem('apiKey', this.apiKey.value);
    localStorage.setItem('baseURL', this.baseURL.value);
    localStorage.setItem('model', this.model.value);
    localStorage.setItem('instructions', this.instructions.value);
    this.isConfigured.value = Boolean(this.apiKey.value);
    this.showSettings.value = false;
  };

  // Toggle settings
  this.toggleSettings = () => {
    this.showSettings.value = !this.showSettings.value;
  };
});
