// tabs.js - handles switching between Board and Statistics tabs
function initTabs() {
  const tabItems = document.querySelectorAll('.tab-item');
  tabItems.forEach(item => {
    item.addEventListener('click', () => {
      // Update active tab styling
      const current = document.querySelector('.tab-item.active');
      if (current) current.classList.remove('active');
      item.classList.add('active');

      // Hide all tab sections
      document.querySelectorAll('.tab-content').forEach(section => {
        section.classList.add('hidden');
      });

      // Show the selected section
      const target = item.dataset.tab; // "board" or "stats"
      const targetSection = document.getElementById(target + 'Tab');
      if (targetSection) targetSection.classList.remove('hidden');

      // If we switched to the statistics tab, render its dynamic parts
      if (target === 'stats' && typeof renderStatisticsTab === 'function') {
        renderStatisticsTab();
      }

      // If we switched to the weekly summary tab, render its summary report
      if (target === 'summary' && typeof renderWeeklySummaryTab === 'function') {
        renderWeeklySummaryTab();
      }

      // If we switched to the FYI tab, render its FYI board
      if (target === 'fyi' && typeof renderFYITab === 'function') {
        renderFYITab();
      }

      // If we switched to the Calendar tab, render its calendar grid
      if (target === 'calendar' && typeof renderCalendarTab === 'function') {
        renderCalendarTab();
      }

      // If we switched to the Material Catalog tab, render its catalog
      if (target === 'sap' && typeof renderSAPTab === 'function') {
        renderSAPTab();
      }

      // If we switched to the History tab, render archived tasks
      if (target === 'history' && typeof renderHistoryTab === 'function') {
        renderHistoryTab();
      }
    });
  });
}

// Initialise tabs when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTabs);
} else {
  initTabs();
}
