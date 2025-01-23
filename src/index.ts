import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

import OpenAI from 'openai';

type ChatCompletionRequestMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string;
};

const client = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'], // Ensure this is set
});

// Recursively read files from a directory
function getFilesRecursively(dir: string): string[] {
    let files: string[] = [];
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            files = files.concat(getFilesRecursively(fullPath));
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.ts')) {
            files.push(fullPath);
        }
    });
    return files;
}

// Parse a file and extract functions
function extractFunctionsUsingTS(filePath: string): { name: string; code: string }[] {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(filePath, fileContent, ts.ScriptTarget.ESNext, true);

    const functions: { name: string; code: string }[] = [];

    function visit(node: ts.Node) {
        if (ts.isFunctionDeclaration(node) && node.name) {
            const functionName = node.name.getText();
            const functionCode = fileContent.substring(node.pos, node.end);
            functions.push({ name: functionName, code: functionCode });
        } else if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
            const functionName = node.parent && ts.isVariableDeclaration(node.parent)
                ? node.parent.name.getText()
                : 'anonymous';
            const functionCode = fileContent.substring(node.pos, node.end);
            functions.push({ name: functionName, code: functionCode });
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return functions;
}

function extractCodeBlocks(response: string): string[] {
    const codeBlockRegex = /```(?:javascript|typescript)?\n([\s\S]*?)```/g;
    const matches = [...response.matchAll(codeBlockRegex)];
    return matches.map(match => match[1].trim()); // Extract the content of each code block
}

function writeTestsToFile(functionName: string, testBlocks: string[], sourceFilePath: string): void {
    const testFileName = `${functionName}.test.ts`;
    const testDir = path.dirname(sourceFilePath);
    const testFilePath = path.join(testDir, testFileName);

    const content = testBlocks.join('\n\n'); // Combine all test blocks
    fs.writeFileSync(testFilePath, content);
    console.log(`Test written to ${testFilePath}`);
}

async function getTestsFromChatGPT(
    functionName: string,
    functionCode: string,
    filePath: string,
    messages: ChatCompletionRequestMessage[]
): Promise<string[]> {
    const relativePath = `./${path.basename(filePath, path.extname(filePath))}`; // './filename' without extension

    const userMessage: ChatCompletionRequestMessage = {
        role: 'user',
        content: `Write comprehensive unit tests for the following function, which is defined in the file '${filePath}'. 
        Use the import statement \`import { ${functionName} } from '${relativePath}';\` to import the function. 
        Do not use any external libraries other than jest.
        Include the tests inside a single \`\`\`typescript\`\`\` code block, and avoid additional explanations.\n\n${functionCode}`,
    };

    messages.push(userMessage);

    const response = await client.chat.completions.create({
        model: 'gpt-4',
        messages,
    });

    const rawResponse = response.choices[0]?.message?.content || '';
    const testBlocks = extractCodeBlocks(rawResponse);

    messages.push({ role: 'assistant', content: rawResponse });
    return testBlocks;
}

async function handleTestResults(
    testResults: string,
    functionCode: string,
    filePath: string,
    messages: ChatCompletionRequestMessage[]
): Promise<string[]> {
    const relativePath = `./${path.basename(filePath)}`; // Filename for imports
    const failureMessage: ChatCompletionRequestMessage = {
        role: 'user',
        content: `The following tests failed:\n\n${testResults}\n\nHere is the function being tested (imported from '${relativePath}'):\n\n${functionCode}\n\nRevise the tests to address the issues. Include the updated tests in a single \`\`\`typescript\`\`\` code block.`,
    };

    messages.push(failureMessage);

    const response = await client.chat.completions.create({
        model: 'gpt-4',
        messages,
    });

    const rawResponse = response.choices[0]?.message?.content || '';
    const testBlocks = extractCodeBlocks(rawResponse); // Parse updated test blocks

    messages.push({ role: 'assistant', content: rawResponse }); // Append response for context
    return testBlocks;
}

function runTests(testFilePath: string): Promise<{ success: boolean; results: string }> {
    return new Promise((resolve) => {
        exec(`npx jest --json --outputFile=jest-results.json ${testFilePath}`, (error, stdout, stderr) => {
            if (error) {
                // Read Jest results file for structured failure details
                let results = stderr || stdout;
                try {
                    const jsonResults = JSON.parse(fs.readFileSync('jest-results.json', 'utf-8'));
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

(async () => {
    const maxTries = 10;
    const files = getFilesRecursively('./src/files-for-test');
    for (const file of files) {
        const functions = extractFunctionsUsingTS(file);
        for (const func of functions) {
            const messages: ChatCompletionRequestMessage[] = [
                {
                    role: 'system',
                    content: 'You are a helpful assistant that generates and revises unit tests for JavaScript/TypeScript code.',
                },
            ];

            let allTestsPassing = false;

            let numTries = 0
            while (!allTestsPassing) {
                numTries += 1;
                if (numTries > maxTries) {
                    console.error(`Exceeded maximum tries (${maxTries}) for function: ${func.name}`);
                    break;
                }

                try {
                    console.log(`Processing function: ${func.name}; Try #${numTries} of ${maxTries}`);

                    const testFilePath = path.join(path.dirname(file), `${func.name}.test.ts`);

                    if (messages.length === 1) {
                        // Initial test generation
                        const initialTests = await getTestsFromChatGPT(func.name, func.code, file, messages);
                        writeTestsToFile(func.name, initialTests, file); // Save initial tests
                    }

                    const { success, results } = await runTests(testFilePath);
                    if (success) {
                        console.log('All tests passed:', results);
                        allTestsPassing = true;
                    } else {
                        console.error('Tests failed:', results);
                        const revisedTests = await handleTestResults(results, func.code, file, messages);
                        writeTestsToFile(func.name, revisedTests, file); // Save revised tests
                    }
                } catch (error) {
                    console.error(`Error processing function ${func.name}:`, error);
                    break; // Stop processing this function on critical error
                }
            }
        }
    }
})();
