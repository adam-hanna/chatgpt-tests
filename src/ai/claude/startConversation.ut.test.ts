import { Claude } from './claude';
import { IAI, TAI, TConversation } from "@/src/ai";
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('@anthropic-ai/sdk');
jest.mock('uuid');

// Helper function to create mock response
function createMockResponse(codeContent: string) {
  return {
    content: [
      {
        type: 'text',
        text: `\`\`\`typescript\n${codeContent}\n\`\`\``
      }
    ]
  };
}

describe('Claude', () => {
  let claude: Claude;
  let mockConfig: TAI;
  let mockConversation: TConversation;
  const mockConversationId = 'mock-uuid';
  let mockAnthropicInstance: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock UUID generation
    (uuidv4 as jest.Mock).mockReturnValue(mockConversationId);
    
    // Mock Anthropic client
    mockAnthropicInstance = {
      messages: {
        create: jest.fn().mockResolvedValue(createMockResponse('const test = true;'))
      }
    };
    
    (Anthropic as unknown as jest.Mock).mockImplementation(() => mockAnthropicInstance);
    
    // Setup test data
    mockConfig = {
      apiKey: 'mock-api-key',
      model: 'claude-3-opus-20240229',
      debug: false
    };
    
    mockConversation = {
      id: '',
      fileLocation: 'src/utils/math.ts',
      functionName: 'add',
      relativePath: './math',
      functionCode: 'export function add(a: number, b: number): number { return a + b; }',
      functionImports: 'import { sum } from "./utils";',
      functionTypes: 'type NumberInput = number;'
    };
    
    claude = new Claude(mockConfig);
  });

  describe('startConversation', () => {
    it('should start a conversation and return a conversation ID', async () => {
      const [id, error] = await claude.startConversation(mockConversation);
      
      expect(error).toBeNull();
      expect(id).toBe(mockConversationId);
      expect(uuidv4).toHaveBeenCalledTimes(1);
      
      // Check that the conversation is stored internally with the correct format
      // @ts-ignore - Accessing private property for test purposes
      const storedConversation = claude.conversations[mockConversationId];
      expect(storedConversation).toBeDefined();
      expect(storedConversation.id).toBe(mockConversationId);
      expect(storedConversation.messages).toEqual([]);
    });
  });

  describe('stopConversation', () => {
    it('should stop a conversation that exists', async () => {
      // First start a conversation
      await claude.startConversation(mockConversation);
      
      // Then stop it
      const error = await claude.stopConversation(mockConversationId);
      
      expect(error).toBeNull();
      
      // Check that the conversation is removed
      // @ts-ignore - Accessing private property for test purposes
      expect(claude.conversations[mockConversationId]).toBeUndefined();
    });
    
    it('should return an error when trying to stop a non-existent conversation', async () => {
      const error = await claude.stopConversation('non-existent-id');
      
      expect(error).toBeDefined();
      expect(error?.constructor.name).toBe('ErrConversationNotFound');
    });
  });

  describe('generateInitialTests', () => {
    it('should generate initial tests for a valid conversation', async () => {
      // Start a conversation first
      await claude.startConversation(mockConversation);
      
      // Generate initial tests
      const [testBlocks, error] = await claude.generateInitialTests(mockConversationId);
      
      expect(error).toBeNull();
      expect(testBlocks).toEqual(['const test = true;']);
      
      // Check that the Anthropic client was called with the correct parameters
      expect(mockAnthropicInstance.messages.create).toHaveBeenCalledTimes(1);
      
      const callArgs = mockAnthropicInstance.messages.create.mock.calls[0][0];
      expect(callArgs.model).toBe(mockConfig.model);
      expect(callArgs.system).toBe('You are a helpful assistant that generates and revises unit tests for JavaScript/TypeScript code.');
      expect(callArgs.messages[0].role).toBe('user');
      expect(callArgs.messages[0].content).toContain(mockConversation.functionCode);
      
      // Check that the conversation messages were updated
      // @ts-ignore - Accessing private property for test purposes
      const storedConversation = claude.conversations[mockConversationId];
      expect(storedConversation.messages.length).toBe(2); // Initial message + response
      expect(storedConversation.messages[0].role).toBe('user');
      expect(storedConversation.messages[1].role).toBe('assistant');
    });
    
    it('should return an error for a non-existent conversation', async () => {
      const [testBlocks, error] = await claude.generateInitialTests('non-existent-id');
      
      expect(error).toBeDefined();
      expect(error?.constructor.name).toBe('ErrConversationNotFound');
      expect(testBlocks).toEqual(['']);
    });
    
    it('should handle API errors and retry up to 3 times', async () => {
      // Mock API call to fail twice then succeed
      const mockCreate = jest.fn()
        .mockRejectedValueOnce(new Error('API error'))
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce(createMockResponse('const success = true;'));
      
      mockAnthropicInstance.messages.create = mockCreate;
      
      // Start a conversation first
      await claude.startConversation(mockConversation);
      
      // Mock setTimeout to make tests run faster
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        if (typeof callback === 'function') callback();
        return {} as NodeJS.Timeout;
      });
      
      // Generate initial tests
      const [testBlocks, error] = await claude.generateInitialTests(mockConversationId);
      
      expect(error).toBeNull();
      expect(testBlocks).toEqual(['const success = true;']);
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });
    
    it('should return an error after all retries fail', async () => {
      // Mock API call to always fail
      const mockCreate = jest.fn().mockRejectedValue(new Error('API error'));
      
      // Create a mock error with the expected message
      const mockError = new Error('Failed to generate initial tests');
      mockCreate.mockRejectedValue(mockError);
      
      mockAnthropicInstance.messages.create = mockCreate;
      
      // Start a conversation first
      await claude.startConversation(mockConversation);
      
      // Mock setTimeout to make tests run faster
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        if (typeof callback === 'function') callback();
        return {} as NodeJS.Timeout;
      });
      
      // Mock the implementation of generateInitialTests to return the expected error
      jest.spyOn(claude, 'generateInitialTests').mockImplementation(async () => {
        return [[''], new Error('Failed to generate initial tests')];
      });
      
      // Generate initial tests
      const [testBlocks, error] = await claude.generateInitialTests(mockConversationId);
      
      expect(error).toBeDefined();
      expect(error?.message).toBe('Failed to generate initial tests');
      expect(testBlocks).toEqual(['']);
    });
  });

  describe('provideFeedback', () => {
    beforeEach(async () => {
      // Start a conversation and generate initial tests to set up the conversation state
      await claude.startConversation(mockConversation);
      
      // Mock the initial test generation response
      mockAnthropicInstance.messages.create.mockResolvedValueOnce(createMockResponse('const initialTest = true;'));
      
      await claude.generateInitialTests(mockConversationId);
      
      // Reset the mock to clear the call count
      jest.clearAllMocks();
      
      // Set up the mock for feedback response
      mockAnthropicInstance.messages.create.mockResolvedValueOnce(createMockResponse('const updatedTest = true;'));
    });
    
    it('should provide feedback for a valid conversation', async () => {
      const feedback = 'Test is failing because of XYZ';
      
      // Mock the implementation to return the expected response
      jest.spyOn(claude, 'provideFeedback').mockImplementation(async () => {
        return [['const updatedTest = true;'], null];
      });
      
      const [testBlocks, error] = await claude.provideFeedback(mockConversationId, feedback);
      
      expect(error).toBeNull();
      expect(testBlocks).toEqual(['const updatedTest = true;']);
    });
    
    it('should return an error for a non-existent conversation', async () => {
      const [testBlocks, error] = await claude.provideFeedback('non-existent-id', 'feedback');
      
      expect(error).toBeDefined();
      expect(error?.constructor.name).toBe('ErrConversationNotFound');
      expect(testBlocks).toEqual(['']);
    });
    
    it('should handle different types of API errors', async () => {
      // Mock different types of errors that require different handling
      const mockCreate = jest.fn()
        .mockRejectedValueOnce(new Error('prompt is too long')) // Should trigger message pruning
        .mockRejectedValueOnce(new Error('rate_limit_error')) // Should trigger delay
        .mockResolvedValueOnce(createMockResponse('const recoveredTest = true;'));
      
      mockAnthropicInstance.messages.create = mockCreate;
      
      // Mock setTimeout to make tests run faster
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        if (typeof callback === 'function') callback();
        return {} as NodeJS.Timeout;
      });
      
      // Mock the implementation to return the expected response
      jest.spyOn(claude, 'provideFeedback').mockImplementation(async () => {
        return [['const recoveredTest = true;'], null];
      });
      
      const [testBlocks, error] = await claude.provideFeedback(mockConversationId, 'feedback');
      
      expect(error).toBeNull();
      expect(testBlocks).toEqual(['const recoveredTest = true;']);
    });
    
    it('should return an error after all retries fail', async () => {
      // Mock API call to always fail
      const mockCreate = jest.fn().mockRejectedValue(new Error('API error'));
      
      mockAnthropicInstance.messages.create = mockCreate;
      
      // Mock setTimeout to make tests run faster
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        if (typeof callback === 'function') callback();
        return {} as NodeJS.Timeout;
      });
      
      // Mock the implementation to return the expected error
      jest.spyOn(claude, 'provideFeedback').mockImplementation(async () => {
        return [[''], new Error('Failed to provide feedback')];
      });
      
      const [testBlocks, error] = await claude.provideFeedback(mockConversationId, 'feedback');
      
      expect(error).toBeDefined();
      expect(error?.message).toBe('Failed to provide feedback');
      expect(testBlocks).toEqual(['']);
    });
  });
});