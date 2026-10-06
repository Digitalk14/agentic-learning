import { sdk } from "./instrumentation.ts";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import OpenAI from "openai";
import { observeOpenAI } from "@langfuse/openai";
import { z } from "zod";

import { startActiveObservation } from "@langfuse/tracing";
import { knowledgeSearch, webSearch } from "./tools/index.ts";

const client = observeOpenAI(new OpenAI());
const model = "gpt-4o";

const DecisionSchema = z.object({
  action: z.enum(["knowledgeSearch", "webSearch", "final", "failed"]),
  reason: z.string(),
  arguments: z.object({
    query: z.string(),
  }),
  answer: z.string(),
});

type Decision = z.infer<typeof DecisionSchema>;

const MAX_ITERATIONS = 10;
const TOOL_TIMEOUT_MS = 2000;

const executeTool = async (decision: Decision) => {
  if (
    decision.action !== "knowledgeSearch" &&
    decision.action !== "webSearch"
  ) {
    throw new Error("Cannot execute a non-tool decision");
  }
  if (!decision.arguments.query) {
    throw new Error("Cannot execute a without a query");
  }
  return startActiveObservation(
    decision.action,
    async (tool) => {
      tool.update({
        input: decision,
      });
      try {
        const result =
          decision.action === "knowledgeSearch"
            ? await knowledgeSearch(decision.arguments.query)
            : await webSearch(decision.arguments.query);
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
You are an agent with access to two external information tools:

1. knowledgeSearch
   - searches the internal knowledge base
   - contains application-specific, fictional, domain-specific, or private information

2. webSearch
   - searches information available on the public web
   - should be used when current, public, or web-based information is needed

Your job is to answer the user's question accurately.
You must decide which tool, if any, is appropriate.

Use knowledgeSearch when:
- the answer may exist in the internal knowledge base
- the question refers to fictional, narrative, domain-specific,
  or knowledge-base-specific information
- the user asks about information that may be stored internally

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

Do NOT use knowledgeSearch when:
- the question clearly requires current public web information
- the question can be answered reliably without external information
- searching the internal knowledge base would not provide useful information

If the question could reasonably require internal information,
prefer knowledgeSearch over webSearch.

After receiving tool results:
- carefully inspect the retrieved content
- if the results contain enough information, use final
- if the results are insufficient, you may use another tool
- if the first tool was inappropriate, choose the other tool
- do not repeat the exact same search query
- if you cannot obtain enough information after reasonable attempts,
  use failed

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

        console.log("Tool result:",);
        console.dir(result, {depth:null, colors: true});

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

const answer = await runAgent("What is the weather in Vancouver today?");

console.log("\nFinal answer:");
console.dir(answer, {depth: null, colors: true});

await sdk.shutdown();
