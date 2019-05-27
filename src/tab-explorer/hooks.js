/* eslint-disable no-console */
import {
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  createContext,
  useRef,
} from 'react'
import pipe from 'ramda/es/pipe'
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
import PouchDB from 'pouchdb-browser'

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

const loadCachedState = () => {
  const defaultState = { sessions: {} }
  const decodeCached = pipe(
    getCache,
    defaultTo('{}'),
    JSON.parse,
    mergeDeepRight(defaultState),
  )

  return decodeCached('te-app-state')
}

const useCacheStateEffect = state => {
  return useEffect(
    () => setCache('te-app-state')(JSON.stringify(state, null, 2)),
    [state],
  )
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

function createAndAddSessionFromTabs(otherTabs, setState) {
  const session = sessionFromTabs(otherTabs)
  setState(overProp('sessions')(mergeModel(session)))
}

const overPath = pipe(
  lensPath,
  over,
)

function useActions(setState) {
  const overStateProp = prop => fn => setState(overProp(prop)(fn))
  const overSessions = overStateProp('sessions')

  return useMemo(
    () => ({
      saveSession: otherTabs => {
        createAndAddSessionFromTabs(otherTabs, setState)
      },
      saveSessionAndCloseTabs: async otherTabs => {
        createAndAddSessionFromTabs(otherTabs, setState)
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
        overSessions(omit([id]))
      },
      deleteSessionTab: (sessionId, tab) => {
        overSessions(overPath([sessionId, 'tabs'])(reject(equals(tab))))
      },
      addNewSessionFromTabs: tabs => {
        const session = sessionFromTabs(tabs)
        overSessions(mergeModel(session))
      },
      onOpenTabsClicked: tabs => {
        tabs.forEach(createTab)
      },
      onSessionTogglePinnedClicked: sessionId => {
        overSessions(overPath([sessionId, 'pinned'])(not))
      },
      onSessionToggleCollapsedClicked: sessionId => {
        overSessions(overPath([sessionId, 'collapsed'])(not))
      },
      onCollapseAllSessionsClicked: () => {
        overSessions(map(assoc('collapsed')(true)))
      },
      onExpandAllSessionsClicked: () => {
        overSessions(map(assoc('collapsed')(false)))
      },
    }),
    [setState],
  )
}

function pouchDbPersistAppState(state, db) {
  return db
    .get('root')
    .then(rootDoc => {
      console.log('rootDoc :', rootDoc)
    })
    .catch(() => {
      return db.put({ _id: 'root', state, createdAt: Date.now() })
    })
}

function useCachePouchDBEffect(state) {
  const pdbRef = useRef()
  useEffect(() => {
    const db = new PouchDB('tab-explorer-app-state')
    pdbRef.current = db
    return () => {
      db.close()
      pdbRef.current = null
    }
  }, [])

  useEffect(() => {
    const db = pdbRef.current
    if (!db) return
    pouchDbPersistAppState(state, db)
  }, [state, pdbRef.current])
}

export function useAppState() {
  const [state, setState] = useState(loadCachedState)
  useCacheStateEffect(state)
  const actions = useActions(setState)
  useCachePouchDBEffect(state, actions)
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
