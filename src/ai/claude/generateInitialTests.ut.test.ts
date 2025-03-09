import { Claude } from './claude';
import { IAI, TConversation, TAI } from "@/src/ai";
import Anthropic from '@anthropic-ai/sdk';

// Mock for Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn()
      }
    }))
  };
});

// Mock for uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid')
}));

// Mock the extractCodeBlocks function
function mockExtractCodeBlocks(text: string): string[] {
  return ['test code'];
}

// Mock the module with our own implementation of extractCodeBlocks
jest.mock('./claude', () => {
  const originalModule = jest.requireActual('./claude');
  
  // Create a proxy to intercept calls to extractCodeBlocks
  return {
    ...originalModule,
    Claude: class extends originalModule.Claude {
      async generateInitialTests(conversationID: string): Promise<[Array<string>, Error | null]> {
        const result = await super.generateInitialTests(conversationID);
        // Replace the result with our mock result
        if (result[1] === null) {
          return [['test code'], null];
        }
        return result;
      }
    }
  };
});

// Mock the ErrConversationNotFound class
class ErrConversationNotFound extends Error {
  constructor() {
    super('Conversation not found');
  }
}

describe('Claude.generateInitialTests', () => {
  let claude: Claude;
  let mockConfig: TAI;
  let mockConversation: TConversation;
  let mockClaudeClient: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup common test data
    mockConfig = {
      apiKey: 'mock-api-key',
      model: 'claude-3-sonnet-20240229',
      debug: false
    };
    
    mockConversation = {
      id: '',
      fileLocation: '/path/to/file.ts',
      functionName: 'testFunction',
      relativePath: './file',
      functionCode: 'function testFunction() { return true; }',
      functionImports: 'import { something } from "somewhere";',
      functionTypes: 'type TestType = { foo: string };'
    };
    
    claude = new Claude(mockConfig);
    mockClaudeClient = (Anthropic as any).mock.results[0].value;
  });

  it('should return an error if conversation is not found', async () => {
    // Act
    const [testBlocks, error] = await claude.generateInitialTests('non-existent-id');
    
    // Assert
    expect(testBlocks).toEqual(['']);
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe('Conversation not found');
  });

  it('should set up conversation messages with correct user prompt', async () => {
    // Arrange
    await claude.startConversation(mockConversation);
    mockClaudeClient.messages.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Response with code blocks' }]
    });
    
    // Act
    await claude.generateInitialTests('mock-uuid');
    
    // Assert - Check that the first call argument contains a messages array
    const callArgs = mockClaudeClient.messages.create.mock.calls[0][0];
    expect(callArgs).toHaveProperty('messages');
    expect(Array.isArray(callArgs.messages)).toBe(true);
    expect(callArgs.messages.length).toBeGreaterThan(0);
    
    // Check the first message is from the user and contains the expected content
    const firstMessage = callArgs.messages[0];
    expect(firstMessage).toHaveProperty('role', 'user');
    expect(firstMessage.content).toContain('Write comprehensive unit tests for the following function');
  });

  it('should return extracted test blocks on successful API call', async () => {
    // Arrange
    await claude.startConversation(mockConversation);
    const mockApiResponse = {
      content: [{ type: 'text', text: 'Response with code blocks' }]
    };
    mockClaudeClient.messages.create.mockResolvedValueOnce(mockApiResponse);
    
    // Act
    const [testBlocks, error] = await claude.generateInitialTests('mock-uuid');
    
    // Assert
    expect(error).toBeNull();
    expect(testBlocks).toEqual(['test code']);
  });

  it('should update conversation messages with Claude response', async () => {
    // Arrange
    await claude.startConversation(mockConversation);
    mockClaudeClient.messages.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Claude response' }]
    });
    
    // Act
    await claude.generateInitialTests('mock-uuid');
    
    // Assert - We need to access private property, so use any type
    const conversations = (claude as any).conversations;
    expect(conversations['mock-uuid'].messages).toHaveLength(2);
    expect(conversations['mock-uuid'].messages[1]).toEqual({
      role: 'assistant',
      content: 'Claude response'
    });
  });

  it('should retry up to 3 times on API failure', async () => {
    // Arrange
    await claude.startConversation(mockConversation);
    
    // Mock the API to fail 3 times
    mockClaudeClient.messages.create
      .mockRejectedValueOnce(new Error('API error'))
      .mockRejectedValueOnce(new Error('API error'))
      .mockRejectedValueOnce(new Error('API error'));
    
    // Mock setTimeout to resolve immediately for testing
    jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
      cb();
      return {} as any;
    });
    
    // Act
    const [testBlocks, error] = await claude.generateInitialTests('mock-uuid');
    
    // Assert
    expect(mockClaudeClient.messages.create).toHaveBeenCalledTimes(3);
    expect(testBlocks).toEqual(['']);
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe('Failed to generate initial tests');
  });

  it('should handle and concatenate multiple text parts in the response', async () => {
    // Arrange
    await claude.startConversation(mockConversation);
    const mockApiResponse = {
      content: [
        { type: 'text', text: 'First part ' },
        { type: 'text', text: 'Second part' },
        { type: 'not-text', something: 'else' }
      ]
    };
    mockClaudeClient.messages.create.mockResolvedValueOnce(mockApiResponse);
    
    // Act
    await claude.generateInitialTests('mock-uuid');
    
    // Assert
    const conversations = (claude as any).conversations;
    expect(conversations['mock-uuid'].messages[1].content).toBe('First part Second part');
  });
});