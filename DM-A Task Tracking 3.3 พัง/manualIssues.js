// manualIssues.js - manage manual recurring issues stored in localStorage

const MANUAL_ISSUES_KEY = 'manual_recurring_issues';
const BLACKLIST_KEY = 'blacklisted_recurring_issues';

let blacklistedIssuesCache = null;

// Load blacklisted issues (returns array of objects { label, team })
function loadBlacklistedIssues() {
  if (blacklistedIssuesCache !== null && Array.isArray(blacklistedIssuesCache)) {
    return blacklistedIssuesCache;
  }
  const data = localStorage.getItem(BLACKLIST_KEY);
  if (!data || data === 'null' || data === 'undefined') {
    blacklistedIssuesCache = [];
    return [];
  }
  try {
    blacklistedIssuesCache = JSON.parse(data);
    if (!Array.isArray(blacklistedIssuesCache)) {
      blacklistedIssuesCache = [];
    }
  } catch(e) {
    blacklistedIssuesCache = [];
  }
  return blacklistedIssuesCache;
}

// Save blacklisted issues
function saveBlacklistedIssues(blacklist) {
  blacklistedIssuesCache = blacklist;
  localStorage.setItem(BLACKLIST_KEY, JSON.stringify(blacklist));
  const isGas = typeof google !== 'undefined' && google.script && google.script.run;
  const hasSupabase = typeof window.supabaseClient !== 'undefined' && window.supabaseClient !== null;
  if (isGas || hasSupabase) {
    google.script.run.saveAllBlacklistedIssues(blacklist);
  }
}

// Add an issue to the blacklist
function blacklistIssue(label, team) {
  const blacklist = loadBlacklistedIssues();
  if (!blacklist.some(item => item.label === label && item.team === team)) {
    blacklist.push({ label, team });
    saveBlacklistedIssues(blacklist);
  }
}

// Check if an issue is blacklisted
function isIssueBlacklisted(label, team) {
  const blacklist = loadBlacklistedIssues();
  return blacklist.some(item => item.label === label && item.team === team);
}

let manualIssuesCache = null;

// Load manual issues from localStorage (returns array)
function loadManualIssues() {
  if (manualIssuesCache !== null && Array.isArray(manualIssuesCache)) {
    return manualIssuesCache;
  }
  const data = localStorage.getItem(MANUAL_ISSUES_KEY);
  let issues = [];
  if (data && data !== 'null' && data !== 'undefined') {
    try {
      issues = JSON.parse(data);
      if (!Array.isArray(issues)) {
        issues = [];
      }
    } catch(e) {
      issues = [];
    }
  }
  // Ensure backward compatibility by mapping aircraftType if missing or generic
  issues.forEach(issue => {
    if (issue.aircraftType === 'B737') issue.aircraftType = 'B737-800';
    else if (issue.aircraftType === 'B777') issue.aircraftType = 'B777-300ER';
    else if (issue.aircraftType === 'B787') issue.aircraftType = 'B787-8';
    else if (issue.aircraftType === 'A350') issue.aircraftType = 'A350-900';
    else if (issue.aircraftType === 'A330') issue.aircraftType = 'A330-300';

    if (!issue.aircraftType) {
      if (issue.aircraft && issue.aircraft.length > 0) {
        const firstReg = issue.aircraft[0].trim().toUpperCase();
        if (firstReg === 'HS-TBA') issue.aircraftType = 'A320';
        else if (firstReg === 'N-9875A') issue.aircraftType = 'B737-800';
        else if (firstReg === 'HS-TBC') issue.aircraftType = 'B777-300ER';
        else if (firstReg === 'HS-TBD') issue.aircraftType = 'A320';
        else if (firstReg === 'N-423SP') issue.aircraftType = 'B737-800';
        else {
          if (firstReg.startsWith('HS-')) {
            issue.aircraftType = 'A320';
          } else if (firstReg.startsWith('N-')) {
            issue.aircraftType = 'B737-800';
          } else {
            issue.aircraftType = 'A320';
          }
        }
      } else {
        issue.aircraftType = 'A320';
      }
    }
  });
  manualIssuesCache = issues;
  return issues;
}

// Save manual issues array to localStorage
function saveManualIssues(issues) {
  manualIssuesCache = issues;
  localStorage.setItem(MANUAL_ISSUES_KEY, JSON.stringify(issues));
  const isGas = typeof google !== 'undefined' && google.script && google.script.run;
  const hasSupabase = typeof window.supabaseClient !== 'undefined' && window.supabaseClient !== null;
  if (isGas || hasSupabase) {
    google.script.run.saveAllManualIssues(issues);
  }
}

// Add a new manual issue (object with "label", "aircraft", "notes", "assignedTeam", "aircraftType", and "count")
function addManualIssue(label, aircraft, notes, assignedTeam, aircraftType) {
  const issues = loadManualIssues();
  issues.push({
    label,
    aircraft,
    notes,
    assignedTeam: assignedTeam || 'Mechanical System Team',
    aircraftType: aircraftType || 'A320',
    count: 1 // Treated as a single recurring pattern incident
  });
  saveManualIssues(issues);
}

// Delete a manual issue by its index
function deleteManualIssue(index) {
  const issues = loadManualIssues();
  if (index >= 0 && index < issues.length) {
    issues.splice(index, 1);
    saveManualIssues(issues);
  }
}

// Delete a manual issue by label and team name
function deleteManualIssueByDetails(label, team) {
  let issues = loadManualIssues();
  issues = issues.filter(issue => !(issue.label === label && (issue.assignedTeam || 'Mechanical System Team') === team));
  saveManualIssues(issues);
}

// Helper to get CSS badge class for a team name
function getTeamBadgeClass(team) {
  if (team === 'Mechanical System Team') return 'mech';
  if (team === 'Avionic Systems Team') return 'avionics';
  if (team === 'Structure Team') return 'struct';
  if (team === 'Engines Team') return 'engines';
  if (team === 'IERA Shop') return 'iera';
  if (team === 'Component Team') return 'component';
  return '';
}

// Helper to get short name of the team
function getTeamShortName(team) {
  if (team === 'Mechanical System Team') return 'Mechanical';
  if (team === 'Avionic Systems Team') return 'Avionic';
  if (team === 'Structure Team') return 'Structure';
  if (team === 'Engines Team') return 'Engines';
  if (team === 'IERA Shop') return 'IERA';
  if (team === 'Component Team') return 'Component';
  return team || 'Mechanical';
}

// Render manual issues list inside the Statistics tab
function renderManualIssuesList() {
  const listContainer = document.getElementById('manualIssueList');
  if (!listContainer) return;
  
  const issues = loadManualIssues();
  listContainer.innerHTML = '';
  
  if (issues.length === 0) {
    listContainer.innerHTML = '<div class="recurring-empty">No manual recurring issues added yet</div>';
    return;
  }
  
  issues.forEach((issue, idx) => {
    const item = document.createElement('div');
    item.className = 'manual-issue-item recurring-item';
    
    const team = issue.assignedTeam || 'Mechanical System Team';
    const badgeClass = getTeamBadgeClass(team);
    const shortName = getTeamShortName(team);
    
    // Create inner structure matching analytics cards with team badge
    item.innerHTML = `
      <div class="recurring-info">
        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <span class="recurring-keyword">${escapeHTML(issue.label)}</span>
          <span class="team-badge ${badgeClass}" style="font-size: 0.7rem; padding: 1px 6px;">${escapeHTML(shortName)}</span>
          <span class="ac-type-badge" style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted); background: var(--bg-hover); padding: 1px 6px; border-radius: 4px; border: 1px solid var(--border-color);">${escapeHTML(issue.aircraftType || 'A320')}</span>
        </div>
        <span class="recurring-aircraft">Aircraft: ${escapeHTML(issue.aircraft.join(', '))}</span>
        ${issue.notes ? `<p class="manual-notes" style="margin-top: 0.25rem; font-size: 0.8rem; color: var(--text-secondary);">${escapeHTML(issue.notes)}</p>` : ''}
      </div>
      <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
        <button class="edit-issue-btn" data-idx="${idx}" title="Edit Issue" style="padding: 4px; border-radius: 4px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
          </svg>
        </button>
        <button class="delete-issue-btn" data-idx="${idx}" title="Delete Issue" style="padding: 4px; border-radius: 4px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
    listContainer.appendChild(item);
  });
}

// Simple HTML escaping helper to prevent XSS
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Attach listeners for the manual issue form and delete buttons
function initManualIssues() {
  const form = document.getElementById('manualIssueForm');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      
      const labelInput = document.getElementById('manualLabel');
      const aircraftInput = document.getElementById('manualAircraft');
      const aircraftTypeInput = document.getElementById('manualAircraftType');
      const teamInput = document.getElementById('manualTeam');
      const notesInput = document.getElementById('manualNotes');
      
      const label = labelInput ? labelInput.value.trim() : '';
      const aircraftRaw = aircraftInput ? aircraftInput.value.trim() : '';
      const aircraftType = aircraftTypeInput ? aircraftTypeInput.value : '';
      const team = teamInput ? teamInput.value : '';
      const notes = notesInput ? notesInput.value.trim() : '';
      
      if (label && aircraftRaw && aircraftType && team) {
        // Split and clean up aircraft codes
        const aircraft = aircraftRaw.split(',').map(a => a.trim()).filter(a => a.length > 0);
        
        addManualIssue(label, aircraft, notes, team, aircraftType);
        
        // Reset form
        form.reset();
        if (typeof setAircraftTypes === 'function') {
          setAircraftTypes('manualAircraftTypeDropdown', 'manualAircraftType', 'manualAircraftTypeText', 'Select aircraft type...', '');
        }
        if (typeof setAssignedTeams === 'function') {
          setAssignedTeams('manualTeamDropdown', 'manualTeam', 'manualTeamText', 'Select team...', '');
        }
        
        // Re-render components
        renderManualIssuesList();
        
        // Update Chart
        if (typeof renderRecurringPieChart === 'function') {
          renderRecurringPieChart();
        }
      }
    });
  }
  
  // Delete and Edit buttons delegation on the list container
  const list = document.getElementById('manualIssueList');
  if (list) {
    list.addEventListener('click', e => {
      const deleteBtn = e.target.closest('.delete-issue-btn');
      if (deleteBtn) {
        const idx = Number(deleteBtn.dataset.idx);
        deleteManualIssue(idx);
        renderManualIssuesList();
        
        // Update Chart
        if (typeof renderRecurringPieChart === 'function') {
          renderRecurringPieChart();
        }

        // Re-render App (updates Team Analytics cards)
        if (typeof renderApp === 'function') {
          renderApp();
        }
        return;
      }

      const editBtn = e.target.closest('.edit-issue-btn');
      if (editBtn) {
        const idx = Number(editBtn.dataset.idx);
        openEditTeamIssueModal(idx);
      }
    });
  }

  // Submit handler for modalManualIssueForm (per-team manual issue popup)
  const modalForm = document.getElementById('modalManualIssueForm');
  if (modalForm) {
    modalForm.addEventListener('submit', e => {
      e.preventDefault();
      
      const team = document.getElementById('modalManualTeam').value;
      const label = document.getElementById('modalManualLabel').value.trim();
      const aircraftRaw = document.getElementById('modalManualAircraft').value.trim();
      const aircraftType = document.getElementById('modalManualAircraftType').value;
      const notes = document.getElementById('modalManualNotes').value.trim();
      
      if (label && aircraftRaw && aircraftType && team) {
        const aircraft = aircraftRaw.split(',').map(a => a.trim()).filter(a => a.length > 0);
        
        const editIdxInput = document.getElementById('modalManualEditIndex');
        const editIdx = editIdxInput ? editIdxInput.value : '';
        
        if (editIdx !== '') {
          const index = parseInt(editIdx, 10);
          updateManualIssue(index, label, aircraft, notes, team, aircraftType);
        } else {
          addManualIssue(label, aircraft, notes, team, aircraftType);
        }
        
        if (typeof closeModal === 'function') {
          closeModal('manualIssueModal');
        }
        
        // Re-render components
        renderManualIssuesList();
        
        // Re-render App (updates Team Analytics cards)
        if (typeof renderApp === 'function') {
          renderApp();
        }
        
        // Update Chart
        if (typeof renderRecurringPieChart === 'function') {
          renderRecurringPieChart();
        }
      }
    });
  }
}

// Update a manual issue by its index
function updateManualIssue(index, label, aircraft, notes, assignedTeam, aircraftType) {
  const issues = loadManualIssues();
  if (index >= 0 && index < issues.length) {
    issues[index] = {
      label,
      aircraft,
      notes,
      assignedTeam: assignedTeam || 'Mechanical System Team',
      aircraftType: aircraftType || 'A320',
      count: issues[index].count || 1
    };
    saveManualIssues(issues);
  }
}

// Open Edit Team Issue Modal (called from Team Analytics cards or sidebar list)
function openEditTeamIssueModal(index) {
  const issues = loadManualIssues();
  if (index < 0 || index >= issues.length) return;
  const issue = issues[index];

  // Set the title of the modal
  const modalTitle = document.querySelector('#manualIssueModal h2');
  if (modalTitle) {
    modalTitle.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px; margin-right: 8px; vertical-align: middle;">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
      </svg>
      Edit Recurring Issue
    `;
  }
  
  const submitBtn = document.querySelector('#modalManualIssueForm button[type="submit"]');
  if (submitBtn) {
    submitBtn.textContent = 'Save Changes';
  }

  const teamInput = document.getElementById('modalManualTeam');
  const teamDisplay = document.getElementById('modalManualTeamDisplay');
  if (teamInput && teamDisplay) {
    teamInput.value = issue.assignedTeam || 'Mechanical System Team';
    teamDisplay.textContent = getTeamShortName(issue.assignedTeam || 'Mechanical System Team') + ' Team';
  }

  // Set values
  document.getElementById('modalManualLabel').value = issue.label;
  document.getElementById('modalManualAircraft').value = issue.aircraft.join(', ');
  if (typeof setAircraftTypes === 'function') {
    setAircraftTypes('modalManualAircraftTypeDropdown', 'modalManualAircraftType', 'modalManualAircraftTypeText', 'Select aircraft type...', issue.aircraftType || 'A320');
  } else {
    document.getElementById('modalManualAircraftType').value = issue.aircraftType || 'A320';
  }
  document.getElementById('modalManualNotes').value = issue.notes || '';
  
  // Set a hidden field to store the original index
  let editIdxInput = document.getElementById('modalManualEditIndex');
  if (!editIdxInput) {
    editIdxInput = document.createElement('input');
    editIdxInput.type = 'hidden';
    editIdxInput.id = 'modalManualEditIndex';
    document.getElementById('modalManualIssueForm').appendChild(editIdxInput);
  }
  editIdxInput.value = index;

  if (typeof openModal === 'function') {
    openModal('manualIssueModal');
  }
}

// Open Edit Team Issue Modal by details (label, teamName)
function openEditTeamIssueModalByDetails(label, teamName) {
  const issues = loadManualIssues();
  const index = issues.findIndex(issue => issue.label === label && (issue.assignedTeam || 'Mechanical System Team') === teamName);
  if (index !== -1) {
    openEditTeamIssueModal(index);
  } else {
    // Purely auto-detected issue. Open modal to convert it into a manual one.
    // Gather details from tasks.
    let aircraft = [];
    let aircraftType = 'A320';
    if (typeof tasks !== 'undefined' && typeof MRO_KEYWORDS !== 'undefined') {
      const teamTasks = tasks.filter(t => t.assignedTeam === teamName);
      const matchingTasks = teamTasks.filter(task => {
        const descLower = task.taskDescription.toLowerCase();
        const keywords = MRO_KEYWORDS.filter(kw => kw.label === label).map(kw => kw.keyword);
        return keywords.some(kw => descLower.includes(kw));
      });
      aircraft = Array.from(new Set(matchingTasks.map(t => t.aircraftReg)));
      const firstTaskWithType = matchingTasks.find(t => t.aircraftType);
      if (firstTaskWithType) aircraftType = firstTaskWithType.aircraftType;
    }

    // Prepare modal for creating a manual issue from auto-detected
    const modalTitle = document.querySelector('#manualIssueModal h2');
    if (modalTitle) {
      modalTitle.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px; margin-right: 8px; vertical-align: middle;">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
        </svg>
        Edit Recurring Issue
      `;
    }
    
    const submitBtn = document.querySelector('#modalManualIssueForm button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = 'Save Changes';
    }

    const teamInput = document.getElementById('modalManualTeam');
    const teamDisplay = document.getElementById('modalManualTeamDisplay');
    if (teamInput && teamDisplay) {
      teamInput.value = teamName;
      teamDisplay.textContent = getTeamShortName(teamName) + ' Team';
    }

    // Set values
    document.getElementById('modalManualLabel').value = label;
    document.getElementById('modalManualAircraft').value = aircraft.join(', ');
    if (typeof setAircraftTypes === 'function') {
      setAircraftTypes('modalManualAircraftTypeDropdown', 'modalManualAircraftType', 'modalManualAircraftTypeText', 'Select aircraft type...', aircraftType);
    } else {
      document.getElementById('modalManualAircraftType').value = aircraftType;
    }
    document.getElementById('modalManualNotes').value = '';
    
    // Set hidden field to store the original index as -1
    let editIdxInput = document.getElementById('modalManualEditIndex');
    if (!editIdxInput) {
      editIdxInput = document.createElement('input');
      editIdxInput.type = 'hidden';
      editIdxInput.id = 'modalManualEditIndex';
      document.getElementById('modalManualIssueForm').appendChild(editIdxInput);
    }
    editIdxInput.value = '-1';

    let origLabelInput = document.getElementById('modalManualEditOriginalLabel');
    if (!origLabelInput) {
      origLabelInput = document.createElement('input');
      origLabelInput.type = 'hidden';
      origLabelInput.id = 'modalManualEditOriginalLabel';
      document.getElementById('modalManualIssueForm').appendChild(origLabelInput);
    }
    origLabelInput.value = label;

    if (typeof openModal === 'function') {
      openModal('manualIssueModal');
    }
  }
}

// Open Add Team Issue Modal (called from Team Analytics cards)
function openAddTeamIssueModal(teamName) {
  // Reset the title of the modal
  const modalTitle = document.querySelector('#manualIssueModal h2');
  if (modalTitle) {
    modalTitle.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px; margin-right: 8px; vertical-align: middle;">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
      </svg>
      Add Recurring Issue
    `;
  }
  
  const submitBtn = document.querySelector('#modalManualIssueForm button[type="submit"]');
  if (submitBtn) {
    submitBtn.textContent = 'Add Issue';
  }

  const editIdxInput = document.getElementById('modalManualEditIndex');
  if (editIdxInput) {
    editIdxInput.value = '';
  }

  const origLabelInput = document.getElementById('modalManualEditOriginalLabel');
  if (origLabelInput) {
    origLabelInput.value = '';
  }

  const teamInput = document.getElementById('modalManualTeam');
  const teamDisplay = document.getElementById('modalManualTeamDisplay');
  if (teamInput && teamDisplay) {
    teamInput.value = teamName;
    teamDisplay.textContent = getTeamShortName(teamName) + ' Team';
  }
  
  // Clear modal form inputs
  const labelInput = document.getElementById('modalManualLabel');
  const aircraftInput = document.getElementById('modalManualAircraft');
  const aircraftTypeInput = document.getElementById('modalManualAircraftType');
  const notesInput = document.getElementById('modalManualNotes');
  if (labelInput) labelInput.value = '';
  if (aircraftInput) aircraftInput.value = '';
  if (typeof setAircraftTypes === 'function') {
    setAircraftTypes('modalManualAircraftTypeDropdown', 'modalManualAircraftType', 'modalManualAircraftTypeText', 'Select aircraft type...', '');
  } else if (aircraftTypeInput) {
    aircraftTypeInput.value = '';
  }
  if (notesInput) notesInput.value = '';
  
  if (typeof openModal === 'function') {
    openModal('manualIssueModal');
  }
}

function initManualIssuesSync() {
  const isGas = typeof google !== 'undefined' && google.script && google.script.run;
  const hasSupabase = typeof window.supabaseClient !== 'undefined' && window.supabaseClient !== null;
  if (isGas || hasSupabase) {
    google.script.run
      .withSuccessHandler(data => {
        if (data && Array.isArray(data)) {
          manualIssuesCache = data;
          localStorage.setItem(MANUAL_ISSUES_KEY, JSON.stringify(data));
          renderManualIssuesList();
          if (typeof renderApp === 'function') {
            renderApp();
          }
        }
      })
      .getManualIssues();

    google.script.run
      .withSuccessHandler(data => {
        if (data && Array.isArray(data)) {
          blacklistedIssuesCache = data;
          localStorage.setItem(BLACKLIST_KEY, JSON.stringify(data));
          if (typeof renderApp === 'function') {
            renderApp();
          }
        }
      })
      .getBlacklist();
  }
}

// Initialise when DOM is ready
function startManualIssues() {
  initManualIssues();
  renderManualIssuesList();
  initManualIssuesSync();
}

window.initManualIssuesSync = initManualIssuesSync;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startManualIssues);
} else {
  startManualIssues();
}
