import { Command } from 'commander';

import { runCommand, TConfig as TRunConfig } from '@/src/cli/commands/run';
import { Config } from '@/src/config';
import { ChatGPT } from '../ai/chatGPT';

class CLI {
    private program: Command;

    constructor() {
        this.program = new Command();
        this.setupCommands();
    }

    private setupCommands() {
        this.program
            .command('run')
            .description('Run the CLI with specified options')
            .option('--maxTries <number>', 'Maximum number of tries', parseInt)
            .option('--model <string>', 'Model to use')
            .option('--ai <string>', 'AI to use')
            .action(async (options) => {
                try {
                    const cfgSvc = new Config();
                    const [_, ok] = await cfgSvc.fetchConfig();
                    if (!ok) {
                        throw new Error('Failed to fetch config');
                    }

                    const chatGPT = new ChatGPT();
                    const config: TRunConfig = {
                        aiSvc: chatGPT,
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