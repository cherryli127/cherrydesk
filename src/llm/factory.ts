import { LLMClient } from './client';
import { ModelProviderConfig, getDefaultModelProviderConfig } from '../common/modelProvider';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Load user's model provider configuration from saved file
 */
function loadUserConfig(): ModelProviderConfig | null {
  try {
    const configPath = path.join(app.getPath('userData'), 'model-provider-config.json');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content) as ModelProviderConfig;
      // Only return if enabled and has API key
      if (config.enabled && config.apiKey) {
        return config;
      }
    }
  } catch (e) {
    console.error('[Factory] Failed to load user config:', e);
  }
  return null;
}

export function createLLMClient(overrides?: { apiKey?: string; baseURL?: string; model?: string }): LLMClient | null {
  // Priority order:
  // 1. Explicit overrides (highest priority)
  // 2. User's saved configuration
  // 3. Environment variables
  // 4. Default values (lowest priority)

  const userConfig = loadUserConfig();

  const apiKey = overrides?.apiKey
    ?? userConfig?.apiKey
    ?? process.env.KIMI_API_KEY
    ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const baseURL = overrides?.baseURL
    ?? userConfig?.baseURL
    ?? process.env.KIMI_BASE_URL
    ?? process.env.OPENAI_BASE_URL
    ?? getDefaultModelProviderConfig().baseURL;

  const defaultModel = overrides?.model
    ?? userConfig?.defaultModel
    ?? process.env.KIMI_MODEL
    ?? getDefaultModelProviderConfig().defaultModel;

  return new LLMClient({
    apiKey,
    baseURL,
    defaultModel,
    // timeout: 90_000,
  });
}
