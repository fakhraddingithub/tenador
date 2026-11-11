// The installed ImageKit SDK has no per-request timeout. Use the same upload
// endpoint/auth contract with an abortable request for bounded worker stages.
export async function uploadJobImage({ buffer, mime, fileName }, { fetchImpl = fetch, env = process.env } = {}) {
  if (!env.IMAGEKIT_PRIVATE_KEY) throw new Error("IMAGEKIT_NOT_CONFIGURED");
  const form = new FormData();
  form.set("file", new Blob([buffer], { type: mime }), fileName);
  form.set("fileName", fileName); form.set("folder", "/product");
  form.set("useUniqueFileName", "false"); form.set("overwriteFile", "true");
  const response = await fetchImpl("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST", body: form, redirect: "error", signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Basic ${Buffer.from(`${env.IMAGEKIT_PRIVATE_KEY}:`).toString("base64")}` },
  });
  if (!response.ok) throw new Error("IMAGE_UPLOAD_FAILED");
  const result = await response.json();
  if (!result.fileId || typeof result.url !== "string" || !result.url.startsWith("https://")) throw new Error("IMAGE_UPLOAD_INVALID");
  return { url: result.url, fileId: result.fileId };
}
