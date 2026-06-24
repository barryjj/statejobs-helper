(function () {
  const HISTORY_KEY = 'statejobs_history';
  const VIEW_MODE_KEY = 'statejobs_view_mode';

  // --- Storage primitives ---

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
  }

  function saveHistory(jobs) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(jobs));
  }

  function upsertJobs(newJobs) {
    const history = getHistory();
    for (const job of newJobs) {
      const idx = history.findIndex(h => h.job_id === job.job_id);
      if (idx >= 0) {
        // Refresh scraped data but preserve user state
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

  function getViewMode() {
    return localStorage.getItem(VIEW_MODE_KEY) || 'card';
  }

  function setViewMode(mode) {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }

  // --- Rendering helpers ---

  function escapeHtml(str) {
    if (!str) return 'N/A';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function appliedBtnHtml(job_id, applied) {
    const cls = applied ? 'btn-applied' : 'btn-alt';
    const label = applied ? 'Applied' : 'Mark Applied';
    return `<button class="btn btn-sm ${cls} js-toggle-applied" data-job-id="${job_id}">${label}</button>`;
  }

  function renderJobCard(job) {
    const addressHtml = job.full_address
      ? job.full_address.split('\n').filter(Boolean).map(escapeHtml).join('<br>')
      : 'N/A';
    const emailHtml = job.email
      ? `<a href="mailto:${escapeHtml(job.email)}?subject=Vacancy%20%23${escapeHtml(job.job_id)}&body=Please%20find%20my%20resume%20and%20cover%20letter%20attached.">${escapeHtml(job.email)}</a>`
      : 'N/A';

    return `
      <div class="col">
        <div class="card-stack-wrapper">
          <div class="card h-100 shadow-sm history-card" data-job-id="${escapeHtml(job.job_id)}">
            <div class="card-body">
              <h5 class="card-title">${escapeHtml(job.title)}</h5>
              <p class="card-text"><strong>Agency:</strong> ${escapeHtml(job.agency)}</p>
              <p class="card-text"><strong>Salary Grade:</strong> ${escapeHtml(job.grade)}</p>
              <p class="card-text"><strong>Salary Range:</strong> ${escapeHtml(job.salary)}</p>
              <p class="card-text"><strong>Posted:</strong> ${escapeHtml(job.date_posted)}</p>
              <p class="card-text"><strong>Applications Due:</strong> ${escapeHtml(job.applications_due)}</p>
              <p class="card-text"><strong>Contact:</strong> ${escapeHtml(job.name)}</p>
              <p class="card-text"><strong>Email:</strong> ${emailHtml}</p>
              <p class="card-text"><strong>Address:</strong><br>${addressHtml}</p>
              <p class="card-text"><strong>Job ID:</strong>
                <a href="https://statejobs.ny.gov/public/vacancyDetailsView.cfm?id=${escapeHtml(job.job_id)}"
                   target="_blank" rel="noopener noreferrer">${escapeHtml(job.job_id)}</a>
              </p>
              <div class="text-center mt-3 d-flex gap-2 justify-content-center flex-wrap">
                <a href="/coverletter?job_id=${escapeHtml(job.job_id)}" class="btn btn-main btn-sm">Cover Letter</a>
                ${appliedBtnHtml(job.job_id, job.applied)}
                <button class="btn btn-sm btn-danger-alt js-delete-job" data-job-id="${escapeHtml(job.job_id)}">Remove</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderJobRow(job) {
    const statusBadge = job.applied
      ? '<span class="badge badge-applied">Applied</span>'
      : '<span class="badge badge-pending">Pending</span>';

    return `
      <tr data-job-id="${escapeHtml(job.job_id)}">
        <td>
          <a href="https://statejobs.ny.gov/public/vacancyDetailsView.cfm?id=${escapeHtml(job.job_id)}"
             target="_blank" rel="noopener noreferrer">${escapeHtml(job.job_id)}</a>
        </td>
        <td>${escapeHtml(job.title)}</td>
        <td>${escapeHtml(job.agency)}</td>
        <td>${escapeHtml(job.grade)}</td>
        <td>${escapeHtml(job.applications_due)}</td>
        <td class="js-status-cell">${statusBadge}</td>
        <td>
          <div class="d-flex gap-1 flex-wrap">
            <a href="/coverletter?job_id=${escapeHtml(job.job_id)}" class="btn btn-main btn-sm">Cover Letter</a>
            ${appliedBtnHtml(job.job_id, job.applied)}
            <button class="btn btn-sm btn-danger-alt js-delete-job" data-job-id="${escapeHtml(job.job_id)}">Remove</button>
          </div>
        </td>
      </tr>`;
  }

  // --- Event wiring (shared by history section and results page) ---

  function wireActions(container) {
    container.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('.js-toggle-applied');
      if (toggleBtn) {
        const job_id = toggleBtn.dataset.jobId;
        const applied = toggleApplied(job_id);
        toggleBtn.textContent = applied ? 'Applied' : 'Mark Applied';
        toggleBtn.className = `btn btn-sm ${applied ? 'btn-applied' : 'btn-alt'} js-toggle-applied`;
        // Sync badge in list row if present
        const row = container.querySelector(`tr[data-job-id="${job_id}"]`);
        if (row) {
          const cell = row.querySelector('.js-status-cell');
          if (cell) {
            cell.innerHTML = applied
              ? '<span class="badge badge-applied">Applied</span>'
              : '<span class="badge badge-pending">Pending</span>';
          }
        }
        return;
      }

      const deleteBtn = e.target.closest('.js-delete-job');
      if (deleteBtn) {
        const job_id = deleteBtn.dataset.jobId;
        deleteJob(job_id);
        const card = container.querySelector(`.history-card[data-job-id="${job_id}"]`);
        if (card) {
          (card.closest('.col') || card).remove();
        }
        const row = container.querySelector(`tr[data-job-id="${job_id}"]`);
        if (row) row.remove();
        if (getHistory().length === 0) {
          container.innerHTML = emptyStateHtml();
        }
      }
    });
  }

  function emptyStateHtml() {
    return '<p class="text-secondary text-center py-3">No saved jobs yet. Search for vacancy IDs above to get started.</p>';
  }

  // --- Public render for index page history section ---

  function renderHistorySection(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const history = getHistory();
    const mode = getViewMode();

    if (history.length === 0) {
      container.innerHTML = emptyStateHtml();
      return;
    }

    if (mode === 'card') {
      container.innerHTML = `
        <div class="container-fluid px-2" style="max-width:90%;">
          <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4 justify-content-center">
            ${history.map(renderJobCard).join('')}
          </div>
        </div>`;
    } else {
      container.innerHTML = `
        <div class="table-responsive">
          <table class="table table-history">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Title</th>
                <th>Agency</th>
                <th>Grade</th>
                <th>Due</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${history.map(renderJobRow).join('')}
            </tbody>
          </table>
        </div>`;
    }

    wireActions(container);
  }

  // --- Results page: save jobs + wire applied toggle on server-rendered cards ---

  function initResultsPage(jobs) {
    upsertJobs(jobs);
    const history = getHistory();

    // Add applied toggle buttons to each server-rendered card
    document.querySelectorAll('[data-job-id]').forEach(card => {
      const job_id = card.dataset.jobId;
      const saved = history.find(h => h.job_id === job_id);
      const actionRow = card.querySelector('.result-card-actions');
      if (!actionRow || !saved) return;

      const btn = document.createElement('button');
      btn.className = `btn btn-sm ${saved.applied ? 'btn-applied' : 'btn-alt'} js-toggle-applied`;
      btn.dataset.jobId = job_id;
      btn.textContent = saved.applied ? 'Applied' : 'Mark Applied';
      actionRow.appendChild(btn);
    });

    // Wire actions — delegate from results container or document body
    const resultsContainer = document.getElementById('results-container');
    wireActions(resultsContainer || document.body);
  }

  // --- Expose public API ---

  window.StatejobsHistory = { upsertJobs, renderHistorySection, initResultsPage, getViewMode, setViewMode };
})();
