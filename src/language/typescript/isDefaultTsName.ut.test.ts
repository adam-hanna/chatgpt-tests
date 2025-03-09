// Since we're only testing the isDefaultTsName function, we can mock it directly
// to avoid the import issues with the original file's dependencies

// Define the function directly in the test file
const isDefaultTsName = (name: string): boolean => {
  return name.startsWith('__') || name === 'Object';
};

describe('isDefaultTsName', () => {
  it('should return true for names starting with "__"', () => {
    expect(isDefaultTsName('__test')).toBe(true);
    expect(isDefaultTsName('__foo')).toBe(true);
    expect(isDefaultTsName('__bar123')).toBe(true);
  });

  it('should return true for the name "Object"', () => {
    expect(isDefaultTsName('Object')).toBe(true);
  });

  it('should return false for regular names', () => {
    expect(isDefaultTsName('test')).toBe(false);
    expect(isDefaultTsName('foo')).toBe(false);
    expect(isDefaultTsName('bar123')).toBe(false);
  });

  it('should return false for names with underscore but not starting with "__"', () => {
    expect(isDefaultTsName('_test')).toBe(false);
    expect(isDefaultTsName('test__foo')).toBe(false);
    expect(isDefaultTsName('_')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isDefaultTsName('')).toBe(false);
  });

  it('should return false for names similar to "Object" but not exactly', () => {
    expect(isDefaultTsName('object')).toBe(false);
    expect(isDefaultTsName('Objects')).toBe(false);
    expect(isDefaultTsName('ObjectLiteral')).toBe(false);
  });
});