import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import OpenAI from "openai";
import { memoryToolsDefinition, saveMemory, getMemory } from "./tools/index.ts";
const MEMORY_FILE = "./memory/memory.json";

const client = new OpenAI();
const model = "gpt-4o";

const runAgent = async (userMessage: string) => {
  let response = await client.responses.create({
    model,
    input: userMessage,
    tools: memoryToolsDefinition,
  });

  while (true) {
    const toolCalls = response.output.filter(
      (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
        item.type === "function_call",
    );
    if (toolCalls.length === 0) {
      return response.output_text;
    }

    const toolOutputs = await Promise.all(
      toolCalls.map(async (call) => {
        const args = JSON.parse(call.arguments);
        console.log("LLM requested tool:");
        console.log(call.name);
        console.log(args);
        let result;

        switch (call.name) {
          case "saveMemory":
            result = await saveMemory(args.key, args.value, MEMORY_FILE);
            break;
          default:
            result = await getMemory(args.key, MEMORY_FILE);
            break;
        }

        console.log("Tool result:", result);
        return {
          type: "function_call_output" as const,
          call_id: call.call_id,
          output: JSON.stringify(result),
        };
      }),
    );
    response = await client.responses.create({
      model,
      previous_response_id: response.id,
      input: toolOutputs,
      tools: memoryToolsDefinition,
    });
  }
};

const answer = await runAgent("Where do I live?");
console.log("\nFinal answer:");
console.log(answer);
