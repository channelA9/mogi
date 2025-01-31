# Mogi

Mogi is a simulation framework that allows you to create and run complex agent-based simulations using AI-driven nodes and processes. This README provides an overview of how to set up and use Mogi, including a detailed example of an amusement park simulation.

## Installation

To install Mogi, clone the repository and install the dependencies:

```bash
git clone https://github.com/yourusername/mogi.git
cd mogi
npm install
```

## Usage

### Creating a Simulation

To create a simulation, you need to initialize the `MogiSimulation` class with a configuration object. You can then add agents and define processes and nodes that the agents will go through.

### Example: Amusement Park Simulation

Below is an example of how to set up an amusement park simulation where agents (riders) go through ticketing, ride, and exit nodes.

#### Step 1: Initialize AI Service

```typescript
import { GoogleAIService } from "./ai-interfaces/ai-google";

const AI = new GoogleAIService("YOUR_API_KEY", "gemini-2.0-flash-exp");
```

#### Step 2: Create Simulation Instance

```typescript
import { MogiSimulation } from "./mogi";

const simulation = new MogiSimulation({
  description: "Amusement Park",
  delayMs: 3000,
  maxConcurrency: 2,
  printLogs: true,
});
```

#### Step 3: Add Agents

```typescript
const rider1Id = simulation.addAgent({
  attributes: { name: "Jake", money: 10, happiness: 5, height: 140, fatigue: 0 },
}, "Jake");

const rider2Id = simulation.addAgent({
  attributes: { name: "John", money: 10, happiness: 5, height: 180, fatigue: 0 },
}, "John");
```

#### Step 4: Create Nodes

```typescript
import { createMogiNode } from "./mogi";
import { SchemaType } from "@google/generative-ai";

const ticketingNode = createMogiNode(
  'ticketBox',
  AI,
  `
  As ticketing staff:
  - Verify rider height (150-200cm)
  - Charge $2 if valid
  - Update worker fatigue (+1)
  - Update rider money and happiness
`,
  {
    ticket: {
      type: SchemaType.STRING,
      enum: ["standard", "premium"],
    },
    money: {
      type: SchemaType.NUMBER,
    }
  },
  { useChainOfThought: true }
);

const rideNode = createMogiNode(
  'rideOperator',
  AI,
  `
  As ride operator:
  - Simulate ride experience
  - Increase rider happiness (1-5 points)
  - Increase rider fatigue (1-3 points)
`,
  {
    happiness: { type: SchemaType.NUMBER },
    fatigue: { type: SchemaType.NUMBER },
  },
  { useChainOfThought: false }
);

const exitNode = createMogiNode(
  'exitStaff',
  AI,
  `
  As exit staff:
  - Give farewell greeting
  - Final happiness adjustment (±1)
`,
  {
    happiness: { type: SchemaType.NUMBER },
    fatigue: { type: SchemaType.NUMBER },
  },
  { useChainOfThought: false }
);
```

#### Step 5: Create Processes

```typescript
import { MogiProcess } from "./mogi";

const fullRideProcess = new MogiProcess("full-ride")
  .addNode(ticketingNode)
  .addNode(rideNode)
  .addNode(exitNode);

const shortProcess = new MogiProcess("short-exit").addNode(exitNode);
```

#### Step 6: Create Conditional Process

```typescript
import { MogiConditionalProcess } from "./mogi";

const heightCondition = (min: number, max: number) => {
  return (agent: MogiAgentState) => {
    const height = agent.attributes.height;
    if (height) return height >= min && height <= max;
    return false;
  };
};

const amusementParkFlow = new MogiConditionalProcess(
  "height-check-flow",
  heightCondition(150, 200),
  fullRideProcess,
  shortProcess
);
```

#### Step 7: Run Simulation

```typescript
simulation.runProcess(amusementParkFlow).then(() => {
  console.log("Simulation completed\n");

  // Helper to display agent history
  const logHistory = (agentId: string) => {
    const agent = simulation.getAgentState(agentId);
    console.log(`\n${agent.attributes.name}'s journey:`);
    agent.history.forEach((entry) => {
      console.log(`[${entry.timestamp.toLocaleTimeString()}] ${JSON.stringify(entry.changes)}`);
    });
    console.log(agent.attributes);
  };

  logHistory(rider1Id);
  logHistory(rider2Id);

  const usage = simulation.getAIUsage();
  console.log(`API Usage:
    Calls: ${usage.totalCalls}
    Input tokens: ${usage.totalInputTokens}
    Output tokens: ${usage.totalOutputTokens}
    Estimated cost: $${usage.estimatedCost.toFixed(4)}`);
});
```

## License

This project is licensed under the MIT License.
