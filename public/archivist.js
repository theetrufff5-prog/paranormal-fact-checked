(() => {
  const records = [
    { title: "Eastern State Penitentiary", location: "Philadelphia, Pennsylvania", tags: "prison penitentiary isolation apparitions voices ghost hunters ghost adventures paranormal lockdown buzzfeed unsolved", summary: "Documented prison history, reported experiences, and television investigations.", url: "eastern-state-penitentiary.html" },
    { title: "The Cecil Hotel", location: "Los Angeles, California", tags: "hotel elisa lam richard ramirez jack unterweger amy price deaths paranormal television ghost adventures", summary: "Dark history, unsupported claims, and the official finding in Elisa Lam’s death.", url: "cecil-hotel.html" },
    { title: "Our Evidence Method", location: "How we fact-check", tags: "method evidence sources claims assessment verified unproven fact check", summary: "How accounts become evidence-led case assessments.", url: "index.html#method" },
    { title: "Share an Experience", location: "Reader submissions", tags: "submit story encounter photo video audio witness contact", summary: "Tell the editorial team what happened and what evidence you have.", url: "index.html#submit" }
  ];

  const shell = document.createElement("aside");
  shell.className = "archivist";
  shell.setAttribute("aria-label", "The Archivist site guide");
  shell.innerHTML = `
    <button class="archivist-summon" type="button" aria-expanded="false" aria-controls="archivist-panel">
      <img src="the-archivist.png" alt="" width="112" height="149">
      <span>ASK THE ARCHIVIST</span>
    </button>
    <section class="archivist-panel" id="archivist-panel" hidden>
      <button class="archivist-close" type="button" aria-label="Close The Archivist">×</button>
      <header class="archivist-conversation">
        <img src="the-archivist.png" alt="The Archivist, your ghost librarian guide" width="92" height="138">
        <div><p class="archivist-kicker">THE ARCHIVIST / SITE GUIDE</p><h2>How can I help you?</h2></div>
      </header>
      <form class="archivist-search" role="search">
        <label for="archivist-query">Search cases, places, claims, or TV shows</label>
        <div><input id="archivist-query" type="search" autocomplete="off" placeholder="Try: Cecil Hotel or prison"><button type="submit">SEARCH</button></div>
      </form>
      <div class="archivist-results" aria-live="polite"><p>Ask about a case, location, claim, or investigation.</p></div>
      <small>Searches stay in your browser and are not saved.</small>
    </section>`;
  document.body.append(shell);

  const summon = shell.querySelector(".archivist-summon");
  const panel = shell.querySelector(".archivist-panel");
  const close = shell.querySelector(".archivist-close");
  const form = shell.querySelector("form");
  const input = shell.querySelector("input");
  const results = shell.querySelector(".archivist-results");

  function setOpen(open) {
    panel.hidden = !open;
    summon.setAttribute("aria-expanded", String(open));
    shell.classList.toggle("is-open", open);
    if (open) window.setTimeout(() => input.focus(), 50);
  }

  function search(query) {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) {
      results.innerHTML = "<p>Please type a place, case, claim, or show.</p>";
      return;
    }
    const matches = records.filter(item => {
      const haystack = `${item.title} ${item.location} ${item.tags} ${item.summary}`.toLowerCase();
      return terms.every(term => haystack.includes(term));
    });
    results.innerHTML = matches.length
      ? matches.map(item => `<a href="${item.url}"><b>${item.title}</b><span>${item.location}</span><small>${item.summary}</small></a>`).join("")
      : `<p>I don’t have a matching file yet. Try fewer words—or <a href="index.html#submit">share a lead with the team</a>.</p>`;
  }

  summon.addEventListener("click", () => setOpen(panel.hidden));
  close.addEventListener("click", () => setOpen(false));
  form.addEventListener("submit", event => { event.preventDefault(); search(input.value); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !panel.hidden) setOpen(false); });
})();
