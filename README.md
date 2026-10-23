# NeysaTree — Menu Management System

A web-based menu management system for creating, organizing, updating, and deleting hierarchical menu items.

## Overview

NeysaTree is a full-stack web application that allows users to manage menu structures through a simple interface. Menu items can be organized into root menus and nested child menus.

## Features

- View menus in a hierarchical tree structure.
- Create root menus and child menus.
- Edit existing menu titles.
- Delete menu items, including their descendants.
- Select a parent menu when creating a nested item.
- Store menu data in a MySQL database.
- Search and view menu information through the frontend interface.

## Technologies Used

### Frontend

- React
- TypeScript
- Vite
- CSS

### Backend

- Go
- MySQL
- REST API
- JSON

## Project Structure

```text
menu-tree-system/
├── backend/
│   ├── main.go
│   ├── go.mod
│   ├── go.sum
│   └── .env.example
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── .gitignore
└── README.md
```

## Prerequisites

Before running the application, make sure the following are installed:

- Node.js and npm
- Go
- MySQL Server

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/neysaqillaauldeyy/neysatree-menu-management.git
cd neysatree-menu-management
```

### 2. Configure the database

Create a MySQL database named `neysatree_db`.

Configure the database connection using environment variables in the backend `.env` file. Refer to `backend/.env.example` for the required configuration.

Do not commit the `.env` file or expose database credentials.

Ensure the `menus` table exists with the required fields: `id`, `title`, `parent_id`, `created_at`, and `updated_at`. The `parent_id` field supports hierarchical relationships between menus.

### 3. Run the backend

Open a terminal in the `backend` directory:

```bash
go mod download
go run main.go
```

The backend API runs at:

`http://localhost:8080`

### 4. Run the frontend

Open another terminal in the `frontend` directory:

```bash
npm install
npm run dev
```

Open the local URL displayed by Vite, usually:

`http://localhost:5173`

## API Endpoints

| Method | Endpoint          | Description                            |
| ------ | ----------------- | -------------------------------------- |
| GET    | `/api/health`     | Check backend health                   |
| GET    | `/api/health/db`  | Check database connectivity            |
| GET    | `/api/menus`      | Retrieve the menu hierarchy            |
| POST   | `/api/menus`      | Create a menu item                     |
| PUT    | `/api/menus/{id}` | Update a menu title                    |
| DELETE | `/api/menus/{id}` | Delete a menu item and its descendants |

Menu creation requests use JSON and may include `parent_id` to specify a parent menu. Use `null` for a root menu.

## Notes

- Ensure MySQL is running before starting the backend.
- Configure the backend database credentials locally.
- The backend must be running for frontend API requests to work.
- Deleting a parent menu also deletes its descendants.
