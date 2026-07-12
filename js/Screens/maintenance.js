import { db } from '../db.js';
import { openModal, closeModal } from '../app.js';

let selectedRequestId = null;

export function renderMaintenance(container, user) {
  const hash = window.location.hash;
  const showFormOnLoad = hash.includes('action=new');

  renderMaintenanceLayout(container, user);

  if (showFormOnLoad) {
    window.location.hash = '#maintenance';
    showRaiseRequestModal(container, user);
  }
}

function renderMaintenanceLayout(container, user) {
  const dbData = db.getDB();
  const requests = dbData.maintenanceRequests || [];
  const assets = dbData.assets;
  const employees = dbData.employees;

  let visibleRequests = requests;
  if (user.role === 'employee') {
    visibleRequests = requests.filter(r => r.reportedBy === user.id);
  } else if (user.role === 'dept-head') {
    const deptEmpIds = employees.filter(e => e.departmentId === user.departmentId).map(e => e.id);
    visibleRequests = requests.filter(r => deptEmpIds.includes(r.reportedBy));
  }

  if (visibleRequests.length > 0 && !selectedRequestId) {
    selectedRequestId = visibleRequests[0].id;
  }

  const activeRequest = visibleRequests.find(r => r.id === selectedRequestId);

  container.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem; align-items:start; flex-wrap:wrap;">
      
      <!-- Left: Requests List -->
      <div class="glass-card">
        <div class="card-header">
          <h2 class="card-title">Maintenance Tickets</h2>
          <button class="btn btn-primary btn-sm" id="btn-raise-maint">
            + Raise Request
          </button>
        </div>
        
        <div style="display:flex; flex-direction:column; gap:0.75rem; max-height: 500px; overflow-y:auto;">
          ${visibleRequests.length === 0 ? `
            <div class="text-muted" style="text-align:center; padding:3rem;">No maintenance requests found.</div>
          ` : visibleRequests.map(r => {
            const asset = assets.find(a => a.id === r.assetId);
            const reporter = employees.find(e => e.id === r.reportedBy);
            
            let badgeClass = 'badge-retired';
            if (r.status === 'Pending') badgeClass = 'badge-undermaintenance';
            if (r.status === 'In Progress') badgeClass = 'badge-allocated';
            if (r.status === 'Resolved') badgeClass = 'badge-available';
            
            let priorityClass = 'text-success';
            if (r.priority === 'High') priorityClass = 'text-danger';
            if (r.priority === 'Medium') priorityClass = 'text-warning';

            return `
              <div class="audit-item-box ${r.id === selectedRequestId ? 'active' : ''}" data-id="${r.id}" style="margin-bottom:0;">
                <div class="audit-title-line">
                  <span style="font-weight:700; color:var(--accent-color);">${asset ? asset.tag : 'AF-????'} - ${asset ? asset.name : 'Asset'}</span>
                  <span class="badge ${badgeClass}">${r.status}</span>
                </div>
                <div style="font-size:0.8rem; margin-top:0.35rem; display:flex; justify-content:space-between;">
                  <span>Priority: <strong class="${priorityClass}">${r.priority}</strong></span>
                  <span class="text-muted">Reported: ${r.requestDate}</span>
                </div>
              </div>
            `;
          }).reverse().join('')}
        </div>
      </div>
      
      <!-- Right: Ticket Detail Viewer -->
      <div class="glass-card" id="maintenance-detail-card">
        <!-- Rendered dynamically below -->
      </div>
      
    </div>
  `;

  container.querySelectorAll('.audit-item-box').forEach(box => {
    box.onclick = () => {
      selectedRequestId = box.dataset.id;
      renderMaintenanceLayout(container, user);
    };
  });

  document.getElementById('btn-raise-maint').onclick = () => showRaiseRequestModal(container, user);

  renderRequestDetail(document.getElementById('maintenance-detail-card'), activeRequest, user, container);
}

function renderRequestDetail(detailCard, request, user, mainContainer) {
  if (!request) {
    detailCard.innerHTML = `<div class="text-muted" style="text-align:center; padding:4rem;">Select a maintenance ticket from the list to view its workflow tracking and operations.</div>`;
    return;
  }

  const dbData = db.getDB();
  const asset = dbData.assets.find(a => a.id === request.assetId);
  const reporter = dbData.employees.find(e => e.id === request.reportedBy);

  const isManagerOrAdmin = user.role === 'admin' || user.role === 'manager';


  const steps = ['Pending', 'Approved', 'In Progress', 'Resolved'];
  const currentStepIdx = steps.indexOf(request.status === 'Technician Assigned' ? 'Approved' : request.status);

  let workflowBarHTML = `
    <div style="display:flex; justify-content:space-between; margin-bottom:1.5rem; position:relative; padding:0 0.5rem;">
      <div style="position:absolute; top:12px; left:5%; right:5%; height:2px; background:rgba(255,255,255,0.08); z-index:1;"></div>
      <div style="position:absolute; top:12px; left:5%; width:${currentStepIdx * 30}%; height:2px; background:var(--accent-color); z-index:1; transition: width 0.3s ease;"></div>
      ${steps.map((st, idx) => {
        const active = idx <= currentStepIdx;
        const color = active ? 'var(--accent-color)' : 'var(--text-muted)';
        const dotBg = active ? 'linear-gradient(135deg, var(--accent-color), #8b5cf6)' : 'var(--bg-tertiary)';
        const border = active ? 'none' : '2px solid rgba(255,255,255,0.15)';
        return `
          <div style="display:flex; flex-direction:column; align-items:center; z-index:2; gap:0.25rem;">
            <div style="width:24px; height:24px; border-radius:50%; background:${dotBg}; border:${border}; display:flex; align-items:center; justify-content:center; color:white; font-size:0.7rem; font-weight:700;">
              ${idx < currentStepIdx ? '✓' : idx + 1}
            </div>
            <span style="font-size:0.7rem; font-weight:600; color:${color};">${st}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;


  let actionButtonsHTML = '';
  if (isManagerOrAdmin) {
    if (request.status === 'Pending') {
      actionButtonsHTML = `
        <div style="display:flex; gap:1rem; margin-top:1.5rem;">
          <button class="btn btn-primary" id="btn-approve-req" style="flex:1;">Approve Request</button>
          <button class="btn btn-danger" id="btn-reject-req" style="flex:1;">Reject Request</button>
        </div>
      `;
    } else if (request.status === 'Approved') {
      actionButtonsHTML = `
        <div style="margin-top:1.5rem;">
          <div class="form-group">
            <label class="form-label" for="assign-tech">Assign Workshop Technician</label>
            <input type="text" id="assign-tech" class="form-control" placeholder="e.g. Alex Maintenance Tech" value="Alex Technician" required>
          </div>
          <button class="btn btn-primary" id="btn-assign-tech" style="width:100%;">Dispatch & Start Repairs</button>
        </div>
      `;
    } else if (request.status === 'In Progress') {
      actionButtonsHTML = `
        <div style="margin-top:1.5rem;">
          <div class="form-group">
            <label class="form-label" for="resolution-notes">Resolution / Completion Notes</label>
            <textarea id="resolution-notes" class="form-control" placeholder="Describe the parts replaced or fix details..." rows="3" required></textarea>
          </div>
          <button class="btn btn-primary" id="btn-resolve-req" style="width:100%;">Mark Resolved & Return Asset</button>
        </div>
      `;
    }
  }

  detailCard.innerHTML = `
    <h2 class="card-title">Ticket Detail: ${request.id}</h2>
    
    <div style="display:flex; flex-direction:column; gap:1rem; margin-top:1rem;">
      
      <!-- Workflow step visualizer -->
      ${workflowBarHTML}

      <div style="font-size:0.875rem; border-top:1px solid var(--border-color); padding-top:1rem;">
        <div style="margin-bottom:0.5rem;"><span class="text-muted">Asset Tag:</span> <strong style="color:var(--accent-color);">${asset ? asset.tag : 'AF-????'}</strong></div>
        <div style="margin-bottom:0.5rem;"><span class="text-muted">Asset Name:</span> <strong>${asset ? asset.name : 'Unknown Asset'}</strong></div>
        <div style="margin-bottom:0.5rem;"><span class="text-muted">Reported By:</span> <strong>${reporter ? reporter.name : 'Employee'}</strong></div>
        <div style="margin-bottom:0.5rem;"><span class="text-muted">Issue Priority:</span> <strong class="${request.priority === 'High' ? 'text-danger' : 'text-warning'}">${request.priority}</strong></div>
        <div style="margin-bottom:0.5rem;"><span class="text-muted">Description of Malfunction:</span></div>
        <div style="background:rgba(0,0,0,0.15); padding:0.75rem; border-radius:var(--border-radius-sm); border:1px solid var(--border-color); font-style:italic;">
          "${request.description}"
        </div>
      </div>
      
      ${request.technician ? `
        <div style="font-size:0.875rem; border-top:1px solid var(--border-color); padding-top:0.75rem;">
          <div><span class="text-muted">Assigned Technician:</span> <strong>${request.technician}</strong></div>
        </div>
      ` : ''}

      ${request.resolutionNotes ? `
        <div style="font-size:0.875rem; border-top:1px solid var(--border-color); padding-top:0.75rem;">
          <div><span class="text-muted">Resolution details:</span></div>
          <div style="background:rgba(16, 185, 129, 0.05); padding:0.75rem; border-radius:var(--border-radius-sm); border:1px solid rgba(16, 185, 129, 0.2); margin-top:0.25rem;">
            ${request.resolutionNotes}
          </div>
        </div>
      ` : ''}

      ${actionButtonsHTML}
    </div>
  `;


  if (isManagerOrAdmin) {
    const btnApprove = document.getElementById('btn-approve-req');
    const btnReject = document.getElementById('btn-reject-req');
    const btnAssign = document.getElementById('btn-assign-tech');
    const btnResolve = document.getElementById('btn-resolve-req');

    if (btnApprove) {
      btnApprove.onclick = () => {
        const dbFresh = db.getDB();
        const req = dbFresh.maintenanceRequests.find(r => r.id === request.id);
        const ast = dbFresh.assets.find(a => a.id === req.assetId);

        req.status = 'Approved';
        if (ast) ast.status = 'Under Maintenance';

        db.addLog(dbFresh, user.id, user.name, `Approved maintenance request ${req.id} for ${ast ? ast.tag : 'Asset'}`);
        db.saveDB(dbFresh);

        db.notify(req.reportedBy, 'Maintenance Request Approved', `Your request for ${ast ? ast.name : 'Asset'} has been approved. A technician will be assigned.`);

        renderMaintenanceLayout(mainContainer, user);
      };
    }

    if (btnReject) {
      btnReject.onclick = () => {
        if (!confirm('Are you sure you want to reject this request?')) return;
        const dbFresh = db.getDB();
        const req = dbFresh.maintenanceRequests.find(r => r.id === request.id);

        req.status = 'Rejected';

        db.addLog(dbFresh, user.id, user.name, `Rejected maintenance request ${req.id}`);
        db.saveDB(dbFresh);

        db.notify(req.reportedBy, 'Maintenance Request Rejected', `Your request for asset maintenance (Ticket ${req.id}) was rejected.`);

        renderMaintenanceLayout(mainContainer, user);
      };
    }

    if (btnAssign) {
      btnAssign.onclick = () => {
        const techInput = document.getElementById('assign-tech');
        if (!techInput.value) return alert('Technician name is required.');

        const dbFresh = db.getDB();
        const req = dbFresh.maintenanceRequests.find(r => r.id === request.id);

        req.status = 'In Progress';
        req.technician = techInput.value;

        db.addLog(dbFresh, user.id, user.name, `Assigned technician ${req.technician} to ticket ${req.id}`);
        db.saveDB(dbFresh);

        renderMaintenanceLayout(mainContainer, user);
      };
    }

    if (btnResolve) {
      btnResolve.onclick = () => {
        const notesText = document.getElementById('resolution-notes');
        if (!notesText.value) return alert('Resolution notes are required to resolve the ticket.');

        const dbFresh = db.getDB();
        const req = dbFresh.maintenanceRequests.find(r => r.id === request.id);
        const ast = dbFresh.assets.find(a => a.id === req.assetId);

        req.status = 'Resolved';
        req.resolutionNotes = notesText.value;


        if (ast) ast.status = 'Available';

        db.addLog(dbFresh, user.id, user.name, `Resolved maintenance ticket ${req.id} for ${ast ? ast.tag : 'Asset'}`);
        db.saveDB(dbFresh);

        db.notify(req.reportedBy, 'Maintenance Completed', `Asset ${ast ? ast.name : 'Asset'} has been repaired and is available for use.`);

        renderMaintenanceLayout(mainContainer, user);
      };
    }
  }
}

function showRaiseRequestModal(mainContainer, user) {
  const dbData = db.getDB();
  const assets = dbData.assets;
  const allocations = dbData.allocations;

  let userAssets = assets;
  if (user.role === 'employee') {
    const allocatedAssetIds = allocations
      .filter(a => a.status === 'active' && a.assigneeType === 'employee' && a.assigneeId === user.id)
      .map(a => a.assetId);
    userAssets = assets.filter(a => allocatedAssetIds.includes(a.id));
  }

  const html = `
    <form id="modal-maint-form">
      <div class="form-group">
        <label class="form-label" for="maint-asset-id">Select Damaged/Faulty Asset</label>
        <select id="maint-asset-id" class="form-control" required>
          <option value="">-- Select Asset --</option>
          ${userAssets.map(a => `<option value="${a.id}">${a.tag} - ${a.name} (${a.location})</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label" for="maint-priority">Issue Severity / Priority</label>
        <select id="maint-priority" class="form-control">
          <option value="Low">Low (Functional, minor issue)</option>
          <option value="Medium" selected>Medium (Impaired usage)</option>
          <option value="High">High (Inoperable, blockers)</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label" for="maint-desc">Description of Fault</label>
        <textarea id="maint-desc" class="form-control" placeholder="Describe the malfunction, error signs, or physical damages..." rows="4" required></textarea>
      </div>
    </form>
  `;

  openModal(
    'Raise Maintenance Repair Ticket',
    html,
    [
      { text: 'Cancel', onClick: closeModal },
      {
        text: 'Submit Request',
        class: 'btn-primary',
        onClick: (e) => {
          const form = document.getElementById('modal-maint-form');
          if (!form.reportValidity()) return;

          const assetId = document.getElementById('maint-asset-id').value;
          const priority = document.getElementById('maint-priority').value;
          const description = document.getElementById('maint-desc').value;

          const newRequest = {
            id: `maint-${Date.now()}`,
            assetId,
            reportedBy: user.id,
            requestDate: new Date().toISOString().split('T')[0],
            description,
            priority,
            status: 'Pending',
            technician: null,
            resolutionNotes: null,
            photoUrl: ''
          };

          const dbFresh = db.getDB();
          dbFresh.maintenanceRequests.push(newRequest);
          
          const assetTag = dbFresh.assets.find(x => x.id === assetId)?.tag || 'Asset';
          db.addLog(dbFresh, user.id, user.name, `Submitted maintenance ticket for ${assetTag}`);
          db.saveDB(dbFresh);

         
          db.notifyRole('manager', 'New Maintenance Ticket', `A new high/medium priority ticket is raised for ${assetTag} and is pending approval.`);

          closeModal();

    
          renderMaintenanceLayout(mainContainer, user);
        }
      }
    ]
  );
}
