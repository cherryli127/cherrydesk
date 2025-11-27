import { OrganizationStrategy } from '../../common/strategy';
import { FileNode } from '../../common/types';
import { flattenFiles, createDirectory, cloneTree, safeParseJSON } from '../utils/treeHelpers';
import { ChatMessage } from '../../llm/client';
import { createLLMClient } from '../../llm/factory';

export class TopicStrategy implements OrganizationStrategy {
    id = 'topic';
    name = 'Organize by Topic (AI)';
    description = 'Uses AI to group files into semantic topics based on filenames.';

    constructor() {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/ee30be1f-d633-4821-9229-dd3193d5e69c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'src/main/strategies/topic.ts:constructor', message: 'Initializing TopicStrategy', timestamp: Date.now(), sessionId: 'debug-session', runId: '1', hypothesisId: 'A' }) }).catch(() => { });
        // #endregion
    }

    async apply(root: FileNode): Promise<FileNode> {
        const client = createLLMClient();
        if (!client) {
            throw new Error('AI organization requires KIMI_API_KEY or OPENAI_API_KEY environment variables.');
        }

        const files = flattenFiles(root);
        const filenames = files.map(f => f.name);

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

        console.log(messages);

        try {
            const response = await client.chat(messages, {
                temperature: 0.1,
                response_format: { type: "json_object" } as any // Cast if type def is strict
            });

            const content = response.choices[0].message.content;
            if (!content) throw new Error("No response from AI");

            const mapping = safeParseJSON<Record<string, string[]>>(content);
            if (!mapping) throw new Error("AI response was not valid JSON.");

            // Reconstruct Tree
            const newChildren: FileNode[] = [];
            const fileMap = new Map(files.map(f => [f.name, f]));
            const handledFiles = new Set<string>();

            for (const [topic, topicFiles] of Object.entries(mapping)) {
                const nodes: FileNode[] = [];
                for (const name of topicFiles) {
                    const node = fileMap.get(name);
                    if (node) {
                        nodes.push(cloneTree(node));
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
                newChildren.push(createDirectory('Uncategorized', leftovers.map(n => cloneTree(n))));
            }

            return {
                ...cloneTree(root),
                children: newChildren
            };

        } catch (error) {
            console.error("Topic Organization Failed:", error);
            throw error;
        }
    }
}
