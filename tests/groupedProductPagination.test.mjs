import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeGroupedSections,
  planGroupedProductPage,
} from "../utils/groupedProductPagination.js";

const entries = (counts) =>
  counts.map((productCount, index) => ({
    key: `section-${index}`,
    productCount,
  }));

test("small sections share one product budget", () => {
  const page = planGroupedProductPage(entries([6, 5, 30]), {
    productLimit: 20,
    sectionLimit: 6,
  });

  assert.deepEqual(
    page.plans.map(({ sectionIndex, skip, take }) => ({
      sectionIndex,
      skip,
      take,
    })),
    [
      { sectionIndex: 0, skip: 0, take: 6 },
      { sectionIndex: 1, skip: 0, take: 5 },
      { sectionIndex: 2, skip: 0, take: 9 },
    ],
  );
  assert.equal(page.nextOffset, 2);
  assert.equal(page.nextProductOffset, 9);
  assert.equal(page.hasMore, true);
});

test("a large section continues without skipping or repeating products", () => {
  const list = entries([92]);
  const first = planGroupedProductPage(list, { productLimit: 20 });
  const second = planGroupedProductPage(list, {
    sectionOffset: first.nextOffset,
    productOffset: first.nextProductOffset,
    productLimit: 20,
  });
  const last = planGroupedProductPage(list, {
    sectionOffset: 0,
    productOffset: 80,
    productLimit: 20,
  });

  assert.deepEqual(
    first.plans.map(({ skip, take }) => ({ skip, take })),
    [{ skip: 0, take: 20 }],
  );
  assert.deepEqual(
    second.plans.map(({ skip, take }) => ({ skip, take })),
    [{ skip: 20, take: 20 }],
  );
  assert.deepEqual(
    last.plans.map(({ skip, take }) => ({ skip, take })),
    [{ skip: 80, take: 12 }],
  );
  assert.equal(last.nextOffset, 1);
  assert.equal(last.nextProductOffset, 0);
  assert.equal(last.hasMore, false);
});

test("section limit remains a safety bound for many tiny sections", () => {
  const page = planGroupedProductPage(entries(Array(10).fill(1)), {
    productLimit: 20,
    sectionLimit: 6,
  });

  assert.equal(page.plans.length, 6);
  assert.equal(page.nextOffset, 6);
  assert.equal(page.nextProductOffset, 0);
  assert.equal(page.hasMore, true);
});

test("chunks merge into their section and duplicate products are discarded", () => {
  const current = [
    { key: "large", title: "Large", products: [{ _id: "p1" }, { _id: "p2" }] },
  ];
  const incoming = [
    { key: "large", title: "Large", products: [{ _id: "p2" }, { _id: "p3" }] },
    { key: "next", title: "Next", products: [{ _id: "p3" }, { _id: "p4" }] },
  ];

  const merged = mergeGroupedSections(current, incoming);

  assert.equal(merged.length, 2);
  assert.deepEqual(merged[0].products.map((product) => product._id), ["p1", "p2", "p3"]);
  assert.deepEqual(merged[1].products.map((product) => product._id), ["p4"]);
  assert.deepEqual(current[0].products.map((product) => product._id), ["p1", "p2"]);
});

test("invalid cursors are safely normalized", () => {
  const page = planGroupedProductPage(entries([2]), {
    sectionOffset: -10,
    productOffset: -5,
    productLimit: 0,
  });

  assert.equal(page.plans[0].skip, 0);
  assert.equal(page.plans[0].take, 2);
  assert.equal(page.hasMore, false);
});
