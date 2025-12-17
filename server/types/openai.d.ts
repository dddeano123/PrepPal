declare module "openai" {
  interface ChatCompletionMessageParam {
    role: "system" | "user" | "assistant";
    content: string;
  }

  interface ChatCompletionCreateParams {
    model: string;
    messages: ChatCompletionMessageParam[];
    response_format?: { type: "text" | "json_object" };
    max_completion_tokens?: number;
  }

  interface ChatCompletionMessage {
    role: string;
    content: string | null;
  }

  interface ChatCompletionChoice {
    message: ChatCompletionMessage;
    index: number;
    finish_reason: string;
  }

  interface ChatCompletion {
    id: string;
    choices: ChatCompletionChoice[];
    model: string;
  }

  interface ChatCompletions {
    create(params: ChatCompletionCreateParams): Promise<ChatCompletion>;
  }

  interface Chat {
    completions: ChatCompletions;
  }

  export default class OpenAI {
    chat: Chat;
    constructor(options: { apiKey: string; baseURL?: string });
  }
}
