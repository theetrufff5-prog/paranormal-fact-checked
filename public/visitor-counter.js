(() => {
  const outputs = document.querySelectorAll("[data-visitor-count]");
  if (!outputs.length) return;

  function show(value) {
    outputs.forEach((output) => {
      output.textContent = value;
    });
  }

  fetch("/api/visits", { method: "POST", cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Counter unavailable");
      return response.json();
    })
    .then(({ count }) => {
      show(Number(count).toLocaleString());
    })
    .catch(() => {
      show("—");
    });
})();
