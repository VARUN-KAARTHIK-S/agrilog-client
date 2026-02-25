import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { getCrops, createCrop, updateCrop, deleteCrop, getRecords, getAllRecords, createRecord, updateRecord, deleteRecord, getExpenses, createExpense, deleteExpense, login, signup } from './api';

const VEGETABLES = [
  { name: 'Tomato', icon: '🍅' },
];

export default function App() {
  const [view, setView] = useState('dashboard');        // dashboard | crops | detail
  const [currentVeg, setCurrentVeg] = useState(null);
  const [currentCrop, setCurrentCrop] = useState(null);
  const [crops, setCrops] = useState([]);
  const [records, setRecords] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [stats, setStats] = useState({ revenue: 0, boxes: 0, totalExpenses: 0 });
  const [darkMode, setDarkMode] = useState(localStorage.getItem('theme') === 'dark');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));

  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
      fetchStats();
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  useEffect(() => { if (user && currentVeg) fetchCrops(); }, [currentVeg, user]);
  useEffect(() => { if (user && currentCrop) fetchRecords(); }, [currentCrop, user]);

  const fetchStats = async () => {
    if (!user) return;
    try {
      const recRes = await getAllRecords(user._id);
      const expRes = await getExpenses(null, user._id);
      const allRecs = recRes.data;
      const allExps = expRes.data || [];

      const revenue = allRecs.filter(r => r.rate > 0).reduce((s, r) => s + r.total, 0);
      const totalExpenses = allExps.reduce((s, e) => s + (Number(e.amount) || 0), 0);

      setStats({
        revenue,
        boxes: allRecs.reduce((s, r) => s + r.boxes, 0),
        totalExpenses
      });
    } catch (err) { console.error(err); }
  };

  const fetchCrops = async () => {
    if (!user || !currentVeg) return;
    try {
      const res = await getCrops(currentVeg, user._id);
      setCrops(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchRecords = async () => {
    if (!user || !currentCrop) return;
    try {
      const res = await getRecords(currentCrop._id, user._id);
      setRecords(res.data);
      const expRes = await getExpenses(currentCrop._id, user._id);
      setExpenses(expRes.data);
    } catch (err) { console.error(err); }
  };

  // Navigation
  const openCrops = (veg) => { setCurrentVeg(veg); setView('crops'); };
  const openDetail = (crop) => { setCurrentCrop(crop); setView('detail'); };
  const goToCrops = () => { setView('crops'); setCurrentCrop(null); fetchCrops(); };
  const goToDashboard = () => { setView('dashboard'); setCurrentVeg(null); setCurrentCrop(null); fetchStats(); };

  // Crop actions
  const handleCreateCrop = async (data) => {
    console.log('🌱 Creating crop with data:', { veg: currentVeg, userId: user?._id, ...data });
    try {
      if (!user?._id) throw new Error('User not logged in');
      await createCrop({ veg: currentVeg, userId: user._id, ...data });
      fetchCrops();
      setIsCropModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Failed to create crop: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleUpdateCrop = async (id, data) => {
    try {
      await updateCrop(id, { ...data, userId: user._id });
      const res = await getCrops(currentVeg, user._id);
      setCrops(res.data);
      // Update current crop reference if we are looking at it
      if (currentCrop && currentCrop._id === id) {
        setCurrentCrop({ ...currentCrop, ...data });
      }
    } catch (err) { alert('Failed to update crop'); }
  };

  const handleDeleteCrop = async (id) => {
    if (window.confirm('Delete this crop and ALL its records?')) {
      try {
        await deleteCrop(id);
        fetchCrops();
        fetchStats();
      } catch (err) { alert('Failed to delete'); }
    }
  };

  // Record actions
  const handleSaveRecord = async (data) => {
    try {
      if (editingRecord) {
        await updateRecord(editingRecord._id, { ...data, userId: user._id, veg: currentVeg, cropId: currentCrop._id });
      } else {
        await createRecord({ ...data, userId: user._id, veg: currentVeg, cropId: currentCrop._id });
      }
      fetchRecords();
      fetchStats();
      setIsModalOpen(false);
      setEditingRecord(null);
    } catch (err) {
      console.error(err);
      alert('Failed to save record: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleEditRecord = (record) => {
    setEditingRecord(record);
    setIsModalOpen(true);
  };

  const handleDeleteRecord = async (id) => {
    if (window.confirm('Delete this record?')) {
      try {
        await deleteRecord(id);
        fetchRecords();
        fetchStats();
      } catch (err) { alert('Failed to delete'); }
    }
  };

  // Expense actions
  const handleCreateExpense = async (data) => {
    try {
      await createExpense({ ...data, userId: user._id, cropId: currentCrop._id });
      fetchRecords();
      fetchStats();
      setIsExpenseModalOpen(false);
    } catch (err) { alert('Failed to save expense'); }
  };

  const handleDeleteExpense = async (id) => {
    if (window.confirm('Delete this expense?')) {
      try {
        await deleteExpense(id);
        fetchRecords();
        fetchStats();
      } catch (err) { alert('Failed to delete expense'); }
    }
  };

  const handleExportData = async () => {
    try {
      const res = await getAllRecords(user._id);
      const data = res.data;
      const csv = [
        ['Date', 'Crop', 'Boxes', 'Rate', 'Commission', 'Net Total', 'Status'],
        ...data.map(r => [
          format(new Date(r.date), 'yyyy-MM-dd'),
          r.veg,
          r.boxes,
          r.rate,
          r.commission,
          r.total,
          r.rate > 0 ? 'Paid' : 'Pending'
        ])
      ].map(e => e.join(",")).join("\n");

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      a.setAttribute('download', `agrilog_report_${format(new Date(), 'yyyy_MM_dd')}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) { alert('Export failed'); }
  };

  if (!user) {
    return (
      <AuthView
        darkMode={darkMode}
        onLogin={(userData) => setUser(userData)}
      />
    );
  }

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      {/* Sidebar */}
      <nav className="sidebar">
        <div className="logo">
          <div className="logo-icon">🌿</div>
          <h1>AgriLog</h1>
        </div>
        <button className={`nav-btn ${view === 'dashboard' ? 'active' : ''}`} onClick={goToDashboard}>
          <span>📊</span> <span>Dashboard</span>
        </button>
        <button className={`nav-btn ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
          <span>⚙️</span> <span>Settings</span>
        </button>
        <div className="sidebar-footer">© {new Date().getFullYear()} AgriLog</div>
      </nav>

      {/* Main Content */}
      <main className="main">
        {view === 'dashboard' && (
          <Dashboard stats={stats} onSelect={openCrops} />
        )}
        {view === 'crops' && (
          <CropsView
            veg={currentVeg}
            crops={crops}
            onBack={goToDashboard}
            onSelect={openDetail}
            onAdd={() => setIsCropModalOpen(true)}
            onDelete={handleDeleteCrop}
            onToggleStatus={(id, status) => handleUpdateCrop(id, { status })}
          />
        )}
        {view === 'settings' && (
          <SettingsView
            darkMode={darkMode}
            onToggleTheme={() => setDarkMode(!darkMode)}
            onBack={goToDashboard}
            onLogout={() => { setUser(null); setView('dashboard'); }}
            onExport={handleExportData}
          />
        )}
        {view === 'detail' && (
          <Detail
            veg={currentVeg}
            crop={currentCrop}
            records={records}
            expenses={expenses}
            onBack={goToCrops}
            onAdd={() => { setEditingRecord(null); setIsModalOpen(true); }}
            onAddExpense={() => setIsExpenseModalOpen(true)}
            onEdit={handleEditRecord}
            onDelete={handleDeleteRecord}
            onDeleteExpense={handleDeleteExpense}
            onToggleStatus={(status) => handleUpdateCrop(currentCrop._id, { status })}
          />
        )}
      </main>

      {isCropModalOpen && (
        <CropModal
          veg={currentVeg}
          onClose={() => setIsCropModalOpen(false)}
          onSubmit={handleCreateCrop}
        />
      )}

      {isModalOpen && (
        <EntryModal
          veg={currentVeg}
          initialData={editingRecord}
          onClose={() => { setIsModalOpen(false); setEditingRecord(null); }}
          onSubmit={handleSaveRecord}
        />
      )}

      {isExpenseModalOpen && (
        <ExpenseModal
          onClose={() => setIsExpenseModalOpen(false)}
          onSubmit={handleCreateExpense}
        />
      )}
    </div>
  );
}

/* ===== AUTH VIEW (LOGIN / SIGNUP) ===== */
function AuthView({ darkMode, onLogin }) {
  const [isSignup, setIsSignup] = useState(false);
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isSignup) {
        await signup(form);
        setIsSignup(false);
        alert('Account created! Please login.');
      } else {
        const res = await login(form);
        onLogin(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`} style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div className="modal" style={{ animation: 'none', width: '380px', border: '1px solid var(--border-color)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="logo-icon" style={{ margin: '0 auto 1rem' }}>🌿</div>
          <h2 style={{ color: 'var(--green-dark)' }}>AgriLog</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {isSignup ? 'Create your farm account' : 'Welcome back to your diary'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div style={{ color: '#e53935', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>Username</label>
            <input
              type="text"
              required
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              placeholder="Enter username"
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label>Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Enter password"
            />
          </div>

          <button type="submit" className="btn btn-green" style={{ width: '100%', padding: '0.8rem' }}>
            {isSignup ? 'Sign Up' : 'Login'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {isSignup ? 'Already have an account?' : "Don't have an account?"}
          </span>
          <button
            onClick={() => setIsSignup(!isSignup)}
            style={{
              background: 'none', border: 'none', color: 'var(--green)',
              fontWeight: '650', marginLeft: '0.5rem', cursor: 'pointer'
            }}
          >
            {isSignup ? 'Login' : 'Signup'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== SETTINGS VIEW ===== */
function SettingsView({ darkMode, onToggleTheme, onBack, onLogout, onExport }) {
  return (
    <div className="fade-in">
      {/* Existing header */}
      <div className="detail-top">
        <div className="detail-left">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h2>Settings</h2>
        </div>
      </div>

      <div className="table-wrap" style={{ padding: '1.5rem' }}>
        {/* Theme Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h4 style={{ marginBottom: '0.25rem' }}>Dark Mode</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Easier on the eyes at night</p>
          </div>
          <button
            className={`btn ${darkMode ? 'btn-green' : 'btn-outline'}`}
            onClick={onToggleTheme}
            style={{ minWidth: '100px' }}
          >
            {darkMode ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>

        {/* Data Export */}
        <div style={{ borderTop: '1px solid var(--border-color)', margin: '1.5rem 0', padding: '1.5rem 0' }}>
          <h4 style={{ marginBottom: '0.25rem' }}>Data & Reports</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Download your harvest diary in Excel/CSV format</p>
          <button className="btn btn-green" onClick={onExport}>
            📥 Export Records (CSV)
          </button>
        </div>

        {/* Logout */}
        <div style={{ borderTop: '1px solid var(--border-color)', margin: '1.5rem 0', padding: '1.5rem 0' }}>
          <h4 style={{ marginBottom: '0.25rem' }}>Account</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Manage your farm profile</p>
          <button className="btn btn-outline" onClick={onLogout} style={{ color: '#e53935' }}>
            🏃 Logout
          </button>
        </div>

        {/* Version */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          <h4 style={{ marginBottom: '0.5rem' }}>App Version</h4>
          <p style={{ fontSize: '0.9rem' }}>v1.0.0 — 2026 Season Edition</p>
        </div>
      </div>
    </div>
  );
}

/* ===== DASHBOARD ===== */
function Dashboard({ stats, onSelect }) {
  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Track your farm harvest across all devices</p>
        </div>
        <div className="date-badge">{format(new Date(), 'dd MMM yyyy')}</div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div>
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value" style={{ color: 'var(--green)' }}>₹{stats.revenue.toLocaleString('en-IN')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💸</div>
          <div>
            <div className="stat-label">Total Expenses</div>
            <div className="stat-value" style={{ color: '#e53935' }}>₹{stats.totalExpenses.toLocaleString('en-IN')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✔️</div>
          <div>
            <div className="stat-label">Net Profit</div>
            <div className="stat-value" style={{ color: 'var(--green-dark)' }}>₹{(stats.revenue - stats.totalExpenses).toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      <h3 className="section-title">Your Vegetables</h3>
      <div className="veg-grid">
        {VEGETABLES.map(v => (
          <div key={v.name} className="veg-card" onClick={() => onSelect(v.name)}>
            <span className="veg-emoji">{v.icon}</span>
            <h4>{v.name}</h4>
            <p>Manage crops & sales</p>
            <button className="btn btn-green">View Crops</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===== CROPS VIEW ===== */
function CropsView({ veg, crops, onBack, onSelect, onAdd, onDelete }) {
  const vegObj = VEGETABLES.find(v => v.name === veg);

  return (
    <div className="fade-in">
      <div className="detail-top">
        <div className="detail-left">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <span className="detail-icon">{vegObj?.icon}</span>
          <h2>{veg} — Crops</h2>
        </div>
        <button className="btn btn-green" onClick={onAdd}>+ New Crop</button>
      </div>

      {crops.length === 0 ? (
        <div className="empty-card">
          <p>No crops yet for {veg}.</p>
          <p>Click <strong>"+ New Crop"</strong> to start tracking a harvest season!</p>
        </div>
      ) : (
        <div className="crops-grid">
          {crops.map(crop => (
            <div key={crop._id} className="crop-card" onClick={() => onSelect(crop)}>
              <div className="crop-card-top">
                <span className="crop-status-dot" style={{ background: crop.status === 'active' ? 'var(--green-light)' : 'var(--gray-400)' }}></span>
                <span className="crop-status-text">{crop.status === 'active' ? 'Active' : 'Completed'}</span>
              </div>
              <h4>{crop.name}</h4>
              <p className="crop-date">Planted: {crop.plantedDate ? format(new Date(crop.plantedDate), 'dd MMM yyyy') : 'N/A'}</p>
              <p className="crop-date">Created: {format(new Date(crop.createdAt), 'dd MMM yyyy')}</p>
              <div className="crop-card-actions">
                <button className="btn btn-green btn-sm">Open Diary</button>
                <button className="delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(crop._id); }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===== DETAIL (DIARY ENTRIES) ===== */
function Detail({ veg, crop, records, expenses, onBack, onAdd, onAddExpense, onEdit, onDelete, onDeleteExpense, onToggleStatus }) {
  const [showExpenses, setShowExpenses] = useState(false);
  const vegObj = VEGETABLES.find(v => v.name === veg);
  const isCompleted = crop.status === 'completed';

  let cumulative = 0;
  const totalIncome = records.filter(r => r.rate > 0).reduce((s, r) => s + r.total, 0);
  const totalExpense = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  return (
    <div className="fade-in">
      <div className="detail-top">
        <div className="detail-left">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <span className="detail-icon">{vegObj?.icon}</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2>{crop.name}</h2>
              {isCompleted && <span className="badge badge-pending" style={{ background: 'var(--gray-200)', color: 'var(--gray-600)' }}>Completed</span>}
            </div>
            <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>{veg} Diary (Planted: {crop.plantedDate ? format(new Date(crop.plantedDate), 'dd MMM yyyy') : 'N/A'})</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className={`btn ${showExpenses ? 'btn-green' : 'btn-outline'}`}
            onClick={() => setShowExpenses(!showExpenses)}
          >
            {showExpenses ? '🙈 Hide Expenses' : '👁️ Show Expenses'}
          </button>
          <button
            className="btn btn-outline"
            onClick={() => onToggleStatus(isCompleted ? 'active' : 'completed')}
          >
            {isCompleted ? '🔓 Re-open Crop' : '🔒 Close Crop'}
          </button>
          {!isCompleted && (
            <>
              <button className="btn btn-outline" onClick={onAddExpense}>+ Add Expense</button>
              <button className="btn btn-green" onClick={onAdd}>+ New Harvest</button>
            </>
          )}
        </div>
      </div>

      <div className="stats-row" style={{ marginTop: '0' }}>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div>
            <div className="stat-label">Income</div>
            <div className="stat-value">₹{totalIncome.toLocaleString('en-IN')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💸</div>
          <div>
            <div className="stat-label">Expenses</div>
            <div className="stat-value" style={{ color: '#e53935' }}>₹{totalExpense.toLocaleString('en-IN')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✔️</div>
          <div>
            <div className="stat-label">Net Profit</div>
            <div className="stat-value" style={{ color: 'var(--green-dark)' }}>₹{(totalIncome - totalExpense).toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      <h3 className="section-title">Harvest Records</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Boxes</th>
              <th>Rate (₹)</th>
              <th>Commission (₹)</th>
              <th>Net Total (₹)</th>
              <th>Cumulative (₹)</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan="8" className="empty-msg">No harvests yet.</td></tr>
            ) : (
              records.map(r => {
                if (r.rate > 0) cumulative += r.total;
                return (
                  <tr key={r._id} onClick={() => onEdit(r)} style={{ cursor: 'pointer' }}>
                    <td data-label="Date"><strong>{format(new Date(r.date), 'dd MMM yyyy')}</strong></td>
                    <td data-label="Boxes">{r.boxes}</td>
                    <td data-label="Rate">{r.rate > 0 ? `₹${r.rate.toLocaleString('en-IN')}` : '-'}</td>
                    <td data-label="Commission">{r.rate > 0 ? `₹${r.commission.toLocaleString('en-IN')}` : '-'}</td>
                    <td data-label="Net Total">{r.rate > 0 ? <strong>₹{r.total.toLocaleString('en-IN')}</strong> : '-'}</td>
                    <td data-label="Cumulative" style={{ color: 'var(--green)' }}>
                      {r.rate > 0 ? (
                        <strong>₹{cumulative.toLocaleString('en-IN')}</strong>
                      ) : '-'}
                    </td>
                    <td data-label="Status">
                      <span className={`badge ${r.rate > 0 ? 'badge-paid' : 'badge-pending'}`}>
                        {r.rate > 0 ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="delete-btn"
                        title="Delete"
                        onClick={(e) => { e.stopPropagation(); onDelete(r._id); }}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showExpenses && (
        <div className="fade-in">
          <h3 className="section-title" style={{ marginTop: '2.5rem' }}>Expense Records</h3>
          <div className="table-wrap" style={{ marginBottom: '2rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Details</th>
                  <th>Amount (₹)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr><td colSpan="5" className="empty-msg">No expenses yet. Track manure, labor, etc.</td></tr>
                ) : (
                  expenses.map(e => (
                    <tr key={e._id}>
                      <td data-label="Date"><strong>{format(new Date(e.date), 'dd MMM yyyy')}</strong></td>
                      <td data-label="Category"><span className="badge badge-pending" style={{ background: 'var(--gray-100)', color: 'var(--gray-700)' }}>{e.category}</span></td>
                      <td data-label="Details">{e.details}</td>
                      <td data-label="Amount"><strong>₹{Number(e.amount).toLocaleString('en-IN')}</strong></td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="delete-btn"
                          title="Delete"
                          onClick={() => onDeleteExpense(e._id)}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))
                )}
                {expenses.length > 0 && (
                  <tr style={{ background: 'var(--gray-50)' }}>
                    <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold' }}>Total Expense:</td>
                    <td colSpan="2"><strong>₹{totalExpense.toLocaleString('en-IN')}</strong></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== CROP MODAL ===== */
function CropModal({ veg, onClose, onSubmit }) {
  const [form, setForm] = useState({
    name: '',
    plantedDate: format(new Date(), 'yyyy-MM-dd'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>New {veg} Crop</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Crop Name</label>
            <input
              type="text"
              placeholder="e.g. Summer 2026, Crop 1, Season 2..."
              required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              style={{ marginBottom: '1rem' }}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Planted Date</label>
            <input
              type="date"
              required
              value={form.plantedDate}
              onChange={e => setForm({ ...form, plantedDate: e.target.value })}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-green">Create Crop</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ===== ENTRY MODAL ===== */
const COMMISSION_PER_BOX = 44;

function EntryModal({ veg, initialData, onClose, onSubmit }) {
  const [form, setForm] = useState({
    date: initialData ? format(new Date(initialData.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    boxes: initialData ? initialData.boxes : '',
    rate: initialData ? (initialData.rate || '') : '',
    isBillReceived: initialData ? (initialData.rate > 0) : false,
  });

  const boxes = Number(form.boxes) || 0;
  const rate = form.isBillReceived ? (Number(form.rate) || 0) : 0;
  const commission = boxes * COMMISSION_PER_BOX;
  const total = (boxes * rate) - commission;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      date: form.date,
      boxes,
      rate,
      commission,
      billReceived: boxes * rate,
      total,
    });
  };

  const set = (key, val) => setForm({ ...form, [key]: val });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>{initialData ? 'Edit' : 'Add'} {veg} Entry</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input type="date" required value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div className="form-group">
              <label>No. of Boxes</label>
              <input type="number" placeholder="e.g. 10" required min="1" value={form.boxes} onChange={e => set('boxes', e.target.value)} />
            </div>
          </div>

          <div className="checkbox-row" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.isBillReceived}
                onChange={e => set('isBillReceived', e.target.checked)}
              />
              <span>Bill Received?</span>
            </label>
          </div>

          {form.isBillReceived && (
            <div className="form-row">
              <div className="form-group">
                <label>Rate per Box (₹)</label>
                <input type="number" placeholder="e.g. 500" required={form.isBillReceived} min="1" value={form.rate} onChange={e => set('rate', e.target.value)} />
              </div>
            </div>
          )}

          {boxes > 0 && (
            <div className="info-row">
              <span>Commission (₹44 × {boxes} boxes)</span>
              <strong>₹{commission.toLocaleString('en-IN')}</strong>
            </div>
          )}

          {boxes > 0 && (
            <div className="total-preview">
              <span>Net Total: {form.isBillReceived ? '(Boxes × Rate) − Commission' : 'Pending (Commission)'}</span>
              <strong style={{ color: total >= 0 ? 'var(--green-dark)' : '#e53935' }}>
                ₹{total.toLocaleString('en-IN')}
              </strong>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-green">{initialData ? 'Update' : 'Save'} Entry</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ===== EXPENSE MODAL ===== */
function ExpenseModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    category: 'Manure', // Manure, Labour, Pesticides, etc.
    details: '',
    amount: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Add Expense</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Date</label>
            <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label>Category</label>
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              style={{
                padding: '0.7rem',
                borderRadius: '8px',
                border: '1px solid var(--gray-200)',
                background: 'white'
              }}
            >
              <option value="Manure">Manure (Fertilizer)</option>
              <option value="Labour">Labour (Workers)</option>
              <option value="Pesticides">Pesticides (Spays)</option>
              <option value="Transport">Transport</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label>Details</label>
            <input
              type="text"
              placeholder="e.g. 5 bags, 2 workers for 1 day..."
              required
              value={form.details}
              onChange={e => setForm({ ...form, details: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label>Amount (₹)</label>
            <input
              type="number"
              placeholder="e.g. 2500"
              required
              min="0"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-green">Add Expense</button>
          </div>
        </form>
      </div>
    </div>
  );
}
