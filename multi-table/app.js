'use strict';

// ============================================================
//  数据库层 (localStorage)
// ============================================================
const DB = {
  KEY: 'pms_multitable_db',
  data: null,

  init() {
    const stored = localStorage.getItem(this.KEY);
    if (stored) {
      this.data = JSON.parse(stored);
    } else {
      this.data = this.seed();
      this.save();
    }
  },

  save() {
    localStorage.setItem(this.KEY, JSON.stringify(this.data));
  },

  reset() {
    this.data = this.seed();
    this.save();
  },

  seed() {
    return {
      users: [
        { id: 1, username: 'admin', password: 'admin123', name: '系统管理员', role: '超级管理员', projectId: null, isActive: true }
      ],
      projects: [
        { id: 1, name: '公司待用库', manager: '系统', startDate: '', estimatedEndDate: '', remark: '虚拟项目，存放闲置设备', isVirtual: true }
      ],
      devices: [],
      categories: [
        { id: 1, name: '台式主机' },
        { id: 2, name: '笔记本' },
        { id: 3, name: '显示器' },
        { id: 4, name: '打印机' },
        { id: 5, name: '扫描仪' }
      ],
      leaseContracts: [],
      purchaseOrders: [],
      operationLogs: []
    };
  },

  get(table) { return this.data[table] || []; },
  getById(table, id) { return this.get(table).find(r => r.id === id); },

  insert(table, record) {
    record.id = this.nextId(table);
    record.createdAt = record.createdAt || new Date().toISOString();
    this.data[table].push(record);
    this.save();
    return record;
  },

  update(table, id, updates) {
    const record = this.getById(table, id);
    if (record) { Object.assign(record, updates); this.save(); }
    return record;
  },

  delete(table, id) {
    this.data[table] = this.data[table].filter(r => r.id !== id);
    this.save();
  },

  nextId(table) {
    const records = this.get(table);
    return records.length > 0 ? Math.max(...records.map(r => r.id)) + 1 : 1;
  }
};

// ============================================================
//  操作日志
// ============================================================
const Logger = {
  log(action, deviceSerial, detail) {
    const user = Auth.user();
    DB.insert('operationLogs', {
      userId: user ? user.id : null,
      username: user ? user.name : '系统',
      action,
      deviceSerial: deviceSerial || '',
      detail: detail || '',
      timestamp: new Date().toISOString()
    });
  }
};

// ============================================================
//  认证
// ============================================================
const Auth = {
  SESSION_KEY: 'pms_session',

  init() {
    // 确保 admin 账户存在
    const admin = DB.get('users').find(u => u.username === 'admin');
    if (!admin) {
      DB.insert('users', { username: 'admin', password: 'admin123', name: '系统管理员', role: '超级管理员', projectId: null, isActive: true });
    }
  },

  login(username, password) {
    const user = DB.get('users').find(u => u.username === username && u.password === password);
    if (!user) return false;
    if (user.isActive === false) return 'disabled';
    localStorage.setItem(this.SESSION_KEY, String(user.id));
    return true;
  },

  logout() {
    localStorage.removeItem(this.SESSION_KEY);
  },

  user() {
    const id = parseInt(localStorage.getItem(this.SESSION_KEY));
    if (!id) return null;
    return DB.getById('users', id);
  },

  hasRole(...roles) {
    const user = this.user();
    return user && roles.includes(user.role);
  },

  isAdmin() { return this.hasRole('超级管理员'); }
};

// ============================================================
//  工具函数
// ============================================================
const Utils = {
  toast(msg, type = 'info') {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-msg">${msg}</span>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 3000);
  },

  modal(title, bodyHtml, footerHtml = '', size = '') {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal');
    modal.className = 'modal' + (size ? ' modal-' + size : '');
    modal.innerHTML = `
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    `;
    overlay.classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  },

  confirm(msg) {
    return window.confirm(msg);
  },

  formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },

  formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return this.formatDate(dateStr) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  },

  today() {
    return this.formatDate(new Date().toISOString());
  },

  escape(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  },

  exportCSV(headers, rows, filename) {
    const BOM = '\uFEFF';
    const csv = [headers.join(','), ...rows.map(r => r.map(c => {
      const s = String(c === null || c === undefined ? '' : c);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(','))].join('\n');
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  downloadTemplate() {
    const headers = ['类别', '品牌', '型号', '序列号', '资产编号', '属性', '采购日期', '采购单价', '供应商', '质保截止', '备注'];
    const rows = [
      ['台式主机', '联想', 'ThinkPad', 'SN-001', 'AST-001', '自有', '2024-01-15', '5000', '联想代理', '2027-01-15', '备注信息'],
      ['笔记本', '华为', 'MateBook', 'SN-002', 'AST-002', '自有', '2024-02-20', '6500', '华为代理', '2027-02-20', '']
    ];
    this.exportCSV(headers, rows, '设备导入模板.csv');
  },

  parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const result = [];
    for (let i = 0; i < lines.length; i++) {
      const row = [];
      let current = '', inQuotes = false;
      for (let j = 0; j < lines[i].length; j++) {
        const ch = lines[i][j];
        if (ch === '"') {
          if (inQuotes && lines[i][j + 1] === '"') { current += '"'; j++; }
          else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          row.push(current); current = '';
        } else { current += ch; }
      }
      row.push(current);
      result.push(row);
    }
    return result;
  },

  statusBadge(status) {
    const map = {
      '闲置': 'badge-muted', '在用': 'badge-success',
      '维修中': 'badge-warning', '已报废': 'badge-danger', '正常使用': 'badge-success'
    };
    return `<span class="badge ${map[status] || 'badge-muted'}">${this.escape(status || '-')}</span>`;
  },

  ownershipBadge(ownership) {
    return `<span class="badge ${ownership === '租赁' ? 'badge-info' : 'badge-muted'}">${this.escape(ownership || '自有')}</span>`;
  },

  daysUntil(dateStr) {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  }
};

// ============================================================
//  导航
// ============================================================
const Nav = {
  current: 'dashboard',
  deviceView: 'grid',
  selectedDevices: new Set(),
  searchKeyword: '',
  filters: { project: '', status: '', category: '', ownership: '' },

  menus: [
    { section: '概览' },
    { id: 'dashboard', label: '仪表盘', icon: '📊' },
    { section: '资产管理' },
    { id: 'devices', label: '设备管理', icon: '💻' },
    { id: 'projects', label: '项目管理', icon: '📁' },
    { id: 'lease', label: '租赁管理', icon: '📜' },
    { section: '业务管理' },
    { id: 'purchase', label: '采购管理', icon: '🛒' },
    { id: 'logs', label: '操作日志', icon: '📝' },
    { section: '系统' },
    { id: 'users', label: '用户管理', icon: '👥', adminOnly: true },
    { id: 'settings', label: '系统设置', icon: '⚙️', adminOnly: true }
  ],

  renderSidebar() {
    const user = Auth.user();
    const nav = document.getElementById('sidebar-nav');
    let html = '';
    for (const item of this.menus) {
      if (item.section) { html += `<div class="nav-section">${item.section}</div>`; continue; }
      if (item.adminOnly && !Auth.isAdmin()) continue;
      const active = this.current === item.id ? 'active' : '';
      html += `<a class="${active}" onclick="Nav.go('${item.id}')"><span class="nav-icon">${item.icon}</span><span>${item.label}</span></a>`;
    }
    nav.innerHTML = html;

    const footer = document.getElementById('sidebar-footer');
    const initial = user.name ? user.name.charAt(0) : '?';
    footer.innerHTML = `
      <div class="user-info">
        <div class="user-avatar">${initial}</div>
        <div>
          <div class="user-name">${Utils.escape(user.name)}</div>
          <div class="user-role">${Utils.escape(user.role)}</div>
        </div>
      </div>
      <a class="logout-btn" onclick="App.logout()"><span>🚪</span><span>退出登录</span></a>
    `;
  },

  go(view) {
    this.current = view;
    this.selectedDevices.clear();
    this.searchKeyword = '';
    this.filters = { project: '', status: '', category: '', ownership: '' };
    this.renderSidebar();
    this.renderTopbar();
    this.renderContent();
  },

  renderTopbar() {
    const topbar = document.getElementById('topbar');
    const titles = {
      dashboard: '仪表盘', devices: '设备管理', projects: '项目管理',
      lease: '租赁管理', purchase: '采购管理', logs: '操作日志',
      users: '用户管理', settings: '系统设置'
    };

    if (this.current === 'dashboard') {
      topbar.innerHTML = `<div class="topbar-title">${titles[this.current]}</div>`;
      return;
    }

    if (this.current === 'devices') {
      const projects = DB.get('projects');
      const categories = DB.get('categories');
      topbar.innerHTML = `
        <div class="topbar-title">${titles[this.current]}</div>
        <div class="view-switcher">
          <button class="${this.deviceView === 'grid' ? 'active' : ''}" onclick="Nav.setDeviceView('grid')">📊 网格视图</button>
          <button class="${this.deviceView === 'kanban' ? 'active' : ''}" onclick="Nav.setDeviceView('kanban')">📋 看板视图</button>
        </div>
        <div class="topbar-search">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="搜索设备..." value="${Utils.escape(this.searchKeyword)}" oninput="Nav.setSearch(this.value)">
        </div>
        <div class="topbar-filters">
          <select onchange="Nav.setFilter('project', this.value)">
            <option value="">全部项目</option>
            ${projects.map(p => `<option value="${p.id}" ${this.filters.project == p.id ? 'selected' : ''}>${Utils.escape(p.name)}</option>`).join('')}
          </select>
          <select onchange="Nav.setFilter('status', this.value)">
            <option value="">全部状态</option>
            <option value="闲置" ${this.filters.status === '闲置' ? 'selected' : ''}>闲置</option>
            <option value="在用" ${this.filters.status === '在用' ? 'selected' : ''}>在用</option>
            <option value="维修中" ${this.filters.status === '维修中' ? 'selected' : ''}>维修中</option>
            <option value="已报废" ${this.filters.status === '已报废' ? 'selected' : ''}>已报废</option>
          </select>
          <select onchange="Nav.setFilter('category', this.value)">
            <option value="">全部类别</option>
            ${categories.map(c => `<option value="${Utils.escape(c.name)}" ${this.filters.category === c.name ? 'selected' : ''}>${Utils.escape(c.name)}</option>`).join('')}
          </select>
          <select onchange="Nav.setFilter('ownership', this.value)">
            <option value="">全部属性</option>
            <option value="自有" ${this.filters.ownership === '自有' ? 'selected' : ''}>自有</option>
            <option value="租赁" ${this.filters.ownership === '租赁' ? 'selected' : ''}>租赁</option>
          </select>
        </div>
        <div class="topbar-actions">
          <button class="btn" onclick="Utils.downloadTemplate()">📥 下载模板</button>
          <button class="btn" onclick="DeviceView.importCSV()">📤 导入</button>
          <button class="btn" onclick="DeviceView.exportCSV()">📄 导出</button>
          <button class="btn btn-primary" onclick="DeviceView.showAddForm()">➕ 新增设备</button>
        </div>
      `;
      return;
    }

    if (this.current === 'projects') {
      topbar.innerHTML = `
        <div class="topbar-title">${titles[this.current]}</div>
        <div class="topbar-search">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="搜索项目..." oninput="Nav.setSearch(this.value)">
        </div>
        <div class="topbar-actions">
          ${Auth.isAdmin() ? '<button class="btn btn-primary" onclick="ProjectView.showAddForm()">➕ 新增项目</button>' : ''}
        </div>
      `;
      return;
    }

    if (this.current === 'users') {
      topbar.innerHTML = `
        <div class="topbar-title">${titles[this.current]}</div>
        <div class="topbar-search">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="搜索用户..." oninput="Nav.setSearch(this.value)">
        </div>
        <div class="topbar-actions">
          <button class="btn btn-primary" onclick="UserView.showAddForm()">➕ 新增用户</button>
        </div>
      `;
      return;
    }

    if (this.current === 'lease') {
      topbar.innerHTML = `
        <div class="topbar-title">${titles[this.current]}</div>
        <div class="topbar-search">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="搜索租赁..." oninput="Nav.setSearch(this.value)">
        </div>
        <div class="topbar-actions">
          <button class="btn btn-primary" onclick="LeaseView.showAddForm()">➕ 新增租赁</button>
        </div>
      `;
      return;
    }

    if (this.current === 'purchase') {
      topbar.innerHTML = `
        <div class="topbar-title">${titles[this.current]}</div>
        <div class="topbar-search">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="搜索采购..." oninput="Nav.setSearch(this.value)">
        </div>
        <div class="topbar-actions">
          ${Auth.hasRole('超级管理员', '财务/库管') ? '<button class="btn btn-primary" onclick="PurchaseView.showAddForm()">➕ 新增采购</button>' : ''}
        </div>
      `;
      return;
    }

    if (this.current === 'logs') {
      topbar.innerHTML = `
        <div class="topbar-title">${titles[this.current]}</div>
        <div class="topbar-search">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="搜索日志..." oninput="Nav.setSearch(this.value)">
        </div>
        <div class="topbar-actions">
          <button class="btn" onclick="LogView.exportCSV()">📄 导出日志</button>
        </div>
      `;
      return;
    }

    if (this.current === 'settings') {
      topbar.innerHTML = `<div class="topbar-title">${titles[this.current]}</div>`;
      return;
    }

    topbar.innerHTML = `<div class="topbar-title">${titles[this.current] || ''}</div>`;
  },

  setSearch(val) {
    this.searchKeyword = val;
    if (this.current === 'devices') this.renderContent();
    else this.renderContent();
  },

  setFilter(key, val) {
    this.filters[key] = val;
    this.renderContent();
  },

  setDeviceView(view) {
    this.deviceView = view;
    this.renderTopbar();
    this.renderContent();
  },

  renderContent() {
    const content = document.getElementById('content');
    switch (this.current) {
      case 'dashboard': content.innerHTML = DashboardView.render(); break;
      case 'devices':
        content.innerHTML = this.deviceView === 'kanban' ? DeviceView.renderKanban() : DeviceView.renderGrid();
        if (this.deviceView === 'grid') DeviceView.bindGridEvents();
        break;
      case 'projects': content.innerHTML = ProjectView.render(); break;
      case 'users': content.innerHTML = UserView.render(); break;
      case 'lease': content.innerHTML = LeaseView.render(); break;
      case 'purchase': content.innerHTML = PurchaseView.render(); break;
      case 'logs': content.innerHTML = LogView.render(); break;
      case 'settings': content.innerHTML = SettingsView.render(); break;
    }
  }
};

// ============================================================
//  仪表盘视图
// ============================================================
const DashboardView = {
  render() {
    const devices = DB.get('devices');
    const total = devices.length;
    const inUse = devices.filter(d => d.status === '在用').length;
    const idle = devices.filter(d => d.status === '闲置').length;
    const leasing = devices.filter(d => d.ownership === '租赁');
    const expiring = leasing.filter(d => {
      if (!d.leaseEndDate) return false;
      return Utils.daysUntil(d.leaseEndDate) <= 30 && Utils.daysUntil(d.leaseEndDate) >= 0;
    }).length;

    const logs = DB.get('operationLogs').slice(-20).reverse();
    const projects = DB.get('projects').filter(p => !p.isVirtual);

    const actionIcons = {
      '创建': '➕', '编辑': '✏️', '删除': '🗑️', '调拨': '🔄',
      '送修': '🔧', '归还': '↩️', '报废': '❌', '采购入库': '🛒'
    };

    return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon blue">💻</div>
          <div><div class="stat-value">${total}</div><div class="stat-label">设备总数</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">✅</div>
          <div><div class="stat-value">${inUse}</div><div class="stat-label">在用设备</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange">📦</div>
          <div><div class="stat-value">${idle}</div><div class="stat-label">闲置设备</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red">⏰</div>
          <div><div class="stat-value">${expiring}</div><div class="stat-label">租赁即将到期</div></div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="panel">
          <div class="panel-header">
            <span>📋 最近操作</span>
            <a onclick="Nav.go('logs')" style="cursor:pointer">查看全部 →</a>
          </div>
          <div class="panel-body">
            ${logs.length === 0 ? '<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-text">暂无操作记录</div></div>' :
              `<ul class="log-list">${logs.map(log => `
                <li class="log-item">
                  <div class="log-icon" style="background:var(--primary-light);color:var(--primary)">${actionIcons[log.action] || '📝'}</div>
                  <div class="log-content">
                    <div class="log-title">${Utils.escape(log.username)} · <span class="badge badge-info">${Utils.escape(log.action)}</span></div>
                    <div class="log-meta">${Utils.escape(log.detail || '')} · ${Utils.formatDateTime(log.timestamp)}</div>
                  </div>
                </li>
              `).join('')}</ul>`}
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <span>📁 项目概览</span>
            <a onclick="Nav.go('projects')" style="cursor:pointer">管理 →</a>
          </div>
          <div class="panel-body">
            ${projects.length === 0 ? '<div class="empty-state"><div class="empty-text">暂无项目</div></div>' :
              projects.map(p => {
                const count = devices.filter(d => d.projectId === p.id).length;
                return `<div style="padding:12px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
                  <div><div style="font-weight:500">${Utils.escape(p.name)}</div><div class="text-sm text-muted">${Utils.escape(p.manager || '未指定')}</div></div>
                  <span class="badge badge-muted">${count} 台</span>
                </div>`;
              }).join('')}
          </div>
        </div>
      </div>
    `;
  }
};

// ============================================================
//  设备视图 (网格 + 看板)
// ============================================================
const DeviceView = {
  filteredDevices() {
    let devices = DB.get('devices');
    const user = Auth.user();

    // 项目经理只能看本项目的设备
    if (user.role === '项目经理' && user.projectId) {
      devices = devices.filter(d => d.projectId === user.projectId);
    }

    const kw = Nav.searchKeyword.toLowerCase().trim();
    if (kw) {
      devices = devices.filter(d =>
        (d.serialNumber || '').toLowerCase().includes(kw) ||
        (d.assetNumber || '').toLowerCase().includes(kw) ||
        (d.brand || '').toLowerCase().includes(kw) ||
        (d.model || '').toLowerCase().includes(kw)
      );
    }
    if (Nav.filters.project) devices = devices.filter(d => d.projectId == Nav.filters.project);
    if (Nav.filters.status) devices = devices.filter(d => d.status === Nav.filters.status);
    if (Nav.filters.category) devices = devices.filter(d => d.category === Nav.filters.category);
    if (Nav.filters.ownership) devices = devices.filter(d => d.ownership === Nav.filters.ownership);

    return devices.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },

  renderGrid() {
    const devices = this.filteredDevices();
    const projects = DB.get('projects');
    const categories = DB.get('categories');

    const projName = (id) => { const p = projects.find(p => p.id === id); return p ? p.name : '-'; };

    let batchBar = '';
    if (Nav.selectedDevices.size > 0) {
      batchBar = `
        <div class="batch-bar">
          <span class="batch-count">已选择 ${Nav.selectedDevices.size} 项</span>
          <div class="batch-actions">
            <select id="batch-action">
              <option value="">批量操作...</option>
              <option value="调拨">批量调拨</option>
              <option value="送修">批量送修</option>
              <option value="归还">批量归还</option>
              <option value="报废">批量报废</option>
            </select>
            <button onclick="DeviceView.executeBatch()">执行</button>
          </div>
          <button class="batch-close" onclick="Nav.selectedDevices.clear();Nav.renderContent()">&times;</button>
        </div>
      `;
    }

    return batchBar + `
      <div style="overflow-x:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:40px"><input type="checkbox" onchange="DeviceView.toggleAll(this.checked)"></th>
              <th>类别</th>
              <th>品牌</th>
              <th>型号</th>
              <th>序列号</th>
              <th>资产编号</th>
              <th>属性</th>
              <th>状态</th>
              <th>所属项目</th>
              <th>采购日期</th>
              <th>采购单价</th>
              <th>供应商</th>
              <th>质保截止</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${devices.length === 0 ? '<tr><td colspan="14" class="empty-row">暂无设备数据，点击右上角"新增设备"添加</td></tr>' :
              devices.map(d => `
              <tr class="${Nav.selectedDevices.has(d.id) ? 'selected' : ''}">
                <td><input type="checkbox" ${Nav.selectedDevices.has(d.id) ? 'checked' : ''} onchange="DeviceView.toggleSelect(${d.id}, this.checked)"></td>
                <td class="cell-editable" ondblclick="DeviceView.inlineEdit(${d.id}, 'category')">${Utils.escape(d.category || '-')}</td>
                <td class="cell-editable" ondblclick="DeviceView.inlineEdit(${d.id}, 'brand')">${Utils.escape(d.brand || '-')}</td>
                <td class="cell-editable" ondblclick="DeviceView.inlineEdit(${d.id}, 'model')">${Utils.escape(d.model || '-')}</td>
                <td><a onclick="DeviceView.showDetail(${d.id})" style="cursor:pointer;font-weight:500">${Utils.escape(d.serialNumber || '-')}</a></td>
                <td>${Utils.escape(d.assetNumber || '-')}</td>
                <td>${Utils.ownershipBadge(d.ownership)}</td>
                <td>${Utils.statusBadge(d.status)}</td>
                <td>${Utils.escape(projName(d.projectId))}</td>
                <td>${Utils.formatDate(d.purchaseDate)}</td>
                <td>${d.purchasePrice ? '¥' + Number(d.purchasePrice).toLocaleString() : '-'}</td>
                <td>${Utils.escape(d.supplier || '-')}</td>
                <td>${Utils.formatDate(d.warrantyEnd)}</td>
                <td>
                  <div class="flex gap-8">
                    <button class="btn btn-sm" onclick="DeviceView.showDetail(${d.id})">👁️</button>
                    ${Auth.isAdmin() ? `<button class="btn btn-sm btn-danger" onclick="DeviceView.delete(${d.id})">🗑️</button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="text-sm text-muted mt-12">共 ${devices.length} 条记录 · 双击单元格可快速编辑</div>
    `;
  },

  renderKanban() {
    const devices = this.filteredDevices();
    const statuses = [
      { key: '闲置', icon: '📦', color: '#94a3b8' },
      { key: '在用', icon: '✅', color: '#10b981' },
      { key: '维修中', icon: '🔧', color: '#f59e0b' },
      { key: '已报废', icon: '❌', color: '#ef4444' }
    ];

    return `
      <div class="kanban">
        ${statuses.map(s => {
          const cards = devices.filter(d => d.status === s.key);
          const projName = (id) => { const p = DB.get('projects').find(p => p.id === id); return p ? p.name : '-'; };
          return `
            <div class="kanban-column">
              <div class="kanban-column-header" style="border-bottom-color:${s.color}">
                <span>${s.icon} ${s.key}</span>
                <span class="column-count">${cards.length}</span>
              </div>
              <div class="kanban-cards">
                ${cards.map(d => `
                  <div class="kanban-card" style="border-left-color:${s.color}" onclick="DeviceView.showDetail(${d.id})">
                    <div class="card-title">${Utils.escape(d.category || '')} ${Utils.escape(d.brand || '')} ${Utils.escape(d.model || '')}</div>
                    <div class="card-meta">
                      <span>🔑 ${Utils.escape(d.serialNumber || '-')}</span>
                      <span>📁 ${Utils.escape(projName(d.projectId))}</span>
                      ${d.ownership === '租赁' ? '<span>📜 租赁</span>' : ''}
                    </div>
                  </div>
                `).join('')}
                ${cards.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--text-light)">暂无设备</div>' : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  bindGridEvents() {},

  toggleAll(checked) {
    const devices = this.filteredDevices();
    if (checked) devices.forEach(d => Nav.selectedDevices.add(d.id));
    else Nav.selectedDevices.clear();
    Nav.renderContent();
  },

  toggleSelect(id, checked) {
    if (checked) Nav.selectedDevices.add(id);
    else Nav.selectedDevices.delete(id);
    Nav.renderContent();
  },

  executeBatch() {
    const action = document.getElementById('batch-action').value;
    if (!action) { Utils.toast('请选择批量操作', 'warning'); return; }
    const ids = [...Nav.selectedDevices];
    if (ids.length === 0) return;

    let targetProjectId = null, receiver = '';
    if (action === '调拨') {
      const projects = DB.get('projects').filter(p => !p.isVirtual);
      const projOptions = projects.map(p => `<option value="${p.id}">${Utils.escape(p.name)}</option>`).join('');
      Utils.modal('批量调拨', `
        <div class="form-group">
          <label>调拨到项目 <span class="required">*</span></label>
          <select class="form-select" id="batch-project"><option value="">请选择</option>${projOptions}</select>
        </div>
        <div class="form-group">
          <label>接收人</label>
          <input class="form-input" id="batch-receiver" placeholder="接收人姓名">
        </div>
      `, `<button class="btn" onclick="Utils.closeModal()">取消</button><button class="btn btn-primary" onclick="DeviceView.doBatch('${action}')">确认调拨</button>`);
      return;
    }

    this.doBatch(action);
  },

  doBatch(action) {
    const ids = [...Nav.selectedDevices];
    let targetProjectId = null, receiver = '';
    if (action === '调拨') {
      targetProjectId = parseInt(document.getElementById('batch-project').value);
      receiver = document.getElementById('batch-receiver').value;
      if (!targetProjectId) { Utils.toast('请选择目标项目', 'error'); return; }
    }

    let success = 0, fail = 0;
    const projName = (id) => { const p = DB.getById('projects', id); return p ? p.name : '-'; };

    for (const id of ids) {
      const device = DB.getById('devices', id);
      if (!device) { fail++; continue; }

      if (action === '调拨') {
        if (device.status === '已报废') { fail++; continue; }
        device.status = '在用';
        device.projectId = targetProjectId;
        Logger.log('调拨', device.serialNumber, `批量调拨至 ${projName(targetProjectId)}，接收人 ${receiver}`);
      } else if (action === '送修') {
        if (['维修中', '已报废'].includes(device.status)) { fail++; continue; }
        device.status = '维修中';
        Logger.log('送修', device.serialNumber, '批量送修');
      } else if (action === '归还') {
        if (device.status !== '在用') { fail++; continue; }
        device.status = '闲置';
        device.projectId = 1;
        Logger.log('归还', device.serialNumber, '批量归还至公司待用库');
      } else if (action === '报废') {
        if (device.status === '已报废') { fail++; continue; }
        device.status = '已报废';
        Logger.log('报废', device.serialNumber, '批量报废');
      }
      success++;
    }
    DB.save();
    Nav.selectedDevices.clear();
    Utils.closeModal();
    Utils.toast(`批量${action}完成，成功 ${success} 台${fail > 0 ? '，失败 ' + fail + ' 台' : ''}`, 'success');
    Nav.renderContent();
  },

  showAddForm() {
    const projects = DB.get('projects');
    const categories = DB.get('categories');
    const projOptions = projects.map(p => `<option value="${p.id}" ${p.id === 1 ? 'selected' : ''}>${Utils.escape(p.name)}</option>`).join('');
    const catOptions = categories.map(c => `<option value="${Utils.escape(c.name)}">${Utils.escape(c.name)}</option>`).join('');

    Utils.modal('新增设备', `
      <form id="device-form">
        <div class="form-grid">
          <div class="form-group">
            <label>类别 <span class="required">*</span></label>
            <select class="form-select" name="category" required><option value="">请选择</option>${catOptions}</select>
          </div>
          <div class="form-group">
            <label>品牌 <span class="required">*</span></label>
            <input class="form-input" name="brand" required>
          </div>
          <div class="form-group">
            <label>型号 <span class="required">*</span></label>
            <input class="form-input" name="model" required>
          </div>
          <div class="form-group">
            <label>序列号 <span class="required">*</span></label>
            <input class="form-input" name="serialNumber" required>
          </div>
          <div class="form-group">
            <label>资产编号</label>
            <input class="form-input" name="assetNumber">
          </div>
          <div class="form-group">
            <label>属性</label>
            <select class="form-select" name="ownership"><option value="自有">自有</option><option value="租赁">租赁</option></select>
          </div>
          <div class="form-group">
            <label>所属项目</label>
            <select class="form-select" name="projectId">${projOptions}</select>
          </div>
          <div class="form-group">
            <label>采购日期</label>
            <input class="form-input" type="date" name="purchaseDate">
          </div>
          <div class="form-group">
            <label>采购单价</label>
            <input class="form-input" type="number" step="0.01" name="purchasePrice">
          </div>
          <div class="form-group">
            <label>供应商</label>
            <input class="form-input" name="supplier">
          </div>
          <div class="form-group">
            <label>质保截止</label>
            <input class="form-input" type="date" name="warrantyEnd">
          </div>
          <div class="form-group full">
            <label>备注</label>
            <textarea class="form-textarea" name="remark"></textarea>
          </div>
        </div>
      </form>
    `, `<button class="btn" onclick="Utils.closeModal()">取消</button><button class="btn btn-primary" onclick="DeviceView.saveAdd()">保存</button>`);
  },

  saveAdd() {
    const form = document.getElementById('device-form');
    const fd = new FormData(form);
    const data = Object.fromEntries(fd);

    if (!data.category || !data.brand || !data.model || !data.serialNumber) {
      Utils.toast('请填写必填字段', 'error'); return;
    }

    if (DB.get('devices').find(d => d.serialNumber === data.serialNumber)) {
      Utils.toast('序列号已存在', 'error'); return;
    }

    data.status = '闲置';
    data.projectId = parseInt(data.projectId) || 1;
    data.purchasePrice = data.purchasePrice ? parseFloat(data.purchasePrice) : null;

    DB.insert('devices', data);
    Logger.log('创建', data.serialNumber, `新增设备 ${data.category} ${data.brand} ${data.model}`);
    Utils.closeModal();
    Utils.toast('设备添加成功', 'success');
    Nav.renderContent();
  },

  showDetail(id) {
    const d = DB.getById('devices', id);
    if (!d) return;
    const project = DB.getById('projects', d.projectId);
    const logs = DB.get('operationLogs').filter(l => l.deviceSerial === d.serialNumber).slice(-10).reverse();

    Utils.modal('设备详情', `
      <div style="display:flex;gap:12px;margin-bottom:20px;align-items:center">
        <div style="width:56px;height:56px;border-radius:12px;background:var(--primary-light);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:28px">💻</div>
        <div>
          <h3 style="margin-bottom:4px">${Utils.escape(d.category || '')} ${Utils.escape(d.brand || '')} ${Utils.escape(d.model || '')}</h3>
          <div class="flex gap-8">${Utils.statusBadge(d.status)} ${Utils.ownershipBadge(d.ownership)}</div>
        </div>
      </div>
      <table class="data-table" style="margin-bottom:20px">
        <tbody>
          <tr><td style="width:120px;color:var(--text-muted)">序列号</td><td>${Utils.escape(d.serialNumber || '-')}</td><td style="width:120px;color:var(--text-muted)">资产编号</td><td>${Utils.escape(d.assetNumber || '-')}</td></tr>
          <tr><td style="color:var(--text-muted)">所属项目</td><td>${Utils.escape(project ? project.name : '-')}</td><td style="color:var(--text-muted)">供应商</td><td>${Utils.escape(d.supplier || '-')}</td></tr>
          <tr><td style="color:var(--text-muted)">采购日期</td><td>${Utils.formatDate(d.purchaseDate)}</td><td style="color:var(--text-muted)">采购单价</td><td>${d.purchasePrice ? '¥' + Number(d.purchasePrice).toLocaleString() : '-'}</td></tr>
          <tr><td style="color:var(--text-muted)">质保截止</td><td>${Utils.formatDate(d.warrantyEnd)}</td><td style="color:var(--text-muted)">创建时间</td><td>${Utils.formatDateTime(d.createdAt)}</td></tr>
          <tr><td style="color:var(--text-muted)">备注</td><td colspan="3">${Utils.escape(d.remark || '-')}</td></tr>
        </tbody>
      </table>

      <h4 style="margin-bottom:12px">📋 操作记录</h4>
      ${logs.length === 0 ? '<div class="text-muted">暂无操作记录</div>' :
        `<ul class="log-list">${logs.map(log => `
          <li class="log-item" style="padding:8px 0;border-bottom:1px solid var(--border)">
            <div class="log-content">
              <div class="log-title"><span class="badge badge-info">${Utils.escape(log.action)}</span> ${Utils.escape(log.username)}</div>
              <div class="log-meta">${Utils.escape(log.detail || '')} · ${Utils.formatDateTime(log.timestamp)}</div>
            </div>
          </li>
        `).join('')}</ul>`}
    `, `
      <div style="flex:1"></div>
      ${d.status !== '闲置' ? `<button class="btn" onclick="DeviceView.changeStatus(${d.id}, '归还')">↩️ 归还</button>` : ''}
      ${d.status === '在用' ? `<button class="btn" onclick="DeviceView.changeStatus(${d.id}, '送修')">🔧 送修</button>` : ''}
      ${d.status !== '已报废' ? `<button class="btn btn-danger" onclick="DeviceView.changeStatus(${d.id}, '报废')">❌ 报废</button>` : ''}
      ${d.status !== '在用' && d.status !== '已报废' ? `<button class="btn btn-success" onclick="DeviceView.showTransfer(${d.id})">🔄 调拨</button>` : ''}
      <button class="btn btn-primary" onclick="DeviceView.showEditForm(${d.id})">✏️ 编辑</button>
    `, 'lg');
  },

  showEditForm(id) {
    const d = DB.getById('devices', id);
    if (!d) return;
    const projects = DB.get('projects');
    const categories = DB.get('categories');

    Utils.modal('编辑设备', `
      <form id="device-edit-form">
        <div class="form-grid">
          <div class="form-group"><label>类别</label><select class="form-select" name="category">${categories.map(c => `<option value="${Utils.escape(c.name)}" ${d.category === c.name ? 'selected' : ''}>${Utils.escape(c.name)}</option>`).join('')}</select></div>
          <div class="form-group"><label>品牌</label><input class="form-input" name="brand" value="${Utils.escape(d.brand || '')}"></div>
          <div class="form-group"><label>型号</label><input class="form-input" name="model" value="${Utils.escape(d.model || '')}"></div>
          <div class="form-group"><label>序列号</label><input class="form-input" name="serialNumber" value="${Utils.escape(d.serialNumber || '')}"></div>
          <div class="form-group"><label>资产编号</label><input class="form-input" name="assetNumber" value="${Utils.escape(d.assetNumber || '')}"></div>
          <div class="form-group"><label>属性</label><select class="form-select" name="ownership"><option value="自有" ${d.ownership === '自有' ? 'selected' : ''}>自有</option><option value="租赁" ${d.ownership === '租赁' ? 'selected' : ''}>租赁</option></select></div>
          <div class="form-group"><label>所属项目</label><select class="form-select" name="projectId">${projects.map(p => `<option value="${p.id}" ${d.projectId === p.id ? 'selected' : ''}>${Utils.escape(p.name)}</option>`).join('')}</select></div>
          <div class="form-group"><label>采购日期</label><input class="form-input" type="date" name="purchaseDate" value="${d.purchaseDate || ''}"></div>
          <div class="form-group"><label>采购单价</label><input class="form-input" type="number" step="0.01" name="purchasePrice" value="${d.purchasePrice || ''}"></div>
          <div class="form-group"><label>供应商</label><input class="form-input" name="supplier" value="${Utils.escape(d.supplier || '')}"></div>
          <div class="form-group"><label>质保截止</label><input class="form-input" type="date" name="warrantyEnd" value="${d.warrantyEnd || ''}"></div>
          <div class="form-group full"><label>备注</label><textarea class="form-textarea" name="remark">${Utils.escape(d.remark || '')}</textarea></div>
        </div>
      </form>
    `, `<button class="btn" onclick="Utils.closeModal()">取消</button><button class="btn btn-primary" onclick="DeviceView.saveEdit(${id})">保存</button>`);
  },

  saveEdit(id) {
    const form = document.getElementById('device-edit-form');
    const fd = new FormData(form);
    const data = Object.fromEntries(fd);
    data.projectId = parseInt(data.projectId) || 1;
    data.purchasePrice = data.purchasePrice ? parseFloat(data.purchasePrice) : null;

    DB.update('devices', id, data);
    Logger.log('编辑', data.serialNumber, '更新设备信息');
    Utils.closeModal();
    Utils.toast('设备信息更新成功', 'success');
    Nav.renderContent();
  },

  delete(id) {
    const d = DB.getById('devices', id);
    if (!d) return;
    if (!Utils.confirm(`确定删除设备 ${d.serialNumber} 吗？此操作不可撤销。`)) return;
    Logger.log('删除', d.serialNumber, `删除设备 ${d.category} ${d.brand} ${d.model}`);
    DB.delete('devices', id);
    Utils.toast('设备已删除', 'success');
    Nav.renderContent();
  },

  changeStatus(id, action) {
    const d = DB.getById('devices', id);
    if (!d) return;

    if (action === '调拨') { this.showTransfer(id); return; }

    if (!Utils.confirm(`确定对设备 ${d.serialNumber} 执行"${action}"操作吗？`)) return;

    let detail = '';
    if (action === '送修') { d.status = '维修中'; detail = '设备送修'; }
    else if (action === '归还') { d.status = '闲置'; d.projectId = 1; detail = '归还至公司待用库'; }
    else if (action === '报废') { d.status = '已报废'; detail = '设备报废'; }

    DB.save();
    Logger.log(action, d.serialNumber, detail);
    Utils.closeModal();
    Utils.toast('操作成功', 'success');
    Nav.renderContent();
  },

  showTransfer(id) {
    const d = DB.getById('devices', id);
    const projects = DB.get('projects').filter(p => !p.isVirtual);
    Utils.modal('设备调拨', `
      <p style="margin-bottom:16px">将设备 <strong>${Utils.escape(d.serialNumber)}</strong> 调拨到：</p>
      <div class="form-group">
        <label>目标项目 <span class="required">*</span></label>
        <select class="form-select" id="transfer-project"><option value="">请选择</option>${projects.map(p => `<option value="${p.id}">${Utils.escape(p.name)}</option>`).join('')}</select>
      </div>
      <div class="form-group">
        <label>接收人</label>
        <input class="form-input" id="transfer-receiver" placeholder="接收人姓名">
      </div>
    `, `<button class="btn" onclick="Utils.closeModal()">取消</button><button class="btn btn-primary" onclick="DeviceView.doTransfer(${id})">确认调拨</button>`);
  },

  doTransfer(id) {
    const projectId = parseInt(document.getElementById('transfer-project').value);
    const receiver = document.getElementById('transfer-receiver').value;
    if (!projectId) { Utils.toast('请选择目标项目', 'error'); return; }

    const d = DB.getById('devices', id);
    const proj = DB.getById('projects', projectId);
    d.status = '在用';
    d.projectId = projectId;
    DB.save();
    Logger.log('调拨', d.serialNumber, `调拨至 ${proj.name}，接收人 ${receiver || '未指定'}`);
    Utils.closeModal();
    Utils.toast('设备调拨成功', 'success');
    Nav.renderContent();
  },

  inlineEdit(id, field) {
    const d = DB.getById('devices', id);
    if (!d) return;
    const currentVal = d[field] || '';
    const input = prompt(`修改 "${field}" 的值：`, currentVal);
    if (input === null) return;
    DB.update('devices', id, { [field]: input });
    Logger.log('编辑', d.serialNumber, `修改 ${field} 为 ${input}`);
    Utils.toast('已更新', 'success');
    Nav.renderContent();
  },

  importCSV() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const rows = Utils.parseCSV(ev.target.result);
        if (rows.length < 2) { Utils.toast('文件无数据', 'error'); return; }
        const headers = rows[0];
        const idx = {};
        ['类别', '品牌', '型号', '序列号', '资产编号', '属性', '采购日期', '采购单价', '供应商', '质保截止', '备注'].forEach(h => { idx[h] = headers.indexOf(h); });

        if (idx['类别'] < 0 || idx['品牌'] < 0 || idx['型号'] < 0 || idx['序列号'] < 0) {
          Utils.toast('文件缺少必需字段（类别、品牌、型号、序列号）', 'error'); return;
        }

        let success = 0, fail = 0;
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const serial = (row[idx['序列号']] || '').trim();
          if (!serial) { fail++; continue; }
          if (DB.get('devices').find(d => d.serialNumber === serial)) { fail++; continue; }

          const category = (row[idx['类别']] || '').trim();
          const brand = (row[idx['品牌']] || '').trim();
          const model = (row[idx['型号']] || '').trim();
          if (!category || !brand || !model) { fail++; continue; }

          DB.insert('devices', {
            category, brand, model, serialNumber: serial,
            assetNumber: idx['资产编号'] >= 0 ? (row[idx['资产编号']] || '').trim() : '',
            ownership: idx['属性'] >= 0 ? (row[idx['属性']] || '').trim() || '自有' : '自有',
            status: '闲置', projectId: 1,
            purchaseDate: idx['采购日期'] >= 0 ? (row[idx['采购日期']] || '').trim() : '',
            purchasePrice: idx['采购单价'] >= 0 ? parseFloat(row[idx['采购单价']]) || null : null,
            supplier: idx['供应商'] >= 0 ? (row[idx['供应商']] || '').trim() : '',
            warrantyEnd: idx['质保截止'] >= 0 ? (row[idx['质保截止']] || '').trim() : '',
            remark: idx['备注'] >= 0 ? (row[idx['备注']] || '').trim() : ''
          });
          Logger.log('创建', serial, `批量导入设备 ${category} ${brand} ${model}`);
          success++;
        }
        Utils.toast(`导入完成，成功 ${success} 台${fail > 0 ? '，失败 ' + fail + ' 台' : ''}`, 'success');
        Nav.renderContent();
      };
      reader.readAsText(file, 'UTF-8');
    };
    input.click();
  },

  exportCSV() {
    const devices = this.filteredDevices();
    const projName = (id) => { const p = DB.getById('projects', id); return p ? p.name : '-'; };
    const headers = ['类别', '品牌', '型号', '序列号', '资产编号', '属性', '状态', '所属项目', '采购日期', '采购单价', '供应商', '质保截止', '备注'];
    const rows = devices.map(d => [
      d.category || '', d.brand || '', d.model || '', d.serialNumber || '',
      d.assetNumber || '', d.ownership || '', d.status || '', projName(d.projectId),
      Utils.formatDate(d.purchaseDate), d.purchasePrice || '', d.supplier || '',
      Utils.formatDate(d.warrantyEnd), d.remark || ''
    ]);
    Utils.exportCSV(headers, rows, `设备清单_${Utils.today()}.csv`);
    Utils.toast('已导出 ' + devices.length + ' 条记录', 'success');
  }
};

// ============================================================
//  项目视图
// ============================================================
const ProjectView = {
  render() {
    let projects = DB.get('projects').filter(p => !p.isVirtual);
    const kw = Nav.searchKeyword.toLowerCase().trim();
    if (kw) projects = projects.filter(p => p.name.toLowerCase().includes(kw) || (p.manager || '').toLowerCase().includes(kw));

    const devices = DB.get('devices');

    return `
      <table class="data-table">
        <thead>
          <tr><th>项目名称</th><th>项目经理</th><th>开始日期</th><th>预计结束</th><th>设备数量</th><th>备注</th><th>操作</th></tr>
        </thead>
        <tbody>
          ${projects.length === 0 ? '<tr><td colspan="7" class="empty-row">暂无项目</td></tr>' :
            projects.map(p => {
              const count = devices.filter(d => d.projectId === p.id).length;
              return `
                <tr>
                  <td><strong>${Utils.escape(p.name)}</strong></td>
                  <td>${Utils.escape(p.manager || '-')}</td>
                  <td>${Utils.formatDate(p.startDate)}</td>
                  <td>${Utils.formatDate(p.estimatedEndDate)}</td>
                  <td><span class="badge badge-muted">${count} 台</span></td>
                  <td>${Utils.escape(p.remark || '-')}</td>
                  <td>
                    <div class="flex gap-8">
                      <button class="btn btn-sm" onclick="ProjectView.exportDevices(${p.id})">📄</button>
                      ${Auth.isAdmin() ? `<button class="btn btn-sm" onclick="ProjectView.showEditForm(${p.id})">✏️</button>` : ''}
                      ${Auth.isAdmin() ? `<button class="btn btn-sm btn-danger" onclick="ProjectView.delete(${p.id})">🗑️</button>` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
        </tbody>
      </table>
    `;
  },

  showAddForm() {
    Utils.modal('新增项目', `
      <form id="project-form">
        <div class="form-group"><label>项目名称 <span class="required">*</span></label><input class="form-input" name="name" required></div>
        <div class="form-grid">
          <div class="form-group"><label>项目经理</label><input class="form-input" name="manager"></div>
          <div class="form-group"><label>开始日期</label><input class="form-input" type="date" name="startDate"></div>
          <div class="form-group"><label>预计结束</label><input class="form-input" type="date" name="estimatedEndDate"></div>
        </div>
        <div class="form-group"><label>备注</label><textarea class="form-textarea" name="remark"></textarea></div>
      </form>
    `, `<button class="btn" onclick="Utils.closeModal()">取消</button><button class="btn btn-primary" onclick="ProjectView.saveAdd()">保存</button>`);
  },

  saveAdd() {
    const form = document.getElementById('project-form');
    const fd = new FormData(form);
    const data = Object.fromEntries(fd);
    if (!data.name) { Utils.toast('请填写项目名称', 'error'); return; }
    if (DB.get('projects').find(p => p.name === data.name)) { Utils.toast('项目名称已存在', 'error'); return; }
    data.isVirtual = false;
    DB.insert('projects', data);
    Utils.closeModal();
    Utils.toast('项目创建成功', 'success');
    Nav.renderContent();
  },

  showEditForm(id) {
    const p = DB.getById('projects', id);
    if (!p || p.isVirtual) return;
    Utils.modal('编辑项目', `
      <form id="project-edit-form">
        <div class="form-group"><label>项目名称</label><input class="form-input" name="name" value="${Utils.escape(p.name)}"></div>
        <div class="form-grid">
          <div class="form-group"><label>项目经理</label><input class="form-input" name="manager" value="${Utils.escape(p.manager || '')}"></div>
          <div class="form-group"><label>开始日期</label><input class="form-input" type="date" name="startDate" value="${p.startDate || ''}"></div>
          <div class="form-group"><label>预计结束</label><input class="form-input" type="date" name="estimatedEndDate" value="${p.estimatedEndDate || ''}"></div>
        </div>
        <div class="form-group"><label>备注</label><textarea class="form-textarea" name="remark">${Utils.escape(p.remark || '')}</textarea></div>
      </form>
    `, `<button class="btn" onclick="Utils.closeModal()">取消</button><button class="btn btn-primary" onclick="ProjectView.saveEdit(${id})">保存</button>`);
  },

  saveEdit(id) {
    const form = document.getElementById('project-edit-form');
    const fd = new FormData(form);
    const data = Object.fromEntries(fd);
    DB.update('projects', id, data);
    Utils.closeModal();
    Utils.toast('项目更新成功', 'success');
    Nav.renderContent();
  },

  delete(id) {
    const p = DB.getById('projects', id);
    if (!p || p.isVirtual) return;
    if (DB.get('devices').filter(d => d.projectId === id).length > 0) {
      Utils.toast('不能删除有设备关联的项目', 'error'); return;
    }
    if (!Utils.confirm(`确定删除项目 "${p.name}" 吗？`)) return;
    DB.delete('projects', id);
    Utils.toast('项目已删除', 'success');
    Nav.renderContent();
  },

  exportDevices(id) {
    const p = DB.getById('projects', id);
    const devices = DB.get('devices').filter(d => d.projectId === id);
    const headers = ['类别', '品牌', '型号', '序列号', '资产编号', '状态', '属性', '采购日期', '采购单价', '供应商', '质保截止', '备注'];
    const rows = devices.map(d => [d.category || '', d.brand || '', d.model || '', d.serialNumber || '', d.assetNumber || '', d.status || '', d.ownership || '', Utils.formatDate(d.purchaseDate), d.purchasePrice || '', d.supplier || '', Utils.formatDate(d.warrantyEnd), d.remark || '']);
    Utils.exportCSV(headers, rows, `${p.name}_设备清单_${Utils.today()}.csv`);
    Utils.toast('已导出 ' + devices.length + ' 台设备', 'success');
  }
};

// ============================================================
//  用户视图
// ============================================================
const UserView = {
  render() {
    let users = DB.get('users');
    const kw = Nav.searchKeyword.toLowerCase().trim();
    if (kw) users = users.filter(u => u.username.toLowerCase().includes(kw) || (u.name || '').toLowerCase().includes(kw));
    const projName = (id) => { const p = DB.getById('projects', id); return p ? p.name : '-'; };

    return `
      <table class="data-table">
        <thead><tr><th>用户名</th><th>姓名</th><th>角色</th><th>所属项目</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td><strong>${Utils.escape(u.username)}</strong></td>
              <td>${Utils.escape(u.name || '-')}</td>
              <td><span class="badge ${u.role === '超级管理员' ? 'badge-danger' : u.role === '项目经理' ? 'badge-info' : 'badge-muted'}">${Utils.escape(u.role || '-')}</span></td>
              <td>${Utils.escape(projName(u.projectId))}</td>
              <td>${u.isActive === false ? '<span class="badge badge-danger">禁用</span>' : '<span class="badge badge-success">启用</span>'}</td>
              <td>
                <div class="flex gap-8">
                  <button class="btn btn-sm" onclick="UserView.resetPassword(${u.id})">🔑</button>
                  <button class="btn btn-sm" onclick="UserView.toggleStatus(${u.id})">${u.isActive === false ? '✅' : '🚫'}</button>
                  ${u.username !== 'admin' ? `<button class="btn btn-sm btn-danger" onclick="UserView.delete(${u.id})">🗑️</button>` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  showAddForm() {
    const projects = DB.get('projects').filter(p => !p.isVirtual);
    Utils.modal('新增用户', `
      <form id="user-form">
        <div class="form-grid">
          <div class="form-group"><label>用户名 <span class="required">*</span></label><input class="form-input" name="username" required></div>
          <div class="form-group"><label>姓名 <span class="required">*</span></label><input class="form-input" name="name" required></div>
          <div class="form-group"><label>角色</label><select class="form-select" name="role" onchange="UserView.toggleProjectField(this.value)"><option value="普通员工">普通员工</option><option value="项目经理">项目经理</option><option value="财务/库管">财务/库管</option><option value="超级管理员">超级管理员</option></select></div>
          <div class="form-group" id="project-field" style="display:none"><label>所属项目</label><select class="form-select" name="projectId"><option value="">请选择</option>${projects.map(p => `<option value="${p.id}">${Utils.escape(p.name)}</option>`).join('')}</select></div>
          <div class="form-group full"><label>密码 <span class="required">*</span></label><input class="form-input" name="password" value="123456" required></div>
        </div>
      </form>
    `, `<button class="btn" onclick="Utils.closeModal()">取消</button><button class="btn btn-primary" onclick="UserView.saveAdd()">保存</button>`);
  },

  toggleProjectField(role) {
    document.getElementById('project-field').style.display = role === '项目经理' ? '' : 'none';
  },

  saveAdd() {
    const form = document.getElementById('user-form');
    const fd = new FormData(form);
    const data = Object.fromEntries(fd);
    if (!data.username || !data.name) { Utils.toast('请填写必填字段', 'error'); return; }
    if (DB.get('users').find(u => u.username === data.username)) { Utils.toast('用户名已存在', 'error'); return; }
    data.projectId = data.role === '项目经理' && data.projectId ? parseInt(data.projectId) : null;
    data.isActive = true;
    DB.insert('users', data);
    Utils.closeModal();
    Utils.toast('用户创建成功', 'success');
    Nav.renderContent();
  },

  resetPassword(id) {
    const u = DB.getById('users', id);
    if (!Utils.confirm(`确定将 ${u.name} 的密码重置为 123456 吗？`)) return;
    DB.update('users', id, { password: '123456' });
    Utils.toast(`${u.name} 的密码已重置为 123456`, 'success');
  },

  toggleStatus(id) {
    const u = DB.getById('users', id);
    if (u.username === 'admin') { Utils.toast('不能禁用管理员账号', 'error'); return; }
    DB.update('users', id, { isActive: u.isActive === false ? true : false });
    Utils.toast(`${u.name} 已${u.isActive === false ? '启用' : '禁用'}`, 'success');
    Nav.renderContent();
  },

  delete(id) {
    const u = DB.getById('users', id);
    if (u.username === 'admin') { Utils.toast('不能删除管理员账号', 'error'); return; }
    if (!Utils.confirm(`确定删除用户 "${u.name}" 吗？`)) return;
    DB.delete('users', id);
    Utils.toast('用户已删除', 'success');
    Nav.renderContent();
  }
};

// ============================================================
//  租赁视图
// ============================================================
const LeaseView = {
  render() {
    const devices = DB.get('devices').filter(d => d.ownership === '租赁');
    const contracts = DB.get('leaseContracts');
    const kw = Nav.searchKeyword.toLowerCase().trim();
    const filtered = kw ? devices.filter(d => (d.serialNumber || '').toLowerCase().includes(kw) || (d.supplier || '').toLowerCase().includes(kw)) : devices;

    return `
      <table class="data-table">
        <thead><tr><th>设备信息</th><th>序列号</th><th>供应商</th><th>合同号</th><th>开始日期</th><th>到期日期</th><th>月租金</th><th>到期状态</th><th>操作</th></tr></thead>
        <tbody>
          ${filtered.length === 0 ? '<tr><td colspan="9" class="empty-row">暂无租赁设备</td></tr>' :
            filtered.map(d => {
              const contract = contracts.find(c => c.id === d.leaseId);
              const days = contract && contract.endDate ? Utils.daysUntil(contract.endDate) : null;
              const expBadge = days !== null && days <= 30 && days >= 0 ? '<span class="badge badge-warning">即将到期</span>' :
                days !== null && days < 0 ? '<span class="badge badge-danger">已过期</span>' : '<span class="badge badge-success">正常</span>';
              return `
                <tr>
                  <td>${Utils.escape(d.category || '')} ${Utils.escape(d.brand || '')} ${Utils.escape(d.model || '')}</td>
                  <td>${Utils.escape(d.serialNumber || '-')}</td>
                  <td>${Utils.escape(d.supplier || '-')}</td>
                  <td>${contract ? Utils.escape(contract.contractNumber || '-') : '-'}</td>
                  <td>${contract ? Utils.formatDate(contract.startDate) : '-'}</td>
                  <td>${contract ? Utils.formatDate(contract.endDate) : '-'}</td>
                  <td>${contract && contract.monthlyCost ? '¥' + Number(contract.monthlyCost).toLocaleString() : '-'}</td>
                  <td>${expBadge}</td>
                  <td>
                    <div class="flex gap-8">
                      <button class="btn btn-sm" onclick="LeaseView.showDetail(${d.id})">👁️</button>
                      <button class="btn btn-sm" onclick="LeaseView.showEditForm(${d.id})">✏️</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
        </tbody>
      </table>
    `;
  },

  showAddForm() {
    const projects = DB.get('projects');
    const categories = DB.get('categories');
    Utils.modal('新增租赁设备', `
      <form id="lease-form">
        <h4 style="margin-bottom:12px;color:var(--text-muted)">合同信息</h4>
        <div class="form-grid">
          <div class="form-group"><label>供应商</label><input class="form-input" name="supplier"></div>
          <div class="form-group"><label>合同号</label><input class="form-input" name="contractNumber"></div>
          <div class="form-group"><label>开始日期</label><input class="form-input" type="date" name="startDate"></div>
          <div class="form-group"><label>到期日期</label><input class="form-input" type="date" name="endDate"></div>
          <div class="form-group"><label>月租金</label><input class="form-input" type="number" step="0.01" name="monthlyCost"></div>
          <div class="form-group"><label>总租金</label><input class="form-input" type="number" step="0.01" name="totalCost"></div>
        </div>
        <h4 style="margin:20px 0 12px;color:var(--text-muted)">设备信息</h4>
        <div class="form-grid">
          <div class="form-group"><label>类别</label><select class="form-select" name="category">${categories.map(c => `<option value="${Utils.escape(c.name)}">${Utils.escape(c.name)}</option>`).join('')}</select></div>
          <div class="form-group"><label>品牌</label><input class="form-input" name="brand"></div>
          <div class="form-group"><label>型号</label><input class="form-input" name="model"></div>
          <div class="form-group"><label>序列号 <span class="required">*</span></label><input class="form-input" name="serialNumber" required></div>
          <div class="form-group"><label>所属项目</label><select class="form-select" name="projectId"><option value="">无</option>${projects.map(p => `<option value="${p.id}">${Utils.escape(p.name)}</option>`).join('')}</select></div>
          <div class="form-group full"><label>备注</label><textarea class="form-textarea" name="remark"></textarea></div>
        </div>
      </form>
    `, `<button class="btn" onclick="Utils.closeModal()">取消</button><button class="btn btn-primary" onclick="LeaseView.saveAdd()">保存</button>`, 'lg');
  },

  saveAdd() {
    const form = document.getElementById('lease-form');
    const fd = new FormData(form);
    const data = Object.fromEntries(fd);
    if (!data.serialNumber) { Utils.toast('请填写序列号', 'error'); return; }
    if (DB.get('devices').find(d => d.serialNumber === data.serialNumber)) { Utils.toast('序列号已存在', 'error'); return; }

    const contract = DB.insert('leaseContracts', {
      supplier: data.supplier, contractNumber: data.contractNumber,
      startDate: data.startDate, endDate: data.endDate,
      monthlyCost: data.monthlyCost ? parseFloat(data.monthlyCost) : null,
      totalCost: data.totalCost ? parseFloat(data.totalCost) : null,
      remark: data.remark
    });

    DB.insert('devices', {
      category: data.category, brand: data.brand, model: data.model,
      serialNumber: data.serialNumber, assetNumber: '',
      ownership: '租赁', status: '正常使用',
      projectId: data.projectId ? parseInt(data.projectId) : null,
      supplier: data.supplier, leaseId: contract.id,
      remark: data.remark
    });
    Logger.log('创建', data.serialNumber, `新增租赁设备 ${data.category} ${data.brand} ${data.model}`);
    Utils.closeModal();
    Utils.toast('租赁设备已登记', 'success');
    Nav.renderContent();
  },

  showDetail(id) {
    const d = DB.getById('devices', id);
    if (!d) return;
    const contract = DB.get('leaseContracts').find(c => c.id === d.leaseId);
    Utils.modal('租赁详情', `
      <table class="data-table"><tbody>
        <tr><td style="width:120px;color:var(--text-muted)">设备</td><td>${Utils.escape(d.category || '')} ${Utils.escape(d.brand || '')} ${Utils.escape(d.model || '')}</td></tr>
        <tr><td style="color:var(--text-muted)">序列号</td><td>${Utils.escape(d.serialNumber || '-')}</td></tr>
        <tr><td style="color:var(--text-muted)">供应商</td><td>${Utils.escape(d.supplier || '-')}</td></tr>
        <tr><td style="color:var(--text-muted)">合同号</td><td>${contract ? Utils.escape(contract.contractNumber || '-') : '-'}</td></tr>
        <tr><td style="color:var(--text-muted)">开始日期</td><td>${contract ? Utils.formatDate(contract.startDate) : '-'}</td></tr>
        <tr><td style="color:var(--text-muted)">到期日期</td><td>${contract ? Utils.formatDate(contract.endDate) : '-'}</td></tr>
        <tr><td style="color:var(--text-muted)">月租金</td><td>${contract && contract.monthlyCost ? '¥' + Number(contract.monthlyCost).toLocaleString() : '-'}</td></tr>
        <tr><td style="color:var(--text-muted)">总租金</td><td>${contract && contract.totalCost ? '¥' + Number(contract.totalCost).toLocaleString() : '-'}</td></tr>
        <tr><td style="color:var(--text-muted)">备注</td><td>${Utils.escape(d.remark || '-')}</td></tr>
      </tbody></table>
    `, `<button class="btn" onclick="Utils.closeModal()">关闭</button>`);
  },

  showEditForm(id) {
    const d = DB.getById('devices', id);
    if (!d) return;
    const contract = DB.get('leaseContracts').find(c => c.id === d.leaseId) || {};
    Utils.modal('编辑租赁', `
      <form id="lease-edit-form">
        <div class="form-grid">
          <div class="form-group"><label>供应商</label><input class="form-input" name="supplier" value="${Utils.escape(contract.supplier || '')}"></div>
          <div class="form-group"><label>合同号</label><input class="form-input" name="contractNumber" value="${Utils.escape(contract.contractNumber || '')}"></div>
          <div class="form-group"><label>开始日期</label><input class="form-input" type="date" name="startDate" value="${contract.startDate || ''}"></div>
          <div class="form-group"><label>到期日期</label><input class="form-input" type="date" name="endDate" value="${contract.endDate || ''}"></div>
          <div class="form-group"><label>月租金</label><input class="form-input" type="number" step="0.01" name="monthlyCost" value="${contract.monthlyCost || ''}"></div>
          <div class="form-group"><label>总租金</label><input class="form-input" type="number" step="0.01" name="totalCost" value="${contract.totalCost || ''}"></div>
        </div>
      </form>
    `, `<button class="btn" onclick="Utils.closeModal()">取消</button><button class="btn btn-primary" onclick="LeaseView.saveEdit(${id})">保存</button>`);
  },

  saveEdit(id) {
    const d = DB.getById('devices', id);
    const form = document.getElementById('lease-edit-form');
    const fd = new FormData(form);
    const data = Object.fromEntries(fd);
    data.monthlyCost = data.monthlyCost ? parseFloat(data.monthlyCost) : null;
    data.totalCost = data.totalCost ? parseFloat(data.totalCost) : null;

    if (d.leaseId) {
      DB.update('leaseContracts', d.leaseId, data);
    } else {
      const c = DB.insert('leaseContracts', data);
      DB.update('devices', id, { leaseId: c.id });
    }
    Utils.closeModal();
    Utils.toast('租赁合同已更新', 'success');
    Nav.renderContent();
  }
};

// ============================================================
//  采购视图
// ============================================================
const PurchaseView = {
  render() {
    let orders = DB.get('purchaseOrders').sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''));
    const kw = Nav.searchKeyword.toLowerCase().trim();
    if (kw) orders = orders.filter(o => (o.supplier || '').toLowerCase().includes(kw));

    return `
      <table class="data-table">
        <thead><tr><th>采购日期</th><th>供应商</th><th>总金额</th><th>备注</th><th>操作</th></tr></thead>
        <tbody>
          ${orders.length === 0 ? '<tr><td colspan="5" class="empty-row">暂无采购记录</td></tr>' :
            orders.map(o => `
              <tr>
                <td>${Utils.formatDate(o.purchaseDate)}</td>
                <td>${Utils.escape(o.supplier || '-')}</td>
                <td><strong style="color:var(--success)">¥${Number(o.totalAmount || 0).toLocaleString()}</strong></td>
                <td>${Utils.escape(o.remark || '-')}</td>
                <td><button class="btn btn-sm" onclick="PurchaseView.showDetail(${o.id})">👁️ 详情</button></td>
              </tr>
            `).join('')}
        </tbody>
      </table>
    `;
  },

  showAddForm() {
    const categories = DB.get('categories');
    const catOptions = categories.map(c => `<option value="${Utils.escape(c.name)}">${Utils.escape(c.name)}</option>`).join('');
    Utils.modal('新增采购', `
      <form id="purchase-form">
        <div class="form-grid">
          <div class="form-group"><label>采购日期 <span class="required">*</span></label><input class="form-input" type="date" name="purchaseDate" value="${Utils.today()}" required></div>
          <div class="form-group"><label>供应商 <span class="required">*</span></label><input class="form-input" name="supplier" required></div>
        </div>
        <div class="form-group full"><label>备注</label><input class="form-input" name="remark"></div>

        <h4 style="margin:20px 0 12px">📦 采购明细</h4>
        <div class="purchase-items" id="purchase-items">
          <div class="purchase-item-row">
            <div><label class="text-sm">类别</label><input class="form-input" name="category"></div>
            <div><label class="text-sm">品牌</label><input class="form-input" name="brand"></div>
            <div><label class="text-sm">型号</label><input class="form-input" name="model"></div>
            <div><label class="text-sm">数量</label><input class="form-input" type="number" name="quantity" value="1" min="1"></div>
            <div><label class="text-sm">单价</label><input class="form-input" type="number" step="0.01" name="price" value="0"></div>
            <button type="button" class="remove-item-btn" onclick="this.parentElement.remove()">✕</button>
          </div>
        </div>
        <button type="button" class="btn btn-sm" onclick="PurchaseView.addItemRow()">➕ 添加明细</button>
      </form>
    `, `<button class="btn" onclick="Utils.closeModal()">取消</button><button class="btn btn-primary" onclick="PurchaseView.saveAdd()">确认采购</button>`, 'lg');
  },

  addItemRow() {
    const container = document.getElementById('purchase-items');
    const row = document.createElement('div');
    row.className = 'purchase-item-row';
    row.innerHTML = `
      <div><label class="text-sm">类别</label><input class="form-input" name="category"></div>
      <div><label class="text-sm">品牌</label><input class="form-input" name="brand"></div>
      <div><label class="text-sm">型号</label><input class="form-input" name="model"></div>
      <div><label class="text-sm">数量</label><input class="form-input" type="number" name="quantity" value="1" min="1"></div>
      <div><label class="text-sm">单价</label><input class="form-input" type="number" step="0.01" name="price" value="0"></div>
      <button type="button" class="remove-item-btn" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(row);
  },

  saveAdd() {
    const form = document.getElementById('purchase-form');
    const fd = new FormData(form);
    const purchaseDate = fd.get('purchaseDate');
    const supplier = fd.get('supplier');
    const remark = fd.get('remark');

    if (!purchaseDate || !supplier) { Utils.toast('请填写采购日期和供应商', 'error'); return; }

    const categories = fd.getAll('category');
    const brands = fd.getAll('brand');
    const models = fd.getAll('model');
    const quantities = fd.getAll('quantity');
    const prices = fd.getAll('price');

    let totalAmount = 0;
    for (let i = 0; i < categories.length; i++) {
      totalAmount += parseInt(quantities[i]) * parseFloat(prices[i]);
    }

    const order = DB.insert('purchaseOrders', { purchaseDate, supplier, totalAmount, remark });
    let deviceCount = 0;
    for (let i = 0; i < categories.length; i++) {
      const qty = parseInt(quantities[i]);
      const price = parseFloat(prices[i]);
      for (let j = 0; j < qty; j++) {
        const ts = Date.now();
        DB.insert('devices', {
          category: categories[i], brand: brands[i], model: models[i],
          serialNumber: `NEW-${ts}-${i}-${j}`, assetNumber: '',
          ownership: '自有', status: '闲置', projectId: 1,
          purchaseDate, purchasePrice: price, supplier
        });
        deviceCount++;
      }
    }
    Logger.log('采购入库', '批量', `采购单 ${order.id}，供应商 ${supplier}，总金额 ¥${totalAmount}，入库 ${deviceCount} 台`);
    Utils.closeModal();
    Utils.toast(`采购入库完成，共 ${deviceCount} 台设备`, 'success');
    Nav.renderContent();
  },

  showDetail(id) {
    const order = DB.getById('purchaseOrders', id);
    if (!order) return;
    const devices = DB.get('devices').filter(d => d.purchaseDate === order.purchaseDate && d.supplier === order.supplier);
    Utils.modal('采购详情', `
      <table class="data-table" style="margin-bottom:16px"><tbody>
        <tr><td style="width:100px;color:var(--text-muted)">采购日期</td><td>${Utils.formatDate(order.purchaseDate)}</td></tr>
        <tr><td style="color:var(--text-muted)">供应商</td><td>${Utils.escape(order.supplier || '-')}</td></tr>
        <tr><td style="color:var(--text-muted)">总金额</td><td><strong style="color:var(--success)">¥${Number(order.totalAmount || 0).toLocaleString()}</strong></td></tr>
        <tr><td style="color:var(--text-muted)">备注</td><td>${Utils.escape(order.remark || '-')}</td></tr>
      </tbody></table>
      <h4 style="margin-bottom:12px">📦 入库设备 (${devices.length} 台)</h4>
      <table class="data-table"><thead><tr><th>类别</th><th>品牌</th><th>型号</th><th>序列号</th><th>单价</th></tr></thead><tbody>
        ${devices.map(d => `<tr><td>${Utils.escape(d.category || '')}</td><td>${Utils.escape(d.brand || '')}</td><td>${Utils.escape(d.model || '')}</td><td>${Utils.escape(d.serialNumber || '')}</td><td>${d.purchasePrice ? '¥' + Number(d.purchasePrice).toLocaleString() : '-'}</td></tr>`).join('')}
      </tbody></table>
    `, `<button class="btn" onclick="Utils.closeModal()">关闭</button>`, 'lg');
  }
};

// ============================================================
//  日志视图
// ============================================================
const LogView = {
  render() {
    let logs = DB.get('operationLogs').reverse();
    const kw = Nav.searchKeyword.toLowerCase().trim();
    if (kw) logs = logs.filter(l => (l.username || '').toLowerCase().includes(kw) || (l.action || '').toLowerCase().includes(kw) || (l.deviceSerial || '').toLowerCase().includes(kw) || (l.detail || '').toLowerCase().includes(kw));

    const actionBadges = {
      '创建': 'badge-success', '删除': 'badge-danger', '编辑': 'badge-info',
      '调拨': 'badge-warning', '送修': 'badge-warning', '归还': 'badge-info',
      '报废': 'badge-danger', '采购入库': 'badge-success'
    };

    return `
      <table class="data-table">
        <thead><tr><th>时间</th><th>操作人</th><th>操作类型</th><th>设备序列号</th><th>详情</th></tr></thead>
        <tbody>
          ${logs.length === 0 ? '<tr><td colspan="5" class="empty-row">暂无操作记录</td></tr>' :
            logs.slice(0, 200).map(l => `
              <tr>
                <td class="text-sm">${Utils.formatDateTime(l.timestamp)}</td>
                <td>${Utils.escape(l.username || '-')}</td>
                <td><span class="badge ${actionBadges[l.action] || 'badge-muted'}">${Utils.escape(l.action || '-')}</span></td>
                <td>${Utils.escape(l.deviceSerial || '-')}</td>
                <td>${Utils.escape(l.detail || '-')}</td>
              </tr>
            `).join('')}
        </tbody>
      </table>
      ${logs.length > 200 ? '<div class="text-sm text-muted mt-12">仅显示最近 200 条记录，共 ' + logs.length + ' 条</div>' : ''}
    `;
  },

  exportCSV() {
    const logs = DB.get('operationLogs').reverse();
    const headers = ['时间', '操作人', '操作类型', '设备序列号', '详情'];
    const rows = logs.map(l => [Utils.formatDateTime(l.timestamp), l.username || '', l.action || '', l.deviceSerial || '', l.detail || '']);
    Utils.exportCSV(headers, rows, `操作日志_${Utils.today()}.csv`);
    Utils.toast('已导出 ' + logs.length + ' 条日志', 'success');
  }
};

// ============================================================
//  设置视图
// ============================================================
const SettingsView = {
  render() {
    const categories = DB.get('categories');
    const devices = DB.get('devices');

    return `
      <div class="dashboard-grid">
        <div class="panel">
          <div class="panel-header">
            <span>🏷️ 设备类别管理</span>
            <button class="btn btn-sm btn-primary" onclick="SettingsView.showAddCategory()">➕ 添加</button>
          </div>
          <div class="panel-body">
            <table class="data-table">
              <thead><tr><th>类别名称</th><th>设备数量</th><th>操作</th></tr></thead>
              <tbody>
                ${categories.map(c => {
                  const count = devices.filter(d => d.category === c.name).length;
                  return `<tr>
                    <td><strong>${Utils.escape(c.name)}</strong></td>
                    <td><span class="badge badge-muted">${count} 台</span></td>
                    <td>${count > 0 ? '<span class="text-muted text-sm">使用中不可删除</span>' : `<button class="btn btn-sm btn-danger" onclick="SettingsView.deleteCategory(${c.id})">🗑️</button>`}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header"><span>⚙️ 系统信息</span></div>
          <div class="panel-body" style="padding:20px">
            <div style="display:flex;flex-direction:column;gap:12px">
              <div class="flex-between"><span class="text-muted">系统版本</span><span>多维表格版 v1.0</span></div>
              <div class="flex-between"><span class="text-muted">数据存储</span><span>浏览器本地 (localStorage)</span></div>
              <div class="flex-between"><span class="text-muted">设备总数</span><span>${devices.length} 台</span></div>
              <div class="flex-between"><span class="text-muted">用户总数</span><span>${DB.get('users').length} 人</span></div>
              <div class="flex-between"><span class="text-muted">项目总数</span><span>${DB.get('projects').filter(p => !p.isVirtual).length} 个</span></div>
              <div class="flex-between"><span class="text-muted">日志总数</span><span>${DB.get('operationLogs').length} 条</span></div>
              <hr style="border:none;border-top:1px solid var(--border);margin:8px 0">
              <button class="btn btn-danger" onclick="SettingsView.resetData()">⚠️ 重置所有数据</button>
              <p class="text-sm text-muted">重置将清除所有数据并恢复初始状态，此操作不可撤销。</p>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  showAddCategory() {
    Utils.modal('添加类别', `
      <div class="form-group"><label>类别名称</label><input class="form-input" id="category-name" autofocus></div>
    `, `<button class="btn" onclick="Utils.closeModal()">取消</button><button class="btn btn-primary" onclick="SettingsView.saveCategory()">添加</button>`);
  },

  saveCategory() {
    const name = document.getElementById('category-name').value.trim();
    if (!name) { Utils.toast('请输入类别名称', 'error'); return; }
    if (DB.get('categories').find(c => c.name === name)) { Utils.toast('类别已存在', 'error'); return; }
    DB.insert('categories', { name });
    Utils.closeModal();
    Utils.toast(`类别 "${name}" 已添加`, 'success');
    Nav.renderContent();
  },

  deleteCategory(id) {
    const cat = DB.getById('categories', id);
    if (!cat) return;
    if (DB.get('devices').filter(d => d.category === cat.name).length > 0) {
      Utils.toast('该类别下有设备，无法删除', 'error'); return;
    }
    if (!Utils.confirm(`确定删除类别 "${cat.name}" 吗？`)) return;
    DB.delete('categories', id);
    Utils.toast(`类别 "${cat.name}" 已删除`, 'success');
    Nav.renderContent();
  },

  resetData() {
    if (!Utils.confirm('确定要重置所有数据吗？所有设备、项目、用户记录将被清除！')) return;
    if (!Utils.confirm('再次确认：此操作不可撤销，是否继续？')) return;
    DB.reset();
    Auth.init();
    Utils.toast('数据已重置', 'success');
    Nav.go('dashboard');
  }
};

// ============================================================
//  应用入口
// ============================================================
const App = {
  init() {
    DB.init();
    Auth.init();

    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;
      const result = Auth.login(username, password);
      if (result === true) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        Nav.renderSidebar();
        Nav.renderTopbar();
        Nav.renderContent();
      } else if (result === 'disabled') {
        Utils.toast('账号已被禁用，请联系管理员', 'error');
      } else {
        Utils.toast('用户名或密码错误', 'error');
      }
    });

    // 检查是否已登录
    if (Auth.user()) {
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      Nav.renderSidebar();
      Nav.renderTopbar();
      Nav.renderContent();
    }

    // 点击遮罩关闭模态框
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') Utils.closeModal();
    });
  },

  logout() {
    Auth.logout();
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
  }
};

// 启动
App.init();
