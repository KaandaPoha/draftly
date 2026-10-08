/**
 * Registers the test-only TypeScript resolve hook.
 * Used via: node --experimental-transform-types --import ./tests/register.mjs
 */
import { register } from "node:module";

register("./ts-resolve.mjs", import.meta.url);