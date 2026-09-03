const JSON_HEADERS = { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" };
const CASES = new Set(["eastern-state-penitentiary", "cecil-hotel", "amityville-horror"]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function normalizeText(value, limit) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function authorized(request, secret) {
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

async function clientKey(request) {
  const address = request.headers.get("cf-connecting-ip") || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address));
  return [...new Uint8Array(digest)].slice(0, 12).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyTurnstile(token, secret, remoteip) {
  if (!token || !secret) return false;
  const body = new FormData();
  body.append("secret", secret); body.append("response", token); body.append("remoteip", remoteip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  if (!response.ok) return false;
  const result = await response.json();
  return result.success === true;
}

export class VisitCounter {
  constructor(state) { this.state = state; }

  async fetch(request) {
    if (new URL(request.url).pathname !== "/api/visits") return new Response("Not found", { status: 404 });
    if (request.method === "POST") {
      let count = 0;
      await this.state.storage.transaction(async (storage) => {
        const current = await storage.get("count");
        count = typeof current === "number" ? current + 1 : 1;
        await storage.put("count", count);
      });
      return json({ count });
    }
    if (request.method === "GET") {
      const current = await this.state.storage.get("count");
      return json({ count: typeof current === "number" ? current : 0 });
    }
    return new Response("Method not allowed", { status: 405 });
  }
}

export class CommentStore {
  constructor(state, env) { this.state = state; this.env = env; }

  async getAll() {
    const entries = await this.state.storage.list({ prefix: "comment:" });
    return [...entries.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async fetch(request) {
    const url = new URL(request.url);
    const route = url.pathname;

    if (route === "/api/comments" && request.method === "GET") {
      const caseId = url.searchParams.get("case");
      if (!CASES.has(caseId)) return json({ error: "Unknown case." }, 400);
      const comments = (await this.getAll())
        .filter((item) => item.caseId === caseId && item.status === "approved")
        .map(({ id, name, body, createdAt, editorial }) => ({ id, name, body, createdAt, editorial }));
      return json({ comments });
    }

    if (route === "/api/comments" && request.method === "POST") {
      let input;
      try { input = await request.json(); } catch { return json({ error: "Invalid submission." }, 400); }
      if (input.website) return json({ ok: true, pending: true }, 202);
      const caseId = normalizeText(input.caseId, 60);
      const name = normalizeText(input.name, 40);
      const body = normalizeText(input.body, 800);
      if (!CASES.has(caseId) || name.length < 2 || body.length < 3) return json({ error: "Please provide a display name and comment." }, 400);

      const address = request.headers.get("cf-connecting-ip") || "unknown";
      if (!await verifyTurnstile(input.turnstileToken, this.env.TURNSTILE_SECRET, address)) return json({ error: "Human verification failed. Please try again." }, 403);

      const client = await clientKey(request);
      const bucket = Math.floor(Date.now() / 600000);
      const rateKey = `rate:${client}:${bucket}`;
      const attempts = (await this.state.storage.get(rateKey)) || 0;
      if (attempts >= 3) return json({ error: "Please wait before submitting another comment." }, 429);

      const id = crypto.randomUUID();
      const record = { id, caseId, name, body, createdAt: new Date().toISOString(), status: "pending", reports: 0, editorial: false };
      await this.state.storage.put(rateKey, attempts + 1, { expirationTtl: 1200 });
      await this.state.storage.put(`comment:${id}`, record);
      return json({ ok: true, pending: true }, 202);
    }

    if (route === "/api/comments/report" && request.method === "POST") {
      let input;
      try { input = await request.json(); } catch { return json({ error: "Invalid report." }, 400); }
      const key = `comment:${normalizeText(input.id, 60)}`;
      const record = await this.state.storage.get(key);
      if (!record || record.status !== "approved") return json({ error: "Comment unavailable." }, 404);
      const reporter = await clientKey(request);
      const reportKey = `report:${record.id}:${reporter}`;
      if (await this.state.storage.get(reportKey)) return json({ ok: true, duplicate: true });
      record.reports = (record.reports || 0) + 1;
      if (record.reports >= 3) record.status = "flagged";
      await this.state.storage.put(reportKey, true, { expirationTtl: 604800 });
      await this.state.storage.put(key, record);
      return json({ ok: true });
    }

    if (route === "/api/comments/admin" && request.method === "GET") {
      if (!authorized(request, this.env.COMMENTS_ADMIN_TOKEN)) return json({ error: "Unauthorized." }, 401);
      return json({ comments: await this.getAll() });
    }

    if (route === "/api/comments/admin" && request.method === "POST") {
      if (!authorized(request, this.env.COMMENTS_ADMIN_TOKEN)) return json({ error: "Unauthorized." }, 401);
      let input;
      try { input = await request.json(); } catch { return json({ error: "Invalid action." }, 400); }
      const action = normalizeText(input.action, 20);
      if (action === "editorial") {
        const caseId = normalizeText(input.caseId, 60);
        const body = normalizeText(input.body, 800);
        if (!CASES.has(caseId) || body.length < 3) return json({ error: "Choose a case and enter a reply." }, 400);
        const id = crypto.randomUUID();
        await this.state.storage.put(`comment:${id}`, { id, caseId, name: "PFC Editorial Team", body, createdAt: new Date().toISOString(), status: "approved", reports: 0, editorial: true });
        return json({ ok: true });
      }
      const key = `comment:${normalizeText(input.id, 60)}`;
      const record = await this.state.storage.get(key);
      if (!record) return json({ error: "Comment not found." }, 404);
      if (action === "approve") { record.status = "approved"; record.reports = 0; }
      else if (action === "reject") record.status = "rejected";
      else if (action === "delete") { await this.state.storage.delete(key); return json({ ok: true }); }
      else return json({ error: "Unknown action." }, 400);
      await this.state.storage.put(key, record);
      return json({ ok: true });
    }

    return new Response("Not found", { status: 404 });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/visits") {
      const id = env.VISITOR_COUNTER.idFromName("paranormal-fact-checked");
      return env.VISITOR_COUNTER.get(id).fetch(request);
    }
    if (url.pathname.startsWith("/api/comments")) {
      const id = env.COMMENT_STORE.idFromName("paranormal-fact-checked-comments");
      return env.COMMENT_STORE.get(id).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
