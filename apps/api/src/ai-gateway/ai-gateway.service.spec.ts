import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiGatewayService } from "./ai-gateway.service";

const vector = Array<number>(1536).fill(0.25);

describe("AiGatewayService", () => {
  let service: AiGatewayService;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    service = new AiGatewayService(new ConfigService({ AI_SERVICE_URL: "http://ai:8000/" }));
    fetchMock = jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => jest.restoreAllMocks());

  function respond(body: unknown) {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
    }));
  }

  it("accepts a complete embedding batch", async () => {
    const result = { embeddings: [vector], model: "embedding-model", dimensions: 1536 };
    respond(result);
    await expect(service.embedTexts(["text"])).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith("http://ai:8000/embed", expect.objectContaining({
      method: "POST", body: JSON.stringify({ texts: ["text"] }),
    }));
  });

  it.each([
    { embeddings: [], model: "model", dimensions: 1536 },
    { embeddings: [vector, vector], model: "model", dimensions: 1536 },
    { embeddings: [[1, 2]], model: "model", dimensions: 1536 },
    { embeddings: [vector], model: "model", dimensions: 3 },
    { embeddings: [[...vector.slice(1), "invalid"]], model: "model", dimensions: 1536 },
  ])("rejects malformed or mismatched embedding batches: %j", async (result) => {
    respond(result);
    await expect(service.embedTexts(["text"])).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("maps provider status from the AI service wire format", async () => {
    respond({ llm_provider: "llm", embedding_provider: "embedding", providers: [] });
    await expect(service.status()).resolves.toEqual({
      llmProvider: "llm", embeddingProvider: "embedding", providers: [],
    });
    expect(fetchMock).toHaveBeenCalledWith("http://ai:8000/gateway", expect.objectContaining({ method: "GET", body: undefined }));
  });

  it("maps generation results", async () => {
    respond({ text: "answer", model: "llm", model_version: "v1", usage: { total_tokens: 10 } });
    await expect(service.generate({ prompt: "question" })).resolves.toEqual({
      text: "answer", model: "llm", modelVersion: "v1", usage: { total_tokens: 10 },
    });
  });

  it("rejects invalid generation payloads", async () => {
    respond({ text: null, model: "llm", model_version: "v1", usage: {} });
    await expect(service.generate({ prompt: "question" })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("normalizes invalid JSON to a service unavailable error", async () => {
    fetchMock.mockResolvedValue(new Response("not JSON"));
    await expect(service.status()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("normalizes network failures", async () => {
    fetchMock.mockRejectedValue(new Error("connection refused"));
    await expect(service.status()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("rejects unsuccessful upstream responses", async () => {
    fetchMock.mockResolvedValue(new Response("unavailable", { status: 503 }));
    await expect(service.status()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
