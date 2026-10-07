import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import { Agent, run, tool, type InputGuardrail } from "@openai/agents";
import { z } from "zod";

const model = "gpt-4o";

// const calculator = tool({
//   name: "calculator",
//   description: "Calculate a mathematical expression",
//   parameters: z.object({
//     a: z.number(),
//     b: z.number(),
//     operation: z.enum(["add", "subtract", "multiply", "divide"]),
//   }),
//   execute: async ({ a, b, operation }) => {
//     switch (operation) {
//       case "add":
//         return a + b;
//       case "subtract":
//         return a - b;
//       case "multiply":
//         return a * b;
//       case "divide":
//         return a / b;
//     }
//   },
// });

const guardrailOutput = z.object({
  allowed: z.boolean(),
  reason: z.string(),
});

const guardrailAgent = new Agent({
  name: "Topic Guardrail Agent",
  model,
  instructions: `
    Determine whether the user's request is related to programming.
    Allow requests about:
    - programming
    - software development
    - JavaScript
    - TypeScript
    - coding
    - debugging
    - software engineering
    Reject requests that are unrelated to programming.
    Return whether the request is allowed and briefly explain why.
  `,
  outputType: guardrailOutput,
});
const topicGuardrail: InputGuardrail = {
  name: "Topic Guardrail",
  runInParallel: false,
  execute: async ({ input }) => {
    const result = await run(guardrailAgent, input);
    return {
      outputInfo: result.finalOutput,
      tripwireTriggered: !result.finalOutput?.allowed,
    };
  },
};

const researchAgent = new Agent({
  name: "Research Agent",
  model,
  instructions:
    "You answer factual questions. Provide clear and concise explanations.",
});

const codingAgent = new Agent({
  name: "Coding Agent",
  model,
  instructions:
    "You help with programming questions. Explain solutions clearly and provide TypeScript examples when useful.",
});

const triageAgent = new Agent({
  name: "Triage Agent",
  model,
  instructions:
    "You are the first point of contact. Decide whether the user's request is about research or programming, and hand it off to the appropriate specialist.",
  handoffs: [researchAgent, codingAgent],
  inputGuardrails: [topicGuardrail],
});

// const agent = new Agent({
//   name: "Assistant",
//   instructions: "You are a helpful assistant.",
//   model,
//   tools: [calculator],
// });
const result = await run(
  triageAgent,
  "What is the capital of France?",
);

console.log(result.finalOutput);
