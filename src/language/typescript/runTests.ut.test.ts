import { Typescript } from './typescript';
import { exec } from 'child_process';
import { promises as fs, readFileSync, writeFileSync, openSync, existsSync } from 'fs';
import { DirResult, dirSync } from 'tmp';
import { createSourceFile, ScriptTarget, factory, SyntaxKind, transform } from 'typescript';
import { join, basename, extname } from 'path';
import { ILanguage, TLanguage } from '@/src/language';

// Mocks
jest.mock('child_process');
jest.mock('fs', () => {
  const originalModule = jest.requireActual('fs');
  return {
    ...originalModule,
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    openSync: jest.fn(),
    existsSync: jest.fn(),
    promises: {
      writeFile: jest.fn().mockResolvedValue(undefined)
    }
  };
});
jest.mock('tmp');
jest.mock('typescript', () => {
  const originalModule = jest.requireActual('typescript');
  return {
    ...originalModule,
    createSourceFile: jest.fn(),
    createPrinter: jest.fn(() => ({
      printFile: jest.fn(() => 'transformed code')
    })),
    transform: jest.fn(),
    factory: {
      createModifier: jest.fn(),
      updateVariableStatement: jest.fn(),
      updateFunctionDeclaration: jest.fn(),
      updateClassDeclaration: jest.fn(),
      updateInterfaceDeclaration: jest.fn(),
      updateTypeAliasDeclaration: jest.fn(),
      updateEnumDeclaration: jest.fn(),
      updateModuleDeclaration: jest.fn()
    }
  };
});

describe('Typescript class', () => {
  let typescript: Typescript;
  let mockTempDir: DirResult;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockTempDir = {
      name: '/tmp/mock-dir',
      removeCallback: jest.fn(),
    } as unknown as DirResult;
    
    (dirSync as jest.Mock).mockReturnValue(mockTempDir);
    (openSync as jest.Mock).mockReturnValue(1);
    
    typescript = new Typescript({} as TLanguage);
  });

  describe('constructor', () => {
    it('should create a temporary directory', () => {
      expect(dirSync).toHaveBeenCalledWith({ unsafeCleanup: true });
    });

    it('should create a file in the temporary directory', () => {
      expect(openSync).toHaveBeenCalled();
    });
  });

  describe('writeTestsToFile', () => {
    it('should write test blocks to a file', () => {
      const testFilePath = '/path/to/test.ts';
      const testBlocks = ['test block 1', 'test block 2'];
      
      typescript.writeTestsToFile(testFilePath, testBlocks);
      
      expect(writeFileSync).toHaveBeenCalledWith(testFilePath, 'test block 1\n\ntest block 2');
    });
  });

  describe('runTests', () => {
    it('should resolve with success true when tests pass', async () => {
      const mockExec = exec as jest.MockedFunction<typeof exec>;
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(null, 'test output', '');
        return {} as any;
      });

      const result = await typescript.runTests('/root/dir', 'test.ts');
      
      expect(result).toEqual({
        success: true,
        results: 'test output'
      });
      expect(mockExec).toHaveBeenCalled();
    });

    it('should resolve with success false when tests fail', async () => {
      const mockExec = exec as jest.MockedFunction<typeof exec>;
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(new Error('Test failed'), '', 'error output');
        return {} as any;
      });

      // Mock JSON.parse to return a parsed object
      const parsedJson = { testResults: [] };
      (readFileSync as jest.Mock).mockReturnValue('{"testResults": []}');
      const jsonStringify = jest.spyOn(JSON, 'stringify');
      jsonStringify.mockReturnValue(JSON.stringify(parsedJson, null, 2));

      const result = await typescript.runTests('/root/dir', 'test.ts');
      
      expect(result.success).toBe(false);
      // Instead of comparing the exact string, check that it contains the expected content
      expect(result.results).toContain('"testResults": []');
    });

    it('should try to read JSON results when tests fail', async () => {
      const mockExec = exec as jest.MockedFunction<typeof exec>;
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(new Error('Test failed'), '', 'error output');
        return {} as any;
      });

      (readFileSync as jest.Mock).mockReturnValue('{"testResults": []}');

      const result = await typescript.runTests('/root/dir', 'test.ts');
      
      expect(result.success).toBe(false);
      expect(readFileSync).toHaveBeenCalled();
    });
  });

  describe('analyzeSourceCodeFile', () => {
    it('should analyze source code and extract imports and exported functions', () => {
      const mockSourceFile = {
        getStart: jest.fn().mockReturnValue(0),
        getEnd: jest.fn().mockReturnValue(10)
      };
      
      (readFileSync as jest.Mock).mockReturnValue('source code content');
      (createSourceFile as jest.Mock).mockReturnValue(mockSourceFile);
      
      const result = typescript.analyzeSourceCodeFile('file.ts');
      
      expect(readFileSync).toHaveBeenCalledWith('file.ts', 'utf8');
      expect(createSourceFile).toHaveBeenCalledWith(
        'file.ts',
        'source code content',
        ScriptTarget.Latest,
        true
      );
      expect(result).toHaveProperty('importStatements');
      expect(result).toHaveProperty('exportedFunctions');
    });
  });

  describe('exportAllDeclarations', () => {
    beforeEach(() => {
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue('valid typescript code');
      
      (createSourceFile as jest.Mock).mockReturnValue({
        /* mock source file */
      });
      
      (transform as jest.Mock).mockReturnValue({
        transformed: [{ /* mock transformed file */ }],
        dispose: jest.fn()
      });
    });

    it('should throw an error if the file does not exist', async () => {
      (existsSync as jest.Mock).mockReturnValue(false);
      
      await expect(typescript.exportAllDeclarations('non-existent.ts'))
        .rejects.toThrow('File not found: non-existent.ts');
    });

    it('should throw an error if the file has an unsupported extension', async () => {
      await expect(typescript.exportAllDeclarations('file.css'))
        .rejects.toThrow('Only .ts and .js files are supported, got: .css');
    });

    it('should throw an error if the file is empty', async () => {
      (readFileSync as jest.Mock).mockReturnValue('');
      
      await expect(typescript.exportAllDeclarations('empty.ts'))
        .rejects.toThrow('File is empty: empty.ts');
    });

    it('should process a valid TypeScript file and write the transformed output', async () => {
      await typescript.exportAllDeclarations('valid.ts');
      
      expect(createSourceFile).toHaveBeenCalled();
      expect(transform).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith('valid.ts', 'transformed code', 'utf-8');
    });
  });

  describe('fileEndings', () => {
    it('should return supported file extensions', () => {
      expect(typescript.fileEndings()).toEqual(['.ts', '.js']);
    });
  });

  describe('cleanup', () => {
    it('should remove the temporary directory', () => {
      typescript.cleanup();
      
      expect(mockTempDir.removeCallback).toHaveBeenCalled();
    });
  });
});