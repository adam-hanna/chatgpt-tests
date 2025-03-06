import { exec } from 'child_process';
import { basename, dirname, extname, join, resolve } from 'path';
import { existsSync, openSync, promises, readFileSync, writeFileSync } from 'fs';
import { DirResult, dirSync } from 'tmp';
import { createSourceFile, ScriptTarget, Node, isFunctionDeclaration, isClassDeclaration, isInterfaceDeclaration, isEnumDeclaration, isVariableStatement, SyntaxKind, isVariableDeclaration, isIdentifier, isArrowFunction, isFunctionExpression, forEachChild, StringLiteral, isImportDeclaration, isImportEqualsDeclaration, isExternalModuleReference, isStringLiteral, isCallExpression, createProgram, FunctionLikeDeclarationBase, isMethodDeclaration, TypeChecker, isBlock, isTypeAliasDeclaration, createPrinter, NewLineKind, TransformationContext, SourceFile, isSourceFile, isModuleDeclaration, factory, visitEachChild, visitNode, transform, VariableStatement, TransformerFactory } from 'typescript';

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

    public writeTestsToFile(testFilePath: string, testBlocks: string[]): void {
        const content = testBlocks.join('\n\n'); // Combine all test blocks
        writeFileSync(testFilePath, content);
    }

    public async runTests(rootDir: string, testFilePath: string): Promise<{ success: boolean; results: string }> {
        return new Promise((resolve) => {
            const testResultsLocation = join(this.tempDir.name, fileName)
            exec(`cd ${rootDir} && npx jest --json --outputFile=${testResultsLocation} ${testFilePath}`, (error, stdout, stderr) => {
                console.log(`stdout: ${stdout}`);
                console.log(`stderr: ${stderr}`);
                if (error) {
                    console.error(`error running tests; error: ${error?.message}\nsterr: ${stderr}`);
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
      try {
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
        if (!sourceText || sourceText.trim().length === 0) {
          throw new Error(`File is empty: ${filePath}`);
        }
    
        console.log(`Processing file: ${filePath}`);
    
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
        const transformer: TransformerFactory<SourceFile> = (context: TransformationContext) => {
          return (rootNode: SourceFile): SourceFile => {
            function visit(node: Node): Node {
              // Safety check: ensure node.parent exists before checking
              if (node.parent && isSourceFile(node.parent)) {
                // Handle VariableStatement (var, let, const)
                if (isVariableStatement(node)) {
                  const hasExportModifier = node.modifiers?.some(mod => 
                    mod.kind === SyntaxKind.ExportKeyword
                  );
    
                  if (!hasExportModifier) {
                    const exportModifier = factory.createModifier(SyntaxKind.ExportKeyword);
                    const existingModifiers = node.modifiers || [];
                    const newModifiers = [exportModifier, ...existingModifiers];
                    
                    return factory.updateVariableStatement(
                      node,
                      newModifiers,
                      node.declarationList
                    );
                  }
                } 
                // Handle FunctionDeclaration with name
                else if (isFunctionDeclaration(node) && node.name) {
                  const hasExportModifier = node.modifiers?.some(mod => 
                    mod.kind === SyntaxKind.ExportKeyword
                  );
    
                  if (!hasExportModifier) {
                    const exportModifier = factory.createModifier(SyntaxKind.ExportKeyword);
                    const existingModifiers = node.modifiers || [];
                    const newModifiers = [exportModifier, ...existingModifiers];
                    
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
                  }
                }
                // Handle ClassDeclaration with name
                else if (isClassDeclaration(node) && node.name) {
                  const hasExportModifier = node.modifiers?.some(mod => 
                    mod.kind === SyntaxKind.ExportKeyword
                  );
    
                  if (!hasExportModifier) {
                    const exportModifier = factory.createModifier(SyntaxKind.ExportKeyword);
                    const existingModifiers = node.modifiers || [];
                    const newModifiers = [exportModifier, ...existingModifiers];
                    
                    return factory.updateClassDeclaration(
                      node,
                      newModifiers,
                      node.name,
                      node.typeParameters,
                      node.heritageClauses,
                      node.members
                    );
                  }
                }
                // Handle InterfaceDeclaration with name
                else if (isInterfaceDeclaration(node) && node.name) {
                  const hasExportModifier = node.modifiers?.some(mod => 
                    mod.kind === SyntaxKind.ExportKeyword
                  );
    
                  if (!hasExportModifier) {
                    const exportModifier = factory.createModifier(SyntaxKind.ExportKeyword);
                    const existingModifiers = node.modifiers || [];
                    const newModifiers = [exportModifier, ...existingModifiers];
                    
                    return factory.updateInterfaceDeclaration(
                      node,
                      newModifiers,
                      node.name,
                      node.typeParameters,
                      node.heritageClauses,
                      node.members
                    );
                  }
                }
                // Handle TypeAliasDeclaration with name
                else if (isTypeAliasDeclaration(node) && node.name) {
                  const hasExportModifier = node.modifiers?.some(mod => 
                    mod.kind === SyntaxKind.ExportKeyword
                  );
    
                  if (!hasExportModifier) {
                    const exportModifier = factory.createModifier(SyntaxKind.ExportKeyword);
                    const existingModifiers = node.modifiers || [];
                    const newModifiers = [exportModifier, ...existingModifiers];
                    
                    return factory.updateTypeAliasDeclaration(
                      node,
                      newModifiers,
                      node.name,
                      node.typeParameters,
                      node.type
                    );
                  }
                }
                // Handle EnumDeclaration with name
                else if (isEnumDeclaration(node) && node.name) {
                  const hasExportModifier = node.modifiers?.some(mod => 
                    mod.kind === SyntaxKind.ExportKeyword
                  );
    
                  if (!hasExportModifier) {
                    const exportModifier = factory.createModifier(SyntaxKind.ExportKeyword);
                    const existingModifiers = node.modifiers || [];
                    const newModifiers = [exportModifier, ...existingModifiers];
                    
                    return factory.updateEnumDeclaration(
                      node,
                      newModifiers,
                      node.name,
                      node.members
                    );
                  }
                }
                // Handle ModuleDeclaration with name
                else if (isModuleDeclaration(node) && node.name) {
                  const hasExportModifier = node.modifiers?.some(mod => 
                    mod.kind === SyntaxKind.ExportKeyword
                  );
    
                  if (!hasExportModifier) {
                    const exportModifier = factory.createModifier(SyntaxKind.ExportKeyword);
                    const existingModifiers = node.modifiers || [];
                    const newModifiers = [exportModifier, ...existingModifiers];
                    
                    return factory.updateModuleDeclaration(
                      node,
                      newModifiers,
                      node.name,
                      node.body
                    );
                  }
                }
              }
              
              // For other nodes or already exported declarations, visit their children
              return visitEachChild(node, visit, context);
            }
            
            return visitNode(rootNode, visit) as SourceFile;
          };
        };
    
        try {
          // Apply the transformation
          const result = transform(sourceFile, [transformer]);
          if (!result || !result.transformed || result.transformed.length === 0) {
            throw new Error('Transformation resulted in no output');
          }
          
          const transformedSourceFile = result.transformed[0];
          
          // Convert the transformed AST back to source text
          const newSourceText = printer.printFile(transformedSourceFile as SourceFile);
          
          if (!newSourceText || newSourceText.trim().length === 0) {
            throw new Error('Transformation resulted in empty file');
          }
          
          // Write the modified source back to the file
          await promises.writeFile(filePath, newSourceText, 'utf-8');
          
          // Clean up
          result.dispose();
          
          console.log(`Successfully processed and exported all declarations in: ${filePath}`);
        } catch (transformError) {
          console.error(`Error during transformation: ${(transformError as Error).message}`);
          throw transformError;
        }
      } catch (error) {
        console.error(`Error in exportAllDeclarations for ${filePath}: ${(error as Error).message}`);
        throw error;
      }
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