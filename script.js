// ========= Utilities & State ==========
const state = {
  tasks: [],
  settings: { theme: "light" },
  streak: 0,
  timer: { running: false, secs: 1500, interval: null, isBreak: false },
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function save() {
  localStorage.setItem(
    "ssp:data",
    JSON.stringify({
      tasks: state.tasks,
      settings: state.settings,
      streak: state.streak,
    })
  );
}
function load() {
  const d = JSON.parse(localStorage.getItem("ssp:data") || "null");
  if (d) {
    state.tasks = d.tasks || [];
    state.settings = d.settings || state.settings;
    state.streak = d.streak || 0;
  }
}

// ========= Init ==========
load();
document.body.setAttribute("data-theme", state.settings.theme || "light");
document.getElementById("streakDisplay").querySelector("strong").textContent =
  state.streak;

// ========= DOM refs ==========
const taskGrid = document.getElementById("taskGrid");
const totalTasks = document.getElementById("totalTasks");
const completedTasks = document.getElementById("completedTasks");

// ========= Render Tasks ==========
function renderTasks(filter) {
  taskGrid.innerHTML = "";
  const q = document.getElementById("searchInput").value.toLowerCase();
  const items = state.tasks
    .filter((t) => {
      if (filter === "today") {
        const d = new Date(t.date || "");
        const today = new Date();
        return d.toDateString() === today.toDateString();
      }
      if (filter === "week") {
        const d = new Date(t.date || "") || null;
        if (!d) return false;
        const today = new Date();
        const diff = (d - today) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff < 7;
      }
      if (filter === "completed") return t.completed;
      return true;
    })
    .filter((t) => !q || JSON.stringify(t).toLowerCase().includes(q));

  items.forEach((t) => {
    const el = document.createElement("div");
    el.className = "task-card";
    el.dataset.id = t.id;
    el.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 12px; color: var(--muted);">
          ${t.date ? new Date(t.date).toLocaleDateString() : "No date"}
        </span>
        <span style="font-size: 12px; position: absolute; right: 10px; top: -17px; font-weight: bold; color: var(--muted);">
          ${t.completed ? "<strong>Done</strong>" : "Pending"}
        </span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h4 class="task-title">${escapeHtml(t.title)}</h4>
          <div class="task-meta">
            ${
              t.category
                ? '<span class="chip">' + escapeHtml(t.category) + "</span>"
                : ""
            }
            ${
              t.priority
                ? '<span class="chip">' + escapeHtml(t.priority) + "</span>"
                : ""
            }
          </div>
        </div>
        <div class="task-actions">
          <button class="btn outline small edit">Edit</button>
          <button class="btn outline small del">Delete</button>
          <button class="btn complete" onclick="markAsCompleted('${
            t.id
          }')">Complete</button>
        </div>
      </div>
      <p style="margin-top: 8px; font-size: 13px; color: var(--muted);">
        ${escapeHtml(t.description || "")}
      </p>
    `;

    // actions
    el.querySelector(".del").addEventListener("click", () => {
      removeTask(t.id);
    });
    el.querySelector(".edit").addEventListener("click", () => {
      openEdit(t.id);
    });

    // drag
    el.draggable = true;
    el.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", t.id);
    });

    // animate in
    gsap.from(el, { opacity: 0, y: 10, duration: 0.45 });

    taskGrid.appendChild(el);
  });

  totalTasks.textContent = state.tasks.length;
  completedTasks.textContent = state.tasks.filter((t) => t.completed).length;
}

function escapeHtml(s) {
  if (!s) return "";
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// ========= Task CRUD ==========
function addTask(task) {
  state.tasks.push(task);
  save();
  renderTasks();
  updateCalendar();
  triggerBadgeCheck();
}
function removeTask(id) {
  state.tasks = state.tasks.filter((t) => t.id !== id);
  save();
  renderTasks();
  updateCalendar();
}
function updateTask(updated) {
  state.tasks = state.tasks.map((t) => (t.id === updated.id ? updated : t));
  save();
  renderTasks();
  updateCalendar();
}

// ========= Modal ==========
const modal = document.getElementById("modal");
document.getElementById("openAdd").addEventListener("click", () => {
  openAdd();
});
document.getElementById("closeModal").addEventListener("click", () => {
  closeModal();
});

function openAdd() {
  openModalFor();
}
function openModalFor(task = null) {
  modal.classList.add("open");
  document.getElementById("modalTitle").textContent = task
    ? "Edit Task"
    : "Add Task";
  document.getElementById("taskTitle").value = task?.title || "";
  document.getElementById("taskDesc").value = task?.description || "";
  document.getElementById("taskDate").value = task?.date || "";
  document.getElementById("taskPriority").value = task?.priority || "medium";
  document.getElementById("taskCategory").value = task?.category || "";
  document.getElementById("taskRecurring").value = task?.recurring || "none";
  modal.dataset.editId = task?.id || "";
}
function closeModal() {
  modal.classList.remove("open");
  modal.dataset.editId = "";
}

document.getElementById("saveTask").addEventListener("click", () => {
  const id = modal.dataset.editId;
  const t = {
    id: id || uid(),
    title: document.getElementById("taskTitle").value.trim() || "Untitled",
    description: document.getElementById("taskDesc").value.trim(),
    date: document.getElementById("taskDate").value || null,
    priority: document.getElementById("taskPriority").value,
    category: document.getElementById("taskCategory").value.trim() || null,
    recurring: document.getElementById("taskRecurring").value,
    completed: false,
    created: new Date().toISOString(),
  };
  if (id) {
    updateTask(t);
  } else {
    addTask(t);
  }
  closeModal();
});

function openEdit(id) {
  const t = state.tasks.find((x) => x.id === id);
  openModalFor(t);
}

// ========= Calendar ==========
const calGrid = document.getElementById("calGrid");
let calDate = new Date();
function updateCalendar() {
  calGrid.innerHTML = "";
  const start = new Date(calDate.getFullYear(), calDate.getMonth(), 1);
  const end = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 0);
  document.getElementById("calMonth").textContent = start.toLocaleString(
    undefined,
    { month: "long", year: "numeric" }
  );
  const startWeekday = start.getDay();
  const totalDays = end.getDate();
  // fill empty cells
  for (let i = 0; i < startWeekday; i++) {
    const e = document.createElement("div");
    e.className = "cal-cell";
    calGrid.appendChild(e);
  }
  for (let d = 1; d <= totalDays; d++) {
    const cell = document.createElement("div");
    cell.className = "cal-cell";
    cell.innerHTML = `<div class="cal-date">${d}</div>`;
    const dateStr = new Date(calDate.getFullYear(), calDate.getMonth(), d)
      .toISOString()
      .slice(0, 10);
    const events = state.tasks.filter((t) => t.date === dateStr);
    events.forEach((ev) => {
      const evEl = document.createElement("span");
      evEl.className = "cal-event";
      evEl.textContent = ev.title;
      cell.appendChild(evEl);
    });
    calGrid.appendChild(cell);
  }
}
document.getElementById("prevMonth").addEventListener("click", () => {
  calDate.setMonth(calDate.getMonth() - 1);
  updateCalendar();
});
document.getElementById("nextMonth").addEventListener("click", () => {
  calDate.setMonth(calDate.getMonth() + 1);
  updateCalendar();
});

// ========= Search & Filters ==========
document
  .getElementById("searchInput")
  .addEventListener("input", () => renderTasks());
document.querySelectorAll("[data-filter]").forEach((b) =>
  b.addEventListener("click", (e) => {
    renderTasks(e.target.dataset.filter);
  })
);

// ========= Export / Import ==========
document.getElementById("exportBtn").addEventListener("click", () => {
  const data = JSON.stringify(
    { tasks: state.tasks, streak: state.streak },
    null,
    2
  );
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ssp-backup.json";
  a.click();
  URL.revokeObjectURL(url);
});
document
  .getElementById("importBtn")
  .addEventListener("click", () =>
    document.getElementById("fileInput").click()
  );
document.getElementById("fileInput").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const txt = await f.text();
  try {
    const d = JSON.parse(txt);
    state.tasks = d.tasks || state.tasks;
    state.streak = d.streak || state.streak;
    save();
    renderTasks();
    updateCalendar();
    alert("Imported!");
  } catch (err) {
    alert("Invalid file");
  }
});

// ========= Badges & Streaks (simple) ==========
function triggerBadgeCheck() {
  // basic example: if more than 3 tasks completed today, increment streak
  const today = new Date().toISOString().slice(0, 10);
  const completedToday = state.tasks.filter(
    (t) => t.completed && t.date === today
  ).length;
  if (completedToday >= 3) {
    state.streak++;
    localStorage.setItem("ssp:streak", state.streak);
    document
      .getElementById("streakDisplay")
      .querySelector("strong").textContent = state.streak;
  }
}

// ========= Notifications ==========
async function notify(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default")
    await Notification.requestPermission();
  if (Notification.permission === "granted") new Notification(title, { body });
}

// ========= Pomodoro ==========
const timerDisplay = document.getElementById("timerDisplay");
function formatTime(s) {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return String(m).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
}
function startTimer() {
  if (state.timer.running) return;
  state.timer.running = true;
  state.timer.interval = setInterval(() => {
    state.timer.secs--;
    if (state.timer.secs <= 0) {
      clearInterval(state.timer.interval);
      state.timer.running = false;
      state.timer.isBreak = !state.timer.isBreak;
      notify("Pomodoro", state.timer.isBreak ? "Break time!" : "Focus time!");
      state.timer.secs = state.timer.isBreak ? 300 : 1500;
      startTimer();
    }
    updateTimerDisplay();
  }, 1000);
}
function stopTimer() {
  clearInterval(state.timer.interval);
  state.timer.running = false;
}
function resetTimer() {
  stopTimer();
  state.timer.secs = 1500;
  state.timer.isBreak = false;
  updateTimerDisplay();
}
function updateTimerDisplay() {
  timerDisplay.textContent = formatTime(state.timer.secs);
}
document
  .getElementById("startTimer")
  .addEventListener("click", () => startTimer());
document
  .getElementById("stopTimer")
  .addEventListener("click", () => stopTimer());
document
  .getElementById("resetTimer")
  .addEventListener("click", () => resetTimer());

// ========= Theme Toggle ==========
document.getElementById("themeToggle").addEventListener("click", () => {
  const cur =
    document.body.getAttribute("data-theme") === "light" ? "dark" : "light";
  document.body.setAttribute("data-theme", cur);
  state.settings.theme = cur;
  save();
});

// ========= Chart (weekly) ==========
function buildChart() {
  const ctx = document.getElementById("progressChart").getContext("2d");
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Count completed tasks for each weekday (Sun–Sat)
  const data = labels.map((_, dayIndex) => {
    return state.tasks.filter((t) => {
      if (!t.completed || !t.date) return false;
      const d = new Date(t.date);
      return d.getDay() === dayIndex; // 0=Sun, 1=Mon, ... 6=Sat
    }).length;
  });

  if (window.chart) window.chart.destroy(); // prevent duplicate charts

  window.chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Tasks Completed",
          data,
          backgroundColor: "rgba(75, 192, 192, 0.5)",
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      responsive: true,
    },
  });
}

// ========= Drag & drop reorder ==========
taskGrid.addEventListener("dragover", (e) => {
  e.preventDefault();
});
taskGrid.addEventListener("drop", (e) => {
  const id = e.dataTransfer.getData("text/plain");
  // move dragged item to end for simplicity
  const idx = state.tasks.findIndex((t) => t.id === id);
  if (idx > -1) {
    const [it] = state.tasks.splice(idx, 1);
    state.tasks.push(it);
    save();
    renderTasks();
  }
});

// ========= Helpers ==========
function updateCalendarAndRender() {
  renderTasks();
  updateCalendar();
}

// initial
renderTasks();
updateCalendar();
buildChart();
updateTimerDisplay();

// small animations: float logo and welcome
gsap.from(".logo", {
  y: -8,
  opacity: 0,
  duration: 0.9,
  repeat: -1,
  yoyo: true,
  ease: "sine.inOut",
  repeatDelay: 1,
});
gsap.from(".app-header", { opacity: 0, y: -20, duration: 0.6 });

// expose some functions to console for debugging
window.ssp = { state, addTask, removeTask, updateTask };

// small utility: mark completed by double-click on card
taskGrid.addEventListener("dblclick", (e) => {
  const card = e.target.closest(".task-card");
  if (!card) return;
  const id = card.dataset.id;
  const t = state.tasks.find((x) => x.id === id);
  if (t) {
    t.completed = !t.completed;
    updateTask(t);
    if (t.completed) notify("Task Completed", t.title);
  }
});

// persist on unload
window.addEventListener("beforeunload", save);

document.addEventListener("DOMContentLoaded", () => {
  // Ensure calendar and tasks are visible on page load
  const calendar = document.getElementById("calendar");
  const tasks = document.getElementById("tasks");

  if (calendar) {
    calendar.style.display = "block";
    console.log("Calendar container found. Initializing calendar...");

    // Call the calendar initialization function if it exists
    if (typeof initializeCalendar === "function") {
      initializeCalendar();
    } else {
      console.error("Calendar initialization function not found.");
    }
  }

  if (tasks) {
    tasks.style.display = "block";
  }
});

// Add event listener for completion button
function markAsCompleted(taskId) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (task) {
    task.completed = true; // Mark the task as completed
    save(); // Save the updated state to local storage
    renderTasks(); // Re-render the tasks to reflect the changes
    console.log("Task marked as completed and saved to local storage.");
  }
}

