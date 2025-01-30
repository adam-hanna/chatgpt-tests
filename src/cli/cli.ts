import { Command } from 'commander';

import { runCommand, TConfig as TRunConfig } from '@/src/cli/commands/run';
import { Config } from '@/src/config';
import { ChatGPT } from '@/src/ai/chatGPT';
import { Typescript } from '@/src/language/typescript';

class CLI {
    private program: Command;

    constructor() {
        this.program = new Command();
        this.setupCommands();
    }

    private setupCommands() {
        this.program
            .command('run <testDir>')
            .description('Run the CLI with specified options')
            .option('--maxTries <number>', 'Maximum number of tries', parseInt)
            .option('--model <string>', 'Model to use')
            .option('--ai <string>', 'AI to use')
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

                    const chatGPT = new ChatGPT({
                        apiKey,
                        model: options.model,
                        debug: true,
                    });

                    const typescript = new Typescript({});

                    const config: TRunConfig = {
                        aiSvc: chatGPT,
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

new CLI();