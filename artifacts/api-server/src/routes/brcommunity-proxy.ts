import { Router, type IRouter } from "express";

const router: IRouter = Router();
const upstreamBase = (
  process.env["BRCOMMUNITY_API_BASE"] || "https://brcommunity.xyz/community/api"
).replace(/\/$/, "");
const UPSTREAM_TIMEOUT_MS = 15_000;

router.use("/brcommunity", async (req, res) => {
  const originalUrl = req.originalUrl || "";
  const suffix = originalUrl.replace(/^\/api\/brcommunity/, "") || "/";
  const target = `${upstreamBase}${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const authorization = req.header("authorization");
  const extensionToken = req.header("x-brcommunity-extension-token");
  if (authorization) headers.Authorization = authorization;
  if (extensionToken) headers["X-BRCommunity-Extension-Token"] = extensionToken;
  if (req.body && ["POST", "PUT", "PATCH"].includes(req.method)) {
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(target, {
      method: req.method,
      headers,
      body: ["POST", "PUT", "PATCH"].includes(req.method)
        ? JSON.stringify(req.body ?? {})
        : undefined,
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type");
    if (contentType) res.setHeader("content-type", contentType);
    res.setHeader("cache-control", "no-store");
    res.status(response.status).send(await response.text());
  } catch (error) {
    req.log.error({ err: error, target }, "BRCommunity proxy request failed");
    const timedOut = error instanceof Error && error.name === "AbortError";
    res.status(502).json({
      error: timedOut ? "BRCommunity upstream timed out." : "Unable to reach BRCommunity upstream.",
    });
  } finally {
    clearTimeout(timeout);
  }
});

export default router;
