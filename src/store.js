const { pool } = require('./db');

const STATUSES = ['todo', 'in_progress', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];
const SORT_FIELDS = ['updatedAt', 'createdAt', 'dueDate', 'priority', 'title'];

const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };

function normalizeTask(task) {
  return {
    id: String(task.id),
    title: task.title,
    description: task.description || '',
    status: task.status,
    priority: task.priority,
    dueDate: task.due_date || task.dueDate || null,
    tags: task.tags || [],
    createdAt: task.created_at || task.createdAt,
    updatedAt: task.updated_at || task.updatedAt
  };
}

function sortTasks(tasks, sortBy = 'updatedAt') {
  const field = SORT_FIELDS.includes(sortBy) ? sortBy : 'updatedAt';

  return [...tasks].sort((a, b) => {
    if (field === 'priority') {
      return (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
    }

    if (field === 'title') {
      return a.title.localeCompare(b.title);
    }

    if (field === 'dueDate') {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    }

    return new Date(b[field]) - new Date(a[field]);
  });
}

function filterTasks(tasks, { status, priority, search, tag, sort }) {
  let result = tasks;

  if (status && STATUSES.includes(status)) {
    result = result.filter((task) => task.status === status);
  }

  if (priority && PRIORITIES.includes(priority)) {
    result = result.filter((task) => task.priority === priority);
  }

  if (tag) {
    const tagQuery = tag.toLowerCase();
    result = result.filter((task) =>
      (task.tags || []).some((t) => t.toLowerCase() === tagQuery)
    );
  }

  if (search) {
    const query = search.toLowerCase();
    result = result.filter((task) => {
      const title = (task.title || '').toLowerCase();
      const description = (task.description || '').toLowerCase();
      const tags = (task.tags || []).some((t) => t.toLowerCase().includes(query));
      return title.includes(query) || description.includes(query) || tags;
    });
  }

  return sortTasks(result, sort);
}

async function getAllTasks(filters = {}) {
  const result = await pool.query(
    `SELECT id, title, description, status, priority, due_date, tags, created_at, updated_at
     FROM tasks`
  );
  return filterTasks(result.rows.map(normalizeTask), filters);
}

async function getTaskById(id) {
  const result = await pool.query(
    `SELECT id, title, description, status, priority, due_date, tags, created_at, updated_at
     FROM tasks
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  return result.rowCount ? normalizeTask(result.rows[0]) : null;
}

async function createTask(payload) {
  const result = await pool.query(
    `INSERT INTO tasks (title, description, status, priority, due_date, tags)
     VALUES ($1, $2, $3, $4, $5, $6::text[])
     RETURNING id, title, description, status, priority, due_date, tags, created_at, updated_at`,
    [
      payload.title,
      payload.description || '',
      payload.status || 'todo',
      payload.priority || 'medium',
      payload.dueDate || null,
      payload.tags || []
    ]
  );
  return normalizeTask(result.rows[0]);
}

async function duplicateTask(id) {
  const source = await getTaskById(id);
  if (!source) {
    return null;
  }

  const copy = await createTask({
    title: `${source.title} (copy)`,
    description: source.description || '',
    status: 'todo',
    priority: source.priority || 'medium',
    dueDate: source.dueDate || null,
    tags: source.tags || []
  });
  return copy;
}

async function updateTask(id, payload) {
  const sets = [];
  const values = [];
  let index = 1;

  if (payload.title !== undefined) {
    sets.push(`title = $${index++}`);
    values.push(payload.title);
  }
  if (payload.description !== undefined) {
    sets.push(`description = $${index++}`);
    values.push(payload.description);
  }
  if (payload.status !== undefined) {
    sets.push(`status = $${index++}`);
    values.push(payload.status);
  }
  if (payload.priority !== undefined) {
    sets.push(`priority = $${index++}`);
    values.push(payload.priority);
  }
  if (payload.dueDate !== undefined) {
    sets.push(`due_date = $${index++}`);
    values.push(payload.dueDate);
  }
  if (payload.tags !== undefined) {
    sets.push(`tags = $${index++}::text[]`);
    values.push(payload.tags);
  }

  if (!sets.length) {
    return getTaskById(id);
  }

  sets.push('updated_at = NOW()');
  values.push(id);

  const result = await pool.query(
    `UPDATE tasks
     SET ${sets.join(', ')}
     WHERE id = $${index}
     RETURNING id, title, description, status, priority, due_date, tags, created_at, updated_at`,
    values
  );
  return result.rowCount ? normalizeTask(result.rows[0]) : null;
}

async function deleteTask(id) {
  const result = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
  return result.rowCount > 0;
}

async function deleteCompletedTasks() {
  const result = await pool.query(`DELETE FROM tasks WHERE status = 'done'`);
  return result.rowCount || 0;
}

async function getAllTags() {
  const result = await pool.query(
    `SELECT DISTINCT unnest(tags) AS tag
     FROM tasks
     WHERE array_length(tags, 1) > 0`
  );
  return result.rows.map((r) => r.tag).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

async function getStats() {
  const result = await pool.query(
    `SELECT id, title, description, status, priority, due_date, tags, created_at, updated_at
     FROM tasks`
  );
  const tasks = result.rows.map(normalizeTask);
  const stats = {
    total: tasks.length,
    todo: 0,
    in_progress: 0,
    done: 0,
    overdue: 0,
    dueToday: 0
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  for (const task of tasks) {
    stats[task.status] += 1;

    if (task.dueDate && task.status !== 'done') {
      if (task.dueDate === todayStr) {
        stats.dueToday += 1;
      }

      const due = new Date(task.dueDate + 'T00:00:00');
      if (due < today) {
        stats.overdue += 1;
      }
    }
  }

  return stats;
}

module.exports = {
  STATUSES,
  PRIORITIES,
  SORT_FIELDS,
  getAllTasks,
  getTaskById,
  createTask,
  duplicateTask,
  updateTask,
  deleteTask,
  deleteCompletedTasks,
  getAllTags,
  getStats
};
