import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';

import { IAI, TAI, TConversation } from "@/src/ai";

export class ErrConversationNotFound extends Error {
    constructor(message: string = "Conversation not found") {
        super(message);
        this.name = "ErrConversationNotFound";
    }
}

type ClaudeMessage = {
    role: 'user' | 'assistant';
    content: string;
};

type TClaudeConversation = TConversation & {
    messages: ClaudeMessage[];
}

function extractCodeBlocks(response: string): string[] {
    const codeBlockRegex = /```(?:javascript|typescript)?\n([\s\S]*?)```/g;
    const matches = [...response.matchAll(codeBlockRegex)];
    return matches.map(match => match[1].trim()); // Extract the content of each code block
}

export class Claude implements IAI {
    constructor(config: TAI) {
        console.debug('New Claude class');
        this.config = config;
        this.claudeClient = new Anthropic({
            apiKey: config.apiKey,
        });
    }

    public async startConversation(conversation: TConversation): Promise<[string, Error | null]> {
        const id = this.genRandomID();
        conversation.id = id;
        this.conversations[id] = { ...conversation, messages: [] };
        
        return [id, null];
    }

    public async stopConversation(conversationID: string): Promise<Error | null> {
        const conversation = this.conversations[conversationID];
        if (!conversation) {
            return new ErrConversationNotFound();
        }
        
        delete this.conversations[conversationID];
        
        return null;
    }

    public async generateInitialTests(conversationID: string): Promise<[Array<string>, Error | null]> {
        const conversation = this.conversations[conversationID];
        if (!conversation) {
            return [[""], new ErrConversationNotFound()];
        }
        
        const { fileLocation, functionName, relativePath, functionCode } = conversation;

        // System prompt for Claude
        const systemPrompt = `You are a helpful assistant that generates and revises unit tests for JavaScript/TypeScript code.`;
        
        // User message for Claude
        const userPrompt = `Write comprehensive unit tests for the following function, which is defined in the file '${fileLocation}'. 
Use the import statement \`import { ${functionName} } from '${relativePath}';\` to import the function. Do not use any external libraries other than jest.

The imports in this file that you may need to know about are: 
${conversation.functionImports}

The types used are:
${conversation.functionTypes}

Do not mock the typs, interfaces, enums, etc. Rather, import them from the same import statement given above (if available), or if not in the given imports, import them from the same file as the function (e.g. import { <TYPE GOES HERE> } from '${relativePath}';).

Include the tests inside a single \`\`\`typescript\`\`\` code block, and avoid additional explanations.

${functionCode}`;

        // Store the initial user message in our conversation history
        conversation.messages = [
            { role: 'user', content: userPrompt }
        ];
        
        for (let i = 0; i < 3; i++) {
            try {
                // Make the API call to Claude
                const response = await this.claudeClient.messages.create({
                    model: this.config.model,
                    system: systemPrompt,
                    messages: conversation.messages,
                    max_tokens: 4000,
                });
        
                // Extract the response text from Claude
                let rawResponse = '';
                for (const part of response.content) {
                    if (part.type === 'text') {
                        rawResponse += part.text;
                    }
                }
        
                const testBlocks = extractCodeBlocks(rawResponse);
        
                // Store Claude's response in our conversation history
                conversation.messages.push({ role: 'assistant', content: rawResponse });
        
                return [testBlocks, null];
            } catch (e) {
                console.error('Failed to generate initial tests:', e);
                await new Promise(resolve => setTimeout(resolve, 60000));
            }
        }

        return [[""], new Error('Failed to generate initial tests')];
    }

    public async provideFeedback(conversationID: string, feedback: string): Promise<[Array<string>, Error | null]> {
        const conversation = this.conversations[conversationID];
        if (!conversation) {
            return [[""], new ErrConversationNotFound()];
        }
        
        // Add the feedback as a user message
        const failureMessage: ClaudeMessage = {
            role: 'user',
            content: `The following tests failed:\n\n${feedback}\n\nRevise the tests to address the issues. Include the updated tests in a single \`\`\`typescript\`\`\` code block.`,
        };
        
        conversation.messages.push(failureMessage);
        
        // System prompt for Claude
        const systemPrompt = `You are a helpful assistant that generates and revises unit tests for JavaScript/TypeScript code.`;

        for (let i = 0; i < 3; i++) {
            try {
                // Make the API call to Claude with the full conversation history
                const response = await this.claudeClient.messages.create({
                    model: this.config.model,
                    system: systemPrompt,
                    messages: conversation.messages,
                    temperature: 0.1,
                    max_tokens: 16000,
                });
        
                // Extract the response text from Claude
                let rawResponse = '';
                for (const part of response.content) {
                    if (part.type === 'text') {
                        rawResponse += part.text;
                    }
                }
        
                const testBlocks = extractCodeBlocks(rawResponse);
        
                // Store Claude's response in our conversation history
                conversation.messages.push({ role: 'assistant', content: rawResponse });
        
                return [testBlocks, null];
            } catch (e) {
                console.error('Failed to provide feedback:', e);
                if (String(e).includes('prompt is too long')) {
                    conversation.messages.splice(conversation.messages.length - 2, 1);
                    this.conversations[conversationID] = conversation;
                    await new Promise(resolve => setTimeout(resolve, 10000));
                } else if (String(e).includes('rate_limit_error')) {
                    await new Promise(resolve => setTimeout(resolve, 60000));
                }
            }
        }

        return [[""], new Error('Failed to provide feedback')];
    }

    private genRandomID(): string {
        return uuidv4();
    }

    private config: TAI;
    private conversations: { [key: string]: TClaudeConversation } = {};
    private claudeClient: Anthropic;
}