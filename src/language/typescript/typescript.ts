import { exec } from 'child_process';
import { dirname, join, resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { DirResult, dirSync } from 'tmp';
import { createSourceFile, ScriptTarget, Node, isFunctionDeclaration, isClassDeclaration, isInterfaceDeclaration, isEnumDeclaration, isVariableStatement, SyntaxKind, isVariableDeclaration, isIdentifier, isArrowFunction, isFunctionExpression, forEachChild, StringLiteral, isImportDeclaration, isImportEqualsDeclaration, isExternalModuleReference, isStringLiteral, isCallExpression, createProgram, FunctionLikeDeclarationBase, isMethodDeclaration, TypeChecker, isBlock } from 'typescript';

import { ILanguage, TFunctionTypeInfo, TLanguage } from '@/src/language';

export type TTypescript = {

} & TLanguage;

export class Typescript implements ILanguage {
    constructor(config: TTypescript) {
        console.debug('New Typescript class');
        this.config = config;
        this.tempDir = dirSync({ unsafeCleanup: true });
    }
    extractTypesForFunction(filePath: string, functionName: string): TFunctionTypeInfo | null {
        throw new Error('Method not implemented.');
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

    /**
     * Returns an array of the entire import or require statements found in the file.
     * Examples:
     *   - import { named1, named2 } from "es6-named";
     *   - import foo = require("foo-lib");
     *   - const bar = require("bar-lib");
     */
    public extractImports(filePath: string): string[] {
        // Read the source code from the file
        const sourceCode = readFileSync(resolve(filePath), 'utf-8');

        // Create a SourceFile object
        const sourceFile = createSourceFile(
            filePath,
            sourceCode,
            ScriptTarget.Latest,
            /* setParentNodes= */ true
        );

        const imports: string[] = [];

        // A recursive function to walk through the AST
        function visit(node: Node) {
            // 1) ES6 import declarations: import something from '...';
            if (isImportDeclaration(node)) {
                // Extract the exact text of the import statement
                const importStatement = sourceCode
                    .slice(node.getStart(), node.getEnd())
                    .trim();
                imports.push(importStatement);
            }
            // 2) TypeScript import-equals declarations: import foo = require('bar');
            else if (isImportEqualsDeclaration(node)) {
                if (isExternalModuleReference(node.moduleReference)) {
                    const importStatement = sourceCode
                        .slice(node.getStart(), node.getEnd())
                        .trim();
                    imports.push(importStatement);
                }
            }
            // 3) CommonJS require calls: const foo = require('bar');
            else if (isCallExpression(node)) {
                if (
                    isIdentifier(node.expression) &&
                    node.expression.text === 'require' &&
                    node.arguments.length === 1 &&
                    isStringLiteral(node.arguments[0])
                ) {
                    // If we’re inside something like "const X = require('...');"
                    // the Node we have is only the CallExpression. Usually, the
                    // entire statement is the parent (a VariableStatement or ExpressionStatement).
                    // We'll grab the parent if it exists.
                    const nodeToExtract = node.parent || node;

                    let requireStatement = sourceCode
                        .slice(nodeToExtract.getStart(), nodeToExtract.getEnd())
                        .trim();
                    if (requireStatement.includes('=')) {
                        requireStatement = `const ${requireStatement}`;
                    } 
                    imports.push(`${requireStatement}`);
                }
            }

            // Recurse deeper
            forEachChild(node, visit);
        }

        // Start traversing from the root of the AST
        visit(sourceFile);

        return imports;
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