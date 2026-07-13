import { db } from './db.js';
import { auth } from './auth.js';

// Screens - Static Imports
import { renderDashboard } from './Screens/dashboard.js';
import { renderOrgSetup } from './Screens/orgsetup.js';
import { renderAssets } from './Screens/assets.js';
import { renderAllocation } from './Screens/allocation.js';
import { renderBooking } from './Screens/book.js';
import { renderMaintenance } from './Screens/maintanance.js';
import { renderAudit } from './Screens/audit.js';
import { renderReports } from './Screens/report.js';
import { renderLogs } from './Screens/logs.js';

// Global Modal Helpers
export function openModal(title, bodyHTML, footerButtons = []) {
  const modal = document.getElementById('global-modal');
  document.getElementById('modal-title').textContent = title;
  
  const body = document.getElementById('modal-body');
  body.innerHTML = bodyHTML;
  
  const footer = document.getElementById('modal-footer');
  footer.innerHTML = '';
  
  footerButtons.forEach(btnConfig => {
    const btn = document.createElement('button');
    btn.className = `btn ${btnConfig.class || 'btn-secondary'}`;
    btn.textContent = btnConfig.text;
    btn.onclick = (e) => btnConfig.onClick(e, body);
    footer.appendChild(btn);
  });
  
  modal.classList.add('active');
}

export function closeModal() {
  document.getElementById('global-modal').classList.remove('active');
}

class AppRouter {
  constructor() {
    this.routes = {
      'dashboard': { render: renderDashboard, roles: ['admin', 'manager', 'dept-head', 'employee'] },
      'orgSetup': { render: renderOrgSetup, roles: ['admin'] },
      'assets': { render: renderAssets, roles: ['admin', 'manager', 'dept-head', 'employee'] },
      'allocation': { render: renderAllocation, roles: ['admin', 'manager', 'dept-head'] },
      'booking': { render: renderBooking, roles: ['admin', 'manager', 'dept-head', 'employee'] },
      'maintenance': { render: renderMaintenance, roles: ['admin', 'manager', 'dept-head', 'employee'] },
      'audit': { render: renderAudit, roles: ['admin', 'manager'] },
      'reports': { render: renderReports, roles: ['admin', 'manager'] },
      'logs': { render: renderLogs, roles: ['admin', 'manager', 'dept-head', 'employee'] }
    };
    
    this.currentHash = '';
  }

  init() {
    // Listen for routes
    window.addEventListener('hashchange', () => this.handleRouting());
    
    // Close modal listener
    document.getElementById('modal-close').addEventListener('click', closeModal);
    
    // Setup login/logout forms
    document.getElementById('auth-form').addEventListener('submit', (e) => this.handleLogin(e));
    document.getElementById('auth-switch-link').addEventListener('click', () => this.toggleAuthMode());
    document.getElementById('shell-logout-btn').addEventListener('click', () => this.handleLogout());
    
    // Quick role switcher
    document.getElementById('role-quick-switcher').addEventListener('change', (e) => this.handleQuickSwitch(e));
    
    // Notification dropdown toggle
    const bell = document.getElementById('notif-bell');
    const dropdown = document.getElementById('notif-dropdown');
    bell.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
      if (!dropdown.classList.contains('hidden')) {
        this.renderNotifications();
      }
    });
    
    document.getElementById('notif-clear-all').addEventListener('click', () => this.clearAllNotifications());
    
    document.addEventListener('click', (e) => {
      if (!dropdown.classList.contains('hidden') && !dropdown.contains(e.target) && !bell.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
    
    // Check initial state
    this.refreshShellState();
    
    // Run notification overdue scanning check simulation
    setInterval(() => this.backgroundScan(), 8000);
  }

  toggleAuthMode() {
    const title = document.getElementById('auth-title');
    const link = document.getElementById('auth-switch-link');
    const submitBtn = document.getElementById('auth-submit-btn');
    const nameGroup = document.getElementById('signup-name-group');
    
    if (nameGroup.classList.contains('hidden')) {
      // Switch to Signup
      title.textContent = 'Create an Account';
      submitBtn.textContent = 'Sign Up';
      link.textContent = 'Already have an account? Log in';
      nameGroup.classList.remove('hidden');
    } else {
      // Switch to Login
      title.textContent = 'Log In to Your Account';
      submitBtn.textContent = 'Log In';
      link.textContent = "Don't have an account? Sign up";
      nameGroup.classList.add('hidden');
    }
  }

  handleLogin(e) {
    e.preventDefault();
    const nameInput = document.getElementById('auth-name');
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    const nameGroup = document.getElementById('signup-name-group');
    
    try {
      if (nameGroup.classList.contains('hidden')) {
        // Log in
        auth.login(emailInput.value, passwordInput.value);
      } else {
        // Sign up
        auth.signup(nameInput.value, emailInput.value, passwordInput.value);
      }
      
      this.refreshShellState();
      
      // Clear inputs
      nameInput.value = '';
      emailInput.value = '';
      passwordInput.value = '';
    } catch (err) {
      alert(err.message);
    }
  }

  handleLogout() {
    auth.logout();
    this.refreshShellState();
  }

  handleQuickSwitch(e) {
    const userId = e.target.value;
    if (!userId) return;
    
    localStorage.setItem('assetflow_session', userId);
    this.refreshShellState();
    db.logAction(userId, `Demo role switcher used to change session`);
  }

  refreshShellState() {
    const user = auth.getCurrentUser();
    const authContainer = document.getElementById('auth-container');
    const appShell = document.getElementById('app-shell');
    const switcher = document.getElementById('role-quick-switcher');
    
    if (user) {
      // Logged in
      authContainer.classList.add('hidden');
      appShell.classList.remove('hidden');
      
      // Update quick switcher selection
      switcher.value = user.id;
      
      // Update sidebar footer
      document.getElementById('shell-user-name').textContent = user.name;
      document.getElementById('shell-user-role').textContent = user.role.replace('-', ' ');
      document.getElementById('shell-user-avatar').textContent = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      
      // Render layout sidebar nav links
      this.renderSidebarNav(user.role);
      
      // Initial notification counter check
      this.updateNotificationBadge();
      
      // Force routing
      if (!window.location.hash || window.location.hash === '#') {
        window.location.hash = '#dashboard';
      } else {
        this.handleRouting();
      }
    } else {
      // Logged out
      appShell.classList.add('hidden');
      authContainer.classList.remove('hidden');
      
      // Clear switcher selection
      switcher.value = '';
      
      // Reset signup name visibility
      document.getElementById('signup-name-group').classList.add('hidden');
      document.getElementById('auth-title').textContent = 'Log In to Your Account';
      document.getElementById('auth-submit-btn').textContent = 'Log In';
      document.getElementById('auth-switch-link').textContent = "Don't have an account? Sign up";
    }
  }

  renderSidebarNav(role) {
    const nav = document.getElementById('sidebar-nav');
    nav.innerHTML = '';
    
    const menuItems = [
      { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
      { id: 'orgSetup', label: 'Organization Setup', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
      { id: 'assets', label: 'Asset Register', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
      { id: 'allocation', label: 'Allocations & Transfers', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
      { id: 'booking', label: 'Resource Booking', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
      { id: 'maintenance', label: 'Maintenance Requests', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
      { id: 'audit', label: 'Asset Audits', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
      { id: 'reports', label: 'Reports & Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2zm9-1v-4a2 2 0 00-2-2h-2a2 2 0 00-2 2v4a2 2 0 002 2h2a2 2 0 002-2z' },
      { id: 'logs', label: 'Activity Logs', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' }
    ];

    menuItems.forEach(item => {
      const config = this.routes[item.id];
      if (config.roles.includes(role)) {
        const a = document.createElement('a');
        a.className = 'nav-item';
        a.href = `#${item.id}`;
        a.id = `nav-${item.id}`;
        a.innerHTML = `
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${item.icon}"></path>
          </svg>
          <span>${item.label}</span>
        `;
        nav.appendChild(a);
      }
    });
  }

  handleRouting() {
    const user = auth.getCurrentUser();
    if (!user) return; // refreshShellState handles auth check

    let hash = window.location.hash.substring(1);
    if (!hash) hash = 'dashboard';
    
    // Strip query params if any
    const hashBase = hash.split('?')[0];

    const config = this.routes[hashBase];
    if (!config || !config.roles.includes(user.role)) {
      // Unallowed role page, fallback to dashboard
      window.location.hash = '#dashboard';
      return;
    }

    this.currentHash = hash;
    
    // Highlight sidebar link
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeLink = document.getElementById(`nav-${hashBase}`);
    if (activeLink) activeLink.classList.add('active');

    // Update screen title
    const navTextEl = activeLink ? activeLink.querySelector('span') : null;
    document.getElementById('screen-title').textContent = navTextEl ? navTextEl.textContent : 'AssetFlow';

    // Render screen
    const container = document.getElementById('content-pane');
    container.innerHTML = ''; // reset view container
    
    // Fire render logic
    config.render(container, user);
  }

  // Background notifications alert logic
  backgroundScan() {
    const user = auth.getCurrentUser();
    if (!user) return;

    const dbData = db.getDB();
    const assets = dbData.assets;
    const allocations = dbData.allocations;
    const now = new Date();
    let hasAlerted = false;

    // Check allocations overdue expectedReturnDate
    allocations.forEach(alloc => {
      if (alloc.status === 'active' && alloc.expectedReturnDate) {
        const expected = new Date(alloc.expectedReturnDate);
        if (expected < now) {
          // Check if notification already raised
          const asset = assets.find(a => a.id === alloc.assetId);
          const notifs = dbData.notifications;
          const notificationExists = notifs.some(n => 
            n.userId === alloc.assigneeId && 
            n.title === 'Asset Overdue Alert' && 
            n.message.includes(asset?.tag)
          );

          if (!notificationExists && asset) {
            db.notify(
              alloc.assigneeId, 
              'Asset Overdue Alert', 
              `Your allocation of ${asset.name} (${asset.tag}) was expected back on ${alloc.expectedReturnDate}. Please return it or coordinate a transfer.`
            );
            hasAlerted = true;
          }
        }
      }
    });

    if (hasAlerted) {
      this.updateNotificationBadge();
    }
  }

  // Update navbar badge count
  updateNotificationBadge() {
    const user = auth.getCurrentUser();
    if (!user) return;

    const notifications = db.getAll('notifications');
    const unreadCount = notifications.filter(n => n.userId === user.id && !n.read).length;
    const badge = document.getElementById('notif-count-badge');
    
    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  renderNotifications() {
    const user = auth.getCurrentUser();
    const list = document.getElementById('notif-list');
    list.innerHTML = '';
    
    const notifications = db.getAll('notifications').filter(n => n.userId === user.id);
    
    if (notifications.length === 0) {
      list.innerHTML = '<div class="notif-empty">No notifications yet</div>';
      return;
    }

    notifications.forEach(n => {
      const div = document.createElement('div');
      div.className = `notif-item ${n.read ? '' : 'unread'}`;
      
      // Calculate human time difference
      const timeDiff = new Date() - new Date(n.date);
      const mins = Math.floor(timeDiff / 60000);
      let timeText = 'Just now';
      if (mins > 0 && mins < 60) timeText = `${mins}m ago`;
      else if (mins >= 60 && mins < 1440) timeText = `${Math.floor(mins / 60)}h ago`;
      else if (mins >= 1440) timeText = `${Math.floor(mins / 1440)}d ago`;

      div.innerHTML = `
        <span class="notif-item-title">${n.title}</span>
        <span class="notif-item-msg">${n.message}</span>
        <span class="notif-item-time">${timeText}</span>
      `;
      div.onclick = () => {
        if (!n.read) {
          const dbData = db.getDB();
          const target = dbData.notifications.find(x => x.id === n.id);
          if (target) target.read = true;
          db.saveDB(dbData);
          div.classList.remove('unread');
          this.updateNotificationBadge();
        }
      };
      list.appendChild(div);
    });
  }

  clearAllNotifications() {
    const user = auth.getCurrentUser();
    if (!user) return;
    
    const dbData = db.getDB();
    dbData.notifications.forEach(n => {
      if (n.userId === user.id) n.read = true;
    });
    db.saveDB(dbData);
    
    this.renderNotifications();
    this.updateNotificationBadge();
  }
}

// Global router instantiation
export const router = new AppRouter();

// Initialize app when DOM loaded
document.addEventListener('DOMContentLoaded', () => {
  router.init();
});
