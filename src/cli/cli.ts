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
    }

    private setupCommands() {
        this.program
            .command('run <testDir>')
            .description('Run the CLI with specified options')
            .option('--maxTries <number>', 'Maximum number of tries', parseInt, 5)
            .option('--model <string>', 'Model to use', 'o1-mini')
            .option('--ai <string>', 'AI to use', 'chatGPT, claude')
            .option('--rootDir <string>', 'Root directory', './')
            .option('--language <string>', 'Coding language', 'typescript')
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
                    };
                    await runCommand(config)
                } catch (error) {
                    console.error('Error running command:', error);
                }
            });

        this.program.parse(process.argv);
    }
}