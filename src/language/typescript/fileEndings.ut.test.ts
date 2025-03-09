import { Typescript } from './typescript';
import { existsSync, promises, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { dirSync } from 'tmp';
import * as childProcess from 'child_process';
import * as typescript from 'typescript';

// Mock dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('tmp');
jest.mock('child_process');
jest.mock('typescript');

describe('fileEndings method', () => {
  let typescriptInstance: Typescript;
  
  beforeEach(() => {
    // Mock the dirSync function to return a mock temp directory
    (dirSync as jest.Mock).mockReturnValue({
      name: '/tmp/mock-dir',
      removeCallback: jest.fn()
    });
    
    // Mock openSync
    (writeFileSync as jest.Mock).mockImplementation(() => {});
    
    // Create a new instance of Typescript
    typescriptInstance = new Typescript({});
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return an array with .ts and .js extensions', () => {
    const endings = typescriptInstance.fileEndings();
    
    expect(Array.isArray(endings)).toBe(true);
    expect(endings).toHaveLength(2);
    expect(endings).toContain('.ts');
    expect(endings).toContain('.js');
  });

  it('should return a new array each time', () => {
    const endings1 = typescriptInstance.fileEndings();
    const endings2 = typescriptInstance.fileEndings();
    
    expect(endings1).not.toBe(endings2); // Check they're not the same reference
    expect(endings1).toEqual(endings2);  // But they have the same content
  });

  it('should only include TypeScript and JavaScript file extensions', () => {
    const endings = typescriptInstance.fileEndings();
    
    const nonJsExtensions = endings.filter((ext: string) => ext !== '.ts' && ext !== '.js');
    expect(nonJsExtensions).toHaveLength(0);
  });

  it('should return values starting with a dot', () => {
    const endings = typescriptInstance.fileEndings();
    
    for (const ending of endings) {
      expect(ending.startsWith('.')).toBe(true);
    }
  });

  it('should return lowercase extensions', () => {
    const endings = typescriptInstance.fileEndings();
    
    for (const ending of endings) {
      expect(ending).toBe(ending.toLowerCase());
    }
  });

  it('should include only string values', () => {
    const endings = typescriptInstance.fileEndings();
    
    for (const ending of endings) {
      expect(typeof ending).toBe('string');
    }
  });

  it('should be consistent with repeated calls', () => {
    const calls = Array(5).fill(0).map(() => typescriptInstance.fileEndings());
    
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i]).toEqual(calls[0]);
    }
  });

  it('should return valid file extensions for the TypeScript language', () => {
    const endings = typescriptInstance.fileEndings();
    
    expect(endings).toContain('.ts');  // TypeScript source files
    expect(endings).toContain('.js');  // JavaScript files (TypeScript can also handle these)
  });
});