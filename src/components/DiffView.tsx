import { JsonTree } from "./JsonTree";
import type { BranchDiffResult, DiffEntry } from "../lib/branch";

type Kind = "added" | "removed" | "modified";
const SIGN: Record<Kind, string> = { added: "+", removed: "−", modified: "~" };

function Entry({
  entry,
  kind,
  branchA,
  branchB,
  onCherryPick,
}: {
  entry: DiffEntry;
  kind: Kind;
  branchA: string;
  branchB: string;
  onCherryPick?: (entry: DiffEntry) => void;
}) {
  return (
    <div className={`diff-entry ${kind}`}>
      <div className="diff-entry-head">
        <span className={`diff-sign ${kind}`}>{SIGN[kind]}</span>
        <code>{entry.key}</code>
        <span className="badge">{entry.type_tag}</span>
        <span className="grow" />
        {onCherryPick && kind !== "removed" && (
          <button
            className="ghost tiny"
            title={`Cherry-pick this key from ${branchB} into ${branchA}`}
            onClick={() => onCherryPick(entry)}
          >
            pick → {branchA}
          </button>
        )}
      </div>
      {kind === "modified" ? (
        <div className="diff-values">
          <div className="diff-side before">
            <div className="diff-side-label">{branchA}</div>
            {entry.value_a && <JsonTree value={entry.value_a} />}
          </div>
          <div className="diff-side after">
            <div className="diff-side-label">{branchB}</div>
            {entry.value_b && <JsonTree value={entry.value_b} />}
          </div>
        </div>
      ) : (
        <div className="diff-single">
          {kind === "added" && entry.value_b && <JsonTree value={entry.value_b} />}
          {kind === "removed" && entry.value_a && <JsonTree value={entry.value_a} />}
        </div>
      )}
    </div>
  );
}

export function DiffView({
  diff,
  onCherryPick,
}: {
  diff: BranchDiffResult;
  onCherryPick?: (entry: DiffEntry) => void;
}) {
  const { summary } = diff;
  const empty = diff.spaces.every(
    (s) => !s.added.length && !s.modified.length && !s.removed.length,
  );

  return (
    <div className="diff">
      <div className="diff-summary">
        <code>{diff.branch_a}</code>
        <span className="muted">↔</span>
        <code>{diff.branch_b}</code>
        <span className="grow" />
        <span className="added">+{summary.total_added}</span>
        <span className="modified">~{summary.total_modified}</span>
        <span className="removed">−{summary.total_removed}</span>
      </div>
      {empty ? (
        <div className="muted pad">No differences between these branches.</div>
      ) : (
        diff.spaces.map((sp) => (
          <div key={sp.space} className="diff-space">
            <div className="diff-space-head">space: {sp.space}</div>
            {sp.added.map((e) => (
              <Entry key={`a:${e.key}`} entry={e} kind="added" branchA={diff.branch_a} branchB={diff.branch_b} onCherryPick={onCherryPick} />
            ))}
            {sp.modified.map((e) => (
              <Entry key={`m:${e.key}`} entry={e} kind="modified" branchA={diff.branch_a} branchB={diff.branch_b} onCherryPick={onCherryPick} />
            ))}
            {sp.removed.map((e) => (
              <Entry key={`r:${e.key}`} entry={e} kind="removed" branchA={diff.branch_a} branchB={diff.branch_b} />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
