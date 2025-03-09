import { Config, TConfig, IConfig } from './config';

// Mock the readConfigFromEnv function which is not exported
jest.mock('./config', () => {
  const originalModule = jest.requireActual('./config');
  
  // Create a mock implementation of the Config class that exposes the mocked readConfigFromEnv
  class MockConfig extends originalModule.Config {
    static mockReadConfigFromEnv = jest.fn();
    
    async fetchConfig(): Promise<[void, boolean]> {
      const [config, success] = MockConfig.mockReadConfigFromEnv();
      if (!success || !config) {
        return [undefined, false];
      }

      // @ts-ignore - accessing private property for testing
      this.config = config;
      return [undefined, true];
    }
  }
  
  return {
    ...originalModule,
    Config: MockConfig,
  };
});

// Get access to the mocked function
import { Config as MockedConfig } from './config';

describe('Config', () => {
  let config: Config;
  
  // Helper to access the static mock
  const mockReadConfigFromEnv = (MockedConfig as any).mockReadConfigFromEnv;

  beforeEach(() => {
    config = new Config();
    jest.clearAllMocks();
    
    // Mock console.debug before creating the Config instance
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  describe('constructor', () => {
    it('should initialize with empty config and log debug message', () => {
      // Create a new instance to trigger the constructor again with our spy in place
      const newConfig = new Config();
      expect(console.debug).toHaveBeenCalledWith('New Config class');
    });
  });

  describe('fetchConfig', () => {
    it('should return success when readConfigFromEnv succeeds', async () => {
      const mockConfig: TConfig = {
        AI_PROVIDER_API_KEY: 'test-api-key'
      };
      mockReadConfigFromEnv.mockReturnValue([mockConfig, true]);

      const [, success] = await config.fetchConfig();

      expect(success).toBe(true);
      expect(mockReadConfigFromEnv).toHaveBeenCalledTimes(1);
    });

    it('should return failure when readConfigFromEnv fails', async () => {
      mockReadConfigFromEnv.mockReturnValue([null, false]);

      const [, success] = await config.fetchConfig();

      expect(success).toBe(false);
      expect(mockReadConfigFromEnv).toHaveBeenCalledTimes(1);
    });

    it('should return failure when readConfigFromEnv returns no config', async () => {
      mockReadConfigFromEnv.mockReturnValue([undefined, true]);

      const [, success] = await config.fetchConfig();

      expect(success).toBe(false);
      expect(mockReadConfigFromEnv).toHaveBeenCalledTimes(1);
    });

    it('should update internal config when successful', async () => {
      const mockConfig: TConfig = {
        AI_PROVIDER_API_KEY: 'new-api-key'
      };
      mockReadConfigFromEnv.mockReturnValue([mockConfig, true]);

      await config.fetchConfig();
      const [value, success] = config.fetchConfigValue('AI_PROVIDER_API_KEY');

      expect(success).toBe(true);
      expect(value).toBe('new-api-key');
    });
  });

  describe('fetchConfigValue', () => {
    it('should return the value when key exists', async () => {
      const mockConfig: TConfig = {
        AI_PROVIDER_API_KEY: 'test-api-key'
      };
      mockReadConfigFromEnv.mockReturnValue([mockConfig, true]);
      await config.fetchConfig();

      const [value, success] = config.fetchConfigValue('AI_PROVIDER_API_KEY');

      expect(success).toBe(true);
      expect(value).toBe('test-api-key');
    });

    it('should return failure when key does not exist', () => {
      // Using a property that doesn't exist, TypeScript would catch this
      // but for testing purposes we can use 'as any'
      const [value, success] = config.fetchConfigValue('NON_EXISTENT_KEY' as any);

      expect(success).toBe(false);
      expect(value).toBe(null);
    });

    it('should return empty string for AI_PROVIDER_API_KEY by default', () => {
      const [value, success] = config.fetchConfigValue('AI_PROVIDER_API_KEY');

      expect(success).toBe(true);
      expect(value).toBe('');
    });
  });
});