import { exec } from 'child_process';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { DirResult, dirSync } from 'tmp';
import { createSourceFile, ScriptTarget, Node, isFunctionDeclaration, isClassDeclaration, isInterfaceDeclaration, isEnumDeclaration, isVariableStatement, SyntaxKind, isVariableDeclaration, isIdentifier, isArrowFunction, isFunctionExpression, forEachChild } from 'typescript';

import { ILanguage, TLanguage } from '@/src/language';

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

    public extractFunctions(filePath: string): { name: string; code: string; exported: boolean }[] {
        const fileContent = readFileSync(filePath, 'utf-8');
        const sourceFile = createSourceFile(filePath, fileContent, ScriptTarget.ESNext, true);

        const functions: { name: string; code: string; exported: boolean }[] = [];

        function isExported(node: Node): boolean {
            if (
                isFunctionDeclaration(node) ||
                isClassDeclaration(node) ||
                isInterfaceDeclaration(node) ||
                isEnumDeclaration(node) ||
                isVariableStatement(node)
            ) {
                return node.modifiers?.some(modifier => modifier.kind === SyntaxKind.ExportKeyword) || false;
            }
            return false;
        }

        function visit(node: Node) {
            if (isFunctionDeclaration(node) && node.name) {
                // Handle named function declarations
                const functionName = node.name.getText();
                const functionCode = fileContent.substring(node.pos, node.end);
                const exported = isExported(node);
    
                functions.push({ name: functionName, code: functionCode, exported });
            } else if (isVariableStatement(node)) {
                // Handle VariableStatements (e.g., export const c = ...)
                const exported = isExported(node); // Check if the VariableStatement is exported
    
                for (const declaration of node.declarationList.declarations) {
                    if (isVariableDeclaration(declaration) && isIdentifier(declaration.name)) {
                        const functionName = declaration.name.getText();
    
                        // Check if the initializer is a function
                        if (
                            declaration.initializer && // Ensure initializer is defined
                            (isArrowFunction(declaration.initializer) || isFunctionExpression(declaration.initializer))
                        ) {
                            const functionCode = fileContent.substring(declaration.initializer.pos, declaration.initializer.end);
                            functions.push({ name: functionName, code: functionCode, exported });
                        }
                    }
                }
            }
    
            forEachChild(node, visit);
        }

        visit(sourceFile);
        return functions;
    }

    public extractImports(filePath: string): string[] {
        // TODO: @adam-hanna - Implement extractImports
        return [];
    }

    public exportTypes(filePath: string): string[] {
        // TODO: @adam-hanna - Implement exportTypes
        return [];
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