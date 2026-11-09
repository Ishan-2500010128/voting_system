import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { fmt } from '../util';
import { useAuth } from '../AuthContext.jsx';

function Action({ e, isVoter }) {
  if (e.status === 'open' && isVoter) {
    return e.voted
      ? <span className="badge done">Vote recorded</span>
      : <Link className="button primary" to={`/vote/${e.id}`}>Vote now</Link>;
  }
  if (e.status === 'upcoming') return <span className="muted">Opens {fmt(e.startsAt)}</span>;
  if (e.status === 'closed' && e.resultsPublished) return <Link className="button" to={`/results/${e.id}`}>See results</Link>;
  if (e.status === 'closed') return <span className="muted">Results not published yet</span>;
  return null;
}

function ReceiptCheck({ elections }) {
  const mine = elections.filter((e) => e.voted);
  const [id, setId] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState(null);
  if (!mine.length) return null;

  const check = async (ev) => {
    ev.preventDefault();
    try {
      const { counted } = await api(`/elections/${id || mine[0].id}/receipt/${encodeURIComponent(code.trim())}`);
      setMsg(counted
        ? { ok: true, text: 'Your ballot is in the count.' }
        : { ok: false, text: 'No ballot matches that code in this election. Check the code and try again.' });
    } catch (err) { setMsg({ ok: false, text: err.message }); }
  };

  return (
    <section className="panel">
      <h2>Check your receipt</h2>
      <p className="muted">Enter the receipt code you were given to confirm your ballot was counted. The code never reveals your choice.</p>
      <form onSubmit={check} className="row">
        <select value={id || mine[0].id} onChange={(e) => setId(e.target.value)} aria-label="Election">
          {mine.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" required />
        <button>Check receipt</button>
      </form>
      {msg && <p className={msg.ok ? 'ok' : 'error'} role="status">{msg.text}</p>}
    </section>
  );
}

export default function VoterHome() {
  const { user } = useAuth();
  const [els, setEls] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api('/elections').then(setEls).catch((e) => setError(e.message)); }, []);

  if (error) return <p className="error">{error}</p>;
  if (!els) return <p className="muted">Loading elections…</p>;

  const order = { open: 0, upcoming: 1, closed: 2 };
  const sorted = [...els].sort((a, b) => order[a.status] - order[b.status]);

  return (
    <>
      <h1>Elections</h1>
      {!sorted.length && <p className="muted">No elections have been scheduled yet.</p>}
      <ul className="elections">
        {sorted.map((e) => (
          <li key={e.id} className="election">
            <div>
              <span className={`badge ${e.status}`}>{e.status}</span>
              <h2>{e.title}</h2>
              <p className="muted">{e.description}</p>
              <p className="small">{fmt(e.startsAt)} to {fmt(e.endsAt)}</p>
            </div>
            <Action e={e} isVoter={user.role === 'voter'} />
          </li>
        ))}
      </ul>
      {user.role === 'voter' && <ReceiptCheck elections={sorted} />}
    </>
  );
}
