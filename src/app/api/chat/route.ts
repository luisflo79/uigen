import type { FileNode } from "@/lib/file-system";
import { VirtualFileSystem } from "@/lib/file-system";
import { streamText, convertToModelMessages } from "ai";
import { buildStrReplaceTool } from "@/lib/tools/str-replace";
import { buildFileManagerTool } from "@/lib/tools/file-manager";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getLanguageModel, getProviderName } from "@/lib/provider";
import { generationPrompt } from "@/lib/prompts/generation";

export async function POST(req: Request) {
  const {
    messages: uiMessages,
    files,
    projectId,
  }: { messages: any[]; files: Record<string, FileNode>; projectId?: string } =
    await req.json();

  const providerName = getProviderName();

  // Reconstruct the VirtualFileSystem from serialized data
  const fileSystem = new VirtualFileSystem();
  fileSystem.deserializeFromNodes(files);

  const tools = {
    str_replace_editor: buildStrReplaceTool(fileSystem),
    file_manager: buildFileManagerTool(fileSystem),
  };

  // CHANGE: AI SDK 6 requires converting UIMessages to ModelMessages
  const modelMessages = await convertToModelMessages(uiMessages, { tools });

  const model = getLanguageModel();
  // CHANGE: mock emits all tool calls in one step — maxSteps=1 avoids broken V2 compat multi-step
  const isMockProvider = providerName === "mock";

  // CHANGE: system prompt passed as `system` param; Anthropic cache via providerOptions
  const providerOptions = providerName === "anthropic"
    ? { anthropic: { cacheControl: { type: "ephemeral" } } }
    : undefined;

  const result = streamText({
    model: model as any,
    system: generationPrompt,
    ...(providerOptions && { providerOptions }),
    messages: modelMessages,
    maxTokens: 10_000,
    maxSteps: isMockProvider ? 2 : 40,
    onError: (err: any) => {
      console.error(err);
    },
    tools,
    onFinish: async ({ response }) => {
      if (projectId) {
        try {
          const session = await getSession();
          if (!session) {
            console.error("User not authenticated, cannot save project");
            return;
          }

          const responseMessages = response.messages || [];
          const allMessages = [...uiMessages, ...responseMessages];

          await prisma.project.update({
            where: { id: projectId, userId: session.userId },
            data: {
              messages: JSON.stringify(allMessages),
              data: JSON.stringify(fileSystem.serialize()),
            },
          });
        } catch (error) {
          console.error("Failed to save project data:", error);
        }
      }
    },
  });

  // CHANGE: AI SDK 6 uses toUIMessageStreamResponse instead of toDataStreamResponse
  return result.toUIMessageStreamResponse();
}

export const maxDuration = 120;
