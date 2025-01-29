import { IAI } from "@/src/ai";

export type TConfig = {
    aiSvc: IAI;

    maxTries: number;
    rootDir: string;
    testDir: string;
}

export const runCommand = async (config: TConfig): Promise<void> => {
    console.log('Run command'); 
}