import { useEffect, useState } from 'react';
import { api } from '../../api';
import { fmt } from '../../util';

export default function AuditLog() {
  const [rows, setRows] = useState([]);
  const [check, setCheck] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api('/admin/audit').then(setRows).catch((e) => setError(e.message)); }, []);

  const verify = async () => {
    try { setCheck(await api('/admin/audit/verify')); } catch (e) { setError(e.message); }
  };

  return (
    <section className="panel">
      <div className="between">
        <h2>Audit trail</h2>
        <button onClick={verify}>Verify chain</button>
      </div>
      <p className="muted">Each entry includes the hash of the one before it, so any edit or deletion breaks the chain. The latest 100 entries are shown.</p>
      {check && (
        <p className={check.ok ? 'ok' : 'error'} role="status">
          {check.ok ? `Chain intact. ${check.checked} entries verified.` : `Chain broken at entry ${check.brokenAt}.`}
        </p>
      )}
      {error && <p className="error">{error}</p>}
      <div className="scroll">
        <table>
          <thead><tr><th>#</th><th>Time</th><th>Action</th><th>Actor</th><th>Details</th><th>Hash</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.seq}>
                <td>{a.seq}</td><td>{fmt(a.at)}</td><td>{a.action}</td><td>{a.actor}</td>
                <td className="small">{a.details && Object.keys(a.details).length ? JSON.stringify(a.details) : '-'}</td>
                <td className="hash">{a.hash.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
