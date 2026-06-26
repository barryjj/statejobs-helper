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

  function cardHtml(job, showDelete) {
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
      <div class="sj-card sj-card--hidden" data-job-id="${esc(job.job_id)}">
        <div class="sj-card__body">
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
          </div>
        </div>
      </div>`;
  }

  // --- Card stack renderer ---

  function renderCardStack(jobs, stageId, navId, showDelete) {
    const stage = document.getElementById(stageId);
    const navEl = document.getElementById(navId);
    if (!stage) return;

    if (jobs.length === 0) {
      stage.innerHTML = emptyStateHtml();
      if (navEl) navEl.style.display = 'none';
      return;
    }

    stage.innerHTML = jobs.map(j => cardHtml(j, showDelete)).join('');
    const cards = Array.from(stage.querySelectorAll('.sj-card'));
    let current = 0;

    // Build nav dots
    if (navEl) {
      const dotsContainer = navEl.querySelector('.sj-nav__dots');
      if (dotsContainer) {
        dotsContainer.innerHTML = jobs.map((_, i) =>
          `<span class="sj-nav__dot${i === 0 ? ' sj-nav__dot--active' : ''}"></span>`
        ).join('');
      }
      navEl.style.display = jobs.length > 1 ? '' : 'none';
    }

    function show(idx) {
      current = idx;
      cards.forEach((card, i) => {
        const offset = i - idx;
        card.className = card.className
          .replace(/\bsj-card--(active|prev|next|far-prev|far-next|hidden)\b/g, '')
          .trim();
        if      (offset === 0)  card.classList.add('sj-card--active');
        else if (offset === -1) card.classList.add('sj-card--prev');
        else if (offset === 1)  card.classList.add('sj-card--next');
        else if (offset === -2) card.classList.add('sj-card--far-prev');
        else if (offset === 2)  card.classList.add('sj-card--far-next');
        else                    card.classList.add('sj-card--hidden');
      });
      if (navEl) {
        navEl.querySelectorAll('.sj-nav__dot').forEach((d, i) =>
          d.classList.toggle('sj-nav__dot--active', i === idx)
        );
      }
    }

    function nav(dir) {
      const next = (current + dir + cards.length) % cards.length;
      const wrapping = (dir > 0 && next < current) || (dir < 0 && next > current);
      if (wrapping) {
        const incoming = cards[next];
        incoming.style.transition = 'none';
        incoming.className = incoming.className
          .replace(/\bsj-card--(active|prev|next|far-prev|far-next|hidden)\b/g, '')
          .trim();
        incoming.classList.add(dir > 0 ? 'sj-card--far-next' : 'sj-card--far-prev');
        incoming.offsetHeight;
        requestAnimationFrame(() => { incoming.style.transition = ''; show(next); });
      } else {
        show(next);
      }
    }

    // Wire nav buttons
    if (navEl) {
      navEl.querySelector('.sj-nav__prev')?.addEventListener('click', () => nav(-1));
      navEl.querySelector('.sj-nav__next')?.addEventListener('click', () => nav(1));
    }

    // Wire card action buttons via delegation on stage
    stage.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('.js-toggle-applied');
      if (toggleBtn) {
        const job_id = toggleBtn.dataset.jobId;
        const applied = toggleApplied(job_id);
        toggleBtn.textContent = applied ? 'Applied' : 'Mark Applied';
        toggleBtn.className = `btn btn-sm ${applied ? 'btn-applied' : 'btn-alt'} js-toggle-applied`;
        return;
      }

      if (!showDelete) return;
      const deleteBtn = e.target.closest('.js-delete-job');
      if (deleteBtn) {
        const job_id = deleteBtn.dataset.jobId;
        deleteJob(job_id);
        const cardEl = stage.querySelector(`.sj-card[data-job-id="${job_id}"]`);
        if (!cardEl) return;
        const idx = cards.indexOf(cardEl);
        cards.splice(idx, 1);
        cardEl.remove();
        // Remove corresponding dot
        const dots = navEl ? navEl.querySelectorAll('.sj-nav__dot') : [];
        if (dots[idx]) dots[idx].remove();
        if (cards.length === 0) {
          stage.innerHTML = emptyStateHtml();
          if (navEl) navEl.style.display = 'none';
          return;
        }
        if (navEl) navEl.style.display = cards.length > 1 ? '' : 'none';
        show(Math.min(current, cards.length - 1));
      }
    });

    // Snap to initial position without transition
    cards.forEach(c => c.style.transition = 'none');
    show(0);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      cards.forEach(c => c.style.transition = '');
    }));
  }

  // --- List table ---

  function renderListTable(jobs, containerId, showDelete) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (jobs.length === 0) { container.innerHTML = emptyStateHtml(); return; }

    const rowHtml = jobs.map(job => {
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
            <tr><th>Job ID</th><th>Title</th><th>Agency</th><th>Grade</th><th>Due</th><th>Actions</th></tr>
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

  function renderHistorySection(cardStageId, cardNavId, listContainerId) {
    const history = getHistory();
    const mode = getViewMode();
    if (mode === 'card') {
      renderCardStack(history, cardStageId, cardNavId, true);
    } else {
      renderListTable(history, listContainerId, true);
    }
  }

  // --- Public: results page ---

  function initResultsPage(jobs, cardStageId, cardNavId, listContainerId) {
    upsertJobs(jobs);
    const history = getHistory();
    const enriched = jobs.filter(isValidJob).map(j => {
      const saved = history.find(h => h.job_id === j.job_id);
      return { ...j, applied: saved ? saved.applied : false };
    });
    renderCardStack(enriched, cardStageId, cardNavId, false);
    renderListTable(enriched, listContainerId, false);
  }

  window.StatejobsHistory = {
    upsertJobs, getViewMode, setViewMode,
    renderHistorySection, initResultsPage,
  };
})();
