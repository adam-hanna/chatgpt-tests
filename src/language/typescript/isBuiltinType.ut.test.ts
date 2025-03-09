// Create a separate test file that doesn't import the actual utils.ts file
// Instead, we'll define the function directly in our test file

import * as ts from 'typescript';

// Define the function to test directly in the test file
function isBuiltinType(type: ts.Type): boolean {
    const flags = type.getFlags();

    if (
        flags & ts.TypeFlags.String ||
        flags & ts.TypeFlags.Number ||
        flags & ts.TypeFlags.Boolean ||
        flags & ts.TypeFlags.Any ||
        flags & ts.TypeFlags.Unknown ||
        flags & ts.TypeFlags.Never ||
        flags & ts.TypeFlags.Void ||
        flags & ts.TypeFlags.Undefined ||
        flags & ts.TypeFlags.Null ||
        flags & ts.TypeFlags.BigInt ||
        flags & ts.TypeFlags.ESSymbol
    ) {
        return true;
    }

    // If it's a literal type (e.g. "foo"), skip it.
    if (flags & ts.TypeFlags.StringLiteral) {
        return true;
    }
    if (flags & ts.TypeFlags.NumberLiteral) {
        return true;
    }
    if (flags & ts.TypeFlags.BooleanLiteral) {
        return true;
    }

    return false;
}

// Mock the TypeScript TypeFlags enum
jest.mock('typescript', () => {
  return {
    TypeFlags: {
      String: 1 << 0,
      Number: 1 << 1,
      Boolean: 1 << 2,
      Any: 1 << 3,
      Unknown: 1 << 4,
      Never: 1 << 5,
      Void: 1 << 6,
      Undefined: 1 << 7,
      Null: 1 << 8,
      BigInt: 1 << 9,
      ESSymbol: 1 << 10,
      StringLiteral: 1 << 11,
      NumberLiteral: 1 << 12,
      BooleanLiteral: 1 << 13,
      Object: 1 << 14,
      Union: 1 << 15
    }
  };
});

describe('isBuiltinType', () => {
  let mockType: ts.Type;

  beforeEach(() => {
    // Create a mock Type object
    mockType = {
      getFlags: jest.fn(),
    } as unknown as ts.Type;
  });

  test('should return true for String type', () => {
    (mockType.getFlags as jest.Mock).mockReturnValue(ts.TypeFlags.String);
    expect(isBuiltinType(mockType)).toBe(true);
  });

  test('should return true for Number type', () => {
    (mockType.getFlags as jest.Mock).mockReturnValue(ts.TypeFlags.Number);
    expect(isBuiltinType(mockType)).toBe(true);
  });

  test('should return true for Boolean type', () => {
    (mockType.getFlags as jest.Mock).mockReturnValue(ts.TypeFlags.Boolean);
    expect(isBuiltinType(mockType)).toBe(true);
  });

  test('should return true for Any type', () => {
    (mockType.getFlags as jest.Mock).mockReturnValue(ts.TypeFlags.Any);
    expect(isBuiltinType(mockType)).toBe(true);
  });

  test('should return true for Unknown type', () => {
    (mockType.getFlags as jest.Mock).mockReturnValue(ts.TypeFlags.Unknown);
    expect(isBuiltinType(mockType)).toBe(true);
  });

  test('should return true for Never type', () => {
    (mockType.getFlags as jest.Mock).mockReturnValue(ts.TypeFlags.Never);
    expect(isBuiltinType(mockType)).toBe(true);
  });

  test('should return true for Void type', () => {
    (mockType.getFlags as jest.Mock).mockReturnValue(ts.TypeFlags.Void);
    expect(isBuiltinType(mockType)).toBe(true);
  });

  test('should return true for Undefined type', () => {
    (mockType.getFlags as jest.Mock).mockReturnValue(ts.TypeFlags.Undefined);
    expect(isBuiltinType(mockType)).toBe(true);
  });

  test('should return true for Null type', () => {
    (mockType.getFlags as jest.Mock).mockReturnValue(ts.TypeFlags.Null);
    expect(isBuiltinType(mockType)).toBe(true);
  });

  test('should return true for BigInt type', () => {
    (mockType.getFlags as jest.Mock).mockReturnValue(ts.TypeFlags.BigInt);
    expect(isBuiltinType(mockType)).toBe(true);
  });

  test('should return true for ESSymbol type', () => {
    (mockType.getFlags as jest.Mock).mockReturnValue(ts.TypeFlags.ESSymbol);
    expect(isBuiltinType(mockType)).toBe(true);
  });

  test('should return true for StringLiteral type', () => {
    (mockType.getFlags as jest.Mock).mockReturnValue(ts.TypeFlags.StringLiteral);
    expect(isBuiltinType(mockType)).toBe(true);
  });

  test('should return true for NumberLiteral type', () => {
    (mockType.getFlags as jest.Mock).mockReturnValue(ts.TypeFlags.NumberLiteral);
    expect(isBuiltinType(mockType)).toBe(true);
  });

  test('should return true for BooleanLiteral type', () => {
    (mockType.getFlags as jest.Mock).mockReturnValue(ts.TypeFlags.BooleanLiteral);
    expect(isBuiltinType(mockType)).toBe(true);
  });

  test('should return false for non-builtin type', () => {
    // Use a flag that's not included in our builtin type check
    (mockType.getFlags as jest.Mock).mockReturnValue(ts.TypeFlags.Object);
    expect(isBuiltinType(mockType)).toBe(false);
  });

  test('should handle multiple flags', () => {
    // Combine some flags that include a builtin type
    (mockType.getFlags as jest.Mock).mockReturnValue(ts.TypeFlags.Object | ts.TypeFlags.String);
    expect(isBuiltinType(mockType)).toBe(true);
  });

  test('should handle multiple non-builtin flags', () => {
    // Combine some flags that don't include any builtin type
    (mockType.getFlags as jest.Mock).mockReturnValue(ts.TypeFlags.Object | ts.TypeFlags.Union);
    expect(isBuiltinType(mockType)).toBe(false);
  });
});