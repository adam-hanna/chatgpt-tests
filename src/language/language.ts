export type TLanguage = {

}

export type TExportedFunction = {
    functionName: string;
    functionCode: string;
    functionTypes: string[];
}

export interface ILanguage {
    writeTestsToFile(testFilePath: string, testBlocks: string[]): void;
    runTests(rootDir: string, testFilePath: string): Promise<{ success: boolean; results: string }>;

    fileEndings(): string[];

    analyzeSourceCodeFile(filePath: string): { importStatements: string[]; exportedFunctions: TExportedFunction[] };
    exportAllDeclarations(filePath: string): Promise<void>;

    cleanup(): void;
}