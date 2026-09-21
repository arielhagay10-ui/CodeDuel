/**
 * `next` ships no `exports` map, so ESM cannot resolve the bare `next/server`
 * specifier that `proxy.ts` uses, while CommonJS resolution finds `server.js`
 * fine. This hook lets the proxy under test keep its production import untouched.
 */
import { createRequire, registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

// Resolved eagerly: registerHooks intercepts `require` too, so doing this inside
// the hook would make it re-enter itself.
const nextServer = pathToFileURL(createRequire(import.meta.url).resolve("next/server")).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") return { url: nextServer, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
