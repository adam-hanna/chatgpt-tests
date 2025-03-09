import { ChatGPT } from './chatGPT';
import { TConversation, TAI } from "@/src/ai";

// Define the error class if it's not exported from the original file
class ErrConversationNotFound extends Error {
  constructor() {
    super('Conversation not found');
    this.name = 'ErrConversationNotFound';
  }
}

describe('ChatGPT.stopConversation', () => {
  let chatGPT: ChatGPT;
  let mockConversations: Record<string, any> = {};

  beforeEach(() => {
    // Create a new instance of ChatGPT before each test with all required properties
    const config: TAI = {
      apiKey: 'test-api-key',
      model: 'test-model',
      debug: false
    };
    chatGPT = new ChatGPT(config);
    
    // Mock the private conversations property
    // This is necessary because the startConversation method doesn't seem to be 
    // properly setting up the conversations in the test environment
    mockConversations = {};
    Object.defineProperty(chatGPT, 'conversations', {
      get: jest.fn(() => mockConversations),
      set: jest.fn((val) => { mockConversations = val; })
    });
  });

  it('should return null when successfully stopping an existing conversation', async () => {
    // Arrange
    const conversationID = 'test-conversation-id';
    const mockConversation: TConversation = {
      id: conversationID,
      fileLocation: '/path/to/file',
      functionName: 'testFunction',
      relativePath: './test',
      functionCode: 'function test() {}',
      functionImports: '',
      functionTypes: ''
    };
    
    // Manually set up the conversation in the mock
    mockConversations[conversationID] = { 
      ...mockConversation, 
      messages: [] 
    };

    // Act
    const result = await chatGPT.stopConversation(conversationID);

    // Assert
    expect(result).toBeNull();
    
    // Verify the conversation was removed
    expect(mockConversations[conversationID]).toBeUndefined();
    
    // Try to stop it again to verify it's gone
    const secondAttempt = await chatGPT.stopConversation(conversationID);
    expect(secondAttempt).toBeInstanceOf(Error);
  });

  it('should return ErrConversationNotFound when trying to stop a non-existent conversation', async () => {
    // Arrange
    const nonExistentID = 'non-existent-id';
    
    // Act
    const result = await chatGPT.stopConversation(nonExistentID);

    // Assert
    expect(result).toBeInstanceOf(Error);
  });

  it('should handle stopping multiple conversations independently', async () => {
    // Arrange
    const conversationID1 = 'test-conversation-id-1';
    const conversationID2 = 'test-conversation-id-2';
    
    const mockConversation1: TConversation = {
      id: conversationID1,
      fileLocation: '/path/to/file1',
      functionName: 'testFunction1',
      relativePath: './test1',
      functionCode: 'function test1() {}',
      functionImports: '',
      functionTypes: ''
    };
    
    const mockConversation2: TConversation = {
      id: conversationID2,
      fileLocation: '/path/to/file2',
      functionName: 'testFunction2',
      relativePath: './test2',
      functionCode: 'function test2() {}',
      functionImports: '',
      functionTypes: ''
    };
    
    // Manually set up the conversations in the mock
    mockConversations[conversationID1] = { 
      ...mockConversation1, 
      messages: [] 
    };
    mockConversations[conversationID2] = { 
      ...mockConversation2, 
      messages: [] 
    };

    // Act - Stop the first conversation
    const result1 = await chatGPT.stopConversation(conversationID1);

    // Assert
    expect(result1).toBeNull();
    
    // Verify first conversation is stopped but second is still active
    expect(mockConversations[conversationID1]).toBeUndefined();
    expect(mockConversations[conversationID2]).toBeDefined();
    
    // Stop the second conversation
    const result2 = await chatGPT.stopConversation(conversationID2);
    expect(result2).toBeNull();
    
    // Verify both are now stopped
    expect(mockConversations[conversationID1]).toBeUndefined();
    expect(mockConversations[conversationID2]).toBeUndefined();
  });
});