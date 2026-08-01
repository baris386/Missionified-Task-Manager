document.addEventListener('DOMContentLoaded', () => {
    let tasksState = [];
    let statsState = { total_score: 0, tasks_completed: 0, tasks_failed: 0 };
    let currentFilter = 'all';

    let createSubtasksDraft = [];
    let editSubtasksDraft = [];

    const totalScoreEl = document.getElementById('totalScore');
    const totalScoreCard = document.getElementById('totalScoreCard');
    const completedCountEl = document.getElementById('completedCount');
    const failedCountEl = document.getElementById('failedCount');

    const createTaskForm = document.getElementById('createTaskForm');
    const taskAllowPartial = document.getElementById('taskAllowPartial');
    const taskNegGroup = document.getElementById('taskNegGroup');
    const taskNegPoints = document.getElementById('taskNegPoints');

    const newSubtaskTitle = document.getElementById('newSubtaskTitle');
    const addSubtaskBtn = document.getElementById('addSubtaskBtn');
    const subtaskChipList = document.getElementById('subtaskChipList');

    const tasksContainer = document.getElementById('tasksContainer');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');

    const cntAll = document.getElementById('cntAll');
    const cntPending = document.getElementById('cntPending');
    const cntCompleted = document.getElementById('cntCompleted');
    const cntFailed = document.getElementById('cntFailed');

    const tabBtns = document.querySelectorAll('.tab-btn');

    const editModal = document.getElementById('editModal');
    const editTaskForm = document.getElementById('editTaskForm');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    const editTaskAllowPartial = document.getElementById('editTaskAllowPartial');
    const editTaskNegGroup = document.getElementById('editTaskNegGroup');
    const editTaskNegPoints = document.getElementById('editTaskNegPoints');

    const editNewSubtaskTitle = document.getElementById('editNewSubtaskTitle');
    const editAddSubtaskBtn = document.getElementById('editAddSubtaskBtn');
    const editSubtaskChipList = document.getElementById('editSubtaskChipList');

    const toastContainer = document.getElementById('toastContainer');

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function syncPenaltyFieldState(toggleEl, inputEl, groupEl) {
        if (!toggleEl || !inputEl || !groupEl) return;
        if (toggleEl.checked) {
            inputEl.disabled = true;
            inputEl.value = 0;
            groupEl.style.opacity = '0.35';
            groupEl.style.pointerEvents = 'none';
        } else {
            inputEl.disabled = false;
            if (parseInt(inputEl.value) === 0) inputEl.value = 5;
            groupEl.style.opacity = '1';
            groupEl.style.pointerEvents = 'auto';
        }
    }

    if (taskAllowPartial) {
        taskAllowPartial.addEventListener('change', () => {
            syncPenaltyFieldState(taskAllowPartial, taskNegPoints, taskNegGroup);
        });
        syncPenaltyFieldState(taskAllowPartial, taskNegPoints, taskNegGroup);
    }

    if (editTaskAllowPartial) {
        editTaskAllowPartial.addEventListener('change', () => {
            syncPenaltyFieldState(editTaskAllowPartial, editTaskNegPoints, editTaskNegGroup);
        });
    }

    function playSound(type) {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'success') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12);
            osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.25);

            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

            osc.start(now);
            osc.stop(now + 0.45);
        } else if (type === 'subtask') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc.start(now);
            osc.stop(now + 0.12);
        } else if (type === 'fail') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(329.63, now);
            osc.frequency.exponentialRampToValueAtTime(220.00, now + 0.3);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            osc.start(now);
            osc.stop(now + 0.35);
        }
    }

    function showToast(message, type = 'info', icon = 'fa-bell') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fa-solid ${icon} toast-icon"></i>
            <span>${escapeHtml(message)}</span>
        `;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(50px)';
            toast.style.transition = 'all 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, match => {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
            return map[match];
        });
    }

    function renderSubtaskChips(container, chipsArray, onRemove) {
        container.innerHTML = '';
        chipsArray.forEach((st, idx) => {
            const chip = document.createElement('div');
            chip.className = 'subtask-chip';
            chip.innerHTML = `
                <span>${escapeHtml(st.title)}</span>
                <button type="button" class="remove-chip-btn">&times;</button>
            `;
            chip.querySelector('.remove-chip-btn').addEventListener('click', () => onRemove(idx));
            container.appendChild(chip);
        });
    }

    function addSubtaskToDraft(titleInput, draftArray, container, renderFn) {
        const val = titleInput.value.trim();
        if (!val) return;
        draftArray.push({ title: val, completed: false });
        titleInput.value = '';
        renderFn();
    }

    addSubtaskBtn.addEventListener('click', () => {
        addSubtaskToDraft(newSubtaskTitle, createSubtasksDraft, subtaskChipList, () => {
            renderSubtaskChips(subtaskChipList, createSubtasksDraft, idx => {
                createSubtasksDraft.splice(idx, 1);
                renderSubtaskChips(subtaskChipList, createSubtasksDraft, null);
            });
        });
    });

    newSubtaskTitle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addSubtaskBtn.click();
        }
    });

    editAddSubtaskBtn.addEventListener('click', () => {
        addSubtaskToDraft(editNewSubtaskTitle, editSubtasksDraft, editSubtaskChipList, () => {
            renderSubtaskChips(editSubtaskChipList, editSubtasksDraft, idx => {
                editSubtasksDraft.splice(idx, 1);
                renderSubtaskChips(editSubtaskChipList, editSubtasksDraft, null);
            });
        });
    });

    editNewSubtaskTitle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            editAddSubtaskBtn.click();
        }
    });

    async function fetchTasksAndStats() {
        try {
            const [tasksRes, statsRes] = await Promise.all([
                fetch('/api/tasks'),
                fetch('/api/stats')
            ]);

            if (tasksRes.ok && statsRes.ok) {
                tasksState = await tasksRes.json();
                statsState = await statsRes.json();
                renderUI();
            }
        } catch (err) {
            console.error(err);
            showToast('Failed to load data from server', 'error', 'fa-triangle-exclamation');
        } finally {
            if (loadingState) loadingState.classList.add('hidden');
        }
    }

    function renderUI() {
        updateScoreBoard(statsState.total_score, statsState.tasks_completed, statsState.tasks_failed);

        const pendingTasks = tasksState.filter(t => t.status === 'pending');
        const completedTasks = tasksState.filter(t => t.status === 'completed');
        const failedTasks = tasksState.filter(t => t.status === 'failed');

        cntAll.textContent = tasksState.length;
        cntPending.textContent = pendingTasks.length;
        cntCompleted.textContent = completedTasks.length;
        cntFailed.textContent = failedTasks.length;

        let filteredTasks = tasksState;
        if (currentFilter === 'pending') filteredTasks = pendingTasks;
        else if (currentFilter === 'completed') filteredTasks = completedTasks;
        else if (currentFilter === 'failed') filteredTasks = failedTasks;

        tasksContainer.innerHTML = '';
        if (filteredTasks.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            filteredTasks.forEach(task => {
                const card = createTaskCard(task);
                tasksContainer.appendChild(card);
            });
        }
    }

    function updateScoreBoard(score, completed, failed) {
        totalScoreEl.textContent = score;
        completedCountEl.textContent = completed;
        failedCountEl.textContent = failed;
    }

    function calculateEarnedXP(task) {
        if (task.subtasks && task.subtasks.length > 0 && task.allow_partial) {
            const totalSt = task.subtasks.length;
            const compSt = task.subtasks.filter(st => st.completed).length;
            if (compSt === 0) return 0;
            return Math.max(1, Math.round((compSt / totalSt) * task.positive_points));
        }
        return task.positive_points;
    }

    function createTaskCard(task) {
        const card = document.createElement('div');
        card.className = `task-card status-${task.status}`;
        card.dataset.id = task.id;

        let repeatBadgeHtml = '';
        if (task.repeat && task.repeat !== 'none') {
            const repeatLabels = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
            repeatBadgeHtml = `
                <span class="badge-tag badge-repeat">
                    <i class="fa-solid fa-rotate"></i> ${repeatLabels[task.repeat] || task.repeat}
                </span>
            `;
        }

        let partialBadgeHtml = '';
        if (task.allow_partial) {
            partialBadgeHtml = `
                <span class="badge-tag badge-partial" title="Proportional Partial XP Active">
                    <i class="fa-solid fa-percent"></i> Proportional XP
                </span>
            `;
        }

        let subtasksHtml = '';
        if (task.subtasks && task.subtasks.length > 0) {
            const completedCount = task.subtasks.filter(st => st.completed).length;
            const pct = Math.round((completedCount / task.subtasks.length) * 100);

            const itemsHtml = task.subtasks.map((st, idx) => `
                <label class="subtask-item ${st.completed ? 'completed' : ''}" data-subtask-index="${idx}">
                    <input type="checkbox" class="subtask-checkbox" ${st.completed ? 'checked' : ''} ${task.status !== 'pending' ? 'disabled' : ''}>
                    <span>${escapeHtml(st.title)}</span>
                </label>
            `).join('');

            subtasksHtml = `
                <div class="subtask-card-list">
                    <div class="subtask-progress-wrap">
                        <div class="subtask-progress-bar">
                            <div class="subtask-progress-fill" style="width: ${pct}%"></div>
                        </div>
                        <span class="subtask-progress-text">${completedCount}/${task.subtasks.length} (${pct}%)</span>
                    </div>
                    ${itemsHtml}
                </div>
            `;
        }

        let actionButtonsHtml = '';
        if (task.status === 'pending') {
            const isProportionalMode = Boolean(task.allow_partial || (task.subtasks && task.subtasks.length > 0));
            if (isProportionalMode) {
                const currentEarned = calculateEarnedXP(task);
                actionButtonsHtml = `
                    <div class="action-buttons-group">
                        <button class="action-btn btn-complete" data-action="complete">
                            <i class="fa-solid fa-flag-checkered"></i> Finish (+${currentEarned} XP)
                        </button>
                    </div>
                `;
            } else {
                actionButtonsHtml = `
                    <div class="action-buttons-group">
                        <button class="action-btn btn-complete" data-action="complete">
                            <i class="fa-solid fa-check"></i> Complete (+${task.positive_points})
                        </button>
                        <button class="action-btn btn-fail" data-action="fail">
                            <i class="fa-solid fa-xmark"></i> Postpone (-${task.negative_points})
                        </button>
                    </div>
                `;
            }
        } else if (task.status === 'completed') {
            const earned = calculateEarnedXP(task);
            actionButtonsHtml = `
                <span class="badge-tag badge-pts-pos">
                    <i class="fa-solid fa-circle-check"></i> Completed (+${earned} XP)
                </span>
            `;
        } else if (task.status === 'failed') {
            actionButtonsHtml = `
                <span class="badge-tag badge-pts-neg">
                    <i class="fa-solid fa-circle-xmark"></i> Failed (-${task.negative_points} XP)
                </span>
            `;
        }

        const showNegBadge = !task.allow_partial && !Boolean(task.subtasks && task.subtasks.length > 0);

        card.innerHTML = `
            <div class="task-header">
                <div class="task-title-wrap">
                    <h3 class="task-title">${escapeHtml(task.title)}</h3>
                    ${task.details ? `<p class="task-details">${escapeHtml(task.details)}</p>` : ''}
                </div>
            </div>

            ${subtasksHtml}

            <div class="task-meta">
                ${repeatBadgeHtml}
                ${partialBadgeHtml}
                <span class="badge-tag badge-pts-pos">+${task.positive_points} XP</span>
                ${showNegBadge ? `<span class="badge-tag badge-pts-neg">-${task.negative_points} XP</span>` : ''}
            </div>

            <div class="task-actions">
                ${actionButtonsHtml}
                <div class="action-buttons-group">
                    <button class="action-btn btn-edit" data-action="edit" title="Edit Task">
                        <i class="fa-solid fa-pen-to-square"></i> Edit
                    </button>
                    <button class="action-btn btn-delete" data-action="delete" title="Delete Task">
                        <i class="fa-solid fa-trash-can"></i> Delete
                    </button>
                </div>
            </div>
        `;

        card.addEventListener('click', (e) => {
            const subtaskLabel = e.target.closest('.subtask-item');
            if (subtaskLabel && task.status === 'pending') {
                e.preventDefault();
                e.stopPropagation();
                const subtaskIdx = parseInt(subtaskLabel.getAttribute('data-subtask-index'));
                if (!isNaN(subtaskIdx)) {
                    handleToggleSubtask(task.id, subtaskIdx);
                }
                return;
            }

            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;

            if (action === 'complete') handleCompleteTask(task.id);
            else if (action === 'fail') handleFailTask(task.id);
            else if (action === 'edit') openEditModal(task);
            else if (action === 'delete') handleDeleteTask(task.id);
        });

        return card;
    }

    async function handleToggleSubtask(taskId, subtaskIdx) {
        const task = tasksState.find(t => t.id === taskId);
        if (task && task.subtasks && task.subtasks[subtaskIdx] !== undefined) {
            task.subtasks[subtaskIdx].completed = !task.subtasks[subtaskIdx].completed;
            playSound('subtask');
            renderUI();
        }

        try {
            const res = await fetch(`/api/tasks/${taskId}/toggle_subtask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subtask_index: subtaskIdx })
            });

            if (res.ok) {
                const updatedTask = await res.json();
                const idx = tasksState.findIndex(t => t.id === taskId);
                if (idx !== -1) {
                    tasksState[idx] = updatedTask;
                }
                renderUI();
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function handleCompleteTask(taskId) {
        try {
            const res = await fetch(`/api/tasks/${taskId}/complete`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                playSound('success');

                totalScoreCard.classList.add('score-bump');
                setTimeout(() => totalScoreCard.classList.remove('score-bump'), 500);

                showToast(`Awesome! +${data.points_added} XP earned! 🎉`, 'success', 'fa-award');
                fetchTasksAndStats();
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function handleFailTask(taskId) {
        try {
            const res = await fetch(`/api/tasks/${taskId}/fail`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                playSound('fail');

                totalScoreCard.classList.add('score-bump');
                setTimeout(() => totalScoreCard.classList.remove('score-bump'), 500);

                if (data.points_earned > 0) {
                    showToast(`Finished: +${data.points_earned} XP earned from subtasks, -${data.points_deducted} XP penalty.`, 'info', 'fa-circle-exclamation');
                } else {
                    showToast(`-${data.points_deducted} XP deducted! Stay focused.`, 'error', 'fa-circle-exclamation');
                }
                fetchTasksAndStats();
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function handleDeleteTask(taskId) {
        if (!confirm('Are you sure you want to delete this task?')) return;
        try {
            const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Task deleted', 'info', 'fa-trash-can');
                fetchTasksAndStats();
            }
        } catch (err) {
            console.error(err);
        }
    }

    createTaskForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('taskTitle').value.trim();
        const details = document.getElementById('taskDetails').value.trim();
        const repeat = document.getElementById('taskRepeat').value;
        const allow_partial = taskAllowPartial.checked;
        const positive_points = parseInt(document.getElementById('taskPosPoints').value) || 10;
        const negative_points = allow_partial ? 0 : (parseInt(document.getElementById('taskNegPoints').value) || 5);

        try {
            const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title, details, repeat, positive_points, negative_points,
                    allow_partial, subtasks: createSubtasksDraft
                })
            });

            if (res.ok) {
                createTaskForm.reset();
                createSubtasksDraft = [];
                subtaskChipList.innerHTML = '';
                syncPenaltyFieldState(taskAllowPartial, taskNegPoints, taskNegGroup);
                showToast('New task created! 🚀', 'success', 'fa-circle-check');
                fetchTasksAndStats();
            }
        } catch (err) {
            console.error(err);
            showToast('Error creating task', 'error', 'fa-triangle-exclamation');
        }
    });

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderUI();
        });
    });

    function openEditModal(task) {
        document.getElementById('editTaskId').value = task.id;
        document.getElementById('editTaskTitle').value = task.title;
        document.getElementById('editTaskDetails').value = task.details || '';
        editTaskAllowPartial.checked = Boolean(task.allow_partial);

        document.getElementById('editTaskRepeat').value = task.repeat || 'none';
        document.getElementById('editTaskPosPoints').value = task.positive_points;
        document.getElementById('editTaskNegPoints').value = task.negative_points;

        syncPenaltyFieldState(editTaskAllowPartial, editTaskNegPoints, editTaskNegGroup);

        editSubtasksDraft = task.subtasks ? JSON.parse(JSON.stringify(task.subtasks)) : [];
        renderSubtaskChips(editSubtaskChipList, editSubtasksDraft, idx => {
            editSubtasksDraft.splice(idx, 1);
            renderSubtaskChips(editSubtaskChipList, editSubtasksDraft, null);
        });

        editModal.classList.remove('hidden');
    }

    function closeEditModal() {
        editModal.classList.add('hidden');
    }

    closeModalBtn.addEventListener('click', closeEditModal);
    cancelModalBtn.addEventListener('click', closeEditModal);

    editTaskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const taskId = document.getElementById('editTaskId').value;
        const title = document.getElementById('editTaskTitle').value.trim();
        const details = document.getElementById('editTaskDetails').value.trim();
        const repeat = document.getElementById('editTaskRepeat').value;
        const allow_partial = editTaskAllowPartial.checked;
        const positive_points = parseInt(document.getElementById('editTaskPosPoints').value) || 10;
        const negative_points = allow_partial ? 0 : (parseInt(document.getElementById('editTaskNegPoints').value) || 5);

        try {
            const res = await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title, details, repeat, positive_points, negative_points,
                    allow_partial, subtasks: editSubtasksDraft
                })
            });

            if (res.ok) {
                closeEditModal();
                showToast('Task updated successfully', 'success', 'fa-pen-to-square');
                fetchTasksAndStats();
            }
        } catch (err) {
            console.error(err);
        }
    });

    fetchTasksAndStats();
});
