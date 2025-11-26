import { OrganizationStrategy } from '../../common/strategy';
import { FileNode } from '../../common/types';
import { flattenFiles, createDirectory, cloneNode } from './utils';
import { LLMClient, ChatMessage } from '../../llm/client';

// We'll need a way to instantiate the client. 
// For now, we'll assume environment variables or a config are present, 
// or we will accept the client as a dependency if we were doing dependency injection.
// Since this is a strategy object, we might need to initialize it lazily or pass config.

// Mock config for now - in a real app this comes from user settings
const MOCK_CONFIG = {
    apiKey: process.env.OPENAI_API_KEY || 'sk-mock-key',
    baseURL: process.env.OPENAI_BASE_URL || 'http://localhost:11434/v1', // Default to local Ollama
    defaultModel: 'llama3'
};

export class TopicStrategy implements OrganizationStrategy {
    id = 'topic';
    name = 'Organize by Topic (AI)';
    description = 'Uses AI to group files into semantic topics based on filenames.';

    private client: LLMClient;

    constructor() {
        this.client = new LLMClient(MOCK_CONFIG);
    }

    async apply(root: FileNode): Promise<FileNode> {
        const files = flattenFiles(root);
        const filenames = files.map(f => f.name);

        // Limit for safety in this demo
        if (filenames.length > 200) {
            throw new Error("Too many files for AI processing in this demo version (limit 200).");
        }

        const prompt = `
You are an intelligent file organizer. 
Group the following list of filenames into distinct, coherent topics (e.g., "Invoices", "Personal Photos", "Project Alpha", "Random").
Return ONLY a JSON object where keys are Topic Names and values are arrays of exact filenames.
Do not hallucinate filenames.

Files:
${JSON.stringify(filenames)}
`;

        const messages: ChatMessage[] = [
            { role: 'system', content: 'You are a helpful assistant that outputs only valid JSON.' },
            { role: 'user', content: prompt }
        ];

        try {
            const response = await this.client.chat(messages, {
                temperature: 0.1,
                response_format: { type: "json_object" } // if supported by provider
            } as any); // Cast to any because response_format might not be in the strict interface yet

            const content = response.choices[0].message.content;
            if (!content) throw new Error("No response from AI");

            // Parse JSON
            let mapping: Record<string, string[]>;
            try {
                // naive cleanup in case of markdown blocks
                const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
                mapping = JSON.parse(cleanJson);
            } catch (e) {
                console.error("Failed to parse AI JSON:", content);
                throw new Error("AI response was not valid JSON.");
            }

            // Reconstruct Tree
            const newChildren: FileNode[] = [];
            const fileMap = new Map(files.map(f => [f.name, f]));
            const handledFiles = new Set<string>();

            for (const [topic, topicFiles] of Object.entries(mapping)) {
                const nodes: FileNode[] = [];
                for (const name of topicFiles) {
                    const node = fileMap.get(name);
                    if (node) {
                        nodes.push(cloneNode(node));
                        handledFiles.add(name);
                    }
                }
                if (nodes.length > 0) {
                    newChildren.push(createDirectory(topic, nodes));
                }
            }

            // Handle leftovers
            const leftovers = files.filter(f => !handledFiles.has(f.name));
            if (leftovers.length > 0) {
                newChildren.push(createDirectory('Uncategorized', leftovers.map(cloneNode)));
            }

            return {
                ...cloneNode(root),
                children: newChildren
            };

        } catch (error) {
            console.error("Topic Organization Failed:", error);
            throw error;
        }
    }
}

