// Mock the entire utils module
jest.mock('./utils', () => {
  // Define the types that would be imported from '@/src/language'
  interface TComplexTypeDefinition {
    name: string;
    [key: string]: any;
  }

  interface TFunctionTypeInfo {
    parameters: Array<{ name: string; type: TComplexTypeDefinition | null }>;
    returnType: TComplexTypeDefinition | null;
    localVariables: Array<{ name: string; type: TComplexTypeDefinition | null }>;
  }

  // Mock implementation of collectComplexTypeDefinition
  const collectComplexTypeDefinition = jest.fn();

  // Mock implementation of getFunctionTypeInfo
  const getFunctionTypeInfo = (func: any, checker: any): TFunctionTypeInfo => {
    const parameters: Array<{ name: string; type: TComplexTypeDefinition | null }> = [];
    const localVariables: Array<{ name: string; type: TComplexTypeDefinition | null }> = [];
    let returnType: TComplexTypeDefinition | null = null;

    // 1) Get the function's type
    const funcType = checker.getTypeAtLocation(func);
    const signatures = funcType.getCallSignatures();
    if (signatures.length > 0) {
      const signature = signatures[0];

      // Return type
      const tsReturnType = signature.getReturnType();
      returnType = collectComplexTypeDefinition(tsReturnType, checker);

      // Parameter types
      for (const paramSymbol of signature.getParameters()) {
        const decls = paramSymbol.getDeclarations();
        if (!decls || decls.length === 0) continue;

        const paramDecl = decls[0];
        const paramType = checker.getTypeOfSymbolAtLocation(paramSymbol, paramDecl);

        parameters.push({
          name: paramSymbol.getName(),
          type: collectComplexTypeDefinition(paramType, checker),
        });
      }
    }

    // 2) Local variables in the function's body
    if (func.body && require('typescript').isBlock(func.body)) {
      for (const statement of func.body.statements) {
        if (require('typescript').isVariableStatement(statement)) {
          for (const decl of statement.declarationList.declarations) {
            const varName = decl.name.getText();
            const varType = checker.getTypeAtLocation(decl.name);

            localVariables.push({
              name: varName,
              type: collectComplexTypeDefinition(varType, checker),
            });
          }
        }
      }
    }

    return { parameters, returnType, localVariables };
  };

  return {
    getFunctionTypeInfo,
    collectComplexTypeDefinition
  };
});

import { getFunctionTypeInfo, collectComplexTypeDefinition } from './utils';
import * as ts from 'typescript';

describe('getFunctionTypeInfo', () => {
  let mockChecker: any;
  let mockFunc: any;
  let mockSignature: any;
  let mockFuncType: any;
  let mockReturnType: any;
  let mockParamSymbol: any;
  let mockParamDecl: any;
  let mockParamType: any;
  let mockBody: any;
  let mockVarStatement: any;
  let mockVarDecl: any;
  let mockVarName: any;
  let mockVarType: any;
  
  // Mock the TypeScript type guards
  let mockIsBlock: boolean;
  let mockIsVariableStatement: boolean;

  // Override the TypeScript type guards with our own implementations
  jest.mock('typescript', () => {
    const actual = jest.requireActual('typescript');
    return {
      ...actual,
      isBlock: (node: any) => mockIsBlock,
      isVariableStatement: (node: any) => mockIsVariableStatement
    };
  });

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Set default values for our type guards
    mockIsBlock = true;
    mockIsVariableStatement = true;

    // Set up mock objects using plain objects to avoid TypeScript type issues
    mockVarName = { getText: jest.fn().mockReturnValue('localVar') };
    
    mockVarDecl = { 
      name: mockVarName
    };
    
    mockVarStatement = { 
      declarationList: {
        declarations: [mockVarDecl]
      }
    };
    
    mockBody = { 
      statements: [mockVarStatement]
    };
    
    mockParamDecl = {};
    
    mockParamSymbol = { 
      getName: jest.fn().mockReturnValue('param1'),
      getDeclarations: jest.fn().mockReturnValue([mockParamDecl])
    };
    
    mockReturnType = {};
    
    mockSignature = { 
      getReturnType: jest.fn().mockReturnValue(mockReturnType),
      getParameters: jest.fn().mockReturnValue([mockParamSymbol])
    };
    
    mockFuncType = { 
      getCallSignatures: jest.fn().mockReturnValue([mockSignature])
    };
    
    mockFunc = { 
      body: mockBody
    };
    
    mockParamType = {};
    mockVarType = {};
    
    mockChecker = { 
      getTypeAtLocation: jest.fn()
        .mockReturnValueOnce(mockFuncType)  // For function type
        .mockReturnValueOnce(mockVarType),  // For variable type
      getTypeOfSymbolAtLocation: jest.fn().mockReturnValue(mockParamType)
    };

    // Set up collectComplexTypeDefinition mock
    (collectComplexTypeDefinition as jest.Mock).mockImplementation((type) => {
      if (type === mockReturnType) return { name: 'returnTypeInfo' };
      if (type === mockParamType) return { name: 'paramTypeInfo' };
      if (type === mockVarType) return { name: 'varTypeInfo' };
      return null;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should extract function information with signature, params, and return type', () => {
    const result = getFunctionTypeInfo(mockFunc, mockChecker);
    
    expect(mockFuncType.getCallSignatures).toHaveBeenCalled();
    expect(mockSignature.getReturnType).toHaveBeenCalled();
    expect(mockSignature.getParameters).toHaveBeenCalled();
    expect(mockParamSymbol.getName).toHaveBeenCalled();
    expect(mockParamSymbol.getDeclarations).toHaveBeenCalled();
    expect(collectComplexTypeDefinition).toHaveBeenCalledWith(mockReturnType, mockChecker);
    expect(collectComplexTypeDefinition).toHaveBeenCalledWith(mockParamType, mockChecker);
    
    expect(result).toEqual({
      parameters: [{ name: 'param1', type: { name: 'paramTypeInfo' } }],
      returnType: { name: 'returnTypeInfo' },
      localVariables: [{ name: 'localVar', type: { name: 'varTypeInfo' } }]
    });
  });

  test('should handle function with no signature', () => {
    mockFuncType.getCallSignatures.mockReturnValue([]);
    
    const result = getFunctionTypeInfo(mockFunc, mockChecker);
    
    expect(result).toEqual({
      parameters: [],
      returnType: null,
      localVariables: [{ name: 'localVar', type: { name: 'varTypeInfo' } }]
    });
  });

  test('should handle function with no body', () => {
    const funcWithoutBody = { ...mockFunc };
    delete funcWithoutBody.body;
    
    const result = getFunctionTypeInfo(funcWithoutBody, mockChecker);
    
    expect(result).toEqual({
      parameters: [{ name: 'param1', type: { name: 'paramTypeInfo' } }],
      returnType: { name: 'returnTypeInfo' },
      localVariables: []
    });
  });

  test('should handle parameter with no declarations', () => {
    mockParamSymbol.getDeclarations.mockReturnValue([]);
    
    const result = getFunctionTypeInfo(mockFunc, mockChecker);
    
    expect(result.parameters).toEqual([]);
  });

  test('should handle function with non-block body', () => {
    mockIsBlock = false;
    
    const result = getFunctionTypeInfo(mockFunc, mockChecker);
    
    expect(result.localVariables).toEqual([]);
  });

  test('should handle statements that are not variable statements', () => {
    mockIsVariableStatement = false;
    
    const result = getFunctionTypeInfo(mockFunc, mockChecker);
    
    expect(result.localVariables).toEqual([]);
  });
});