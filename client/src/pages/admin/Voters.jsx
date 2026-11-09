import { useEffect, useState } from 'react';
import { api } from '../../api';

export default function Voters() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ voterId: '', name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const load = () => api('/admin/voters').then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/admin/voters', { method: 'POST', body: form });
      setForm({ voterId: '', name: '', email: '', password: '' });
      load();
    } catch (err) { setError(err.message); }
  };

  const toggle = async (v) => {
    await api(`/admin/voters/${v.id}`, { method: 'PATCH', body: { active: !v.active } });
    load();
  };

  return (
    <>
      <section className="panel">
        <h2>Register a voter</h2>
        <form onSubmit={add} className="grid">
          <label>Voter ID<input value={form.voterId} onChange={set('voterId')} required /></label>
          <label>Full name<input value={form.name} onChange={set('name')} required /></label>
          <label>Email (optional)<input type="email" value={form.email} onChange={set('email')} /></label>
          <label>Temporary password<input type="password" value={form.password} onChange={set('password')} minLength={8} required /></label>
          <button className="primary">Register voter</button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
      </section>
      <section className="panel">
        <h2>Registered voters ({list.length})</h2>
        <div className="scroll">
          <table>
            <thead><tr><th>Voter ID</th><th>Name</th><th>Email</th><th>Status</th><th /></tr></thead>
            <tbody>
              {list.map((v) => (
                <tr key={v.id}>
                  <td>{v.voterId}</td><td>{v.name}</td><td>{v.email || '-'}</td>
                  <td>{v.active ? 'Active' : 'Deactivated'}</td>
                  <td><button onClick={() => toggle(v)}>{v.active ? 'Deactivate' : 'Reactivate'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
