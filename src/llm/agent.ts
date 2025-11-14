/**
 * Agent class following 12-Factor Agents principles
 * 
 * Key principles implemented:
 * - Factor 2: Own your prompts
 * - Factor 3: Own your context window
 * - Factor 6: Launch/Pause/Resume with simple APIs
 * - Factor 8: Own your control flow
 * - Factor 9: Compact Errors into Context Window
 * - Factor 10: Small, Focused Agents
 * - Factor 12: Make your agent a stateless reducer
 */

import { LLMClient, ChatMessage, ToolDefinition, ToolCall } from './client';

export interface AgentState {
    messages: ChatMessage[];
    metadata?: Record<string, unknown>;
}

export interface ToolExecutionResult {
    tool_call_id: string;
    content: string;
    error?: string;
}

export interface AgentConfig {
    client: LLMClient;
    systemPrompt?: string;
    tools?: ToolDefinition[];
    model?: string;
    temperature?: number;
    maxIterations?: number;
}

export interface AgentStepResult {
    done: boolean;
    message?: ChatMessage;
    toolCalls?: ToolCall[];
    finalAnswer?: string;
    error?: string;
}

/**
 * Stateless agent reducer following Factor 12
 * Takes current state and event, returns new state
 */
export type AgentReducer = (
    state: AgentState,
    event: { type: string; payload?: unknown }
) => Promise<AgentState>;

export class Agent {
    private client: LLMClient;
    private systemPrompt: string;
    private tools: ToolDefinition[];
    private model: string;
    private temperature?: number;
    private maxIterations: number;

    // Tool execution handler - must be provided by user
    private toolExecutor?: (toolCall: ToolCall) => Promise<ToolExecutionResult>;

    constructor(config: AgentConfig) {
        this.client = config.client;
        this.systemPrompt = config.systemPrompt || 'You are a helpful assistant.';
        this.tools = config.tools || [];
        this.model = config.model || 'gpt-4';
        this.temperature = config.temperature;
        this.maxIterations = config.maxIterations || 10;
    }

    /**
     * Set the tool executor function
     * Factor 4: Tools are just structured outputs
     */
    setToolExecutor(executor: (toolCall: ToolCall) => Promise<ToolExecutionResult>): void {
        this.toolExecutor = executor;
    }

    /**
     * Factor 2: Own your prompts
     * Build messages with system prompt management
     */
    private buildMessages(state: AgentState): ChatMessage[] {
        const messages: ChatMessage[] = [];

        // Always include system prompt as first message
        if (this.systemPrompt) {
            messages.push({
                role: 'system',
                content: this.systemPrompt,
            });
        }

        // Add conversation history
        messages.push(...state.messages);

        return messages;
    }

    /**
     * Factor 3: Own your context window
     * Compact messages if needed (basic implementation)
     */
    private compactMessages(messages: ChatMessage[]): ChatMessage[] {
        // TODO: Implement proper context window management
        // For now, just return messages as-is
        // In production, you'd want to:
        // - Track token counts
        // - Summarize old messages
        // - Remove non-essential context
        return messages;
    }

    /**
     * Factor 9: Compact Errors into Context Window
     * Format errors for inclusion in context
     */
    private formatError(error: unknown): string {
        if (error instanceof Error) {
            return `Error: ${error.message}`;
        }
        return `Error: ${String(error)}`;
    }

    /**
     * Factor 8: Own your control flow
     * Execute a single step of the agent loop
     */
    async step(state: AgentState): Promise<AgentStepResult> {
        try {
            // Build and compact messages
            let messages = this.buildMessages(state);
            messages = this.compactMessages(messages);

            // Determine next step via LLM
            const response = await this.client.chatWithTools(
                messages,
                this.tools,
                {
                    model: this.model,
                    temperature: this.temperature,
                    tool_choice: this.tools.length > 0 ? 'auto' : undefined,
                }
            );

            const choice = response.choices[0];
            if (!choice) {
                return {
                    done: true,
                    error: 'No response from LLM',
                };
            }

            const message = choice.message;

            // Check if agent is done
            if (choice.finish_reason === 'stop' || choice.finish_reason === 'length') {
                return {
                    done: true,
                    message,
                    finalAnswer: message.content || '',
                };
            }

            // Handle tool calls
            if (choice.finish_reason === 'tool_calls' && message.tool_calls) {
                if (!this.toolExecutor) {
                    return {
                        done: true,
                        error: 'Tool calls requested but no tool executor provided',
                    };
                }

                return {
                    done: false,
                    message,
                    toolCalls: message.tool_calls,
                };
            }

            return {
                done: true,
                message,
                finalAnswer: message.content || '',
            };
        } catch (error) {
            // Factor 9: Compact errors
            const errorMessage = this.formatError(error);
            return {
                done: true,
                error: errorMessage,
            };
        }
    }

    /**
     * Factor 6: Launch/Pause/Resume with simple APIs
     * Launch agent with initial state
     */
    async launch(initialEvent: { message?: string;[key: string]: unknown }): Promise<AgentState> {
        const initialState: AgentState = {
            messages: [],
            metadata: {},
        };

        if (initialEvent.message) {
            initialState.messages.push({
                role: 'user',
                content: initialEvent.message,
            });
        }

        // Store any additional metadata
        if (Object.keys(initialEvent).length > 0) {
            initialState.metadata = { ...initialEvent };
        }

        return initialState;
    }

    /**
     * Factor 12: Stateless reducer
     * Process a step and return new state
     */
    async reduce(state: AgentState, event: { type: string; payload?: unknown }): Promise<AgentState> {
        if (event.type === 'user_message') {
            const newState: AgentState = {
                ...state,
                messages: [
                    ...state.messages,
                    {
                        role: 'user',
                        content: String(event.payload || ''),
                    },
                ],
            };
            return newState;
        }

        if (event.type === 'assistant_message') {
            const message = event.payload as ChatMessage;
            const newState: AgentState = {
                ...state,
                messages: [
                    ...state.messages,
                    message,
                ],
            };
            return newState;
        }

        if (event.type === 'tool_result') {
            const payload = event.payload as { tool_call_id: string; content: string; error?: string };
            const newState: AgentState = {
                ...state,
                messages: [
                    ...state.messages,
                    {
                        role: 'tool',
                        content: payload.error || payload.content,
                        tool_call_id: payload.tool_call_id,
                        name: payload.error ? 'error' : undefined,
                    },
                ],
            };
            return newState;
        }

        return state;
    }

    /**
     * Run agent to completion (convenience method)
     * Factor 10: Small, Focused Agents - this is a simple loop
     */
    async run(initialEvent: { message?: string;[key: string]: unknown }): Promise<{
        state: AgentState;
        finalAnswer?: string;
        error?: string;
    }> {
        let state = await this.launch(initialEvent);
        let iterations = 0;

        while (iterations < this.maxIterations) {
            const stepResult = await this.step(state);

            if (stepResult.done) {
                if (stepResult.error) {
                    return { state, error: stepResult.error };
                }

                // Add final message to state
                if (stepResult.message) {
                    state = await this.reduce(state, {
                        type: 'assistant_message',
                        payload: stepResult.message,
                    });
                }

                return {
                    state,
                    finalAnswer: stepResult.finalAnswer,
                };
            }

            // Handle tool calls
            if (stepResult.toolCalls && stepResult.message) {
                // Add assistant message with tool calls
                state = await this.reduce(state, {
                    type: 'assistant_message',
                    payload: stepResult.message,
                });

                // Execute tools and add results
                if (this.toolExecutor) {
                    for (const toolCall of stepResult.toolCalls) {
                        try {
                            const result = await this.toolExecutor(toolCall);
                            state = await this.reduce(state, {
                                type: 'tool_result',
                                payload: result,
                            });
                        } catch (error) {
                            // Factor 9: Compact errors
                            state = await this.reduce(state, {
                                type: 'tool_result',
                                payload: {
                                    tool_call_id: toolCall.id,
                                    content: '',
                                    error: this.formatError(error),
                                },
                            });
                        }
                    }
                }
            }

            iterations++;
        }

        return {
            state,
            error: `Max iterations (${this.maxIterations}) reached`,
        };
    }

    /**
     * Factor 6: Pause - return current state
     */
    pause(state: AgentState): AgentState {
        return state;
    }

    /**
     * Factor 6: Resume - continue from saved state
     */
    async resume(state: AgentState): Promise<{
        state: AgentState;
        finalAnswer?: string;
        error?: string;
    }> {
        let currentState = state;
        let iterations = 0;

        while (iterations < this.maxIterations) {
            const stepResult = await this.step(currentState);

            if (stepResult.done) {
                if (stepResult.error) {
                    return { state: currentState, error: stepResult.error };
                }

                // Add final message to state
                if (stepResult.message) {
                    currentState = await this.reduce(currentState, {
                        type: 'assistant_message',
                        payload: stepResult.message,
                    });
                }

                return {
                    state: currentState,
                    finalAnswer: stepResult.finalAnswer,
                };
            }

            // Handle tool calls
            if (stepResult.toolCalls && stepResult.message) {
                // Add assistant message with tool calls
                currentState = await this.reduce(currentState, {
                    type: 'assistant_message',
                    payload: stepResult.message,
                });

                // Execute tools and add results
                if (this.toolExecutor) {
                    for (const toolCall of stepResult.toolCalls) {
                        try {
                            const result = await this.toolExecutor(toolCall);
                            currentState = await this.reduce(currentState, {
                                type: 'tool_result',
                                payload: result,
                            });
                        } catch (error) {
                            // Factor 9: Compact errors
                            currentState = await this.reduce(currentState, {
                                type: 'tool_result',
                                payload: {
                                    tool_call_id: toolCall.id,
                                    content: '',
                                    error: this.formatError(error),
                                },
                            });
                        }
                    }
                }
            }

            iterations++;
        }

        return {
            state: currentState,
            error: `Max iterations (${this.maxIterations}) reached`,
        };
    }
}

