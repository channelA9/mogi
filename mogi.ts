// mogi.ts
import { AIService, AIUsageStats, type AIPromptResponse } from "./ai-interface";
import { Schema, SchemaType } from "@google/generative-ai";

type MogiAgentID = string;
type MogiProcessID = string;
type MogiNodeID = string;

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

export class MogiSimulation {
  private aiServices: Set<AIService> = new Set();
  private globalUsage: AIUsageStats = {
    totalCalls: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    estimatedCost: 0,
  };

  private executionQueue: Array<{
    processId: MogiProcessID;
    agentId: MogiAgentID;
    nodeIndex: number;
  }> = [];
  private currentState: MogiSimulationState = {
    currentProcessId: null,
    activeAgents: [],
    nodeIndex: 0,
    isComplete: true,
  };

  private agents: Map<MogiAgentID, MogiAgentState> = new Map();
  private processes: MogiProcess[] = [];
  private config: MogiSimulationConfig;

  constructor(config: Partial<MogiSimulationConfig> = {}) {
    this.config = {
      id: crypto.randomUUID(),
      description: "Unnamed Simulation",
      delayMs: 1500,
      maxConcurrency: 5,
      printLogs: false,
      ...config,
    };
  }

  addAgent(
    initialState: Omit<MogiAgentState, "id" | "history">,
    id: string = crypto.randomUUID()
  ): MogiAgentID {
    this.agents.set(id, {
      id,
      attributes: initialState.attributes,
      history: [],
    });
    return id;
  }

  public getAgentState(id: MogiAgentID): MogiAgentState {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error(`Agent ${id} not found in simulation`);
    }
    return agent;
  }

  public getAllAgents(): MogiAgentState[] {
    return Array.from(this.agents.values());
  }

  public getSimulationState(): MogiSimulationState {
    return this.currentState;
  }

  public async initializeProcess(process: MogiProcess): Promise<void> {
    this.currentState = {
      currentProcessId: process.id,
      activeAgents: Array.from(this.agents.keys()),
      nodeIndex: 0,
      isComplete: false,
    };
    this.executionQueue = [];

    // Initialize AI Services
    process.getAIServices().forEach((service) => this.trackAIService(service));

    // Add Process
    this.processes.push(process);

    // Initialize execution queue
    for (const agentId of this.currentState.activeAgents) {
      this.executionQueue.push({
        processId: process.id,
        agentId,
        nodeIndex: 0,
      });
    }

    if (this.config.printLogs) {
      console.log(
        `Initialized process ${process.id} with agents: ${this.currentState.activeAgents.join(
          ", "
        )}`
      );
    }
  }

  public async executeStep(): Promise<boolean> {
    if (this.currentState.isComplete) return false;

    const currentProcess = this.processes.find((p) => p.id === this.currentState.currentProcessId);
    if (!currentProcess) {
      this.currentState.isComplete = true;
      return false;
    }

    // Handle conditional processes differently
    if (currentProcess instanceof MogiConditionalProcess) {
      return currentProcess.executeConditionalStep(
        this.currentState.activeAgents.map((id) => this.getAgentState(id)),
        this.config
      );
    }

    // Original linear execution logic
    const currentNode = currentProcess.nodes[this.currentState.nodeIndex];
    const agents = this.currentState.activeAgents.map((id) => this.getAgentState(id));

    await Promise.all(agents.map((agent) => currentNode.execute(agent, this.config.delayMs)));

    this.currentState.nodeIndex++;
    if (this.currentState.nodeIndex >= currentProcess.nodes.length) {
      this.currentState.isComplete = true;
    }

    return !this.currentState.isComplete;
  }

  public async runProcess(process: MogiProcess): Promise<void> {
    if (this.config.printLogs) console.log(`Process ${process.id} started.`);
    await this.initializeProcess(process);
    while (await this.executeStep()) {
      if (this.config.printLogs)
        console.log(`Process ${process.id}: Step ${this.currentState.nodeIndex}`);
      await new Promise((resolve) => setTimeout(resolve, this.config.delayMs));
    }

    if (this.config.printLogs) console.log(`Process ${process.id} completed.`);
  }

  private trackAIService(service: AIService): void {
    if (!this.aiServices.has(service)) {
      this.aiServices.add(service);
    }
  }

  public getAIUsage(): AIUsageStats {
    return Array.from(this.aiServices).reduce(
      (acc, service) => {
        const stats = service.getUsageStats();
        acc.totalCalls += stats.totalCalls;
        acc.totalInputTokens += stats.totalInputTokens;
        acc.totalOutputTokens += stats.totalOutputTokens;
        acc.estimatedCost += stats.estimatedCost;
        return acc;
      },
      { ...this.globalUsage }
    );
  }

  public resetAIUsage(): void {
    this.aiServices.forEach((service) => service.resetUsageStats());
    this.globalUsage = {
      totalCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      estimatedCost: 0,
    };
  }
}

export class MogiProcess {
  public nodes: MogiNode[] = [];
  public currentNodeIndex = 0;

  constructor(
    public readonly id: MogiProcessID,
    public config: MogiProcessConfig = { retries: 3, timeoutMs: 10000 }
  ) {}

  addNode(node: MogiNode): this {
    this.nodes.push(node);
    return this;
  }

  async execute(agents: MogiAgentState[], simConfig: MogiSimulationConfig): Promise<void> {
    for (const agent of agents) {
      await this.runAgentThroughNodes(agent, simConfig);
    }
  }

  private async runAgentThroughNodes(
    agent: MogiAgentState,
    simConfig: MogiSimulationConfig
  ): Promise<void> {
    for (const node of this.nodes) {
      await node.execute(agent, simConfig.delayMs);
      await new Promise((resolve) => setTimeout(resolve, simConfig.delayMs));
    }
  }

  public resetExecution(): void {
    this.currentNodeIndex = 0;
  }

  public async executeAgentStep(
    agent: MogiAgentState,
    simConfig: MogiSimulationConfig
  ): Promise<boolean> {
    if (this.currentNodeIndex < this.nodes.length) {
      await this.nodes[this.currentNodeIndex].execute(agent, simConfig.delayMs);
      this.currentNodeIndex++;
      return true;
    }
    return false;
  }

  public getAIServices(): AIService[] {
    return this.nodes.map((n) => n.getAIService());
  }
}

export class MogiNode {
  constructor(public readonly id: MogiNodeID, private config: MogiNodeConfig) {}

  async execute(agent: MogiAgentState, delayMs: number): Promise<void> {
    try {
      const changes = await this.handler(agent);
      this.applyChanges(agent, changes);
    } catch (error) {
      console.error(`MogiNode ${this.id} failed:`, error);
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  private applyChanges(agent: MogiAgentState, changes: Record<string, any>): void {
    agent.attributes = { ...agent.attributes, ...changes };
    agent.history.push({
      timestamp: new Date(),
      nodeId: this.id,
      changes,
      reasoning: changes._reasoning,
    });
  }

  private async handler(agent: MogiAgentState) {
    const response = this.config.useChainOfThought
      ? await this.config.aiService.promptThinking(
          this.config.instructions,
          JSON.stringify(agent.attributes),
          this.config.appendMessage ??
            "Process the JSON object and make changes based on your instructions.",
          this.config.schema ?? this.config.aiService.createSchema(agent.attributes)
        )
      : await this.config.aiService.prompt(
          this.config.instructions,
          JSON.stringify(agent.attributes),
          this.config.appendMessage ??
            "Process the JSON object and make changes based on your instructions.",
          this.config.schema ?? this.config.aiService.createSchema(agent.attributes)
        );
    return parseAIReponse(response);
  }

  public getAIService(): AIService {
    return this.config.aiService;
  }
}

// Utility functions
export function encapsulateSchema(schemas: { [k: string]: Schema }): Schema {
  return {
    type: SchemaType.OBJECT,
    properties: schemas,
  };
}
export function createMogiNode(
  id: string = crypto.randomUUID(),
  ai: AIService,
  instructions: string,
  schemas?: { [k: string]: Schema },
  config?: Omit<MogiNodeConfig, "schema" | "aiService" | "instructions">
): MogiNode {
  const newNode = new MogiNode(crypto.randomUUID(), {
    aiService: ai,
    instructions,
    useChainOfThought: false,
    appendMessage: config?.appendMessage,
    schema: schemas ? encapsulateSchema(schemas) : undefined,
    ...config,
  });

  return newNode;
}

function parseAIReponse(response: AIPromptResponse): Record<string, any> {
  try {
    const [jsonStr, reasoning] = Array.isArray(response) ? response : [response];
    const result = JSON.parse(jsonStr);
    return { ...result, _reasoning: reasoning };
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    return { _error: "Invalid AI response", _raw: response };
  }
}

export class MogiConditionalProcess extends MogiProcess {
  private condition: (agent: MogiAgentState) => boolean;
  private trueBranch: MogiProcess;
  private falseBranch: MogiProcess;
  private branchStates = new Map<
    MogiAgentID,
    {
      branch: MogiProcess;
      completed: boolean;
    }
  >();

  constructor(
    id: string,
    condition: (agent: MogiAgentState) => boolean,
    trueBranch: MogiProcess,
    falseBranch: MogiProcess,
    nodes: MogiNode[] = [],
    config?: MogiProcessConfig
  ) {
    super(id, config);
    this.condition = condition;
    this.trueBranch = trueBranch;
    this.falseBranch = falseBranch;
    nodes.forEach((n) => this.addNode(n));
  }

  public async executeConditionalStep(
    agents: MogiAgentState[],
    simConfig: MogiSimulationConfig
  ): Promise<boolean> {
    let hasMoreSteps = false;

    for (const agent of agents) {
      if (this.currentNodeIndex < this.nodes.length) {
        await this.nodes[this.currentNodeIndex].execute(agent, simConfig.delayMs);
        await new Promise((resolve) => setTimeout(resolve, simConfig.delayMs));
        hasMoreSteps = true;
        continue;
      }

      // Initialize branch state if not set
      if (!this.branchStates.has(agent.id)) {
        const branch = this.condition(agent) ? this.trueBranch : this.falseBranch;
        branch.resetExecution();
        this.branchStates.set(agent.id, { branch, completed: false });
      }

      const branchState = this.branchStates.get(agent.id)!;
      if (!branchState.completed) {
        const branchHasSteps = await branchState.branch.executeAgentStep(agent, simConfig);
        if (branchHasSteps) hasMoreSteps = true;
        branchState.completed = !branchHasSteps;
      }
    }

    // Advance main process index if still in base nodes
    if (this.currentNodeIndex < this.nodes.length) {
      this.currentNodeIndex++;
      return true;
    }

    return hasMoreSteps;
  }

  public resetExecution(): void {
    super.resetExecution();
    this.branchStates.clear();
    this.trueBranch.resetExecution();
    this.falseBranch.resetExecution();
  }

  public updateBranches(trueBranch?: MogiProcess, falseBranch?: MogiProcess): void {
    if (trueBranch) this.trueBranch = trueBranch;
    if (falseBranch) this.falseBranch = falseBranch;
  }

  public getActiveBranch(agentId: MogiAgentID): MogiProcess | null {
    return this.branchStates.get(agentId)?.branch || null;
  }

  public getAIServices(): AIService[] {
    return [...this.nodes, this.trueBranch, this.falseBranch].flatMap((n) => {
      if (n instanceof MogiProcess) {
        return n.getAIServices();
      } else {
        return n.getAIService();
      }
    });
  }
}