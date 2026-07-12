import { db } from '../db.js';
import { openModal, closeModal } from '../app.js';

let selectedAssetId = null; // Currently viewed bookable asset
let selectedDateStr = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

export function renderBooking(container, user) {
  const dbData = db.getDB();
  const bookableAssets = dbData.assets.filter(a => a.isBookable && a.status !== 'Retired' && a.status !== 'Disposed');

  if (bookableAssets.length > 0 && !selectedAssetId) {
    selectedAssetId = bookableAssets[0].id;
  }

  renderBookingLayout(container, user, bookableAssets);
}

function renderBookingLayout(container, user, bookableAssets) {
  const dbData = db.getDB();
  const activeAsset = bookableAssets.find(a => a.id === selectedAssetId);
  const bookings = dbData.bookings.filter(b => b.assetId === selectedAssetId);
  const employees = dbData.employees;

  // Filter bookings for the selected date
  const dailyBookings = bookings.filter(b => b.startDate.startsWith(selectedDateStr));

  // Sort bookings chronologically by start time
  dailyBookings.sort((a, b) => a.startDate.localeCompare(b.startDate));

  container.innerHTML = `
    <div class="booking-split">
      
      <!-- Left Column: Resource Selector -->
      <div class="resource-list">
        <h3 style="font-size:0.95rem; font-weight:700; margin-bottom:0.5rem; text-transform:uppercase; letter-spacing:0.02em;">Bookable Resources</h3>
        ${bookableAssets.length === 0 ? `
          <p class="text-muted" style="font-size:0.85rem;">No bookable resources registered.</p>
        ` : bookableAssets.map(a => `
          <div class="resource-card ${a.id === selectedAssetId ? 'active' : ''}" data-id="${a.id}">
            <div class="resource-name">${a.name}</div>
            <div class="resource-details">Tag: ${a.tag} • Location: ${a.location}</div>
          </div>
        `).join('')}
      </div>

      <!-- Right Column: Interactive Scheduler -->
      <div class="calendar-container">
        ${!activeAsset ? `
          <div class="text-muted" style="text-align:center; padding:3rem;">Select a resource from the sidebar to view scheduling.</div>
        ` : `
          <!-- Header with selection and Book Action -->
          <div class="calendar-header">
            <div>
              <h2 style="font-size:1.2rem; font-weight:700;">${activeAsset.name} Schedule</h2>
              <span class="text-muted" style="font-size:0.8rem;">Tag: ${activeAsset.tag} • Condition: ${activeAsset.condition}</span>
            </div>
            <button class="btn btn-primary" id="btn-open-booking-modal">
              + Reserve Time Slot
            </button>
          </div>

          <!-- Date Selector Control Bar -->
          <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.15); padding:0.75rem 1rem; border-radius:var(--border-radius-sm); border:1px solid var(--border-color);">
            <button class="btn btn-sm btn-secondary" id="btn-prev-day">◀ Previous Day</button>
            <div style="font-weight:700; font-size:1rem;" id="current-calendar-day-label">
              ${new Date(selectedDateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <button class="btn btn-sm btn-secondary" id="btn-next-day">Next Day ▶</button>
          </div>

          <!-- Timeline Grid -->
          <div class="daily-bookings-panel">
            <h3 class="daily-bookings-header">Reservations on this date</h3>
            <div class="booking-timeline-list">
              ${dailyBookings.length === 0 ? `
                <div class="text-muted" style="text-align:center; padding:2rem; background:rgba(255,255,255,0.01); border:1px solid var(--border-color); border-radius:var(--border-radius-sm);">
                  No bookings scheduled for this date. All time slots are open.
                </div>
              ` : dailyBookings.map(b => {
                const bookUser = employees.find(e => e.id === b.employeeId);
                const isUserBooking = b.employeeId === user.id;
                
                // Formats start and end times
                const tStart = b.startDate.split('T')[1];
                const tEnd = b.endDate.split('T')[1];
                
                let borderStyle = 'border-left-color: var(--color-reserved);';
                if (b.status === 'Cancelled') borderStyle = 'border-left-color: var(--color-retired); opacity: 0.55;';
                if (b.status === 'Completed') borderStyle = 'border-left-color: var(--color-available);';

                return `
                  <div class="booking-timeline-item" style="${borderStyle}">
                    <div class="booking-time">${tStart} - ${tEnd}</div>
                    <div class="booking-user">
                      <strong>Reserved by:</strong> ${bookUser ? bookUser.name : 'Unknown Employee'} 
                      <span class="text-muted" style="font-size:0.75rem;">(${b.status})</span>
                    </div>
                    <div>
                      ${b.status === 'Upcoming' && (isUserBooking || user.role === 'admin' || user.role === 'manager') ? `
                        <button class="btn btn-sm btn-danger btn-cancel-booking" data-id="${b.id}">Cancel</button>
                      ` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `}
      </div>
    </div>
  `;

  // Bind Sidebar items Click
  container.querySelectorAll('.resource-card').forEach(card => {
    card.onclick = () => {
      selectedAssetId = card.dataset.id;
      renderBookingLayout(container, user, bookableAssets);
    };
  });

  // Bind Navigation Days
  const prevBtn = document.getElementById('btn-prev-day');
  if (prevBtn) {
    prevBtn.onclick = () => {
      const d = new Date(selectedDateStr);
      d.setDate(d.getDate() - 1);
      selectedDateStr = d.toISOString().split('T')[0];
      renderBookingLayout(container, user, bookableAssets);
    };
  }

  const nextBtn = document.getElementById('btn-next-day');
  if (nextBtn) {
    nextBtn.onclick = () => {
      const d = new Date(selectedDateStr);
      d.setDate(d.getDate() + 1);
      selectedDateStr = d.toISOString().split('T')[0];
      renderBookingLayout(container, user, bookableAssets);
    };
  }

  // Bind Reservation Modal Open
  const btnReserve = document.getElementById('btn-open-booking-modal');
  if (btnReserve) {
    btnReserve.onclick = () => showReserveModal(activeAsset, user, container, bookableAssets);
  }

  // Bind Cancel button triggers
  container.querySelectorAll('.btn-cancel-booking').forEach(btn => {
    btn.onclick = () => handleCancelBooking(btn.dataset.id, container, user, bookableAssets);
  });
}

function showReserveModal(asset, user, container, bookableAssets) {
  const html = `
    <form id="modal-booking-form">
      <div class="form-group">
        <label class="form-label">Selected Resource</label>
        <input type="text" class="form-control" value="${asset.name} (${asset.tag})" disabled>
      </div>

      <div class="form-group">
        <label class="form-label" for="book-date">Reservation Date</label>
        <input type="date" id="book-date" class="form-control" value="${selectedDateStr}" required>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="book-start">Start Time</label>
          <input type="time" id="book-start" class="form-control" value="09:00" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="book-end">End Time</label>
          <input type="time" id="book-end" class="form-control" value="10:00" required>
        </div>
      </div>
      
      <p class="text-muted" style="font-size:0.75rem; margin-top:0.25rem;">
        Note: The system checks for any overlapping meetings and will block conflicts automatically.
      </p>
    </form>
  `;

  openModal(
    'Book Shared Resource',
    html,
    [
      { text: 'Cancel', onClick: closeModal },
      {
        text: 'Confirm Booking',
        class: 'btn-primary',
        onClick: (e) => {
          const form = document.getElementById('modal-booking-form');
          if (!form.reportValidity()) return;

          const date = document.getElementById('book-date').value;
          const start = document.getElementById('book-start').value;
          const end = document.getElementById('book-end').value;

          const startISO = `${date}T${start}`;
          const endISO = `${date}T${end}`;

          if (startISO >= endISO) {
            return alert('Start time must be before End time.');
          }

          // -------------------------------------------------------------
          // OVERLAP VALIDATION ENGINE
          // -------------------------------------------------------------
          const dbFresh = db.getDB();
          const existingBookings = dbFresh.bookings.filter(b => 
            b.assetId === asset.id && b.status !== 'Cancelled'
          );

          let overlapFound = null;

          for (const b of existingBookings) {
            // Overlap check condition:
            // (StartA < EndB) AND (EndA > StartB)
            if (startISO < b.endDate && endISO > b.startDate) {
              overlapFound = b;
              break;
            }
          }

          if (overlapFound) {
            const holder = dbFresh.employees.find(e => e.id === overlapFound.employeeId)?.name || 'Another employee';
            const tS = overlapFound.startDate.split('T')[1];
            const tE = overlapFound.endDate.split('T')[1];
            return alert(`Booking Conflict Rejected!\n\nThis time overlaps with an existing reservation by ${holder} from ${tS} to ${tE}.`);
          }

          // Save Booking
          const newBooking = {
            id: `book-${Date.now()}`,
            assetId: asset.id,
            employeeId: user.id,
            startDate: startISO,
            endDate: endISO,
            status: 'Upcoming'
          };

          dbFresh.bookings.push(newBooking);
          db.addLog(dbFresh, user.id, user.name, `Booked ${asset.name} (${asset.tag}) for ${startISO.replace('T', ' ')} to ${endISO.replace('T', ' ')}`);
          db.saveDB(dbFresh);

          // Raise confirmation alert notification
          db.notify(user.id, 'Booking Confirmed', `Your booking for ${asset.name} on ${date} (${start}-${end}) is confirmed.`);
          
          closeModal();
          
          // Re-render calendar
          selectedDateStr = date;
          renderBookingLayout(container, user, bookableAssets);
        }
      }
    ]
  );
}

function handleCancelBooking(bookingId, container, user, bookableAssets) {
  if (!confirm('Are you sure you want to cancel this booking?')) return;

  const dbData = db.getDB();
  const booking = dbData.bookings.find(b => b.id === bookingId);
  const asset = dbData.assets.find(a => a.id === booking.assetId);

  if (booking) {
    booking.status = 'Cancelled';
    db.addLog(dbData, user.id, user.name, `Cancelled booking of ${asset ? asset.name : 'Resource'} scheduled for ${booking.startDate}`);
    db.saveDB(dbData);
    
    db.notify(booking.employeeId, 'Booking Cancelled', `Your booking for ${asset ? asset.name : 'Resource'} has been cancelled.`);
  }

  renderBookingLayout(container, user, bookableAssets);
}
