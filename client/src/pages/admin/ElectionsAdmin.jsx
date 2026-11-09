import { useEffect, useState } from 'react';
import { api } from '../../api';
import { fmt, toLocalInput, fromLocalInput } from '../../util';

const PROPOSAL_DEFAULT = 'Yes\nNo\nAbstain';

function Schedule({ e, onSaved }) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(toLocalInput(e.startsAt));
  const [en, setEn] = useState(toLocalInput(e.endsAt));
  const [error, setError] = useState('');

  const save = async () => {
    try {
      await api(`/admin/elections/${e.id}/schedule`, { method: 'PATCH', body: { startsAt: fromLocalInput(s), endsAt: fromLocalInput(en) } });
      setOpen(false); setError(''); onSaved();
    } catch (err) { setError(err.message); }
  };

  if (!open) return <button onClick={() => setOpen(true)}>Edit schedule</button>;
  return (
    <div className="stack">
      <div className="row">
        <label>Opens<input type="datetime-local" value={s} onChange={(x) => setS(x.target.value)} /></label>
        <label>Closes<input type="datetime-local" value={en} onChange={(x) => setEn(x.target.value)} /></label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row"><button className="primary" onClick={save}>Save schedule</button><button onClick={() => setOpen(false)}>Cancel</button></div>
    </div>
  );
}

export default function ElectionsAdmin() {
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '', description: '', kind: 'candidates', options: '',
    startsAt: toLocalInput(new Date()),
    endsAt: toLocalInput(new Date(Date.now() + 86400_000)),
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const load = () => api('/elections').then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const changeKind = (e) => {
    const kind = e.target.value;
    setForm({ ...form, kind, options: kind === 'proposal' && !form.options ? PROPOSAL_DEFAULT : form.options });
  };

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/admin/elections', {
        method: 'POST',
        body: {
          ...form,
          options: form.options.split('\n').map((x) => x.trim()).filter(Boolean),
          startsAt: fromLocalInput(form.startsAt),
          endsAt: fromLocalInput(form.endsAt),
        },
      });
      setForm({ ...form, title: '', description: '', options: '' });
      load();
    } catch (err) { setError(err.message); }
  };

  const publish = async (id) => {
    setError('');
    try { await api(`/admin/elections/${id}/publish`, { method: 'POST' }); load(); }
    catch (err) { setError(err.message); }
  };

  return (
    <>
      <section className="panel">
        <h2>Create an election</h2>
        <form onSubmit={create} className="stack">
          <label>Title<input value={form.title} onChange={set('title')} required /></label>
          <label>Description<input value={form.description} onChange={set('description')} /></label>
          <label>Type
            <select value={form.kind} onChange={changeKind}>
              <option value="candidates">Candidates</option>
              <option value="proposal">Proposal (yes / no)</option>
            </select>
          </label>
          <label>Options, one per line
            <textarea rows={4} value={form.options} onChange={set('options')} required />
          </label>
          <div className="row">
            <label>Opens<input type="datetime-local" value={form.startsAt} onChange={set('startsAt')} required /></label>
            <label>Closes<input type="datetime-local" value={form.endsAt} onChange={set('endsAt')} required /></label>
          </div>
          <button className="primary">Create election</button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      <section className="panel">
        <h2>All elections</h2>
        {!list.length && <p className="muted">No elections yet.</p>}
        <ul className="elections">
          {list.map((e) => (
            <li key={e.id} className="election">
              <div>
                <span className={`badge ${e.status}`}>{e.status}</span>
                <h3>{e.title}</h3>
                <p className="small">{fmt(e.startsAt)} to {fmt(e.endsAt)}</p>
                <p className="small">{e.options.map((o) => o.name).join(', ')}</p>
              </div>
              <div className="stack">
                {e.status !== 'closed' && <Schedule e={e} onSaved={load} />}
                {e.status === 'closed' && !e.resultsPublished && <button className="primary" onClick={() => publish(e.id)}>Publish results</button>}
                {e.resultsPublished && <span className="badge done">Results published</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
