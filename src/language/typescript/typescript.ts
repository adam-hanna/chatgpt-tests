import { exec } from 'child_process';
import { dirname, join, resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { DirResult, dirSync } from 'tmp';
import { createSourceFile, ScriptTarget, Node, isFunctionDeclaration, isClassDeclaration, isInterfaceDeclaration, isEnumDeclaration, isVariableStatement, SyntaxKind, isVariableDeclaration, isIdentifier, isArrowFunction, isFunctionExpression, forEachChild, StringLiteral, isImportDeclaration, isImportEqualsDeclaration, isExternalModuleReference, isStringLiteral, isCallExpression, createProgram, FunctionLikeDeclarationBase, isMethodDeclaration, TypeChecker, isBlock, isTypeAliasDeclaration } from 'typescript';

import { ILanguage, TExportedFunction, TLanguage } from '@/src/language';

export type TTypescript = {

} & TLanguage;

export class Typescript implements ILanguage {
    constructor(config: TTypescript) {
        console.debug('New Typescript class');
        this.config = config;
        this.tempDir = dirSync({ unsafeCleanup: true });
    }

    public writeTestsToFile(functionName: string, testBlocks: string[], sourceFilePath: string): void {
        const testFileName = `${functionName}.test.ts`;
        const testDir = dirname(sourceFilePath);
        const testFilePath = join(testDir, testFileName);

        const content = testBlocks.join('\n\n'); // Combine all test blocks
        writeFileSync(testFilePath, content);
    }

    public async runTests(rootDir: string, testFilePath: string): Promise<{ success: boolean; results: string }> {
        return new Promise((resolve) => {
            const testResultsLocation = join(this.tempDir.name, 'jest-results.json')
            exec(`npx jest --json --outputFile=${testResultsLocation} --root=${rootDir} ${testFilePath}`, (error, stdout, stderr) => {
                if (error) {
                    // Read Jest results file for structured failure details
                    let results = stderr || stdout;
                    try {
                        const jsonResults = JSON.parse(readFileSync(testResultsLocation, 'utf-8'));
                        results = JSON.stringify(jsonResults, null, 2);
                    } catch {
                        // Fall back to raw output if JSON parsing fails
                    }
                    resolve({ success: false, results });
                } else {
                    resolve({ success: true, results: stdout });
                }
            });
        });
    }

    public analyzeSourceCodeFile(filePath: string): { importStatements: string[]; exportedFunctions: TExportedFunction[] } {
        const fileContent = readFileSync(filePath, 'utf8');

        // Create a SourceFile object
        const sourceFile = createSourceFile(
            filePath,
            fileContent,
            ScriptTarget.Latest,
            true
        );

        const importStatements: string[] = [];
        const typeDefinitions: Map<string, string> = new Map();
        const exportedFunctions: TExportedFunction[] = [];

        // Helper function to get the text of a node
        function getNodeText(node: Node): string {
            return fileContent.substring(node.getStart(sourceFile), node.getEnd()).trim();
        }

        // First pass: collect all import statements and type definitions
        function collectImportsAndTypes(node: Node) {
            // Collect import statements
            if (isImportDeclaration(node)) {
                importStatements.push(getNodeText(node));
            } else if (
                isVariableStatement(node) &&
                node.declarationList.declarations.some(decl =>
                    isVariableDeclaration(decl) &&
                    decl.initializer &&
                    isCallExpression(decl.initializer) &&
                    isIdentifier(decl.initializer.expression) &&
                    decl.initializer.expression.text === 'require'
                )
            ) {
                importStatements.push(getNodeText(node));
            }

            // Collect type definitions
            if (
                (isTypeAliasDeclaration(node) || isInterfaceDeclaration(node)) &&
                node.name
            ) {
                const typeName = node.name.text;
                const typeText = getNodeText(node);
                typeDefinitions.set(typeName, typeText);
            }

            forEachChild(node, collectImportsAndTypes);
        }

        // Second pass: collect exported functions and their code
        function collectExportedFunctions(node: Node) {
            if (
                (isFunctionDeclaration(node) || isVariableStatement(node)) &&
                node.modifiers?.some(modifier => modifier.kind === SyntaxKind.ExportKeyword)
            ) {
                if (isFunctionDeclaration(node) && node.name) {
                    const functionName = node.name.text;
                    const functionCode = getNodeText(node);

                    exportedFunctions.push({
                        functionName,
                        functionCode,
                        functionTypes: [], // Will be filled in later
                    });
                } else if (isVariableStatement(node)) {
                    for (const decl of node.declarationList.declarations) {
                        if (
                            isVariableDeclaration(decl) &&
                            isIdentifier(decl.name) &&
                            decl.initializer &&
                            (isArrowFunction(decl.initializer) || isFunctionExpression(decl.initializer))
                        ) {
                            const functionName = decl.name.text;
                            const functionCode = getNodeText(node);

                            exportedFunctions.push({
                                functionName,
                                functionCode,
                                functionTypes: [], // Will be filled in later
                            });
                        }
                    }
                }
            }

            forEachChild(node, collectExportedFunctions);
        }

        // Find all types used in a function (directly or indirectly)
        function findUsedTypes(functionCode: string): string[] {
            const usedTypes: string[] = [];

            for (const [typeName, typeDefinition] of typeDefinitions.entries()) {
                // Check if the type name is mentioned in the function code
                const pattern = new RegExp(`\\b${typeName}\\b`);
                if (pattern.test(functionCode)) {
                    usedTypes.push(typeDefinition);
                }
            }

            return usedTypes;
        }

        // Execute the collection functions
        collectImportsAndTypes(sourceFile);
        collectExportedFunctions(sourceFile);

        // For each exported function, find the types it uses
        for (const func of exportedFunctions) {
            func.functionTypes = findUsedTypes(func.functionCode);
        }

        return {
            importStatements,
            exportedFunctions,
        };
    }

    public fileEndings(): string[] {
        return ['.ts', '.js'];
    }

    public cleanup(): void {
        this.tempDir.removeCallback();
    }

    private config: TTypescript;
    private tempDir: DirResult;
}