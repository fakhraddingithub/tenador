import test from "node:test";
import assert from "node:assert/strict";
import User from "../models/User.js";

// Exercise real async validation middleware without connecting to a database.
test("phone registration passes User validation", async () => {
  const user = new User({
    provider: "local",
    phone: "09123456789",
    password: "hashed-password",
    name: "Test",
    lastName: "User",
  });
  await user.validate();
  assert.equal(user.role, "user");
});

test("Google registration passes User validation without a password", async () => {
  const user = new User({
    provider: "google",
    googleId: "google-test-subject",
    email: "test@example.com",
  });
  await user.validate();
  assert.equal(user.role, "user");
});

test("existing seller accounts normalize to store before enum validation", async () => {
  const user = User.hydrate({
    provider: "local",
    password: "hashed-password",
    role: "seller",
  });
  await user.validate();
  assert.equal(user.role, "store");
});

test("provider requirements and invalid roles still fail validation", async () => {
  for (const [data, field] of [
    [{ provider: "local" }, "password"],
    [{ provider: "google" }, "googleId"],
    [{ provider: "local", password: "hash", role: "invalid" }, "role"],
  ]) {
    await assert.rejects(new User(data).validate(), (error) => {
      assert.equal(error.name, "ValidationError");
      assert.ok(error.errors[field]);
      return true;
    });
  }
});
