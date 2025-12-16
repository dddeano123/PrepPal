import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface IngredientInput {
  name: string;
  amount?: number;
  unit?: string;
  grams?: number;
}

export async function generateCookingInstructions(
  title: string,
  ingredients: IngredientInput[],
  tools: string[]
): Promise<string[]> {
  const ingredientsList = ingredients
    .map(ing => {
      if (ing.amount && ing.unit) {
        return `- ${ing.amount} ${ing.unit} ${ing.name}`;
      }
      if (ing.grams) {
        return `- ${ing.grams}g ${ing.name}`;
      }
      return `- ${ing.name}`;
    })
    .join("\n");

  const toolsList = tools.length > 0 
    ? `Available cooking tools:\n${tools.map(t => `- ${t}`).join("\n")}`
    : "No specific cooking tools specified.";

  const prompt = `You are a professional chef. Generate clear, step-by-step cooking instructions for the following recipe.

Recipe: ${title}

Ingredients:
${ingredientsList}

${toolsList}

Generate practical cooking instructions that:
1. Use the available tools when appropriate
2. Include prep steps (washing, cutting, measuring)
3. Give approximate cooking times and temperatures
4. Are numbered and easy to follow
5. Result in a well-prepared dish

Respond with JSON in this format: { "instructions": ["Step 1...", "Step 2...", ...] }`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in response");
    }

    const result = JSON.parse(content);
    return result.instructions || [];
  } catch (error) {
    console.error("Error generating cooking instructions:", error);
    throw new Error("Failed to generate cooking instructions");
  }
}
