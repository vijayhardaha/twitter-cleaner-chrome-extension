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

let TARGET_USERNAME = '';
chrome.storage.local.get(['twitterUsername'], (result) => {
  if (result.twitterUsername) {
    TARGET_USERNAME = result.twitterUsername;
  }
});

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
 * Returns aggregated statistics for the popup UI.
 * Includes current action, tweet deletion counts, and action-specific metrics.
 *
 * @returns {{ currentAction: string|null, twitterDeleterStats: { deleted: number, found: number }, actionStats: object, deletedTweetsCount: number, deletedRepliesCount: number }} Aggregated statistics for the popup UI.
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

/**
 * Stops any active deletion or action loops and resets state.
 * Clears interval/timeout identifiers and flags, then clears the current action.
 */
function stopAll() {
  if (deletionInterval) {
    // Clear interval if numeric ID, otherwise just reset flag
    clearInterval(deletionInterval);
    deletionInterval = false;
  }
  if (actionInterval) {
    // Clear both interval and timeout IDs; also handle boolean flag for recursive loop
    clearTimeout(actionInterval);
    actionInterval = false; // stop recursive process if it's a boolean flag
  }
  currentAction = null;
}

/**
 * Determines whether a tweet element belongs to the configured target user.
 *
 * @param {Element} tweetElement - The tweet DOM element to inspect.
 *
 * @returns {boolean} True if the tweet is authored by the TARGET_USERNAME.
 */
function isTargetUserTweet(tweetElement) {
  // Find a span that contains the target handle (e.g., "@vijayhardaha")
  const targetHandle = `@${TARGET_USERNAME}`;
  const spans = tweetElement.querySelectorAll('span');
  let usernameSpan = null;
  for (const s of spans) {
    if (s.textContent && s.textContent.trim() === targetHandle) {
      usernameSpan = s;
      break;
    }
  }
  if (!usernameSpan) {
    return false;
  }
  // Ensure the span is inside an anchor linking to the user's profile
  const link = usernameSpan.closest('a');
  if (!link) {
    return false;
  }
  if (link.getAttribute('href') !== `/${TARGET_USERNAME}`) {
    return false;
  }
  // Ensure the anchor is within an element marked as User-Name
  return !!link.closest('[data-testid="User-Name"]');
}

/**
 * Initiates the recursive tweet deletion process for the target user's tweets.
 * Sets up a flag and begins an async loop that scans for "More" buttons,
 * clicks through delete menus, confirms deletion, and scrolls to load more.
 * The loop recurses with a delay to continue until stopped.
 */
function startDeletion() {
  if (deletionInterval || actionInterval) {
    return;
  }
  currentAction = 'delete';

  twitterDeleterStats = { deleted: 0, found: 0 };
  deletedTweets = [];

  // Recursive async deletion loop using await delay
  deletionInterval = true; // running flag
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  const process = async () => {
    if (!deletionInterval) {
      return;
    }

    const moreButtons = document.querySelectorAll('[aria-label="More"]');
    twitterDeleterStats.found = moreButtons.length;

    for (const button of moreButtons) {
      if (!deletionInterval) {
        return;
      }
      try {
        const tweetElement = button.closest('article');
        if (!tweetElement) {
          continue;
        }
        if (!isTargetUserTweet(tweetElement)) {
          continue;
        }

        // Capture tweet metadata before deletion
        const tweetData = {
          date: tweetElement.querySelector('time')?.getAttribute('datetime') || '',
          text: tweetElement.querySelector('[data-testid="tweetText"]')?.textContent || '',
          likes: tweetElement.querySelector('[data-testid="like"]')?.textContent || '0',
          retweets: tweetElement.querySelector('[data-testid="retweet"]')?.textContent || '0',
          url: tweetElement.querySelector('time')?.parentElement?.getAttribute('href') || '',
        };

        button.click();
        await delay(500);

        const menuItems = document.querySelectorAll('[role="menuitem"]');
        const deleteButton = Array.from(menuItems).find((item) => item.textContent.includes('Delete'));
        if (deleteButton) {
          // Ensure tweet is in view before deletion
          tweetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await delay(100);
          deleteButton.click();
          await delay(300);

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
    await delay(2000);
    await process();
  };

  // Start recursion
  process();
}

/**
 * Starts the recursive unlike process.
 * Finds unlike buttons, clicks them, updates stats, and recurses.
 */
function startUnliking() {
  currentAction = 'unlike';

  actionStats = { ...actionStats, unlikes: 0, foundLikes: 0 };

  // Recursive async unlike loop using await delay
  actionInterval = true;
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));
  const process = async () => {
    if (!actionInterval) {
      return;
    }
    // Find all unlike buttons currently in view
    const likeButtons = document.querySelectorAll('[data-testid="unlike"]');
    actionStats.foundLikes = likeButtons.length;
    for (const button of likeButtons) {
      if (!actionInterval) {
        return;
      }
      try {
        const tweetElement = button.closest('article');
        if (tweetElement) {
          tweetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await delay(100);
        }
        button.click();
        actionStats.unlikes++;
        await delay(300);
      } catch (error) {
        console.error('Error during unlike:', error);
      }
    }
    window.scrollTo(0, document.body.scrollHeight);
    await delay(1000);
    await process();
  };
  process();
}

/**
 * Starts the recursive unrepost (unretweet) process.
 * Finds unretweet buttons, triggers them, confirms the action, updates stats,
 * scrolls for additional content, and recurses with a delay.
 */
function startUnreposting() {
  if (deletionInterval || actionInterval) {
    return;
  }
  currentAction = 'unrepost';

  actionStats = { ...actionStats, unreposts: 0, foundReposts: 0 };

  // Recursive async unrepost loop using await delay
  actionInterval = true;
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));
  const process = async () => {
    if (!actionInterval) {
      return;
    }
    // Locate repost buttons where tweet indicates "You reposted"
    const repostSpans = Array.from(document.querySelectorAll('span')).filter(
      (s) => s.textContent && s.textContent.includes('You reposted')
    );
    const repostButtons = repostSpans
      .map((span) => span.closest('article'))
      .filter(Boolean)
      .map((article) => article.querySelector('button[data-testid="unretweet"][type="button"]'))
      .filter(Boolean);
    actionStats.foundReposts = repostButtons.length;
    console.log('Unrepost detection - found', repostButtons.length, 'buttons');

    for (const button of repostButtons) {
      if (!actionInterval) {
        return;
      }
      try {
        const tweetElement = button.closest('article');
        if (tweetElement) {
          tweetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await delay(100);
        }
        console.log('Clicking unrepost button for tweet');
        button.click();
        await delay(200);
        const confirmButton = document.querySelector('[data-testid="unretweetConfirm"]');
        if (confirmButton) {
          confirmButton.click();
          actionStats.unreposts++;
        }
        await delay(500);
      } catch (error) {
        console.error('Error during unrepost:', error);
      }
    }
    window.scrollTo(0, document.body.scrollHeight);
    await delay(1000);
    await process();
  };
  process();
}

/**
 * Launches a recursive process to delete reply tweets authored by the target user.
 * It searches for "More" buttons on reply tweets, opens the delete menu,
 * confirms deletion, records statistics, scrolls when none are found,
 * and repeats after a delay.
 */
function startDeletingReplies() {
  if (deletionInterval || actionInterval) {
    return;
  }
  currentAction = 'deleteReplies';

  actionStats = { ...actionStats, repliesDeleted: 0, repliesFound: 0 };
  deletedReplies = [];

  // Use a recursive async function with await delay instead of setTimeout intervals
  actionInterval = true; // act as a running flag
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  const process = async () => {
    if (!actionInterval) {
      return;
    } // stopped

    // Find all "More" buttons on reply tweets
    const moreButtons = document.querySelectorAll('[aria-label="More"]');
    const replyTweets = Array.from(moreButtons).filter((button) => {
      const tweetElement = button.closest('article');
      if (!tweetElement) {
        return false;
      }
      if (!isTargetUserTweet(tweetElement)) {
        return false;
      }
      return true;
    });

    actionStats.repliesFound = replyTweets.length;

    for (const button of replyTweets) {
      if (!actionInterval) {
        return;
      }
      try {
        const tweetElement = button.closest('article');
        // Capture reply tweet metadata before deletion
        const replyData = {
          date: tweetElement.querySelector('time')?.getAttribute('datetime') || '',
          text: tweetElement.querySelector('[data-testid="tweetText"]')?.textContent || '',
          url: tweetElement.querySelector('time')?.parentElement?.getAttribute('href') || '',
        };
        button.click();
        await delay(500);
        const menuItems = document.querySelectorAll('[role="menuitem"]');
        const deleteButton = Array.from(menuItems).find((item) => item.textContent.includes('Delete'));
        if (deleteButton) {
          // Scroll tweet into view before initiating delete action
          tweetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await delay(100); // allow scrolling to settle
          deleteButton.click();
          await delay(300);
          const confirmButton = document.querySelector('[data-testid="confirmationSheetConfirm"]');
          if (confirmButton) {
            confirmButton.click();
            actionStats.repliesDeleted++;
            deletedReplies.push(replyData);
          }
        }
        await delay(500);
      } catch (error) {
        console.error('Error during reply deletion:', error);
      }
    }

    if (replyTweets.length === 0) {
      window.scrollTo(0, document.body.scrollHeight);
    }
    // Wait 2 seconds then recurse
    await delay(2000);
    await process();
  };

  // Start the recursive process
  process();
}
