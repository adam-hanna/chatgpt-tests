import { IAI } from "@/src/ai";

export type TConfig = {
    aiSvc: IAI;
}

export const runCommand = async (config: TConfig): Promise<void> => {
    console.log('Run command'); 
}