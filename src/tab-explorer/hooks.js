/* eslint-disable no-console */
import {
  useContext,
  useState,
  useEffect,
  useMemo,
  createContext,
} from 'react'
import mergeDeepRight from 'ramda/es/mergeDeepRight'
import defaultTo from 'ramda/es/defaultTo'
import { getCache, setCache } from './basics'
import { pipe, mapProp } from './safe-basics'
import pick from 'ramda/es/pick'
import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/firestore'
import { useAuthState } from 'react-firebase-hooks/auth'
import pluck from 'ramda/es/pluck'
import { SessionStore } from './sessions'
import {
  closeTabs,
  createTab,
  useCurrentWindowTabs,
} from './chrome-effects'

import reject from 'ramda/es/reject'
import propSatisfies from 'ramda/es/propSatisfies'
import startsWith from 'ramda/es/startsWith'

export function useOpenTabsList() {
  const pageUrl = chrome.runtime.getURL('tab-explorer.html')
  const windowTabs = useCurrentWindowTabs()
  return reject(propSatisfies(startsWith(pageUrl))('url'))(windowTabs)
}

const loadCachedState = () => {
  const defaultState = { sessions: {} }
  const stateProps = Object.keys(defaultState)
  const fn = pipe(
    getCache,
    defaultTo('{}'),
    JSON.parse,
    pick(stateProps),
    mergeDeepRight(defaultState),
    mapProp('sessions')(SessionStore.decode),
  )

  return fn('te-app-state')
}

function encodeState(state) {
  const fn = pipe(
    //
    state => JSON.stringify(state, null, 2),
  )
  return fn(state)
}

const useCacheStateEffect = state => {
  return useEffect(() => {
    const encoded = encodeState(state)
    setCache('te-app-state')(encoded)
  }, [state])
}

function useActions(setState) {
  return useMemo(() => {
    const setStateProp = prop => fn => setState(mapProp(prop)(fn))
    const setSessions = setStateProp('sessions')

    function createAndAddSessionFromTabs(tabs) {
      setSessions(SessionStore.addNewFromTabs(tabs))
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
        setSessions(SessionStore.replaceNewerSessions(sessionList))
      },
      saveSession: otherTabs => {
        createAndAddSessionFromTabs(otherTabs)
      },
      saveSessionAndCloseTabs: async otherTabs => {
        createAndAddSessionFromTabs(otherTabs)
        const ids = pluck('id')(otherTabs)
        await closeTabs(ids)
      },
      onOpenTabsListItemClicked: tab => {
        chrome.tabs.update(tab.id, { active: true }, updatedTab =>
          console.log('tab updated', updatedTab),
        )
      },
      onSessionTabsListItemClicked: tab => {
        createTab(tab)
      },
      onOpenTabsClicked: tabs => {
        tabs.forEach(createTab)
      },
      deleteSessionWithId: sessionId => {
        setSessions(SessionStore.deleteById(sessionId))
      },
      deleteSessionTab: (sessionId, tab) => {
        setSessions(SessionStore.deleteTabInSessionWithId(sessionId)(tab))
      },
      onSessionTogglePinnedClicked: sessionId => {
        setSessions(SessionStore.togglePinned(sessionId))
      },
      onSessionToggleCollapsedClicked: sessionId => {
        setSessions(SessionStore.toggleCollapsed(sessionId))
      },
      onCollapseAllSessionsClicked: () => {
        setSessions(SessionStore.collapseAll)
      },
      onExpandAllSessionsClicked: () => {
        setSessions(SessionStore.expandAll)
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
      console.log('fire: Sessions Changed', qs.docs.length, qs)
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
