import { readdirSync, statSync } from "fs";
import { basename, dirname, join } from "path";

import { IAI } from "@/src/ai";
import { ILanguage } from "@/src/language";

export type TConfig = {
    aiSvc: IAI;
    languageSvc: ILanguage;

    maxTries: number;
    rootDir: string;
    testDir: string;
    fileEndings: string[];
    sleep: number;
    export: boolean;
}

// Recursively read files from a directory
function getFilesRecursively(dir: string): string[] {
    let files: string[] = [];
    readdirSync(dir).forEach(file => {
        const fullPath = join(dir, file);
        if (statSync(fullPath).isDirectory()) {
            files = files.concat(getFilesRecursively(fullPath));
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.ts')) {
            if (fullPath.includes('.test.') || fullPath.includes('.spec.') || fullPath.includes('.d.')) {
                return; // Skip test files
            }
            files.push(fullPath);
        }
    });
    return files;
}

export const runCommand = async (config: TConfig): Promise<void> => {
    const files = getFilesRecursively(config.testDir);
    for (const file of files) {
        if (config.export) {
            console.log(`Exporting all declarations in file: ${file}`);
            await config.languageSvc.exportAllDeclarations(file);
        }

        const analyzedFile = config.languageSvc.analyzeSourceCodeFile(file);
        console.log(`Found ${analyzedFile.exportedFunctions.length} functions in file: ${file}`);
        for (const func of analyzedFile.exportedFunctions) {
            console.log(`Processing function: ${func.functionName}`);

            const relativePath = `./${basename(file)}`; // Filename for imports
            const [chatId, startConvoErr] = await config.aiSvc.startConversation({
                id: "",
                fileLocation: file,
                relativePath,
                functionName: func.functionName,
                functionCode: func.functionCode,
                functionImports: func.functionTypes.join('\n'),
                functionTypes: analyzedFile.importStatements.join('\n')
            });
            if (startConvoErr) {
                console.error(`Failed to start conversation for function: ${func.functionName}`);
                throw startConvoErr;
            }

            let allTestsPassing = false;

            let numTries = 0
            while (!allTestsPassing) {
                numTries += 1;
                if (numTries > config.maxTries) {
                    console.error(`Exceeded maximum tries (${config.maxTries}) for function: ${func.functionName}`);
                    config.aiSvc.stopConversation(chatId); // Clean up
                    break;
                }

                try {
                    console.log(`Processing function: ${func.functionName}; Try #${numTries} of ${config.maxTries}`);

                    const testFilePath = join(dirname(file), `${func.functionName}.ut.test.ts`);

                    if (numTries === 1) {
                        // Initial test generation
                        const [initialTests, initialTestsErr] = await config.aiSvc.generateInitialTests(chatId);
                        if (initialTestsErr) {
                            console.error(`Failed to generate initial tests for function: ${func.functionName}`);
                            throw initialTestsErr;
                        }

                        config.languageSvc.writeTestsToFile(testFilePath, initialTests); // Save initial tests
                    }

                    const { success, results } = await config.languageSvc.runTests(config.rootDir, testFilePath);
                    if (success) {
                        console.log('All tests passed');
                        allTestsPassing = true;
                    } else {
                        console.error('Tests failed');
                        const [revisedTests, err] = await config.aiSvc.provideFeedback(chatId, results);
                        config.languageSvc.writeTestsToFile(testFilePath, revisedTests); // Save revised tests
                    }
                } catch (error) {
                    console.error(`Error processing function ${func.functionName}:`, error);
                    break; // Stop processing this function on critical error
                } finally {
                    await new Promise(resolve => setTimeout(resolve, config.sleep)); // Sleep
                }
            }
        }
    }
    config.languageSvc.cleanup(); // Clean up
    console.log('Finished processing all functions');
}