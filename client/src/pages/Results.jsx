import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';

export default function Results() {
  const { id } = useParams();
  const [e, setE] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api(`/elections/${id}`).then(setE).catch((x) => setError(x.message)); }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!e) return <p className="muted">Loading results…</p>;
  if (!e.resultsPublished) {
    return (
      <div className="panel">
        <h1>{e.title}</h1>
        <p>Results have not been published yet.</p>
        <Link className="button" to="/">Back to elections</Link>
      </div>
    );
  }

  const top = Math.max(...e.results.map((r) => r.votes));
  const leaders = e.results.filter((r) => r.votes === top && top > 0);

  return (
    <>
      <h1>{e.title}</h1>
      <p className="muted">{e.totalVotes} ballots counted.{leaders.length > 1 && ' The top result is a tie.'}</p>
      <ul className="results">
        {e.results.map((r) => {
          const pct = e.totalVotes ? Math.round((r.votes / e.totalVotes) * 100) : 0;
          const lead = leaders.some((l) => l.optionId === r.optionId);
          return (
            <li key={r.optionId} className={lead ? 'lead' : ''}>
              <div className="between"><strong>{r.name}</strong><span>{r.votes} votes ({pct}%)</span></div>
              <div className="bar"><div style={{ width: `${pct}%` }} /></div>
            </li>
          );
        })}
      </ul>
      <Link className="button" to="/">Back to elections</Link>
    </>
  );
}
