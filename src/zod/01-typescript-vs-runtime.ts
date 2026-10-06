import { z } from "zod";

const DecisionSchema = z.object({
  action: z.enum(["calculator", "weather"]),
  reason: z.string(),
  arguments: z.object({
    a: z.number(),
    b: z.number(),
  }),
});

type Decision = z.infer<typeof DecisionSchema>;

function processDecision(decision: Decision) {
  console.log("Action:", decision.action);
  console.log("Value + 10:", decision.arguments.a + 10);
}

const data: unknown = {
  action: "calculator",
  reason: "Need to add two numbers",
  arguments: {
    a: 10,
    b: 20,
  },
};

const result = DecisionSchema.safeParse(data);

if (result.success) {
  const decision = result.data;

  console.log(decision.action);
  console.log(decision.reason);
  console.log(decision.arguments.a);
}
