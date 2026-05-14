/**
 * Content script for Twitter Auto Cleaner.
 * Injected into X/Twitter pages to handle tweet deletion, unliking, unreposting, and reply deletion.
 */

let deletionInterval = null;
let actionInterval = null;
/** @type {{ deleted: number, found: number }} */
let twitterDeleterStats = { deleted: 0, found: 0 };
/** @type {Array<{ date: string, text: string, likes: string, retweets: string, url: string }>} */
let deletedTweets = [];
/** @type {Array<{ date: string, text: string, url: string }>} */
let deletedReplies = [];
/** @type {{ unlikes: number, foundLikes: number, unreposts: number, foundReposts: number, repliesDeleted: number, repliesFound: number }} */
let actionStats = { unlikes: 0, foundLikes: 0, unreposts: 0, foundReposts: 0, repliesDeleted: 0, repliesFound: 0 };
/** @type {string|null} */
let currentAction = null;

const TARGET_USERNAME = 'vijayhardaha';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'startDelete':
      startDeletion();
      sendResponse({ status: 'started', action: 'delete' });
      break;
    case 'startUnlike':
      startUnliking();
      sendResponse({ status: 'started', action: 'unlike' });
      break;
    case 'startUnrepost':
      startUnreposting();
      sendResponse({ status: 'started', action: 'unrepost' });
      break;
    case 'startDeleteReplies':
      startDeletingReplies();
      sendResponse({ status: 'started', action: 'deleteReplies' });
      break;
    case 'stop':
      stopAll();
      sendResponse({ status: 'stopped' });
      break;
    case 'getStats':
      sendResponse(getStats());
      break;
    case 'getDeletedTweets':
      sendResponse({ deletedTweets: [...deletedTweets] });
      break;
  }
  return true;
});

/**
 * Returns the current statistics for the popup.
 *
 * @returns {{ currentAction: string|null, twitterDeleterStats: { deleted: number, found: number }, actionStats: object, deletedTweetsCount: number, deletedRepliesCount: number }} The current statistics.
 */
function getStats() {
  return {
    currentAction,
    twitterDeleterStats: { ...twitterDeleterStats },
    actionStats: { ...actionStats },
    deletedTweetsCount: deletedTweets.length,
    deletedRepliesCount: deletedReplies.length,
  };
}

function stopAll() {
  if (deletionInterval) {
    clearInterval(deletionInterval);
    deletionInterval = null;
  }
  if (actionInterval) {
    clearInterval(actionInterval);
    actionInterval = null;
  }
  currentAction = null;
}

/**
 * Checks if a tweet belongs to the target user.
 *
 * @param {Element} tweetElement - The tweet element.
 *
 * @returns {boolean} True if the tweet belongs to the target user.
 */
function isTargetUserTweet(tweetElement) {
  const userLink = tweetElement.querySelector('a[href*="/@' + TARGET_USERNAME + '"]');
  return !!userLink;
}

function startDeletion() {
  if (deletionInterval || actionInterval) return;
  currentAction = 'delete';

  twitterDeleterStats = { deleted: 0, found: 0 };
  deletedTweets = [];

  deletionInterval = setInterval(async () => {
    const moreButtons = document.querySelectorAll('[aria-label="More"]');
    twitterDeleterStats.found = moreButtons.length;

    for (const button of moreButtons) {
      if (!deletionInterval) return;

      try {
        const tweetElement = button.closest('article');
        if (!isTargetUserTweet(tweetElement)) continue;

        const tweetData = {
          date: tweetElement.querySelector('time')?.getAttribute('datetime') || '',
          text: tweetElement.querySelector('[data-testid="tweetText"]')?.textContent || '',
          likes: tweetElement.querySelector('[data-testid="like"]')?.textContent || '0',
          retweets: tweetElement.querySelector('[data-testid="retweet"]')?.textContent || '0',
          url: tweetElement.querySelector('time')?.parentElement?.getAttribute('href') || '',
        };

        button.click();
        await new Promise((r) => setTimeout(r, 500));

        const menuItems = document.querySelectorAll('[role="menuitem"]');
        const deleteButton = Array.from(menuItems).find((item) => item.textContent.includes('Delete'));

        if (deleteButton) {
          deleteButton.click();
          await new Promise((r) => setTimeout(r, 500));

          const confirmButton = document.querySelector('[data-testid="confirmationSheetConfirm"]');
          if (confirmButton) {
            confirmButton.click();
            twitterDeleterStats.deleted++;
            deletedTweets.push(tweetData);
          }
        }
      } catch (error) {
        console.error('Error during deletion:', error);
      }
    }
    window.scrollTo(0, document.body.scrollHeight);
  }, 2000);
}

function startUnliking() {
  if (deletionInterval || actionInterval) return;
  currentAction = 'unlike';

  actionStats = { ...actionStats, unlikes: 0, foundLikes: 0 };

  actionInterval = setInterval(async () => {
    const likeButtons = document.querySelectorAll('[data-testid="unlike"]');
    actionStats.foundLikes = likeButtons.length;

    for (const button of likeButtons) {
      if (!actionInterval) return;

      try {
        button.click();
        actionStats.unlikes++;
        await new Promise((r) => setTimeout(r, 500));
      } catch (error) {
        console.error('Error during unlike:', error);
      }
    }
    window.scrollTo(0, document.body.scrollHeight);
  }, 1000);
}

function startUnreposting() {
  if (deletionInterval || actionInterval) return;
  currentAction = 'unrepost';

  actionStats = { ...actionStats, unreposts: 0, foundReposts: 0 };

  actionInterval = setInterval(async () => {
    const repostButtons = document.querySelectorAll('[data-testid="unretweet"]');
    actionStats.foundReposts = repostButtons.length;

    for (const button of repostButtons) {
      if (!actionInterval) return;

      try {
        button.click();
        await new Promise((r) => setTimeout(r, 500));

        const confirmButton = document.querySelector('[data-testid="unretweetConfirm"]');
        if (confirmButton) {
          confirmButton.click();
          actionStats.unreposts++;
        }
        await new Promise((r) => setTimeout(r, 500));
      } catch (error) {
        console.error('Error during unrepost:', error);
      }
    }
    window.scrollTo(0, document.body.scrollHeight);
  }, 1000);
}

function startDeletingReplies() {
  if (deletionInterval || actionInterval) return;
  currentAction = 'deleteReplies';

  actionStats = { ...actionStats, repliesDeleted: 0, repliesFound: 0 };
  deletedReplies = [];

  actionInterval = setInterval(async () => {
    const moreButtons = document.querySelectorAll('[aria-label="More"]');
    const replyTweets = Array.from(moreButtons).filter((button) => {
      const tweetElement = button.closest('article');
      if (!tweetElement) return false;
      if (!isTargetUserTweet(tweetElement)) return false;

      const replyIcon = tweetElement.querySelector('[data-testid="reply"]');
      const retweetIcon = tweetElement.querySelector('[data-testid="retweet"]');

      return replyIcon && !retweetIcon?.closest('[data-testid="unretweet"]');
    });

    actionStats.repliesFound = replyTweets.length;

    for (const button of replyTweets) {
      if (!actionInterval) return;

      try {
        const tweetElement = button.closest('article');
        const replyData = {
          date: tweetElement.querySelector('time')?.getAttribute('datetime') || '',
          text: tweetElement.querySelector('[data-testid="tweetText"]')?.textContent || '',
          url: tweetElement.querySelector('time')?.parentElement?.getAttribute('href') || '',
        };

        button.click();
        await new Promise((r) => setTimeout(r, 500));

        const menuItems = document.querySelectorAll('[role="menuitem"]');
        const deleteButton = Array.from(menuItems).find((item) => item.textContent.includes('Delete'));

        if (deleteButton) {
          deleteButton.click();
          await new Promise((r) => setTimeout(r, 500));

          const confirmButton = document.querySelector('[data-testid="confirmationSheetConfirm"]');
          if (confirmButton) {
            confirmButton.click();
            actionStats.repliesDeleted++;
            deletedReplies.push(replyData);
          }
        }
        await new Promise((r) => setTimeout(r, 500));
      } catch (error) {
        console.error('Error during reply deletion:', error);
      }
    }
    window.scrollTo(0, document.body.scrollHeight);
  }, 2000);
}
