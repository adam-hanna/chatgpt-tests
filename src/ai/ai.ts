export type TAI = {
    apiKey: string;
    model: string;
    debug: boolean;
}

export type TConversation = {
    id: string;
    fileLocation: string;
    relativePath: string;
    functionName: string;
    functionCode: string;
    functionImports: string;
    functionTypes: string;
}

export interface IAI {
    // startConversation initiates a conversation with the AI provider and returns a conversation ID
    startConversation(conversation: TConversation): Promise<[string, Error | null]>;
    stopConversation(conversationID: string): Promise<Error | null>;

    generateInitialTests(conversationID: string): Promise<[Array<string>, Error | null]>;
    provideFeedback(conversationID: string, feedback: string): Promise<[Array<string>, Error | null]>;
}