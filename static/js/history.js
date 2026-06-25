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

  function getViewMode() {
    return localStorage.getItem(VIEW_MODE_KEY) || 'card';
  }

  function setViewMode(mode) {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }

  // --- Rendering helpers ---

  function esc(str) {
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
    return `<button class="btn btn-sm ${cls} js-toggle-applied" data-job-id="${esc(job_id)}">${label}</button>`;
  }

  function renderJobCard(job, showDelete) {
    const addressHtml = job.full_address
      ? job.full_address.split('\n').filter(Boolean).map(esc).join('<br>')
      : 'N/A';
    const emailHtml = job.email
      ? `<a href="mailto:${esc(job.email)}?subject=Vacancy%20%23${esc(job.job_id)}&body=Please%20find%20my%20resume%20and%20cover%20letter%20attached.">${esc(job.email)}</a>`
      : 'N/A';
    const deleteBtn = showDelete
      ? `<button class="btn btn-sm btn-danger-alt js-delete-job" data-job-id="${esc(job.job_id)}">Remove</button>`
      : '';

    return `
      <div class="col">
        <div class="card-stack-wrapper">
          <div class="card h-100 shadow-sm history-card" data-job-id="${esc(job.job_id)}">
            <div class="card-body">
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
              <div class="text-center mt-3 d-flex gap-2 justify-content-center flex-wrap">
                <a href="/coverletter?job_id=${esc(job.job_id)}" class="btn btn-main btn-sm">Cover Letter</a>
                ${appliedBtnHtml(job.job_id, job.applied)}
                ${deleteBtn}
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderJobRow(job, showDelete) {
    const statusBadge = job.applied
      ? '<span class="status-badge badge-applied">Applied</span>'
      : '<span class="status-badge badge-pending">Pending</span>';
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
            ${appliedBtnHtml(job.job_id, job.applied)}
            ${deleteBtn}
          </div>
        </td>
      </tr>`;
  }

  function tableHtml(rows) {
    return `
      <div class="history-table-wrap">
        <table class="history-table">
          <thead>
            <tr>
              <th>Job ID</th><th>Title</th><th>Agency</th><th>Grade</th><th>Due</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function cardGridHtml(cards) {
    return `
      <div class="row row-cols-1 row-cols-lg-2 g-4">
        ${cards}
      </div>`;
  }

  // --- Event delegation ---

  function wireActions(container, showDelete) {
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
          if (cell) {
            cell.innerHTML = applied
              ? '<span class="status-badge badge-applied">Applied</span>'
              : '<span class="status-badge badge-pending">Pending</span>';
          }
        }
        return;
      }

      if (!showDelete) return;

      const deleteBtn = e.target.closest('.js-delete-job');
      if (deleteBtn) {
        const job_id = deleteBtn.dataset.jobId;
        deleteJob(job_id);
        const card = container.querySelector(`.history-card[data-job-id="${job_id}"]`);
        if (card) (card.closest('.col') || card).remove();
        const row = container.querySelector(`tr[data-job-id="${job_id}"]`);
        if (row) row.remove();
        if (getHistory().length === 0) {
          container.innerHTML = emptyStateHtml();
        }
      }
    });
  }

  function emptyStateHtml() {
    return '<p class="text-secondary text-center py-4">No saved jobs yet. Search for vacancy IDs to get started.</p>';
  }

  // --- Public: history page ---

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
      container.innerHTML = cardGridHtml(history.map(j => renderJobCard(j, true)).join(''));
    } else {
      container.innerHTML = tableHtml(history.map(j => renderJobRow(j, true)).join(''));
    }

    wireActions(container, true);
  }

  // --- Public: results page list view ---

  function renderResultsList(jobs, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const history = getHistory();
    const enriched = jobs.map(j => {
      const saved = history.find(h => h.job_id === j.job_id);
      return { ...j, applied: saved ? saved.applied : false };
    });

    container.innerHTML = tableHtml(enriched.map(j => renderJobRow(j, false)).join(''));
    wireActions(container, false);
  }

  // --- Public: results page init ---

  function initResultsPage(jobs) {
    upsertJobs(jobs);
    const history = getHistory();

    // Inject applied toggle into each server-rendered card
    document.querySelectorAll('.result-card').forEach(card => {
      const job_id = card.dataset.jobId;
      const saved = history.find(h => h.job_id === job_id);
      const actionsDiv = card.querySelector('.result-card-actions');
      if (!actionsDiv) return;

      const btn = document.createElement('button');
      const applied = saved ? saved.applied : false;
      btn.className = `btn btn-sm ${applied ? 'btn-applied' : 'btn-alt'} js-toggle-applied`;
      btn.dataset.jobId = job_id;
      btn.textContent = applied ? 'Applied' : 'Mark Applied';
      actionsDiv.appendChild(btn);
    });

    const cardContainer = document.getElementById('results-card-container');
    if (cardContainer) wireActions(cardContainer, false);
  }

  // --- Expose ---

  window.StatejobsHistory = {
    upsertJobs,
    getViewMode,
    setViewMode,
    renderHistorySection,
    renderResultsList,
    initResultsPage,
  };
})();
