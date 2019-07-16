/* eslint-disable no-console */
import 'tachyons'
import './main.css'
import { Elm } from './TabExplorer.elm'
import { loadCachedState } from './tab-explorer/hooks'
import values from 'ramda/es/values'
import PouchDB from 'pouchdb-browser'
import isNil from 'ramda/es/isNil'
import {
  onAuthStateChanged,
  signIn,
  signOut,
  onSessionDocsChangedSince,
} from './tab-explorer/fire'
import identity from 'ramda/es/identity'
import { getCache, setCache } from './tab-explorer/basics'
import defaultTo from 'ramda/es/defaultTo'
import compose from 'ramda/es/compose'
import omit from 'ramda/es/omit'
import mergeLeft from 'ramda/es/mergeLeft'
import maxBy from 'ramda/es/maxBy'
import prop from 'ramda/es/prop'
import reduce from 'ramda/es/reduce'

const oldCachedSessionList = values(loadCachedState().sessions)

// console.log('oldCachedSessionList :', oldCachedSessionList)
// console.log('oldCachedSessionList :', oldCachedSessionList)

const app = Elm.TabExplorer.init({
  node: document.getElementById('root'),
  flags: {
    oldSessions: oldCachedSessionList,
    now: Date.now(),
  },
})

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

const onPouchDocsChanged = fn => db => {
  db.allDocs({ include_docs: true, update_seq: true }).then(res => {
    console.log('allDocs res', res)
    const docs = res.rows.map(row => row.doc)
    fn(docs)
    db.changes({
      include_docs: true,
      since: res.update_seq,
      live: true,
    })
      .on('change', change => {
        console.log('change', change)
        fn([change.doc])
      })
      .on('error', error => {
        console.error(error)
      })
  })
}
function boot(app) {
  const db = new PouchDB('sessions')
  sendCurrentWindowTabs(app)
  const sub = name => fn => {
    const port = app.ports[name]
    if (isNil(port)) {
      console.error(`subscription port not found ${name}`)
      return
    }
    port.subscribe(fn)
  }
  const send = name => payload => {
    const port = app.ports[name]
    if (isNil(port)) {
      console.error(`cmd port not found ${name}`)
      return
    }
    port.send(payload)
  }
  app.ports.createTab.subscribe(({ url, active }) => {
    chrome.tabs.create({ url, active })
  })
  app.ports.updateTab.subscribe(([id, { active }]) => {
    chrome.tabs.update(id, { active })
  })
  sub('removeTabs')(tabIds => {
    chrome.tabs.remove(tabIds)
  })
  sub('persistSessionList')(async sessionList => {
    const res = await db.bulkDocs(sessionList)
    console.log('res', res)
    app.ports.onPersistSessionListResponse.send(res)
  })

  let fireSessionsDisposer = identity

  function disposeFireSessionsListener() {
    fireSessionsDisposer()
    fireSessionsDisposer = identity
  }
  sub('signOut')(() => {
    disposeFireSessionsListener()
    signOut()
  })
  sub('signIn')(signIn)

  onAuthStateChanged(user => {
    send('onFireAuthStateChanged')(user)
    disposeFireSessionsListener()
    if (user) {
      const fireSessionsSyncedTillKey = 'fireSessionsSyncedTill'
      const fireSessionsSyncedTill = compose(
        defaultTo(0),
        parseInt,
        getCache,
      )(fireSessionsSyncedTillKey)

      console.log('fireSessionsSyncedTill', fireSessionsSyncedTill)

      fireSessionsDisposer = onSessionDocsChangedSince(
        user,
        fireSessionsSyncedTill,
        async docs => {
          const ps = docs.map(async doc => {
            try {
              const pouchDoc = await db.get(doc.id)

              console.debug('fire2pouch: db.get pouchDoc', pouchDoc)
              if (doc.modifiedAt > pouchDoc.modifiedAt) {
                const cleanFireDoc = omit(['id', '_id', '_rev'])(doc)
                const mergedDoc = mergeLeft(cleanFireDoc, pouchDoc)
                console.log(
                  'f2p: newer fire doc found, merging',
                  mergedDoc,
                )
                await db.put(mergedDoc)
              }
            } catch (e) {
              console.error('fire2pouch: db.get pouchDoc', e)
              throw e
            }
          })

          await Promise.all(ps)
          const newSyncSince = Math.max(...docs.map(d => d.modifiedAt))
          setCache(fireSessionsSyncedTillKey)(JSON.stringify(newSyncSince))
        },
      )
    }
  })

  onPouchDocsChanged(docs => {
    app.ports.onPouchSessionsChanged.send(docs)
  })(db)
}

boot(app)
