const express = require('express');
const store = require('../store');

const router = express.Router();

function parseTags(value) {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function validateTaskPayload(body, { partial = false } = {}) {
  const errors = [];
  const result = {};

  if (!partial || body.title !== undefined) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      errors.push('title is required and must be a non-empty string');
    } else {
      result.title = title;
    }
  }

  if (!partial || body.description !== undefined) {
    result.description =
      typeof body.description === 'string' ? body.description.trim() : '';
  }

  if (!partial || body.status !== undefined) {
    const status = body.status || 'todo';
    if (!store.STATUSES.includes(status)) {
      errors.push(`status must be one of: ${store.STATUSES.join(', ')}`);
    } else {
      result.status = status;
    }
  }

  if (!partial || body.priority !== undefined) {
    const priority = body.priority || 'medium';
    if (!store.PRIORITIES.includes(priority)) {
      errors.push(`priority must be one of: ${store.PRIORITIES.join(', ')}`);
    } else {
      result.priority = priority;
    }
  }

  if (!partial || body.dueDate !== undefined) {
    if (body.dueDate === null || body.dueDate === '') {
      result.dueDate = null;
    } else if (typeof body.dueDate === 'string' && !Number.isNaN(Date.parse(body.dueDate))) {
      result.dueDate = body.dueDate;
    } else {
      errors.push('dueDate must be a valid ISO date string or null');
    }
  }

  if (!partial || body.tags !== undefined) {
    result.tags = parseTags(body.tags);
  }

  if (errors.length) {
    return { error: errors.join('; ') };
  }

  return result;
}

router.get('/stats', async (_req, res, next) => {
  try {
    const stats = await store.getStats();
    res.json({ data: stats });
  } catch (error) {
    next(error);
  }
});

router.get('/tags', async (_req, res, next) => {
  try {
    const tags = await store.getAllTags();
    res.json({ data: tags });
  } catch (error) {
    next(error);
  }
});

router.get('/export', async (_req, res, next) => {
  try {
    const tasks = await store.getAllTasks();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="tasks-export.json"');
    res.json({ exportedAt: new Date().toISOString(), tasks });
  } catch (error) {
    next(error);
  }
});

router.delete('/completed', async (_req, res, next) => {
  try {
    const removed = await store.deleteCompletedTasks();
    res.json({ data: { removed } });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const tasks = await store.getAllTasks({
      status: req.query.status,
      priority: req.query.priority,
      search: req.query.search,
      tag: req.query.tag,
      sort: req.query.sort
    });
    res.json({ data: tasks });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const task = await store.duplicateTask(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.status(201).json({ data: task });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const task = await store.getTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ data: task });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const payload = validateTaskPayload(req.body);

    if (payload.error) {
      return res.status(400).json({ error: payload.error });
    }

    const task = await store.createTask(payload);
    res.status(201).json({ data: task });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const payload = validateTaskPayload(req.body);

    if (payload.error) {
      return res.status(400).json({ error: payload.error });
    }

    const task = await store.updateTask(req.params.id, payload);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ data: task });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const payload = validateTaskPayload(req.body, { partial: true });

    if (payload.error) {
      return res.status(400).json({ error: payload.error });
    }

    if (!Object.keys(payload).length) {
      return res.status(400).json({ error: 'At least one field is required' });
    }

    const task = await store.updateTask(req.params.id, payload);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ data: task });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await store.deleteTask(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
