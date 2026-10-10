import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import {
  StateGraph,
  StateSchema,
  START,
  END,
  type GraphNode,
} from "@langchain/langgraph";

import { ChatOpenAI } from "@langchain/openai";

import { z } from "zod";

const State = new StateSchema({
  question: z.string(),
  needsCalculator: z.boolean().default(false),
  answer: z.string().default(""),
  attempts: z.number().default(0),
  isValid: z.boolean().default(false),
});

const model = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0,
});

const Decision = z.object({
  needsCalculator: z.boolean(),
});

const validate: GraphNode<typeof State> = async (state) => {
  const isValid = state.answer === "1000";
  console.log(`Validation: ${isValid ? "passed" : "failed"}`);

  return {
    isValid,
  };
};

const classify: GraphNode<typeof State> = async (state) => {
  const classifier = model.withStructuredOutput(Decision);
  const decision = await classifier.invoke([
    {
      role: "system",
      content:
        "Decide whether answering the user's question requires arithmetic calculation. Return true if calculation is needed, otherwise false.",
    },
    {
      role: "user",
      content: state.question,
    },
  ]);
  console.log("Classification:", decision);
  return {
    needsCalculator: decision.needsCalculator,
  };
};

const CalculatorInput = z.object({
  a: z.number(),
  b: z.number(),
});

const calculator: GraphNode<typeof State> = async (state) => {
  const extractor = model.withStructuredOutput(CalculatorInput);
  const { a, b } = await extractor.invoke([
    {
      role: "system",
      content:
        "Extract the two numbers that should be multiplied to answer the user's question. Return them as a and b.",
    },
    {
      role: "user",
      content: state.question,
    },
  ]);
  const result = a * b;
  console.log(`Calculator: ${a} * ${b} = ${result}`);
  return {
    answer: String(result),
    attempts: state.attempts + 1,
  };
};

const generateAnswer: GraphNode<typeof State> = async (state) => {
  if (state.needsCalculator) {
    return {};
  }
  const response = await model.invoke([
    {
      role: "system",
      content: "Answer the user's question concisely.",
    },
    {
      role: "user",
      content: state.question,
    },
  ]);
  return {
    answer: String(response.content),
  };
};

function routeValidation(state: typeof State.State) {
  if (state.isValid) {
    return END;
  }

  if (state.attempts >= 3) {
    return END;
  }

  return "calculator";
}

function route(state: typeof State.State) {
  return state.needsCalculator ? "calculator" : "generateAnswer";
}

const graph = new StateGraph(State)
  .addNode("classify", classify)
  .addNode("calculator", calculator)
  .addNode("validate", validate)
  .addNode("generateAnswer", generateAnswer)
  .addEdge(START, "classify")
  .addConditionalEdges("classify", route, ["calculator", "generateAnswer"])
  .addEdge("calculator", "validate")
  .addConditionalEdges("validate", routeValidation, ["calculator", END])
  .addEdge("generateAnswer", END)
  .compile();

async function main() {
  const result = await graph.invoke({
    question: "What is 125 * 8?",
  });
  console.log("\nFinal state:", result);
}

main().catch(console.error);
