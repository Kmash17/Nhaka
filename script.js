/**
 * NHAKA — The Living Chronicle
 * World-Class Family Tree Application
 * ES6+ Modular Architecture
 */

'use strict';

/* ============================================================
   CONFIGURATION
   ============================================================ */
const CONFIG = {
  STORE_KEY: 'nhaka_v4',
  USERS_KEY: 'nhaka_users_v4',
  NODE_W: 200,
  NODE_H: 90,
  H_GAP: 60,
  V_GAP: 130,
  MIN_ZOOM: 0.2,
  MAX_ZOOM: 3,
  ANIMATION_DURATION: 300,
  DEBOUNCE_DELAY: 150
};

const DEFAULT_USERS = [
  { id: 'u1', name: 'Mashozhera Family', role: 'Primary Historian' },
  { id: 'u2', name: 'Guest Researcher', role: 'Viewer' }
];

const TOTEM_LIST = [
  'Shumba','Mhofu','Nzou','Mbeva','Mvura','Tembo','Shava','Nhari',
  'Hove','Dziva','Gwai','Hungwe','Mwari','Chirandu','Mazai',
  'Muturikwa','Samanyika','Tsoko','Nyamuzihwa','Hwesa','Manyika',
  'Gumbo','Zenda','Nyati','Ngwe','Sokwanele','Pfumojena','Museyamwa',
  'Chipfuriro','Charambatemwa','Musariri','Nhire','Makumbe','Nyandoro',
  'Murehwa','Dombojena','Mhara','Karigamombe','Zumba','Mbereko','Matemai'
];

/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */
const Utils = {
  uid: () => 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5),
  
  debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },
  
  clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  },
  
  truncate(str, n) {
    return str?.length > n ? str.substring(0, n) + '…' : str;
  },
  
  initials(name) {
    return name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?';
  },
  
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
  
  generateGradient(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const h = Math.abs(hash % 360);
    return `linear-gradient(135deg, hsl(${h}, 60%, 35%), hsl(${(h + 40) % 360}, 50%, 25%))`;
  }
};

/* ============================================================
   STATE MANAGER (with Undo/Redo)
   ============================================================ */
class StateManager {
  constructor() {
    this.users = JSON.parse(localStorage.getItem(CONFIG.USERS_KEY)) || DEFAULT_USERS;
    this.currentUser = null;
    this.members = [];
    this.links = [];
    this.history = [];
    this.historyIndex = -1;
    this.maxHistory = 50;
  }

  getUserData(uid) {
    const key = `${CONFIG.STORE_KEY}_${uid}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        return { members: data.members || [], links: data.links || [] };
      } catch (e) { console.error('Corrupted data', e); }
    }
    return this.getDefaultData();
  }

  getDefaultData() {
    return {
      members: [{
        id: 'root1',
        name: 'Samuel Mashozhera',
        birth: 1945,
        death: null,
        gender: 'male',
        relationship: 'Patriarch',
        totem: 'Shumba',
        village: 'Murewa',
        district: 'Mashonaland East',
        notes: 'Founder of the lineage.',
        addedBy: 'u1'
      }],
      links: []
    };
  }

  loadUser(user) {
    this.currentUser = user;
    const data = this.getUserData(user.id);
    this.members = data.members;
    this.links = data.links;
    this.clearHistory();
    this.pushHistory();
  }

  save() {
    if (!this.currentUser) return;
    const key = `${CONFIG.STORE_KEY}_${this.currentUser.id}`;
    localStorage.setItem(key, JSON.stringify({ members: this.members, links: this.links }));
  }

  pushHistory() {
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push({
      members: JSON.parse(JSON.stringify(this.members)),
      links: JSON.parse(JSON.stringify(this.links))
    });
    if (this.history.length > this.maxHistory) this.history.shift();
    else this.historyIndex++;
    this.updateUndoRedoUI();
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.restoreHistory();
      return true;
    }
    return false;
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.restoreHistory();
      return true;
    }
    return false;
  }

  restoreHistory() {
    const state = this.history[this.historyIndex];
    this.members = JSON.parse(JSON.stringify(state.members));
    this.links = JSON.parse(JSON.stringify(state.links));
    this.save();
    this.updateUndoRedoUI();
  }

  clearHistory() {
    this.history = [];
    this.historyIndex = -1;
    this.updateUndoRedoUI();
  }

  updateUndoRedoUI() {
    const undoBtn = document.getElementById('btnUndo');
    const redoBtn = document.getElementById('btnRedo');
    if (undoBtn) undoBtn.disabled = this.historyIndex <= 0;
    if (redoBtn) redoBtn.disabled = this.historyIndex >= this.history.length - 1;
  }

  addMember(member) {
    this.members.push(member);
    this.save();
    this.pushHistory();
  }

  updateMember(id, data) {
    const idx = this.members.findIndex(m => m.id === id);
    if (idx >= 0) {
      this.members[idx] = { ...this.members[idx], ...data };
      this.save();
      this.pushHistory();
    }
  }

  removeMember(id) {
    this.members = this.members.filter(m => m.id !== id);
    this.links = this.links.filter(l => l.parent !== id && l.child !== id);
    this.save();
    this.pushHistory();
  }

  addLink(parentId, childId) {
    if (!this.links.find(l => l.parent === parentId && l.child === childId)) {
      this.links.push({ parent: parentId, child: childId });
      this.save();
      this.pushHistory();
    }
  }

  removeLinksForChild(childId) {
    this.links = this.links.filter(l => l.child !== childId);
  }

  getChildren(id) {
    return this.links.filter(l => l.parent === id).map(l => l.child);
  }

  getParent(id) {
    const link = this.links.find(l => l.child === id);
    return link ? link.parent : null;
  }

  getAncestors(id, list = []) {
    const parentId = this.getParent(id);
    if (parentId && !list.includes(parentId)) {
      list.unshift(parentId);
      return this.getAncestors(parentId, list);
    }
    return list;
  }

  getDepth(id, depth = 0) {
    const children = this.getChildren(id);
    if (!children.length) return depth;
    return Math.max(...children.map(c => this.getDepth(c, depth + 1)));
  }

  getRoots() {
    const childIds = new Set(this.links.map(l => l.child));
    return this.members.filter(m => !childIds.has(m.id));
  }
}

/* ============================================================
   TREE LAYOUT ENGINE
   ============================================================ */
class TreeLayoutEngine {
  constructor(stateManager) {
    this.sm = stateManager;
    this.config = {
      W: CONFIG.NODE_W,
      H: CONFIG.NODE_H,
      HGAP: CONFIG.H_GAP,
      VGAP: CONFIG.V_GAP
    };
  }

  layout() {
    const roots = this.sm.getRoots();
    let offset = 100;
    
    // Reset positions
    this.sm.members.forEach(m => { m.x = 0; m.y = 0; });
    
    roots.forEach(r => {
      offset = this._layoutNode(r.id, 0, offset) + this.config.HGAP * 2;
    });
    
    // Post-process: ensure no overlaps between separate trees
    this._resolveOverlaps(roots);
    
    return this.sm.members;
  }

  _layoutNode(id, level, offset) {
    const m = this.sm.members.find(x => x.id === id);
    if (!m) return offset;
    
    const children = this.sm.getChildren(id);
    let cur = offset;
    
    children.forEach(c => {
      cur = this._layoutNode(c, level + 1, cur);
    });
    
    if (!children.length) {
      m.x = offset;
      cur += this.config.W + this.config.HGAP;
    } else {
      const first = this.sm.members.find(x => x.id === children[0]);
      const last = this.sm.members.find(x => x.id === children[children.length - 1]);
      m.x = (first.x + last.x) / 2;
    }
    
    m.y = level * this.config.VGAP + 80;
    return cur;
  }

  _resolveOverlaps(roots) {
    if (roots.length < 2) return;
    
    // Sort roots by x position
    const sortedRoots = [...roots].sort((a, b) => {
      const ma = this.sm.members.find(m => m.id === a.id);
      const mb = this.sm.members.find(m => m.id === b.id);
      return ma.x - mb.x;
    });
    
    // Simple collision resolution between subtrees
    for (let i = 1; i < sortedRoots.length; i++) {
      const prevRoot = sortedRoots[i - 1];
      const currRoot = sortedRoots[i];
      const prevBounds = this._getSubtreeBounds(prevRoot.id);
      const currBounds = this._getSubtreeBounds(currRoot.id);
      
      if (currBounds.minX < prevBounds.maxX + this.config.HGAP) {
        const shift = prevBounds.maxX + this.config.HGAP - currBounds.minX;
        this._shiftSubtree(currRoot.id, shift);
      }
    }
  }

  _getSubtreeBounds(id) {
    const m = this.sm.members.find(x => x.id === id);
    if (!m) return { minX: 0, maxX: 0 };
    
    let minX = m.x;
    let maxX = m.x + this.config.W;
    
    const children = this.sm.getChildren(id);
    children.forEach(c => {
      const bounds = this._getSubtreeBounds(c);
      minX = Math.min(minX, bounds.minX);
      maxX = Math.max(maxX, bounds.maxX);
    });
    
    return { minX, maxX };
  }

  _shiftSubtree(id, dx) {
    const m = this.sm.members.find(x => x.id === id);
    if (!m) return;
    m.x += dx;
    this.sm.getChildren(id).forEach(c => this._shiftSubtree(c, dx));
  }

  getBounds() {
    if (!this.sm.members.length) return { minX: 0, minY: 0, maxX: 1000, maxY: 800 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.sm.members.forEach(m => {
      minX = Math.min(minX, m.x);
      minY = Math.min(minY, m.y);
      maxX = Math.max(maxX, m.x + this.config.W);
      maxY = Math.max(maxY, m.y + this.config.H);
    });
    return { minX, minY, maxX, maxY };
  }
}

/* ============================================================
   SVG RENDERER
   ============================================================ */
class TreeRenderer {
  constructor(svgEl, groupEl, stateManager) {
    this.svg = svgEl;
    this.group = groupEl;
    this.sm = stateManager;
    this.selectedId = null;
    this.hoverId = null;
    this.transform = { x: 80, y: 60, s: 1 };
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
  }

  render() {
    this.group.innerHTML = '';
    
    // Render links first (behind nodes)
    this._renderLinks();
    
    // Render nodes
    this._renderNodes();
    
    this.applyTransform();
  }

  _renderLinks() {
    this.sm.links.forEach(link => {
      const p = this.sm.members.find(m => m.id === link.parent);
      const c = this.sm.members.find(m => m.id === link.child);
      if (!p || !c) return;
      
      const sx = p.x + CONFIG.NODE_W / 2;
      const sy = p.y + CONFIG.NODE_H;
      const ex = c.x + CONFIG.NODE_W / 2;
      const ey = c.y;
      const my = (sy + ey) / 2;
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${sx} ${sy} C ${sx} ${my}, ${ex} ${my}, ${ex} ${ey}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'rgba(201,168,76,0.25)');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('stroke-linecap', 'round');
      
      // Highlight path if selected
      if (this.selectedId && (link.parent === this.selectedId || link.child === this.selectedId)) {
        path.setAttribute('stroke', 'rgba(201,168,76,0.6)');
        path.setAttribute('stroke-width', '2');
      }
      
      this.group.appendChild(path);
    });
  }

  _renderNodes() {
    this.sm.members.forEach(m => {
      const isMale = m.gender === 'male';
      const isSelected = m.id === this.selectedId;
      const isDimmed = this.selectedId && !this._isRelated(this.selectedId, m.id);
      
      const baseColor = isMale ? '#162a5e' : '#3e1040';
      const borderColor = isMale ? 'rgba(70,110,200,0.5)' : 'rgba(180,60,140,0.5)';
      const accentColor = isMale ? '#5080d0' : '#c060a0';
      const initials = Utils.initials(m.name);
      
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.style.transform = `translate(${m.x}px, ${m.y}px)`;
      g.style.cursor = 'pointer';
      g.style.transition = 'opacity 0.3s ease';
      g.dataset.id = m.id;
      
      if (isDimmed) g.style.opacity = '0.3';
      
      // Shadow/filter for selected
      const filter = isSelected ? 'url(#glow)' : '';
      
      g.innerHTML = `
        <rect width="${CONFIG.NODE_W}" height="${CONFIG.NODE_H}" rx="12" 
          fill="${baseColor}" stroke="${isSelected ? 'var(--gold-400)' : borderColor}" 
          stroke-width="${isSelected ? '2.5' : '1.5'}" filter="${filter}"/>
        <rect width="4" height="${CONFIG.NODE_H}" rx="2" fill="${accentColor}" opacity="0.6"/>
        <circle cx="28" cy="30" r="16" fill="${accentColor}" opacity="0.2"/>
        <text x="28" y="35" text-anchor="middle" fill="white" font-size="12" font-weight="700" font-family="Inter">${initials}</text>
        <text x="52" y="26" fill="#e8e4dc" font-size="13" font-weight="600" font-family="Inter">${Utils.truncate(Utils.escapeHtml(m.name), 16)}</text>
        <text x="52" y="44" fill="rgba(201,168,76,0.9)" font-size="10" font-family="Inter">${m.relationship || ''}</text>
        <text x="52" y="60" fill="rgba(200,200,190,0.45)" font-size="9" font-family="Inter">${m.totem ? '◆ ' + m.totem : ''}</text>
        <text x="52" y="76" fill="rgba(200,200,190,0.35)" font-size="8.5" font-family="Inter">
          ${m.birth ? 'b.' + m.birth : ''}${m.death ? ' — d.' + m.death : ''}
        </text>
      `;
      
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectNode(m.id);
      });
      
      g.addEventListener('mouseenter', () => {
        if (!isSelected) {
          g.querySelector('rect').setAttribute('stroke-width', '2');
          g.querySelector('rect').setAttribute('stroke', 'rgba(201,168,76,0.7)');
        }
      });
      
      g.addEventListener('mouseleave', () => {
        if (!isSelected) {
          g.querySelector('rect').setAttribute('stroke-width', '1.5');
          g.querySelector('rect').setAttribute('stroke', borderColor);
        }
      });
      
      this.group.appendChild(g);
    });
  }

  _isRelated(a, b) {
    if (a === b) return true;
    // Check direct parent/child
    const link = this.sm.links.find(l => 
      (l.parent === a && l.child === b) || (l.parent === b && l.child === a)
    );
    if (link) return true;
    // Check if same lineage
    const ancestorsA = new Set(this.sm.getAncestors(a));
    const ancestorsB = new Set(this.sm.getAncestors(b));
    for (const anc of ancestorsA) if (ancestorsB.has(anc)) return true;
    return false;
  }

  selectNode(id) {
    this.selectedId = id;
    this.render();
    window.dispatchEvent(new CustomEvent('memberSelected', { detail: { id } }));
  }

  clearSelection() {
    this.selectedId = null;
    this.render();
    window.dispatchEvent(new CustomEvent('memberDeselected'));
  }

  applyTransform() {
    this.group.setAttribute('transform', `translate(${this.transform.x},${this.transform.y}) scale(${this.transform.s})`);
  }

  zoom(factor, centerX, centerY) {
    const newScale = Utils.clamp(this.transform.s * factor, CONFIG.MIN_ZOOM, CONFIG.MAX_ZOOM);
    const rect = this.svg.getBoundingClientRect();
    const cx = centerX ?? rect.width / 2;
    const cy = centerY ?? rect.height / 2;
    
    this.transform.x = cx - (cx - this.transform.x) * (newScale / this.transform.s);
    this.transform.y = cy - (cy - this.transform.y) * (newScale / this.transform.s);
    this.transform.s = newScale;
    
    this.applyTransform();
    this._updateMinimapViewport();
  }

  reset() {
    this.transform = { x: 80, y: 60, s: 1 };
    this.applyTransform();
    this._updateMinimapViewport();
  }

  fitToScreen() {
    const bounds = new TreeLayoutEngine(this.sm).getBounds();
    const rect = this.svg.getBoundingClientRect();
    const padding = 80;
    
    const treeW = bounds.maxX - bounds.minX + padding * 2;
    const treeH = bounds.maxY - bounds.minY + padding * 2;
    
    const scaleX = rect.width / treeW;
    const scaleY = rect.height / treeH;
    const scale = Math.min(scaleX, scaleY, 1);
    
    this.transform.s = Utils.clamp(scale, CONFIG.MIN_ZOOM, CONFIG.MAX_ZOOM);
    this.transform.x = (rect.width - (bounds.maxX - bounds.minX) * this.transform.s) / 2 - bounds.minX * this.transform.s;
    this.transform.y = (rect.height - (bounds.maxY - bounds.minY) * this.transform.s) / 2 - bounds.minY * this.transform.s;
    
    this.applyTransform();
    this._updateMinimapViewport();
  }

  _updateMinimapViewport() {
    // Minimap viewport update logic would go here
  }

  setupInteractions() {
    // Mouse drag
    this.svg.addEventListener('mousedown', (e) => {
      if (e.target.closest('[data-id]')) return;
      this.isDragging = true;
      this.dragStart = { x: e.clientX - this.transform.x, y: e.clientY - this.transform.y };
      this.svg.classList.add('dragging');
    });
    
    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      this.transform.x = e.clientX - this.dragStart.x;
      this.transform.y = e.clientY - this.dragStart.y;
      this.applyTransform();
      this._updateMinimapViewport();
    });
    
    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.svg.classList.remove('dragging');
    });
    
    // Touch
    this.svg.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        if (e.target.closest('[data-id]')) return;
        this.isDragging = true;
        this.dragStart = { 
          x: e.touches[0].clientX - this.transform.x, 
          y: e.touches[0].clientY - this.transform.y 
        };
      }
    }, { passive: true });
    
    this.svg.addEventListener('touchmove', (e) => {
      if (!this.isDragging || e.touches.length !== 1) return;
      this.transform.x = e.touches[0].clientX - this.dragStart.x;
      this.transform.y = e.touches[0].clientY - this.dragStart.y;
      this.applyTransform();
    }, { passive: true });
    
    this.svg.addEventListener('touchend', () => { this.isDragging = false; });
    
    // Wheel zoom
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoom(delta, e.clientX, e.clientY);
    }, { passive: false });
    
    // Click background to deselect
    this.svg.addEventListener('click', (e) => {
      if (e.target === this.svg || e.target === this.group) {
        this.clearSelection();
      }
    });
  }
}

/* ============================================================
   SEO MANAGER
   ============================================================ */
class SEOManager {
  constructor() {
    this.baseTitle = 'Nhaka — The Living Chronicle | Zimbabwean Family Tree & Heritage';
    this.baseDesc = 'Build, preserve and share your Zimbabwean family heritage. Interactive family tree with totem (mutupo) tracking, village origins, generational visualization, and PDF export.';
  }

  updateForMember(member) {
    if (!member) {
      document.title = this.baseTitle;
      this._setMeta('description', this.baseDesc);
      this._updateJsonLd(null);
      return;
    }
    
    const name = Utils.escapeHtml(member.name);
    document.title = `${name} — Nhaka Family Chronicle`;
    
    const desc = `Explore the heritage of ${name}${member.totem ? ', totem ' + member.totem : ''}${member.village ? ' from ' + member.village : ''}. View lineage, relationships, and family history.`;
    this._setMeta('description', desc);
    
    this._updateJsonLd(member);
  }

  _setMeta(name, content) {
    let meta = document.querySelector(`meta[name="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', name);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  }

  _updateJsonLd(member) {
    let script = document.getElementById('dynamic-schema');
    if (!script) {
      script = document.createElement('script');
      script.id = 'dynamic-schema';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    
    if (!member) {
      script.textContent = '';
      return;
    }
    
    const schema = {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": member.name,
      "gender": member.gender,
      "birthDate": member.birth ? `${member.birth}-01-01` : undefined,
      "deathDate": member.death ? `${member.death}-01-01` : undefined,
      "description": member.notes || undefined,
      "knowsAbout": member.totem ? `Totem: ${member.totem}` : undefined,
      "homeLocation": member.village ? {
        "@type": "Place",
        "name": member.village,
        "address": { "@type": "PostalAddress", "addressRegion": member.district || undefined }
      } : undefined
    };
    
    script.textContent = JSON.stringify(schema, null, 2);
  }
}

/* ============================================================
   UI MANAGER
   ============================================================ */
class UIManager {
  constructor(stateManager, renderer, seo) {
    this.sm = stateManager;
    this.renderer = renderer;
    this.seo = seo;
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.editingId = null;
    this.deletingId = null;
    
    this._cacheElements();
    this._bindEvents();
    this._setupKeyboard();
  }

  _cacheElements() {
    this.els = {
      appShell: document.getElementById('appShell'),
      loadingScreen: document.getElementById('loadingScreen'),
      loadingBar: document.getElementById('loadingBar'),
      signinScreen: document.getElementById('signinScreen'),
      userSwitcher: document.getElementById('userSwitcher'),
      sidebar: document.getElementById('sidebar'),
      memberList: document.getElementById('memberList'),
      emptyState: document.getElementById('emptyState'),
      searchInput: document.getElementById('globalSearch'),
      filterChips: document.getElementById('filterChips'),
      detailPanel: document.getElementById('detailPanel'),
      detailInner: document.getElementById('detailInner'),
      detailActions: document.getElementById('detailActions'),
      addOverlay: document.getElementById('addOverlay'),
      memberForm: document.getElementById('memberForm'),
      modalTitle: document.getElementById('modalTitle'),
      newUserOverlay: document.getElementById('newUserOverlay'),
      confirmOverlay: document.getElementById('confirmOverlay'),
      confirmText: document.getElementById('confirmText'),
      toastContainer: document.getElementById('toastContainer'),
      exportDropdown: document.getElementById('exportDropdown'),
      statTotal: document.getElementById('statTotal'),
      statGens: document.getElementById('statGens'),
      statRoots: document.getElementById('statRoots'),
      breadcrumb: document.getElementById('treeBreadcrumb'),
      canvasHint: document.getElementById('canvasHint'),
      userBadge: document.getElementById('userBadge'),
      badgeName: document.getElementById('badgeName'),
      badgeAvatar: document.getElementById('badgeAvatar')
    };
  }

  _bindEvents() {
    // Sidebar toggle
    document.getElementById('btnToggleSidebar').addEventListener('click', () => this.toggleSidebar());
    
    // Search
    this.els.searchInput.addEventListener('input', Utils.debounce((e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.renderSidebar();
    }, CONFIG.DEBOUNCE_DELAY));
    
    // Filter chips
    this.els.filterChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      this.els.filterChips.querySelectorAll('.chip').forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-pressed', 'false');
      });
      chip.classList.add('active');
      chip.setAttribute('aria-pressed', 'true');
      this.currentFilter = chip.dataset.filter;
      this.renderSidebar();
    });
    
    // Add member
    document.getElementById('btnAddMember').addEventListener('click', () => this.openAddModal());
    
    // Modal close buttons
    document.getElementById('btnCloseModal').addEventListener('click', () => this.closeAddModal());
    document.getElementById('btnCancelModal').addEventListener('click', () => this.closeAddModal());
    document.getElementById('btnCloseNewUser').addEventListener('click', () => this.closeNewUserModal());
    document.getElementById('btnCancelNewUser').addEventListener('click', () => this.closeNewUserModal());
    document.getElementById('btnShowNewUser').addEventListener('click', () => this.showNewUserModal());
    
    // Forms
    this.els.memberForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveMember();
    });
    
    document.getElementById('newUserForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.createUser();
    });
    
    // Totem other toggle
    document.getElementById('mTotem').addEventListener('change', (e) => {
      document.getElementById('otherTotemGroup').style.display = e.target.value === 'Other' ? 'block' : 'none';
    });
    
    // Export
    document.getElementById('btnExport').addEventListener('click', () => {
      this.els.exportDropdown.classList.toggle('open');
    });
    
    document.getElementById('optExportPDF').addEventListener('click', () => this.exportPDF());
    document.getElementById('optExportJSON').addEventListener('click', () => this.exportJSON());
    document.getElementById('optImportJSON').addEventListener('click', () => {
      document.getElementById('importFile').click();
      this.els.exportDropdown.classList.remove('open');
    });
    
    document.getElementById('importFile').addEventListener('change', (e) => this.handleImport(e));
    
    // Confirm delete
    document.getElementById('btnConfirmDelete').addEventListener('click', () => this.confirmDelete());
    document.getElementById('btnCancelDelete').addEventListener('click', () => this.closeConfirmModal());
    
    // Zoom controls
    document.getElementById('btnZoomIn').addEventListener('click', () => this.renderer.zoom(1.2));
    document.getElementById('btnZoomOut').addEventListener('click', () => this.renderer.zoom(0.8));
    document.getElementById('btnResetView').addEventListener('click', () => this.renderer.reset());
    document.getElementById('btnFitTree').addEventListener('click', () => this.renderer.fitToScreen());
    
    // Undo/Redo
    document.getElementById('btnUndo').addEventListener('click', () => {
      if (this.sm.undo()) this.refresh();
    });
    document.getElementById('btnRedo').addEventListener('click', () => {
      if (this.sm.redo()) this.refresh();
    });
    
    // User badge
    this.els.userBadge.addEventListener('click', () => this.switchUser());
    
    // Member selection events
    window.addEventListener('memberSelected', (e) => this.showDetail(e.detail.id));
    window.addEventListener('memberDeselected', () => this.closeDetail());
    
    // Click outside dropdowns
    window.addEventListener('click', (e) => {
      if (!e.target.closest('#exportDropdown')) {
        this.els.exportDropdown.classList.remove('open');
      }
    });
    
    // Hide canvas hint after interaction
    const hideHint = () => {
      this.els.canvasHint.classList.add('fade');
      this.svg.removeEventListener('mousedown', hideHint);
      this.svg.removeEventListener('wheel', hideHint);
    };
    this.renderer.svg.addEventListener('mousedown', hideHint);
    this.renderer.svg.addEventListener('wheel', hideHint);
  }

  _setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + K for search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.els.searchInput.focus();
        this.els.searchInput.select();
      }
      
      // Ctrl/Cmd + N for new member
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        this.openAddModal();
      }
      
      // Escape to close modals
      if (e.key === 'Escape') {
        this.closeAddModal();
        this.closeNewUserModal();
        this.closeConfirmModal();
        this.els.exportDropdown.classList.remove('open');
      }
      
      // Delete to remove selected
      if (e.key === 'Delete' && this.renderer.selectedId) {
        this.promptDelete(this.renderer.selectedId);
      }
      
      // Ctrl+Z / Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (this.sm.undo()) this.refresh();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (this.sm.redo()) this.refresh();
      }
      
      // Zoom shortcuts
      if (e.key === '+' || e.key === '=') this.renderer.zoom(1.2);
      if (e.key === '-') this.renderer.zoom(0.8);
      if (e.key === '0') this.renderer.reset();
    });
  }

  /* ---------- Loading & Init ---------- */
  
  startLoading() {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress > 90) progress = 90;
      this.els.loadingBar.style.width = progress + '%';
    }, 200);
    
    return {
      finish: () => {
        clearInterval(interval);
        this.els.loadingBar.style.width = '100%';
        setTimeout(() => {
          this.els.loadingScreen.classList.add('hidden');
          this.els.appShell.classList.add('ready');
        }, 400);
      }
    };
  }

  renderUserSwitcher() {
    this.els.userSwitcher.innerHTML = '';
    this.sm.users.forEach(u => {
      const div = document.createElement('div');
      div.className = 'user-option' + (this.sm.currentUser?.id === u.id ? ' active' : '');
      div.setAttribute('role', 'radio');
      div.setAttribute('aria-checked', this.sm.currentUser?.id === u.id);
      div.innerHTML = `
        <div class="user-avatar-sm">${u.name[0].toUpperCase()}</div>
        <div class="user-info-sm">
          <div class="user-name-sm">${Utils.escapeHtml(u.name)}</div>
          <div class="user-role-sm">${Utils.escapeHtml(u.role)}</div>
        </div>
        <div class="user-check">✓</div>
      `;
      div.addEventListener('click', () => this.signIn(u));
      this.els.userSwitcher.appendChild(div);
    });
  }

  signIn(user) {
    this.sm.loadUser(user);
    this.els.badgeName.textContent = user.name.split(' ')[0];
    this.els.badgeAvatar.textContent = user.name[0].toUpperCase();
    this.els.signinScreen.style.display = 'none';
    this.els.signinScreen.setAttribute('aria-hidden', 'true');
    
    this.refresh();
    this.showToast(`Welcome back, ${user.name.split(' ')[0]}!`, 'success');
    this.seo.updateForMember(null);
  }

  switchUser() {
    this.renderer.clearSelection();
    this.closeDetail();
    this.els.signinScreen.style.display = '';
    this.els.signinScreen.setAttribute('aria-hidden', 'false');
    this.renderUserSwitcher();
  }

  createUser() {
    const name = document.getElementById('nuName').value.trim();
    const role = document.getElementById('nuRole').value.trim() || 'Member';
    if (!name) {
      this.showToast('Please enter a name.', 'error');
      return;
    }
    const u = { id: 'u_' + Date.now(), name, role };
    this.sm.users.push(u);
    localStorage.setItem(CONFIG.USERS_KEY, JSON.stringify(this.sm.users));
    this.closeNewUserModal();
    this.renderUserSwitcher();
    this.signIn(u);
  }

  /* ---------- Sidebar ---------- */
  
  toggleSidebar() {
    this.els.sidebar.classList.toggle('collapsed');
  }

  renderSidebar() {
    const list = this.els.memberList;
    const parentSel = document.getElementById('mParent');
    list.innerHTML = '';
    parentSel.innerHTML = '<option value="">None (Root ancestor)</option>';
    
    let visibleCount = 0;
    const sorted = [...this.sm.members].sort((a, b) => a.name.localeCompare(b.name));
    
    sorted.forEach(m => {
      // Filter
      if (this.currentFilter !== 'all' && m.gender !== this.currentFilter) return;
      if (this.searchQuery && !m.name.toLowerCase().includes(this.searchQuery)) return;
      
      visibleCount++;
      
      const isMale = m.gender === 'male';
      const color = isMale ? 'var(--male)' : 'var(--female)';
      const isSelected = m.id === this.renderer.selectedId;
      
      const card = document.createElement('div');
      card.className = 'member-card' + (isSelected ? ' selected' : '');
      card.setAttribute('role', 'listitem');
      card.dataset.id = m.id;
      card.innerHTML = `
        <div class="avatar" style="background:${color}">${Utils.initials(m.name)}</div>
        <div class="info">
          <div class="name">${Utils.escapeHtml(m.name)}</div>
          <div class="meta">${m.totem || 'No totem'} · ${m.birth || '?'}</div>
        </div>
        <span class="rel-badge">${m.relationship || ''}</span>
      `;
      card.addEventListener('click', () => {
        this.renderer.selectNode(m.id);
      });
      list.appendChild(card);
      
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      parentSel.appendChild(opt);
    });
    
    this.els.emptyState.style.display = visibleCount ? 'none' : 'block';
    this.updateStats();
  }

  updateStats() {
    this.els.statTotal.textContent = this.sm.members.length;
    this.els.statGens.textContent = this.sm.getRoots().length ? 
      Math.max(...this.sm.getRoots().map(r => this.sm.getDepth(r.id))) + 1 : 0;
    this.els.statRoots.textContent = this.sm.getRoots().length;
  }

  /* ---------- Detail Panel ---------- */
  
  showDetail(id) {
    const m = this.sm.members.find(x => x.id === id);
    if (!m) return;
    
    this.els.detailPanel.style.display = '';
    this.els.detailPanel.classList.remove('closed');
    
    const isMale = m.gender === 'male';
    const avatarColor = isMale ? 'var(--male)' : 'var(--female)';
    
    this.els.detailInner.innerHTML = `
      <div class="detail-avatar" style="background:${avatarColor}">${Utils.initials(m.name)}</div>
      <div class="detail-name">${Utils.escapeHtml(m.name)}</div>
      <div class="detail-role">${m.relationship || 'Member'}</div>
      <div class="detail-divider"></div>
      <div class="detail-field"><span class="lbl">Gender</span><span class="val">${m.gender || '—'}</span></div>
      <div class="detail-field"><span class="lbl">Totem (Mutupo)</span><span class="val">${m.totem || '—'}</span></div>
      <div class="detail-field"><span class="lbl">Village (Musha)</span><span class="val">${m.village || '—'}</span></div>
      <div class="detail-field"><span class="lbl">District</span><span class="val">${m.district || '—'}</span></div>
      <div class="detail-field"><span class="lbl">Born</span><span class="val">${m.birth || 'Unknown'}</span></div>
      <div class="detail-field"><span class="lbl">Died</span><span class="val">${m.death || 'Living / Unknown'}</span></div>
      ${m.notes ? `<div class="detail-field"><span class="lbl">Biography</span><span class="val notes">${Utils.escapeHtml(m.notes)}</span></div>` : ''}
    `;
    
    this.els.detailActions.innerHTML = `
      <button class="btn btn-primary btn-full" id="btnEditMember">Edit Member</button>
      <button class="btn btn-danger btn-full" id="btnDeleteMember">Remove from Chronicle</button>
      <button class="btn btn-ghost btn-full" id="btnCloseDetail">Close Panel</button>
    `;
    
    document.getElementById('btnEditMember').addEventListener('click', () => this.openEditModal(id));
    document.getElementById('btnDeleteMember').addEventListener('click', () => this.promptDelete(id));
    document.getElementById('btnCloseDetail').addEventListener('click', () => this.closeDetail());
    
    this.renderBreadcrumb(id);
    this.seo.updateForMember(m);
    this.renderSidebar();
  }

  renderBreadcrumb(id) {
    const ancestors = this.sm.getAncestors(id);
    const current = this.sm.members.find(m => m.id === id);
    if (!current) return;
    
    const items = [...ancestors, id];
    if (items.length <= 1) {
      this.els.breadcrumb.style.display = 'none';
      return;
    }
    
    this.els.breadcrumb.style.display = '';
    this.els.breadcrumb.innerHTML = items.map((mid, idx) => {
      const m = this.sm.members.find(x => x.id === mid);
      if (!m) return '';
      const isLast = idx === items.length - 1;
      return `
        <span class="breadcrumb-item">
          ${isLast ? 
            `<span class="breadcrumb-current">${Utils.escapeHtml(m.name)}</span>` : 
            `<span class="breadcrumb-link" data-id="${m.id}">${Utils.escapeHtml(Utils.truncate(m.name, 12))}</span>`
          }
        </span>
      `;
    }).join('');
    
    this.els.breadcrumb.querySelectorAll('.breadcrumb-link').forEach(el => {
      el.addEventListener('click', () => this.renderer.selectNode(el.dataset.id));
    });
  }

  closeDetail() {
    this.els.detailPanel.classList.add('closed');
    this.renderer.clearSelection();
    this.els.breadcrumb.style.display = 'none';
    this.seo.updateForMember(null);
    setTimeout(() => {
      if (this.els.detailPanel.classList.contains('closed')) {
        this.els.detailPanel.style.display = 'none';
      }
    }, 400);
  }

  /* ---------- Modals ---------- */
  
  openAddModal() {
    this.editingId = null;
    this.els.modalTitle.innerHTML = 'Add Member <span class="modal-subtitle">to the chronicle</span>';
    this.els.memberForm.reset();
    document.getElementById('otherTotemGroup').style.display = 'none';
    this.renderSidebar(); // Refresh parent dropdown
    this._openModal(this.els.addOverlay);
  }

  openEditModal(id) {
    this.editingId = id;
    const m = this.sm.members.find(x => x.id === id);
    if (!m) return;
    
    this.els.modalTitle.innerHTML = 'Edit Member <span class="modal-subtitle">update record</span>';
    
    document.getElementById('mName').value = m.name || '';
    document.getElementById('mGender').value = m.gender || 'male';
    document.getElementById('mRelationship').value = m.relationship || 'Descendant';
    document.getElementById('mBirth').value = m.birth || '';
    document.getElementById('mDeath').value = m.death || '';
    document.getElementById('mVillage').value = m.village || '';
    document.getElementById('mDistrict').value = m.district || '';
    document.getElementById('mNotes').value = m.notes || '';
    
    const known = TOTEM_LIST.concat(['Other']);
    if (m.totem && known.includes(m.totem)) {
      document.getElementById('mTotem').value = m.totem;
      document.getElementById('otherTotemGroup').style.display = 'none';
    } else if (m.totem) {
      document.getElementById('mTotem').value = 'Other';
      document.getElementById('mTotemOther').value = m.totem;
      document.getElementById('otherTotemGroup').style.display = 'block';
    } else {
      document.getElementById('mTotem').value = '';
      document.getElementById('otherTotemGroup').style.display = 'none';
    }
    
    const parentId = this.sm.getParent(id);
    this.renderSidebar();
    document.getElementById('mParent').value = parentId || '';
    
    this._openModal(this.els.addOverlay);
  }

  saveMember() {
    const name = document.getElementById('mName').value.trim();
    if (!name) {
      this.showToast('Please enter a full name.', 'error');
      return;
    }
    
    let totem = document.getElementById('mTotem').value;
    if (totem === 'Other') totem = document.getElementById('mTotemOther').value.trim() || 'Other';
    if (!totem) {
      this.showToast('Please select a totem.', 'error');
      return;
    }
    
    const data = {
      name,
      gender: document.getElementById('mGender').value,
      relationship: document.getElementById('mRelationship').value,
      birth: parseInt(document.getElementById('mBirth').value) || null,
      death: parseInt(document.getElementById('mDeath').value) || null,
      totem,
      village: document.getElementById('mVillage').value.trim(),
      district: document.getElementById('mDistrict').value.trim(),
      notes: document.getElementById('mNotes').value.trim(),
      addedBy: this.sm.currentUser?.id
    };
    
    let memberId;
    if (this.editingId) {
      this.sm.updateMember(this.editingId, data);
      memberId = this.editingId;
      // Remove old links if parent changed
      this.sm.removeLinksForChild(this.editingId);
    } else {
      memberId = Utils.uid();
      this.sm.addMember({ ...data, id: memberId });
    }
    
    const parentId = document.getElementById('mParent').value;
    if (parentId) {
      this.sm.addLink(parentId, memberId);
    }
    
    this.closeAddModal();
    this.refresh();
    this.showToast(this.editingId ? `${name} updated.` : `${name} added to the chronicle.`, 'success');
    
    if (memberId) {
      setTimeout(() => this.renderer.selectNode(memberId), 100);
    }
  }

  promptDelete(id) {
    this.deletingId = id;
    const m = this.sm.members.find(x => x.id === id);
    this.els.confirmText.textContent = `Remove ${m?.name || 'this member'} from the chronicle? This cannot be undone.`;
    this._openModal(this.els.confirmOverlay);
  }

  confirmDelete() {
    if (!this.deletingId) return;
    const m = this.sm.members.find(x => x.id === this.deletingId);
    this.sm.removeMember(this.deletingId);
    this.closeConfirmModal();
    this.closeDetail();
    this.refresh();
    this.showToast(`${m?.name || 'Member'} removed.`, 'success');
    this.deletingId = null;
  }

  showNewUserModal() {
    document.getElementById('newUserForm').reset();
    this._openModal(this.els.newUserOverlay);
  }

  closeAddModal() { this._closeModal(this.els.addOverlay); }
  closeNewUserModal() { this._closeModal(this.els.newUserOverlay); }
  closeConfirmModal() { this._closeModal(this.els.confirmOverlay); }

  _openModal(el) {
    el.style.display = '';
    // Force reflow
    void el.offsetWidth;
    el.classList.add('open');
    const focusable = el.querySelector('input, select, textarea, button');
    if (focusable) setTimeout(() => focusable.focus(), 100);
    document.body.style.overflow = 'hidden';
  }

  _closeModal(el) {
    el.classList.remove('open');
    setTimeout(() => {
      if (!el.classList.contains('open')) el.style.display = 'none';
    }, 300);
    document.body.style.overflow = '';
  }

  /* ---------- Export / Import ---------- */
  
  exportJSON() {
    const blob = new Blob([JSON.stringify({ members: this.sm.members, links: this.sm.links }, null, 2)], 
      { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nhaka_${this.sm.currentUser?.name.replace(/\s/g, '_')}_${Date.now()}.json`;
    a.click();
    this.showToast('JSON exported successfully.', 'success');
    this.els.exportDropdown.classList.remove('open');
  }

  importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.members && Array.isArray(data.links)) {
          this.sm.members = data.members;
          this.sm.links = data.links;
          this.sm.save();
          this.sm.pushHistory();
          this.refresh();
          this.showToast('Family tree imported successfully!', 'success');
        } else {
          throw new Error('Invalid format');
        }
      } catch (err) {
        this.showToast('Could not read file. Invalid format.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
    this.els.exportDropdown.classList.remove('open');
  }

  async exportPDF() {
    this.showToast('Generating PDF…');
    this.els.exportDropdown.classList.remove('open');
    
    if (!window.jspdf?.jsPDF) {
      this.showToast('PDF library not loaded. Please try again.', 'error');
      return;
    }
    
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' });
      
      // Background
      doc.setFillColor(10, 14, 39);
      doc.rect(0, 0, 1191, 842, 'F');
      
      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.setTextColor(201, 168, 76);
      const title = this.sm.currentUser ? `${this.sm.currentUser.name} — Family Chronicle` : 'Family Chronicle';
      doc.text(title, 60, 55);
      
      doc.setFontSize(10);
      doc.setTextColor(140, 133, 117);
      doc.text(`Generated by Nhaka · ${new Date().toLocaleDateString()}`, 60, 72);
      
      doc.setDrawColor(201, 168, 76);
      doc.setLineWidth(0.5);
      doc.line(60, 82, 1131, 82);
      
      // Layout tree for PDF
      const engine = new TreeLayoutEngine(this.sm);
      engine.layout();
      
      const scale = 0.55;
      const offX = 55, offY = 100;
      
      // Links
      doc.setLineWidth(0.8);
      doc.setDrawColor(120, 110, 60);
      this.sm.links.forEach(lnk => {
        const p = this.sm.members.find(m => m.id === lnk.parent);
        const c = this.sm.members.find(m => m.id === lnk.child);
        if (!p || !c) return;
        const sx = p.x * scale + offX + (CONFIG.NODE_W * scale) / 2;
        const sy = p.y * scale + offY + CONFIG.NODE_H * scale;
        const ex = c.x * scale + offX + (CONFIG.NODE_W * scale) / 2;
        const ey = c.y * scale + offY;
        const my = (sy + ey) / 2;
        doc.lines([[0,0]], 0, 0, 1); // Reset
        // Bezier approximation using lines
        const steps = 20;
        doc.setDrawColor(160, 140, 60);
        doc.setLineWidth(0.6);
        let prevX = sx, prevY = sy;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const cx = (1-t)*(1-t)*sx + 2*(1-t)*t*sx + t*t*ex;
          const cy = (1-t)*(1-t)*sy + 2*(1-t)*t*my + t*t*ey;
          doc.line(prevX, prevY, cx, cy);
          prevX = cx; prevY = cy;
        }
      });
      
      // Nodes
      this.sm.members.forEach(m => {
        const nx = m.x * scale + offX;
        const ny = m.y * scale + offY;
        const nw = CONFIG.NODE_W * scale;
        const nh = CONFIG.NODE_H * scale;
        const isMale = m.gender === 'male';
        
        doc.setFillColor(isMale ? 22 : 62, isMale ? 42 : 16, isMale ? 94 : 64);
        doc.roundedRect(nx, ny, nw, nh, 4, 4, 'F');
        doc.setDrawColor(isMale ? 70 : 180, isMale ? 110 : 60, isMale ? 200 : 140);
        doc.setLineWidth(0.6);
        doc.roundedRect(nx, ny, nw, nh, 4, 4, 'S');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(232, 228, 220);
        doc.text(Utils.truncate(m.name, 22), nx + 6, ny + 14);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(201, 168, 76);
        doc.text(m.relationship || '', nx + 6, ny + 24);
        
        doc.setTextColor(170, 165, 155);
        if (m.totem) doc.text(m.totem, nx + 6, ny + 34);
        if (m.village) doc.text(m.village, nx + 6, ny + 44);
        const yr = [m.birth ? 'b.' + m.birth : '', m.death ? 'd.' + m.death : ''].filter(Boolean).join(' ');
        if (yr) doc.text(yr, nx + 6, ny + 54);
      });
      
      // Registry
      const listY = offY + (engine.getBounds().maxY - engine.getBounds().minY) * scale + 80;
      if (listY < 800) {
        doc.setDrawColor(201, 168, 76);
        doc.line(60, listY, 1131, listY);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(201, 168, 76);
        doc.text('COMPLETE MEMBER REGISTRY', 60, listY + 18);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(200, 195, 185);
        let col = 0, row = 0;
        this.sm.members.forEach((m, i) => {
          const tx = 60 + col * 360;
          const ty = listY + 36 + row * 20;
          if (ty > 820) return;
          doc.setFont('helvetica', 'bold');
          doc.text(`${i + 1}. ${Utils.truncate(m.name, 28)}`, tx, ty);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(140, 133, 117);
          const sub = [m.relationship, m.totem, m.village].filter(Boolean).join(' · ');
          doc.text(sub, tx + 4, ty + 10);
          doc.setTextColor(200, 195, 185);
          col++;
          if (col >= 3) { col = 0; row++; }
        });
      }
      
      doc.save(`nhaka_family_tree_${Date.now()}.pdf`);
      this.showToast('PDF saved successfully!', 'success');
    } catch (err) {
      console.error(err);
      this.showToast('PDF export failed. Try again.', 'error');
    }
  }

  /* ---------- Toast System ---------- */
  
  showToast(message, type = '') {
    const toast = document.createElement('div');
    toast.className = 'toast' + (type ? ` toast-${type}` : '');
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    this.els.toastContainer.appendChild(toast);
    
    requestAnimationFrame(() => toast.classList.add('show'));
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 350);
    }, 3200);
  }

  /* ---------- Global Refresh ---------- */
  
  refresh() {
    new TreeLayoutEngine(this.sm).layout();
    this.renderer.render();
    this.renderSidebar();
    this.updateStats();
  }
}

/* ============================================================
   APPLICATION INITIALIZATION
   ============================================================ */
class NhakaApp {
  constructor() {
    this.state = new StateManager();
    this.renderer = null;
    this.ui = null;
    this.seo = new SEOManager();
  }

  init() {
    const loader = this.ui?.startLoading?.() || { finish: () => {} };
    
    // Setup SVG
    const svg = document.getElementById('treeCanvas');
    const group = document.getElementById('treeGroup');
    this.renderer = new TreeRenderer(svg, group, this.state);
    this.renderer.setupInteractions();
    
    // Setup UI
    this.ui = new UIManager(this.state, this.renderer, this.seo);
    
    // Simulate loading
    setTimeout(() => {
      loader.finish();
      this.ui.renderUserSwitcher();
      
      // Auto-sign in if only one user or check URL params
      if (this.state.users.length === 1) {
        this.ui.signIn(this.state.users[0]);
      } else {
        document.getElementById('signinScreen').style.display = '';
        document.getElementById('signinScreen').setAttribute('aria-hidden', 'false');
      }
    }, 800);
    
    // Handle resize
    window.addEventListener('resize', Utils.debounce(() => {
      this.renderer.applyTransform();
    }, 200));
  }
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  const app = new NhakaApp();
  app.init();
});
