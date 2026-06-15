const API = '/api/tasks';

const state = {
  status: '',
  priority: '',
  tag: '',
  search: '',
  sort: 'updatedAt',
  tasks: []
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {
  taskList: $('#task-list'),
  emptyState: $('#empty-state'),
  pageTitle: $('#page-title'),
  taskCount: $('#task-count'),
  searchInput: $('#search-input'),
  tagFilter: $('#tag-filter'),
  priorityFilter: $('#priority-filter'),
  sortFilter: $('#sort-filter'),
  newTaskBtn: $('#new-task-btn'),
  emptyNewBtn: $('#empty-new-btn'),
  exportBtn: $('#export-btn'),
  clearCompletedBtn: $('#clear-completed-btn'),
  modal: $('#task-modal'),
  form: $('#task-form'),
  modalTitle: $('#modal-title'),
  taskId: $('#task-id'),
  taskTitle: $('#task-title'),
  taskDescription: $('#task-description'),
  taskStatus: $('#task-status'),
  taskPriority: $('#task-priority'),
  taskDue: $('#task-due'),
  taskTags: $('#task-tags'),
  taskMetaInfo: $('#task-meta-info'),
  deleteBtn: $('#delete-task-btn'),
  duplicateBtn: $('#duplicate-task-btn'),
  closeModal: $('#close-modal'),
  cancelBtn: $('#cancel-btn'),
  statTotal: $('#stat-total'),
  statOverdue: $('#stat-overdue'),
  statDueToday: $('#stat-due-today'),
  navCountTodo: $('#nav-count-todo'),
  navCountInProgress: $('#nav-count-in-progress'),
  navCountDone: $('#nav-count-done'),
  toastContainer: $('#toast-container')
};

const STATUS_LABELS = {
  '': 'All Tasks',
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done'
};

const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (res.status === 204) return null;

  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Request failed');
  return body.data;
}

function toast(message, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  els.toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function todayStr() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function isOverdue(task) {
  if (!task.dueDate || task.status === 'done') return false;
  return task.dueDate < todayStr();
}

function isDueToday(task) {
  if (!task.dueDate || task.status === 'done') return false;
  return task.dueDate === todayStr();
}

function buildQuery() {
  const params = new URLSearchParams();
  if (state.status) params.set('status', state.status);
  if (state.priority) params.set('priority', state.priority);
  if (state.tag) params.set('tag', state.tag);
  if (state.search) params.set('search', state.search);
  if (state.sort) params.set('sort', state.sort);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function loadTasks() {
  try {
    const data = await api(`${API}${buildQuery()}`);
    state.tasks = Array.isArray(data) ? data : [];
    renderTasks();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function loadTags() {
  try {
    const tags = await api(`${API}/tags`);
    const current = els.tagFilter.value;
    els.tagFilter.innerHTML = '<option value="">All tags</option>';
    (tags || []).forEach((tag) => {
      const opt = document.createElement('option');
      opt.value = tag;
      opt.textContent = tag;
      els.tagFilter.appendChild(opt);
    });
    if ([...els.tagFilter.options].some((o) => o.value === current)) {
      els.tagFilter.value = current;
    }
  } catch {
    /* non-critical */
  }
}

async function loadStats() {
  try {
    const stats = await api(`${API}/stats`);
    els.statTotal.textContent = stats.total;
    els.statOverdue.textContent = stats.overdue;
    els.statDueToday.textContent = stats.dueToday;
    els.navCountTodo.textContent = stats.todo;
    els.navCountInProgress.textContent = stats.in_progress;
    els.navCountDone.textContent = stats.done;
  } catch {
    /* non-critical */
  }
}

function renderTasks() {
  const tasks = state.tasks;
  els.pageTitle.textContent = STATUS_LABELS[state.status] || 'All Tasks';
  els.taskCount.textContent = `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`;

  if (tasks.length === 0) {
    els.taskList.classList.add('hidden');
    els.emptyState.classList.remove('hidden');
    return;
  }

  els.taskList.classList.remove('hidden');
  els.emptyState.classList.add('hidden');
  els.taskList.innerHTML = tasks.map(renderTaskCard).join('');

  els.taskList.querySelectorAll('.task-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.task-actions, .task-checkbox')) return;
      openEditModal(card.dataset.id);
    });
  });

  els.taskList.querySelectorAll('.task-checkbox').forEach((box) => {
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleComplete(box.dataset.id, box.dataset.status);
    });
  });

  els.taskList.querySelectorAll('.btn-duplicate').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      duplicateTask(btn.dataset.id);
    });
  });
}

function renderTaskCard(task) {
  const overdue = isOverdue(task);
  const dueToday = isDueToday(task);
  const dueLabel = task.dueDate ? formatDate(task.dueDate) : null;
  const isDone = task.status === 'done';
  const tags = task.tags || [];

  let dueBadge = '';
  if (dueLabel) {
    if (overdue) dueBadge = `<span class="badge badge-due overdue">Overdue: ${dueLabel}</span>`;
    else if (dueToday) dueBadge = `<span class="badge badge-due due-today">Due today</span>`;
    else dueBadge = `<span class="badge badge-due">${dueLabel}</span>`;
  }

  return `
    <div class="task-card ${isDone ? 'done' : ''} ${overdue ? 'overdue-card' : ''}" data-id="${task.id}">
      <div class="task-checkbox ${isDone ? 'checked' : ''}" data-id="${task.id}" data-status="${task.status}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </div>
      <div class="task-body">
        <div class="task-title-row">
          <div class="task-title">${escapeHtml(task.title)}</div>
          <div class="task-actions">
            <button class="btn-icon btn-duplicate" data-id="${task.id}" title="Duplicate task" type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            </button>
          </div>
        </div>
        ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
        <div class="task-meta">
          <span class="badge badge-status-${task.status}">${task.status.replace('_', ' ')}</span>
          <span class="badge badge-priority-${task.priority}">${PRIORITY_LABELS[task.priority] || task.priority}</span>
          ${dueBadge}
          ${tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function openNewModal() {
  els.modalTitle.textContent = 'New Task';
  els.form.reset();
  els.taskId.value = '';
  els.taskPriority.value = 'medium';
  els.deleteBtn.classList.add('hidden');
  els.duplicateBtn.classList.add('hidden');
  els.taskMetaInfo.classList.add('hidden');
  els.modal.showModal();
  els.taskTitle.focus();
}

async function openEditModal(id) {
  try {
    const task = await api(`${API}/${id}`);
    els.modalTitle.textContent = 'Edit Task';
    els.taskId.value = task.id;
    els.taskTitle.value = task.title;
    els.taskDescription.value = task.description || '';
    els.taskStatus.value = task.status;
    els.taskPriority.value = task.priority;
    els.taskDue.value = task.dueDate || '';
    els.taskTags.value = (task.tags || []).join(', ');
    els.taskMetaInfo.textContent = `Created ${formatDateTime(task.createdAt)} · Updated ${formatDateTime(task.updatedAt)}`;
    els.taskMetaInfo.classList.remove('hidden');
    els.deleteBtn.classList.remove('hidden');
    els.duplicateBtn.classList.remove('hidden');
    els.modal.showModal();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function closeModalFn() {
  els.modal.close();
}

async function saveTask(e) {
  e.preventDefault();

  const payload = {
    title: els.taskTitle.value.trim(),
    description: els.taskDescription.value.trim(),
    status: els.taskStatus.value,
    priority: els.taskPriority.value,
    dueDate: els.taskDue.value || null,
    tags: els.taskTags.value
  };

  try {
    const id = els.taskId.value;
    if (id) {
      await api(`${API}/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      toast('Task updated');
    } else {
      await api(API, { method: 'POST', body: JSON.stringify(payload) });
      toast('Task created');
    }
    closeModalFn();
    await refresh();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteTask() {
  const id = els.taskId.value;
  if (!id || !confirm('Delete this task permanently?')) return;

  try {
    await api(`${API}/${id}`, { method: 'DELETE' });
    toast('Task deleted');
    closeModalFn();
    await refresh();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function duplicateTask(id) {
  try {
    await api(`${API}/${id}/duplicate`, { method: 'POST' });
    toast('Task duplicated');
    closeModalFn();
    await refresh();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function toggleComplete(id, currentStatus) {
  const newStatus = currentStatus === 'done' ? 'todo' : 'done';
  try {
    await api(`${API}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus })
    });
    await refresh();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function clearCompleted() {
  if (!confirm('Remove all completed tasks? This cannot be undone.')) return;

  try {
    const result = await api(`${API}/completed`, { method: 'DELETE' });
    toast(result.removed ? `Removed ${result.removed} task(s)` : 'No completed tasks to remove');
    await refresh();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function exportTasks() {
  window.location.href = `${API}/export`;
  toast('Downloading tasks...');
}

async function refresh() {
  await Promise.all([loadTasks(), loadStats(), loadTags()]);
}

let searchTimeout;
function onSearchInput() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    state.search = els.searchInput.value.trim();
    loadTasks();
  }, 300);
}

$$('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.nav-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.status = btn.dataset.status || '';
    refresh();
  });
});

els.tagFilter.addEventListener('change', () => {
  state.tag = els.tagFilter.value;
  loadTasks();
});

els.priorityFilter.addEventListener('change', () => {
  state.priority = els.priorityFilter.value;
  loadTasks();
});

els.sortFilter.addEventListener('change', () => {
  state.sort = els.sortFilter.value;
  loadTasks();
});

els.searchInput.addEventListener('input', onSearchInput);
els.newTaskBtn.addEventListener('click', openNewModal);
els.emptyNewBtn.addEventListener('click', openNewModal);
els.exportBtn.addEventListener('click', exportTasks);
els.clearCompletedBtn.addEventListener('click', clearCompleted);
els.closeModal.addEventListener('click', closeModalFn);
els.cancelBtn.addEventListener('click', closeModalFn);
els.form.addEventListener('submit', saveTask);
els.deleteBtn.addEventListener('click', deleteTask);
els.duplicateBtn.addEventListener('click', () => {
  const id = els.taskId.value;
  if (id) duplicateTask(id);
});

els.modal.addEventListener('click', (e) => {
  if (e.target === els.modal) closeModalFn();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && els.modal.open) closeModalFn();
  if (e.key === 'n' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT'
      && document.activeElement.tagName !== 'TEXTAREA' && !els.modal.open) {
    openNewModal();
  }
});

refresh();
