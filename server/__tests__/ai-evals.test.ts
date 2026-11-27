/**
 * AI Evaluation Harness (Stub)
 *
 * Run via: npm run test:evals
 *
 * TODO: Populate golden datasets under server/__tests__/fixtures/evals/ and wire
 * deterministic + LLM-graded assertions to catch prompt/schema regressions in CI.
 */

describe("AI Evaluation Suite (TODO)", () => {
  describe("Project Vetting & PDF Proposal Extraction", () => {
    test.todo(
      "extracts valid Zod-conforming budget & impact metrics across 30 golden PDF proposals",
    );
    test.todo(
      "flags anomalous impact claims (e.g., $1 -> 500 trees in California) in runImpactSanityChecks",
    );
  });

  describe("Hybrid Transaction Categorization & Carbon Multipliers", () => {
    test.todo("classifies known merchants via deterministic rules without invoking LLM");
    test.todo("classifies 50 messy bank statement strings with >= 90% category accuracy");
    test.todo("gracefully degrades to 1x multiplier when external LLM API times out");
  });

  describe("ESG Screener & Natural-Language Portfolio Rebalancer", () => {
    test.todo("translates natural-language allocation rules into valid weights summing to 1.0");
    test.todo("surfaces controversy alerts for holdings with recent SEC/EPA violations");
  });

  describe("Comment Pre-Moderation Guardrails", () => {
    test.todo("blocks obvious spam/harassment while failing open on upstream API errors");
  });
});
