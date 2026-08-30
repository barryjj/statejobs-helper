(function () {
  const HISTORY_KEY = 'statejobs_history';
  const VIEW_MODE_KEY = 'statejobs_view_mode';
  const SORT_KEY = 'statejobs_sort';
  const SEARCH_KEY = 'statejobs_search';
  const FILTER_KEY = 'statejobs_applied_filter';
  const VALID_FILTERS = ['all', 'applied', 'not-applied'];

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
    // Let the page refresh filter counts without a full re-render — the row
    // stays put until the next render so the click doesn't yank it away.
    document.dispatchEvent(new CustomEvent('statejobs:applied-changed'));
    return history[idx].applied;
  }

  function deleteJob(job_id) {
    saveHistory(getHistory().filter(h => h.job_id !== job_id));
  }

  function getViewMode() { return localStorage.getItem(VIEW_MODE_KEY) || 'card'; }
  function setViewMode(mode) { localStorage.setItem(VIEW_MODE_KEY, mode); }

  function getSort() {
    try {
      const s = JSON.parse(localStorage.getItem(SORT_KEY));
      return s && s.key ? s : { key: null, dir: null };
    } catch { return { key: null, dir: null }; }
  }

  function setSort(sort) { localStorage.setItem(SORT_KEY, JSON.stringify(sort)); }

  function getSearchTerm() { return localStorage.getItem(SEARCH_KEY) || ''; }
  function setSearchTerm(term) { localStorage.setItem(SEARCH_KEY, term || ''); }

  function getAppliedFilter() {
    const f = localStorage.getItem(FILTER_KEY);
    // Guard against a stale or hand-edited value silently hiding every row.
    return VALID_FILTERS.includes(f) ? f : 'all';
  }

  function setAppliedFilter(filter) {
    localStorage.setItem(FILTER_KEY, VALID_FILTERS.includes(filter) ? filter : 'all');
  }

  // --- Sorting ---

  // "06/29/26" (MM/DD/YY) — string comparison looks fine within one year and
  // then silently breaks across one, so parse to a real timestamp.
  function parseDue(value) {
    if (!value) return null;
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(String(value).trim());
    if (!m) return null;
    let [, mm, dd, yy] = m;
    let year = Number(yy);
    if (yy.length === 2) year += 2000;
    const t = Date.UTC(year, Number(mm) - 1, Number(dd));
    return Number.isNaN(t) ? null : t;
  }

  // Grade is normally a number, with NS ranking above every grade and hourly
  // below. Sorting the raw string would put grade 9 after grade 25, so rank
  // numerically and park the two special cases at the ends.
  function parseGrade(value) {
    if (!value) return null;
    const s = String(value).trim();
    if (/^ns$/i.test(s)) return Infinity;
    if (/hourly/i.test(s)) return -Infinity;
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? null : n;
  }

  const SORT_ACCESSORS = {
    job_id:  j => Number(j.job_id) || null,
    title:   j => (j.title || '').toLowerCase() || null,
    agency:  j => (j.agency || '').toLowerCase() || null,
    grade:   j => parseGrade(j.grade),
    due:     j => parseDue(j.applications_due),
  };

  function sortJobs(jobs, sort) {
    if (!sort || !sort.key || !sort.dir) return jobs;
    const get = SORT_ACCESSORS[sort.key];
    if (!get) return jobs;
    const factor = sort.dir === 'desc' ? -1 : 1;

    // decorate so the sort stays stable and blanks keep their original order
    return jobs
      .map((job, i) => ({ job, i, v: get(job) }))
      .sort((a, b) => {
        // Missing values sink to the bottom in BOTH directions — flipping the
        // sort shouldn't put a wall of blanks in front of the real rows.
        const aBlank = a.v === null || a.v === undefined;
        const bBlank = b.v === null || b.v === undefined;
        if (aBlank && bBlank) return a.i - b.i;
        if (aBlank) return 1;
        if (bBlank) return -1;
        if (a.v < b.v) return -1 * factor;
        if (a.v > b.v) return 1 * factor;
        return a.i - b.i;
      })
      .map(d => d.job);
  }

  const SORT_COLUMNS = [
    { key: 'job_id', label: 'Job ID' },
    { key: 'title',  label: 'Title' },
    { key: 'agency', label: 'Agency' },
    { key: 'grade',  label: 'Grade' },
    { key: 'due',    label: 'Due' },
  ];

  // asc → desc → unsorted, so you can always get back to most-recently-searched
  function nextSortDir(current) {
    return current === 'asc' ? 'desc' : current === 'desc' ? null : 'asc';
  }

  // --- Helpers ---

  function esc(str) {
    if (!str) return 'N/A';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function mailtoHref(job) {
    return `mailto:${esc(job.email)}?subject=Vacancy%20%23${esc(job.job_id)}&body=Please%20find%20my%20resume%20and%20cover%20letter%20attached.`;
  }

  function matchesSearch(job, term) {
    if (!term) return true;
    const haystack = `${job.job_id} ${job.title} ${job.agency}`.toLowerCase();
    return haystack.includes(term.toLowerCase());
  }

  // filter: 'all' | 'applied' | 'not-applied'
  function matchesAppliedFilter(job, filter) {
    if (filter === 'applied') return !!job.applied;
    if (filter === 'not-applied') return !job.applied;
    return true;
  }

  // Counts for the filter chips — always over the search-filtered set,
  // never the applied-filtered one, or the numbers move as you click.
  function getCounts(searchTerm) {
    const matched = getHistory().filter(j => matchesSearch(j, searchTerm));
    const applied = matched.filter(j => j.applied).length;
    return { all: matched.length, applied, notApplied: matched.length - applied };
  }

  // Compact icon-button action row shared by card and list views
  function actionIconsHtml(job, showDelete) {
    const appliedCls = job.applied ? 'icon-btn--applied' : '';
    const appliedTitle = job.applied ? 'Applied — click to unmark' : 'Mark Applied';
    const emailBtn = job.email
      ? `<a href="${mailtoHref(job)}" class="icon-btn" title="Email contact">
           <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 16 16"><path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4Zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2Zm13 2.383-4.708 2.825L15 11.105V5.383Zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741ZM1 11.105l4.708-2.897L1 5.383v5.722Z"/></svg>
         </a>`
      : `<span class="icon-btn icon-btn--disabled" title="No email on file">
           <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 16 16"><path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4Zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2Zm13 2.383-4.708 2.825L15 11.105V5.383Zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741ZM1 11.105l4.708-2.897L1 5.383v5.722Z"/></svg>
         </span>`;
    const deleteBtn = showDelete
      ? `<button class="icon-btn icon-btn--danger js-delete-job" data-job-id="${esc(job.job_id)}" title="Remove from history">
           <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6Z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1ZM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118ZM2.5 3V2h11v1h-11Z"/></svg>
         </button>`
      : '';

    return `
      <a href="/coverletter?job_id=${esc(job.job_id)}" class="icon-btn icon-btn--main" title="Generate cover letter">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 16 16"><path d="M4 0h5.293A1 1 0 0 1 10 .293L13.707 4a1 1 0 0 1 .293.707V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2Zm5.5 1.5v2a1 1 0 0 0 1 1h2l-3-3ZM4.5 9a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1h-7Zm0 2.5a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1h-4Z"/></svg>
      </a>
      ${emailBtn}
      <button class="icon-btn ${appliedCls} js-toggle-applied" data-job-id="${esc(job.job_id)}" title="${appliedTitle}">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 16 16"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0Z"/></svg>
      </button>
      ${deleteBtn}`;
  }

  function cardHtml(job, showDelete) {
    const addressHtml = job.full_address
      ? job.full_address.split('\n').filter(Boolean).map(esc).join('<br>')
      : 'N/A';
    const emailHtml = job.email
      ? `<a href="${mailtoHref(job)}">${esc(job.email)}</a>`
      : 'N/A';

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
          <div class="mt-3 d-flex gap-2 justify-content-center">
            ${actionIconsHtml(job, showDelete)}
          </div>
        </div>
      </div>`;
  }

  // --- Card stack renderer ---

  function renderCardStack(jobs, stageId, navId, showDelete, stillMatches) {
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

    // Pull one card out of the stack in place, keeping the reader's position
    // rather than re-rendering and snapping back to the first card.
    function removeCard(job_id) {
      const cardEl = stage.querySelector(`.sj-card[data-job-id="${job_id}"]`);
      if (!cardEl) return;
      const idx = cards.indexOf(cardEl);
      cards.splice(idx, 1);
      cardEl.remove();
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

    // Wire card action buttons via delegation on stage
    stage.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('.js-toggle-applied');
      if (toggleBtn) {
        const job_id = toggleBtn.dataset.jobId;
        const applied = toggleApplied(job_id);
        toggleBtn.classList.toggle('icon-btn--applied', applied);
        toggleBtn.title = applied ? 'Applied — click to unmark' : 'Mark Applied';
        // If it no longer belongs under the active filter, let it go.
        if (stillMatches && !stillMatches({ applied })) removeCard(job_id);
        return;
      }

      if (!showDelete) return;
      const deleteBtn = e.target.closest('.js-delete-job');
      if (deleteBtn) {
        const job_id = deleteBtn.dataset.jobId;
        deleteJob(job_id);
        removeCard(job_id);
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

  function headerCellsHtml() {
    const { key, dir } = getSort();
    return SORT_COLUMNS.map(col => {
      const active = col.key === key && dir;
      const arrow = active ? (dir === 'asc' ? '&#9650;' : '&#9660;') : '&#9671;';
      const aria = active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none';
      return `<th class="sortable${active ? ' sorted' : ''}" data-sort-key="${col.key}"
                  role="button" tabindex="0" aria-sort="${aria}"
                  title="Sort by ${col.label}">${col.label}<span class="sort-arrow">${arrow}</span></th>`;
    }).join('');
  }

  function renderListTable(jobs, containerId, showDelete, stillMatches, onSortChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (jobs.length === 0) { container.innerHTML = emptyStateHtml(); return; }

    const rowHtml = jobs.map(job => `
        <tr data-job-id="${esc(job.job_id)}">
          <td><a href="https://statejobs.ny.gov/public/vacancyDetailsView.cfm?id=${esc(job.job_id)}" target="_blank" rel="noopener noreferrer">${esc(job.job_id)}</a></td>
          <td>${esc(job.title)}</td>
          <td>${esc(job.agency)}</td>
          <td>${esc(job.grade)}</td>
          <td>${esc(job.applications_due)}</td>
          <td>
            <div class="d-flex gap-1">
              ${actionIconsHtml(job, showDelete)}
            </div>
          </td>
        </tr>`).join('');

    container.innerHTML = `
      <div class="history-table-wrap">
        <table class="history-table">
          <thead>
            <tr>${headerCellsHtml()}<th>Actions</th></tr>
          </thead>
          <tbody>${rowHtml}</tbody>
        </table>
      </div>`;

    function removeRow(job_id) {
      container.querySelector(`tr[data-job-id="${job_id}"]`)?.remove();
      if (!container.querySelector('tbody tr')) container.innerHTML = emptyStateHtml();
    }

    function applySort(th) {
      const key = th.dataset.sortKey;
      const cur = getSort();
      const dir = nextSortDir(cur.key === key ? cur.dir : null);
      setSort({ key: dir ? key : null, dir });
      if (onSortChange) onSortChange();
    }

    container.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const th = e.target.closest('th.sortable');
      if (!th) return;
      e.preventDefault();
      applySort(th);
    });

    container.addEventListener('click', (e) => {
      const th = e.target.closest('th.sortable');
      if (th) { applySort(th); return; }

      const toggleBtn = e.target.closest('.js-toggle-applied');
      if (toggleBtn) {
        const job_id = toggleBtn.dataset.jobId;
        const applied = toggleApplied(job_id);
        toggleBtn.classList.toggle('icon-btn--applied', applied);
        toggleBtn.title = applied ? 'Applied — click to unmark' : 'Mark Applied';
        // If it no longer belongs under the active filter, let it go.
        if (stillMatches && !stillMatches({ applied })) removeRow(job_id);
        return;
      }
      if (!showDelete) return;
      const deleteBtn = e.target.closest('.js-delete-job');
      if (deleteBtn) {
        deleteJob(deleteBtn.dataset.jobId);
        removeRow(deleteBtn.dataset.jobId);
      }
    });
  }

  // Distinguishes "history is empty" from "your filters matched nothing".
  let _filtersActive = false;

  function emptyStateHtml() {
    return _filtersActive
      ? '<p class="text-secondary text-center py-4">No jobs match the current search or filter.</p>'
      : '<p class="text-secondary text-center py-4">No saved jobs yet. Search for vacancy IDs to get started.</p>';
  }

  // --- Public: history page ---

  function renderHistorySection(cardStageId, cardNavId, listContainerId, searchTerm, appliedFilter, onSortChange) {
    // If nothing is saved at all, the filters aren't why the list is empty —
    // say "no saved jobs", not "nothing matches".
    _filtersActive = getHistory().length > 0
      && (!!searchTerm || (appliedFilter && appliedFilter !== 'all'));
    const filtered = getHistory()
      .filter(j => matchesSearch(j, searchTerm))
      .filter(j => matchesAppliedFilter(j, appliedFilter));
    // Sort applies to the card stack too, so the deck follows whatever order
    // was picked in the list view.
    const history = sortJobs(filtered, getSort());
    // Only the applied flag can change without a re-render, so that's all
    // this needs to re-check when a row is toggled.
    const stillMatches = j => matchesAppliedFilter(j, appliedFilter);
    const mode = getViewMode();
    if (mode === 'card') {
      renderCardStack(history, cardStageId, cardNavId, true, stillMatches);
    } else {
      renderListTable(history, listContainerId, true, stillMatches, onSortChange);
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

    function draw() {
      const ordered = sortJobs(enriched, getSort());
      renderCardStack(ordered, cardStageId, cardNavId, false);
      renderListTable(ordered, listContainerId, false, null, draw);
    }
    draw();
  }

  window.StatejobsHistory = {
    upsertJobs, getViewMode, setViewMode, getCounts,
    getSearchTerm, setSearchTerm, getAppliedFilter, setAppliedFilter,
    renderHistorySection, initResultsPage,
  };
})();
