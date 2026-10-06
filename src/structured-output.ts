import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { calculator } from "./tools/index.ts";

const client = new OpenAI();

const DecisionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("calculator"),
    reason: z.string(),
    arguments: z.object({
      a: z.number(),
      b: z.number(),
      operation: z.enum(["add", "subtract", "multiply", "divide"]),
    }),
  }),
  z.object({
    action: z.literal("weather"),
    reason: z.string(),
    arguments: z.object({
      city: z.string(),
    }),
  }),
  z.object({
    action: z.literal("final"),
    reason: z.string(),
    answer: z.string(),
  }),
]);

let messages = [
  {
    role: "user",
    content: "What is the weather in Vancouver?",
  },
];

for (let i = 0; i < 10; i++) {
  const response = await client.responses.parse({
    model: "gpt-4o",
    input: messages,
    text: {
      format: zodTextFormat(DecisionSchema, "decision"),
    },
  });

  const decision = response.output_parsed;

  console.log("Decision:", decision);

  if (decision.action === "final") {
    console.log("\nFinal answer:", decision.answer);
    break;
  }

  // execute tool
  const toolResult = await executeTool(decision);

  // add result back to conversation
  messages.push({
    role: "assistant",
    content: JSON.stringify(decision),
  });

  messages.push({
    role: "user",
    content: `Tool result: ${JSON.stringify(toolResult)}`,
  });
}

type Decision = z.infer<typeof DecisionSchema>

async function executeTool(decision: Decision) {
  switch (decision.action) {
    case "calculator":
      return calculator(decision.arguments);

    case "weather":
      return getWeather(decision.arguments.city);
  }
}
