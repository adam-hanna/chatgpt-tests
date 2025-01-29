export type TConfig = {
    AI_PROVIDER_API_KEY: string;
}

// TODO: @adam-hanna - support Optional<> rather than use T | null
const readConfigFromEnv = (): [TConfig | null, boolean] => {
    const config: Partial<TConfig> = {};

    (Object.keys(config) as (keyof TConfig)[]).forEach(key => {
        const value = process.env[key];
        if (!value) {
            console.error(`Missing environment variable: ${key}`);
            return [null, false]
        }
        config[key] = value;
    });

    return [config as TConfig, true];
}

export interface IConfig {
    fetchConfig(): Promise<[void, boolean]>;

    fetchConfigValue(key: keyof TConfig): [TConfig[keyof TConfig] | null, boolean];
}

export class Config implements IConfig {
    private config: TConfig = {
        AI_PROVIDER_API_KEY: '',
    };

    constructor() {
        console.debug('New Config class');
    }

    public async fetchConfig(): Promise<[void, boolean]> {
        const [config, success] = readConfigFromEnv();
        if (!success || !config) {
            return [undefined, false];
        }

        this.config = config;
        return [undefined, true];
    }

    public fetchConfigValue(key: keyof TConfig): [TConfig[keyof TConfig] | null, boolean] {
        if (!this.config.hasOwnProperty(key)) {
            return [null, false];
        }

        return [this.config[key], true];
    }
}