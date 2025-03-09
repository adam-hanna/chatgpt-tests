import { ChatGPT } from './chatGPT';
import OpenAI from 'openai';
import { IAI, TAI, TConversation } from "@/src/ai";
import { v4 as uuidv4 } from 'uuid';

// Define the types needed for the tests
type ChatCompletionRequestMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type TChatGPTConversation = TConversation & {
  messages: ChatCompletionRequestMessage[];
};

// Mock dependencies
jest.mock('openai');
jest.mock('uuid');

// Mock error class
class ErrConversationNotFound extends Error {
  constructor() {
    super("conversation not found");
    this.name = "ErrConversationNotFound";
  }
}

describe('ChatGPT.provideFeedback', () => {
  let chatGPT: ChatGPT;
  let mockChatCompletionsCreate: jest.Mock;
  let mockConversation: TChatGPTConversation;
  const mockConversationId = "mock-conversation-id";

  beforeEach(() => {
    // Mock UUID generation
    (uuidv4 as jest.Mock).mockReturnValue("mock-uuid");

    // Set up mock OpenAI client
    mockChatCompletionsCreate = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: "code block content"
          }
        }
      ]
    });
    
    (OpenAI as unknown as jest.Mock).mockImplementation(() => ({
      chat: {
        completions: {
          create: mockChatCompletionsCreate
        }
      }
    }));

    // Create ChatGPT instance with mock config
    const mockConfig: TAI = {
      apiKey: "mock-api-key",
      model: "gpt-4",
      debug: false
    };
    
    chatGPT = new ChatGPT(mockConfig);

    // Set up mock conversation
    mockConversation = {
      id: mockConversationId,
      fileLocation: "src/example.ts",
      functionName: "example",
      relativePath: "./example",
      functionCode: "function example() { return true; }",
      functionImports: "",
      functionTypes: "",
      messages: [
        { role: 'user', content: "Initial message" },
        { role: 'assistant', content: "Initial response" }
      ]
    };

    // Add mock conversation to the instance
    (chatGPT as any)["conversations"][mockConversationId] = mockConversation;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return an error when conversation is not found", async () => {
    const [results, error] = await chatGPT.provideFeedback("non-existent-id", "Some feedback");
    
    expect(results).toEqual([""]);
    expect(error).toBeDefined();
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled();
  });
})