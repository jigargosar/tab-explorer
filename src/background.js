/* eslint no-console:0  */

console.log('Loading background.js')

// HELPERS

const rt = chrome.runtime
// const mg = chrome.management
const tb = chrome.tabs
// const ex = chrome.extension

const onBrowserAction = cb =>
  chrome.browserAction.onClicked.addListener(cb)

const createTab = options =>
  new Promise(resolve => tb.create(options, resolve))

const queryTabs = options =>
  new Promise(resolve => tb.query(options, resolve))

const updateTabWithId = id => options =>
  new Promise(resolve => tb.update(id, options, resolve))

// MAIN

const tabExplorerUrl = rt.getURL('tab-explorer.html')

onBrowserAction(async () => {
  const tabs = await queryTabs({
    currentWindow: true,
    url: tabExplorerUrl,
  })
  console.log('Find tab-explorer tabs, in currentWindow', tabs)

  if (tabs.length === 0) {
    const newTab = await createTab({ url: tabExplorerUrl })
    console.log('new tab opened on browser action', newTab)
  } else {
    const updatedTab = await updateTabWithId(tabs[0].id)({ active: true })
    console.log('existing tab made active ;)', updatedTab)
  }
})

// chrome.tabs.onActivated.addRules({})

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  console.log('bg: onMessage', message, sender, reply)
  if (message === 'whoami') {
    reply(sender)
  } else {
    reply(new Error('Oops'))
  }
  return true
})
