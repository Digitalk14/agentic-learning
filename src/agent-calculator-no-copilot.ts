// @copilot disable-file
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import OpenAI from "openai";

const client = new OpenAI();

const model = "gpt-4o";

function calculator(a: number, b: number, operation: string) {
  switch (operation) {
    case "add":
      return a + b;
    case "subtract":
      return a - b;
    case "multiply":
      return a * b;
    case "divide":
      return a / b;
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}
const tools: OpenAI.Responses.Tool[] = [
  {
    type: "function",
    name: "calculator",
    description: "Perform a basic arithmetic calculation.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        a: {
          type: "number",
          description: "First number",
        },
        b: {
          type: "number",
          description: "Second number",
        },
        operation: {
          type: "string",
          enum: ["add", "subtract", "multiply", "divide"],
          description: "The arithmetic operation to perform",
        },
      },
      required: ["a", "b", "operation"],
      additionalProperties: false,
    },
  },
];

const runAgent = async (userMessage: string) => {
  let response = await client.responses.create({
    model,
    input: userMessage,
    tools,
  });

  while (true) {
    const toolCalls = response.output.filter(
      (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
        item.type === "function_call",
    );
    if (toolCalls.length === 0) {
      return response.output_text;
    }

    const toolOutputs = toolCalls.map((call) => {
      const args = JSON.parse(call.arguments);

      if (call.name !== "calculator") {
        throw new Error("call unknown tool");
      }

      const result = calculator(args.a, args.b, args.operation);

      return {
        type: "function_call_output" as const,
        call_id: call.call_id,
        output: String(result),
      };
    });

    response = await client.responses.create({
      model,
      previous_response_id: response.id,
      input: toolOutputs,
      tools,
    });
  }
};

const answer = await runAgent("What is 5 plus 3, and then multiply by 2?");
console.log("\nFinal answer:");
console.log(answer);
