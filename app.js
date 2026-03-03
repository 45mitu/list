/* ==========================================
   Stock Manager Application
   ========================================== */

class StockManager {
    constructor() {
        this.items = [];
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.editingId = null;
        this.deletingId = null;
        this.currentStatusFilter = 'all'; // 'all', 'low', 'out'

        this.categoryLabels = {
            bathroom: '🛁 洗面・バス',
            kitchen: '🍳 キッチン',
            cleaning: '🧹 掃除',
            laundry: '👕 洗濯',
            paper: '🧻 紙類',
            other: '📎 その他'
        };

        this.init();
    }

    async init() {
        this.bindEvents();
        this.setupFirebase();
    }

    setupFirebase() {
        if (!window.firebaseDB) {
            console.error('Firebase DB is not initialized');
            return;
        }

        const { collection, onSnapshot, query, orderBy } = window.firestoreTools;
        this.db = window.firebaseDB;
        this.itemsRef = collection(this.db, 'items');

        // Real-time synchronization
        const q = query(this.itemsRef, orderBy('name'));
        onSnapshot(q, (snapshot) => {
            this.items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            this.render();
        });
    }

    /* ----- Data Persistence (Migrated to Firebase) ----- */

    getDefaultItems() {
        return [
            { id: this.generateId(), name: 'トイレットペーパー', category: 'paper', quantity: 8, threshold: 3, max: 12, unit: 'ロール', notes: '12ロール入りパックを補充' },
            { id: this.generateId(), name: 'ティッシュペーパー', category: 'paper', quantity: 2, threshold: 2, max: 10, unit: '箱', notes: '' },
            { id: this.generateId(), name: 'ハンドソープ', category: 'bathroom', quantity: 1, threshold: 1, max: 5, unit: '本', notes: '詰め替え用も確認' },
            { id: this.generateId(), name: 'シャンプー', category: 'bathroom', quantity: 3, threshold: 1, max: 5, unit: '本', notes: '' },
            { id: this.generateId(), name: ' 食器用洗剤', category: 'kitchen', quantity: 0, threshold: 1, max: 3, unit: '本', notes: '買い物リストに追加済み' },
            { id: this.generateId(), name: 'キッチンペーパー', category: 'kitchen', quantity: 4, threshold: 2, max: 8, unit: 'ロール', notes: '' },
            { id: this.generateId(), name: '洗濯洗剤', category: 'laundry', quantity: 1, threshold: 1, max: 3, unit: '本', notes: '液体タイプ' },
            { id: this.generateId(), name: 'トイレ用洗剤', category: 'cleaning', quantity: 2, threshold: 1, max: 3, unit: '本', notes: '' },
            { id: this.generateId(), name: 'ゴミ袋（45L）', category: 'other', quantity: 15, threshold: 5, max: 50, unit: '枚', notes: '' },
            { id: this.generateId(), name: 'ラップ', category: 'kitchen', quantity: 1, threshold: 1, max: 5, unit: '本', notes: '30cm幅' },
        ];
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    /* ----- Event Binding ----- */

    bindEvents() {
        // Search
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.trim();
            this.render();
        });

        // Status filters in header
        document.querySelector('.stats').addEventListener('click', (e) => {
            const btn = e.target.closest('.stat-item');
            if (!btn) return;

            const filterId = btn.id;
            if (filterId === 'filter-all') this.currentStatusFilter = 'all';
            else if (filterId === 'filter-low') this.currentStatusFilter = 'low';
            else if (filterId === 'filter-out') this.currentStatusFilter = 'out';

            // Visual update for status buttons
            document.querySelectorAll('.stat-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            this.render();
        });

        // Category filters
        document.getElementById('category-filters').addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;

            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.currentFilter = btn.dataset.category;
            this.render();
        });

        // Add button
        document.getElementById('add-btn').addEventListener('click', () => this.openAddModal());

        // Modal events
        document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('modal-cancel').addEventListener('click', () => this.closeModal());
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeModal();
        });

        // Form submit
        document.getElementById('item-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveItem();
        });

        // Delete modal events
        document.getElementById('delete-cancel').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('delete-confirm').addEventListener('click', () => this.confirmDelete());
        document.getElementById('delete-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeDeleteModal();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                this.closeDeleteModal();
            }
        });

        // Item grid click delegation
        document.getElementById('items-grid').addEventListener('click', (e) => {
            const card = e.target.closest('.item-card');
            if (!card) return;
            const itemId = card.dataset.id;

            if (e.target.closest('.plus')) {
                this.incrementQuantity(itemId);
            } else if (e.target.closest('.minus')) {
                this.decrementQuantity(itemId);
            } else if (e.target.closest('.edit-btn')) {
                this.openEditModal(itemId);
            } else if (e.target.closest('.delete-btn')) {
                this.openDeleteModal(itemId);
            }
        });
    }

    /* ----- CRUD Operations ----- */

    async addItem(itemData) {
        const { addDoc } = window.firestoreTools;
        try {
            await addDoc(this.itemsRef, itemData);
            this.showToast('✅', `${itemData.name} を追加しました`);
        } catch (e) {
            console.error('アイテムの追加に失敗しました:', e);
            this.showToast('⚠️', 'データの保存に失敗しました');
        }
    }

    async updateItem(id, itemData) {
        const { updateDoc, doc } = window.firestoreTools;
        const itemRef = doc(this.db, 'items', id);
        try {
            await updateDoc(itemRef, itemData);
            this.showToast('✏️', `${itemData.name} を更新しました`);
        } catch (e) {
            console.error('アイテムの更新に失敗しました:', e);
            this.showToast('⚠️', 'データの更新に失敗しました');
        }
    }

    async deleteItem(id) {
        const item = this.items.find(item => item.id === id);
        if (!item) return;

        const { deleteDoc, doc } = window.firestoreTools;
        const itemRef = doc(this.db, 'items', id);

        const card = document.querySelector(`.item-card[data-id="${id}"]`);
        if (card) {
            card.classList.add('removing');
            setTimeout(async () => {
                try {
                    await deleteDoc(itemRef);
                    this.showToast('🗑️', `${item.name} を削除しました`);
                } catch (e) {
                    console.error('アイテムの削除に失敗しました:', e);
                    this.showToast('⚠️', 'データの削除に失敗しました');
                }
            }, 300);
        } else {
            try {
                await deleteDoc(itemRef);
                this.showToast('🗑️', `${item.name} を削除しました`);
            } catch (e) {
                console.error('アイテムの削除に失敗しました:', e);
            }
        }
    }

    async incrementQuantity(id) {
        const item = this.items.find(item => item.id === id);
        if (!item) return;

        const { updateDoc, doc } = window.firestoreTools;
        const itemRef = doc(this.db, 'items', id);

        try {
            await updateDoc(itemRef, {
                quantity: item.quantity + 1
            });
        } catch (e) {
            console.error('数量の更新に失敗しました:', e);
        }
    }

    async decrementQuantity(id) {
        const item = this.items.find(item => item.id === id);
        if (!item || item.quantity <= 0) return;

        const { updateDoc, doc } = window.firestoreTools;
        const itemRef = doc(this.db, 'items', id);

        try {
            await updateDoc(itemRef, {
                quantity: item.quantity - 1
            });
        } catch (e) {
            console.error('数量の更新に失敗しました:', e);
        }
    }

    /* ----- UI Updates ----- */

    updateCardDisplay(id) {
        const item = this.items.find(item => item.id === id);
        if (!item) return;

        const card = document.querySelector(`.item-card[data-id="${id}"]`);
        if (!card) return;

        const counterValue = card.querySelector('.counter-value');
        const stockBarFill = card.querySelector('.stock-bar-fill');
        const statusDot = card.querySelector('.status-dot');
        // const statusText = card.querySelector('.stock-status'); // リスト表示では隠しているためコメントアウト

        // Animate counter
        if (counterValue) {
            counterValue.textContent = item.quantity;
            counterValue.classList.add('animate-change');
            setTimeout(() => counterValue.classList.remove('animate-change'), 300);
        }

        // Update status
        const status = this.getStockStatus(item);
        card.className = `item-card status-${status.level}`;

        // Update bar
        if (stockBarFill) {
            const maxVal = item.max || Math.max(item.threshold * 3, item.quantity, 10);
            const percentage = Math.min((item.quantity / maxVal) * 100, 100);
            stockBarFill.style.width = percentage + '%';
            stockBarFill.className = `stock-bar-fill level-${status.level}`;
        }

        // Update dot if exists
        if (statusDot) {
            statusDot.className = `status-dot ${status.level}`;
        }
    }

    getStockStatus(item) {
        if (item.quantity === 0) {
            return { level: 'danger', text: '在庫切れ' };
        } else if (item.quantity <= item.threshold) {
            return { level: 'warning', text: '残りわずか' };
        }
        return { level: 'good', text: '十分' };
    }

    /* ----- Rendering ----- */

    render() {
        const grid = document.getElementById('items-grid');
        const emptyState = document.getElementById('empty-state');

        const filtered = this.getFilteredItems();

        if (filtered.length === 0) {
            grid.style.display = 'none';
            emptyState.style.display = 'block';

            if (this.items.length > 0 && (this.searchQuery || this.currentFilter !== 'all')) {
                emptyState.querySelector('h2').textContent = '該当するアイテムがありません';
                emptyState.querySelector('p').textContent = '検索条件やフィルターを変更してみてください';
                emptyState.querySelector('.empty-icon').textContent = '🔍';
            } else {
                emptyState.querySelector('h2').textContent = 'アイテムがありません';
                emptyState.querySelector('p').textContent = '「追加」ボタンから日用品を登録しましょう';
                emptyState.querySelector('.empty-icon').textContent = '📋';
            }
        } else {
            grid.style.display = 'grid';
            emptyState.style.display = 'none';
            grid.innerHTML = filtered.map((item, i) => this.renderCard(item, i)).join('');
        }

        this.updateStats();
    }

    renderCard(item, index) {
        const status = this.getStockStatus(item);
        const maxVal = item.max || Math.max(item.threshold * 3, item.quantity, 10);
        const percentage = Math.min((item.quantity / maxVal) * 100, 100);

        return `
            <div class="item-card status-${status.level}" data-id="${item.id}" style="animation-delay: ${index * 0.05}s">
                <div class="card-top">
                    <div class="card-info">
                        <span class="card-category">${this.categoryLabels[item.category] || item.category}</span>
                        <div class="card-name" title="${this.escapeHtml(item.name)}">${this.escapeHtml(item.name)}</div>
                        ${item.notes ? `<div class="card-notes" title="${this.escapeHtml(item.notes)}">${this.escapeHtml(item.notes)}</div>` : ''}
                    </div>
                </div>
                <div class="card-counter">
                    <button class="counter-btn minus" title="減らす">−</button>
                    <div class="counter-display">
                        <span class="counter-value">${item.quantity}</span>
                        <span class="counter-unit">${this.escapeHtml(item.unit || '個')}</span>
                    </div>
                    <button class="counter-btn plus" title="増やす">＋</button>
                </div>
                <div class="card-actions">
                    <button class="action-btn edit-btn" title="編集">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="action-btn delete-btn" title="削除">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </div>
                <div class="stock-level">
                    <div class="stock-bar-bg">
                        <div class="stock-bar-fill level-${status.level}" style="width: ${percentage}%"></div>
                    </div>
                </div>
            </div>
        `;
    }

    updateStats() {
        const total = this.items.length;
        const low = this.items.filter(i => i.quantity > 0 && i.quantity <= i.threshold).length;
        const out = this.items.filter(i => i.quantity === 0).length;

        document.getElementById('stat-total-val').textContent = total;
        document.getElementById('stat-low-val').textContent = low;
        document.getElementById('stat-out-val').textContent = out;
    }

    getFilteredItems() {
        let filtered = this.items.filter(item => {
            // Category filter
            const matchCategory = this.currentFilter === 'all' || item.category === this.currentFilter;

            // Search filter
            const matchSearch = !this.searchQuery ||
                item.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                (item.notes && item.notes.toLowerCase().includes(this.searchQuery.toLowerCase()));

            // Status filter
            let matchStatus = true;
            if (this.currentStatusFilter === 'low') {
                matchStatus = item.quantity > 0 && item.quantity <= item.threshold;
            } else if (this.currentStatusFilter === 'out') {
                matchStatus = item.quantity === 0;
            }

            return matchCategory && matchSearch && matchStatus;
        });

        // Default stable sort
        filtered.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

        return filtered;
    }

    getStatusScore(item) {
        if (item.quantity === 0) return 3; // Danger
        if (item.quantity <= item.threshold) return 2; // Warning
        return 1; // Good
    }

    /* ----- Modal Operations ----- */

    openAddModal() {
        this.editingId = null;
        document.getElementById('modal-title').textContent = 'アイテムを追加';
        document.getElementById('modal-submit').textContent = '追加する';
        document.getElementById('item-form').reset();
        document.getElementById('item-id').value = '';
        document.getElementById('item-quantity').value = '0';
        document.getElementById('item-threshold').value = '2';
        document.getElementById('item-max').value = '10';
        document.getElementById('modal-overlay').classList.add('active');
        document.getElementById('item-name').focus();
    }

    openEditModal(id) {
        const item = this.items.find(item => item.id === id);
        if (!item) return;

        this.editingId = id;
        document.getElementById('modal-title').textContent = 'アイテムを編集';
        document.getElementById('modal-submit').textContent = '更新する';
        document.getElementById('item-id').value = id;
        document.getElementById('item-name').value = item.name;
        document.getElementById('item-category').value = item.category;
        document.getElementById('item-unit').value = item.unit || '';
        document.getElementById('item-quantity').value = item.quantity;
        document.getElementById('item-threshold').value = item.threshold;
        document.getElementById('item-max').value = item.max || 10;
        document.getElementById('item-notes').value = item.notes || '';
        document.getElementById('modal-overlay').classList.add('active');
        document.getElementById('item-name').focus();
    }

    closeModal() {
        document.getElementById('modal-overlay').classList.remove('active');
        this.editingId = null;
    }

    saveItem() {
        const name = document.getElementById('item-name').value.trim();
        if (!name) return;

        const itemData = {
            name: name,
            category: document.getElementById('item-category').value,
            unit: document.getElementById('item-unit').value.trim() || '個',
            quantity: parseInt(document.getElementById('item-quantity').value) || 0,
            threshold: parseInt(document.getElementById('item-threshold').value) || 2,
            max: parseInt(document.getElementById('item-max').value) || 10,
            notes: document.getElementById('item-notes').value.trim()
        };

        if (this.editingId) {
            this.updateItem(this.editingId, itemData);
        } else {
            this.addItem(itemData);
        }

        this.closeModal();
    }

    /* ----- Delete Modal ----- */

    openDeleteModal(id) {
        const item = this.items.find(item => item.id === id);
        if (!item) return;

        this.deletingId = id;
        document.getElementById('delete-message').textContent = `「${item.name}」を削除しますか？この操作は取り消せません。`;
        document.getElementById('delete-overlay').classList.add('active');
    }

    closeDeleteModal() {
        document.getElementById('delete-overlay').classList.remove('active');
        this.deletingId = null;
    }

    confirmDelete() {
        if (this.deletingId) {
            this.deleteItem(this.deletingId);
            this.closeDeleteModal();
        }
    }

    /* ----- Toast Notifications ----- */

    showToast(icon, message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-text">${this.escapeHtml(message)}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    /* ----- Utilities ----- */

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    window.stockManager = new StockManager();
});
