export function getUserFullName(user, fallback = "") {
  const name = typeof user?.name === "string" ? user.name.trim() : "";
  const lastName = typeof user?.lastName === "string" ? user.lastName.trim() : "";
  return [name, lastName].filter(Boolean).join(" ") || fallback;
}
export function splitFullName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  return {
    name: parts.shift() || "",
    lastName: parts.join(" "),
  };
}