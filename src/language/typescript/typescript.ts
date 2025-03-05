import { exec } from 'child_process';
import { basename, dirname, extname, join, resolve } from 'path';
import { existsSync, openSync, promises, readFileSync, writeFileSync } from 'fs';
import { DirResult, dirSync } from 'tmp';
import { createSourceFile, ScriptTarget, Node, isFunctionDeclaration, isClassDeclaration, isInterfaceDeclaration, isEnumDeclaration, isVariableStatement, SyntaxKind, isVariableDeclaration, isIdentifier, isArrowFunction, isFunctionExpression, forEachChild, StringLiteral, isImportDeclaration, isImportEqualsDeclaration, isExternalModuleReference, isStringLiteral, isCallExpression, createProgram, FunctionLikeDeclarationBase, isMethodDeclaration, TypeChecker, isBlock, isTypeAliasDeclaration, createPrinter, NewLineKind, TransformationContext, SourceFile, isSourceFile, isModuleDeclaration, factory, visitEachChild, visitNode, transform, VariableStatement } from 'typescript';

import { ILanguage, TExportedFunction, TLanguage } from '@/src/language';

export type TTypescript = {

} & TLanguage;

const fileName = 'jest-results.json'

export class Typescript implements ILanguage {
    constructor(config: TTypescript) {
        console.debug('New Typescript class');
        this.config = config;
        this.tempDir = dirSync({ unsafeCleanup: true });
        console.debug(`Created temporary directory: ${this.tempDir.name}`);

        const filePath = join(this.tempDir.name, fileName);
        openSync(filePath, 'w');
        console.debug(`File created successfully at ${filePath}`);
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
            const testResultsLocation = join(this.tempDir.name, fileName)
            exec(`cd ${rootDir} && npx jest --json --outputFile=${testResultsLocation} ${testFilePath}`, (error, stdout, stderr) => {
                if (error) {
                    // console.error(`error running tests; error: ${error?.message}\nsterr: ${stderr}`);
                    // Read Jest results file for structured failure details
                    let results = stderr || stdout;
                    try {
                        const jsonResults = JSON.parse(readFileSync(testResultsLocation, 'utf-8'));
                        results = JSON.stringify(jsonResults, null, 2);
                        // console.log(results)
                    } catch (e) {
                        // Fall back to raw output if JSON parsing fails
                        // console.error('failed to read test results', e);
                    }
                    resolve({ success: false, results });
                } else {
                    console.debug(`tests passed; stderr ${stderr}; stdout ${stdout}`);
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

    /**
    * Takes a filepath to a TS or JS file, analyzes it, exports all declarations,
    * and overwrites the original file.
    * 
    * @param filePath Path to the TypeScript or JavaScript file
    * @returns Promise that resolves when the operation is complete
    */
    public async exportAllDeclarations(filePath: string): Promise<void> {
      // Ensure the file exists
      if (!existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Check if it's a TS or JS file
      const ext = extname(filePath).toLowerCase();
      if (ext !== '.ts' && ext !== '.js') {
        throw new Error(`Only .ts and .js files are supported, got: ${ext}`);
      }

      // Read the source file
      const sourceText = readFileSync(filePath, 'utf-8');

      // Create a TS source file object
      const sourceFile = createSourceFile(
        basename(filePath),
        sourceText,
        ScriptTarget.Latest,
        true
      );

      // Create a printer to generate the modified source
      const printer = createPrinter({ newLine: NewLineKind.LineFeed });

      // Find all top-level declarations and add export modifiers where needed
      const transformer = (context: TransformationContext) => {
        return (rootNode: SourceFile) => {
          function visit(node: Node): Node {
            // Only transform top-level declarations
            if (isSourceFile(node.parent)) {
              // Check if the node is a declaration that can be exported
              if (
                (isVariableStatement(node) ||
                 isFunctionDeclaration(node) ||
                 isClassDeclaration(node) ||
                 isInterfaceDeclaration(node) ||
                 isTypeAliasDeclaration(node) ||
                 isEnumDeclaration(node) ||
                 isModuleDeclaration(node)) && 
                !isVariableStatement(node) && node.name !== undefined // Ensure it has a name
              ) {
                // Check if it's already exported
                const hasExportModifier = node.modifiers?.some(mod => 
                  mod.kind === SyntaxKind.ExportKeyword
                );

                // If not exported, add the export modifier
                if (!hasExportModifier) {
                  // Create export modifier
                  const exportModifier = factory.createModifier(SyntaxKind.ExportKeyword);
                
                  // Get existing modifiers or create empty array
                  const existingModifiers = node.modifiers || [];
                
                  // Create new modifiers array with export added
                  const newModifiers = [exportModifier, ...existingModifiers];

                  // Return new node with export modifier
                  if (isVariableStatement(node)) {
                    return factory.updateVariableStatement(
                      node,
                      newModifiers,
                      (node as VariableStatement).declarationList
                    );
                  } else if (isFunctionDeclaration(node)) {
                    return factory.updateFunctionDeclaration(
                      node,
                      newModifiers,
                      node.asteriskToken,
                      node.name,
                      node.typeParameters,
                      node.parameters,
                      node.type,
                      node.body
                    );
                  } else if (isClassDeclaration(node)) {
                    return factory.updateClassDeclaration(
                      node,
                      newModifiers,
                      node.name,
                      node.typeParameters,
                      node.heritageClauses,
                      node.members
                    );
                  } else if (isInterfaceDeclaration(node)) {
                    return factory.updateInterfaceDeclaration(
                      node,
                      newModifiers,
                      node.name,
                      node.typeParameters,
                      node.heritageClauses,
                      node.members
                    );
                  } else if (isTypeAliasDeclaration(node)) {
                    return factory.updateTypeAliasDeclaration(
                      node,
                      newModifiers,
                      node.name,
                      node.typeParameters,
                      node.type
                    );
                  } else if (isEnumDeclaration(node)) {
                    return factory.updateEnumDeclaration(
                      node,
                      newModifiers,
                      node.name,
                      node.members
                    );
                  } else if (isModuleDeclaration(node)) {
                    return factory.updateModuleDeclaration(
                      node,
                      newModifiers,
                      node.name,
                      node.body
                    );
                  }
                }
              }
            }

            // For other nodes or already exported declarations, just visit their children
            return visitEachChild(node, visit, context);
          }

          return visitNode(rootNode, visit) as SourceFile;
        };
      };

      // Apply the transformation
      const result = transform(sourceFile, [transformer]);
      const transformedSourceFile = result.transformed[0];

      // Convert the transformed AST back to source text
      const newSourceText = printer.printFile(transformedSourceFile as SourceFile);

      // Write the modified source back to the file
      await promises.writeFile(filePath, newSourceText, 'utf-8');

      // Clean up
      result.dispose();

      console.log(`Successfully processed and exported all declarations in: ${filePath}`);
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