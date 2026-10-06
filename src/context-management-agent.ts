import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import OpenAI from "openai";
import {
  contextToolsDefinition,
  getLargeDocument,
  summarize,
} from "./tools/index.ts";

const client = new OpenAI();
const model = "gpt-4o";

const runAgent = async (userMessage: string) => {
  let response = await client.responses.create({
    model,
    input: userMessage,
    tools: contextToolsDefinition,
  });

  let iteration = 0;

  while (true) {
    iteration++;

    const toolCalls = response.output.filter(
      (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
        item.type === "function_call",
    );

    console.log(`\nIteration ${iteration}`);
    console.log("Response ID:", response.id);

    if (toolCalls.length === 0) {
      return response.output_text;
    }

    const toolOutputs = await Promise.all(
      toolCalls.map(async (call) => {
        console.log("Tool:", call.name);
        let result = getLargeDocument();
        console.log("Tool result characters:", result.length);

        const MAX_CHARS = 50_000;

        if (result.length > MAX_CHARS) {
          result = await summarize(result, client, model);
        }

        console.log("Summary:", result);
        console.log("Summary characters:", result.length);

        return {
          type: "function_call_output" as const,
          call_id: call.call_id,
          output: result,
        };
      }),
    );

    response = await client.responses.create({
      model,
      previous_response_id: response.id,
      input: toolOutputs,
      tools: contextToolsDefinition,
    });
  }
};

const answer = await runAgent(
  "Read the document and tell me what the company does.",
);
console.log("\nFinal answer:");
console.log(answer);
