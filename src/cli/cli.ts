import { Command } from 'commander';

import { runCommand, TConfig as TRunConfig } from '@/src/cli/commands/run';
import { Config } from '@/src/config';
import { ChatGPT } from '@/src/ai/chatGPT';
import { Typescript } from '@/src/language/typescript';
import { IAI } from '@/src/ai';
import { Claude } from '@/src/ai/claude';

export class CLI {
    private program: Command;

    constructor() {
        this.program = new Command();
        this.setupCommands();
        this.setupSignalHandlers();
    }

    private setupSignalHandlers() {
        // Add a handler for SIGINT (Ctrl+C)
        process.on('SIGINT', () => {
            console.log('\nGracefully shutting down from SIGINT (Ctrl+C)');
            // Perform any cleanup operations here if needed
            process.exit(0);
        });
    }

    private setupCommands() {
        this.program
            .command('run <testDir>')
            .description('Run the CLI with specified options')
            .option('--maxTries <number>', 'Maximum number of tries', parseInt, 5)
            .option('--model <string>', 'Model to use', 'claude-3-7-sonnet-20250219')
            .option('--ai <string>', 'AI to use (chatGPT or claude)', 'claude')
            .option('--rootDir <string>', 'Root directory', './')
            .option('--language <string>', 'Coding language', 'typescript')
            .option('--sleep <number>', 'Sleep time between api calls (ms)', parseInt, 1000)
            .option('--export', 'Modify the sourcefile to export all top level declarations?', false)
            .action(async (testDir, options) => {
                try {
                    const cfgSvc = new Config();
                    const [_, configOK] = await cfgSvc.fetchConfig();
                    if (!configOK) {
                        throw new Error('Failed to fetch config');
                    }

                    const [apiKey, apiOK] = cfgSvc.fetchConfigValue('AI_PROVIDER_API_KEY');
                    if (!apiOK || !apiKey) {
                        throw new Error('apiKey is required');
                    }

                    let aiSvc: IAI;
                    switch(options.ai.toLowerCase()) {
                        case 'chatgpt':
                            aiSvc = new ChatGPT({
                                apiKey,
                                model: options.model,
                                debug: true,
                            });
                            break;
                        case 'claude':
                            aiSvc = new Claude({
                                apiKey,
                                model: options.model,
                                debug: true,
                            });
                            break;
                        default:
                            throw new Error('Invalid AI, please use chatGPT or claude');
                    }

                    const typescript = new Typescript({});

                    const config: TRunConfig = {
                        aiSvc,
                        languageSvc: typescript,
                        maxTries: options.maxTries,
                        rootDir: options.rootDir,
                        testDir: testDir,
                        fileEndings: [],
                        sleep: options.sleep,
                        export: options.export,
                    };
                    await runCommand(config)
                } catch (error) {
                    console.error('Error running command:', error);
                }
            });

        this.program.parse(process.argv);
    }
}