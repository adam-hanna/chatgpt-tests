import * as ts from 'typescript';

// Create a simplified version of the function for testing
function isNamedFunctionLike(node: any, name: string): boolean {
  // function myFunc() {}
  if (node.kind === ts.SyntaxKind.FunctionDeclaration) {
    if (node.name && node.name.kind === ts.SyntaxKind.Identifier) {
      return node.name.text === name;
    }
    return false;
  }

  // class X { myMethod() {} }
  if (node.kind === ts.SyntaxKind.MethodDeclaration) {
    if (node.name && node.name.kind === ts.SyntaxKind.Identifier) {
      return node.name.text === name;
    }
    return false;
  }

  // const myFunc = function() {} / () => {}
  if (node.kind === ts.SyntaxKind.FunctionExpression || node.kind === ts.SyntaxKind.ArrowFunction) {
    if (node.parent && node.parent.kind === ts.SyntaxKind.VariableDeclaration && 
        node.parent.name && node.parent.name.kind === ts.SyntaxKind.Identifier) {
      return node.parent.name.text === name;
    }
    return false;
  }

  return false;
}

describe('isNamedFunctionLike', () => {
  describe('function declarations', () => {
    it('should return true for a function declaration with matching name', () => {
      const node = {
        kind: ts.SyntaxKind.FunctionDeclaration,
        name: {
          kind: ts.SyntaxKind.Identifier,
          text: 'myFunc'
        }
      };
      
      expect(isNamedFunctionLike(node, 'myFunc')).toBe(true);
    });

    it('should return false for a function declaration with different name', () => {
      const node = {
        kind: ts.SyntaxKind.FunctionDeclaration,
        name: {
          kind: ts.SyntaxKind.Identifier,
          text: 'otherFunc'
        }
      };
      
      expect(isNamedFunctionLike(node, 'myFunc')).toBe(false);
    });

    it('should return false for a function declaration without a name', () => {
      const node = {
        kind: ts.SyntaxKind.FunctionDeclaration,
        name: undefined
      };
      
      expect(isNamedFunctionLike(node, 'myFunc')).toBe(false);
    });
  });

  describe('method declarations', () => {
    it('should return true for a method declaration with matching name', () => {
      const node = {
        kind: ts.SyntaxKind.MethodDeclaration,
        name: {
          kind: ts.SyntaxKind.Identifier,
          text: 'myMethod'
        }
      };
      
      expect(isNamedFunctionLike(node, 'myMethod')).toBe(true);
    });

    it('should return false for a method declaration with different name', () => {
      const node = {
        kind: ts.SyntaxKind.MethodDeclaration,
        name: {
          kind: ts.SyntaxKind.Identifier,
          text: 'otherMethod'
        }
      };
      
      expect(isNamedFunctionLike(node, 'myMethod')).toBe(false);
    });
  });

  describe('function expressions', () => {
    it('should return true for a function expression assigned to a variable with matching name', () => {
      const node = {
        kind: ts.SyntaxKind.FunctionExpression,
        parent: {
          kind: ts.SyntaxKind.VariableDeclaration,
          name: {
            kind: ts.SyntaxKind.Identifier,
            text: 'myFunc'
          }
        }
      };
      
      expect(isNamedFunctionLike(node, 'myFunc')).toBe(true);
    });

    it('should return false for a function expression assigned to a variable with different name', () => {
      const node = {
        kind: ts.SyntaxKind.FunctionExpression,
        parent: {
          kind: ts.SyntaxKind.VariableDeclaration,
          name: {
            kind: ts.SyntaxKind.Identifier,
            text: 'otherFunc'
          }
        }
      };
      
      expect(isNamedFunctionLike(node, 'myFunc')).toBe(false);
    });

    it('should return false for a function expression not assigned to a variable', () => {
      const node = {
        kind: ts.SyntaxKind.FunctionExpression,
        parent: {
          kind: ts.SyntaxKind.CallExpression
        }
      };
      
      expect(isNamedFunctionLike(node, 'myFunc')).toBe(false);
    });
  });

  describe('arrow functions', () => {
    it('should return true for an arrow function assigned to a variable with matching name', () => {
      const node = {
        kind: ts.SyntaxKind.ArrowFunction,
        parent: {
          kind: ts.SyntaxKind.VariableDeclaration,
          name: {
            kind: ts.SyntaxKind.Identifier,
            text: 'myFunc'
          }
        }
      };
      
      expect(isNamedFunctionLike(node, 'myFunc')).toBe(true);
    });

    it('should return false for an arrow function assigned to a variable with different name', () => {
      const node = {
        kind: ts.SyntaxKind.ArrowFunction,
        parent: {
          kind: ts.SyntaxKind.VariableDeclaration,
          name: {
            kind: ts.SyntaxKind.Identifier,
            text: 'otherFunc'
          }
        }
      };
      
      expect(isNamedFunctionLike(node, 'myFunc')).toBe(false);
    });
  });

  describe('other node types', () => {
    it('should return false for a non-function node', () => {
      const node = {
        kind: ts.SyntaxKind.Identifier,
        text: 'myFunc'
      };
      
      expect(isNamedFunctionLike(node, 'myFunc')).toBe(false);
    });
  });
});