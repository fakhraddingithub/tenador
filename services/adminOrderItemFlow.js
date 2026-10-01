import "base/models/registerModels";
import mongoose from "mongoose";
import Product from "base/models/Product";
import Variant from "base/models/Variant";
import OrderFlow from "base/models/OrderFlow";
import { buildStepSequence } from "@/lib/flowTraversal";
import { resolveVisibleSteps, selectionsToMap } from "@/lib/flowConditions";
import { resolveServiceSelection } from "@/lib/serviceConfig";

function invalid(message) {
  throw Object.assign(new Error(message), { status: 400 });
}

// Validate before pricing: the price engine enriches selections but does not
// enforce category membership or required product/variant choices itself.
export async function validateAdminItemFlow(product, selections = []) {
  if (!Array.isArray(selections)) invalid("انتخاب‌های فرایند سفارش نامعتبر است");
  const flow = product.category
    ? await OrderFlow.findOne({ rootCategory: product.category, isActive: true }).lean()
    : null;
  const steps = buildStepSequence(flow);
  const nodes = new Map(steps.map((node) => [node.id, node]));
  const seen = new Set();
  for (const selection of selections) {
    const node = nodes.get(selection?.nodeId);
    if (!node || node.type !== selection.nodeType || seen.has(node.id)) {
      invalid("مراحل فرایند تغییر کرده یا انتخاب‌ها نامعتبر است؛ محصول را دوباره انتخاب کنید");
    }
    seen.add(node.id);
  }

  const selected = selectionsToMap(selections);
  const { visibleNodes } = resolveVisibleSteps(steps, selected);
  const kept = [];
  for (const node of visibleNodes) {
    const selection = selected[node.id];
    if (!selection && !node.required) continue;
    if (node.type === "service") {
      const input = selection || { nodeId: node.id, nodeType: "service", serviceConfig: [] };
      const resolved = resolveServiceSelection(node, input);
      if (resolved.errors.length) invalid(resolved.errors.join(" "));
      kept.push(input);
      continue;
    }
    if (!selection?.selectedProductId || !mongoose.isValidObjectId(selection.selectedProductId)) {
      invalid(`لطفاً محصول مرحله «${node.label}» را انتخاب کنید`);
    }
    if (selection.selectedVariantId && !mongoose.isValidObjectId(selection.selectedVariantId)) {
      invalid(`واریانت مرحله «${node.label}» نامعتبر است`);
    }
    kept.push(selection);
  }

  const categorySelections = kept.filter((selection) => selection.nodeType === "category");
  if (!categorySelections.length) return kept;
  const productIds = [...new Set(categorySelections.map((selection) => selection.selectedProductId))];
  const [products, variants] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).select("_id category name").lean(),
    Variant.find({ productId: { $in: productIds } }).select("_id productId attributes").lean(),
  ]);
  for (const selection of categorySelections) {
    const node = nodes.get(selection.nodeId);
    const chosen = products.find((item) => String(item._id) === selection.selectedProductId);
    if (!chosen || String(chosen.category) !== String(node.categoryId)) {
      invalid(`محصول انتخاب‌شده متعلق به دسته‌بندی مرحله «${node.label}» نیست`);
    }
    const choices = variants.filter((variant) => String(variant.productId) === selection.selectedProductId);
    const variant = choices.find((item) => String(item._id) === selection.selectedVariantId);
    if (selection.selectedVariantId && !variant) invalid(`واریانت مرحله «${node.label}» متعلق به محصول انتخاب‌شده نیست`);
    if (node.allowVariantSelection !== false && choices.length && !variant) {
      invalid(`لطفاً واریانت مرحله «${node.label}» را انتخاب کنید`);
    }
    // Persist labels from the catalog, never client-supplied display text.
    selection.selectedVariantLabel = variant
      ? Object.entries(variant.attributes || {}).map(([key, value]) => `${key}: ${value}`).join(" | ")
      : null;
  }
  return kept;
}

// Input must be the enriched output of computeCartPrice, never request data.
export function mapAdminFlowSelection(sel) {
  const common = { nodeId: sel.nodeId, nodeType: sel.nodeType, nodeLabel: sel.nodeLabel || "", addonToman: Number(sel.addonToman) || 0 };
  if (sel.nodeType === "service") {
    const config = sel.serviceConfig || [];
    return {
      ...common, serviceName: sel.serviceName || "", serviceConfig: config,
      serviceLabel: config.map((option) => `${option.title}: ${option.label}`).join("، ") || sel.serviceName || sel.nodeLabel || "",
      serviceValue: "",
    };
  }
  return {
    ...common, selectedProduct: sel.selectedProductId || null,
    selectedVariant: sel.selectedVariantId || null,
    selectedProductName: sel.selectedProductName || "", selectedVariantLabel: sel.selectedVariantLabel || null,
  };
}
