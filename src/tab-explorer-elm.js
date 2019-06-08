/* eslint-disable no-console */
import 'tachyons'
import './main.css'
import { Elm } from './TabExplorer.elm'
import { loadCachedState } from './tab-explorer/hooks'
import values from 'ramda/es/values'
import PouchDB from 'pouchdb-browser'

const oldCachedSessionList = values(loadCachedState().sessions)

// console.log('oldCachedSessionList :', oldCachedSessionList)

const app = Elm.TabExplorer.init({
  node: document.getElementById('root'),
  flags: {
    sessions: oldCachedSessionList,
  },
})

boot(app)

const getCurrentPopulatedWindow = () => {
  return new Promise(resolve =>
    chrome.windows.getCurrent({ populate: true }, resolve),
  )
}

function sendCurrentWindowTabs(app) {
  const tabEvents = [
    chrome.tabs.onCreated,
    chrome.tabs.onUpdated,
    chrome.tabs.onAttached,
    chrome.tabs.onDetached,
    chrome.tabs.onReplaced,
    chrome.tabs.onRemoved,
  ]

  async function listener() {
    const win = await getCurrentPopulatedWindow()
    const tabs = win.tabs
    // console.log('tabs', tabs)
    // console.table(tabs[0])
    app.ports.onCurrentWindowTabsChanged.send(tabs)
  }

  tabEvents.forEach(event => event.addListener(listener))
}

function boot(app) {
  const db = new PouchDB('sessions')
  sendCurrentWindowTabs(app)
  app.ports.createTab.subscribe(({ url, active }) => {
    chrome.tabs.create({ url, active })
  })
  app.ports.updateTab.subscribe(([id, { active }]) => {
    chrome.tabs.update(id, { active })
  })
  app.ports.persistSessionList.subscribe(async sessionList => {
    const res = await db.bulkDocs(sessionList)
    console.log('res', res)
  })
  db.allDocs({ include_docs: true, update_seq: true }).then(res => {
    console.log('allDocs res', res)
    const docs = res.rows.map(row => row.doc)
    app.ports.onPouchSessionsChanged.send(docs)
  })
}
