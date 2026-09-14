import { auth } from "@clerk/nextjs/server";
import {
  caseMemoryUserId,
  createMemoryClient,
  listMemories,
  officerMemoryUserId,
  searchMemories,
  type MemoryRecord,
} from "../../../../lib/memory";

export async function GET(request: Request) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return new Response("unauthorized", { status: 401 });

  const url = new URL(request.url);
  const caseId = url.searchParams.get("caseId");
  const query = (url.searchParams.get("q") ?? "").trim();
  if (!caseId) return new Response("invalid request", { status: 400 });

  const client = createMemoryClient();
  if (!client) return Response.json({ memories: [], all: { case: [], officer: [] }, enabled: false });

  try {
    const [caseAll, officerAll] = await Promise.all([
      listMemories(client, caseMemoryUserId(caseId)),
      listMemories(client, officerMemoryUserId(userId)),
    ]);
    let relevant: MemoryRecord[] = [];
    if (query) {
      const [caseHits, officerHits] = await Promise.all([
        searchMemories(client, query, caseMemoryUserId(caseId), 3).catch(() => []),
        searchMemories(client, query, officerMemoryUserId(userId), 3).catch(() => []),
      ]);
      relevant = [...caseHits, ...officerHits].slice(0, 3);
    }
    return Response.json({ memories: relevant, all: { case: caseAll, officer: officerAll }, enabled: true });
  } catch (error) {
    console.error("Failed to list memories", error);
    return new Response("memory unavailable", { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) return new Response("unauthorized", { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const memoryId = body && typeof body === "object" ? (body as Record<string, unknown>).memoryId : null;
  if (typeof memoryId !== "string" || !memoryId) return new Response("invalid request", { status: 400 });

  const client = createMemoryClient();
  if (!client) return new Response("memory unavailable", { status: 503 });

  try {
    await client.delete(memoryId);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete memory", error);
    return new Response("memory unavailable", { status: 502 });
  }
}
