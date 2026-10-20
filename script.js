/*
 * Windows 98 Style Website Template
 * Based on the original Windows template from HTML5-Templates.com
 * Original: https://html5-templates.com/preview/windows.html
 */

let openWindows = new Set();
let activeWindow = null;
let zIndexCounter = 1000;
let draggedElement = null;
let offset = { x: 0, y: 0 };
let selectedIcon = null;



function openWindow(windowId) {
    const windowEl = document.getElementById(windowId + '-window');
    if (!windowEl) return;

    windowEl.classList.add('visible');
    windowEl.classList.remove('inactive');
    openWindows.add(windowId);
    setActiveWindow(windowId);
    addToTaskbar(windowId);
    setActiveWindow(windowId);
    closeStartMenu();

    clearIconSelection();
}

function closeWindow(windowId) {
    const windowEl = document.getElementById(windowId + '-window');
    if (!windowEl) return;

    windowEl.classList.remove('visible', 'active');
    windowEl.classList.add('inactive');
    openWindows.delete(windowId);
    removeFromTaskbar(windowId);

    const nextWindow = [...openWindows].find(id => document.getElementById(id + '-window').classList.contains('visible'));
    if (nextWindow) setActiveWindow(nextWindow);
    else activeWindow = null;
}

function minimizeWindow(windowId) {
    const windowEl = document.getElementById(windowId + '-window');
    if (!windowEl) return;

    windowEl.classList.remove('visible');
    windowEl.classList.remove('active');
    windowEl.classList.add('inactive');

    const taskbarItem = document.querySelector(`[data-window="${windowId}"]`);
    if (taskbarItem) {
        taskbarItem.classList.remove('active');
    }
}

function maximizeWindow(windowId) {
    const windowEl = document.getElementById(windowId + '-window');
    if (!windowEl) return;

    if (windowEl.style.width === '100vw' || windowEl.classList.contains('maximized')) {
        windowEl.classList.remove('maximized');
        windowEl.style.width = windowEl.dataset.originalWidth || '450px';
        windowEl.style.height = windowEl.dataset.originalHeight || '350px';
        windowEl.style.top = windowEl.dataset.originalTop || '100px';
        windowEl.style.left = windowEl.dataset.originalLeft || '200px';
    } else {
        windowEl.dataset.originalWidth = windowEl.style.width;
        windowEl.dataset.originalHeight = windowEl.style.height;
        windowEl.dataset.originalTop = windowEl.style.top;
        windowEl.dataset.originalLeft = windowEl.style.left;

        windowEl.classList.add('maximized');
        windowEl.style.width = '100vw';
        windowEl.style.height = 'calc(100dvh - 32px)';
        windowEl.style.top = '0';
        windowEl.style.left = '0';
    }
}

function setActiveWindow(windowId) {
    document.querySelectorAll('.window').forEach(w => {
        w.classList.remove('active');
        w.classList.add('inactive');
    });

    document.querySelectorAll('.taskbar-item').forEach(t => {
        t.classList.remove('active');
    });

    const windowEl = document.getElementById(windowId + '-window');
    if (windowEl) {
        windowEl.classList.add('active');
        windowEl.classList.remove('inactive');
        windowEl.style.zIndex = ++zIndexCounter;
        activeWindow = windowId;
    }

    const taskbarItem = document.querySelector(`[data-window="${windowId}"]`);
    if (taskbarItem) {
        taskbarItem.classList.add('active');
    }
}

function addToTaskbar(windowId) {
    const taskbarItems = document.getElementById('taskbar-items');

    if (document.querySelector(`[data-window="${windowId}"]`)) return;

    const item = document.createElement('button');
    item.className = 'taskbar-item';
    item.setAttribute('data-window', windowId);
    item.textContent = getWindowTitle(windowId);
    item.onclick = () => toggleWindow(windowId);

    taskbarItems.appendChild(item);
}

function removeFromTaskbar(windowId) {
    const item = document.querySelector(`[data-window="${windowId}"]`);
    if (item) {
        item.remove();
    }
}

function toggleWindow(windowId) {
    const windowEl = document.getElementById(windowId + '-window');
    if (!windowEl) return;

    if (windowEl.classList.contains('visible') && activeWindow === windowId) {
        minimizeWindow(windowId);
    } else {
        windowEl.classList.add('visible');
        setActiveWindow(windowId);
    }
}

function getWindowTitle(windowId) {
    const titles = { reconciliation: 'Reconciliation', records: 'Records', themes: 'Display Properties' };
    return titles[windowId] || windowId;
}

function clearIconSelection() {
    document.querySelectorAll('.icon').forEach(icon => {
        icon.classList.remove('selected');
    });
    selectedIcon = null;
}

function toggleStartMenu() {
    const startMenu = document.getElementById('start-menu');
    const startButton = document.querySelector('.start-button');

    if (startMenu.classList.contains('visible')) {
        startMenu.classList.remove('visible');
        startButton.classList.remove('active');
    } else {
        startMenu.classList.add('visible');
        startButton.classList.add('active');
    }
}

function closeStartMenu() {
    const startMenu = document.getElementById('start-menu');
    const startButton = document.querySelector('.start-button');
    startMenu.classList.remove('visible');
    startButton.classList.remove('active');
}

function initDragAndDrop() {
    document.addEventListener('mousedown', function(e) {
        const header = e.target.closest('.window-header');
        if (header && !header.parentElement.classList.contains('maximized') && !e.target.closest('.window-controls')) {
            draggedElement = header.parentElement;
            const rect = draggedElement.getBoundingClientRect();
            offset.x = e.clientX - rect.left;
            offset.y = e.clientY - rect.top;

            const windowId = draggedElement.id.replace('-window', '');
            setActiveWindow(windowId);

            e.preventDefault();
        }
    });

    document.addEventListener('mousemove', function(e) {
        if (draggedElement) {
            const x = e.clientX - offset.x;
            const y = e.clientY - offset.y;

            const maxX = window.innerWidth - draggedElement.offsetWidth;
            const maxY = window.innerHeight - draggedElement.offsetHeight - 32;

            draggedElement.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
            draggedElement.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
        }
    });

    document.addEventListener('mouseup', function() {
        draggedElement = null;
    });
}

function updateClock() {
    const clockEl = document.getElementById('clock');
    const now = new Date();
    const timeString = now.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    clockEl.textContent = timeString;
}


// HILFER: only title bars move windows; native record drag events remain untouched.
document.addEventListener('click', e => {
    const app = e.target.closest('[data-open]');
    if (app) openWindow(app.dataset.open);
    const control = e.target.closest('[data-control]');
    if (control) {
        const id = control.closest('.window').id.replace('-window', '');
        ({close: closeWindow, minimize: minimizeWindow, maximize: maximizeWindow})[control.dataset.control](id);
        return;
    }
    const windowEl = e.target.closest('.window');
    if (windowEl) setActiveWindow(windowEl.id.replace('-window', ''));
    if (!e.target.closest('#start-menu, .start-button')) closeStartMenu();
});
document.querySelector('.start-button').addEventListener('click', toggleStartMenu);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeStartMenu(); });
document.querySelector('#display-theme').addEventListener('change', e => {
    document.documentElement.dataset.theme = e.target.value;
});
initDragAndDrop();
updateClock();
setInterval(updateClock, 1000);
