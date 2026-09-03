(() => {
  const root = document.querySelector("[data-comments]");
  if (!root) return;
  const caseId = root.dataset.comments;
  const list = root.querySelector("[data-comment-list]");
  const form = root.querySelector("form");
  const message = root.querySelector("[data-comment-message]");
  const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

  async function load() {
    try {
      const response = await fetch(`/api/comments?case=${encodeURIComponent(caseId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const { comments } = await response.json();
      if (!comments.length) {
        list.innerHTML = '<p class="comments-empty">No published remarks yet. You can be the first to submit one.</p>';
        return;
      }
      list.innerHTML = comments.map((comment) => `
        <article class="comment">
          <div class="comment-meta"><b>${escape(comment.name)}${comment.editorial ? ' <span>PFC EDITORIAL TEAM</span>' : ""}</b><time datetime="${escape(comment.createdAt)}">${new Date(comment.createdAt).toLocaleDateString()}</time></div>
          <p>${escape(comment.body)}</p><button type="button" data-report="${escape(comment.id)}">Report</button>
        </article>`).join("");
    } catch {
      list.innerHTML = '<p class="comments-empty">Remarks are temporarily unavailable.</p>';
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]");
    button.disabled = true; message.textContent = "Submitting…";
    const data = new FormData(form);
    try {
      const response = await fetch("/api/comments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseId, name: data.get("name"), body: data.get("body"), website: data.get("website"), turnstileToken: data.get("cf-turnstile-response") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Submission failed.");
      form.reset(); message.textContent = "Thank you. Your remark is awaiting editorial review.";
    } catch (error) { message.textContent = error.message; }
    finally { if (window.turnstile) window.turnstile.reset(); button.disabled = false; }
  });

  list.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-report]");
    if (!button || button.disabled) return;
    button.disabled = true;
    await fetch("/api/comments/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: button.dataset.report }) });
    button.textContent = "Reported";
  });
  load();
})();
