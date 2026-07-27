import test from "node:test";
import assert from "node:assert/strict";
import { joinAddressName, splitAddressName } from "../src/lib/addressName.mjs";

test("joins new address name fields and splits an existing full name", () => {
  assert.equal(joinAddressName("علی", "رضایی"), "علی رضایی");
  assert.deepEqual(splitAddressName("سید محمد حسینی"), {
    firstName: "سید محمد",
    lastName: "حسینی",
  });
});
