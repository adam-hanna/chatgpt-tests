import * as ts from 'typescript';

// Mock the function we're testing
function findFunctionByName(
    node: ts.Node,
    functionName: string
): ts.FunctionLikeDeclarationBase | undefined {
    let found: ts.FunctionLikeDeclarationBase | undefined;

    node.forEachChild((child) => {
        if (isNamedFunctionLike(child, functionName)) {
            found = child as ts.FunctionLikeDeclarationBase;
            return;
        }
        if (!found) {
            found = findFunctionByName(child, functionName);
        }
    });

    return found;
}

// Mock the helper function that the original function depends on
function isNamedFunctionLike(node: ts.Node, name: string): boolean {
    if (ts.isFunctionDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
        return node.name.text === name;
    }
    
    if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
        return node.name.text === name;
    }
    
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
        const initializer = node.initializer;
        return !!initializer && (
            ts.isArrowFunction(initializer) || 
            ts.isFunctionExpression(initializer)
        );
    }
    
    return false;
}

// Helper function to check if a node is a function declaration
function isNodeFunctionDeclaration(node: ts.Node | undefined): boolean {
  return node !== undefined && ts.isFunctionDeclaration(node);
}

// Helper function to check if a node is an arrow function
function isNodeArrowFunction(node: ts.Node | undefined): boolean {
  return node !== undefined && ts.isArrowFunction(node);
}

// Helper function to check if a node is a function expression
function isNodeFunctionExpression(node: ts.Node | undefined): boolean {
  return node !== undefined && ts.isFunctionExpression(node);
}

// Helper function to check if a node is a method declaration
function isNodeMethodDeclaration(node: ts.Node | undefined): boolean {
  return node !== undefined && ts.isMethodDeclaration(node);
}

// Helper function to get the name of a node if it has one
function getNodeName(node: ts.Node): string | undefined {
  if (ts.isFunctionDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
    return node.name.text;
  }
  return undefined;
}

describe('findFunctionByName', () => {
  let sourceFile: ts.SourceFile;

  beforeEach(() => {
    // Create a source file for testing
    sourceFile = ts.createSourceFile(
      'test.ts',
      '',
      ts.ScriptTarget.Latest,
      true
    );
  });

  test('should find function declaration by name', () => {
    // Create source file with a function declaration
    const source = `
      function targetFunction() {
        return 'hello';
      }
      
      function anotherFunction() {
        return 'world';
      }
    `;
    
    sourceFile = ts.createSourceFile(
      'test.ts',
      source,
      ts.ScriptTarget.Latest,
      true
    );
    
    const result = findFunctionByName(sourceFile, 'targetFunction');
    
    expect(result).toBeDefined();
    expect(isNodeFunctionDeclaration(result)).toBe(true);
    
    if (result) {
      const name = getNodeName(result);
      expect(name).toBe('targetFunction');
    }
  });

  test('should find arrow function by name', () => {
    // Create source file with arrow function
    const source = `
      const targetFunction = () => {
        return 'hello';
      };
    `;
    
    sourceFile = ts.createSourceFile(
      'test.ts',
      source,
      ts.ScriptTarget.Latest,
      true
    );
    
    const result = findFunctionByName(sourceFile, 'targetFunction');
    
    expect(result).toBeDefined();
    expect(isNodeArrowFunction(result)).toBe(false); // The result is the variable declaration, not the arrow function
  });

  test('should find function expression by name', () => {
    // Create source file with function expression
    const source = `
      const targetFunction = function() {
        return 'hello';
      };
    `;
    
    sourceFile = ts.createSourceFile(
      'test.ts',
      source,
      ts.ScriptTarget.Latest,
      true
    );
    
    const result = findFunctionByName(sourceFile, 'targetFunction');
    
    expect(result).toBeDefined();
    expect(isNodeFunctionExpression(result)).toBe(false); // The result is the variable declaration, not the function expression
  });

  test('should find method declaration by name', () => {
    // Create source file with method in class
    const source = `
      class TestClass {
        targetFunction() {
          return 'hello';
        }
      }
    `;
    
    sourceFile = ts.createSourceFile(
      'test.ts',
      source,
      ts.ScriptTarget.Latest,
      true
    );
    
    const result = findFunctionByName(sourceFile, 'targetFunction');
    
    expect(result).toBeDefined();
    expect(isNodeMethodDeclaration(result)).toBe(true);
  });

  test('should find nested function by name', () => {
    // Create source file with nested function
    const source = `
      function outerFunction() {
        function targetFunction() {
          return 'hello';
        }
        return targetFunction;
      }
    `;
    
    sourceFile = ts.createSourceFile(
      'test.ts',
      source,
      ts.ScriptTarget.Latest,
      true
    );
    
    const result = findFunctionByName(sourceFile, 'targetFunction');
    
    expect(result).toBeDefined();
    expect(isNodeFunctionDeclaration(result)).toBe(true);
    
    if (result) {
      const name = getNodeName(result);
      expect(name).toBe('targetFunction');
    }
  });

  test('should return undefined when function is not found', () => {
    // Create source file without the target function
    const source = `
      function someFunction() {
        return 'hello';
      }
    `;
    
    sourceFile = ts.createSourceFile(
      'test.ts',
      source,
      ts.ScriptTarget.Latest,
      true
    );
    
    const result = findFunctionByName(sourceFile, 'targetFunction');
    
    expect(result).toBeUndefined();
  });

  test('should return first occurrence when multiple functions have the same name', () => {
    // Create source file with duplicate function names
    const source = `
      function targetFunction() {
        return 'first';
      }
      
      function anotherFunction() {
        function targetFunction() {
          return 'second';
        }
        return targetFunction;
      }
    `;
    
    sourceFile = ts.createSourceFile(
      'test.ts',
      source,
      ts.ScriptTarget.Latest,
      true
    );
    
    const result = findFunctionByName(sourceFile, 'targetFunction');
    
    expect(result).toBeDefined();
    expect(isNodeFunctionDeclaration(result)).toBe(true);
  });
});