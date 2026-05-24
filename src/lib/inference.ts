// Typed inference operations (embed + generate + models + config).
// Requires the bridge's `embed` cargo feature (local llama.cpp inference).
// Wire shapes from output.rs:
//   Embed       -> { Embedding: number[] }
//   Generate    -> { Generated: { text, stop_reason, prompt_tokens, completion_tokens } }
//   ModelsList/ModelsLocal -> { ModelsList: [{ name, task, architecture, default_quant }] }
//   EmbedStatus -> { EmbedStatus: { auto_embed, batch_size, pending, total_queued } }
//   ConfigGet   -> { Config: {...} }   ConfigureGetKey -> { ConfigValue: string | null }

import { execute } from "./strata";
import type { Handle } from "./strata";

export interface ModelInfo {
  name: string;
  task: string; // "Embed" | "Generate" | "Rank"  (capitalized on the wire)
  architecture: string;
  default_quant: string;
  embedding_dim: number; // 0 for generation/rank models
  is_local: boolean;
  size_bytes: number;
}

export interface GenerationResult {
  text: string;
  stop_reason: string;
  prompt_tokens: number;
  completion_tokens: number;
}

export interface EmbedStatusInfo {
  auto_embed: boolean;
  batch_size: number;
  pending: number;
  total_queued: number;
  total_embedded: number;
  total_failed: number;
}

export interface GenerateOptions {
  model: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  seed?: number;
}

function rec(o: unknown): Record<string, unknown> {
  return o !== null && typeof o === "object" ? (o as Record<string, unknown>) : {};
}

export async function modelsList(handle: Handle): Promise<ModelInfo[]> {
  const out = rec(await execute(handle, { ModelsList: null }));
  return Array.isArray(out.ModelsList) ? (out.ModelsList as ModelInfo[]) : [];
}

export async function modelsLocal(handle: Handle): Promise<ModelInfo[]> {
  const out = rec(await execute(handle, { ModelsLocal: null }));
  return Array.isArray(out.ModelsList) ? (out.ModelsList as ModelInfo[]) : [];
}

export async function modelsPull(handle: Handle, name: string): Promise<string> {
  const out = rec(await execute(handle, { ModelsPull: { name } }));
  return JSON.stringify(out.ModelsPulled ?? out);
}

export async function embedStatus(handle: Handle): Promise<EmbedStatusInfo | null> {
  const out = rec(await execute(handle, { EmbedStatus: null }));
  return (out.EmbedStatus as EmbedStatusInfo) ?? null;
}

export async function setAutoEmbed(handle: Handle, enabled: boolean): Promise<void> {
  await execute(handle, { ConfigSetAutoEmbed: { enabled } });
}

export async function reindexEmbeddings(handle: Handle, branch?: string): Promise<string> {
  const args: Record<string, unknown> = {};
  if (branch) args.branch = branch;
  const out = rec(await execute(handle, { ReindexEmbeddings: args }));
  return JSON.stringify(out.ReindexResult ?? out);
}

export async function embed(handle: Handle, text: string): Promise<number[]> {
  const out = rec(await execute(handle, { Embed: { text } }));
  return Array.isArray(out.Embedding) ? (out.Embedding as number[]) : [];
}

export async function generate(handle: Handle, opts: GenerateOptions): Promise<GenerationResult> {
  const args: Record<string, unknown> = { model: opts.model, prompt: opts.prompt };
  if (opts.maxTokens != null) args.max_tokens = opts.maxTokens;
  if (opts.temperature != null) args.temperature = opts.temperature;
  if (opts.topP != null) args.top_p = opts.topP;
  if (opts.topK != null) args.top_k = opts.topK;
  if (opts.seed != null) args.seed = opts.seed;
  const out = rec(await execute(handle, { Generate: args }));
  return rec(out.Generated) as unknown as GenerationResult;
}

export async function configGet(handle: Handle): Promise<Record<string, unknown>> {
  const out = rec(await execute(handle, { ConfigGet: null }));
  return rec(out.Config);
}

export async function configSet(handle: Handle, key: string, value: string): Promise<void> {
  await execute(handle, { ConfigureSet: { key, value } });
}

export async function configGetKey(handle: Handle, key: string): Promise<string | null> {
  const out = rec(await execute(handle, { ConfigureGetKey: { key } }));
  return typeof out.ConfigValue === "string" ? out.ConfigValue : null;
}
