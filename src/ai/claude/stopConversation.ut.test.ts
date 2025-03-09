import { Claude } from './claude';
import { IAI, TConversation } from "@/src/ai";
import { ErrConversationNotFound } from './claude';

// Mock dependencies
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Mock response' }]
        })
      }
    }))
  };
});

jest.mock('uuid', () => {
  return {
    v4: jest.fn().mockReturnValue('mock-uuid')
  };
});

// Mock the extractCodeBlocks function if it exists
jest.mock('./claude', () => {
  const originalModule = jest.requireActual('./claude');
  return {
    ...originalModule,
    extractCodeBlocks: jest.fn().mockReturnValue(['mock code block'])
  };
});

describe('Claude.stopConversation', () => {
  let claudeInstance: Claude;
  
  beforeEach(() => {
    claudeInstance = new Claude({
      apiKey: 'test-api-key',
      model: 'claude-3-opus-20240229',
      debug: false
    });
  });
  
  it('should return null when successfully stopping an existing conversation', async () => {
    // First create a conversation to stop
    const conversation: TConversation = {
      id: '',
      fileLocation: 'src/test.ts',
      functionName: 'testFunction',
      relativePath: './test',
      functionCode: 'function testFunction() {}',
      functionImports: '',
      functionTypes: ''
    };
    
    const [conversationId] = await claudeInstance.startConversation(conversation);
    
    // Now stop the conversation
    const error = await claudeInstance.stopConversation(conversationId);
    
    // Should return null for successful operation
    expect(error).toBeNull();
    
    // Trying to stop it again should fail as it no longer exists
    const secondAttemptError = await claudeInstance.stopConversation(conversationId);
    expect(secondAttemptError).toBeInstanceOf(ErrConversationNotFound);
  });
  
  it('should return ErrConversationNotFound when conversation ID does not exist', async () => {
    const error = await claudeInstance.stopConversation('non-existent-id');
    
    expect(error).toBeInstanceOf(ErrConversationNotFound);
  });
  
  it('should remove the conversation from the conversations object', async () => {
    // First create a conversation
    const conversation: TConversation = {
      id: '',
      fileLocation: 'src/test.ts',
      functionName: 'testFunction',
      relativePath: './test',
      functionCode: 'function testFunction() {}',
      functionImports: '',
      functionTypes: ''
    };
    
    const [conversationId] = await claudeInstance.startConversation(conversation);
    
    // Access private field for testing
    const conversationsBeforeStop = (claudeInstance as any).conversations;
    expect(conversationsBeforeStop[conversationId]).toBeDefined();
    
    // Stop the conversation
    await claudeInstance.stopConversation(conversationId);
    
    // Conversation should be removed from the conversations object
    const conversationsAfterStop = (claudeInstance as any).conversations;
    expect(conversationsAfterStop[conversationId]).toBeUndefined();
  });
  
  it('should handle multiple conversations correctly', async () => {
    const conversation1: TConversation = {
      id: '',
      fileLocation: 'src/test1.ts',
      functionName: 'testFunction1',
      relativePath: './test1',
      functionCode: 'function testFunction1() {}',
      functionImports: '',
      functionTypes: ''
    };
    
    const conversation2: TConversation = {
      id: '',
      fileLocation: 'src/test2.ts',
      functionName: 'testFunction2',
      relativePath: './test2',
      functionCode: 'function testFunction2() {}',
      functionImports: '',
      functionTypes: ''
    };
    
    // Mock genRandomID to return different values
    jest.spyOn(claudeInstance as any, 'genRandomID')
      .mockReturnValueOnce('conv-id-1')
      .mockReturnValueOnce('conv-id-2');
    
    const [conversationId1] = await claudeInstance.startConversation(conversation1);
    const [conversationId2] = await claudeInstance.startConversation(conversation2);
    
    // Both conversations should exist
    const conversationsBeforeStop = (claudeInstance as any).conversations;
    expect(conversationsBeforeStop[conversationId1]).toBeDefined();
    expect(conversationsBeforeStop[conversationId2]).toBeDefined();
    
    // Stop one conversation
    await claudeInstance.stopConversation(conversationId1);
    
    // First conversation should be gone, second should remain
    const conversationsAfterStop = (claudeInstance as any).conversations;
    expect(conversationsAfterStop[conversationId1]).toBeUndefined();
    expect(conversationsAfterStop[conversationId2]).toBeDefined();
  });
});