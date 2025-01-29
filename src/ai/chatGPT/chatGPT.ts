import { v4 as uuidv4 } from 'uuid';

import { IAI, TAI, TConversation } from "@/src/ai";

export class ErrConversationNotFound extends Error {
    constructor(message: string = "Conversation not found") {
        super(message);
        this.name = "ErrConversationNotFound";
    }
}

type TChatGPTConversation = TConversation & {
    messages: string[];
}

const extractCodeFromResponse = (response: any): string => {
    return "";
}

export class ChatGPT implements IAI {
    constructor(config: TAI) {
        console.debug('New ChatGPT class');
        this.config = config;
    }

    public async startConversation(conversation: TConversation): Promise<[string, Error | null]> {
        const id = this.genRandomID();
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

    public async generateInitialTests(conversationID: string): Promise<[string, Error | null]> {
        return ["", null];
    }

    public async provideFeedback(conversationID: string, feedback: string): Promise<[string, Error | null]> {
        return ["", null];
    }

    private genRandomID(): string {
        return uuidv4();
    }

    private config: TAI;
    private conversations: { [key: string]: TChatGPTConversation } = {};
}