import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import { Agent, run, tool, type InputGuardrail } from "@openai/agents";
import { z } from "zod";
import {
  webSearchWithSdk,
  knowledgeSearchWithSdk,
} from "../src/tools/index.ts";

const model = "gpt-4o";

const guardrailOutput = z.object({
  allowed: z.boolean(),

  reason: z.string(),
});

const guardrailAgent = new Agent({
  name: "Topic Guardrail Agent",
  model,
  instructions: `
    Check whether the user's request is appropriate for this search agent.
    Allow requests that can be answered using:
    - the fictional stories in our knowledge base
    - information that can be found on the web
    Reject requests that are unrelated to searching for information.
  `,
  outputType: guardrailOutput,
});

const agent = new Agent({
  name: "Search agent",
  model,
  instructions: "You help finding the right answers on the user quesitions",
  tools: [webSearchWithSdk, knowledgeSearchWithSdk],
  inputGuardrails: [
    {
      name: "Topic Guardrail",
      execute: async ({ input }) => {
        const result = await run(guardrailAgent, input);
        return {
          outputInfo: result.finalOutput,
          tripwireTriggered: !result.finalOutput?.allowed,
        };
      },
    },
  ],
});

const result = await run(agent, "Write me a poem about my dog.");

console.log(result.finalOutput);
