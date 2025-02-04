export type TLanguage = {

}

export type TFunctionTypeInfo = {
    parameters: Array<{ name: string; type: TComplexTypeDefinition | null }>;
    returnType: TComplexTypeDefinition | null;
    localVariables: Array<{ name: string; type: TComplexTypeDefinition | null }>;
}

/**
 * Represents a user-defined or "complex" type structure.
 * (This is a naive shape; feel free to extend.)
 */
export type TComplexTypeDefinition =
    | {
        kind: 'object';
        name?: string; // e.g. interface name, class name
        properties: Record<string, TComplexTypeDefinition | null>;
    }
    | {
        kind: 'union';
        types: Array<TComplexTypeDefinition | null>;
    }
    // You could add intersection, alias, enum, etc. if needed
    ;

export interface ILanguage {
    writeTestsToFile(functionName: string, testBlocks: string[], sourceFilePath: string): void;
    runTests(rootDir: string, testFilePath: string): Promise<{ success: boolean; results: string }>;

    fileEndings(): string[];

    extractFunctions(filePath: string): { name: string; code: string; exported: boolean }[];
    extractImports(filePath: string): string[];
    extractTypesForFunction(filePath: string, functionName: string): TFunctionTypeInfo | null;

    cleanup(): void;
}