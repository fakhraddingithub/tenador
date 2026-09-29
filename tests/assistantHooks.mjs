import { resolve as resolveAlias } from './aliasHooks.mjs';

// The legacy global registry includes CommonJS-only Athlete.js. Tests register
// only the real models exercised here, without changing the production registry.
export async function resolve(specifier, context, next) {
  if (specifier === 'base/models/registerModels') return { url: 'data:text/javascript,export%20%7B%7D', shortCircuit: true };
  return resolveAlias(specifier, context, next);
}
