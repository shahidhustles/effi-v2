// convex-test modules are enumerated with Vite's import.meta.glob; vitest
// transforms it at runtime, so the backend typecheck only needs the call shape.
interface ImportMetaGlob {
  (pattern: string): Record<string, () => Promise<unknown>>;
}
interface ImportMeta {
  glob: ImportMetaGlob;
}
