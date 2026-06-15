const API = '/api/tasks';

const state = {
  status: '',
  priority: '',
  search: '',
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
  priorityFilter: $('#priority-filter'),
  newTaskBtn: $('#new-task-btn'),
  emptyNewBtn: $('#empty-new-btn'),
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
  deleteBtn: $('#delete-task-btn'),
  closeModal: $('#close-modal'),
  cancelBtn: $('#cancel-btn'),
  statTotal: $('#stat-total'),
  statOverdue: $('#stat-overdue'),
  toastContainer: $('#toast-container')
};

const STATUS_LABELS = {
  '': 'All Tasks',
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done'
};

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

function isOverdue(task) {
  if (!task.dueDate || task.status === 'done') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(task.dueDate + 'T00:00:00') < today;
}

function buildQuery() {
  const params = new URLSearchParams();
  if (state.status) params.set('status', state.status);
  if (state.priority) params.set('priority', state.priority);
  if (state.search) params.set('search', state.search);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function loadTasks() {
  try {
    state.tasks = await api(`${API}${buildQuery()}`);
    renderTasks();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function loadStats() {
  try {
    const stats = await api(`${API}/stats`);
    els.statTotal.textContent = stats.total;
    els.statOverdue.textContent = stats.overdue;
  } catch {
    /* stats are non-critical */
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
      if (e.target.closest('.task-checkbox')) return;
      openEditModal(card.dataset.id);
    });
  });

  els.taskList.querySelectorAll('.task-checkbox').forEach((box) => {
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleComplete(box.dataset.id, box.dataset.status);
    });
  });
}

function renderTaskCard(task) {
  const overdue = isOverdue(task);
  const dueLabel = task.dueDate ? formatDate(task.dueDate) : null;
  const isDone = task.status === 'done';

  return `
    <div class="task-card ${isDone ? 'done' : ''}" data-id="${task.id}">
      <div class="task-checkbox ${isDone ? 'checked' : ''}" data-id="${task.id}" data-status="${task.status}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </div>
      <div class="task-body">
        <div class="task-title">${escapeHtml(task.title)}</div>
        ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
        <div class="task-meta">
          <span class="badge badge-status-${task.status}">${task.status.replace('_', ' ')}</span>
          <span class="badge badge-priority-${task.priority}">${task.priority}</span>
          ${dueLabel ? `<span class="badge badge-due ${overdue ? 'overdue' : ''}">${overdue ? 'Overdue: ' : ''}${dueLabel}</span>` : ''}
          ${task.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
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
  els.modal.showModal();
}

async function openEditModal(id) {
  try {
    const task = await api(`${API}/${id}`);
    els.modalTitle.textContent = 'Edit Task';
    els.taskId.value = task.id;
    els.taskTitle.value = task.title;
    els.taskDescription.value = task.description;
    els.taskStatus.value = task.status;
    els.taskPriority.value = task.priority;
    els.taskDue.value = task.dueDate || '';
    els.taskTags.value = task.tags.join(', ');
    els.deleteBtn.classList.remove('hidden');
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

async function refresh() {
  await Promise.all([loadTasks(), loadStats()]);
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
    state.status = btn.dataset.status;
    refresh();
  });
});

els.priorityFilter.addEventListener('change', () => {
  state.priority = els.priorityFilter.value;
  loadTasks();
});

els.searchInput.addEventListener('input', onSearchInput);
els.newTaskBtn.addEventListener('click', openNewModal);
els.emptyNewBtn.addEventListener('click', openNewModal);
els.closeModal.addEventListener('click', closeModalFn);
els.cancelBtn.addEventListener('click', closeModalFn);
els.form.addEventListener('submit', saveTask);
els.deleteBtn.addEventListener('click', deleteTask);

els.modal.addEventListener('click', (e) => {
  if (e.target === els.modal) closeModalFn();
});

refresh();
