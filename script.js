/* ===== 資料模型 ===== */
let state = {
    tasks: [],
    categories: [],
    currentFilter: 'all',
    currentCategory: null,
    searchQuery: '',
    priorityFilter: '',
    sortBy: 'created',
    sortAsc: false,
    selectedTasks: new Set(),
    editingTaskId: null,
    editingTags: [],
    editingSubtasks: [],
    selectedColor: '#6366f1',
    dragSrcId: null,
};

const STORAGE_KEYS = { tasks: 'todo_tasks', categories: 'todo_categories' };

/* ===== 持久化 ===== */
function save() {
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(state.tasks));
    localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(state.categories));
}

function load() {
    try {
        state.tasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.tasks)) || [];
        state.categories = JSON.parse(localStorage.getItem(STORAGE_KEYS.categories)) || [];
    } catch { state.tasks = []; state.categories = []; }
}

/* ===== 輔助函數 ===== */
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function today() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

function pad2(n) { return n.toString().padStart(2, '0'); }

function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${y}/${m}/${d}`;
}

function isOverdue(task) {
    if (!task.dueDate || task.completed) return false;
    const due = new Date(task.dueDate + (task.dueTime ? 'T' + task.dueTime : 'T23:59:59'));
    return due < new Date();
}

function isToday(task) {
    if (!task.dueDate) return false;
    return task.dueDate === today();
}

function getCategory(id) { return state.categories.find(c => c.id === id); }

function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut .25s ease forwards';
        setTimeout(() => toast.remove(), 250);
    }, 2800);
}

/* ===== 篩選與排序 ===== */
function getFilteredTasks() {
    let list = [...state.tasks];

    // 分類篩選
    if (state.currentCategory) {
        list = list.filter(t => t.categoryId === state.currentCategory);
    }

    // 視圖篩選
    switch (state.currentFilter) {
        case 'today':    list = list.filter(t => isToday(t)); break;
        case 'active':   list = list.filter(t => !t.completed); break;
        case 'completed':list = list.filter(t => t.completed); break;
        case 'overdue':  list = list.filter(t => isOverdue(t)); break;
    }

    // 優先度篩選
    if (state.priorityFilter) {
        list = list.filter(t => t.priority === state.priorityFilter);
    }

    // 搜尋
    if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        list = list.filter(t =>
            t.title.toLowerCase().includes(q) ||
            (t.desc || '').toLowerCase().includes(q) ||
            (t.tags || []).some(tag => tag.toLowerCase().includes(q))
        );
    }

    // 排序
    list.sort((a, b) => {
        let va, vb;
        switch (state.sortBy) {
            case 'dueDate':
                va = a.dueDate || '9999-99-99';
                vb = b.dueDate || '9999-99-99';
                break;
            case 'priority': {
                const p = { high: 0, medium: 1, low: 2 };
                va = p[a.priority] ?? 1;
                vb = p[b.priority] ?? 1;
                break;
            }
            case 'title':
                va = a.title.toLowerCase();
                vb = b.title.toLowerCase();
                break;
            default: // created
                va = a.createdAt;
                vb = b.createdAt;
        }
        if (va < vb) return state.sortAsc ? -1 : 1;
        if (va > vb) return state.sortAsc ? 1 : -1;
        return 0;
    });

    // 已完成沉底
    const active = list.filter(t => !t.completed);
    const done   = list.filter(t => t.completed);
    return [...active, ...done];
}

/* ===== 計數 ===== */
function getCounts() {
    const t = state.tasks;
    return {
        all: t.length,
        today: t.filter(isToday).length,
        active: t.filter(x => !x.completed).length,
        completed: t.filter(x => x.completed).length,
        overdue: t.filter(isOverdue).length,
    };
}

/* ===== 渲染 ===== */
function render() {
    renderTaskList();
    renderSidebar();
    renderProgress();
    updateBulkActionsVisibility();
}

function renderTaskList() {
    const list = getFilteredTasks();
    const container = document.getElementById('taskList');
    const empty = document.getElementById('emptyState');

    if (list.length === 0) {
        container.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    container.innerHTML = list.map(task => renderTaskItem(task)).join('');

    // 子任務 checkbox 事件
    container.querySelectorAll('.subtask-mini-checkbox').forEach(el => {
        el.addEventListener('change', () => {
            const taskId = el.closest('.task-item').dataset.id;
            const idx = parseInt(el.dataset.index);
            const task = state.tasks.find(t => t.id === taskId);
            if (task && task.subtasks[idx]) {
                task.subtasks[idx].done = el.checked;
                save();
                render();
            }
        });
    });

    // 拖曳
    container.querySelectorAll('.task-item[draggable]').forEach(el => {
        el.addEventListener('dragstart', onDragStart);
        el.addEventListener('dragover', onDragOver);
        el.addEventListener('drop', onDrop);
        el.addEventListener('dragend', onDragEnd);
    });
}

function renderTaskItem(task) {
    const cat = task.categoryId ? getCategory(task.categoryId) : null;
    const overdue = isOverdue(task);
    const isTaskToday = isToday(task);
    const priorityLabels = { high: '高', medium: '中', low: '低' };
    const selected = state.selectedTasks.has(task.id);
    const showBulk = state.selectedTasks.size > 0;

    const subtasksDone = (task.subtasks || []).filter(s => s.done).length;
    const subtasksTotal = (task.subtasks || []).length;

    let dueMeta = '';
    if (task.dueDate) {
        const cls = overdue ? 'overdue' : (isTaskToday ? 'today' : '');
        const icon = overdue ? '⚠️' : '📅';
        const label = overdue ? '逾期：' : (isTaskToday ? '今日：' : '');
        dueMeta = `<span class="task-due ${cls}">${icon} ${label}${formatDate(task.dueDate)}${task.dueTime ? ' ' + task.dueTime : ''}</span>`;
    }

    const catMeta = cat
        ? `<span class="task-category-badge" style="background:${cat.color}22;color:${cat.color}">
               <span style="width:6px;height:6px;border-radius:50%;background:${cat.color};display:inline-block"></span>
               ${cat.name}
           </span>`
        : '';

    const tagsMeta = (task.tags || []).length
        ? `<div class="task-tags">${task.tags.map(t => `<span class="task-tag">#${t}</span>`).join('')}</div>`
        : '';

    const subtasksMeta = subtasksTotal
        ? `<div class="task-subtasks">
               <div class="subtask-progress">${subtasksDone}/${subtasksTotal} 子任務完成</div>
               <div class="subtask-mini-list">
                   ${task.subtasks.map((s, i) =>
                       `<div class="subtask-mini-item">
                           <input type="checkbox" class="subtask-mini-checkbox" data-index="${i}" ${s.done ? 'checked' : ''}>
                           <span class="subtask-mini-title ${s.done ? 'done' : ''}">${escHtml(s.title)}</span>
                       </div>`
                   ).join('')}
               </div>
           </div>`
        : '';

    return `<div class="task-item priority-${task.priority} ${task.completed ? 'completed' : ''} ${overdue ? 'overdue' : ''}"
                 data-id="${task.id}" draggable="true">
        ${showBulk ? `<input type="checkbox" class="task-select" data-id="${task.id}" ${selected ? 'checked' : ''} onchange="toggleSelectTask('${task.id}', this.checked)">` : ''}
        <div class="drag-handle" title="拖曳排序">⋮⋮</div>
        <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="toggleTask('${task.id}')">
            ${task.completed ? '✓' : ''}
        </div>
        <div class="task-body">
            <div class="task-header">
                <span class="task-title">${escHtml(task.title)}</span>
                <span class="task-priority-badge badge-${task.priority}">${priorityLabels[task.priority]}</span>
            </div>
            ${task.desc ? `<div class="task-desc">${escHtml(task.desc)}</div>` : ''}
            ${(dueMeta || catMeta || tagsMeta) ? `<div class="task-meta">${dueMeta}${catMeta}${tagsMeta}</div>` : ''}
            ${subtasksMeta}
        </div>
        <div class="task-actions">
            <button class="task-action-btn" onclick="openEditModal('${task.id}')" title="編輯">✏️</button>
            <button class="task-action-btn" onclick="duplicateTask('${task.id}')" title="複製">📋</button>
            <button class="task-action-btn delete" onclick="deleteTask('${task.id}')" title="刪除">🗑️</button>
        </div>
    </div>`;
}

function renderSidebar() {
    const counts = getCounts();
    document.getElementById('countAll').textContent = counts.all;
    document.getElementById('countToday').textContent = counts.today;
    document.getElementById('countActive').textContent = counts.active;
    document.getElementById('countCompleted').textContent = counts.completed;
    document.getElementById('countOverdue').textContent = counts.overdue;

    // mini stats
    const total = state.tasks.length;
    const done = counts.completed;
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statDone').textContent = done;
    document.getElementById('statRate').textContent = total ? Math.round(done / total * 100) + '%' : '0%';

    // 分類列表
    const catList = document.getElementById('categoryList');
    const catSelect = document.getElementById('taskCategory');

    const catCountMap = {};
    state.tasks.forEach(t => { if (t.categoryId) catCountMap[t.categoryId] = (catCountMap[t.categoryId] || 0) + 1; });

    catList.innerHTML = state.categories.map(cat => `
        <li class="category-nav-item ${state.currentCategory === cat.id ? 'active' : ''}" data-cat-id="${cat.id}">
            <span class="cat-dot" style="background:${cat.color}"></span>
            <span style="flex:1;font-size:.9rem">${escHtml(cat.name)}</span>
            <span class="nav-count">${catCountMap[cat.id] || 0}</span>
            <button class="category-delete-btn" onclick="deleteCategory('${cat.id}', event)" title="刪除分類">✕</button>
        </li>
    `).join('');

    catList.querySelectorAll('.category-nav-item').forEach(el => {
        el.addEventListener('click', () => selectCategory(el.dataset.catId));
    });

    // 更新 Modal 分類選擇器
    if (catSelect) {
        const cur = catSelect.value;
        catSelect.innerHTML = '<option value="">無分類</option>' +
            state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        catSelect.value = cur;
    }

    // 更新 nav active
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.filter === state.currentFilter && !state.currentCategory);
    });
}

function renderProgress() {
    const total = state.tasks.length;
    const done = state.tasks.filter(t => t.completed).length;
    const pct = total ? Math.round(done / total * 100) : 0;
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('progressLabel').textContent = `${done} / ${total} 完成`;
}

function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ===== 任務操作 ===== */
function addTask(data) {
    const task = {
        id: genId(),
        title: data.title.trim(),
        desc: (data.desc || '').trim(),
        priority: data.priority || 'medium',
        categoryId: data.categoryId || null,
        dueDate: data.dueDate || null,
        dueTime: data.dueTime || null,
        tags: data.tags || [],
        subtasks: data.subtasks || [],
        completed: false,
        createdAt: Date.now(),
    };
    state.tasks.unshift(task);
    save();
    render();
    showToast('任務已新增', 'success');
    return task;
}

function updateTask(id, data) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    Object.assign(task, {
        title: data.title.trim(),
        desc: (data.desc || '').trim(),
        priority: data.priority || 'medium',
        categoryId: data.categoryId || null,
        dueDate: data.dueDate || null,
        dueTime: data.dueTime || null,
        tags: data.tags || [],
        subtasks: data.subtasks || [],
        updatedAt: Date.now(),
    });
    save();
    render();
    showToast('任務已更新', 'success');
}

function toggleTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    save();
    render();
    showToast(task.completed ? '任務完成！' : '任務重新啟動', task.completed ? 'success' : 'info');
}

function deleteTask(id) {
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    state.tasks.splice(idx, 1);
    state.selectedTasks.delete(id);
    save();
    render();
    showToast('任務已刪除', 'info');
}

function duplicateTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    const copy = { ...task, id: genId(), title: task.title + ' (複本)', createdAt: Date.now(), completed: false };
    state.tasks.unshift(copy);
    save();
    render();
    showToast('任務已複製', 'success');
}

/* ===== 快速新增 ===== */
document.getElementById('quickAddInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') quickAdd();
});
document.getElementById('quickAddBtn').addEventListener('click', quickAdd);

function quickAdd() {
    const input = document.getElementById('quickAddInput');
    const title = input.value.trim();
    if (!title) { input.focus(); return; }
    addTask({ title, priority: 'medium' });
    input.value = '';
    input.focus();
}

/* ===== Modal 編輯 ===== */
function openAddModal() {
    state.editingTaskId = null;
    state.editingTags = [];
    state.editingSubtasks = [];

    document.getElementById('modalTitle').textContent = '新增任務';
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDesc').value = '';
    document.getElementById('taskPriority').value = 'medium';
    document.getElementById('taskCategory').value = '';
    document.getElementById('taskDueDate').value = '';
    document.getElementById('taskDueTime').value = '';
    renderTagsPreview();
    renderSubtaskEdit();
    showModal('taskModal');
    setTimeout(() => document.getElementById('taskTitle').focus(), 100);
}

function openEditModal(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    state.editingTaskId = id;
    state.editingTags = [...(task.tags || [])];
    state.editingSubtasks = (task.subtasks || []).map(s => ({ ...s }));

    document.getElementById('modalTitle').textContent = '編輯任務';
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskDesc').value = task.desc || '';
    document.getElementById('taskPriority').value = task.priority || 'medium';
    document.getElementById('taskCategory').value = task.categoryId || '';
    document.getElementById('taskDueDate').value = task.dueDate || '';
    document.getElementById('taskDueTime').value = task.dueTime || '';
    renderTagsPreview();
    renderSubtaskEdit();
    showModal('taskModal');
    setTimeout(() => document.getElementById('taskTitle').focus(), 100);
}

document.getElementById('modalSave').addEventListener('click', saveTaskModal);

function saveTaskModal() {
    const title = document.getElementById('taskTitle').value.trim();
    if (!title) {
        document.getElementById('taskTitle').focus();
        showToast('請輸入任務名稱', 'error');
        return;
    }
    const data = {
        title,
        desc: document.getElementById('taskDesc').value,
        priority: document.getElementById('taskPriority').value,
        categoryId: document.getElementById('taskCategory').value || null,
        dueDate: document.getElementById('taskDueDate').value || null,
        dueTime: document.getElementById('taskDueTime').value || null,
        tags: state.editingTags,
        subtasks: state.editingSubtasks,
    };

    if (state.editingTaskId) {
        updateTask(state.editingTaskId, data);
    } else {
        addTask(data);
    }
    hideModal('taskModal');
}

// Modal 快速鍵
document.getElementById('taskTitle').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveTaskModal(); }
    if (e.key === 'Escape') hideModal('taskModal');
});

/* ===== 標籤 ===== */
document.getElementById('tagInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const val = e.target.value.trim().replace(/^#/, '');
        if (val && !state.editingTags.includes(val)) {
            state.editingTags.push(val);
            renderTagsPreview();
        }
        e.target.value = '';
    }
});

function renderTagsPreview() {
    document.getElementById('tagsPreview').innerHTML = state.editingTags.map((t, i) =>
        `<span class="tag-chip">#${escHtml(t)}<span class="tag-remove" onclick="removeTag(${i})">✕</span></span>`
    ).join('');
}

function removeTag(idx) {
    state.editingTags.splice(idx, 1);
    renderTagsPreview();
}

/* ===== 子任務 ===== */
document.getElementById('subtaskInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const val = e.target.value.trim();
        if (val) {
            state.editingSubtasks.push({ title: val, done: false });
            renderSubtaskEdit();
        }
        e.target.value = '';
    }
});

function renderSubtaskEdit() {
    document.getElementById('subtaskList').innerHTML = state.editingSubtasks.map((s, i) =>
        `<div class="subtask-edit-item">
            <span>${escHtml(s.title)}</span>
            <span class="subtask-remove" onclick="removeSubtask(${i})">✕</span>
        </div>`
    ).join('');
}

function removeSubtask(idx) {
    state.editingSubtasks.splice(idx, 1);
    renderSubtaskEdit();
}

/* ===== 分類 ===== */
document.getElementById('addCategoryBtn').addEventListener('click', () => {
    document.getElementById('categoryName').value = '';
    state.selectedColor = '#6366f1';
    document.querySelectorAll('.color-dot').forEach(el => {
        el.classList.toggle('selected', el.dataset.color === state.selectedColor);
    });
    showModal('categoryModal');
    setTimeout(() => document.getElementById('categoryName').focus(), 100);
});

document.getElementById('colorPicker').addEventListener('click', e => {
    const dot = e.target.closest('.color-dot');
    if (!dot) return;
    state.selectedColor = dot.dataset.color;
    document.querySelectorAll('.color-dot').forEach(el => el.classList.remove('selected'));
    dot.classList.add('selected');
});

document.getElementById('categoryModalSave').addEventListener('click', () => {
    const name = document.getElementById('categoryName').value.trim();
    if (!name) { showToast('請輸入分類名稱', 'error'); return; }
    if (state.categories.some(c => c.name === name)) { showToast('分類名稱已存在', 'error'); return; }
    state.categories.push({ id: genId(), name, color: state.selectedColor });
    save();
    render();
    hideModal('categoryModal');
    showToast('分類已新增', 'success');
});

function deleteCategory(id, e) {
    e.stopPropagation();
    const cat = getCategory(id);
    if (!cat) return;
    state.categories = state.categories.filter(c => c.id !== id);
    state.tasks.forEach(t => { if (t.categoryId === id) t.categoryId = null; });
    if (state.currentCategory === id) state.currentCategory = null;
    save();
    render();
    showToast(`分類「${cat.name}」已刪除`, 'info');
}

function selectCategory(catId) {
    if (state.currentCategory === catId) {
        state.currentCategory = null;
    } else {
        state.currentCategory = catId;
        state.currentFilter = 'all';
        updateFilterNav('all');
    }
    render();
    updateViewTitle();
}

/* ===== 篩選導航 ===== */
document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => {
        state.currentFilter = el.dataset.filter;
        state.currentCategory = null;
        updateFilterNav(state.currentFilter);
        render();
        updateViewTitle();
    });
});

function updateFilterNav(filter) {
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.filter === filter);
    });
    document.querySelectorAll('.category-nav-item').forEach(el => el.classList.remove('active'));
}

const viewTitles = { all: '全部任務', today: '今日任務', active: '進行中', completed: '已完成', overdue: '已逾期' };

function updateViewTitle() {
    if (state.currentCategory) {
        const cat = getCategory(state.currentCategory);
        document.getElementById('currentViewTitle').textContent = cat ? cat.name : '分類';
    } else {
        document.getElementById('currentViewTitle').textContent = viewTitles[state.currentFilter] || '全部任務';
    }
}

/* ===== 搜尋 ===== */
document.getElementById('searchInput').addEventListener('input', e => {
    state.searchQuery = e.target.value;
    document.getElementById('clearSearch').classList.toggle('visible', !!state.searchQuery);
    render();
});

document.getElementById('clearSearch').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    state.searchQuery = '';
    document.getElementById('clearSearch').classList.remove('visible');
    render();
});

/* ===== 優先度與排序 ===== */
document.getElementById('priorityFilter').addEventListener('change', e => {
    state.priorityFilter = e.target.value;
    render();
});

document.getElementById('sortSelect').addEventListener('change', e => {
    state.sortBy = e.target.value;
    render();
});

document.getElementById('sortDirBtn').addEventListener('click', () => {
    state.sortAsc = !state.sortAsc;
    document.getElementById('sortDirBtn').textContent = state.sortAsc ? '↑' : '↓';
    render();
});

/* ===== 批次操作 ===== */
function toggleSelectTask(id, checked) {
    if (checked) state.selectedTasks.add(id);
    else state.selectedTasks.delete(id);
    updateBulkActionsVisibility();
    document.getElementById('selectedCount').textContent = `已選 ${state.selectedTasks.size} 項`;
}

function updateBulkActionsVisibility() {
    document.getElementById('bulkActions').style.display =
        state.selectedTasks.size > 0 ? 'flex' : 'none';
    document.getElementById('selectedCount').textContent = `已選 ${state.selectedTasks.size} 項`;
}

document.getElementById('selectAll').addEventListener('change', e => {
    const visible = getFilteredTasks().map(t => t.id);
    if (e.target.checked) {
        visible.forEach(id => state.selectedTasks.add(id));
    } else {
        visible.forEach(id => state.selectedTasks.delete(id));
    }
    render();
});

document.getElementById('bulkDeleteBtn').addEventListener('click', () => {
    if (!state.selectedTasks.size) return;
    state.tasks = state.tasks.filter(t => !state.selectedTasks.has(t.id));
    showToast(`已刪除 ${state.selectedTasks.size} 個任務`, 'info');
    state.selectedTasks.clear();
    save();
    render();
});

document.getElementById('bulkCompleteBtn').addEventListener('click', () => {
    state.selectedTasks.forEach(id => {
        const t = state.tasks.find(x => x.id === id);
        if (t) t.completed = true;
    });
    save();
    render();
    showToast(`已完成 ${state.selectedTasks.size} 個任務`, 'success');
});

document.getElementById('bulkUncompleteBtn').addEventListener('click', () => {
    state.selectedTasks.forEach(id => {
        const t = state.tasks.find(x => x.id === id);
        if (t) t.completed = false;
    });
    save();
    render();
    showToast('已取消完成', 'info');
});

document.getElementById('clearCompletedBtn').addEventListener('click', () => {
    const before = state.tasks.length;
    state.tasks = state.tasks.filter(t => !t.completed);
    const removed = before - state.tasks.length;
    state.selectedTasks.clear();
    save();
    render();
    showToast(`已清除 ${removed} 個已完成任務`, 'info');
});

/* ===== 拖曳排序 ===== */
function onDragStart(e) {
    state.dragSrcId = e.currentTarget.dataset.id;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over'));
    e.currentTarget.classList.add('drag-over');
}

function onDrop(e) {
    e.preventDefault();
    const targetId = e.currentTarget.dataset.id;
    if (!state.dragSrcId || state.dragSrcId === targetId) return;

    const srcIdx = state.tasks.findIndex(t => t.id === state.dragSrcId);
    const tgtIdx = state.tasks.findIndex(t => t.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1) return;

    const [removed] = state.tasks.splice(srcIdx, 1);
    state.tasks.splice(tgtIdx, 0, removed);
    save();
    render();
}

function onDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over'));
    state.dragSrcId = null;
}

/* ===== 深色模式 ===== */
const themeBtn = document.getElementById('themeBtn');
let isDark = localStorage.getItem('todo_theme') === 'dark';

function applyTheme() {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    themeBtn.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('todo_theme', isDark ? 'dark' : 'light');
}

themeBtn.addEventListener('click', () => {
    isDark = !isDark;
    applyTheme();
});

/* ===== 側邊欄 (手機) ===== */
const sidebar = document.getElementById('sidebar');
const menuBtn = document.getElementById('menuBtn');
const sidebarToggle = document.getElementById('sidebarToggle');

const overlay = document.createElement('div');
overlay.className = 'sidebar-overlay';
document.body.appendChild(overlay);

function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('visible');
}
function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
}

menuBtn.addEventListener('click', openSidebar);
sidebarToggle.addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);

/* ===== 匯出/匯入 ===== */
document.getElementById('exportBtn').addEventListener('click', () => {
    const data = { tasks: state.tasks, categories: state.categories, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `todo_export_${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('匯出成功', 'success');
});

document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
});

document.getElementById('importFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const data = JSON.parse(ev.target.result);
            if (Array.isArray(data.tasks)) {
                state.tasks = data.tasks;
                state.categories = Array.isArray(data.categories) ? data.categories : state.categories;
                save();
                render();
                showToast(`匯入成功：${data.tasks.length} 個任務`, 'success');
            } else {
                showToast('檔案格式不正確', 'error');
            }
        } catch { showToast('解析失敗', 'error'); }
        e.target.value = '';
    };
    reader.readAsText(file);
});

/* ===== 統計 ===== */
document.getElementById('statsBtn').addEventListener('click', () => {
    const total = state.tasks.length;
    const done = state.tasks.filter(t => t.completed).length;
    const active = state.tasks.filter(t => !t.completed).length;
    const overdue = state.tasks.filter(isOverdue).length;
    const high = state.tasks.filter(t => t.priority === 'high').length;
    const med = state.tasks.filter(t => t.priority === 'medium').length;
    const low = state.tasks.filter(t => t.priority === 'low').length;
    const pct = total ? Math.round(done / total * 100) : 0;
    const circum = 2 * Math.PI * 50;

    document.getElementById('sTotalTasks').textContent = total;
    document.getElementById('sCompletedTasks').textContent = done;
    document.getElementById('sActiveTasks').textContent = active;
    document.getElementById('sOverdueTasks').textContent = overdue;
    document.getElementById('sHighCount').textContent = high;
    document.getElementById('sMedCount').textContent = med;
    document.getElementById('sLowCount').textContent = low;

    const maxP = Math.max(high, med, low, 1);
    document.getElementById('sHighBar').style.width = Math.round(high / maxP * 100) + '%';
    document.getElementById('sMedBar').style.width = Math.round(med / maxP * 100) + '%';
    document.getElementById('sLowBar').style.width = Math.round(low / maxP * 100) + '%';

    document.getElementById('donutLabel').textContent = pct + '%';
    const fillLen = circum * pct / 100;
    document.getElementById('donutFill').setAttribute('stroke-dasharray', `${fillLen} ${circum - fillLen}`);

    showModal('statsModal');
});

/* ===== Modal 輔助 ===== */
function showModal(id) { document.getElementById(id).style.display = 'flex'; }
function hideModal(id) { document.getElementById(id).style.display = 'none'; }

// 新增任務按鈕 (點 filter bar 右邊空白處 not used, use topbar)
// 讓 topbar logo 可開 Modal
document.querySelector('.logo')?.addEventListener('dblclick', openAddModal);

// Modal 關閉
['modalClose','modalCancel'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => hideModal('taskModal'));
});
['categoryModalClose','categoryModalCancel'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => hideModal('categoryModal'));
});
document.getElementById('statsModalClose')?.addEventListener('click', () => hideModal('statsModal'));

// 點 overlay 關閉
document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => {
        if (e.target === el) hideModal(el.id);
    });
});

// Enter 儲存分類
document.getElementById('categoryName').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('categoryModalSave').click();
    if (e.key === 'Escape') hideModal('categoryModal');
});

/* ===== 鍵盤快速鍵 ===== */
document.addEventListener('keydown', e => {
    // Ctrl+N 新增
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openAddModal();
    }
    // Ctrl+F 搜尋
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
        document.getElementById('searchInput').select();
    }
    // Escape 關閉 Modal
    if (e.key === 'Escape') {
        ['taskModal','categoryModal','statsModal'].forEach(id => {
            if (document.getElementById(id).style.display !== 'none') hideModal(id);
        });
    }
});

/* ===== 右鍵 / 雙擊 開啟 Modal ===== */
document.getElementById('taskList').addEventListener('dblclick', e => {
    const item = e.target.closest('.task-item');
    if (item) openEditModal(item.dataset.id);
});

// 新增按鈕 (快速新增旁邊點擊更多)
document.getElementById('quickAddInput').addEventListener('keydown', e => {
    if (e.key === 'Tab') {
        e.preventDefault();
        const title = document.getElementById('quickAddInput').value.trim();
        if (title) {
            openAddModal();
            // 帶入標題
            setTimeout(() => { document.getElementById('taskTitle').value = title; }, 50);
            document.getElementById('quickAddInput').value = '';
        } else {
            openAddModal();
        }
    }
});

/* ===== 初始化 ===== */
function init() {
    load();
    applyTheme();
    render();

    // 若沒資料，加入範例任務
    if (state.tasks.length === 0) {
        const catId1 = genId();
        const catId2 = genId();
        state.categories = [
            { id: catId1, name: '工作', color: '#6366f1' },
            { id: catId2, name: '生活', color: '#10b981' },
        ];
        state.tasks = [
            {
                id: genId(), title: '歡迎使用待辦清單！',
                desc: '雙擊任務可編輯，按 Ctrl+N 快速新增，Tab 鍵進入詳細新增模式。',
                priority: 'high', categoryId: null,
                dueDate: today(), dueTime: null,
                tags: ['教學'], subtasks: [
                    { title: '試著完成這個任務', done: false },
                    { title: '新增一個分類', done: false },
                    { title: '嘗試深色模式', done: false },
                ],
                completed: false, createdAt: Date.now(),
            },
            {
                id: genId(), title: '完成季度報告',
                desc: '整理第一季度的銷售數據並製作簡報。',
                priority: 'high', categoryId: catId1,
                dueDate: new Date(Date.now() - 86400000).toISOString().slice(0,10),
                dueTime: null, tags: ['報告', '緊急'],
                subtasks: [], completed: false, createdAt: Date.now() - 10000,
            },
            {
                id: genId(), title: '買菜',
                desc: '牛奶、雞蛋、麵包、蔬菜',
                priority: 'medium', categoryId: catId2,
                dueDate: today(), dueTime: '18:00',
                tags: ['購物'], subtasks: [
                    { title: '牛奶', done: true },
                    { title: '雞蛋', done: false },
                    { title: '麵包', done: false },
                ],
                completed: false, createdAt: Date.now() - 5000,
            },
            {
                id: genId(), title: '閱讀《Clean Code》',
                desc: '每天至少讀 20 頁', priority: 'low', categoryId: catId1,
                dueDate: null, dueTime: null, tags: ['學習'],
                subtasks: [], completed: false, createdAt: Date.now() - 3000,
            },
            {
                id: genId(), title: '運動 30 分鐘',
                desc: '', priority: 'medium', categoryId: catId2,
                dueDate: null, dueTime: null, tags: ['健康'],
                subtasks: [], completed: true, createdAt: Date.now() - 2000,
            },
        ];
        save();
        render();
    }
}

init();
