const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'tasks.json');

const STATUSES = ['todo', 'in_progress', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];

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

function filterTasks(tasks, { status, priority, search }) {
  let result = tasks;

  if (status && STATUSES.includes(status)) {
    result = result.filter((task) => task.status === status);
  }

  if (priority && PRIORITIES.includes(priority)) {
    result = result.filter((task) => task.priority === priority);
  }

  if (search) {
    const query = search.toLowerCase();
    result = result.filter(
      (task) =>
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  }

  return result.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
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

async function getStats() {
  const tasks = await readTasks();
  const stats = {
    total: tasks.length,
    todo: 0,
    in_progress: 0,
    done: 0,
    overdue: 0
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const task of tasks) {
    stats[task.status] += 1;

    if (task.dueDate && task.status !== 'done') {
      const due = new Date(task.dueDate);
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
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getStats
};
