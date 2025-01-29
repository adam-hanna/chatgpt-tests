export type TAI = {}

export type TConversation = {
    id: string;
    fileLocation: string;
    functionName: string;
    functionCode: string;
    functionContext: string;
}

export interface IAI {
    // startConversation initiates a conversation with the AI provider and returns a conversation ID
    startConversation(conversation: TConversation): Promise<[string, Error | null]>;
    stopConversation(conversationID: string): Promise<Error | null>;

    generateInitialTests(conversationID: string): Promise<[string, Error | null]>;
    provideFeedback(conversationID: string, feedback: string): Promise<[string, Error | null]>;
}