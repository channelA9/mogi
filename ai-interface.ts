// ai.ts - Universal AI Interface
import { SchemaType, Schema } from "@google/generative-ai";

export type AIPromptResponse = string | string[];
export type TokenUsage = { input: number; output: number };

export interface AIUsageStats {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
}

export type AIInterfaceModelsDefinition = {
  primary: string;
  utility: string;
};

// all AI services should implement as singletons
export abstract class AIService {
  protected abstract usageStats: AIUsageStats;
  static instance: AIService;
  abstract createSchema(object: object): Schema;
  abstract prompt(
    system: string,
    content: string,
    instruction: string,
    schema?: Schema
  ): Promise<AIPromptResponse>;
  abstract promptThinking(
    system: string,
    content: string,
    instruction: string,
    schema?: Schema
  ): Promise<AIPromptResponse>;
  abstract setPrimaryModel(model: string): void;
  abstract setUtilityModel(model: string): void;
  abstract setGenerationConfig(config: object): void;
  abstract calculateCost(inputTokens: number, outputTokens: number): number
  abstract setPricing(input: number, output: number): void;
  getUsageStats(): AIUsageStats {
    return this.usageStats;
  }

  resetUsageStats(): void {
    this.usageStats = {
      totalCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      estimatedCost: 0,
    };
  }
}
