import { writeFileSync } from 'fs';
import { Typescript } from './typescript';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  promises: {
    writeFile: jest.fn(),
  },
  openSync: jest.fn(),
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  basename: jest.fn(path => path.split('/').pop()),
  dirname: jest.fn(path => path.split('/').slice(0, -1).join('/')),
  extname: jest.fn(path => {
    const parts = path.split('.');
    return parts.length > 1 ? '.' + parts.pop() : '';
  }),
  resolve: jest.fn((...args) => args.join('/')),
}));

jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

jest.mock('tmp', () => ({
  dirSync: jest.fn(() => ({
    name: '/tmp/mock-dir',
    removeCallback: jest.fn(),
  })),
}));

jest.mock('typescript', () => ({
  createSourceFile: jest.fn(),
  ScriptTarget: { Latest: 'Latest' },
  SyntaxKind: {
    ExportKeyword: 'ExportKeyword',
    PublicKeyword: 'PublicKeyword',
    PrivateKeyword: 'PrivateKeyword',
    ProtectedKeyword: 'ProtectedKeyword',
  },
  factory: {
    createModifier: jest.fn(),
    updateVariableStatement: jest.fn(),
    updateFunctionDeclaration: jest.fn(),
    updateClassDeclaration: jest.fn(),
    updateInterfaceDeclaration: jest.fn(),
    updateTypeAliasDeclaration: jest.fn(),
    updateEnumDeclaration: jest.fn(),
    updateModuleDeclaration: jest.fn(),
  },
  transform: jest.fn(),
  createPrinter: jest.fn().mockReturnValue({
    printFile: jest.fn().mockReturnValue('transformed code'),
  }),
  NewLineKind: { LineFeed: 'LineFeed' },
  isImportDeclaration: jest.fn(),
  isVariableStatement: jest.fn(),
  isVariableDeclaration: jest.fn(),
  isIdentifier: jest.fn(),
  isCallExpression: jest.fn(),
  isTypeAliasDeclaration: jest.fn(),
  isInterfaceDeclaration: jest.fn(),
  isFunctionDeclaration: jest.fn(),
  isClassDeclaration: jest.fn(),
  isEnumDeclaration: jest.fn(),
  isArrowFunction: jest.fn(),
  isFunctionExpression: jest.fn(),
  isMethodDeclaration: jest.fn(),
  isStringLiteral: jest.fn(),
  isComputedPropertyName: jest.fn(),
  isSourceFile: jest.fn(),
  isModuleDeclaration: jest.fn(),
  visitEachChild: jest.fn((node, visitor) => node),
  visitNode: jest.fn((node, visitor) => node),
  forEachChild: jest.fn(),
}));

describe('Typescript class', () => {
  describe('writeTestsToFile', () => {
    let typescript: Typescript;
    
    beforeEach(() => {
      jest.clearAllMocks();
      typescript = new Typescript({} as any);
    });

    it('should write test blocks to the specified file path', () => {
      // Arrange
      const testFilePath = 'path/to/testfile.test.ts';
      const testBlocks = [
        'describe("test1", () => { it("should work", () => {}) })',
        'describe("test2", () => { it("should also work", () => {}) })'
      ];
      const expectedContent = testBlocks.join('\n\n');

      // Act
      typescript.writeTestsToFile(testFilePath, testBlocks);

      // Assert
      expect(fs.writeFileSync).toHaveBeenCalledWith(testFilePath, expectedContent);
    });

    it('should write empty string if test blocks array is empty', () => {
      // Arrange
      const testFilePath = 'path/to/testfile.test.ts';
      const testBlocks: string[] = [];

      // Act
      typescript.writeTestsToFile(testFilePath, testBlocks);

      // Assert
      expect(fs.writeFileSync).toHaveBeenCalledWith(testFilePath, '');
    });

    it('should handle a single test block properly', () => {
      // Arrange
      const testFilePath = 'path/to/testfile.test.ts';
      const testBlocks = ['describe("single test", () => { it("works", () => {}) })'];

      // Act
      typescript.writeTestsToFile(testFilePath, testBlocks);

      // Assert
      expect(fs.writeFileSync).toHaveBeenCalledWith(testFilePath, testBlocks[0]);
    });

    it('should pass the file path directly to writeFileSync', () => {
      // Arrange
      const testFilePath = '/absolute/path/to/testfile.test.ts';
      const testBlocks = ['test'];

      // Act
      typescript.writeTestsToFile(testFilePath, testBlocks);

      // Assert
      expect(fs.writeFileSync).toHaveBeenCalledWith(testFilePath, 'test');
    });

    it('should handle test blocks with special characters', () => {
      // Arrange
      const testFilePath = 'path/to/testfile.test.ts';
      const testBlocks = [
        'describe("test with \\"quotes\\"", () => {})',
        'describe("test with \\n newlines", () => {})'
      ];
      const expectedContent = testBlocks.join('\n\n');

      // Act
      typescript.writeTestsToFile(testFilePath, testBlocks);

      // Assert
      expect(fs.writeFileSync).toHaveBeenCalledWith(testFilePath, expectedContent);
    });
  });
});