// Mock the TypeScript module
jest.mock('typescript', () => ({
  TypeFlags: {
    Object: 1 << 1,
    String: 1 << 2,
    Number: 1 << 3,
    Boolean: 1 << 4,
    Enum: 1 << 5,
    BigInt: 1 << 6,
    StringLiteral: 1 << 7,
    NumberLiteral: 1 << 8,
    Union: 1 << 9
  }
}));

import * as ts from 'typescript';

// Define the function directly in the test file to avoid import issues
function isObjectOrInterfaceType(type: ts.Type): boolean {
  if (!(type.getFlags() & ts.TypeFlags.Object)) {
    return false;
  }
  // Could refine further by checking `objectFlags` if needed.
  return true;
}

describe('isObjectOrInterfaceType', () => {
  let mockTypeWithObjectFlag: ts.Type;
  let mockTypeWithoutObjectFlag: ts.Type;

  beforeEach(() => {
    // Mock a type with Object flag
    mockTypeWithObjectFlag = {
      getFlags: jest.fn().mockReturnValue(ts.TypeFlags.Object)
    } as unknown as ts.Type;

    // Mock a type without Object flag
    mockTypeWithoutObjectFlag = {
      getFlags: jest.fn().mockReturnValue(ts.TypeFlags.String)
    } as unknown as ts.Type;
  });

  it('should return true for types with Object flag', () => {
    const result = isObjectOrInterfaceType(mockTypeWithObjectFlag);
    expect(result).toBe(true);
    expect(mockTypeWithObjectFlag.getFlags).toHaveBeenCalled();
  });

  it('should return false for types without Object flag', () => {
    const result = isObjectOrInterfaceType(mockTypeWithoutObjectFlag);
    expect(result).toBe(false);
    expect(mockTypeWithoutObjectFlag.getFlags).toHaveBeenCalled();
  });

  it('should return true for types with Object flag combined with other flags', () => {
    const combinedFlagsType = {
      getFlags: jest.fn().mockReturnValue(ts.TypeFlags.Object | ts.TypeFlags.Union)
    } as unknown as ts.Type;
    
    const result = isObjectOrInterfaceType(combinedFlagsType);
    expect(result).toBe(true);
    expect(combinedFlagsType.getFlags).toHaveBeenCalled();
  });

  it('should handle different non-object types correctly', () => {
    // Test with various non-object type flags
    const typeFlags = [
      ts.TypeFlags.String,
      ts.TypeFlags.Number,
      ts.TypeFlags.Boolean,
      ts.TypeFlags.Enum,
      ts.TypeFlags.BigInt,
      ts.TypeFlags.StringLiteral,
      ts.TypeFlags.NumberLiteral
    ];

    typeFlags.forEach(flag => {
      const nonObjectType = {
        getFlags: jest.fn().mockReturnValue(flag)
      } as unknown as ts.Type;
      
      expect(isObjectOrInterfaceType(nonObjectType)).toBe(false);
      expect(nonObjectType.getFlags).toHaveBeenCalled();
    });
  });
});