export class VisitCounter {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    if (new URL(request.url).pathname !== "/api/visits") {
      return new Response("Not found", { status: 404 });
    }

    if (request.method === "POST") {
      let count = 0;
      await this.state.storage.transaction(async (storage) => {
        const current = await storage.get("count");
        count = typeof current === "number" ? current + 1 : 1;
        await storage.put("count", count);
      });
      return Response.json({ count }, { headers: { "cache-control": "no-store" } });
    }

    if (request.method === "GET") {
      const current = await this.state.storage.get("count");
      return Response.json({ count: typeof current === "number" ? current : 0 }, { headers: { "cache-control": "no-store" } });
    }

    return new Response("Method not allowed", { status: 405 });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/visits") {
      const id = env.VISITOR_COUNTER.idFromName("paranormal-fact-checked");
      return env.VISITOR_COUNTER.get(id).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
