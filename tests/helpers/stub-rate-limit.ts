/**
 * Test-only fake for the rate-limit boundary.
 *
 * Routes under test import "@/lib/rate-limit"; this resolver hook redirects
 * that specifier here. The real limiter keeps state in a module-level Map,
 * which is exactly what we need — but tests also need a way to reset it
 * between cases, so this stub re-exports the real functions and adds a
 * __reset that reaches into the live module's map through its own
 * __resetRateLimit export.
 *
 * Nothing about the limiter's behaviour is faked: real limits, real windows.
 */
export {
  rateLimit,
  clientKey,
  __resetRateLimit as __reset,
} from "../../src/lib/rate-limit.ts";
