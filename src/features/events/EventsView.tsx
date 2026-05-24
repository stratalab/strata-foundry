import { useEffect, useState, useCallback } from "react";
import { useDatabases } from "../../state/databases";
import { eventLog, eventLen, eventTypes, eventAppend } from "../../lib/event";
import type { EventEntry } from "../../lib/event";
import { fromPlain } from "../../lib/value";
import { JsonTree } from "../../components/JsonTree";

const fmtTs = (us: number) => new Date(us / 1000).toLocaleString();

export function EventsView() {
  const { active } = useDatabases();
  const handle = active?.handle ?? null;
  const branch = active?.currentBranch;
  const space = active?.currentSpace;

  const [events, setEvents] = useState<EventEntry[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [count, setCount] = useState(0);
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [evType, setEvType] = useState("");
  const [evPayload, setEvPayload] = useState('{\n  \n}');
  const [addErr, setAddErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (handle === null) return;
    setLoading(true);
    setError(null);
    try {
      const [log, t, c] = await Promise.all([
        eventLog(handle, branch, space),
        eventTypes(handle, branch, space),
        eventLen(handle, branch, space),
      ]);
      setEvents(log);
      setTypes(t);
      setCount(c);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [handle, branch, space]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const shown = typeFilter ? events.filter((e) => e.type === typeFilter) : events;

  async function append() {
    if (handle === null || !evType.trim()) return;
    let payload;
    try {
      payload = fromPlain(JSON.parse(evPayload));
    } catch (e) {
      setAddErr(`Invalid JSON: ${String(e)}`);
      return;
    }
    try {
      await eventAppend(handle, evType.trim(), payload, branch, space);
      setAdding(false);
      setEvType("");
      setEvPayload('{\n  \n}');
      setAddErr(null);
      await refresh();
    } catch (e) {
      setAddErr(String(e));
    }
  }

  return (
    <div className="feature">
      <header className="feature-head">
        <h2>Events</h2>
        <span className="muted">
          {count} events · <code>{branch}</code> / <code>{space}</code>
        </span>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">all types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="grow" />
        <button onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "Append event"}</button>
        <button className="ghost" onClick={refresh}>
          Refresh
        </button>
      </header>

      {adding && (
        <div className="event-append">
          <input
            placeholder="event.type (e.g. user.created)"
            value={evType}
            onChange={(e) => setEvType(e.target.value)}
          />
          <textarea
            className="value-edit"
            style={{ minHeight: 120 }}
            spellCheck={false}
            value={evPayload}
            onChange={(e) => setEvPayload(e.target.value)}
          />
          {addErr && <div className="error">{addErr}</div>}
          <div className="editor-actions">
            <button onClick={append} disabled={!evType.trim()}>
              Append
            </button>
          </div>
        </div>
      )}

      <div className="events-body">
        {loading && <div className="muted pad">Loading…</div>}
        {error && <div className="error pad">{error}</div>}
        {!loading && !error && shown.length === 0 && <div className="muted pad">No events</div>}
        {shown.map((ev) => (
          <div className="event-card" key={`${ev.type}:${ev.sequence}`}>
            <div className="event-head">
              <span className="badge">{ev.type}</span>
              <span className="muted">#{ev.sequence}</span>
              <span className="grow" />
              <span className="muted">{fmtTs(ev.timestamp)}</span>
            </div>
            <div className="json-view">
              <JsonTree value={ev.payload} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
