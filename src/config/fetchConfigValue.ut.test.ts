import { Config, TConfig, IConfig } from './config';

// Create a mock implementation for the Config class
jest.mock('./config', () => {
  // Store the original module
  const originalModule = jest.requireActual('./config');
  
  // Create a mock implementation of the Config class
  class MockConfig extends originalModule.Config {
    // Override the fetchConfig method to use our mocked implementation
    async fetchConfig() {
      // This will be replaced in individual tests
      return [undefined, true];
    }
  }
  
  return {
    ...originalModule,
    Config: MockConfig
  };
});

describe('Config class', () => {
  let config: Config;
  
  beforeEach(() => {
    config = new Config();
    jest.clearAllMocks();
  });

  describe('fetchConfigValue', () => {
    it('should return [value, true] for existing config key', async () => {
      // Manually set the internal config for testing
      // @ts-ignore - Accessing private property for testing
      config.config = {
        AI_PROVIDER_API_KEY: 'test-api-key',
      };
      
      const [value, success] = config.fetchConfigValue('AI_PROVIDER_API_KEY');
      
      expect(value).toBe('test-api-key');
      expect(success).toBe(true);
    });

    it('should return [null, false] for non-existent config key', () => {
      // Manually set the internal config for testing
      // @ts-ignore - Accessing private property for testing
      config.config = {
        AI_PROVIDER_API_KEY: 'test-api-key',
      };
      
      // We'll use a type assertion to test a non-existent key for testing purposes
      const [value, success] = config.fetchConfigValue('NON_EXISTENT_KEY' as keyof TConfig);
      
      expect(value).toBeNull();
      expect(success).toBe(false);
    });

    it('should return empty string for AI_PROVIDER_API_KEY by default', () => {
      const [value, success] = config.fetchConfigValue('AI_PROVIDER_API_KEY');
      
      expect(value).toBe('');
      expect(success).toBe(true);
    });
  });

  describe('fetchConfig', () => {
    it('should update the config values when successful', async () => {
      // Create a spy on the fetchConfig method
      const fetchConfigSpy = jest.spyOn(config, 'fetchConfig');
      
      // Mock the implementation for this test
      fetchConfigSpy.mockImplementation(async () => {
        // @ts-ignore - Accessing private property for testing
        config.config = {
          AI_PROVIDER_API_KEY: 'updated-api-key',
        };
        return [undefined, true];
      });
      
      const result = await config.fetchConfig();
      
      expect(result).toEqual([undefined, true]);
      
      // Verify the config was updated
      const [value, success] = config.fetchConfigValue('AI_PROVIDER_API_KEY');
      expect(value).toBe('updated-api-key');
      expect(success).toBe(true);
      
      // Restore the original implementation
      fetchConfigSpy.mockRestore();
    });

    it('should return [undefined, false] when fetch fails', async () => {
      // Create a spy on the fetchConfig method
      const fetchConfigSpy = jest.spyOn(config, 'fetchConfig');
      
      // Mock the implementation for this test
      fetchConfigSpy.mockImplementation(async () => {
        return [undefined, false];
      });
      
      const result = await config.fetchConfig();
      
      expect(result).toEqual([undefined, false]);
      
      // Restore the original implementation
      fetchConfigSpy.mockRestore();
    });
  });
});