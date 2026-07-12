import { db } from '../db.js';

export function renderLogs(container, user) {
  const dbData = db.getDB();
  const logs = dbData.logs || [];
  const notifications = dbData.notifications || [];
  const employees = dbData.employees;

  // Filter user specific notifications
  const userNotifs = notifications.filter(n => n.userId === user.id);

  container.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 2fr; gap:1.5rem; align-items:start; flex-wrap:wrap;">
      
      <!-- Left Column: User Notifications Feed -->
      <div class="glass-card">
        <div class="card-header">
          <h2 class="card-title">My Alerts Feed</h2>
          ${userNotifs.length > 0 ? `<button class="btn btn-secondary btn-sm" id="btn-clear-notifs-page">Clear All</button>` : ''}
        </div>
        
        <div style="display:flex; flex-direction:column; gap:0.5rem; max-height:480px; overflow-y:auto; padding-right:0.25rem;">
          ${userNotifs.length === 0 ? `
            <div class="text-muted" style="text-align:center; padding:3rem;">No notifications recorded.</div>
          ` : userNotifs.map(n => `
            <div class="audit-item-box ${n.read ? '' : 'unread'}" style="margin-bottom:0; cursor:default; border-left: 3px solid ${n.read ? 'rgba(255,255,255,0.1)' : 'var(--accent-color)'};">
              <div style="font-weight:600; font-size:0.875rem;">${n.title}</div>
              <p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.15rem;">${n.message}</p>
              <span style="font-size:0.65rem; color:var(--text-muted); display:block; text-align:right; margin-top:0.25rem;">${new Date(n.date).toLocaleString()}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Right Column: Security Audit Trails -->
      <div class="glass-card">
        <h2 class="card-title" style="margin-bottom:1rem;">System Security Audit Log</h2>
        
        <div class="table-wrapper">
          <table class="custom-table" style="font-size:0.8rem;">
            <thead>
              <tr>
                <th>Operator</th>
                <th>Role</th>
                <th>Action Description</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              ${logs.length === 0 ? `
                <tr><td colspan="4" class="text-muted" style="text-align:center;">No audit records.</td></tr>
              ` : logs.map(l => {
                const operator = employees.find(e => e.id === l.userId);
                const roleLabel = operator ? operator.role.replace('-', ' ').toUpperCase() : 'SYSTEM';
                const roleBadgeClass = operator ? (
                  operator.role === 'admin' ? 'badge-reserved' :
                  operator.role === 'manager' ? 'badge-allocated' :
                  operator.role === 'dept-head' ? 'badge-available' : 'badge-retired'
                ) : 'badge-retired';

                return `
                  <tr>
                    <td style="font-weight:600;">${l.userName || 'System'}</td>
                    <td>
                      <span class="badge ${roleBadgeClass}" style="font-size:0.6rem;">${roleLabel}</span>
                    </td>
                    <td>${l.action}</td>
                    <td class="text-muted">${new Date(l.date).toLocaleString()}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  `;

  // Bind clear notifications
  const btnClear = document.getElementById('btn-clear-notifs-page');
  if (btnClear) {
    btnClear.onclick = () => {
      const dbFresh = db.getDB();
      dbFresh.notifications = dbFresh.notifications.filter(n => n.userId !== user.id);
      db.saveDB(dbFresh);
      
      // Update app shell counter
      const badge = document.getElementById('notif-count-badge');
      if (badge) badge.classList.add('hidden');

      // Refresh layout
      renderLogs(container, user);
    };
  }
}
