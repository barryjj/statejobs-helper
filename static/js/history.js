(function () {
  const HISTORY_KEY = 'statejobs_history';
  const VIEW_MODE_KEY = 'statejobs_view_mode';

  // --- Storage ---

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
  }

  function saveHistory(jobs) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(jobs));
  }

  function isValidJob(job) {
    return job && job.job_id && job.title;
  }

  function upsertJobs(newJobs) {
    const history = getHistory();
    for (const job of newJobs) {
      if (!isValidJob(job)) continue;
      const idx = history.findIndex(h => h.job_id === job.job_id);
      if (idx >= 0) {
        history[idx] = { ...job, applied: history[idx].applied, saved_at: history[idx].saved_at };
      } else {
        history.unshift({ ...job, applied: false, saved_at: new Date().toISOString() });
      }
    }
    saveHistory(history);
  }

  function toggleApplied(job_id) {
    const history = getHistory();
    const idx = history.findIndex(h => h.job_id === job_id);
    if (idx < 0) return false;
    history[idx].applied = !history[idx].applied;
    saveHistory(history);
    return history[idx].applied;
  }

  function deleteJob(job_id) {
    saveHistory(getHistory().filter(h => h.job_id !== job_id));
  }

  function getViewMode() { return localStorage.getItem(VIEW_MODE_KEY) || 'card'; }
  function setViewMode(mode) { localStorage.setItem(VIEW_MODE_KEY, mode); }

  // --- Helpers ---

  function esc(str) {
    if (!str) return 'N/A';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function cardBodyHtml(job, showDelete) {
    const addressHtml = job.full_address
      ? job.full_address.split('\n').filter(Boolean).map(esc).join('<br>')
      : 'N/A';
    const emailHtml = job.email
      ? `<a href="mailto:${esc(job.email)}?subject=Vacancy%20%23${esc(job.job_id)}&body=Please%20find%20my%20resume%20and%20cover%20letter%20attached.">${esc(job.email)}</a>`
      : 'N/A';
    const appliedCls = job.applied ? 'btn-applied' : 'btn-alt';
    const appliedLabel = job.applied ? 'Applied' : 'Mark Applied';
    const deleteBtn = showDelete
      ? `<button class="btn btn-sm btn-danger-alt js-delete-job" data-job-id="${esc(job.job_id)}">Remove</button>`
      : '';

    return `
      <h5 class="card-title">${esc(job.title)}</h5>
      <p class="card-text"><strong>Agency:</strong> ${esc(job.agency)}</p>
      <p class="card-text"><strong>Salary Grade:</strong> ${esc(job.grade)}</p>
      <p class="card-text"><strong>Salary Range:</strong> ${esc(job.salary)}</p>
      <p class="card-text"><strong>Posted:</strong> ${esc(job.date_posted)}</p>
      <p class="card-text"><strong>Applications Due:</strong> ${esc(job.applications_due)}</p>
      <p class="card-text"><strong>Contact:</strong> ${esc(job.name)}</p>
      <p class="card-text"><strong>Email:</strong> ${emailHtml}</p>
      <p class="card-text"><strong>Address:</strong><br>${addressHtml}</p>
      <p class="card-text"><strong>Job ID:</strong>
        <a href="https://statejobs.ny.gov/public/vacancyDetailsView.cfm?id=${esc(job.job_id)}"
           target="_blank" rel="noopener noreferrer">${esc(job.job_id)}</a>
      </p>
      <div class="mt-3 d-flex gap-2 justify-content-center flex-wrap">
        <a href="/coverletter?job_id=${esc(job.job_id)}" class="btn btn-main btn-sm">Cover Letter</a>
        <button class="btn btn-sm ${appliedCls} js-toggle-applied" data-job-id="${esc(job.job_id)}">${appliedLabel}</button>
        ${deleteBtn}
      </div>`;
  }

  // --- Card deck navigator ---

  function renderCardDeck(jobs, containerId, showDelete) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (jobs.length === 0) {
      container.innerHTML = emptyStateHtml();
      return;
    }

    const deck = jobs.map(j => ({ ...j }));
    let idx = 0;

    function draw() {
      if (deck.length === 0) { container.innerHTML = emptyStateHtml(); return; }
      idx = Math.min(idx, deck.length - 1);
      const job = deck[idx];
      const peekers = Math.min(deck.length - idx - 1, 2);

      let peekHtml = '';
      for (let i = peekers; i >= 1; i--) {
        peekHtml += `<div class="deck-peek deck-peek-${i}"></div>`;
      }

      container.innerHTML = `
        <div class="card-deck-layout">
          <button class="deck-nav-btn" id="deck-prev" ${idx === 0 ? 'disabled' : ''}>&#8592;</button>
          <div class="card-deck-stage">
            ${peekHtml}
            <div class="card history-card" data-job-id="${esc(job.job_id)}">
              <div class="card-body">${cardBodyHtml(job, showDelete)}</div>
            </div>
          </div>
          <button class="deck-nav-btn" id="deck-next" ${idx === deck.length - 1 ? 'disabled' : ''}>&#8594;</button>
        </div>
        <div class="deck-counter">${idx + 1} of ${deck.length}</div>`;

      document.getElementById('deck-prev').addEventListener('click', () => { idx--; draw(); });
      document.getElementById('deck-next').addEventListener('click', () => { idx++; draw(); });

      container.querySelector('.js-toggle-applied')?.addEventListener('click', (e) => {
        const applied = toggleApplied(job.job_id);
        deck[idx] = { ...deck[idx], applied };
        e.target.textContent = applied ? 'Applied' : 'Mark Applied';
        e.target.className = `btn btn-sm ${applied ? 'btn-applied' : 'btn-alt'} js-toggle-applied`;
      });

      if (showDelete) {
        container.querySelector('.js-delete-job')?.addEventListener('click', () => {
          deleteJob(job.job_id);
          deck.splice(idx, 1);
          if (idx >= deck.length) idx = Math.max(0, deck.length - 1);
          draw();
        });
      }
    }

    draw();
  }

  // --- List table ---

  function renderListTable(jobs, containerId, showDelete) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (jobs.length === 0) { container.innerHTML = emptyStateHtml(); return; }

    const rowHtml = jobs.map(job => {
      const statusBadge = job.applied
        ? '<span class="status-badge badge-applied">Applied</span>'
        : '<span class="status-badge badge-pending">Pending</span>';
      const appliedCls = job.applied ? 'btn-applied' : 'btn-alt';
      const appliedLabel = job.applied ? 'Applied' : 'Mark Applied';
      const deleteBtn = showDelete
        ? `<button class="btn btn-sm btn-danger-alt js-delete-job" data-job-id="${esc(job.job_id)}">Remove</button>`
        : '';

      return `
        <tr data-job-id="${esc(job.job_id)}">
          <td><a href="https://statejobs.ny.gov/public/vacancyDetailsView.cfm?id=${esc(job.job_id)}" target="_blank" rel="noopener noreferrer">${esc(job.job_id)}</a></td>
          <td>${esc(job.title)}</td>
          <td>${esc(job.agency)}</td>
          <td>${esc(job.grade)}</td>
          <td>${esc(job.applications_due)}</td>
          <td class="js-status-cell">${statusBadge}</td>
          <td>
            <div class="d-flex gap-1 flex-wrap">
              <a href="/coverletter?job_id=${esc(job.job_id)}" class="btn btn-main btn-sm">Cover Letter</a>
              <button class="btn btn-sm ${appliedCls} js-toggle-applied" data-job-id="${esc(job.job_id)}">${appliedLabel}</button>
              ${deleteBtn}
            </div>
          </td>
        </tr>`;
    }).join('');

    container.innerHTML = `
      <div class="history-table-wrap">
        <table class="history-table">
          <thead>
            <tr><th>Job ID</th><th>Title</th><th>Agency</th><th>Grade</th><th>Due</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>${rowHtml}</tbody>
        </table>
      </div>`;

    container.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('.js-toggle-applied');
      if (toggleBtn) {
        const job_id = toggleBtn.dataset.jobId;
        const applied = toggleApplied(job_id);
        toggleBtn.textContent = applied ? 'Applied' : 'Mark Applied';
        toggleBtn.className = `btn btn-sm ${applied ? 'btn-applied' : 'btn-alt'} js-toggle-applied`;
        const row = container.querySelector(`tr[data-job-id="${job_id}"]`);
        if (row) {
          const cell = row.querySelector('.js-status-cell');
          if (cell) cell.innerHTML = applied
            ? '<span class="status-badge badge-applied">Applied</span>'
            : '<span class="status-badge badge-pending">Pending</span>';
        }
        return;
      }
      if (!showDelete) return;
      const deleteBtn = e.target.closest('.js-delete-job');
      if (deleteBtn) {
        const job_id = deleteBtn.dataset.jobId;
        deleteJob(job_id);
        container.querySelector(`tr[data-job-id="${job_id}"]`)?.remove();
        if (getHistory().length === 0) container.innerHTML = emptyStateHtml();
      }
    });
  }

  function emptyStateHtml() {
    return '<p class="text-secondary text-center py-4">No saved jobs yet. Search for vacancy IDs to get started.</p>';
  }

  // --- Public: history page ---

  function renderHistorySection(containerId) {
    const history = getHistory();
    if (getViewMode() === 'card') {
      renderCardDeck(history, containerId, true);
    } else {
      renderListTable(history, containerId, true);
    }
  }

  // --- Public: results page ---

  function initResultsPage(jobs, cardContainerId, listContainerId) {
    upsertJobs(jobs);
    const history = getHistory();
    const enriched = jobs.filter(isValidJob).map(j => {
      const saved = history.find(h => h.job_id === j.job_id);
      return { ...j, applied: saved ? saved.applied : false };
    });
    renderCardDeck(enriched, cardContainerId, false);
    renderListTable(enriched, listContainerId, false);
  }

  window.StatejobsHistory = {
    upsertJobs, getViewMode, setViewMode,
    renderHistorySection, initResultsPage,
  };
})();
