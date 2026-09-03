(() => {
  const form = document.querySelector("[data-admin-login]");
  const list = document.querySelector("[data-admin-list]");
  const message = document.querySelector("[data-admin-message]");
  const editorialForm = document.querySelector("[data-editorial-form]");
  let token = "";
  const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

  async function load() {
    const response = await fetch("/api/comments/admin", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!response.ok) throw new Error("Password not accepted.");
    const { comments } = await response.json();
    const active = comments.filter((comment) => comment.status !== "rejected");
    list.innerHTML = active.length ? active.map((comment) => `
      <article class="moderation-item" data-id="${escape(comment.id)}">
        <div class="comment-meta"><b>${escape(comment.name)}</b><span class="moderation-status ${escape(comment.status)}">${escape(comment.status)}${comment.reports ? ` / ${comment.reports} reports` : ""}</span></div>
        <small>${escape(comment.caseId)} • ${new Date(comment.createdAt).toLocaleString()}</small><p>${escape(comment.body)}</p>
        <div class="moderation-actions"><button class="button primary" data-action="approve">Approve</button><button class="button secondary" data-action="reject">Reject</button><button class="button secondary" data-action="delete">Delete</button></div>
      </article>`).join("") : '<p class="comments-empty">The review queue is empty.</p>';
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault(); token = new FormData(form).get("token"); message.textContent = "Opening queue…";
    try { await load(); form.hidden = true; editorialForm.hidden = false; message.textContent = ""; } catch (error) { message.textContent = error.message; }
  });

  editorialForm.addEventListener("submit", async (event) => {
    event.preventDefault(); const data = new FormData(editorialForm);
    const response = await fetch("/api/comments/admin", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ action: "editorial", caseId: data.get("caseId"), body: data.get("body") }) });
    if (response.ok) { editorialForm.reset(); message.textContent = "Editorial reply published."; await load(); } else { message.textContent = "Reply could not be published."; }
  });

  list.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]"); if (!button) return;
    const item = button.closest("[data-id]"); button.disabled = true;
    const response = await fetch("/api/comments/admin", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ id: item.dataset.id, action: button.dataset.action }) });
    if (response.ok) await load(); else { button.disabled = false; message.textContent = "Action failed."; }
  });
})();
