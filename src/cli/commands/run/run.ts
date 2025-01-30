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
}

// Recursively read files from a directory
function getFilesRecursively(dir: string): string[] {
    let files: string[] = [];
    readdirSync(dir).forEach(file => {
        const fullPath = join(dir, file);
        if (statSync(fullPath).isDirectory()) {
            files = files.concat(getFilesRecursively(fullPath));
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.ts')) {
            files.push(fullPath);
        }
    });
    return files;
}

export const runCommand = async (config: TConfig): Promise<void> => {
    const files = getFilesRecursively(config.testDir);
    for (const file of files) {
        const functions = config.languageSvc.extractFunctions(file);
        console.log(`Found ${functions.length} functions in file: ${file}`);
        for (const func of functions) {
            console.log(`Processing function: ${func.name}, Exported: ${func.exported}`);
            if (!func.exported) {
                console.log(`Skipping non-exported function: ${func.name}`);
                continue;
            }

            const relativePath = `./${basename(file)}`; // Filename for imports
            const [chatId, startConvoErr] = await config.aiSvc.startConversation({
                id: "",
                fileLocation: file,
                relativePath,
                functionName: func.name,
                functionCode: func.code,
                functionContext: "",
            });
            if (startConvoErr) {
                console.error(`Failed to start conversation for function: ${func.name}`);
                throw startConvoErr;
            }

            let allTestsPassing = false;

            let numTries = 0
            while (!allTestsPassing) {
                numTries += 1;
                if (numTries > config.maxTries) {
                    console.error(`Exceeded maximum tries (${config.maxTries}) for function: ${func.name}`);
                    config.aiSvc.stopConversation(chatId); // Clean up
                    break;
                }

                try {
                    console.log(`Processing function: ${func.name}; Try #${numTries} of ${config.maxTries}`);

                    const testFilePath = join(dirname(file), `${func.name}.test.ts`);

                    if (numTries === 1) {
                        // Initial test generation
                        const [initialTests, initialTestsErr] = await config.aiSvc.generateInitialTests(chatId);
                        if (initialTestsErr) {
                            console.error(`Failed to generate initial tests for function: ${func.name}`);
                            throw initialTestsErr;
                        }

                        config.languageSvc.writeTestsToFile(func.name, initialTests, file); // Save initial tests
                    }

                    const { success, results } = await config.languageSvc.runTests(config.rootDir, testFilePath);
                    if (success) {
                        console.log('All tests passed');
                        allTestsPassing = true;
                    } else {
                        console.error('Tests failed');
                        const [revisedTests, err] = await config.aiSvc.provideFeedback(chatId, results);
                        config.languageSvc.writeTestsToFile(func.name, revisedTests, file); // Save revised tests
                    }
                } catch (error) {
                    console.error(`Error processing function ${func.name}:`, error);
                    break; // Stop processing this function on critical error
                }
            }
        }
    }
    config.languageSvc.cleanup(); // Clean up
    console.log('Finished processing all functions');
}