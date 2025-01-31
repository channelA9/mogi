import { Schema } from "@google/generative-ai";
import { AIService, AIPromptResponse } from "./ai-interface";
import { AIUsageStats } from "./ai-interface";

declare type MogiAgentID = string;
declare type MogiProcessID = string;
declare type MogiNodeID = string;

export interface MogiAgentState {
  id: MogiAgentID;
  attributes: Record<string, any>;
  history: MogiAgentHistory[];
}

export interface MogiAgentHistory {
  timestamp: Date;
  processId?: MogiProcessID;
  nodeId?: MogiNodeID;
  changes: Record<string, any>;
  reasoning?: string;
}

export interface MogiSimulationConfig {
  id: string;
  description: string;
  delayMs: number;
  maxConcurrency: number;
  printLogs: boolean;
}

export interface MogiSimulationState {
  currentProcessId: MogiProcessID | null;
  activeAgents: MogiAgentID[];
  nodeIndex: number;
  isComplete: boolean;
}

export interface MogiProcessConfig {
  retries: number;
  timeoutMs: number;
}

export interface MogiNodeConfig {
  aiService: AIService;
  instructions: string;
  appendMessage?: string;
  schema?: Schema;
  useChainOfThought: boolean;
}

/**
 * Class representing the Mogi simulation.
 */
export class MogiSimulation {
  constructor(config?: Partial<MogiSimulationConfig>);
  /**
   * Adds an agent to the simulation.
   * @param initialState - The initial state of the agent.
   * @returns The ID of the added agent.
   */
  addAgent(initialState: Omit<MogiAgentState, "id" | "history">): MogiAgentID;
  /**
   * Gets the state of an agent by ID.
   * @param id - The ID of the agent.
   * @returns The state of the agent.
   */
  getAgentState(id: MogiAgentID): MogiAgentState;
  /**
   * Gets the state of all agents in the simulation.
   * @returns An array of agent states.
   */
  getAllAgents(): MogiAgentState[];
  /**
   * Gets the current state of the simulation.
   * @returns The state of the simulation.
   */
  getSimulationState(): MogiSimulationState;
  /**
   * Initializes a process in the simulation.
   * @param process - The process to initialize.
   */
  initializeProcess(process: MogiProcess): Promise<void>;
  /**
   * Executes a single step of the simulation.
   * @returns A promise that resolves to a boolean indicating if there are more steps to execute.
   */
  executeStep(): Promise<boolean>;
  /**
   * Runs a process in the simulation.
   * @param process - The process to run.
   */
  runProcess(process: MogiProcess): Promise<void>;
  /**
   * Tracks an AI service for usage statistics.
   * @param service - The AI service to track.
   */
  private trackAIService(service: AIService): void;
  /**
   * Gets the usage statistics for all tracked AI services.
   * @returns The usage statistics.
   */
  getAIUsage(): AIUsageStats;
  /**
   * Resets the usage statistics for all tracked AI services.
   */
  resetAIUsage(): void;
}

/**
 * Class representing a process in the Mogi simulation.
 */
export class MogiProcess {
  constructor(id: MogiProcessID, config?: MogiProcessConfig);
  /**
   * Adds a node to the process.
   * @param node - The node to add.
   * @returns The process instance.
   */
  addNode(node: MogiNode): this;
  /**
   * Executes the process for a set of agents.
   * @param agents - The agents to process.
   * @param simConfig - The simulation configuration.
   */
  execute(agents: MogiAgentState[], simConfig: MogiSimulationConfig): Promise<void>;
  /**
   * Resets the execution state of the process.
   */
  resetExecution(): void;
  /**
   * Executes a single step for an agent in the process.
   * @param agent - The agent to process.
   * @param simConfig - The simulation configuration.
   * @returns A promise that resolves to a boolean indicating if there are more steps to execute.
   */
  executeAgentStep(agent: MogiAgentState, simConfig: MogiSimulationConfig): Promise<boolean>;
  /**
   * Gets the AI services used by the process.
   * @returns An array of AI services.
   */
  getAIServices(): AIService[];
}

/**
 * Class representing a node in the Mogi simulation.
 */
export class MogiNode {
  constructor(
    id: MogiNodeID,
    config: MogiNodeConfig
  );
  /**
   * Executes the node for an agent.
   * @param agent - The agent to process.
   * @param delayMs - The delay in milliseconds before processing.
   */
  execute(agent: MogiAgentState, delayMs: number): Promise<void>;
  /**
   * Gets the AI service used by the node.
   * @returns The AI service.
   */
  getAIService(): AIService;
}

/**
 * Creates a Mogi node with AI-driven instructions.
 * @param ai - The AI service to use.
 * @param instructions - The instructions for the node.
 * @param schema - The schema for the node.
 * @returns The created Mogi node.
 */
export function createMogiNode(
  ai: AIService,
  instructions: string,
  schema?: Schema
): MogiNode;

/**
 * Utility function to encapsulate schemas.
 * @param schemas - The schemas to encapsulate.
 * @returns The encapsulated schema.
 */
export function encapsulateSchema(schemas: { [k: string]: Schema }): Schema;

/**
 * Class representing a conditional process in the Mogi simulation.
 */
export class MogiConditionalProcess extends MogiProcess {
  constructor(
    id: string,
    condition: (agent: MogiAgentState) => boolean,
    trueBranch: MogiProcess,
    falseBranch: MogiProcess,
    nodes?: MogiNode[],
    config?: MogiProcessConfig
  );
  /**
   * Executes a conditional step for a set of agents.
   * @param agents - The agents to process.
   * @param simConfig - The simulation configuration.
   * @returns A promise that resolves to a boolean indicating if there are more steps to execute.
   */
  executeConditionalStep(agents: MogiAgentState[], simConfig: MogiSimulationConfig): Promise<boolean>;
  /**
   * Resets the execution state of the conditional process.
   */
  resetExecution(): void;
  /**
   * Updates the branches of the conditional process.
   * @param trueBranch - The new true branch process.
   * @param falseBranch - The new false branch process.
   */
  updateBranches(trueBranch?: MogiProcess, falseBranch?: MogiProcess): void;
  /**
   * Gets the active branch for an agent.
   * @param agentId - The ID of the agent.
   * @returns The active branch process.
   */
  getActiveBranch(agentId: MogiAgentID): MogiProcess | null;
  /**
   * Gets the AI services used by the conditional process.
   * @returns An array of AI services.
   */
  getAIServices(): AIService[];
}