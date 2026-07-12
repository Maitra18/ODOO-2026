import { db } from '../db.js';

export function renderDashboard(container, user) {
  const dbData = db.getDB();
  const assets = dbData.assets;
  const allocations = dbData.allocations;
  const bookings = dbData.bookings;
  const maintenance = dbData.maintenanceRequests;
  const transfers = dbData.transferRequests || [];

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // 1. Calculate KPI values
  const availableCount = assets.filter(a => a.status === 'Available').length;
  const allocatedCount = assets.filter(a => a.status === 'Allocated').length;
  
  const maintenanceToday = maintenance.filter(m => 
    m.status === 'In Progress' || m.requestDate === todayStr
  ).length;

  const activeBookings = bookings.filter(b => {
    if (b.status !== 'Upcoming' && b.status !== 'Ongoing') return false;
    const startStr = b.startDate.split('T')[0];
    return startStr === todayStr;
  }).length;

  const pendingTransfers = transfers.filter(t => t.status === 'pending').length;

  // Upcoming returns: active allocations with expectedReturnDate in the future, say next 7 days
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const upcomingReturns = allocations.filter(a => {
    if (a.status !== 'active' || !a.expectedReturnDate) return false;
    const expDate = new Date(a.expectedReturnDate);
    return expDate >= now && expDate <= sevenDaysFromNow;
  }).length;

  // Get list of overdue allocations
  const overdueAllocations = allocations.filter(a => {
    if (a.status !== 'active' || !a.expectedReturnDate) return false;
    const expDate = new Date(a.expectedReturnDate);
    return expDate < now;
  }).map(alloc => {
    const asset = assets.find(ast => ast.id === alloc.assetId);
    let holderName = 'Unknown';
    if (alloc.assigneeType === 'employee') {
      holderName = dbData.employees.find(e => e.id === alloc.assigneeId)?.name || 'Employee';
    } else {
      holderName = dbData.departments.find(d => d.id === alloc.assigneeId)?.name || 'Department';
    }
    return {
      ...alloc,
      assetTag: asset ? asset.tag : 'AF-????',
      assetName: asset ? asset.name : 'Unknown Asset',
      holder: holderName
    };
  });

  // 2. Build Quick Actions based on Role
  let quickActionsHTML = '';
  if (user.role === 'admin') {
    quickActionsHTML = `
      <button class="btn btn-primary" onclick="window.location.hash='#assets?action=new'">Register Asset</button>
      <button class="btn btn-secondary" onclick="window.location.hash='#orgSetup'">Department Directory</button>
      <button class="btn btn-secondary" onclick="window.location.hash='#audit?action=new'">Schedule Audit Cycle</button>
      <button class="btn btn-secondary" onclick="window.location.hash='#reports'">View Analytics</button>
    `;
  } else if (user.role === 'manager') {
    quickActionsHTML = `
      <button class="btn btn-primary" onclick="window.location.hash='#assets?action=new'">Register Asset</button>
      <button class="btn btn-primary" onclick="window.location.hash='#allocation?action=new'">Allocate Asset</button>
      <button class="btn btn-secondary" onclick="window.location.hash='#maintenance'">Review Maintenance</button>
      <button class="btn btn-secondary" onclick="window.location.hash='#audit'">Conduct Audit</button>
    `;
  } else if (user.role === 'dept-head') {
    quickActionsHTML = `
      <button class="btn btn-primary" onclick="window.location.hash='#booking'">Book Resource</button>
      <button class="btn btn-secondary" onclick="window.location.hash='#allocation'">Initiate Asset Transfer</button>
      <button class="btn btn-secondary" onclick="window.location.hash='#maintenance?action=new'">Raise Maintenance Request</button>
    `;
  } else {
    // employee
    quickActionsHTML = `
      <button class="btn btn-primary" onclick="window.location.hash='#maintenance?action=new'">Raise Maintenance Request</button>
      <button class="btn btn-secondary" onclick="window.location.hash='#booking'">Book Room / Vehicle</button>
      <button class="btn btn-secondary" onclick="window.location.hash='#assets'">My Allocated Assets</button>
    `;
  }

  // 3. Assemble Dashboard HTML
  container.innerHTML = `
    <!-- KPI Row -->
    <div class="kpi-grid">
      <div class="kpi-card" style="border-bottom: 3px solid var(--color-available)">
        <div class="kpi-icon-wrapper" style="background: rgba(16, 185, 129, 0.15); color: var(--color-available);">
          <svg style="width:24px; height:24px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <div class="kpi-data">
          <span class="kpi-value">${availableCount}</span>
          <span class="kpi-label">Assets Available</span>
        </div>
      </div>
      
      <div class="kpi-card" style="border-bottom: 3px solid var(--color-allocated)">
        <div class="kpi-icon-wrapper" style="background: rgba(59, 130, 246, 0.15); color: var(--color-allocated);">
          <svg style="width:24px; height:24px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
          </svg>
        </div>
        <div class="kpi-data">
          <span class="kpi-value">${allocatedCount}</span>
          <span class="kpi-label">Assets Allocated</span>
        </div>
      </div>

      <div class="kpi-card" style="border-bottom: 3px solid var(--color-maintenance)">
        <div class="kpi-icon-wrapper" style="background: rgba(245, 158, 11, 0.15); color: var(--color-maintenance);">
          <svg style="width:24px; height:24px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
          </svg>
        </div>
        <div class="kpi-data">
          <span class="kpi-value">${maintenanceToday}</span>
          <span class="kpi-label">Maintenance Today</span>
        </div>
      </div>

      <div class="kpi-card" style="border-bottom: 3px solid var(--color-reserved)">
        <div class="kpi-icon-wrapper" style="background: rgba(139, 92, 246, 0.15); color: var(--color-reserved);">
          <svg style="width:24px; height:24px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
        </div>
        <div class="kpi-data">
          <span class="kpi-value">${activeBookings}</span>
          <span class="kpi-label">Active Bookings (Today)</span>
        </div>
      </div>
      
      <div class="kpi-card" style="border-bottom: 3px solid var(--color-retired)">
        <div class="kpi-icon-wrapper" style="background: rgba(255, 255, 255, 0.05); color: var(--text-muted);">
          <svg style="width:24px; height:24px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
          </svg>
        </div>
        <div class="kpi-data">
          <span class="kpi-value">${pendingTransfers}</span>
          <span class="kpi-label">Pending Transfers</span>
        </div>
      </div>
      
      <div class="kpi-card" style="border-bottom: 3px solid #06b6d4">
        <div class="kpi-icon-wrapper" style="background: rgba(6, 182, 212, 0.15); color: #06b6d4;">
          <svg style="width:24px; height:24px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <div class="kpi-data">
          <span class="kpi-value">${upcomingReturns}</span>
          <span class="kpi-label">Upcoming Returns (7d)</span>
        </div>
      </div>
    </div>

    <!-- Quick Actions Panel -->
    <div class="glass-card">
      <h2 class="card-title">Quick Actions</h2>
      <div class="actions-bar" style="margin-bottom:0; margin-top:0.5rem;">
        ${quickActionsHTML}
      </div>
    </div>

    <!-- Overdue Returns Panel -->
    <div class="glass-card">
      <div class="card-header">
        <h2 class="card-title">Overdue Allocations</h2>
        <span class="badge badge-lost">${overdueAllocations.length} Flagged</span>
      </div>
      
      ${overdueAllocations.length === 0 ? `
        <div class="text-muted" style="text-align: center; padding: 2rem;">No overdue asset returns at this time.</div>
      ` : `
        <div class="table-wrapper">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Asset Tag</th>
                <th>Asset Name</th>
                <th>Current Holder</th>
                <th>Expected Return Date</th>
                <th>Overdue Duration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${overdueAllocations.map(alloc => {
                const daysOverdue = Math.floor((now - new Date(alloc.expectedReturnDate)) / (1000 * 60 * 60 * 24));
                return `
                  <tr>
                    <td style="font-weight:700; color:var(--accent-color);">${alloc.assetTag}</td>
                    <td>${alloc.assetName}</td>
                    <td>${alloc.holder}</td>
                    <td class="text-danger">${alloc.expectedReturnDate}</td>
                    <td style="font-weight:600;"><span class="text-danger">${daysOverdue} days</span></td>
                    <td>
                      <button class="btn btn-sm btn-secondary" onclick="window.location.hash='#allocation?id=${alloc.assetId}'">Process Return</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}
