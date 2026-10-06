import { sdk } from "./instrumentation.ts";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import OpenAI from "openai";
import { observeOpenAI } from "@langfuse/openai";
import { z } from "zod";

import { startActiveObservation } from "@langfuse/tracing";

const client = observeOpenAI(new OpenAI());
const model = "gpt-4o";

const DecisionSchema = z.object({
  action: z.enum(["getRandomNumber", "final", "failed"]),
  reason: z.string(),
  answer: z.string(),
});

type Decision = z.infer<typeof DecisionSchema>;

const MAX_ITERATIONS = 10;
const TOOL_TIMEOUT_MS = 2000;

const getRandomNumber = async () => {
  // Имитация долгой операции
  const randomNumber = Math.floor(Math.random() * 101);

  if (randomNumber % 2 === 0) {
    throw new Error("OOOps something went wrong");
  }

  return randomNumber;
};

const executeTool = async (decision: Decision) => {
  if (decision.action !== "getRandomNumber") {
    throw new Error("Cannot execute a non-tool decision");
  }
  return startActiveObservation(
    "getRandomNumber",
    async (tool) => {
      tool.update({
        input: decision,
      });
      try {
        const result = await getRandomNumber();
        tool.update({
          output: result,
        });
        return result;
      } catch (error) {
        tool.update({
          output: {
            error:
              error instanceof Error ? error.message : "Unknown tool error",
          },
        });
        throw error;
      }
    },
    {
      asType: "tool",
    },
  );
};

const runAgent = async (userMessage: string) => {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "user",
      content: userMessage,
    },
  ];

  return await startActiveObservation("random-number-agent", async (agent) => {
    agent.update({
      input: {
        userMessage,
      },
    });

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      console.log(`\nIteration ${i + 1}`);

      const response = await client.chat.completions.create({
        model,
        messages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "decision",
            schema: z.toJSONSchema(DecisionSchema),
            strict: true,
          },
        },
      });

      const content = response.choices[0]?.message.content;

      if (!content) {
        throw new Error("LLM returned empty response");
      }

      const decision = DecisionSchema.parse(JSON.parse(content));

      console.log("Decision:", decision);

      if (decision.action === "final") {
        agent.update({
          output: {
            answer: decision.answer,
          },
        });

        return decision.answer;
      }

      if (decision.action === "failed") {
        const answer = `Agent failed: ${decision.answer}`;

        agent.update({
          output: {
            answer,
          },
        });

        return answer;
      }

      try {
        const result = await executeTool(decision);

        console.log("Tool result:", result);

        messages.push({
          role: "assistant",
          content,
        });

        messages.push({
          role: "user",
          content: `Tool result: ${result}`,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown tool error";

        console.log("Tool error:", errorMessage);

        messages.push({
          role: "assistant",
          content,
        });

        messages.push({
          role: "user",
          content: `Tool failed: ${errorMessage}`,
        });
      }
    }

    throw new Error("Max iterations reached");
  });
};

const answer = await runAgent("Give me a random number");

console.log("\nFinal answer:");
console.log(answer);

await sdk.shutdown();
