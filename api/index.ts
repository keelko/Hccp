import app from "../server.js";

export default function handler(req: any, res: any) {
  try {
    const rawUrl = req.url || "/";
    const parsed = new URL(rawUrl, "http://localhost");
    const rewrittenPath =
      parsed.searchParams.get("__path") ??
      (typeof req.query?.__path === "string" ? req.query.__path : undefined);

    if (rewrittenPath !== undefined && rewrittenPath !== null) {
      parsed.searchParams.delete("__path");
      const cleanPath = rewrittenPath === "/" || rewrittenPath === ""
        ? ""
        : rewrittenPath.startsWith("/")
          ? rewrittenPath
          : `/${rewrittenPath}`;
      const qs = parsed.searchParams.toString();
      req.url = `/api${cleanPath}${qs ? `?${qs}` : ""}`;
    }
  } catch (err) {
    console.warn("API path rewrite fallback:", err);
  }
  return app(req, res);
}
