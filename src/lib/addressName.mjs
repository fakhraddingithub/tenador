export function joinAddressName(firstName, lastName) {
  return [firstName, lastName].map((part) => part.trim()).filter(Boolean).join(" ");
}

export function splitAddressName(fullName = "") {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts.slice(0, -1).join(" ") || parts[0] || "",
    lastName: parts.length > 1 ? parts.at(-1) : "",
  };
}
