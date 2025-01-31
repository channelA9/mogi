import { Schema } from "@google/generative-ai";

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

/**
 * Abstract class representing an AI service.
 * All AI services should implement as singletons.
 */
export abstract class AIService {
  protected abstract usageStats: AIUsageStats;
  static instance: AIService;
  /**
   * Creates a schema from an object.
   * @param object - The object to create a schema from.
   * @returns The created schema.
   */
  abstract createSchema(object: object): Schema;
  /**
   * Prompts the AI service with a system message, content, and instruction.
   * @param system - The system message.
   * @param content - The content to process.
   * @param instruction - The instruction for the AI.
   * @param schema - The schema for the response.
   * @returns The AI prompt response.
   */
  abstract prompt(
    system: string,
    content: string,
    instruction: string,
    schema?: Schema
  ): Promise<AIPromptResponse>;
  /**
   * Prompts the AI service with a system message, content, and instruction, and generates reasoning.
   * @param system - The system message.
   * @param content - The content to process.
   * @param instruction - The instruction for the AI.
   * @param schema - The schema for the response.
   * @returns The AI prompt response with reasoning.
   */
  abstract promptThinking(
    system: string,
    content: string,
    instruction: string,
    schema?: Schema
  ): Promise<AIPromptResponse>;
  /**
   * Sets the primary model for the AI service.
   * @param model - The primary model.
   */
  abstract setPrimaryModel(model: string): void;
  /**
   * Sets the utility model for the AI service.
   * @param model - The utility model.
   */
  abstract setUtilityModel(model: string): void;
  /**
   * Sets the generation configuration for the AI service.
   * @param config - The generation configuration.
   */
  abstract setGenerationConfig(config: object): void;
  /**
   * Calculates the cost of the AI service based on input and output tokens.
   * @param inputTokens - The number of input tokens.
   * @param outputTokens - The number of output tokens.
   * @returns The calculated cost.
   */
  abstract calculateCost(inputTokens: number, outputTokens: number): number;
  /**
   * Sets the pricing for the AI service.
   * @param input - The cost per million input tokens.
   * @param output - The cost per million output tokens.
   */
  abstract setPricing(input: number, output: number): void;
  /**
   * Gets the usage statistics for the AI service.
   * @returns The usage statistics.
   */
  getUsageStats(): AIUsageStats;
  /**
   * Resets the usage statistics for the AI service.
   */
  resetUsageStats(): void;
}
