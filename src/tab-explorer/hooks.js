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
import { SessionStore } from './sessions'
import { closeTabs, createTab, activateTabWithId } from './chrome-effects'
import { signIn, signOut, syncSessions as useSyncSessions } from './fire'

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
  useCacheStateEffect(state)
  const actions = useActions(setState)
  // useCachePouchDBEffect(state, actions)
  useEffect(() => console.log('state changed', state), [state])

  useSyncSessions(actions, state.sessions)

  return [state, actions]
}

const ActionsContext = createContext()

export const AppActionsProvider = ActionsContext.Provider

export function useAppActions() {
  return useContext(ActionsContext)
}
