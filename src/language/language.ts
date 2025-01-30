export type TLanguage = {

}

export interface ILanguage {
    writeTestsToFile(functionName: string, testBlocks: string[], sourceFilePath: string): void;
    runTests(rootDir: string, testFilePath: string): Promise<{ success: boolean; results: string }>;

    fileEndings(): string[];

    extractFunctions(filePath: string): { name: string; code: string; exported: boolean }[];
    extractImports(filePath: string): string[];
    exportTypes(filePath: string): string[];

    cleanup(): void;
}