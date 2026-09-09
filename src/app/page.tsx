"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ResearchResult, ResearchSource } from "@/lib/research/contracts";
import { ResearchResultSchema, type ResearchOptions } from "@/lib/research/contracts";
import ResearchOverview from "./research-overview";
import styles from "./page.module.css";

type Status = "verified" | "borderline" | "rejected";

type Candidate = {
  id: string;
  title: string;
  year: number | null;
  country: string;
  director: string;
  status: Status;
  confidence: number;
  thesis: string;
  dimensions: { label: string; met: boolean }[];
  evidence: {
    kind: string;
    purpose: string;
    sources?: ResearchSource[];
  }[];
  caveat: string;
};

const candidates: Candidate[] = [
  {
    id: "decision-to-leave",
    title: "Decision to Leave",
    year: 2022,
    country: "South Korea",
    director: "Park Chan-wook",
    status: "verified",
    confidence: 92,
    thesis:
      "Observation becomes a reciprocal emotional language: the detective watches, reconstructs, and imagines proximity until surveillance and courtship are difficult to separate.",
    dimensions: [
      { label: "Surveillance shapes the relationship", met: true },
      { label: "Visual perspective creates intimacy", met: true },
      { label: "Romantic connection is central", met: true },
    ],
    evidence: [
      {
        kind: "Filmmaker interview",
        purpose: "Primary-source discussion of point of view and mediated closeness.",
      },
      {
        kind: "Critical essay",
        purpose: "Independent analysis connecting observation to romantic desire.",
      },
      {
        kind: "Cinematography analysis",
        purpose: "Evidence for how framing collapses physical distance.",
      },
    ],
    caveat:
      "The film also uses surveillance as procedural investigation, so the final brief must distinguish what makes particular scenes relational.",
  },
  {
    id: "rear-window",
    title: "Rear Window",
    year: 1954,
    country: "United States",
    director: "Alfred Hitchcock",
    status: "verified",
    confidence: 84,
    thesis:
      "Looking begins as avoidance inside the central relationship, then becomes an activity through which the couple negotiates trust, risk, and commitment.",
    dimensions: [
      { label: "Surveillance shapes the relationship", met: true },
      { label: "Visual perspective creates intimacy", met: true },
      { label: "Romantic connection is central", met: true },
    ],
    evidence: [
      {
        kind: "Archival interview",
        purpose: "Primary evidence about the film's restricted visual perspective.",
      },
      {
        kind: "Scholarly analysis",
        purpose: "Interpretation of looking, desire, and the couple's changing bond.",
      },
    ],
    caveat:
      "Its canonical status can dominate the result set; the agent should use it as an anchor rather than a substitute for discovery.",
  },
  {
    id: "cache",
    title: "Caché",
    year: 2005,
    country: "France / Austria",
    director: "Michael Haneke",
    status: "borderline",
    confidence: 58,
    thesis:
      "Surveillance exposes fractures in domestic trust, but the evidence supports guilt and estrangement more strongly than romantic intimacy.",
    dimensions: [
      { label: "Surveillance shapes the relationship", met: true },
      { label: "Visual perspective creates intimacy", met: false },
      { label: "Romantic connection is central", met: false },
    ],
    evidence: [
      {
        kind: "Director interview",
        purpose: "Primary context for ambiguity, spectatorship, and responsibility.",
      },
      {
        kind: "Critical analysis",
        purpose: "Evidence about surveillance destabilizing the domestic relationship.",
      },
    ],
    caveat:
      "Keep only if the inquiry expands from intimacy to the effect of observation on an existing couple.",
  },
  {
    id: "the-conversation",
    title: "The Conversation",
    year: 1974,
    country: "United States",
    director: "Francis Ford Coppola",
    status: "rejected",
    confidence: 21,
    thesis:
      "Surveillance is central, but it produces professional obsession, guilt, and paranoia rather than a romantic relationship.",
    dimensions: [
      { label: "Surveillance shapes the relationship", met: false },
      { label: "Visual perspective creates intimacy", met: false },
      { label: "Romantic connection is central", met: false },
    ],
    evidence: [
      {
        kind: "Production history",
        purpose: "Context for the film's interest in recording and interpretation.",
      },
      {
        kind: "Critical consensus",
        purpose: "Evidence that paranoia—not intimacy—is the dominant function.",
      },
    ],
    caveat:
      "Useful as a negative control: it matches the obvious keyword but fails the actual research brief.",
  },
];

const statusCopy: Record<Status, string> = {
  verified: "Verified",
  borderline: "Borderline",
  rejected: "Rejected",
};

const sampleQueries = [
  {
    topic: "Sound and tension",
    question:
      "Find films that build tension through sound and off-screen space, with little or no visible violence.",
  },
  {
    topic: "Friendship",
    question:
      "Find coming-of-age films where friendship—not romance—is the relationship that changes the protagonist.",
  },
  {
    topic: "Cities after dark",
    question:
      "Find films that make a familiar city feel alien by restricting most of the story to a single night.",
  },
  {
    topic: "Family and food",
    question:
      "Find films where preparing or sharing food reveals a family conflict that the characters never explain aloud.",
  },
  {
    topic: "Memory",
    question:
      "Find science-fiction films where memory is treated as something people edit or negotiate—not simply something they lose.",
  },
] as const;

function candidatesFromResult(result: ResearchResult): Candidate[] {
  const sources = new Map(result.sources.map((source) => [source.id, source]));
  return result.candidates.map((candidate) => ({
    id: candidate.id,
    title: candidate.title,
    year: candidate.year,
    country: candidate.country || "Country not established",
    director: candidate.director || "Director not established",
    status: candidate.status,
    confidence: candidate.confidence,
    thesis: candidate.thesis,
    dimensions: candidate.dimensions.map(({ label, met }) => ({ label, met })),
    evidence: candidate.evidence.map((item) => ({
      kind: item.kind,
      purpose: item.claim,
      sources: item.sourceIds
        .map((sourceId) => sources.get(sourceId))
        .filter((source): source is ResearchSource => Boolean(source)),
    })),
    caveat: candidate.caveat,
  }));
}

export default function Home() {
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [selectedId, setSelectedId] = useState(candidates[0].id);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [sampleIndex, setSampleIndex] = useState(0);
  const [questionDraft, setQuestionDraft] = useState<string>(sampleQueries[0].question);
  const [editingQuestion, setEditingQuestion] = useState(false);
  const [running, setRunning] = useState(false);
  const [researchError, setResearchError] = useState("");
  const [refinement, setRefinement] = useState("");
  const [lastRefinement, setLastRefinement] = useState("");
  const [options, setOptions] = useState<ResearchOptions>({ mode: "discover", multilingual: false });
  const [storageNotice, setStorageNotice] = useState("");

  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        const stored = localStorage.getItem("cinematic-research-v2");
        if (!stored) return;
        const saved = ResearchResultSchema.parse(JSON.parse(stored));
        if (!saved.candidates.length) return;
        setResult(saved);
        setQuestionDraft(saved.query);
        setSelectedId(saved.candidates[0].id);
        if (saved.options) setOptions(saved.options);
        setStorageNotice("Restored your last investigation.");
      } catch {
        setStorageNotice("The saved investigation could not be restored. You can start a new one.");
      }
    });
  }, []);

  const activeSample = sampleQueries[sampleIndex];

  useEffect(() => {
    if (
      result ||
      editingQuestion ||
      running ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      setSampleIndex((current) => (current + 1) % sampleQueries.length);
    }, 6_500);

    return () => window.clearInterval(interval);
  }, [editingQuestion, result, running]);

  const displayedCandidates = useMemo(
    () => (result ? candidatesFromResult(result) : candidates),
    [result],
  );

  const visibleCandidates = useMemo(
    () =>
      filter === "all"
        ? displayedCandidates
        : displayedCandidates.filter((candidate) => candidate.status === filter),
    [displayedCandidates, filter],
  );

  const selected =
    displayedCandidates.find((candidate) => candidate.id === selectedId) ??
    displayedCandidates[0];

  async function executeResearch(query: string) {
    setRunning(true);
    setResearchError("");
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, options }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "The research run failed.");
      }
      const nextResult = ResearchResultSchema.parse(payload);
      setResult(nextResult);
      setQuestionDraft(nextResult.query);
      setSelectedId(nextResult.candidates[0].id);
      setFilter("all");
      setEditingQuestion(false);
      try {
        localStorage.setItem("cinematic-research-v2", JSON.stringify(nextResult));
        setStorageNotice("Saved in this browser.");
      } catch {
        setStorageNotice("Results are available, but browser storage is unavailable.");
      }
    } catch (error) {
      setResearchError(
        error instanceof Error ? error.message : "The research run failed.",
      );
    } finally {
      setRunning(false);
    }
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = questionDraft.trim();
    if (query.length < 20) {
      setResearchError("Write a more specific cinematic question before researching.");
      return;
    }
    void executeResearch(query);
  }

  function submitRefinement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = refinement.trim();
    if (!value) return;
    setLastRefinement(value);
    setRefinement("");
    void executeResearch(`${result?.query ?? questionDraft}\n\nRefinement: ${value}`);
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <a className={styles.identity} href="#top" aria-label="Cinematic research home">
          <span className={styles.mark} aria-hidden="true">
            CR
          </span>
          <span>
            <strong>Cinematic research</strong>
            <small>Reference workspace</small>
          </span>
        </a>
        <div className={styles.topbarActions}>
          <span className={styles.prototypeLabel}>{storageNotice || "Research workspace"}</span>
          <button
            className={styles.newInquiry}
            type="button"
            onClick={() => {
              setResult(null);
              setEditingQuestion(false);
              setQuestionDraft(activeSample.question);
              setResearchError("");
            }}
          >
            New inquiry
          </button>
        </div>
      </header>

      <section className={styles.inquiry} id="top" aria-labelledby="inquiry-title">
        <div className={styles.inquiryLead}>
          <h1 id="inquiry-title">Investigate a cinematic idea.</h1>
          <p>
            Describe the quality you are looking for. The agent turns it into a brief,
            researches possible references, and shows why each one survives scrutiny.
          </p>
        </div>

        <div className={styles.questionBlock}>
          <fieldset className={styles.modeControls} disabled={running}>
            <legend>Research settings</legend>
            <label>Mode
              <select value={options.mode} onChange={(event) => setOptions({ ...options, mode: event.target.value as ResearchOptions["mode"] })}>
                <option value="discover">Discover references</option>
                <option value="lineage">Trace a lineage</option>
              </select>
            </label>
            <label><input type="checkbox" checked={options.multilingual} onChange={(event) => setOptions({ ...options, multilingual: event.target.checked })} /> Include original-language sources</label>
          </fieldset>
          {running && <p role="status">Researching and checking sources. This may take several minutes.</p>}
          {researchError && !editingQuestion && <p role="alert" className={styles.researchError}>{researchError}</p>}
          {editingQuestion ? (
            <form className={styles.questionForm} onSubmit={submitQuestion}>
              <label htmlFor="research-question">Cinematic research question</label>
              <textarea
                id="research-question"
                value={questionDraft}
                onChange={(event) => setQuestionDraft(event.target.value)}
                placeholder="Describe a cinematic quality, precedent, or creative problem to investigate."
                autoFocus
              />
              <div className={styles.questionActions}>
                <button type="submit" disabled={running}>
                  {running ? "Researching…" : "Build research brief"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingQuestion(false);
                    setQuestionDraft(result?.query ?? activeSample.question);
                    setResearchError("");
                  }}
                >
                  Cancel
                </button>
              </div>
              {researchError ? (
                <p className={styles.researchError} role="alert">{researchError}</p>
              ) : null}
            </form>
          ) : (
            result ? (
              <>
                <p className={styles.question}>{result.query}</p>
                <button
                  type="button"
                  className={styles.editQuestion}
                  onClick={() => setEditingQuestion(true)}
                >
                  Research another question
                </button>
              </>
            ) : (
              <div className={styles.questionReel}>
                <div className={styles.reelHeader}>
                  <span>Try a research question</span>
                  <span>{sampleIndex + 1} of {sampleQueries.length}</span>
                </div>
                <p className={styles.question} key={sampleIndex}>
                  {activeSample.question}
                </p>
                <div className={styles.reelProgress} aria-hidden="true">
                  <span key={sampleIndex} />
                </div>
                <div className={styles.reelTopics} aria-label="Example research questions">
                  {sampleQueries.map((sample, index) => (
                    <button
                      key={sample.topic}
                      type="button"
                      className={index === sampleIndex ? styles.reelTopicActive : styles.reelTopic}
                      onClick={() => {
                        setSampleIndex(index);
                        setQuestionDraft(sample.question);
                      }}
                    >
                      {sample.topic}
                    </button>
                  ))}
                </div>
                <div className={styles.reelActions}>
                  <div className={styles.reelArrows}>
                    <button
                      type="button"
                      aria-label="Previous example"
                      onClick={() => setSampleIndex((sampleIndex - 1 + sampleQueries.length) % sampleQueries.length)}
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      aria-label="Next example"
                      onClick={() => setSampleIndex((sampleIndex + 1) % sampleQueries.length)}
                    >
                      →
                    </button>
                  </div>
                  <button
                    type="button"
                    className={styles.researchSample}
                    disabled={running}
                    onClick={() => void executeResearch(activeSample.question)}
                  >
                    {running ? "Researching…" : "Research this question"}
                  </button>
                  <button
                    type="button"
                    className={styles.editQuestion}
                    onClick={() => {
                      setQuestionDraft(activeSample.question);
                      setEditingQuestion(true);
                    }}
                  >
                    Write my own
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        <div className={styles.researchState} aria-label="Research state">
          <span><b>Brief</b> {running ? "being compiled" : result ? "ready" : "awaiting a question"}</span>
          <span><b>Search angles</b> {result?.metrics.searchAngles ?? 0}</span>
          <span><b>Sources retrieved</b> {result?.metrics.sourcesReviewed ?? 0}</span>
          <span><b>Candidates tested</b> {result?.metrics.candidatesTested ?? 0}</span>
        </div>
      </section>

      {result && <ResearchOverview result={result} onSelect={(id) => {
        setSelectedId(id);
        setFilter("all");
        document.getElementById("evidence-title")?.scrollIntoView({ block: "start" });
      }} />}
      {!result && <p className={styles.emptyState}>Choose a question above. Your brief, references and evidence will appear here when research completes.</p>}
      {result && <section className={styles.workspace} aria-label="Research workspace">
        <aside className={styles.brief} aria-labelledby="brief-title">
          <div className={styles.panelHeading}>
            <div>
              <p>Research brief</p>
              <h2 id="brief-title">What counts</h2>
            </div>
            <button type="button" className={styles.textButtonLight} onClick={() => setEditingQuestion(true)}>Revise question</button>
          </div>

          <div className={styles.briefSection}>
            <h3>Central idea</h3>
            <p>{result?.brief.centralIdea ?? "Sound and unseen space create tension without relying on visible violence."}</p>
          </div>

          <div className={styles.briefSection}>
            <h3>Include when</h3>
            <ul>
              {(result?.brief.includeWhen ?? [
                "Sound carries narrative information.",
                "Off-screen space shapes the audience's expectations.",
                "Sources support the interpretation.",
              ]).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>

          <div className={styles.briefSection}>
            <h3>Exclude when</h3>
            <ul>
              {(result?.brief.excludeWhen ?? [
                "Visible violence is the primary source of tension.",
                "The connection is based on genre tags.",
                "The agent cannot find supporting evidence.",
              ]).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>

          <div className={styles.sourceStandard}>
            <span>Evidence standard</span>
            <strong>{result?.brief.evidenceStandard ?? "Two independent sources, including one primary or scholarly source"}</strong>
          </div>
        </aside>

        <section className={styles.ledger} aria-labelledby="ledger-title">
          <div className={styles.panelHeadingDark}>
            <div>
              <p>Candidate ledger</p>
              <h2 id="ledger-title">What survived</h2>
            </div>
            <span>{visibleCandidates.length} shown</span>
          </div>

          <div className={styles.filters} aria-label="Filter candidates">
            {(["all", "verified", "borderline", "rejected"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={filter === value ? styles.filterActive : styles.filter}
                onClick={() => setFilter(value)}
              >
                {value === "all" ? "All candidates" : statusCopy[value]}
              </button>
            ))}
          </div>

          <div className={styles.candidates}>
            {visibleCandidates.map((candidate) => (
              <button
                type="button"
                key={candidate.id}
                className={`${styles.candidate} ${
                  selected.id === candidate.id ? styles.candidateSelected : ""
                }`}
                onClick={() => setSelectedId(candidate.id)}
              >
                <span className={`${styles.statusRule} ${styles[candidate.status]}`} />
                <span className={styles.candidateBody}>
                  <span className={styles.candidateMeta}>
                    {candidate.year ?? "Year unknown"} · {candidate.country}
                  </span>
                  <strong>{candidate.title}</strong>
                  <span>{statusCopy[candidate.status]}</span>
                  <span className={styles.director}>{candidate.director}</span>
                  <span className={styles.candidateThesis}>{candidate.thesis}</span>
                </span>
                <span className={styles.score}>
                  <b>{candidate.confidence}</b>
                  <small title="Model estimate; not a calibrated probability or match score">decision confidence</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <aside className={styles.evidence} aria-labelledby="evidence-title">
          <div className={styles.panelHeadingDark}>
            <div>
              <p>Evidence inspector</p>
              <h2 id="evidence-title">Why it qualifies</h2>
            </div>
            <span className={`${styles.statusPill} ${styles[selected.status]}`}>
              {statusCopy[selected.status]}
            </span>
          </div>

          <div className={styles.evidenceIntro}>
            <p className={styles.filmMeta}>
              {selected.director}, {selected.year ?? "year unknown"}
            </p>
            <h3>{selected.title}</h3>
            <p>{selected.thesis}</p>
          </div>

          <div className={styles.dimensionList}>
            {selected.dimensions.map((dimension) => (
              <div key={dimension.label} className={styles.dimension}>
                <span aria-hidden="true">{dimension.met ? "●" : "○"}</span>
                <p>{dimension.label}</p>
                <small>{dimension.met ? "Supported" : "Not established"}</small>
              </div>
            ))}
          </div>

          <div className={styles.evidenceSources}>
            <h3>Supporting evidence</h3>
            {selected.evidence.map((evidence, index) => (
              <article key={`${selected.id}-${evidence.kind}-${index}`}>
                <strong>{evidence.kind}</strong>
                <p>{evidence.purpose}</p>
                {evidence.sources?.length ? (
                  <div className={styles.allSources}>{evidence.sources.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</div>
                ) : (
                  <span>Illustrative evidence</span>
                )}
              </article>
            ))}
          </div>

          <div className={styles.caveat}>
            <strong>Research caveat</strong>
            <p>{selected.caveat}</p>
          </div>
        </aside>
      </section>}

      {result && <section className={styles.refine} aria-labelledby="refine-title">
        <div>
          <h2 id="refine-title">Refine the investigation</h2>
          <p>Add a condition and run a fresh investigation using your question.</p>
        </div>
        <form onSubmit={submitRefinement} className={styles.refineForm}>
          <label htmlFor="refinement">Add a constraint or challenge a result</label>
          <div>
            <input
              id="refinement"
              value={refinement}
              onChange={(event) => setRefinement(event.target.value)}
              placeholder="For example: exclude English-language films"
            />
            <button type="submit" disabled={running}>
              {running ? "Researching…" : "Apply refinement"}
            </button>
          </div>
          {lastRefinement ? (
            <p className={styles.refinementReceipt} role="status">
              {researchError
                ? researchError
                : `Research updated with: “${lastRefinement}”`}
            </p>
          ) : null}
        </form>
      </section>}

      <footer className={styles.footer}>
        <p>
          Example content is shown until you run a live Gemini and Parallel investigation.
        </p>
      </footer>
    </main>
  );
}
