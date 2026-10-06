import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import OpenAI from "openai";
import { tools, toolDefinitions } from "./shared/research-agent-tools.ts";

const openai = new OpenAI();
const model = "gpt-4o";

const MAX_ITERATIONS = 10;

async function runAgent(userMessage: string) {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "user",
      content: userMessage,
    },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let response = await openai.chat.completions.create({
      model,
      messages,
      tools: toolDefinitions,
    });

    const message = response.choices[0]?.message;

    const toolCall = message?.tool_calls?.[0];

    if (toolCall) {
      const toolName = toolCall.function.name;

      const tool = tools.find((tool) => tool.name === toolName);
      if (!tool) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      const rawArgs = JSON.parse(toolCall.function.arguments);
      const args = tool.schema.parse(rawArgs);

      let result;
      try {
        result = await tool.execute(args);
      } catch (error) {
        result = {
          error: error instanceof Error ? error.message : "Unknown tool error",
        };
      }

      messages.push(message);

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
      console.log(`Iteration ${i + 1}: ${messages.length} messages`);
      continue;
    }
    console.log(JSON.stringify(messages, null, 2));

    return message.content;
  }
}

const userMessage = `
Get the current weather in Vancouver.
Then calculate exactly how many degrees warmer or colder
it is compared to 15 degrees.
Use the calculator for the comparison.
Finally, give me a short summary.
`;

const answer = await runAgent(userMessage);

console.log("\nFinal answer:");
console.log(answer);
