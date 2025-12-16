import OpenAI from "openai";

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
  // Try Groq first (fastest, free tier), then DeepSeek, then OpenAI
  const groqKey = process.env.GROQ_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (!groqKey && !deepseekKey && !openaiKey) {
    throw new Error("No AI API key configured. Please set GROQ_API_KEY, DEEPSEEK_API_KEY, or OPENAI_API_KEY in Secrets.");
  }

  const apiKey = groqKey || deepseekKey || openaiKey;
  const baseURL = groqKey 
    ? "https://api.groq.com/openai/v1"
    : deepseekKey 
    ? "https://api.deepseek.com"
    : undefined;

  const openai = new OpenAI({
    apiKey,
    baseURL,
  });

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
    // Select model based on provider
    const model = groqKey 
      ? "llama-3.3-70b-versatile"  // Groq's best model for instruction generation
      : deepseekKey 
      ? "deepseek-chat"
      : "gpt-4o";
    
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned an empty response");
    }

    let result: { instructions?: string[] };
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response as JSON:", content);
      throw new Error("OpenAI returned invalid JSON. Please try again.");
    }

    if (!Array.isArray(result.instructions)) {
      console.error("OpenAI response missing instructions array:", result);
      throw new Error("OpenAI response was missing the expected instructions format. Please try again.");
    }

    return result.instructions;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        throw error;
      }
      if (error.message.includes("invalid JSON") || error.message.includes("missing the expected")) {
        throw error;
      }
      console.error("OpenAI API error details:", error);
      throw new Error(`Failed to generate instructions: ${error.message}`);
    }
    console.error("Unknown error generating cooking instructions:", error);
    throw new Error("An unexpected error occurred while generating cooking instructions");
  }
}
