# TaskFlow — Task Management App

A full-stack task management application with a REST API, modern web UI, JSON file storage, Docker containerization, and automated AWS ECS deployment via GitHub Actions.

## Features

- **Web UI** — Create, edit, delete, and filter tasks from a dark-themed dashboard
- **Task fields** — Title, description, status, priority, due date, and tags
- **Filtering** — Filter by status, priority, or search across title/description/tags
- **Quick actions** — Toggle task completion with one click
- **Stats** — View total and overdue task counts
- **REST API** — Full CRUD + partial updates for programmatic access
- **Docker** — Production-ready container with health checks
- **CI/CD** — GitHub Actions pipeline: build → push to ECR → deploy to ECS

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3002](http://localhost:3002) in your browser.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/tasks/stats` | Task statistics |
| GET | `/api/tasks` | List tasks (`?status=&priority=&search=`) |
| GET | `/api/tasks/:id` | Get one task |
| POST | `/api/tasks` | Create task |
| PUT | `/api/tasks/:id` | Full update |
| PATCH | `/api/tasks/:id` | Partial update |
| DELETE | `/api/tasks/:id` | Delete task |

### Example requests

```bash
# Create a task
curl -X POST http://localhost:3002/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix login bug","description":"Users cannot reset password","status":"todo","priority":"high","dueDate":"2026-06-20","tags":["bug","auth"]}'

# List in-progress tasks
curl "http://localhost:3002/api/tasks?status=in_progress"

# Mark task as done
curl -X PATCH http://localhost:3002/api/tasks/<id> \
  -H "Content-Type: application/json" \
  -d '{"status":"done"}'

# Get stats
curl http://localhost:3002/api/tasks/stats
```

## Docker

```bash
docker compose up --build
```

The `data/` folder is mounted as a volume so task data persists locally.

## AWS deployment

### 1. AWS resources

- **ECR repository** for the Docker image
- **ECS cluster + service** (Fargate recommended)
- **Task definition** with container name `api`, port `3002`, health check path `/health`
- **Application Load Balancer** target group pointing to port `3002`

For persistent task data in ECS, mount **EFS** to `/app/data` in the task definition.

### 2. GitHub secrets

| Secret | Example |
|--------|---------|
| `AWS_ACCESS_KEY_ID` | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret |
| `AWS_REGION` | `us-east-1` |
| `ECR_REPOSITORY` | `taskflow` |
| `ECS_CLUSTER` | `my-cluster` |
| `ECS_SERVICE` | `api-service` |
| `ECS_TASK_DEFINITION` | `api-task` |

### 3. Deploy

Push to `main` or trigger the workflow manually from the Actions tab.

## Project structure

```
.
├── .github/workflows/deploy-aws.yml
├── data/tasks.json
├── public/
│   ├── index.html
│   ├── css/styles.css
│   └── js/app.js
├── src/
│   ├── server.js
│   ├── store.js
│   └── routes/tasks.js
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3002` | Server port |
| `DATA_FILE` | `./data/tasks.json` | Path to task storage file |
