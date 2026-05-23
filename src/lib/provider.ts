import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import {
  LanguageModelV2,
  LanguageModelV2StreamPart,
  LanguageModelV2Message,
  LanguageModelV2CallOptions,
} from "@ai-sdk/provider";

const ANTHROPIC_MODEL = "claude-haiku-4-5";
const OPENAI_MODEL = "gpt-4o";

export class MockLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2" as const;
  readonly provider = "mock";
  readonly modelId: string;
  readonly supportedUrls = {};

  constructor(modelId: string) {
    this.modelId = modelId;
  }

  private async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractUserPrompt(messages: LanguageModelV2Message[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role === "user") {
        const content = message.content;
        if (Array.isArray(content)) {
          return content
            .filter((part: any) => part.type === "text")
            .map((part: any) => part.text)
            .join(" ");
        }
      }
    }
    return "";
  }

  private async *generateMockStream(
    messages: LanguageModelV2Message[],
    userPrompt: string
  ): AsyncGenerator<LanguageModelV2StreamPart> {
    const promptLower = userPrompt.toLowerCase();
    let componentType = "counter";
    let componentName = "Counter";

    if (promptLower.includes("form")) {
      componentType = "form";
      componentName = "ContactForm";
    } else if (promptLower.includes("card")) {
      componentType = "card";
      componentName = "Card";
    }

    yield { type: "stream-start", warnings: [] };

    // CHANGE: Emit all tool calls in a single step (multi-step broken in V2 compat mode)
    const intro = `This is a static response. Add an ANTHROPIC_API_KEY to .env for real generation. Creating a ${componentName} component now.`;
    yield { type: "text-start", id: "text-0" };
    for (const char of intro) {
      yield { type: "text-delta", id: "text-0", delta: char };
      await this.delay(10);
    }
    yield { type: "text-end", id: "text-0" };

    yield {
      type: "tool-call",
      toolCallId: "call_component",
      toolName: "str_replace_editor",
      input: JSON.stringify({
        command: "create",
        path: `/components/${componentName}.jsx`,
        file_text: this.getComponentCode(componentType),
      }),
    };

    yield {
      type: "tool-call",
      toolCallId: "call_app",
      toolName: "str_replace_editor",
      input: JSON.stringify({
        command: "create",
        path: "/App.jsx",
        file_text: this.getAppCode(componentName),
      }),
    };

    yield { type: "finish", finishReason: "tool-calls", usage: { inputTokens: 50, outputTokens: 80, totalTokens: 130 } };
  }

  private getComponentCode(componentType: string): string {
    switch (componentType) {
      case "form":
        return `import React, { useState } from 'react';

const ContactForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    // Handle form submission here
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Contact Us</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
            Message
          </label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            required
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors"
        >
          Send Message
        </button>
      </form>
    </div>
  );
};

export default ContactForm;`;

      case "card":
        return `import React from 'react';

const Card = ({ 
  title = "Welcome to Our Service", 
  description = "Discover amazing features and capabilities that will transform your experience.",
  imageUrl,
  actions 
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {imageUrl && (
        <img 
          src={imageUrl} 
          alt={title}
          className="w-full h-48 object-cover"
        />
      )}
      <div className="p-6">
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-gray-600 mb-4">{description}</p>
        {actions && (
          <div className="mt-4">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default Card;`;

      default:
        return `import { useState } from 'react';

const Counter = () => {
  const [count, setCount] = useState(0);

  const increment = () => {
    setCount(count + 1);
  };

  const decrement = () => {
    setCount(count - 1);
  };

  const reset = () => {
    setCount(0);
  };

  return (
    <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Counter</h2>
      <div className="text-4xl font-bold mb-6">{count}</div>
      <div className="flex gap-4">
        <button 
          onClick={decrement}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
        >
          Decrease
        </button>
        <button 
          onClick={reset}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
        >
          Reset
        </button>
        <button 
          onClick={increment}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
        >
          Increase
        </button>
      </div>
    </div>
  );
};

export default Counter;`;
    }
  }

  private getOldStringForReplace(componentType: string): string {
    switch (componentType) {
      case "form":
        return "    console.log('Form submitted:', formData);";
      case "card":
        return '      <div className="p-6">';
      default:
        return "  const increment = () => setCount(count + 1);";
    }
  }

  private getNewStringForReplace(componentType: string): string {
    switch (componentType) {
      case "form":
        return "    console.log('Form submitted:', formData);\n    alert('Thank you! We\\'ll get back to you soon.');";
      case "card":
        return '      <div className="p-6 hover:bg-gray-50 transition-colors">';
      default:
        return "  const increment = () => setCount(prev => prev + 1);";
    }
  }

  private getAppCode(componentName: string): string {
    if (componentName === "Card") {
      return `import Card from '@/components/Card';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <Card 
          title="Amazing Product"
          description="This is a fantastic product that will change your life. Experience the difference today!"
          actions={
            <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors">
              Learn More
            </button>
          }
        />
      </div>
    </div>
  );
}`;
    }

    return `import ${componentName} from '@/components/${componentName}';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <${componentName} />
      </div>
    </div>
  );
}`;
  }

  async doGenerate(
    options: LanguageModelV2CallOptions
  ): Promise<Awaited<ReturnType<LanguageModelV2["doGenerate"]>>> {
    const userPrompt = this.extractUserPrompt(options.prompt);
    const parts: LanguageModelV2StreamPart[] = [];
    for await (const part of this.generateMockStream(options.prompt, userPrompt)) {
      parts.push(part);
    }

    const textContent = parts
      .filter((p) => p.type === "text-delta")
      .map((p) => (p as any).delta)
      .join("");

    const toolCalls = parts
      .filter((p) => p.type === "tool-call")
      .map((p) => p as any);

    const finishPart = parts.find((p) => p.type === "finish") as any;

    return {
      content: [
        ...(textContent ? [{ type: "text" as const, text: textContent }] : []),
        ...toolCalls.map((tc: any) => ({
          type: "tool-call" as const,
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          input: tc.input,
        })),
      ],
      finishReason: finishPart?.finishReason ?? "stop",
      usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
      warnings: [],
    };
  }

  async doStream(
    options: LanguageModelV2CallOptions
  ): Promise<Awaited<ReturnType<LanguageModelV2["doStream"]>>> {
    const userPrompt = this.extractUserPrompt(options.prompt);
    const self = this;

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      async start(controller) {
        try {
          for await (const chunk of self.generateMockStream(options.prompt, userPrompt)) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return { stream };
  }
}

export function getLanguageModel() {
  const provider = process.env.AI_PROVIDER || "anthropic";
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // If a specific provider is chosen, use it
  if (provider === "openai" && openaiKey && openaiKey.trim() !== "") {
    console.log("Using OpenAI provider with model:", OPENAI_MODEL);
    return openai(OPENAI_MODEL);
  }

  if (provider === "anthropic" && anthropicKey && anthropicKey.trim() !== "") {
    console.log("Using Anthropic provider with model:", ANTHROPIC_MODEL);
    return anthropic(ANTHROPIC_MODEL);
  }

  // Fallback: try any available key
  if (anthropicKey && anthropicKey.trim() !== "") {
    console.log("Using Anthropic provider with model:", ANTHROPIC_MODEL);
    return anthropic(ANTHROPIC_MODEL);
  }

  if (openaiKey && openaiKey.trim() !== "") {
    console.log("Using OpenAI provider with model:", OPENAI_MODEL);
    return openai(OPENAI_MODEL);
  }

  // No API keys found, use mock provider
  console.log("No API keys found, using mock provider");
  return new MockLanguageModel("mock-claude-sonnet-4-0");
}

export function getProviderName(): "anthropic" | "openai" | "mock" {
  const provider = process.env.AI_PROVIDER || "anthropic";
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (provider === "openai" && openaiKey && openaiKey.trim() !== "") {
    return "openai";
  }

  if (provider === "anthropic" && anthropicKey && anthropicKey.trim() !== "") {
    return "anthropic";
  }

  if (anthropicKey && anthropicKey.trim() !== "") {
    return "anthropic";
  }

  if (openaiKey && openaiKey.trim() !== "") {
    return "openai";
  }

  return "mock";
}
