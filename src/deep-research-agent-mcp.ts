import { sdk } from "./instrumentation.ts";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import OpenAI from "openai";
import { observeOpenAI } from "@langfuse/openai";

import { startActiveObservation } from "@langfuse/tracing";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = observeOpenAI(new OpenAI());
const model = "gpt-4o";

const mcpClient = new Client({
  name: "deep-research-agent",
  version: "1.0.0",
});

const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", "../mcp-server/src/server.ts"],
});

await mcpClient.connect(transport);

const { tools } = await mcpClient.listTools();

const openAITools = tools.map((tool) => ({
  type: "function" as const,
  function: {
    name: tool.name,
    description: tool.description ?? "",
    parameters: tool.inputSchema,
  },
}));

const MAX_ITERATIONS = 10;
const currentDate = new Date().toISOString().split("T")[0];

const runAgent = async (userMessage: string) => {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `
You are a research agent.

Today's date is ${currentDate}.

IMPORTANT:
- Always treat ${currentDate} as the current date.
- Never invent or assume a different current date.
- When the user asks for "today", "current", "now", etc., use ${currentDate}.
- When creating search queries for current information, do not use dates from your training data.
- Do not add a year or date to a search query unless it is relevant to the user's request.

Your job is to answer the user's question accurately.

Use available tools when external information is required.

Use webSearch when:
- the question requires current information
- the user asks about recent events, current people, companies,
  products, prices, news, or other information that may have changed
- the information is likely to be available on the public web
- you need external public information

Do NOT use webSearch when:
- the question can be answered reliably from the conversation
- the question is a simple general-knowledge question

After receiving tool results:
1. Review the original user question.
2. Review all information collected so far.
3. Determine whether the available information is sufficient.
4. If important information is missing, use a tool again.
5. If the information is sufficient, provide the final answer.

When analyzing search results:
- prioritize information that matches the user's requested time period
- check publication dates and timestamps when available
- prefer current data over historical or outdated information
- compare conflicting results
- consider the reliability and relevance of sources
- do not assume that having search results means the information is sufficient
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
        tools: openAITools,
      });

      const message = response.choices[0]?.message;

      if (!message) {
        throw new Error("LLM returned empty response");
      }

      console.log("Assistant message:");
      console.dir(message, { depth: null, colors: true });

      // Model decided to use one or more tools
      if (message.tool_calls?.length) {
        messages.push(message);

        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArguments = JSON.parse(toolCall.function.arguments);

          console.log(`Calling MCP tool: ${toolName}`);
          console.log("Arguments:", toolArguments);

          try {
            const result = await startActiveObservation(
              toolName,
              async (tool) => {
                tool.update({
                  input: toolArguments,
                });

                try {
                  const result = await mcpClient.callTool({
                    name: toolName,
                    arguments: toolArguments,
                  });

                  tool.update({
                    output: result,
                  });

                  return result;
                } catch (error) {
                  tool.update({
                    output: {
                      error:
                        error instanceof Error
                          ? error.message
                          : "Unknown tool error",
                    },
                  });

                  throw error;
                }
              },
            );

            console.log("Tool result:");
            console.dir(result, { depth: null, colors: true });

            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown tool error";

            console.log("Tool error:", errorMessage);

            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                error: errorMessage,
              }),
            });
          }
        }

        continue;
      }

      // No tool call = model decided to answer
      const answer = message.content;

      if (!answer) {
        throw new Error("LLM returned empty response");
      }

      agent.update({
        output: {
          answer,
        },
      });

      return answer;
    }

    throw new Error("Maximum iterations reached");
  });
};

const answer = await runAgent("What is the weather in Vancouver today?");

console.log("\nFinal answer:");
console.dir(answer, { depth: null, colors: true });

await mcpClient.close();
await sdk.shutdown();
