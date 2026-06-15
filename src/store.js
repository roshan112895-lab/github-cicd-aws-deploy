const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'tasks.json');

const STATUSES = ['todo', 'in_progress', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];
const SORT_FIELDS = ['updatedAt', 'createdAt', 'dueDate', 'priority', 'title'];

const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };

async function readTasks() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await writeTasks([]);
      return [];
    }
    throw error;
  }
}

async function writeTasks(tasks) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(tasks, null, 2), 'utf8');
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
  const tasks = await readTasks();
  return filterTasks(tasks, filters);
}

async function getTaskById(id) {
  const tasks = await readTasks();
  return tasks.find((task) => task.id === id) || null;
}

async function createTask(payload) {
  const tasks = await readTasks();
  const now = new Date().toISOString();
  const task = {
    id: crypto.randomUUID(),
    title: payload.title,
    description: payload.description || '',
    status: payload.status || 'todo',
    priority: payload.priority || 'medium',
    dueDate: payload.dueDate || null,
    tags: payload.tags || [],
    createdAt: now,
    updatedAt: now
  };

  tasks.push(task);
  await writeTasks(tasks);
  return task;
}

async function duplicateTask(id) {
  const tasks = await readTasks();
  const source = tasks.find((task) => task.id === id);

  if (!source) {
    return null;
  }

  const now = new Date().toISOString();
  const copy = {
    ...source,
    id: crypto.randomUUID(),
    title: `${source.title} (copy)`,
    status: 'todo',
    createdAt: now,
    updatedAt: now
  };

  tasks.push(copy);
  await writeTasks(tasks);
  return copy;
}

async function updateTask(id, payload) {
  const tasks = await readTasks();
  const index = tasks.findIndex((task) => task.id === id);

  if (index === -1) {
    return null;
  }

  const updatedTask = {
    ...tasks[index],
    ...payload,
    id: tasks[index].id,
    createdAt: tasks[index].createdAt,
    updatedAt: new Date().toISOString()
  };

  tasks[index] = updatedTask;
  await writeTasks(tasks);
  return updatedTask;
}

async function deleteTask(id) {
  const tasks = await readTasks();
  const index = tasks.findIndex((task) => task.id === id);

  if (index === -1) {
    return false;
  }

  tasks.splice(index, 1);
  await writeTasks(tasks);
  return true;
}

async function deleteCompletedTasks() {
  const tasks = await readTasks();
  const remaining = tasks.filter((task) => task.status !== 'done');
  const removed = tasks.length - remaining.length;

  if (removed > 0) {
    await writeTasks(remaining);
  }

  return removed;
}

async function getAllTags() {
  const tasks = await readTasks();
  const tagSet = new Set();

  for (const task of tasks) {
    for (const tag of task.tags || []) {
      if (tag) tagSet.add(tag);
    }
  }

  return [...tagSet].sort((a, b) => a.localeCompare(b));
}

async function getStats() {
  const tasks = await readTasks();
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
