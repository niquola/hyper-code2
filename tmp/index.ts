import { serve } from "bun";

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

let todos: Todo[] = [];
let nextId = 1;

const server = serve({
  port: 3001,
  fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // GET /todos
    if (method === "GET" && path === "/todos") {
      return new Response(JSON.stringify(todos), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // POST /todos
    if (method === "POST" && path === "/todos") {
      const body = req.json();
      body.then((data: { text: string }) => {
        const todo: Todo = {
          id: nextId++,
          text: data.text,
          done: false,
        };
        todos.push(todo);
      });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // PATCH /todos/:id
    if (method === "PATCH" && path.match(/^\/todos\/\d+$/)) {
      const id = parseInt(path.split("/")[2]);
      const todo = todos.find((t) => t.id === id);
      if (todo) {
        req.json().then((data: { done?: boolean; text?: string }) => {
          if (data.done !== undefined) todo.done = data.done;
          if (data.text !== undefined) todo.text = data.text;
        });
        return new Response(JSON.stringify(todo), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    }

    // DELETE /todos/:id
    if (method === "DELETE" && path.match(/^\/todos\/\d+$/)) {
      const id = parseInt(path.split("/")[2]);
      const idx = todos.findIndex((t) => t.id === id);
      if (idx !== -1) {
        todos.splice(idx, 1);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    }

    // GET /
    if (method === "GET" && path === "/") {
      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Server running at http://localhost:${server.port}`);

const html = `<!DOCTYPE html>
<html>
<head>
  <title>Todo App</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 50px auto; }
    input { padding: 8px; width: 300px; }
    button { padding: 8px 16px; cursor: pointer; }
    ul { list-style: none; padding: 0; }
    li { padding: 10px; border: 1px solid #ddd; margin: 5px 0; display: flex; justify-content: space-between; }
    .done { text-decoration: line-through; opacity: 0.6; }
  </style>
</head>
<body>
  <h1>Todo App</h1>
  <div>
    <input type="text" id="input" placeholder="Add a new todo...">
    <button onclick="addTodo()">Add</button>
  </div>
  <ul id="list"></ul>

  <script>
    async function loadTodos() {
      const res = await fetch("/todos");
      const todos = await res.json();
      const list = document.getElementById("list");
      list.innerHTML = "";
      todos.forEach(todo => {
        const li = document.createElement("li");
        li.className = todo.done ? "done" : "";
        li.innerHTML = \`
          <span onclick="toggleTodo(\${todo.id})" style="cursor: pointer; flex: 1;">\${todo.text}</span>
          <button onclick="deleteTodo(\${todo.id})">Delete</button>
        \`;
        list.appendChild(li);
      });
    }

    async function addTodo() {
      const input = document.getElementById("input");
      const text = input.value.trim();
      if (!text) return;
      await fetch("/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      input.value = "";
      loadTodos();
    }

    async function toggleTodo(id) {
      const res = await fetch("/todos");
      const todos = await res.json();
      const todo = todos.find(t => t.id === id);
      await fetch(\`/todos/\${id}\`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !todo.done })
      });
      loadTodos();
    }

    async function deleteTodo(id) {
      await fetch(\`/todos/\${id}\`, { method: "DELETE" });
      loadTodos();
    }

    loadTodos();
  </script>
</body>
</html>`;