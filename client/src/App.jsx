import { Navigate, Route, Routes, Link } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Login from './pages/Login.jsx';
import VoterHome from './pages/VoterHome.jsx';
import Vote from './pages/Vote.jsx';
import Results from './pages/Results.jsx';
import Admin from './pages/admin/Admin.jsx';

function Guard({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function Header() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <header className="topbar">
      <Link to="/" className="brand">Online Voting</Link>
      <nav>
        {user.role === 'admin' && <Link to="/admin">Admin</Link>}
        <span className="who">{user.name}</span>
        <button className="link" onClick={logout}>Sign out</button>
      </nav>
    </header>
  );
}

export default function App() {
  const { user } = useAuth();
  return (
    <>
      <Header />
      <main className="page">
        <Routes>
          <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace /> : <Login />} />
          <Route path="/" element={<Guard><VoterHome /></Guard>} />
          <Route path="/vote/:id" element={<Guard role="voter"><Vote /></Guard>} />
          <Route path="/results/:id" element={<Guard><Results /></Guard>} />
          <Route path="/admin" element={<Guard role="admin"><Admin /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
