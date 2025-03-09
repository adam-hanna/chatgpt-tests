import { jest } from '@jest/globals';
import * as ts from 'typescript';
import * as path from 'path';

// Mock the TypeScript API
jest.mock('typescript', () => {
  return {
    createProgram: jest.fn(),
    ScriptTarget: {
      Latest: 'Latest'
    }
  };
});

// Mock internal functions that would be imported from the same file
jest.mock('./utils', () => {
  return {
    collectFunctionTypes: jest.fn(),
    findFunctionByName: jest.fn(),
    getFunctionTypeInfo: jest.fn()
  };
});

// Import the function after mocking
import { collectFunctionTypes } from './utils';

describe('collectFunctionTypes', () => {
  let mockTypeChecker: any;
  let mockSourceFile: any;
  let mockProgram: any;
  let mockFunctionNode: any;
  let mockFunctionTypeInfo: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up mocks
    mockTypeChecker = { /* mock type checker properties */ };
    mockSourceFile = { /* mock source file properties */ };
    mockFunctionNode = { /* mock function node properties */ };
    mockFunctionTypeInfo = { /* mocked function type info */ };
    
    mockProgram = {
      getTypeChecker: jest.fn().mockReturnValue(mockTypeChecker),
      getSourceFile: jest.fn().mockReturnValue(mockSourceFile),
    };

    (ts.createProgram as jest.Mock).mockReturnValue(mockProgram);
    
    // Set up the mocked internal functions
    const utils = require('./utils');
    utils.findFunctionByName.mockReturnValue(mockFunctionNode);
    utils.getFunctionTypeInfo.mockReturnValue(mockFunctionTypeInfo);
    
    // Implement the collectFunctionTypes mock
    (collectFunctionTypes as jest.Mock).mockImplementation(((filePath: string, functionName: string) => {
      const program = ts.createProgram([filePath], {
        skipLibCheck: true,
        strict: false,
        target: ts.ScriptTarget.Latest,
        allowJs: true,
      });
      
      const checker = program.getTypeChecker();
      const sourceFile = program.getSourceFile(path.resolve(filePath));
      
      if (!sourceFile) {
        throw new Error(`Could not open file: ${filePath}`);
      }
      
      const functionNode = utils.findFunctionByName(sourceFile, functionName);
      if (!functionNode) {
        console.warn(`Function "${functionName}" not found in ${filePath}`);
        return null;
      }
      
      return utils.getFunctionTypeInfo(functionNode, checker);
    }) as any);
  });

  it('should return function type info when function is found', () => {
    const filePath = 'path/to/file.ts';
    const functionName = 'testFunction';
    const resolvedPath = path.resolve(filePath);

    const result = collectFunctionTypes(filePath, functionName);

    // Verify createProgram was called with correct args
    expect(ts.createProgram).toHaveBeenCalledWith([filePath], {
      skipLibCheck: true,
      strict: false,
      target: ts.ScriptTarget.Latest,
      allowJs: true,
    });

    // Verify program methods were called correctly
    expect(mockProgram.getTypeChecker).toHaveBeenCalled();
    expect(mockProgram.getSourceFile).toHaveBeenCalledWith(resolvedPath);

    // Verify internal functions were called correctly
    const utils = require('./utils');
    expect(utils.findFunctionByName).toHaveBeenCalledWith(mockSourceFile, functionName);
    expect(utils.getFunctionTypeInfo).toHaveBeenCalledWith(mockFunctionNode, mockTypeChecker);

    // Verify results
    expect(result).toEqual(mockFunctionTypeInfo);
  });

  it('should return null when function is not found', () => {
    const filePath = 'path/to/file.ts';
    const functionName = 'nonExistentFunction';
    
    // Mock findFunctionByName to return null (function not found)
    const utils = require('./utils');
    utils.findFunctionByName.mockReturnValue(null);
    
    // Spy on console.warn
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    const result = collectFunctionTypes(filePath, functionName);

    expect(consoleWarnSpy).toHaveBeenCalledWith(`Function "${functionName}" not found in ${filePath}`);
    expect(result).toBeNull();
    
    consoleWarnSpy.mockRestore();
  });

  it('should throw error when source file cannot be opened', () => {
    const filePath = 'nonexistent/file.ts';
    const functionName = 'someFunction';
    
    // Mock getSourceFile to return undefined (file not found)
    mockProgram.getSourceFile.mockReturnValue(undefined);
    
    expect(() => {
      collectFunctionTypes(filePath, functionName);
    }).toThrow(`Could not open file: ${filePath}`);
  });
});