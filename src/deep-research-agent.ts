import { sdk } from "./instrumentation.ts";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import OpenAI from "openai";
import { observeOpenAI } from "@langfuse/openai";
import { z } from "zod";

import { startActiveObservation } from "@langfuse/tracing";
import { webSearch } from "./tools/index.ts";

const client = observeOpenAI(new OpenAI());
const model = "gpt-4o";

const DecisionSchema = z.object({
  action: z.enum(["search", "failed", "final"]),
  reason: z.string(),
  arguments: z.object({
    query: z.string(),
  }),
  answer: z.string(),
});

type Decision = z.infer<typeof DecisionSchema>;

const MAX_ITERATIONS = 10;

const deepResearch = async (decision: Decision) => {
  if (decision.action !== "search") {
    throw new Error("Cannot execute a non-tool decision");
  }
  if (!decision.arguments?.query) {
    throw new Error("Cannot execute a without a query");
  }

  return startActiveObservation(decision.action, async (tool) => {
    tool.update({
      input: decision,
    });
    try {
      const result = webSearch(decision.arguments?.query);
      if (!result) throw new Error("Query shouldn't be empty");
      tool.update({
        output: result,
      });
      return result;
    } catch (error) {
      tool.update({
        output: {
          error: error instanceof Error ? error.message : "Unknown tool error",
        },
      });
      throw error;
    }
  });
};

const runAgent = async (userMessage: string) => {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `
You are an agent with access to two external information tools:

1. webSearch
   - searches information available on the public web
   - should be used when current, public, or web-based information is needed

Your job is to answer the user's question accurately.
You must decide which tool, if any, is appropriate.

Use webSearch when:
- the question requires current information
- the user asks about recent events, current people, companies,
  products, prices, news, or other information that may have changed
- the information is likely to be available on the public web
- you need external public information that is not expected to exist
  in the internal knowledge base

When using webSearch:
- create a search query that directly matches the user's question
- do not add an arbitrary year or date unless the user specified it
- for current information, prefer queries such as "current CEO of OpenAI"

Do NOT use webSearch when:
- the question can be answered reliably from the conversation
- the question is a simple general-knowledge question
- the required information is expected to be in the internal knowledge base

If the question could reasonably require internal information,
prefer knowledgeSearch over webSearch.

After receiving search results:
1. Review the original user question.
2. Review all information collected so far.
3. Determine whether the available information is sufficient to answer the question accurately.
4. If important information is missing, perform another search.
5. If the information is sufficient, use final.
6. Do not search merely to gather more information when the existing information is already sufficient.

When analyzing search results:
- prioritize information that matches the user's requested time period
- check publication dates and timestamps when available
- prefer current data over historical or outdated information
- compare conflicting results
- consider the reliability and relevance of sources
- do not assume that having search results means the information is sufficient
- if the results contain conflicting, outdated, or insufficient information,perform another search

When using final:
- provide the answer in the answer field

When using failed:
- explain why the task could not be completed in the answer field
`,
    },
    {
      role: "user",
      content: userMessage,
    },
  ];

  return await startActiveObservation("deep-research-agent", async (agent) => {
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
        const result = await deepResearch(decision);

        console.log("Tool result:");
        console.dir(result, { depth: null, colors: true });

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
  });
};

const answer = await runAgent("What is the weather in Vancouver today?");

console.log("\nFinal answer:");
console.dir(answer, { depth: null, colors: true });

await sdk.shutdown();
