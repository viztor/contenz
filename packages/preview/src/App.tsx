import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useParams, useLocation } from 'react-router-dom';
import { LayoutDashboard, Folder, FileText, AlertCircle, CheckCircle2, ChevronRight, FileJson } from 'lucide-react';

// --- Types ---
type CollectionInfo = { name: string; path: string; count: number };
type ListItemInfo = { slug: string; path: string; locale?: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ViewResult = { slug: string; locale?: string; file: string; meta: any; body?: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LintResult = { success: boolean; diagnostics: any[]; errors: number; warnings: number };
type StatusResult = { status: 'up-to-date' | 'needs-build'; dirtyCollections: string[] };

// --- Layout ---
function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [collections, setCollections] = useState<CollectionInfo[]>([]);

  useEffect(() => {
    fetch('/api/list').then(res => res.json()).then(data => {
      if (data.collections) setCollections(data.collections);
    });
  }, []);

  return (
    <div id="root">
      <aside className="sidebar">
        <h1><LayoutDashboard size={24} /> Contenz</h1>
        
        <nav style={{ marginTop: '2rem' }}>
          <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
            <LayoutDashboard size={18} /> Dashboard
          </Link>
          <div style={{ marginTop: '2rem', marginBottom: '0.5rem', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
            Collections
          </div>
          {collections.map(c => (
            <Link 
              key={c.name} 
              to={`/c/${c.name}`}
              className={`nav-link ${location.pathname.startsWith(`/c/${c.name}`) ? 'active' : ''}`}
            >
              <Folder size={18} /> {c.name}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

// --- Dashboard View ---
function Dashboard() {
  const [data, setData] = useState<{ lint?: LintResult, status?: StatusResult } | null>(null);

  useEffect(() => {
    fetch('/api/status').then(res => res.json()).then(setData);
  }, []);

  if (!data) return <div className="loader-container"><div className="loader"></div></div>;

  const { lint, status } = data;
  const isHealthy = lint?.success && status?.status === 'up-to-date';

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Workspace Overview</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Review content validation status across all collections.</p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isHealthy ? <CheckCircle2 color="var(--success)" /> : <AlertCircle color="var(--danger)" />}
            System Health
          </div>
          <div className="card-desc" style={{ marginTop: '1rem', fontSize: '1.1rem' }}>
            {isHealthy ? "All content valid and up to date." : "Issues detected in workspace."}
          </div>
        </div>
        
        <div className="card">
          <div className="card-title">Validation Errors</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: lint?.errors ? 'var(--danger)' : 'var(--success)' }}>
            {lint?.errors || 0}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Pending Changes</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: status?.status === 'needs-build' ? 'var(--accent)' : 'var(--success)' }}>
            {status?.dirtyCollections?.length || 0}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Collections dirty</div>
        </div>
      </div>
    </div>
  );
}

// --- Collection View ---
function CollectionView() {
  const { name } = useParams();
  const [items, setItems] = useState<ListItemInfo[] | null>(null);

  useEffect(() => {
    fetch(`/api/list?collection=${name}`).then(res => res.json()).then(data => {
      setItems(data.items || []);
    });
  }, [name]);

  if (!items) return <div className="loader-container"><div className="loader"></div></div>;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          <Folder size={16} /> {name}
        </div>
        <h2 className="page-title">{items.length} Items</h2>
      </div>

      <div className="grid">
        {items.map(item => (
          <Link key={item.slug} to={`/c/${name}/${item.slug}`} className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} color="var(--accent)" />
              {item.slug}
            </div>
            <div className="card-desc">
              {item.path}
            </div>
            <div className="card-meta">
              <span className="badge neutral">JSON / MDX</span>
              {item.locale && <span className="badge neutral">{item.locale}</span>}
            </div>
          </Link>
        ))}
        {items.length === 0 && (
          <div style={{ color: 'var(--text-muted)' }}>No items found in this collection.</div>
        )}
      </div>
    </div>
  );
}

// --- Item View ---
function ItemView() {
  const { name, slug } = useParams();
  const [item, setItem] = useState<ViewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/view?collection=${name}&slug=${slug}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setItem(data.data); // runView returns { success: true, data: ViewResult }
      })
      .catch(err => setError(err.message));
  }, [name, slug]);

  if (error) {
    return (
      <div className="error-banner">
        <AlertCircle size={24} />
        <div>
          <strong>Failed to load content</strong>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!item) return <div className="loader-container"><div className="loader"></div></div>;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          <Link to={`/c/${name}`} style={{ color: 'inherit', textDecoration: 'none' }}><Folder size={16} /> {name}</Link>
          <ChevronRight size={14} />
          <FileText size={16} /> {slug}
        </div>
        <h2 className="page-title">{slug}</h2>
        <div className="details-meta">
          <span className="badge neutral">{item.file}</span>
          {item.locale && <span className="badge neutral">Locale: {item.locale}</span>}
        </div>
      </div>

      <div className="content-section">
        <h3><FileJson size={16} style={{ display: 'inline', verticalAlign: 'text-bottom' }}/> Metadata (Frontmatter)</h3>
        <pre>{JSON.stringify(item.meta, null, 2)}</pre>
      </div>

      {item.body && (
        <div className="content-section">
          <h3><FileText size={16} style={{ display: 'inline', verticalAlign: 'text-bottom' }}/> Raw Body</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{item.body}</pre>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/c/:name" element={<CollectionView />} />
          <Route path="/c/:name/:slug" element={<ItemView />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
