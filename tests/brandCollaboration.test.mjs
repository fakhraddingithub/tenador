import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCollaborationScopes,
  collaborationMatchBranches,
} from "../utils/brandCollaboration.js";

const WILSON = "6978c71a397005db92073c8e";
const TECNIFIBRE = "6996f99b7d781d57bb19192b";
const ROLLAND_GARROS = "6a7743a30ebacfdc7380dac1";
const RG_EDITION = "6a3190c0ef504868382f901c";

const identity = (value) => value;

test("a collaboration is scoped to the edition's owner brand", () => {
  const scopes = buildCollaborationScopes(
    [{ _id: RG_EDITION, brand: { _id: WILSON } }],
    ROLLAND_GARROS,
  );

  assert.deepEqual(scopes, [
    { editionId: RG_EDITION, ownerBrandId: WILSON },
  ]);
  assert.deepEqual(collaborationMatchBranches(scopes, identity), [
    { brand: WILSON, limitedEdition: RG_EDITION },
  ]);
});

test("a legacy cross-brand tag cannot reach the guest brand page", () => {
  // Regression: models/Collaboration.js was global, so Tecnifibre bags still
  // carry Wilson's Roland Garros edition. Matching on "any brand but the guest"
  // surfaced them under «ویلسون × رولان گاروس» on the Rolland Garros page.
  const branches = collaborationMatchBranches(
    buildCollaborationScopes(
      [{ _id: RG_EDITION, brand: WILSON }],
      ROLLAND_GARROS,
    ),
    identity,
  );

  const tecnifibreBag = { brand: TECNIFIBRE, limitedEdition: RG_EDITION };
  const matches = branches.some((branch) =>
    Object.entries(branch).every(([key, value]) => tecnifibreBag[key] === value),
  );

  assert.equal(matches, false);
});

test("an edition owned by the guest brand itself is not a collaboration", () => {
  assert.deepEqual(
    buildCollaborationScopes(
      [{ _id: RG_EDITION, brand: { _id: ROLLAND_GARROS } }],
      ROLLAND_GARROS,
    ),
    [],
  );
});

test("editions without an owner brand and duplicates are dropped", () => {
  assert.deepEqual(
    buildCollaborationScopes(
      [
        { _id: RG_EDITION, brand: null },
        { _id: RG_EDITION, brand: WILSON },
        { _id: RG_EDITION, brand: WILSON },
        { _id: null, brand: WILSON },
      ],
      ROLLAND_GARROS,
    ),
    [{ editionId: RG_EDITION, ownerBrandId: WILSON }],
  );
});

test("each edition keeps its own branch so owners never cross-match", () => {
  const OTHER_EDITION = "6a3190c0ef504868382f9021";
  const branches = collaborationMatchBranches(
    buildCollaborationScopes(
      [
        { _id: RG_EDITION, brand: WILSON },
        { _id: OTHER_EDITION, brand: TECNIFIBRE },
      ],
      ROLLAND_GARROS,
    ),
    identity,
  );

  assert.deepEqual(branches, [
    { brand: WILSON, limitedEdition: RG_EDITION },
    { brand: TECNIFIBRE, limitedEdition: OTHER_EDITION },
  ]);
});

test("unconvertible ids are dropped instead of producing a null-brand branch", () => {
  const branches = collaborationMatchBranches(
    [{ editionId: "not-an-id", ownerBrandId: WILSON }],
    (value) => (value === "not-an-id" ? null : value),
  );

  assert.deepEqual(branches, []);
});
