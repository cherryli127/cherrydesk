/**
 * OpenAI-compatible LLM client
 * Follows 12-Factor Agents principles:
 * - Factor 1: Natural Language to Tool Calls
 * - Factor 4: Tools are just structured outputs
 */

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    tool_call_id?: string;
    tool_calls?: ToolCall[];
    name?: string;
}

export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}

export interface ChatCompletionRequest {
    model: string;
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'text' | 'json_object' };
}

export interface ChatCompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: ChatMessage;
        finish_reason: 'stop' | 'length' | 'tool_calls' | null;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface ClientConfig {
    apiKey: string;
    baseURL?: string;
    defaultModel?: string;
    // timeout?: number;
}

export class LLMClient {
    private apiKey: string;
    private baseURL: string;
    private defaultModel: string;
    // private timeout: number;

    constructor(config: ClientConfig) {
        this.apiKey = config.apiKey;
        this.baseURL = config.baseURL || 'https://api.openai.com/v1';
        this.defaultModel = config.defaultModel || 'gpt-4';
        // this.timeout = config.timeout || 30000;
    }

    /**
     * Send a chat completion request
     */
    async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
        const url = `${this.baseURL}/chat/completions`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
        };

        const previewMessages = request.messages.map((message, index) => ({
            index,
            role: message.role,
            preview: typeof message.content === 'string'
                ? message.content.slice(0, 200)
                : message.content,
        }));
        console.log('[LLMClient] Sending chat request:', {
            url,
            model: request.model,
            temperature: request.temperature,
            max_tokens: request.max_tokens,
            messageCount: request.messages.length,
            messages: previewMessages,
            hasTools: !!request.tools?.length,
        });

        const controller = new AbortController();
        // const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(request),
                signal: controller.signal,
            });

            // clearTimeout(timeoutId);

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(
                    `LLM API error (${response.status}) from ${url}: ${errorBody || response.statusText}`
                );
            }

            return await response.json();
        } catch (error) {
            // clearTimeout(timeoutId);
            // Enhanced error logging
            console.error(`LLM Request Failed to ${url}:`, error);
            console.error('Full request details:', {
                url,
                method: 'POST',
                headers,
                body: JSON.stringify(request),
            });

            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    // throw new Error(`Request timeout after ${this.timeout}ms`);
                }
                // Propagate the original error to preserve stack trace and type
                throw error;
            }
            throw new Error(`Unexpected error: ${String(error)}`);
        }
    }

    /**
     * Convenience method for simple chat without tools
     */
    async chat(
        messages: ChatMessage[],
        options?: {
            model?: string;
            temperature?: number;
            max_tokens?: number;
            response_format?: { type: 'text' | 'json_object' };
        }
    ): Promise<ChatCompletionResponse> {
        return this.chatCompletion({
            model: options?.model || this.defaultModel,
            messages,
            temperature: options?.temperature,
            max_tokens: options?.max_tokens,
            response_format: options?.response_format,
        });
    }

    /**
     * Chat with tool calling support
     */
    async chatWithTools(
        messages: ChatMessage[],
        tools: ToolDefinition[],
        options?: {
            model?: string;
            tool_choice?: ChatCompletionRequest['tool_choice'];
            temperature?: number;
            max_tokens?: number;
        }
    ): Promise<ChatCompletionResponse> {
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
