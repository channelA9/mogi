// ai/gemini.ts
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  type GenerationConfig,
  type SafetySetting,
  type Schema,
  SchemaType,
  GenerateContentResponse,
} from "@google/generative-ai";
import { AIService, AIPromptResponse } from "../ai-interface";

const SAFETY_SETTINGS: SafetySetting[] = [
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

const DEFAULT_CONFIG: GenerationConfig = {
  temperature: 0.1,
  topP: 1,
  topK: 1,
  frequencyPenalty: 0.5,
};

export class GoogleAIService extends AIService {
  static instance: GoogleAIService;

  protected usageStats =  {
    totalCalls: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    estimatedCost: 0,
  };

  private genAI: GoogleGenerativeAI;
  private models = {
    primary: "gemini-1.5-flash",
    utility: "gemini-1.5-flash",
  };
  private config: GenerationConfig = DEFAULT_CONFIG;
  private modelPricing = {
    inputCostPerMToken: 0.15,
    outputCostPerMToken: 0.60, // pessimistic pricing calculation. highest pricing bracket for Gemini 1.5 Pro >128k token prompts
  };

  constructor(apiKey: string, model: string, subModel?: string) {
    super();

    if (GoogleAIService.instance) {
      return GoogleAIService.instance;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);

    this.models.primary = model;
    if (subModel) {
      this.models.utility = subModel;
    } else {
      this.models.utility = model;
    }

    GoogleAIService.instance = this;
  }

  createSchema(obj: object): Schema {
    const properties: Record<string, Schema> = {};
    for (const [key, value] of Object.entries(obj)) {
      properties[key] = this.inferSchema(value);
    }
    return { type: SchemaType.OBJECT, properties, nullable: false };
  }

  private inferSchema(value: unknown): Schema {
    switch (typeof value) {
      case "string":
        return { type: SchemaType.STRING };
      case "number":
        return { type: SchemaType.NUMBER };
      case "boolean":
        return { type: SchemaType.BOOLEAN };
      case "object":
        if (Array.isArray(value)) {
          return {
            type: SchemaType.ARRAY,
            items: value.length > 0 ? this.inferSchema(value[0]) : { type: SchemaType.STRING },
          };
        }
        return value ? this.createSchema(value) : { type: SchemaType.OBJECT };
      default:
        return { type: SchemaType.STRING };
    }
  }

  async prompt(
    system: string,
    content: string,
    instruction: string,
    schema?: Schema
  ): Promise<AIPromptResponse> {
    const model = this.genAI.getGenerativeModel({
      model: this.models.primary,
      generationConfig: DEFAULT_CONFIG,
      safetySettings: SAFETY_SETTINGS,
    });

    try {
      const result = await model.generateContent({
        contents: [
          { role: "model", parts: [{ text: system }] },
          { role: "user", parts: [{ text: content }] },
          { role: "user", parts: [{ text: instruction }] },
        ],
        // systemInstruction: "Respond with valid JSON only",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      });

      this.updateUsage(result.response);

      return result.response.text();
    } catch (error) {
      console.error("Gemini prompt error:", error);
      return JSON.stringify({ error: "AI processing failed" });
    }
  }

  async promptThinking(
    system: string,
    content: string,
    instruction: string,
    schema?: Schema
  ): Promise<AIPromptResponse> {
    const result = await this.prompt(system, content, instruction, schema);
    const reasoning = await this.generateReasoning(system, `You added: ${result} to ${content}`);

    console.log(result, reasoning);
    return Array.isArray(result) ? [...result, reasoning] : [result, reasoning];
  }

  private async generateReasoning(system: string, content: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: this.models.utility,
      generationConfig: { ...DEFAULT_CONFIG, ...this.config, maxOutputTokens: 60 },
      safetySettings: SAFETY_SETTINGS,
    });

    const result = await model.generateContent([
      `ROLE: ${system}\n\n ${content}`,
      "In natural language and in character, generate a very short statement that contextualizes the change made.",
    ]);

    this.updateUsage(result.response);

    return result.response.text();
  }

  setPrimaryModel(model: string): void {
    this.models.primary = model;
  }
  setUtilityModel(model: string): void {
    this.models.utility = model;
  }
  setGenerationConfig(config: object): void {
    this.config = config;
  }

  // API Usage Tracking
  setPricing(input: number, output: number): void {
    this.modelPricing = {
      inputCostPerMToken: input,
      outputCostPerMToken: output,
    };
  }

  private updateUsage(response: GenerateContentResponse): void {
    const usage = response.usageMetadata || {
      promptTokenCount: 0,
      candidatesTokenCount: 0,
    };

    this.usageStats.totalCalls++;
    this.usageStats.totalInputTokens += usage.promptTokenCount;
    this.usageStats.totalOutputTokens += usage.candidatesTokenCount;

    this.usageStats.estimatedCost += this.calculateCost(
      usage.promptTokenCount,
      usage.candidatesTokenCount
    );
  }

  calculateCost(inputTokens: number, outputTokens: number): number {
    return (
      (inputTokens / 1_000_000) * this.modelPricing.inputCostPerMToken +
      (outputTokens / 1_000_000) * this.modelPricing.outputCostPerMToken
    );
  }
}
