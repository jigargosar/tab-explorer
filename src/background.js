console.log('Loading background.js')

const rt = chrome.runtime
const mg = chrome.management
const tb = chrome.tabs
const ex = chrome.extension

const onBrowserAction = cb =>
  chrome.browserAction.onClicked.addListener(cb)

const createTab = options =>
  new Promise((resolve, reject) => tb.create(options, resolve))

const queryTabs = options =>
  new Promise((resolve, reject) => tb.query(options, resolve))

const updateTabWithId = id => options =>
  new Promise((resolve, reject) => tb.update(id, options, resolve))

// tb.query({}, console.log)

const tabExplorerUrl = rt.getURL('tab-explorer.html')

/* const openTabExplorer = async () => {
  const tab = await createTab({ url: tabExplorerUrl })
  console.log('new tab opened on browser action', tab)
  return tab
}
 */

onBrowserAction(async () => {
  //  tb.create({ url: 'tab-explorer.html' }, t => {
  //   console.log('new tab opened on browser action', t)
  // });
  // await openTabExplorer()
  // ex.getViews({}, console.log)
  const tabs = await queryTabs({
    currentWindow: true,
    url: tabExplorerUrl,
  })
  console.log('Find tab-explorer tabs, in currentWindow', tabs)

  if (tabs.length === 0) {
    const tab = await createTab({ url: tabExplorerUrl })
    console.log('new tab opened on browser action', tab)
  } else {
    const updatedTab = await updateTabWithId(tabs[0].id)({ active: true })
    console.log('existing tab made active ;)', updatedTab)
  }

  /* tb.query({ currentWindow: true, url: tabExplorerUrl }, async tabs => {
    console.log(tabs)
    if (tabs.length === 0) {
      await openTabExplorer()
    } else {
      tb.update(tabs[0].id, { active: true }, updatedTab => {
        console.log('existing tab made active ;)', updatedTab)
      })
    }
  }) */
})
