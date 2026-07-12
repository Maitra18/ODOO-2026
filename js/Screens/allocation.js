import { db } from '../db.js';
import { openModal, closeModal } from '../app.js';

export function renderAllocation(container, user) {
  // Check if hash has params
  const hash = window.location.hash;
  const matchId = hash.match(/[?&]id=([^&]+)/);
  const showAllocateAssetId = matchId ? matchId[1] : null;

  const showFormOnLoad = hash.includes('action=new') && (user.role === 'admin' || user.role === 'manager');

  renderAllocationLayout(container, user);

  if (showFormOnLoad || showAllocateAssetId) {
    // Clear query params to prevent reload loop
    window.location.hash = '#allocation';
    showAllocationModal(showAllocateAssetId, user);
  }
}

function renderAllocationLayout(container, user) {
  const dbData = db.getDB();
  const assets = dbData.assets;
  const allocations = dbData.allocations;
  const employees = dbData.employees;
  const depts = dbData.departments;
  const transfers = dbData.transferRequests || [];

  const isManagerOrAdmin = user.role === 'admin' || user.role === 'manager';

  // Get active allocations
  const activeAllocations = allocations.filter(a => a.status === 'active').map(a => {
    const asset = assets.find(ast => ast.id === a.assetId);
    let holderName = 'Unknown';
    let departmentName = 'Unassigned';

    if (a.assigneeType === 'employee') {
      const emp = employees.find(e => e.id === a.assigneeId);
      holderName = emp ? emp.name : 'Employee';
      departmentName = emp ? (depts.find(d => d.id === emp.departmentId)?.name || 'Unassigned') : 'Unassigned';
    } else {
      const dept = depts.find(d => d.id === a.assigneeId);
      holderName = dept ? `${dept.name} (Dept)` : 'Department';
      departmentName = dept ? dept.name : 'Unassigned';
    }

    return {
      ...a,
      assetTag: asset ? asset.tag : 'AF-????',
      assetName: asset ? asset.name : 'Unknown Asset',
      holder: holderName,
      department: departmentName
    };
  });

  // Filter transfers based on user role (Dept Head sees department specific requests)
  let visibleTransfers = transfers;
  if (user.role === 'dept-head') {
    // Show transfers where from/to employee is in the department head's department
    const deptEmpIds = employees.filter(e => e.departmentId === user.departmentId).map(e => e.id);
    visibleTransfers = transfers.filter(t => 
      deptEmpIds.includes(t.fromEmployeeId) || deptEmpIds.includes(t.toEmployeeId)
    );
  }

  container.innerHTML = `
    <div style="display:grid; grid-template-columns: 2fr 1fr; gap:1.5rem; align-items:start; flex-wrap:wrap;">
      
      <!-- Left side: Allocations List -->
      <div class="glass-card">
        <div class="card-header">
          <h2 class="card-title">Active Allocations</h2>
          ${isManagerOrAdmin ? `
            <button class="btn btn-primary btn-sm" id="btn-create-allocation">
              + New Allocation
            </button>
          ` : ''}
        </div>
        
        <div class="table-wrapper">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Asset Tag</th>
                <th>Asset Name</th>
                <th>Assigned To</th>
                <th>Department</th>
                <th>Allocated Date</th>
                <th>Expected Return</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${activeAllocations.length === 0 ? `
                <tr><td colspan="7" class="text-muted" style="text-align:center;">No active allocations.</td></tr>
              ` : activeAllocations.map(al => {
                const isOverdue = al.expectedReturnDate && new Date(al.expectedReturnDate) < new Date();
                return `
                  <tr>
                    <td style="font-weight:700; color:var(--accent-color);">${al.assetTag}</td>
                    <td style="font-weight:600;">${al.assetName}</td>
                    <td>${al.holder}</td>
                    <td>${al.department}</td>
                    <td>${al.allocatedDate}</td>
                    <td class="${isOverdue ? 'text-danger' : ''}" style="font-weight:${isOverdue ? '600' : 'normal'};">
                      ${al.expectedReturnDate || '<span class="text-muted">Open</span>'}
                    </td>
                    <td>
                      <div style="display:flex; gap:0.25rem;">
                        ${isManagerOrAdmin ? `<button class="btn btn-sm btn-secondary btn-return-asset" data-id="${al.id}">Return</button>` : ''}
                        <button class="btn btn-sm btn-secondary btn-transfer-request" data-assetid="${al.assetId}">Transfer</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- Right side: Transfer Workflow panel -->
      <div class="glass-card">
        <h2 class="card-title" style="margin-bottom:1rem;">Transfer Requests</h2>
        
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          ${visibleTransfers.length === 0 ? `
            <div class="text-muted" style="text-align:center; padding:1.5rem;">No transfer requests.</div>
          ` : visibleTransfers.map(t => {
            const asset = assets.find(a => a.id === t.assetId);
            const fromEmp = employees.find(e => e.id === t.fromEmployeeId);
            const toEmp = employees.find(e => e.id === t.toEmployeeId);
            
            let statusBadge = 'badge-retired';
            if (t.status === 'pending') statusBadge = 'badge-undermaintenance';
            if (t.status === 'approved') statusBadge = 'badge-available';
            if (t.status === 'rejected') statusBadge = 'badge-lost';

            return `
              <div class="audit-item-box" style="cursor:default; margin-bottom:0;">
                <div class="audit-title-line">
                  <span style="font-weight:700; color:var(--accent-color);">${asset ? asset.tag : 'Asset'}</span>
                  <span class="badge ${statusBadge}">${t.status}</span>
                </div>
                <div style="font-size:0.8rem; margin:0.35rem 0;">
                  <div><span class="text-muted">From:</span> <strong>${fromEmp ? fromEmp.name : 'Unknown'}</strong></div>
                  <div><span class="text-muted">To:</span> <strong>${toEmp ? toEmp.name : 'Unknown'}</strong></div>
                  <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem;">Date: ${t.requestDate}</div>
                </div>
                ${t.status === 'pending' && (isManagerOrAdmin || user.role === 'dept-head') ? `
                  <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
                    <button class="btn btn-sm btn-primary btn-approve-transfer" data-id="${t.id}" style="flex:1;">Approve</button>
                    <button class="btn btn-sm btn-danger btn-reject-transfer" data-id="${t.id}" style="flex:1;">Reject</button>
                  </div>
                ` : ''}
              </div>
            `;
          }).reverse().join('')}
        </div>
      </div>
      
    </div>
  `;

  // Bind Listeners
  if (isManagerOrAdmin) {
    document.getElementById('btn-create-allocation').onclick = () => showAllocationModal(null, user);
    
    container.querySelectorAll('.btn-return-asset').forEach(btn => {
      btn.onclick = () => showReturnModal(btn.dataset.id, user);
    });
  }

  container.querySelectorAll('.btn-transfer-request').forEach(btn => {
    btn.onclick = () => showAllocationModal(btn.dataset.assetid, user);
  });

  container.querySelectorAll('.btn-approve-transfer').forEach(btn => {
    btn.onclick = () => handleApproveTransfer(btn.dataset.id, user);
  });

  container.querySelectorAll('.btn-reject-transfer').forEach(btn => {
    btn.onclick = () => handleRejectTransfer(btn.dataset.id, user);
  });
}

function showAllocationModal(preSelectedAssetId = null, user) {
  const dbData = db.getDB();
  const assets = dbData.assets.filter(a => a.status !== 'Retired' && a.status !== 'Disposed');
  const employees = dbData.employees.filter(e => e.status === 'active');
  const depts = dbData.departments.filter(d => d.status === 'active');

  const asset = preSelectedAssetId ? assets.find(a => a.id === preSelectedAssetId) : null;
  const isCurrentlyAllocated = asset && asset.status === 'Allocated';

  let currentHolderName = '';
  if (isCurrentlyAllocated) {
    const activeAlloc = dbData.allocations.find(al => al.assetId === asset.id && al.status === 'active');
    if (activeAlloc) {
      if (activeAlloc.assigneeType === 'employee') {
        currentHolderName = employees.find(e => e.id === activeAlloc.assigneeId)?.name || 'Employee';
      } else {
        currentHolderName = depts.find(d => d.id === activeAlloc.assigneeId)?.name || 'Department';
      }
    }
  }

  let html = '';

  if (isCurrentlyAllocated) {
    // -------------------------------------------------------------
    // CONFLICT SCREEN: Asset is held by another user. Block Allocation, offer Transfer
    // -------------------------------------------------------------
    html = `
      <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: var(--border-radius); padding: 1.25rem; margin-bottom: 1.25rem;">
        <h4 style="color: var(--color-lost); font-weight: 700; margin-bottom: 0.25rem;">Double Allocation Conflicted</h4>
        <p style="font-size: 0.85rem; color: var(--text-muted);">
          Asset <strong>${asset.name} (${asset.tag})</strong> is currently assigned to <strong>${currentHolderName}</strong>. 
          The system prevents double-allocations.
        </p>
      </div>

      <form id="modal-transfer-form">
        <input type="hidden" id="trans-asset-id" value="${asset.id}">
        <div class="form-group">
          <label class="form-label" for="trans-target-emp">Transfer Recipient</label>
          <select id="trans-target-emp" class="form-control" required>
            <option value="">-- Choose Employee --</option>
            ${employees.map(e => `<option value="${e.id}">${e.name} (${e.email})</option>`).join('')}
          </select>
        </div>
      </form>
    `;

    openModal(
      `Conflict Check: ${asset.tag}`,
      html,
      [
        { text: 'Cancel', onClick: closeModal },
        {
          text: 'Request Transfer',
          class: 'btn-primary',
          onClick: (e) => {
            const assetId = document.getElementById('trans-asset-id').value;
            const targetEmpId = document.getElementById('trans-target-emp').value;

            if (!targetEmpId) return alert('Please select a recipient employee.');

            const activeAlloc = dbData.allocations.find(al => al.assetId === assetId && al.status === 'active');
            if (!activeAlloc || activeAlloc.assigneeType !== 'employee') {
              return alert('Transfers are only supported between individual employees holding active assets.');
            }

            const fromEmpId = activeAlloc.assigneeId;
            if (fromEmpId === targetEmpId) {
              return alert('Cannot transfer an asset to the same employee who already holds it.');
            }

            // Create transfer request
            const newTransfer = {
              id: `trans-${Date.now()}`,
              assetId,
              fromEmployeeId: fromEmpId,
              toEmployeeId: targetEmpId,
              requestDate: new Date().toISOString().split('T')[0],
              status: 'pending'
            };

            const dbFresh = db.getDB();
            dbFresh.transferRequests.push(newTransfer);
            
            // Notify target manager/head and recipient
            const fromName = employees.find(x => x.id === fromEmpId)?.name || 'Holder';
            const toName = employees.find(x => x.id === targetEmpId)?.name || 'Recipient';
            db.addLog(dbFresh, user.id, user.name, `Initiated transfer request for ${asset.tag} from ${fromName} to ${toName}`);
            db.saveDB(dbFresh);

            // Raise notification
            db.notify(targetEmpId, 'Incoming Transfer Request', `A transfer request is pending approval for ${asset.name} (${asset.tag}) to be assigned to you.`);
            db.notifyRole('manager', 'Pending Transfer Approval', `A new transfer request for ${asset.tag} requires Asset Manager approval.`);

            closeModal();
            
            const appShell = document.getElementById('content-pane');
            renderAllocationLayout(appShell, user);
          }
        }
      ]
    );
  } else {
    // -------------------------------------------------------------
    // REGULAR ALLOCATION SCREEN
    // -------------------------------------------------------------
    const isManagerOrAdmin = user.role === 'admin' || user.role === 'manager';
    if (!isManagerOrAdmin) {
      // Employees clicking transfer on available asset can't allocate directly, but can suggest allocations
      alert('Only Asset Managers or Admins can allocate available items.');
      return;
    }

    html = `
      <form id="modal-allocate-form">
        <div class="form-group">
          <label class="form-label" for="alloc-asset-id">Asset to Allocate</label>
          <select id="alloc-asset-id" class="form-control" required ${preSelectedAssetId ? 'disabled' : ''}>
            <option value="">-- Choose Asset --</option>
            ${assets.map(a => `<option value="${a.id}" ${preSelectedAssetId === a.id ? 'selected' : ''}>${a.tag} - ${a.name} (${a.status})</option>`).join('')}
          </select>
          ${preSelectedAssetId ? `<input type="hidden" id="alloc-asset-hidden-id" value="${preSelectedAssetId}">` : ''}
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="alloc-target-type">Assign To Type</label>
            <select id="alloc-target-type" class="form-control">
              <option value="employee">Employee</option>
              <option value="department">Department</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="alloc-target-id">Select Assignee</label>
            <select id="alloc-target-id" class="form-control" required>
              <!-- Populated dynamically via JS below -->
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="alloc-expected-return">Expected Return Date (Optional)</label>
          <input type="date" id="alloc-expected-return" class="form-control">
        </div>

        <div class="form-group">
          <label class="form-label" for="alloc-notes">Allocation Notes</label>
          <textarea id="alloc-notes" class="form-control" placeholder="Describe allocation reason..." rows="3"></textarea>
        </div>
      </form>
    `;

    openModal(
      'Allocate Physical Asset',
      html,
      [
        { text: 'Cancel', onClick: closeModal },
        {
          text: 'Assign Asset',
          class: 'btn-primary',
          onClick: (e) => {
            const form = document.getElementById('modal-allocate-form');
            if (!form.reportValidity()) return;

            const assetId = preSelectedAssetId || document.getElementById('alloc-asset-id').value;
            const assigneeType = document.getElementById('alloc-target-type').value;
            const assigneeId = document.getElementById('alloc-target-id').value;
            const expectedReturnDate = document.getElementById('alloc-expected-return').value;
            const notes = document.getElementById('alloc-notes').value;

            const dbFresh = db.getDB();
            const targetAsset = dbFresh.assets.find(a => a.id === assetId);

            if (!targetAsset) return alert('Asset not found');
            if (targetAsset.status !== 'Available') {
              closeModal();
              showAllocationModal(assetId, user); // re-route to conflict screen
              return;
            }

            // Create Allocation
            const newAlloc = {
              id: `alloc-${Date.now()}`,
              assetId,
              assigneeType,
              assigneeId,
              allocatedDate: new Date().toISOString().split('T')[0],
              expectedReturnDate: expectedReturnDate || null,
              actualReturnDate: null,
              notes,
              returnConditionNotes: null,
              status: 'active'
            };

            dbFresh.allocations.push(newAlloc);
            targetAsset.status = 'Allocated';

            db.addLog(dbFresh, user.id, user.name, `Allocated asset ${targetAsset.tag} to ${assigneeType === 'employee' ? 'Employee' : 'Department'} ${assigneeId}`);
            db.saveDB(dbFresh);

            // Trigger notification to recipient
            if (assigneeType === 'employee') {
              db.notify(assigneeId, 'Asset Assigned', `Asset ${targetAsset.name} (${targetAsset.tag}) has been allocated to you.`);
            } else {
              // Notify Department Head
              const dept = dbFresh.departments.find(d => d.id === assigneeId);
              if (dept && dept.headId) {
                db.notify(dept.headId, 'Department Asset Assigned', `Asset ${targetAsset.name} (${targetAsset.tag}) has been allocated to your department.`);
              }
            }

            closeModal();

            const appShell = document.getElementById('content-pane');
            renderAllocationLayout(appShell, user);
          }
        }
      ]
    );

    // Dynamic Assignee Populate Logic
    const targetTypeSelect = document.getElementById('alloc-target-type');
    const targetIdSelect = document.getElementById('alloc-target-id');

    const updateAssigneeSelect = () => {
      targetIdSelect.innerHTML = '';
      if (targetTypeSelect.value === 'employee') {
        targetIdSelect.innerHTML = employees.map(e => `<option value="${e.id}">${e.name} (${e.email})</option>`).join('');
      } else {
        targetIdSelect.innerHTML = depts.map(d => `<option value="${d.id}">${d.name} (Dept)</option>`).join('');
      }
    };
    updateAssigneeSelect();
    targetTypeSelect.onchange = updateAssigneeSelect;
  }
}

function showReturnModal(allocId, user) {
  const dbData = db.getDB();
  const allocation = dbData.allocations.find(a => a.id === allocId);
  const asset = dbData.assets.find(a => a.id === allocation.assetId);

  const html = `
    <form id="modal-return-form">
      <div style="margin-bottom:1rem; font-size:0.875rem;">
        Are you checking in asset <strong>${asset ? asset.name : 'Asset'} (${asset ? asset.tag : 'Tag'})</strong>?
      </div>
      <div class="form-group">
        <label class="form-label" for="return-condition">Condition Check-In State</label>
        <select id="return-condition" class="form-control">
          <option value="Excellent" ${asset && asset.condition === 'Excellent' ? 'selected' : ''}>Excellent</option>
          <option value="Good" ${asset && asset.condition === 'Good' ? 'selected' : ''}>Good</option>
          <option value="Fair" ${asset && asset.condition === 'Fair' ? 'selected' : ''}>Fair</option>
          <option value="Poor" ${asset && asset.condition === 'Poor' ? 'selected' : ''}>Poor</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="return-notes">Check-In Return Notes</label>
        <textarea id="return-notes" class="form-control" placeholder="E.g. Returned with adapter and laptop bag. Clean condition." rows="3" required></textarea>
      </div>
    </form>
  `;

  openModal(
    'Asset Check-In Return',
    html,
    [
      { text: 'Cancel', onClick: closeModal },
      {
        text: 'Confirm Return',
        class: 'btn-primary',
        onClick: (e) => {
          const notes = document.getElementById('return-notes').value;
          const condition = document.getElementById('return-condition').value;

          if (!notes) return alert('Return notes are required.');

          const dbFresh = db.getDB();
          const targetAlloc = dbFresh.allocations.find(a => a.id === allocId);
          const targetAsset = dbFresh.assets.find(a => a.id === targetAlloc.assetId);

          targetAlloc.actualReturnDate = new Date().toISOString().split('T')[0];
          targetAlloc.status = 'returned';
          targetAlloc.returnConditionNotes = notes;

          targetAsset.status = 'Available';
          targetAsset.condition = condition;

          db.addLog(dbFresh, user.id, user.name, `Processed check-in return for ${targetAsset.tag} with condition ${condition}`);
          db.saveDB(dbFresh);

          // Raise notification to assignee
          if (targetAlloc.assigneeType === 'employee') {
            db.notify(targetAlloc.assigneeId, 'Asset Returned', `Your return check-in for ${targetAsset.name} has been processed successfully.`);
          }

          closeModal();

          const appShell = document.getElementById('content-pane');
          renderAllocationLayout(appShell, user);
        }
      }
    ]
  );
}

function handleApproveTransfer(transferId, user) {
  const dbData = db.getDB();
  const transfer = dbData.transferRequests.find(t => t.id === transferId);
  const asset = dbData.assets.find(a => a.id === transfer.assetId);
  
  if (!transfer || !asset) return;

  const currentActiveAlloc = dbData.allocations.find(al => al.assetId === transfer.assetId && al.status === 'active');
  if (currentActiveAlloc) {
    currentActiveAlloc.actualReturnDate = new Date().toISOString().split('T')[0];
    currentActiveAlloc.status = 'transferred';
    currentActiveAlloc.returnConditionNotes = `Transferred directly to ${dbData.employees.find(e => e.id === transfer.toEmployeeId)?.name || 'Recipient'}`;
  }

  // Create New Allocation for recipient
  const newAlloc = {
    id: `alloc-${Date.now()}`,
    assetId: transfer.assetId,
    assigneeType: 'employee',
    assigneeId: transfer.toEmployeeId,
    allocatedDate: new Date().toISOString().split('T')[0],
    expectedReturnDate: null,
    actualReturnDate: null,
    notes: `Acquired via approved transfer request from ${dbData.employees.find(e => e.id === transfer.fromEmployeeId)?.name || 'Previous Holder'}`,
    returnConditionNotes: null,
    status: 'active'
  };

  dbData.allocations.push(newAlloc);
  
  // Set status
  asset.status = 'Allocated';
  
  // Update transfer request status
  transfer.status = 'approved';
  transfer.approvalDate = new Date().toISOString().split('T')[0];
  transfer.approvedBy = user.id;

  const fromName = dbData.employees.find(x => x.id === transfer.fromEmployeeId)?.name || 'Previous';
  const toName = dbData.employees.find(x => x.id === transfer.toEmployeeId)?.name || 'Recipient';
  
  db.addLog(dbData, user.id, user.name, `Approved transfer of ${asset.tag} from ${fromName} to ${toName}`);
  db.saveDB(dbData);

  // Notify recipient and previous holder
  db.notify(transfer.toEmployeeId, 'Transfer Approved', `The transfer of ${asset.name} (${asset.tag}) to you was approved.`);
  db.notify(transfer.fromEmployeeId, 'Transfer Completed', `The transfer of ${asset.name} (${asset.tag}) to ${toName} has been finalized.`);

  // Refresh
  const appShell = document.getElementById('content-pane');
  renderAllocationLayout(appShell, user);
}

function handleRejectTransfer(transferId, user) {
  const dbData = db.getDB();
  const transfer = dbData.transferRequests.find(t => t.id === transferId);
  const asset = dbData.assets.find(a => a.id === transfer.assetId);

  if (!transfer) return;

  transfer.status = 'rejected';
  transfer.approvalDate = new Date().toISOString().split('T')[0];
  transfer.approvedBy = user.id;

  db.addLog(dbData, user.id, user.name, `Rejected transfer request for ${asset ? asset.tag : 'Asset'} by ${user.name}`);
  db.saveDB(dbData);

  // Notify recipient
  db.notify(transfer.toEmployeeId, 'Transfer Request Rejected', `Your transfer request for ${asset ? asset.name : 'Asset'} was rejected by management.`);

  // Refresh
  const appShell = document.getElementById('content-pane');
  renderAllocationLayout(appShell, user);
}
