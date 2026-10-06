import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import OpenAI from "openai";
import { calculator, getTime, tools } from "./tools/index.ts";
import { toolsDefinition } from "./shared/tools-definition.ts";

const client = new OpenAI();

const model = "gpt-4o";

const executeTool = (toolName: string, args: any) => {
  const tool = tools[toolName as keyof typeof tools];
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  return tool(args);
};

type Message = any

type AgentState = {
  messages: Message[];
  lastToolResult?: unknown;

};

async function runAgent(userMessage: string) {
  let response = await client.responses.create({
    model,
    input: userMessage,
    tools: toolsDefinition,
  });

  const state: AgentState = {
    messages: []
  }

  while (true) {
    // Find tool calls requested by the model
    const toolCalls = response.output.filter(
      (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
        item.type === "function_call",
    );

    // No tool calls -> agent is finished
    if (toolCalls.length === 0) {
      return response.output_text;
    }

    // Execute every requested tool
    const toolOutputs = toolCalls.map((call) => {
      const args = JSON.parse(call.arguments);

      const result = executeTool(call.name, args)
      state.lastToolResult = result;

      return {
        type: "function_call_output" as const,
        call_id: call.call_id,
        output: JSON.stringify(result),
      };
    });

    // Send tool results back to the model
    response = await client.responses.create({
      model,
      previous_response_id: response.id,
      input: toolOutputs,
      tools: toolsDefinition,
    });
  }
}

const answer = await runAgent("Calculate 10 + 20, then multiply the result by 5, then tell me the current time.");
console.log("\nFinal answer:");
console.log(answer);
