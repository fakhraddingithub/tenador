"use client";

import { createContext, useContext } from "react";
import { fa, compactToman, axisShort } from "./format";

export const AnalyticsCurrencyContext = createContext("IRT");
const euroNumber = (n) => Number(n ?? 0).toLocaleString("fa-IR", { maximumFractionDigits: 2 });
const euroAxis = (n) => Number(n ?? 0).toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 2 });
const toman = { fa, compactToman, axisShort, unit: "تومان", isEuro: false };
const euro = { fa: euroNumber, compactToman: euroNumber, axisShort: euroAxis, unit: "یورو", isEuro: true };

export function useAnalyticsCurrency() {
  return useContext(AnalyticsCurrencyContext) === "EUR" ? euro : toman;
}
