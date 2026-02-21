const CLIENT_ID = "PASTE_YOUR_CLIENT_ID_HERE";
const SCOPE = "https://www.googleapis.com/auth/tasks";

let accessToken = null;
let tokenClient = null;

const statusEl = document.getElementById("status");
const btnSignIn = document.getElementById("btnSignIn");
const btnSignOut = document.getElementById("btnSignOut");
const btnRefresh = document.getElementById("btnRefresh");
const btnAdd = document.getElementById("btnAdd");
const newTitle = document.getElementById("newTitle");
const tasksEl = document.getElementById("tasks");
const taskListSelect = document.getElementById("taskListSelect");

function setUI(signedIn) {
  btnSignOut.disabled = !signedIn;
  btnRefresh.disabled = !signedIn;
  btnAdd.disabled = !signedIn;
  taskListSelect.disabled = !signedIn;
  statusEl.textContent = signedIn ? "Signed in" : "Not signed in";
}

async function api(path, opts = {}) {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(opts.headers || {})
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function loadTaskLists() {
  const data = await api("users/@me/lists");
  const lists = data.items || [];

  taskListSelect.innerHTML = "";

  if (lists.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No task lists found";
    taskListSelect.appendChild(opt);
    return;
  }

  for (const l of lists) {
    const opt = document.createElement("option");
    opt.value = l.id;
    opt.textContent = l.title;
    taskListSelect.appendChild(opt);
  }
}

function renderEmpty(msg) {
  tasksEl.innerHTML = `<div class="muted" style="padding:10px 0">${msg}</div>`;
}

async function loadTasks() {
  const listId = taskListSelect.value;
  if (!listId) {
    renderEmpty("No list selected");
    return;
  }

  const data = await api(`lists/${encodeURIComponent(listId)}/tasks?showCompleted=true&showHidden=false`);
  const items = data.items || [];

  if (items.length === 0) {
    renderEmpty("No tasks");
    return;
  }

  tasksEl.innerHTML = "";

  for (const t of items) {
    const row = document.createElement("div");
    row.className = "task";

    const left = document.createElement("div");
    left.className = "taskLeft";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = t.status === "completed";

    cb.addEventListener("change", async () => {
      const listIdNow = taskListSelect.value;
      try {
        const patch = cb.checked
          ? { status: "completed", completed: new Date().toISOString() }
          : { status: "needsAction", completed: null };
        await api(`lists/${encodeURIComponent(listIdNow)}/tasks/${encodeURIComponent(t.id)}`, {
          method: "PATCH",
          body: JSON.stringify(patch)
        });
        await loadTasks();
      } catch (e) {
        cb.checked = !cb.checked;
        alert(`Update failed: ${e.message}`);
      }
    });

    const title = document.createElement("div");
    title.className = "taskTitle" + (t.status === "completed" ? " done" : "");
    title.textContent = t.title || "(no title)";

    left.appendChild(cb);
    left.appendChild(title);

    const right = document.createElement("div");
    right.className = "taskBtns";

    const del = document.createElement("button");
    del.className = "small";
    del.textContent = "Delete";
    del.addEventListener("click", async () => {
      const listIdNow = taskListSelect.value;
      if (!confirm("Delete this task?")) return;
      try {
        await api(`lists/${encodeURIComponent(listIdNow)}/tasks/${encodeURIComponent(t.id)}`, {
          method: "DELETE"
        });
        await loadTasks();
      } catch (e) {
        alert(`Delete failed: ${e.message}`);
      }
    });

    right.appendChild(del);

    row.appendChild(left);
    row.appendChild(right);
    tasksEl.appendChild(row);
  }
}

async function refreshAll() {
  await loadTaskLists();
  await loadTasks();
}

btnAdd.addEventListener("click", async () => {
  const title = newTitle.value.trim();
  if (!title) return;

  const listId = taskListSelect.value;
  if (!listId) return;

  try {
    await api(`lists/${encodeURIComponent(listId)}/tasks`, {
      method: "POST",
      body: JSON.stringify({ title })
    });
    newTitle.value = "";
    await loadTasks();
  } catch (e) {
    alert(`Add failed: ${e.message}`);
  }
});

btnRefresh.addEventListener("click", async () => {
  try {
    await refreshAll();
  } catch (e) {
    alert(`Refresh failed: ${e.message}`);
  }
});

btnSignOut.addEventListener("click", () => {
  accessToken = null;
  tasksEl.innerHTML = "";
  taskListSelect.innerHTML = "";
  setUI(false);
});

taskListSelect.addEventListener("change", () => loadTasks());

window.addEventListener("load", () => {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: async (resp) => {
      if (!resp || !resp.access_token) return;
      accessToken = resp.access_token;
      setUI(true);
      try {
        await refreshAll();
      } catch (e) {
        alert(`Load failed: ${e.message}`);
      }
    }
  });

  btnSignIn.addEventListener("click", () => {
    tokenClient.requestAccessToken({ prompt: "consent" });
  });

  setUI(false);
  renderEmpty("Sign in to load tasks");
});
