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
  action: z.enum(["knowledgeSearch", "final", "failed"]),
  reason: z.string(),
  arguments: z.object({
    query: z.string(),
  }),
  answer: z.string(),
});

type Decision = z.infer<typeof DecisionSchema>;

const MAX_ITERATIONS = 10;
const TOOL_TIMEOUT_MS = 2000;

async function knowledgeSearch(query: string) {
  const response = await fetch("http://localhost:3000/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error("RAG request failed");
  }
  return response.json();
}

const executeTool = async (decision: Decision) => {
  if (decision.action !== "knowledgeSearch") {
    throw new Error("Cannot execute a non-tool decision");
  }
  if (!decision.arguments.query) {
    throw new Error("Cannot execute a without a query");
  }
  return startActiveObservation(
    "knowledgeSearch",
    async (tool) => {
      tool.update({
        input: decision,
      });
      try {
        const result = await knowledgeSearch(decision.arguments.query);
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
      role: "system",
      content: `
You are an agent with access to a knowledge base.
Your job is to answer the user's question accurately.
You have access to knowledgeSearch, which can retrieve information
from the knowledge base.
You must decide whether you need to use knowledgeSearch.
Use knowledgeSearch when:
- the answer depends on information that may exist in the knowledge base
- you do not have enough information to answer reliably
- the user asks about specific content that may be stored in the knowledge base

When deciding whether to use knowledgeSearch:
- consider whether the answer may depend on information stored in the knowledge base
- do not assume your general knowledge is sufficient when the question could refer to fictional, narrative, domain-specific, or knowledge-base-specific information

After receiving search results:
- If the results contain enough information to answer the question, use final.
- If the search succeeded but the results are irrelevant or insufficient, use knowledgeSearch again with a different, more precise query.
- When retrying, identify why the previous results were insufficient and change the query accordingly.
- Do not repeat the same search query.
- If you have tried reasonable alternative queries and still cannot obtain useful information, use failed.
- Use failed when the task cannot be completed.

Do NOT use knowledgeSearch when:
- you can answer the question reliably without external information
- the question is a simple general-knowledge question
- searching would not provide useful additional information
After receiving search results:
- carefully inspect the retrieved content
- if the results contain enough information, return the answer using final
- use failed only when you cannot complete the task
When using failed, provide a clear explanation in answer.
Prefer knowledgeSearch when the question could have
multiple interpretations or when the answer may depend
on fictional, narrative, domain-specific, or knowledge-base-specific information.
Do not assume that your general knowledge is sufficient
when the question may refer to content stored in the knowledge base.

When retrying:
- identify why the previous search was insufficient
- change the query based on that reason
- make the new query more specific or use different relevant terms
`,
    },
    {
      role: "user",
      content: userMessage,
    },
  ];

  return await startActiveObservation("call-to-rag", async (agent) => {
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
          content: `Tool result: ${JSON.stringify(result)}`,
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

const answer = await runAgent("Who was the keeper of the Obsidian Light?");

console.log("\nFinal answer:");
console.log(answer);

await sdk.shutdown();
