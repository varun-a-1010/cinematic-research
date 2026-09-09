import type { ResearchResult } from "@/lib/research/contracts";
import styles from "./page.module.css";

export default function ResearchOverview({ result, onSelect }: {
  result: ResearchResult;
  onSelect: (id: string) => void;
}) {
  const context = result.context;
  const films = new Map(result.candidates.map((film) => [film.id, film]));
  const sources = new Map(result.sources.map((source) => [source.id, source]));
  function citations(ids: string[]) {
    return ids.map((id) => {
      const source = sources.get(id);
      return source ? <a key={id} href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : null;
    });
  }
  return <section className={styles.overview} aria-label="Research overview">
    <h2>References at a glance</h2>
    <p>Decisions and source categories are model assessments. Open the evidence to evaluate them.</p>
    <div className={styles.tableScroll}><table>
      <thead><tr><th>Film</th><th>Decision</th><th>Why it matters</th><th>Supporting evidence</th></tr></thead>
      <tbody>{result.candidates.map((film) => <tr key={film.id}>
        <td><button onClick={() => onSelect(film.id)}>{film.title}</button><small>{film.year ?? "Year unknown"} · {film.country}</small></td>
        <td>{film.status}</td><td>{film.thesis}</td>
        <td>{citations(film.evidence[0]?.sourceIds ?? [])}</td>
      </tr>)}</tbody>
    </table></div>
    {result.options?.mode === "lineage" && <>
      <h2>Cinematic timeline</h2>
      <p>Dates show release order. Connections require separate evidence; order alone does not establish influence.</p>
      <ol className={styles.timeline}>{[...result.candidates].sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity)).map((film) =>
        <li key={film.id}><time>{film.year ?? "Unknown year"}</time><div>
          <button onClick={() => onSelect(film.id)}>{film.title}</button>
          <p>{film.status} · {film.country}</p>
          {(context?.connections ?? []).filter((link) => link.toId === film.id).map((link, index) => <article key={index}>
            <strong>{link.kind} · {films.get(link.fromId)?.title}</strong>
            <p>{link.explanation}</p>{citations(link.sourceIds)}
          </article>)}
        </div></li>)}</ol>
      {!context?.connections.length && <p>No supported connections were established in this run.</p>}
    </>}
    {context && <details className={styles.coverage} open>
      <summary>Sources, language coverage and evidence gaps</summary>
      {context.coverage.map((item, index) => <p key={index}><strong>{item.language}: </strong>{item.finding} {item.sourceIds.length ? citations(item.sourceIds) : "No supporting source recorded."}</p>)}
      <ul>{context.gaps.map((gap, index) => <li key={index}>{gap}</li>)}</ul>
      {context.passages.map((passage, index) => <blockquote key={index}>
        <p>{passage.language} · Original passage: {passage.original}</p>
        <p>Model translation: {passage.translation}</p>{citations([passage.sourceId])}
      </blockquote>)}
      <details><summary>Source catalog ({result.sources.length} retrieved)</summary>
        {result.sources.map((source) => {
          const assessment = context.sources.find((item) => item.sourceId === source.id);
          return <article key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
            <p>{assessment?.category ?? "unverified"} · {assessment?.language ?? "Unknown language"}</p>
            <small>{assessment?.rationale ?? "Insufficient information to classify this source."}</small>
          </article>;
        })}
      </details>
    </details>}
  </section>;
}
