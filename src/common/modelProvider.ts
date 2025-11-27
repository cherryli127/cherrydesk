/**
 * Model Provider Configuration
 * Inspired by Lobe Chat's model provider system
 * Reference: https://github.com/lobehub/lobe-chat/blob/next/src/config/modelProviders/moonshot.ts
 */

export interface ModelProviderConfig {
    id: string;
    name: string;
    description?: string;
    apiKey: string;
    baseURL: string;
    defaultModel: string;
    enabled: boolean;
}

export interface ModelProviderPreset {
    id: string;
    name: string;
    description: string;
    baseURL: string;
    defaultModel: string;
    modelsUrl?: string;
    url?: string;
}

// Preset configurations for popular providers
export const MODEL_PROVIDER_PRESETS: Record<string, ModelProviderPreset> = {
    moonshot: {
        id: 'moonshot',
        name: 'Moonshot (Kimi)',
        description: 'Moonshot 是由北京月之暗面科技有限公司推出的开源平台，提供多种自然语言处理模型，应用领域广泛，包括但不限于内容创作、学术研究、智能推荐、医疗诊断等，支持长文本处理和复杂生成任务。',
        baseURL: 'https://api.moonshot.cn/v1',
        defaultModel: 'kimi-k2-0905-preview',
        modelsUrl: 'https://platform.moonshot.cn/docs/intro',
        url: 'https://www.moonshot.cn',
    },
    openai: {
        id: 'openai',
        name: 'OpenAI',
        description: 'OpenAI provides powerful language models including GPT-4, GPT-3.5, and more.',
        baseURL: 'https://api.openai.com/v1',
        defaultModel: 'gpt-4',
        modelsUrl: 'https://platform.openai.com/docs/models',
        url: 'https://openai.com',
    },
    anthropic: {
        id: 'anthropic',
        name: 'Anthropic (Claude)',
        description: 'Anthropic provides Claude, a next-generation AI assistant.',
        baseURL: 'https://api.anthropic.com/v1',
        defaultModel: 'claude-3-opus-20240229',
        modelsUrl: 'https://docs.anthropic.com/claude/docs',
        url: 'https://www.anthropic.com',
    },
};

export function getDefaultModelProviderConfig(): ModelProviderConfig {
    return {
        id: 'moonshot',
        name: 'Moonshot (Kimi)',
        description: MODEL_PROVIDER_PRESETS.moonshot.description,
        apiKey: '',
        baseURL: MODEL_PROVIDER_PRESETS.moonshot.baseURL,
        defaultModel: MODEL_PROVIDER_PRESETS.moonshot.defaultModel,
        enabled: true,
    };
}

