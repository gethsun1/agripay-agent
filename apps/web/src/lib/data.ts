export const resources = [
  {
    id: "weather-risk",
    name: "Weather risk",
    priceTinybars: "5000000",
    priceHbar: "0.05",
    eyebrow: "Planting window",
    description: "Seven-day planting conditions, rainfall and soil-moisture risk.",
  },
  {
    id: "disease-risk",
    name: "Disease risk",
    priceTinybars: "7000000",
    priceHbar: "0.07",
    eyebrow: "Field watch",
    description: "Named risk factors, scouting priorities and prevention actions.",
  },
  {
    id: "market-intelligence",
    name: "Market intelligence",
    priceTinybars: "4000000",
    priceHbar: "0.04",
    eyebrow: "Selling signal",
    description: "Demonstration price range, demand, supply, timing and risks.",
  },
] as const;
export type ResourceId = (typeof resources)[number]["id"];
export const evidence = [
  {
    phase: "Phase 2",
    resourceId: "disease-risk",
    resource: "Disease risk",
    amountTinybars: "7000000",
    amountHbar: "0.07",
    transactionId: "0.0.9676583@1784671641.501210796",
    taskId: "verified-phase-2",
    buyer: "0.0.9676580",
    seller: "0.0.9676582",
    facilitator: "0.0.9676583",
    settlementState: "settled",
    deliveryState: "delivered",
    planSource: "Groq",
    timestamp: "2026-07-22",
    kind: "Verified testnet evidence",
  },
  {
    phase: "Phase 2",
    resourceId: "weather-risk",
    resource: "Weather risk",
    amountTinybars: "5000000",
    amountHbar: "0.05",
    transactionId: "0.0.9676583@1784671645.343987679",
    taskId: "verified-phase-2",
    buyer: "0.0.9676580",
    seller: "0.0.9676582",
    facilitator: "0.0.9676583",
    settlementState: "settled",
    deliveryState: "delivered",
    planSource: "Groq",
    timestamp: "2026-07-22",
    kind: "Verified testnet evidence",
  },
  {
    phase: "Phase 2",
    resourceId: "market-intelligence",
    resource: "Market intelligence",
    amountTinybars: "4000000",
    amountHbar: "0.04",
    transactionId: "0.0.9676583@1784671645.928120887",
    taskId: "verified-phase-2",
    buyer: "0.0.9676580",
    seller: "0.0.9676582",
    facilitator: "0.0.9676583",
    settlementState: "settled",
    deliveryState: "delivered",
    planSource: "Groq",
    timestamp: "2026-07-22",
    kind: "Verified testnet evidence",
  },
  {
    phase: "Phase 1",
    resourceId: "weather-risk",
    resource: "Weather risk",
    amountTinybars: "5000000",
    amountHbar: "0.05",
    transactionId: "0.0.9676583@1784668506.369008592",
    taskId: "verified-phase-1",
    buyer: "0.0.9676580",
    seller: "0.0.9676582",
    facilitator: "0.0.9676583",
    settlementState: "settled",
    deliveryState: "delivered",
    planSource: "Deterministic",
    timestamp: "2026-07-21",
    kind: "Verified testnet evidence",
  },
] as const;
export function hashscanUrl(transactionId: string) {
  const m = /^(0\.0\.\d+)@(\d+)\.(\d+)$/.exec(transactionId);
  if (!m) return "";
  const [, account, seconds, nanos] = m;
  if (!account || !seconds || !nanos) return "";
  return `https://hashscan.io/testnet/transaction/${account}-${seconds}-${nanos}`;
}
export function mirrorUrl(transactionId: string) {
  const m = /^(0\.0\.\d+)@(\d+)\.(\d+)$/.exec(transactionId);
  if (!m) return "";
  const [, account, seconds, nanos] = m;
  if (!account || !seconds || !nanos) return "";
  return `https://testnet.mirrornode.hedera.com/api/v1/transactions/${account}-${seconds}-${nanos}`;
}
export function formatTinybars(value: string | bigint) {
  const amount = typeof value === "bigint" ? value : BigInt(value);
  const digits = amount.toString().padStart(9, "0");
  const fraction = digits.slice(-8).replace(/0+$/, "");
  return `${digits.slice(0, -8)}${fraction ? `.${fraction}` : ""}`;
}
export const examples = [
  "Should I plant maize in Nandi this week?",
  "What disease risks should I watch for in maize?",
  "What is the current demonstration market outlook for maize?",
  "Should I plant maize in Nandi, what disease risks should I prepare for, and what is the market outlook?",
];
