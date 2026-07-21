import { useEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "../components/Layout";
import { api, mergeEvents, terminalStates, type Task, type TaskEvent } from "../lib/api";
import { examples, formatTinybars, resources } from "../lib/data";
type Mode = "mock" | "live";
const deriveResources = (question: string) =>
  resources.filter((r) =>
    r.id === "weather-risk"
      ? /weather|rain|plant|soil|temperature/i.test(question)
      : r.id === "disease-risk"
        ? /disease|pest|scout|leaf|blight/i.test(question)
        : /market|price|demand|sell|buyer|supply|outlook/i.test(question),
  );
export function Agent() {
  const [question, setQuestion] = useState<string>(
    examples[3] ?? examples[0] ?? "Should I plant maize in Nandi this week?",
  );
  const [mode, setMode] = useState<Mode>("mock");
  const [confirmed, setConfirmed] = useState(false);
  const [operatorPassword, setOperatorPassword] = useState("");
  const [operatorCsrf, setOperatorCsrf] = useState<string | null>(null);
  const [authPending, setAuthPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(() =>
    new URLSearchParams(location.search).get("task"),
  );
  const [task, setTask] = useState<Task | null>(null);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [error, setError] = useState("");
  const announced = useRef("");
  const selected = useMemo(() => {
    const found = deriveResources(question);
    return found.length ? found : [resources[0]];
  }, [question]);
  const total = selected.reduce((sum, r) => sum + BigInt(r.priceTinybars), 0n);
  const canSubmit =
    question.trim().length >= 10 &&
    question.length <= 1000 &&
    !submitting &&
    (mode === "mock" || (confirmed && Boolean(operatorCsrf)));
  useEffect(() => {
    if (!taskId) return;
    let cancelled = false,
      timer: number | undefined;
    const poll = async () => {
      try {
        const [nextTask, nextEvents] = await Promise.all([api.task(taskId), api.events(taskId)]);
        if (cancelled) return;
        setTask(nextTask);
        setEvents((current) => mergeEvents(current, nextEvents));
        setError("");
        announced.current = `Task ${nextTask.state}`;
        if (!terminalStates.has(nextTask.state)) timer = window.setTimeout(() => void poll(), 1500);
      } catch {
        if (!cancelled) {
          setError(
            "Connection interrupted. Read-only recovery will retry; no new payment or task will be created.",
          );
          timer = window.setTimeout(() => void poll(), 4000);
        }
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [taskId]);
  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const key = crypto.randomUUID();
      const csrfToken = mode === "live" ? operatorCsrf : (await api.csrf()).csrfToken;
      if (!csrfToken) throw new Error("Operator authentication is required");
      const created = await api.createTask(question, key, mode === "live" && confirmed, csrfToken);
      setTaskId(created.taskId);
      history.replaceState(null, "", `/agent?task=${encodeURIComponent(created.taskId)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Task creation failed");
    } finally {
      setSubmitting(false);
    }
  }
  async function loginOperator() {
    setAuthPending(true);
    setError("");
    try {
      const challenge = await api.csrf();
      const login = await api.login(operatorPassword, challenge.csrfToken);
      setOperatorCsrf(login.csrfToken);
      setOperatorPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setAuthPending(false);
    }
  }
  return (
    <div className="workspace">
      <div className="workspace-head">
        <div>
          <p className="kicker">Autonomous agent workspace</p>
          <h1>
            One question.
            <br />
            <em>A complete decision trail.</em>
          </h1>
        </div>
        <div className="mode-switch" role="group" aria-label="Execution mode">
          <button
            className={mode === "mock" ? "active" : ""}
            onClick={() => {
              setMode("mock");
              setConfirmed(false);
            }}
          >
            <span />
            Demo mode<small>No real payment</small>
          </button>
          <button
            className={mode === "live" ? "active" : ""}
            onClick={() => {
              setMode("live");
            }}
          >
            <span />
            Hedera testnet<small>Explicit confirmation</small>
          </button>
        </div>
      </div>
      <div className="workspace-grid">
        <section className="composer panel">
          <span className="panel-label">01 · YOUR QUESTION</span>
          <label htmlFor="question">What decision can AgriPay help with?</label>
          <textarea
            id="question"
            maxLength={1000}
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              setConfirmed(false);
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void submit();
            }}
          />
          <div className="composer-meta">
            <span>{question.length} / 1,000</span>
            <span>Nandi County · maize</span>
          </div>
          <div className="examples">
            <span>TRY AN EXAMPLE</span>
            {examples.map((item, index) => (
              <button
                key={item}
                onClick={() => {
                  setQuestion(item);
                  setConfirmed(false);
                }}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <p className="disclosure">
            Curated demonstration intelligence only—not live meteorological, agronomic,
            disease-surveillance, financial, or market advice.
          </p>
        </section>
        <section className="preflight panel">
          <span className="panel-label">02 · PREFLIGHT PURCHASE SUMMARY</span>
          <div className="preflight-top">
            <div>
              <small>MAXIMUM TASK EXPOSURE</small>
              <b>{formatTinybars(total)} HBAR</b>
              <span>{total.toLocaleString()} tinybars</span>
            </div>
            <StatusBadge tone={mode === "mock" ? "neutral" : "warning"}>
              {mode === "mock" ? "Demo · no spend" : "Live testnet"}
            </StatusBadge>
          </div>
          <div className="planned-resources">
            {selected.map((r, index) => (
              <div key={r.id}>
                <span>0{index + 1}</span>
                <p>
                  <b>{r.name}</b>
                  <small>Registry-controlled · {r.priceHbar} HBAR</small>
                </p>
                <span className="priority">P{index + 1}</span>
              </div>
            ))}
          </div>
          <dl className="mini-policy">
            <div>
              <dt>Network</dt>
              <dd>Hedera testnet</dd>
            </div>
            <div>
              <dt>Seller</dt>
              <dd>0.0.9676582</dd>
            </div>
            <div>
              <dt>Payments</dt>
              <dd>Max 3</dd>
            </div>
            <div>
              <dt>Asset</dt>
              <dd>Native HBAR</dd>
            </div>
          </dl>
          {mode === "live" && (
            <>
              <div className="operator-login">
                <label htmlFor="operator-password">Operator passphrase</label>
                <input
                  id="operator-password"
                  type="password"
                  autoComplete="current-password"
                  value={operatorPassword}
                  onChange={(e) => {
                    setOperatorPassword(e.target.value);
                  }}
                  disabled={Boolean(operatorCsrf)}
                />
                <button
                  type="button"
                  className="button button-small"
                  disabled={authPending || Boolean(operatorCsrf) || operatorPassword.length < 1}
                  onClick={() => void loginOperator()}
                >
                  {operatorCsrf
                    ? "Operator authenticated"
                    : authPending
                      ? "Authenticating…"
                      : "Authenticate operator"}
                </button>
              </div>
              <label className="confirm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => {
                    setConfirmed(e.target.checked);
                  }}
                />
                <span>
                  I explicitly authorize this testnet task up to{" "}
                  <b>
                    {total.toLocaleString()} tinybars ({formatTinybars(total)} HBAR)
                  </b>
                  . Refresh and recovery will not create another task.
                </span>
              </label>
            </>
          )}
          <button className="button submit" disabled={!canSubmit} onClick={() => void submit()}>
            {submitting
              ? "Creating one bounded task…"
              : mode === "mock"
                ? "Run demonstration task →"
                : "Confirm & run testnet task →"}
          </button>
          <small className="shortcut">Ctrl/⌘ + Enter to submit</small>
        </section>
      </div>
      {error && (
        <div className="alert" role="alert">
          <b>Connection status</b>
          {error}
          <button
            onClick={() => {
              setError("");
            }}
          >
            Retry read
          </button>
        </div>
      )}
      {taskId && (
        <section className="task-board">
          <div className="task-title">
            <div>
              <p className="kicker">Durable task</p>
              <h2>{task?.state.replaceAll("_", " ") ?? "Loading task state…"}</h2>
              <code>{taskId}</code>
            </div>
            <StatusBadge
              tone={
                task?.state === "completed"
                  ? "settled"
                  : task?.state === "ambiguous"
                    ? "warning"
                    : "live"
              }
            >
              {task?.state ?? "connecting"}
            </StatusBadge>
          </div>
          <div className="task-columns">
            <div className="timeline panel">
              <span className="panel-label">LIVE TASK TIMELINE</span>
              {events.length ? (
                <ol>
                  {events.map((event) => (
                    <li key={event.id} className={`event-${event.state}`}>
                      <span className="timeline-dot" />
                      <div>
                        <time>{new Date(event.created_at).toLocaleTimeString()}</time>
                        <h3>{event.event_type.replaceAll("_", " ")}</h3>
                        <p>{event.detail}</p>
                        {event.resource_id && <code>{event.resource_id}</code>}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="loading-state">
                  <span />
                  <p>Waiting for durable events…</p>
                </div>
              )}
            </div>
            <aside className="control-centre panel">
              <span className="panel-label">PAYMENT CONTROL CENTRE</span>
              <h3>Authority stays outside the model.</h3>
              <p>
                Groq proposes resources. Deterministic policy authorizes exact registered terms. The
                facilitator settles independently.
              </p>
              <dl>
                <div>
                  <dt>Buyer</dt>
                  <dd>0.0.9676580</dd>
                </div>
                <div>
                  <dt>Seller</dt>
                  <dd>0.0.9676582</dd>
                </div>
                <div>
                  <dt>Facilitator</dt>
                  <dd>0.0.9676583</dd>
                </div>
                <div>
                  <dt>Planned</dt>
                  <dd>
                    {task ? formatTinybars(task.estimated_tinybars) : formatTinybars(total)} HBAR
                  </dd>
                </div>
                <div>
                  <dt>Settled</dt>
                  <dd>{task ? formatTinybars(task.spent_tinybars) : "0"} HBAR</dd>
                </div>
                <div>
                  <dt>Remaining</dt>
                  <dd>
                    {task ? formatTinybars(16_000_000n - BigInt(task.spent_tinybars)) : "0.16"} HBAR
                  </dd>
                </div>
              </dl>
              <div className="safe-note">
                Private keys and signed payloads never enter the browser.
              </div>
            </aside>
          </div>
          {task?.answer_json && (
            <section className="brief panel">
              <span className="panel-label">FINAL INTELLIGENCE BRIEF</span>
              <h2>Validated decision brief</h2>
              <pre>{JSON.stringify(JSON.parse(task.answer_json) as unknown, null, 2)}</pre>
            </section>
          )}
        </section>
      )}
      <div className="sr-only" role="status" aria-live="polite">
        {announced.current}
      </div>
    </div>
  );
}
