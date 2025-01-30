import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

import { IAI, TAI, TConversation } from "@/src/ai";

export class ErrConversationNotFound extends Error {
    constructor(message: string = "Conversation not found") {
        super(message);
        this.name = "ErrConversationNotFound";
    }
}

type ChatCompletionRequestMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string;
};

type TChatGPTConversation = TConversation & {
    messages: ChatCompletionRequestMessage[];
}

function extractCodeBlocks(response: string): string[] {
    const codeBlockRegex = /```(?:javascript|typescript)?\n([\s\S]*?)```/g;
    const matches = [...response.matchAll(codeBlockRegex)];
    return matches.map(match => match[1].trim()); // Extract the content of each code block
}

export class ChatGPT implements IAI {
    constructor(config: TAI) {
        console.debug('New ChatGPT class');
        this.config = config;
        this.chatGPTClient = new OpenAI({
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
            return new ErrConversationNotFound;
        }
        
        delete this.conversations[conversationID];

        return null
    }

    public async generateInitialTests(conversationID: string): Promise<[Array<string>, Error | null]> {
        const conversation = this.conversations[conversationID];
        if (!conversation) {
            return [[""], new ErrConversationNotFound];
        }
        const { fileLocation, functionName, relativePath, functionCode } = conversation;

        conversation.messages = [
            {
                role: "user", // TODO: @adam-hanna - figure out role constraints for chatGPT models. Where can we use system?
                content: `You are a helpful assistant that generates and revises unit tests for JavaScript/TypeScript code.
Write comprehensive unit tests for the following function, which is defined in the file '${fileLocation}'. 
Use the import statement \`import { ${functionName} } from '${relativePath}';\` to import the function. 
Do not use any external libraries other than jest.
Include the tests inside a single \`\`\`typescript\`\`\` code block, and avoid additional explanations.\n\n${functionCode}`,
            }
        ]

        const response = await this.chatGPTClient.chat.completions.create({
            model: this.config.model,
            messages: conversation.messages,
        });

        const rawResponse = response.choices[0]?.message?.content || '';
        const testBlocks = extractCodeBlocks(rawResponse);
        // TODO: @adam-hanna - save response and extracted tests to files for debugging
        //fs.writeFileSync('chatgpt-response.txt', rawResponse); // Save response for debugging
        //fs.writeFileSync('extracted-tests.txt', testBlocks.join('\n\n')); // Save extracted tests for debugging

        conversation.messages.push({ role: 'assistant', content: rawResponse });

        return [testBlocks, null];
    }

    public async provideFeedback(conversationID: string, feedback: string): Promise<[Array<string>, Error | null]> {
        const conversation = this.conversations[conversationID];
        if (!conversation) {
            return [[""], new ErrConversationNotFound];
        }

        const failureMessage: ChatCompletionRequestMessage = {
            role: 'user',
            content: `The following tests failed:\n\n${feedback}\n\nRevise the tests to address the issues. Include the updated tests in a single \`\`\`typescript\`\`\` code block.`,
        };

        conversation.messages.push(failureMessage);

        const response = await this.chatGPTClient.chat.completions.create({
            model: this.config.model,
            messages: conversation.messages,
        });

        const rawResponse = response.choices[0]?.message?.content || '';
        const testBlocks = extractCodeBlocks(rawResponse); // Parse updated test blocks

        conversation.messages.push({ role: 'assistant', content: rawResponse }); // Append response for context
        return [testBlocks, null];
    }

    private genRandomID(): string {
        return uuidv4();
    }

    private config: TAI;
    private conversations: { [key: string]: TChatGPTConversation } = {};
    private chatGPTClient: OpenAI
}