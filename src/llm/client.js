"use strict";
/**
 * OpenAI-compatible LLM client
 * Follows 12-Factor Agents principles:
 * - Factor 1: Natural Language to Tool Calls
 * - Factor 4: Tools are just structured outputs
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMClient = void 0;
class LLMClient {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.baseURL = config.baseURL || 'https://api.openai.com/v1';
        this.defaultModel = config.defaultModel || 'gpt-4';
        this.timeout = config.timeout || 30000;
    }
    /**
     * Send a chat completion request
     */
    async chatCompletion(request) {
        const url = `${this.baseURL}/chat/completions`;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
        };
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(request),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`LLM API error (${response.status}): ${errorBody || response.statusText}`);
            }
            return await response.json();
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    throw new Error(`Request timeout after ${this.timeout}ms`);
                }
                throw error;
            }
            throw new Error(`Unexpected error: ${String(error)}`);
        }
    }
    /**
     * Convenience method for simple chat without tools
     */
    async chat(messages, options) {
        return this.chatCompletion({
            model: options?.model || this.defaultModel,
            messages,
            temperature: options?.temperature,
            max_tokens: options?.max_tokens,
        });
    }
    /**
     * Chat with tool calling support
     */
    async chatWithTools(messages, tools, options) {
        return this.chatCompletion({
            model: options?.model || this.defaultModel,
            messages,
            tools,
            tool_choice: options?.tool_choice || 'auto',
            temperature: options?.temperature,
            max_tokens: options?.max_tokens,
        });
    }
}
exports.LLMClient = LLMClient;
