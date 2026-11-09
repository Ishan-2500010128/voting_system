import { useEffect, useState } from 'react';
import { api } from '../../api';
import { fmt } from '../../util';

export default function Monitor() {
  const [stats, setStats] = useState(null);
  const [feed, setFeed] = useState([]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const load = () => api('/admin/stats').then(setStats).catch(() => {});
    load();
    const timer = setInterval(load, 15000);
    const es = new EventSource('/api/admin/stream?token=' + encodeURIComponent(localStorage.getItem('token')));
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.onmessage = (m) => { setFeed((f) => [JSON.parse(m.data), ...f].slice(0, 30)); load(); };
    return () => { clearInterval(timer); es.close(); };
  }, []);

  if (!stats) return <p className="muted">Loading…</p>;

  return (
    <>
      <p className="muted">{stats.eligible} active voters. {stats.auditEntries} audit entries. Live feed: {live ? 'connected' : 'reconnecting…'}</p>
      <section className="panel">
        <h2>Turnout</h2>
        {!stats.elections.length && <p className="muted">No elections yet. Create one in the Elections tab.</p>}
        {stats.elections.map((e) => {
          const pct = stats.eligible ? Math.min(100, Math.round((e.votes / stats.eligible) * 100)) : 0;
          return (
            <div key={e.id} className="turnout">
              <div className="between"><strong>{e.title}</strong><span><span className={`badge ${e.status}`}>{e.status}</span> {e.votes} of {stats.eligible} voted ({pct}%)</span></div>
              <div className="bar"><div style={{ width: `${pct}%` }} /></div>
            </div>
          );
        })}
      </section>
      <section className="panel">
        <h2>Live activity</h2>
        {!feed.length && <p className="muted">New activity appears here as it happens.</p>}
        <ul className="feed">
          {feed.map((a) => (
            <li key={a.seq}><span className="small">{fmt(a.at)}</span> <strong>{a.action}</strong> by {a.actor}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
