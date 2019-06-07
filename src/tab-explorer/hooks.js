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
import equals from 'ramda/es/equals'
import isNil from 'ramda/es/isNil'
import mergeLeft from 'ramda/es/mergeLeft'
import { usePrevious } from './use-prev-hook'
export { useAuth as useAuthState } from './fire'
export { useFilteredOpenTabsList as useOpenTabs } from './chrome-effects'

const defaultState = { sessions: {} }
const stateProps = Object.keys(defaultState)

const appStateKey = 'te-app-state'
const loadCachedState = () => {
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
    pick(stateProps),
    state => JSON.stringify(state, null, 2),
  )
  return fn(state)
}

const useSyncStateCacheEffect = (actions, state) => {
  const prevState = usePrevious(state)

  useEffect(() => {
    if (isNil(prevState)) return
    if (equals(state, prevState)) return

    console.log('Caching state on change', state)
    const encoded = encodeState(state)
    setCache(appStateKey)(encoded)
  }, [state, prevState])

  useLoadStateCacheChangesFromOtherTabsEffect(actions)
}

function useLoadStateCacheChangesFromOtherTabsEffect(actions) {
  useEffect(() => {
    window.addEventListener('storage', e => {
      if (e.key !== appStateKey) return
      // When local storage changes, dump the list to
      // the console.
      console.log('app state changed in another tab storage event e :', e)
      // actions.replaceNewerSessions(loadCachedState().sessions)
      // console.log(JSON.parse(localStorage.getItem(appStateKey)))
      const sessionStore = loadCachedState().sessions
      actions.updateSessionStoreChangesFromAnotherTab(sessionStore)
    })
  }, [actions])
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
      updateSessionStoreChangesFromAnotherTab: otherTabSessionStore => {
        setSessions(
          SessionStore.updateChangesFromAnotherTab(otherTabSessionStore),
        )
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
  // useEffect(() => console.log('state object changed', state), [state])

  useFireSyncSessions(actions, state.sessions)

  useFakeStateUpdateEffect(setState)

  return [state, actions]
}

const ActionsContext = createContext()

export const AppActionsProvider = ActionsContext.Provider

function useFakeStateUpdateEffect(setState) {
  useEffect(() => {
    const intervalId = setInterval(() => setState(mergeLeft({})), 1000)
    return () => clearInterval(intervalId)
  }, [setState])
}

export function useAppActions() {
  return useContext(ActionsContext)
}
