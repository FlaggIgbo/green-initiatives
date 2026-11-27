import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateRoundUpCents } from "../services/roundup.service";
import { hashPassword, verifyPassword, signSessionToken, verifySessionToken } from "../auth";
import { ESG_BASKETS } from "../services/alpaca.service";

describe("calculateRoundUpCents", () => {
  it("rounds posted debits up to the nearest dollar", () => {
    assert.equal(calculateRoundUpCents(435), 65);
    assert.equal(calculateRoundUpCents(2840), 60);
    assert.equal(calculateRoundUpCents(1), 99);
  });

  it("returns 0 for exact dollar amounts and non-positive values", () => {
    assert.equal(calculateRoundUpCents(500), 0);
    assert.equal(calculateRoundUpCents(0), 0);
    assert.equal(calculateRoundUpCents(-250), 0);
  });
});

describe("native crypto auth", () => {
  it("hashes and verifies passwords with scrypt", () => {
    const hash = hashPassword("s3cret-pass");
    assert.equal(verifyPassword("s3cret-pass", hash), true);
    assert.equal(verifyPassword("wrong-pass", hash), false);
  });

  it("signs and verifies HMAC session tokens", () => {
    const token = signSessionToken("user_123");
    assert.equal(verifySessionToken(token), "user_123");
    assert.equal(verifySessionToken(`${token}tampered`), null);
  });
});

describe("ESG baskets", () => {
  it("every basket's ETF weights sum to 1.0", () => {
    for (const basket of ESG_BASKETS) {
      const sum = basket.holdings.reduce((acc, h) => acc + h.weight, 0);
      assert.ok(Math.abs(sum - 1) < 1e-6, `Basket ${basket.id} weights sum to ${sum}`);
    }
  });
});
