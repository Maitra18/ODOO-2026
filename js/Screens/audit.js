import { db } from '../db.js';
import { openModal, closeModal } from '../app.js';

let selectedCycleId = null;

export function renderAudit(container, user) {
  const hash = window.location.hash;
  const showFormOnLoad = hash.includes('action=new') && (user.role === 'admin' || user.role === 'manager');

  renderAuditLayout(container, user);

  if (showFormOnLoad) {
    window.location.hash = '#audit';
    showCreateCycleModal(container, user);
  }
}

function renderAuditLayout(container, user) {
  const dbData = db.getDB();
  const cycles = dbData.auditCycles || [];
  const depts = dbData.departments;

  if (cycles.length > 0 && !selectedCycleId) {
    selectedCycleId = cycles[0].id;
  }

  const activeCycle = cycles.find(c => c.id === selectedCycleId);

  container.innerHTML = `
    <div class="audit-list-layout">
      
      <!-- Left side: Cycles list -->
      <div class="glass-card">
        <div class="card-header">
          <h2 class="card-title">Audit Cycles</h2>
          ${user.role === 'admin' ? `
            <button class="btn btn-primary btn-sm" id="btn-create-audit">
              + New Audit
            </button>
          ` : ''}
        </div>
        
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          ${cycles.length === 0 ? `
            <p class="text-muted" style="text-align:center; padding:2rem;">No audit cycles scheduled.</p>
          ` : cycles.map(c => {
            const deptName = depts.find(d => d.id === c.departmentId)?.name || 'All Departments';
            const count = Object.keys(c.verifications || {}).length;
            return `
              <div class="audit-item-box ${c.id === selectedCycleId ? 'active' : ''}" data-id="${c.id}" style="margin-bottom:0;">
                <div class="audit-title-line">
                  <span class="audit-name">${c.name}</span>
                  <span class="badge ${c.status === 'active' ? 'badge-available' : 'badge-retired'}">${c.status}</span>
                </div>
                <div class="audit-meta-line">
                  <span>Scope: <strong>${deptName}</strong></span>
                  <span>Verified: <strong>${count} assets</strong></span>
                </div>
                <div class="audit-meta-line" style="margin-top:0.25rem;">
                  <span>Timeline: ${c.startDate} to ${c.endDate}</span>
                </div>
              </div>
            `;
          }).reverse().join('')}
        </div>
      </div>
      
      <!-- Right side: Active Cycle detail and Verification checklist -->
      <div class="glass-card audit-details-card" id="audit-detail-card">
        <!-- Injected dynamically -->
      </div>
      
    </div>
  `;

  // Bind listing items click
  container.querySelectorAll('.audit-item-box').forEach(box => {
    box.onclick = () => {
      selectedCycleId = box.dataset.id;
      renderAuditLayout(container, user);
    };
  });

  // Bind create audit click
  const btnCreate = document.getElementById('btn-create-audit');
  if (btnCreate) btnCreate.onclick = () => showCreateCycleModal(container, user);

  // Render detail block
  renderCycleDetail(document.getElementById('audit-detail-card'), activeCycle, user, container);
}

function renderCycleDetail(detailCard, cycle, user, mainContainer) {
  if (!cycle) {
    detailCard.innerHTML = `<div class="text-muted" style="text-align:center; padding:4rem;">Select an Audit Cycle to conduct checklist verifications and generate discrepancy reports.</div>`;
    return;
  }

  const dbData = db.getDB();
  const assets = dbData.assets;
  const employees = dbData.employees;
  const depts = dbData.departments;

  // Find assets falling under this audit scope (department or location)
  let scopedAssets = assets.filter(a => a.status !== 'Retired' && a.status !== 'Disposed');
  if (cycle.departmentId) {
    // Assets currently allocated to this department or employee in this department
    const deptEmpIds = employees.filter(e => e.departmentId === cycle.departmentId).map(e => e.id);
    const activeAllocations = dbData.allocations.filter(al => 
      al.status === 'active' && (
        (al.assigneeType === 'department' && al.assigneeId === cycle.departmentId) ||
        (al.assigneeType === 'employee' && deptEmpIds.includes(al.assigneeId))
      )
    ).map(al => al.assetId);

    scopedAssets = scopedAssets.filter(a => activeAllocations.includes(a.id));
  }
  
  if (cycle.location) {
    scopedAssets = scopedAssets.filter(a => a.location.toLowerCase().includes(cycle.location.toLowerCase()));
  }

  // Calculate discrepancy count
  const verifications = cycle.verifications || {};
  let discrepancyCount = 0;
  const discrepancyList = [];

  scopedAssets.forEach(a => {
    const v = verifications[a.id];
    if (v && (v.status === 'Missing' || v.status === 'Damaged')) {
      discrepancyCount++;
      discrepancyList.push({
        tag: a.tag,
        name: a.name,
        reported: v.status,
        notes: v.notes,
        verifiedBy: employees.find(e => e.id === v.verifiedBy)?.name || 'Auditor'
      });
    }
  });

  // Check if active user is an assigned auditor
  const isAuditor = cycle.auditorIds.includes(user.id) || user.role === 'admin';
  const isActive = cycle.status === 'active';

  detailCard.innerHTML = `
    <div>
      <div class="card-header" style="margin-bottom:0.5rem; padding:0;">
        <h2 class="card-title">${cycle.name} Details</h2>
        ${isActive && user.role === 'admin' ? `
          <button class="btn btn-danger btn-sm" id="btn-close-audit">Close & Lock Cycle</button>
        ` : ''}
      </div>
      <p class="text-muted" style="font-size:0.8rem; margin-bottom:1rem;">
        Scope Department: <strong>${depts.find(d => d.id === cycle.departmentId)?.name || 'All'}</strong> • 
        Assigned Auditors: <strong>${cycle.auditorIds.map(id => employees.find(e => e.id === id)?.name || id).join(', ')}</strong>
      </p>
    </div>

    <!-- Discrepancy report banner -->
    ${discrepancyList.length > 0 ? `
      <div class="overdue-banner discrepancy-card">
        <div class="overdue-info">
          <svg style="width:24px; height:24px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
          <div class="overdue-text">
            <h4>Audit Discrepancies Generated</h4>
            <p>${discrepancyCount} assets flagged with discrepancies (Missing / Damaged).</p>
          </div>
        </div>
        <button class="btn-overdue-view" id="btn-view-discrepancies" style="background:var(--color-maintenance);">Inspect Discrepancies</button>
      </div>
    ` : `
      <div style="background:rgba(16, 185, 129, 0.05); border:1px solid rgba(16, 185, 129, 0.2); border-radius:var(--border-radius); padding:1rem; font-size:0.85rem; color:var(--color-available);">
        ✓ No discrepancies flagged currently in this cycle.
      </div>
    `}

    <!-- Verification checklist -->
    <div style="margin-top:1.5rem;">
      <h3 style="font-size:0.95rem; font-weight:700; margin-bottom:0.75rem;">Verification Checklist</h3>
      
      <div style="display:flex; flex-direction:column; gap:0.5rem; max-height: 320px; overflow-y:auto; padding-right:0.25rem;">
        ${scopedAssets.length === 0 ? `
          <div class="text-muted" style="text-align:center; padding:2rem;">No physical assets exist in the defined audit scope.</div>
        ` : scopedAssets.map(a => {
          const v = verifications[a.id];
          const isVerified = v?.status === 'Verified';
          const isMissing = v?.status === 'Missing';
          const isDamaged = v?.status === 'Damaged';

          return `
            <div class="audit-asset-row">
              <div class="audit-asset-info">
                <span class="audit-asset-name">${a.name}</span>
                <span class="audit-asset-tag">${a.tag} • Serial: ${a.serialNumber}</span>
                ${v && v.notes ? `<span class="text-muted" style="font-size:0.75rem; font-style:italic;">Notes: "${v.notes}"</span>` : ''}
              </div>
              
              <div class="audit-actions">
                ${isActive && isAuditor ? `
                  <button class="audit-verify-btn ${isVerified ? 'selected-verified' : ''}" data-assetid="${a.id}" data-status="Verified">Verified</button>
                  <button class="audit-verify-btn ${isMissing ? 'selected-missing' : ''}" data-assetid="${a.id}" data-status="Missing">Missing</button>
                  <button class="audit-verify-btn ${isDamaged ? 'selected-damaged' : ''}" data-assetid="${a.id}" data-status="Damaged">Damaged</button>
                ` : `
                  <span class="badge ${isVerified ? 'badge-available' : isMissing ? 'badge-lost' : isDamaged ? 'badge-undermaintenance' : 'badge-retired'}">
                    ${v ? v.status : 'Pending Check'}
                  </span>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Bind Verification Buttons click
  if (isActive && isAuditor) {
    detailCard.querySelectorAll('.audit-verify-btn').forEach(btn => {
      btn.onclick = () => {
        const assetId = btn.dataset.assetid;
        const status = btn.dataset.status;
        showVerificationNotesModal(cycle.id, assetId, status, user, mainContainer);
      };
    });
  }

  // Bind Close Audit Cycle click
  const btnClose = document.getElementById('btn-close-audit');
  if (btnClose) {
    btnClose.onclick = () => handleCloseAudit(cycle.id, user, mainContainer);
  }

  // Bind Inspect Discrepancies click
  const btnInspectDiscrepancies = document.getElementById('btn-view-discrepancies');
  if (btnInspectDiscrepancies) {
    btnInspectDiscrepancies.onclick = () => {
      const html = `
        <div class="table-wrapper">
          <table class="custom-table" style="font-size: 0.8rem;">
            <thead>
              <tr>
                <th>Tag</th>
                <th>Asset Name</th>
                <th>Discrepancy Status</th>
                <th>Auditor Notes</th>
                <th>Verified By</th>
              </tr>
            </thead>
            <tbody>
              ${discrepancyList.map(item => `
                <tr>
                  <td style="font-weight:700; color:var(--color-lost);">${item.tag}</td>
                  <td style="font-weight:600;">${item.name}</td>
                  <td>
                    <span class="badge ${item.reported === 'Missing' ? 'badge-lost' : 'badge-undermaintenance'}">
                      ${item.reported}
                    </span>
                  </td>
                  <td>${item.notes || '-'}</td>
                  <td>${item.verifiedBy}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      openModal('Audit Discrepancies Report', html, [{ text: 'Close', onClick: closeModal }]);
    };
  }
}

function showVerificationNotesModal(cycleId, assetId, status, user, mainContainer) {
  const html = `
    <form id="modal-verify-notes-form">
      <div style="font-size:0.875rem; margin-bottom:1rem;">
        Marking asset as <strong>${status}</strong>. Enter verification observations:
      </div>
      <div class="form-group">
        <label class="form-label" for="verify-notes">Observations / Notes</label>
        <input type="text" id="verify-notes" class="form-control" placeholder="E.g. Verified in room 301. Or laptop case missing." required>
      </div>
    </form>
  `;

  openModal(
    'Verification Observations',
    html,
    [
      { text: 'Cancel', onClick: closeModal },
      {
        text: 'Save Check',
        class: 'btn-primary',
        onClick: (e) => {
          const notes = document.getElementById('verify-notes').value;
          if (!notes) return alert('Observations notes are required');

          const dbFresh = db.getDB();
          const cycle = dbFresh.auditCycles.find(c => c.id === cycleId);
          
          if (!cycle.verifications) cycle.verifications = {};
          cycle.verifications[assetId] = {
            status,
            notes,
            verifiedAt: new Date().toISOString().split('T')[0],
            verifiedBy: user.id
          };

          db.addLog(dbFresh, user.id, user.name, `Verified asset ${assetId} as ${status} in cycle ${cycle.name}`);
          db.saveDB(dbFresh);

          closeModal();

          // Refresh details pane
          renderAuditLayout(mainContainer, user);
        }
      }
    ]
  );
}

function handleCloseAudit(cycleId, user, mainContainer) {
  if (!confirm('Warning: Closing and locking this audit cycle will resolve and lock the verifications. Any assets confirmed MISSING will have their global lifecycle status updated to LOST. Proceed?')) return;

  const dbFresh = db.getDB();
  const cycle = dbFresh.auditCycles.find(c => c.id === cycleId);
  const assets = dbFresh.assets;
  const verifications = cycle.verifications || {};

  cycle.status = 'closed';

  // Apply discrepancy side effects to inventory status
  let countLost = 0;
  let countDamaged = 0;

  Object.keys(verifications).forEach(assetId => {
    const v = verifications[assetId];
    const asset = assets.find(a => a.id === assetId);

    if (asset) {
      if (v.status === 'Missing') {
        asset.status = 'Lost';
        countLost++;
      } else if (v.status === 'Damaged') {
        asset.condition = 'Poor';
        countDamaged++;
      }
    }
  });

  db.addLog(
    dbFresh, 
    user.id, 
    user.name, 
    `Closed Audit Cycle: ${cycle.name}. Side-effects: marked ${countLost} assets as Lost, and ${countDamaged} assets as Damaged.`
  );
  db.saveDB(dbFresh);

  // Raise systemwide alert notifications
  if (countLost > 0) {
    db.notifyRole('manager', 'Audit Cycle Discrepancies Logged', `Audit ${cycle.name} closed with ${countLost} assets confirmed missing. Statuses updated to Lost.`);
  }

  // Refresh
  renderAuditLayout(mainContainer, user);
}

function showCreateCycleModal(mainContainer, user) {
  const dbData = db.getDB();
  const depts = dbData.departments.filter(d => d.status === 'active');
  const auditors = dbData.employees.filter(e => e.role === 'manager' || e.role === 'admin' || e.role === 'dept-head');

  const html = `
    <form id="modal-audit-create-form">
      <div class="form-group">
        <label class="form-label" for="audit-name-input">Audit Cycle Name</label>
        <input type="text" id="audit-name-input" class="form-control" placeholder="e.g. Q3 Operations Audit" required>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="audit-dept">Department Scope</label>
          <select id="audit-dept" class="form-control">
            <option value="">-- All Departments --</option>
            ${depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="audit-loc-input">Location Filter (Optional)</label>
          <input type="text" id="audit-loc-input" class="form-control" placeholder="e.g. Floor 3">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="audit-start">Start Date</label>
          <input type="date" id="audit-start" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="audit-end">End Date</label>
          <input type="date" id="audit-end" class="form-control" value="${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}" required>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="audit-auditor">Assign Lead Auditor</label>
        <select id="audit-auditor" class="form-control" required>
          <option value="">-- Select Auditor --</option>
          ${auditors.map(a => `<option value="${a.id}">${a.name} (${a.role})</option>`).join('')}
        </select>
      </div>
    </form>
  `;

  openModal(
    'Schedule Audit Cycle',
    html,
    [
      { text: 'Cancel', onClick: closeModal },
      {
        text: 'Schedule Audit',
        class: 'btn-primary',
        onClick: (e) => {
          const form = document.getElementById('modal-audit-create-form');
          if (!form.reportValidity()) return;

          const name = document.getElementById('audit-name-input').value;
          const departmentId = document.getElementById('audit-dept').value;
          const location = document.getElementById('audit-loc-input').value;
          const startDate = document.getElementById('audit-start').value;
          const endDate = document.getElementById('audit-end').value;
          const auditorId = document.getElementById('audit-auditor').value;

          const newCycle = {
            id: `audit-${Date.now()}`,
            name,
            departmentId: departmentId || null,
            location: location || '',
            startDate,
            endDate,
            auditorIds: [auditorId],
            status: 'active',
            verifications: {}
          };

          const dbFresh = db.getDB();
          dbFresh.auditCycles.push(newCycle);
          db.addLog(dbFresh, user.id, user.name, `Scheduled new audit cycle: ${name}`);
          db.saveDB(dbFresh);

          // Notify auditor
          db.notify(auditorId, 'Audit Assigned', `You have been assigned as lead auditor for cycle ${name}.`);

          closeModal();

          // Refresh list
          renderAuditLayout(mainContainer, user);
        }
      }
    ]
  );
}
