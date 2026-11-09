import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';

export default function Vote() {
  const { id } = useParams();
  const [e, setE] = useState(null);
  const [choice, setChoice] = useState('');
  const [step, setStep] = useState('choose');
  const [receipt, setReceipt] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api(`/elections/${id}`).then(setE).catch((x) => setError(x.message)); }, [id]);

  if (!e) return error ? <p className="error">{error}</p> : <p className="muted">Loading ballot…</p>;

  if (step !== 'done' && (e.voted || e.status !== 'open')) {
    return (
      <div className="panel">
        <h1>{e.title}</h1>
        <p>{e.voted ? 'You have already voted in this election.' : 'This election is not open for voting.'}</p>
        <Link className="button" to="/">Back to elections</Link>
      </div>
    );
  }

  const picked = e.options.find((o) => o.id === choice);

  const cast = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api(`/elections/${id}/vote`, { method: 'POST', body: { optionId: choice } });
      setReceipt(res.receipt);
      setStep('done');
    } catch (x) { setError(x.message); setStep('choose'); }
    setBusy(false);
  };

  if (step === 'done') {
    return (
      <div className="stub">
        <h1>Your vote is recorded</h1>
        <p>Keep this receipt code. It lets you confirm later that your ballot was counted, and it does not reveal your choice.</p>
        <p className="receipt">{receipt}</p>
        <Link className="button primary" to="/">Back to elections</Link>
      </div>
    );
  }

  return (
    <div className="ballot">
      <h1>{e.title}</h1>
      <p className="muted">{e.description}</p>

      {step === 'choose' && (
        <>
          <fieldset>
            <legend>{e.kind === 'proposal' ? 'Mark one answer' : 'Mark one candidate'}</legend>
            {e.options.map((o) => (
              <label key={o.id} className={`option ${choice === o.id ? 'marked' : ''}`}>
                <input type="radio" name="option" value={o.id} checked={choice === o.id} onChange={() => setChoice(o.id)} />
                <span className="bubble" aria-hidden="true" />
                <span>
                  <strong>{o.name}</strong>
                  {o.description && <small>{o.description}</small>}
                </span>
              </label>
            ))}
          </fieldset>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary" disabled={!choice} onClick={() => setStep('review')}>Review your choice</button>
        </>
      )}

      {step === 'review' && (
        <div className="panel">
          <h2>Confirm your vote</h2>
          <p>You are voting for <strong>{picked.name}</strong>. You cannot change your vote after you cast it.</p>
          <div className="row">
            <button onClick={() => setStep('choose')} disabled={busy}>Change choice</button>
            <button className="primary" onClick={cast} disabled={busy}>{busy ? 'Casting…' : 'Cast vote'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
