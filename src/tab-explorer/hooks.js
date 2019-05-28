/* eslint-disable no-console */
import {
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  createContext,
  // useRef,
} from 'react'
import over from 'ramda/es/over'
import nanoid from 'nanoid'
import prop from 'ramda/es/prop'
import reject from 'ramda/es/reject'
import startsWith from 'ramda/es/startsWith'
import propSatisfies from 'ramda/es/propSatisfies'
import mergeDeepRight from 'ramda/es/mergeDeepRight'
import defaultTo from 'ramda/es/defaultTo'
import omit from 'ramda/es/omit'
import lensPath from 'ramda/es/lensPath'
import equals from 'ramda/es/equals'
import { getCache, setCache, overProp, mergeModel } from './basics'
import not from 'ramda/es/not'
import map from 'ramda/es/map'
import assoc from 'ramda/es/assoc'
// import PouchDB from 'pouchdb-browser'
import { pipe } from './safe-basics'
import pick from 'ramda/es/pick'

// CHROME API

const pageUrl = chrome.runtime.getURL('tab-explorer.html')
console.log('pageUrl', pageUrl)

const getPopulatedWindow = () => {
  return new Promise(resolve =>
    chrome.windows.getCurrent({ populate: true }, resolve),
  )
}

// const getCurrentTab = () =>
//   new Promise(resolve => chrome.tabs.getCurrent(resolve))

const closeTabs = tabIds => {
  return new Promise(resolve => chrome.tabs.remove(tabIds, resolve))
}

const createTab = tab => {
  return new Promise(resolve =>
    chrome.tabs.create({ url: tab.url, active: false }, resolve),
  )
}

// HOOKS & MODEL

const useListener = (event, listener, deps) => {
  const callback = useCallback(listener, deps)
  useEffect(() => {
    event.addListener(callback)
    return () => event.removeListener(callback)
  }, deps)
}

const useCurrentWindowTabs = () => {
  const [tabs, setTabs] = useState([])

  const updateCurrentTabs = useCallback(async () => {
    const win = await getPopulatedWindow()
    setTabs(win.tabs)
  }, [setTabs])

  useEffect(() => console.log('current window tabs changed', tabs), [tabs])

  useEffect(() => void updateCurrentTabs(), [])

  const events = [
    chrome.tabs.onCreated,
    chrome.tabs.onUpdated,
    chrome.tabs.onAttached,
    chrome.tabs.onDetached,
    chrome.tabs.onReplaced,
    chrome.tabs.onRemoved,
  ]

  events.forEach(e =>
    useListener(e, updateCurrentTabs, [updateCurrentTabs]),
  )

  return tabs
}

// class Session {
//   constructor(id, createdAt, tabs) {
//     this.id = id
//     this.createdAt = createdAt
//     this.tabs = tabs
//   }
//   encode() {
//     const { id, createdAt, tabs } = this
//     return { id, createdAt, tabs }
//   }
//   static encode(session) {
//     return session.encode()
//   }
//   static decode({ id, createdAt, tabs }) {
//     return new Session(id, createdAt, tabs)
//   }
//   static newFromTabs(tabs) {
//     return new Session('S_' + nanoid(), Date.now(), tabs)
//   }
// }
//
// class SessionStore {
//   constructor(byId) {
//     this.byId = byId
//   }
//   static empty() {
//     return new SessionStore({})
//   }
//   static encode(store) {
//     return Object.values(store.byId).map(Session.encode)
//   }
//   static decode(sessionAttrList) {
//     const byId = sessionAttrList.reduce((byId, attrs) => {
//       byId[attrs.id] = Session.decode(attrs)
//       return byId
//     }, {})
//     return new SessionStore(byId)
//   }

//   mapById(fn) {
//     return new SessionStore(fn(this.byId))
//   }

//   static createAndAddNewSessionFromTabs(tabs, ss) {
//     const session = Session.newFromTabs(tabs)
//     return ss.mapById(mergeModel(session))
//   }
// }

// const overSessionStore = overProp('sessionStore')

const loadCachedState = () => {
  const defaultState = { sessions: {} }
  const stateProps = Object.keys(defaultState)
  const decodeCached = pipe(
    getCache,
    defaultTo('{}'),
    JSON.parse,
    pick(stateProps),
    mergeDeepRight(defaultState),
    // s =>
    //   assoc('sessionStore')(
    //     SessionStore.decode(Object.values(s.sessions)),
    //   )(s),
    // overSessionStore(
    //   ifElse(isNil)(() => SessionStore.empty())(SessionStore.decode),
    // ),
  )

  return decodeCached('te-app-state')
}

function encodeState(state) {
  const fn = pipe(
    // overSessionStore(SessionStore.encode),
    state => JSON.stringify(state, null, 2),
  )
  return fn(state)
}

const useCacheStateEffect = state => {
  return useEffect(() => setCache('te-app-state')(encodeState(state)), [
    state,
  ])
}

function sessionFromTabs(tabs) {
  const session = {
    id: 'S_' + nanoid(),
    createdAt: Date.now(),
    tabs: tabs,
  }
  console.log('session :', session)
  return session
}

const overPath = pipe(
  lensPath,
  over,
)

function useActions(setState) {
  return useMemo(() => {
    const setStateProp = prop => fn => setState(overProp(prop)(fn))
    const setSessions = setStateProp('sessions')
    // const setSessionStore = setStateProp('sessionStore')

    function createAndAddSessionFromTabs(tabs) {
      const session = sessionFromTabs(tabs)
      setSessions(mergeModel(session))
      // setSessionStore(ss =>
      //   SessionStore.createAndAddNewSessionFromTabs(tabs, ss),
      // )
    }

    return {
      saveSession: otherTabs => {
        createAndAddSessionFromTabs(otherTabs)
      },
      saveSessionAndCloseTabs: async otherTabs => {
        createAndAddSessionFromTabs(otherTabs)
        await closeTabs(otherTabs.map(prop('id')))
      },
      onOpenTabsListItemClicked: tab => {
        chrome.tabs.update(tab.id, { active: true }, updatedTab =>
          console.log('tab updated', updatedTab),
        )
      },
      onSessionTabsListItemClicked: tab => {
        createTab(tab)
      },
      deleteSessionWithId: id => {
        setSessions(omit([id]))
      },
      deleteSessionTab: (sessionId, tab) => {
        setSessions(overPath([sessionId, 'tabs'])(reject(equals(tab))))
      },
      // addNewSessionFromTabs: tabs => {
      //   const session = sessionFromTabs(tabs)
      //   setSessions(mergeModel(session))
      // },
      onOpenTabsClicked: tabs => {
        tabs.forEach(createTab)
      },
      onSessionTogglePinnedClicked: sessionId => {
        setSessions(overPath([sessionId, 'pinned'])(not))
      },
      onSessionToggleCollapsedClicked: sessionId => {
        setSessions(overPath([sessionId, 'collapsed'])(not))
      },
      onCollapseAllSessionsClicked: () => {
        setSessions(map(assoc('collapsed')(true)))
      },
      onExpandAllSessionsClicked: () => {
        setSessions(map(assoc('collapsed')(false)))
      },
    }
  }, [setState])
}

// function pouchDbPersistAppState(state, db) {
//   return db
//     .get('root')
//     .then(rootDoc => {
//       console.log('rootDoc :', rootDoc)
//     })
//     .catch(() => {
//       return db.put({ _id: 'root', state, createdAt: Date.now() })
//     })
// }

// function useCachePouchDBEffect(state) {
//   const pdbRef = useRef()
//   useEffect(() => {
//     const db = new PouchDB('tab-explorer-app-state')
//     pdbRef.current = db
//     return () => {
//       db.close()
//       pdbRef.current = null
//     }
//   }, [])

//   useEffect(() => {
//     const db = pdbRef.current
//     if (!db) return
//     pouchDbPersistAppState(state, db)
//   }, [state, pdbRef.current])
// }

export function useAppState() {
  const [state, setState] = useState(loadCachedState)
  useCacheStateEffect(state)
  const actions = useActions(setState)
  // useCachePouchDBEffect(state, actions)
  useEffect(() => console.log('state changed', state), [state])
  return [state, actions]
}

const ActionsContext = createContext()

export const AppActionsProvider = ActionsContext.Provider

export function useAppActions() {
  return useContext(ActionsContext)
}

export function useOpenTabsList() {
  const windowTabs = useCurrentWindowTabs()
  return reject(propSatisfies(startsWith(pageUrl))('url'))(windowTabs)
}
