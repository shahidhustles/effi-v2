# Effi SLA embedding model selection

## Recommendation

Use `alibaba/qwen3-embedding-8b` through Vercel AI Gateway. Store its default 4,096-float output in a Convex vector index declared with `dimensions: 4096`.

This is the strongest fit in the available list for an English policy manual queried in English, Hindi, or Hinglish. Qwen says the model supports more than 100 languages, multilingual and cross-lingual retrieval, task instructions, and dimensions from 32 through 4,096. It ranked first on the MTEB multilingual leaderboard at release. Vercel exposes it through the AI SDK with `embed()`, lists a 33K to 41K provider context window, and currently prices it from $0.01 per million input tokens. [Qwen model card](https://huggingface.co/Qwen/Qwen3-Embedding-8B) [Vercel model page](https://vercel.com/ai-gateway/models/qwen3-embedding-8b)

The index contract is intentionally fixed:

```ts
const SLA_EMBEDDING_MODEL = "alibaba/qwen3-embedding-8b";
const SLA_EMBEDDING_DIMENSIONS = 4096;
```

Use the same model and dimension for ingestion and search. Convex requires every search vector to match the index's declared size, supports dimensions from 2 through 4,096, and uses cosine similarity. A model or dimension change therefore requires a new index or a full re-embed. [Convex vector search](https://docs.convex.dev/search/vector-search) [Convex limits](https://docs.convex.dev/production/state/limits)

For queries, prepend one stable English instruction, for example: `Retrieve the municipal SLA or operating procedure that best answers this query.` Keep document text unprefixed. Qwen recommends task-specific query instructions and says English instructions work best in multilingual use. [Qwen model card](https://huggingface.co/Qwen/Qwen3-Embedding-8B)

Before locking it in, run a small retrieval check containing English, Devanagari Hindi, and Romanized Hinglish questions. Public multilingual benchmarks are useful evidence, but they do not specifically measure this query mix or municipal language.

## Fallback

Use `voyage/voyage-3.5` at its default 1,024 dimensions, with `input_type="document"` during ingestion and `input_type="query"` during retrieval. Voyage documents the model as general-purpose and multilingual, with a 32K context window and 256, 512, 1,024, or 2,048 dimensions. Vercel lists it at $0.06 per million input tokens and supports it through `embed()`. [Voyage embedding docs](https://docs.voyageai.com/docs/embeddings) [Voyage retrieval guidance](https://docs.voyageai.com/docs/faq) [Vercel model page](https://vercel.com/ai-gateway/models/voyage-3.5)

This fallback has a cleaner asymmetric retrieval contract than Qwen because the provider applies explicit query and document modes. It also leaves more headroom under Convex's dimension limit. Choose it if the Effi-specific test set shows unstable Hindi or Hinglish retrieval with Qwen, or if the 4,096-float index is unnecessarily large.

## Why the other available embedding models are not the first pick

| Model family | Assessment for Effi |
| --- | --- |
| `alibaba/qwen3-embedding-4b` | A sensible cheaper and smaller sibling, but its default 2,560-dimensional output gives up the 8B model's published multilingual retrieval lead while not improving the listed minimum price. It supports more than 100 languages, instructions, and configurable dimensions. [Qwen 4B model card](https://huggingface.co/Qwen/Qwen3-Embedding-4B) [Vercel model page](https://vercel.com/ai-gateway/models/qwen3-embedding-4b) |
| `voyage/voyage-3.5-lite` | Strong budget fallback at $0.02 per million tokens and the same 32K, multilingual, query/document-aware design as Voyage 3.5. For this small corpus, the absolute embedding bill is trivial, so prefer the higher-quality model unless latency testing favors Lite. [Voyage docs](https://docs.voyageai.com/docs/embeddings) [Vercel provider page](https://vercel.com/ai-gateway/models/voyage-3.5-lite/providers) |
| `google/gemini-embedding-001` | Strong multilingual option with retrieval-specific task types and configurable output size. Google recommends 768, 1,536, or 3,072 dimensions, all within Convex's current 4,096-dimension limit. It costs more on the supplied Gateway list and has a 2,048-token input limit, which offers no advantage for page chunks. [Google embeddings guide](https://ai.google.dev/gemini-api/docs/embeddings) [Google model reference](https://ai.google.dev/gemini-api/docs/models/gemini-embedding-001) [Vercel model page](https://vercel.com/ai-gateway/models/gemini-embedding-001) |
| `cohere/embed-v4.0` | Multilingual, query/document-aware, and configurable to 256, 512, 1,024, or 1,536 dimensions. Its 128K context and multimodal input are wasted on extracted page text, while its listed $0.12 per million price is higher. [Cohere model docs](https://docs.cohere.com/docs/cohere-embed) [Cohere API reference](https://docs.cohere.com/v2/reference/embed) [Vercel provider page](https://vercel.com/ai-gateway/models/embed-v4.0/providers) |
| `google/text-embedding-005`, `google/text-multilingual-embedding-002` | Both produce up to 768 dimensions and accept 2,048 tokens. Google states that `gemini-embedding-001` unifies these specialized models and performs better in their respective English/code and multilingual domains. [Vertex AI embedding docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings) |
| `amazon/titan-embed-text-v2` | Low-cost and configurable to 256, 512, or 1,024 dimensions, but AWS calls it English-optimized and warns that cross-language queries can be suboptimal. That warning matters for English documents searched with Hindi or Hinglish. [AWS model docs](https://docs.aws.amazon.com/bedrock/latest/userguide/titan-embedding-models.html) |
| `mistral/mistral-embed` | A stable 1,024-dimensional, 8K general text model, but the official material does not establish a Hindi or cross-lingual advantage over Qwen, Voyage, Gemini, or Cohere. [Mistral model page](https://docs.mistral.ai/models/mistral-embed-23-12) [Mistral dimensions](https://docs.mistral.ai/resources/cookbooks/mistral-embeddings-embeddings) |
| `mistral/codestral-embed`, `voyage/voyage-code-2`, `voyage/voyage-code-3` | Built for code retrieval, not civic policy prose. [Mistral embedding overview](https://docs.mistral.ai/studio/knowledge-rag/embeddings) [Voyage model table](https://docs.voyageai.com/docs/embeddings) |
| `voyage/voyage-law-2`, `voyage/voyage-finance-2`, `voyage/voyage-3-large` | Law and finance models are domain-specific; municipal operating procedures are broader than either. Voyage now directs general retrieval toward newer models, and its docs identify the 3.5 line as the current general-purpose choice among the models listed here. [Voyage model table](https://docs.voyageai.com/docs/embeddings) |

`voyage/rerank-2.5`, `voyage/rerank-2.5-lite`, and `cohere/rerank-v3.5` are rerankers, not embedding models. They cannot populate the Convex index.

## Reranking decision

Do not add reranking to the first hackathon build. Retrieve a small candidate set directly from Convex, return the top four passages, and measure failures on the Effi test questions first. The corpus will be small and page-level, so a second model call adds latency and another failure point before there is evidence that nearest-neighbor ordering is the problem.

If the test set shows that the right page often appears in positions 5 through 12 but not the top four, add `voyage/rerank-2.5-lite`: retrieve 12 candidates from Convex, rerank them, then return four. It is multilingual, has a 32K context window, accepts candidates from any first-stage retriever, costs $0.02 per million input tokens on Gateway, and works with the AI SDK `rerank()` API. [Vercel reranker page](https://vercel.com/ai-gateway/models/rerank-2.5-lite) [AI SDK reranking](https://ai-sdk.dev/docs/ai-sdk-core/reranking)

## AI Gateway compatibility

Vercel documents embedding calls through `embed()` and `embedMany()` using plain `creator/model` strings, and identifies AI Gateway as the default provider for those strings. This covers both the recommended and fallback models without direct provider credentials. [Vercel models and providers](https://vercel.com/docs/ai-gateway/models-and-providers) [AI SDK embeddings](https://ai-sdk.dev/docs/ai-sdk-core/embeddings)
