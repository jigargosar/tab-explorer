/* eslint-disable no-console */
import {
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  createContext,
} from 'react'
import nanoid from 'nanoid'
import prop from 'ramda/es/prop'
import reject from 'ramda/es/reject'
import startsWith from 'ramda/es/startsWith'
import propSatisfies from 'ramda/es/propSatisfies'
import mergeDeepRight from 'ramda/es/mergeDeepRight'
import defaultTo from 'ramda/es/defaultTo'
import equals from 'ramda/es/equals'
import { getCache, setCache, mergeModel } from './basics'
import not from 'ramda/es/not'
import map from 'ramda/es/map'
import { pipe, mapProp } from './safe-basics'
import pick from 'ramda/es/pick'
import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/firestore'
import { useAuthState } from 'react-firebase-hooks/auth'
import T from 'ramda/es/T'
import F from 'ramda/es/F'
import mergeLeft from 'ramda/es/mergeLeft'

// CHROME API

const pageUrl = chrome.runtime.getURL('tab-explorer.html')
console.log('pageUrl', pageUrl)

const getPopulatedWindow = () => {
  return new Promise(resolve =>
    chrome.windows.getCurrent({ populate: true }, resolve),
  )
}

const closeTabs = tabIds => {
  return new Promise(resolve => chrome.tabs.remove(tabIds, resolve))
}

const createTab = tab => {
  return new Promise(resolve =>
    chrome.tabs.create({ url: tab.url, active: false }, resolve),
  )
}

// HOOKS & MODEL

const useChromeEventListener = (event, listener, deps) => {
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

  // useEffect(() => console.log('current window tabs changed', tabs), [tabs])

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
    useChromeEventListener(e, updateCurrentTabs, [updateCurrentTabs]),
  )

  return tabs
}

function decodeSessionFromCache(session) {
  const fn = pipe(
    //
    mapProp('modifiedAt')(defaultTo(session.createdAt)),
  )
  return fn(session)
}

const loadCachedState = () => {
  const defaultState = { sessions: {} }
  const stateProps = Object.keys(defaultState)
  const decodeCached = pipe(
    getCache,
    defaultTo('{}'),
    JSON.parse,
    pick(stateProps),
    mergeDeepRight(defaultState),
    mapProp('sessions')(map(decodeSessionFromCache)),
  )

  return decodeCached('te-app-state')
}

function encodeState(state) {
  const fn = pipe(state => JSON.stringify(state, null, 2))
  return fn(state)
}

const useCacheStateEffect = state => {
  return useEffect(() => setCache('te-app-state')(encodeState(state)), [
    state,
  ])
}

function sessionFromTabs(tabs) {
  const now = Date.now()
  const session = {
    id: 'S_' + nanoid(),
    createdAt: now,
    modifiedAt: now,
    tabs: tabs,
  }
  console.log('session :', session)
  return session
}

function useActions(setState) {
  return useMemo(() => {
    const setStateProp = prop => fn => setState(mapProp(prop)(fn))
    const setSessions = setStateProp('sessions')
    const updateSessionWithId = sid => fn =>
      setSessions(sessions => {
        return mapProp(sid)(oldS => {
          const newS = fn(oldS)
          return equals(newS)(oldS)
            ? oldS
            : { ...newS, modifiedAt: Date.now() }
        })(sessions)
      })

    function createAndAddSessionFromTabs(tabs) {
      const session = sessionFromTabs(tabs)
      setSessions(mergeModel(session))
    }

    return {
      signIn: () => {
        const auth = firebase.auth()
        const ap = new firebase.auth.GoogleAuthProvider()
        ap.setCustomParameters({ prompt: 'select_account' })
        auth.signInWithPopup(ap)
      },
      signOut: () => {
        firebase.auth().signOut()
      },
      updateSessionsIfNewer: sessionList => {
        setSessions(sessionMap => {
          const updatedSessionMap = sessionList
            .filter(updatedSession => {
              const existingSession = sessionMap[updatedSession.id]
              return (
                !existingSession ||
                existingSession.modifiedAt < updatedSession.modifiedAt
              )
            })
            .reduce((acc, session) => mergeModel(session)(acc), {})
          return mergeLeft(updatedSessionMap)(sessionMap)
        })
      },
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
      deleteSessionWithId: sessionId => {
        updateSessionWithId(sessionId)(mapProp('deleted')(T))
      },
      deleteSessionTab: (sessionId, tab) => {
        updateSessionWithId(sessionId)(
          mapProp('tabs')(reject(equals(tab))),
        )
      },
      onOpenTabsClicked: tabs => {
        tabs.forEach(createTab)
      },
      onSessionTogglePinnedClicked: sessionId => {
        updateSessionWithId(sessionId)(mapProp('pinned')(not))
      },
      onSessionToggleCollapsedClicked: sessionId => {
        updateSessionWithId(sessionId)(mapProp('collapsed')(not))
      },
      onCollapseAllSessionsClicked: () => {
        setSessions(map(mapProp('collapsed')(T)))
      },
      onExpandAllSessionsClicked: () => {
        setSessions(map(mapProp('collapsed')(F)))
      },
    }
  }, [setState])
}

const firebaseConfig = {
  apiKey: 'AIzaSyBVS1Tx23pScQz9w4ZDTGh307mqkCRy2Bw',
  authDomain: 'not-now-142808.firebaseapp.com',
  databaseURL: 'https://not-now-142808.firebaseio.com',
  projectId: 'not-now-142808',
  storageBucket: 'not-now-142808.appspot.com',
  messagingSenderId: '476064436883',
  appId: '1:476064436883:web:ebbcbed81661398e',
}

firebase.initializeApp(firebaseConfig)

export function useAuth() {
  return useAuthState(firebase.auth())
}

export function useAppState() {
  const [state, setState] = useState(loadCachedState)
  useCacheStateEffect(state)
  const actions = useActions(setState)
  // useCachePouchDBEffect(state, actions)
  useEffect(() => console.log('state changed', state), [state])

  const [user] = useAuth()

  useEffect(() => {
    if (!user) return
    const scRef = getSessionsCRef(user)
    const disposer = scRef.onSnapshot(qs => {
      console.log('Fire Sessions Changed', qs.docs.length, qs)
      actions.updateSessionsIfNewer(qs.docs.map(ds => ds.data()))
    }, console.error)
    return disposer
  }, [user])

  useEffect(() => {
    if (!user) return
    const sref = getSessionsCRef(user)
    firebase
      .firestore()
      .runTransaction(async t => {
        const sessionMap = state.sessions
        const dps = Object.values(sessionMap).map(s => {
          return t.get(sref.doc(s.id))
        })

        const docSnaps = await Promise.all(dps)
        docSnaps.forEach(ds => {
          return ds.exists
            ? t.update(ds.ref, sessionMap[ds.id])
            : t.set(ds.ref, sessionMap[ds.id])
        })
      })
      .then(() =>
        console.log('fire: write all docs transaction success. '),
      )
      .catch(console.error)
  }, [user, state.sessions])

  return [state, actions]
}

const ActionsContext = createContext()

export const AppActionsProvider = ActionsContext.Provider

function getSessionsCRef(user) {
  const db = firebase.firestore()
  const sref = db.collection(`users/${user.uid}/tab-ex-sessions`)
  return sref
}

export function useAppActions() {
  return useContext(ActionsContext)
}

export function useOpenTabsList() {
  const windowTabs = useCurrentWindowTabs()
  return reject(propSatisfies(startsWith(pageUrl))('url'))(windowTabs)
}
