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

import pluck from 'ramda/es/pluck'
import { SessionStore } from './session-store'
import { closeTabs, createTab, activateTabWithId } from './chrome-effects'
import { signIn, signOut, useFireSyncSessions } from './fire'
export { useAuth as useAuthState } from './fire'
export { useFilteredOpenTabsList as useOpenTabs } from './chrome-effects'

const appStateKey = 'te-app-state'
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

  return fn(appStateKey)
}

function encodeState(state) {
  const fn = pipe(
    //
    state => JSON.stringify(state, null, 2),
  )
  return fn(state)
}

const useSyncStateCacheEffect = (actions, state) => {
  useEffect(() => {
    const encoded = encodeState(state)
    setCache(appStateKey)(encoded)
  }, [state])

  useEffect(() => {
    window.addEventListener('storage', e => {
      if (e.key !== appStateKey) return
      // When local storage changes, dump the list to
      // the console.
      console.log('app state changed in another tab storage event e :', e)
      // actions.replaceNewerSessions(loadCachedState().sessions)
      // console.log(JSON.parse(localStorage.getItem(appStateKey)))
    })
  }, [])
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
        signIn()
      },
      signOut: () => {
        signOut()
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
        activateTabWithId(tab.id)
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

export function useAppState() {
  const [state, setState] = useState(loadCachedState)
  const actions = useActions(setState)
  useSyncStateCacheEffect(actions, state)
  useEffect(() => console.log('state changed', state), [state])

  useFireSyncSessions(actions, state.sessions)

  return [state, actions]
}

const ActionsContext = createContext()

export const AppActionsProvider = ActionsContext.Provider

export function useAppActions() {
  return useContext(ActionsContext)
}
