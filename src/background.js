/**
 * Background service worker for Twitter Auto Cleaner.
 * Keeps the extension alive and handles basic installation events.
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('Twitter Auto Cleaner installed');
});
