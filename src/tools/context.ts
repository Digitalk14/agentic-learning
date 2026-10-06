import OpenAI from "openai";

export const getLargeDocument = () => {
  return Array.from({ length: 1000 }, (_, i) => {
    if (i === 537) {
      return "The company develops video games and owns several major gaming franchises";
    }
    return `Document paragraph ${i}: This is some information about an imaginary company, its products, employees, history and internal processes.`;
  }).join("\n");
};

export const pruneMessages = (messages) => {};

export const summarize = async (
  text: string,
  client: OpenAI,
  model: string,
) => {
  const response = await client.responses.create({
    model,
    input: `
Create a concise context summary.
Preserve:
- important facts
- numbers
- decisions
- entities
- conclusions
- information needed to continue the current task
Remove:
- repetition
- irrelevant details
- verbose explanations
Text:
${text}
`,
  });

  return response.output_text;
};

export const contextToolsDefinition: OpenAI.Responses.Tool[] = [
  {
    type: "function",
    name: "getLargeDocument",
    strict: true,
    description: "Returns a large document.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
];
