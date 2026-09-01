(() => {
  const output = document.querySelector("[data-visitor-count]");
  if (!output) return;

  fetch("/api/visits", { method: "POST", cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Counter unavailable");
      return response.json();
    })
    .then(({ count }) => {
      output.textContent = Number(count).toLocaleString();
    })
    .catch(() => {
      output.textContent = "—";
    });
})();
