import { useState } from 'react';
import ScheduleAdmin from './ScheduleAdmin'; // tvoje upravljanje terminima
import StatusManagement from './StatusManagement';
import UserManagement from './UserManagement';
import '../styles/admin-dashboard.css';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'calendar' | 'status' | 'users'>('calendar');

  const handleLogout = () => {
    localStorage.removeItem('admin');
    window.location.reload();
  };

  return (
    <div className="admin-dashboard">

      {/* TABOVI NA VRHU */}
      <div className="tab-buttons">
        <button 
          className={`tab-button ${activeTab === 'calendar' ? 'active' : ''}`} 
          onClick={() => setActiveTab('calendar')}
        >
          Termini
        </button>

        <button 
          className={`tab-button ${activeTab === 'status' ? 'active' : ''}`} 
          onClick={() => setActiveTab('status')}
        >
          Status
        </button>

        <button 
          className={`tab-button ${activeTab === 'users' ? 'active' : ''}`} 
          onClick={() => setActiveTab('users')}
        >
          Korisnici
        </button>
      </div>

      {/* SADRŽAJ */}
      <div className="tab-content">
        {activeTab === 'calendar' && <ScheduleAdmin />}
        {activeTab === 'status' && <StatusManagement />}
        {activeTab === 'users' && <UserManagement />}
      </div>

      {/* ODJAVA */}
      <button onClick={handleLogout} className="logout-button">
        Odjavi se
      </button>
    </div>
  );
}
