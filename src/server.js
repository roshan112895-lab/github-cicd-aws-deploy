const express = require('express');
const path = require('path');
const tasksRouter = require('./routes/tasks');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api', (_req, res) => {
  res.json({
    message: 'Task Management API is running',
    endpoints: {
      health: 'GET /health',
      stats: 'GET /api/tasks/stats',
      listTasks: 'GET /api/tasks?status=&priority=&search=',
      getTask: 'GET /api/tasks/:id',
      createTask: 'POST /api/tasks',
      updateTask: 'PUT /api/tasks/:id',
      patchTask: 'PATCH /api/tasks/:id',
      deleteTask: 'DELETE /api/tasks/:id'
    }
  });
});

app.use('/api/tasks', tasksRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`Task Manager running at http://localhost:${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or run with PORT=<number>.`);
    process.exit(1);
  }

  console.error('Failed to start server:', error);
  process.exit(1);
});
