import { createModel, signal } from '@preact/signals';

export const AppModel = createModel(function AppModel() {
  // API Configuration
  const apiKey = signal(localStorage.getItem('apiKey') || '');
  const baseURL = signal(localStorage.getItem('baseURL') || 'https://api.openai.com/v1');
  const model = signal(localStorage.getItem('model') || 'gpt-4o-mini');
  const instructions = signal(
    localStorage.getItem('instructions') ||
    'You are a helpful AI assistant with access to file operations and a bash shell.\n\n' +
    'Important: When accessing local files, ALWAYS respect .gitignore patterns by default. ' +
    'When listing files or showing directory trees, exclude files and directories that match .gitignore patterns unless explicitly asked to include them. ' +
    'Common patterns to ignore include: node_modules/, .git/, dist/, build/, .env files, and other build artifacts.'
  );

  // UI State
  const showSettings = signal(false);
  const isConfigured = signal(
    Boolean(localStorage.getItem('apiKey'))
  );

  // Save configuration
  const saveConfig = () => {
    localStorage.setItem('apiKey', apiKey.value);
    localStorage.setItem('baseURL', baseURL.value);
    localStorage.setItem('model', model.value);
    localStorage.setItem('instructions', instructions.value);
    isConfigured.value = Boolean(apiKey.value);
    showSettings.value = false;
  };

  // Toggle settings
  const toggleSettings = () => {
    showSettings.value = !showSettings.value;
  };

  return {
    apiKey,
    baseURL,
    model,
    instructions,
    showSettings,
    isConfigured,
    saveConfig,
    toggleSettings
  };
});
