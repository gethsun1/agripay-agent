const steps = [
  "Question",
  "Plan",
  "HTTP 402",
  "Policy",
  "Hedera settlement",
  "HTTP 200",
  "Intelligence",
];
export function Flow() {
  return (
    <ol className="protocol-flow" aria-label="x402 lifecycle">
      {steps.map((step, index) => (
        <li key={step}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <b>{step}</b>
        </li>
      ))}
    </ol>
  );
}
