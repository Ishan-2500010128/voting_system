import { useState } from 'react';
import Monitor from './Monitor.jsx';
import Voters from './Voters.jsx';
import ElectionsAdmin from './ElectionsAdmin.jsx';
import AuditLog from './AuditLog.jsx';

const tabs = [
  ['Monitor', Monitor],
  ['Elections', ElectionsAdmin],
  ['Voters', Voters],
  ['Audit trail', AuditLog],
];

export default function Admin() {
  const [active, setActive] = useState(0);
  const Tab = tabs[active][1];
  return (
    <>
      <h1>Election administration</h1>
      <div className="tabs" role="tablist">
        {tabs.map(([name], i) => (
          <button key={name} role="tab" aria-selected={i === active} className={i === active ? 'on' : ''} onClick={() => setActive(i)}>{name}</button>
        ))}
      </div>
      <Tab />
    </>
  );
}
