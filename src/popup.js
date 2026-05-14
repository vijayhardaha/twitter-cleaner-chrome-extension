/**
 * Popup script for Twitter Auto Cleaner extension.
 * Handles user interactions and communicates with content scripts.
 */

let startTime = null;
let currentAction = null;
let stats = { deleted: 0, found: 0 };
let actionStats = { unlikes: 0, foundLikes: 0, unreposts: 0, foundReposts: 0, repliesDeleted: 0, repliesFound: 0 };
let statsInterval = null;

/**
 * Ensures the user is on the correct profile page before performing actions.
 * Redirects to the appropriate URL based on the action type.
 *
 * @param {string|null} action - The action type: 'delete', 'unlike', 'unrepost', or 'replies'.
 *
 * @returns {Promise<boolean>} Resolves to true if on the correct page, false otherwise.
 */
async function ensureProfilePage(action = null) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url?.includes('twitter.com') && !tab.url?.includes('x.com')) {
    await chrome.tabs.update(tab.id, { url: 'https://x.com/home' });
    return false;
  }

  const username = await new Promise((resolve) => {
    chrome.storage.local.get(['twitterUsername'], async (result) => {
      if (result.twitterUsername) {
        resolve(result.twitterUsername);
      } else {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const profileButton =
                document.querySelector('[data-testid="AppTabBar_Profile_Link"]')
                || document.querySelector('a[href*="/home"] + div a[role="link"]');
              if (profileButton) {
                return (
                  profileButton.getAttribute('href')?.replace('/', '')
                  || profileButton.getAttribute('href')?.split('/').filter(Boolean).pop()
                );
              }
              return null;
            },
          });
          const username = results[0]?.result;
          if (username) {
            chrome.storage.local.set({ twitterUsername: username });
            resolve(username);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      }
    });
  });

  if (username) {
    const domain = tab.url?.includes('twitter.com') ? 'twitter.com' : 'x.com';
    const path =
      action === 'unlike' ? `/${username}/likes` : action === 'replies' ? `/${username}/with_replies` : `/${username}`;
    await chrome.tabs.update(tab.id, { url: `https://${domain}${path}` });
    return new Promise((resolve) => setTimeout(() => resolve(true), 2000));
  }

  return false;
}

/**
 * Updates the stats display with the current status and action-specific statistics.
 *
 * @param {string} status - The status message to display.
 */
function updateStats(status) {
  const statsDiv = document.getElementById('stats');
  statsDiv.style.display = 'block';

  const statusEl = document.getElementById('status');
  statusEl.textContent = status || 'Running';

  document.getElementById('deleteStatsGroup').classList.toggle('hidden', currentAction !== 'delete');
  document.getElementById('foundStatsGroup').classList.toggle('hidden', currentAction !== 'delete');
  document.getElementById('unlikeStatsGroup').classList.toggle('hidden', currentAction !== 'unlike');
  document.getElementById('unrepostStatsGroup').classList.toggle('hidden', currentAction !== 'unrepost');
  document.getElementById('repliesStatsGroup').classList.toggle('hidden', currentAction !== 'deleteReplies');

  if (currentAction === 'unlike') {
    document.getElementById('unlikeCount').textContent = `${actionStats.unlikes} / ${actionStats.foundLikes || 0}`;
  } else if (currentAction === 'unrepost') {
    document.getElementById('unrepostCount').textContent =
      `${actionStats.unreposts} / ${actionStats.foundReposts || 0}`;
  } else if (currentAction === 'deleteReplies') {
    document.getElementById('repliesDeletedCount').textContent =
      `${actionStats.repliesDeleted} / ${actionStats.repliesFound || 0}`;
  } else if (currentAction === 'delete') {
    document.getElementById('deletedCount').textContent = stats.deleted;
    document.getElementById('foundCount').textContent = stats.found;
  }

  if (startTime) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    document.getElementById('timeElapsed').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const startDeleteBtn = document.getElementById('startDelete');
  const stopActionBtn = document.getElementById('stopAction');
  const startUnlikeBtn = document.getElementById('startUnlike');
  const startUnrepostBtn = document.getElementById('startUnrepost');
  const startDeleteRepliesBtn = document.getElementById('startDeleteReplies');

  startDeleteBtn.addEventListener('click', async () => {
    if (!(await ensureProfilePage())) {
      updateStats('Redirecting to profile...');
      return;
    }

    currentAction = 'delete';
    disableActionButtons(true);
    startTime = Date.now();
    stats = { deleted: 0, found: 0 };
    updateStats('Starting...');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'startDelete' });
  });

  stopActionBtn.addEventListener('click', async () => {
    disableActionButtons(false);
    currentAction = null;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'stop' }, () => {
      updateStats('Stopped');
      startTime = null;
    });
  });

  startUnlikeBtn.addEventListener('click', async () => {
    if (!(await ensureProfilePage('unlike'))) {
      updateStats('Redirecting to likes tab...');
      return;
    }

    currentAction = 'unlike';
    disableActionButtons(true);
    startTime = Date.now();
    actionStats = { ...actionStats, unlikes: 0, foundLikes: 0 };
    updateStats('Starting unlikes...');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'startUnlike' });
  });

  startUnrepostBtn.addEventListener('click', async () => {
    if (!(await ensureProfilePage())) {
      updateStats('Redirecting to profile...');
      return;
    }

    currentAction = 'unrepost';
    disableActionButtons(true);
    startTime = Date.now();
    actionStats = { ...actionStats, unreposts: 0, foundReposts: 0 };
    updateStats('Starting unreposts...');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'startUnrepost' });
  });

  startDeleteRepliesBtn.addEventListener('click', async () => {
    if (!(await ensureProfilePage('replies'))) {
      updateStats('Redirecting to replies...');
      return;
    }

    currentAction = 'deleteReplies';
    disableActionButtons(true);
    startTime = Date.now();
    actionStats = { ...actionStats, repliesDeleted: 0, repliesFound: 0 };
    updateStats('Starting reply deletion...');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'startDeleteReplies' });
  });

  function disableActionButtons(disabled) {
    startDeleteBtn.disabled = disabled;
    startUnlikeBtn.disabled = disabled;
    startUnrepostBtn.disabled = disabled;
    startDeleteRepliesBtn.disabled = disabled;
    stopActionBtn.disabled = !disabled;
  }

  document.getElementById('stats').style.display = 'flex';
  document.getElementById('status').textContent = 'Ready';

  statsInterval = setInterval(async () => {
    if (currentAction) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      try {
        chrome.tabs.sendMessage(tab.id, { action: 'getStats' }, (response) => {
          if (chrome.runtime.lastError) return;
          if (response) {
            if (response.currentAction) {
              currentAction = response.currentAction;
            }
            if (response.twitterDeleterStats) {
              stats = response.twitterDeleterStats;
            }
            if (response.actionStats) {
              actionStats = { ...actionStats, ...response.actionStats };
            }

            const statusText =
              currentAction === 'unlike'
                ? 'Unliking...'
                : currentAction === 'unrepost'
                  ? 'Unreposting...'
                  : currentAction === 'deleteReplies'
                    ? 'Deleting replies...'
                    : currentAction === 'delete'
                      ? 'Deleting...'
                      : 'Processing...';
            updateStats(statusText);
          }
        });
      } catch (e) {
        console.error('Error polling stats:', e);
      }
    }
  }, 500);
});
