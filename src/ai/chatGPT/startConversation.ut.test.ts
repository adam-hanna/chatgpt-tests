import { ChatGPT } from './chatGPT';
import { IAI, TAI, TConversation } from "@/src/ai";
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

// Mock the dependencies
jest.mock('uuid');
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    }))
  };
});

describe('ChatGPT', () => {
  let chatGPT: ChatGPT;
  let mockConfig: TAI;
  
  beforeEach(() => {
    // Mock the UUID generation
    (uuidv4 as jest.Mock).mockReturnValue('mock-uuid');
    
    mockConfig = {
      apiKey: 'test-api-key',
      model: 'gpt-3.5-turbo',
      debug: false
    };
    
    chatGPT = new ChatGPT(mockConfig);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('startConversation', () => {
    it('should create a new conversation with a generated ID', async () => {
      const mockConversation: TConversation = {
        id: '',
        fileLocation: '/path/to/file.ts',
        functionName: 'testFunction',
        relativePath: './file',
        functionCode: 'function testFunction() {}',
        functionImports: '',
        functionTypes: ''
      };
      
      const [id, error] = await chatGPT.startConversation(mockConversation);
      
      expect(uuidv4).toHaveBeenCalled();
      expect(id).toBe('mock-uuid');
      expect(error).toBeNull();
      
      // Check that the conversation is stored with the correct structure
      // We need to access the private property, so we'll use type assertion
      const conversations = (chatGPT as any).conversations;
      expect(conversations['mock-uuid']).toBeDefined();
      expect(conversations['mock-uuid'].id).toBe('mock-uuid');
      expect(conversations['mock-uuid'].messages).toEqual([]);
    });
    
    it('should preserve all fields from the original conversation', async () => {
      const mockConversation: TConversation = {
        id: '',
        fileLocation: '/path/to/file.ts',
        functionName: 'testFunction',
        relativePath: './file',
        functionCode: 'function testFunction() {}',
        functionImports: 'import { something } from "somewhere";',
        functionTypes: 'type Test = string;'
      };
      
      await chatGPT.startConversation(mockConversation);
      
      const conversations = (chatGPT as any).conversations;
      expect(conversations['mock-uuid'].fileLocation).toBe(mockConversation.fileLocation);
      expect(conversations['mock-uuid'].functionName).toBe(mockConversation.functionName);
      expect(conversations['mock-uuid'].relativePath).toBe(mockConversation.relativePath);
      expect(conversations['mock-uuid'].functionCode).toBe(mockConversation.functionCode);
      expect(conversations['mock-uuid'].functionImports).toBe(mockConversation.functionImports);
      expect(conversations['mock-uuid'].functionTypes).toBe(mockConversation.functionTypes);
    });
    
    it('should create a new conversation with a new ID', async () => {
      // Create a conversation object with an existing ID
      const mockConversation: TConversation = {
        id: 'existing-id',
        fileLocation: '/path/to/file.ts',
        functionName: 'testFunction',
        relativePath: './file',
        functionCode: 'function testFunction() {}',
        functionImports: '',
        functionTypes: ''
      };
      
      const [id, error] = await chatGPT.startConversation({...mockConversation});
      
      expect(id).toBe('mock-uuid');
      
      const conversations = (chatGPT as any).conversations;
      expect(conversations['mock-uuid']).toBeDefined();
      expect(conversations['mock-uuid'].id).toBe('mock-uuid'); // New conversation gets new ID
      expect(conversations['existing-id']).toBeUndefined(); // No conversation with old ID
    });
  });
});