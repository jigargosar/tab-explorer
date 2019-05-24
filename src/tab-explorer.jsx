/* eslint-disable no-console */
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { render } from 'react-dom'
import 'tachyons'
import './main.css'
import mergeLeft from 'ramda/es/mergeLeft'
import compose from 'ramda/es/compose'
import pipe from 'ramda/es/pipe'
import map from 'ramda/es/map'
import over from 'ramda/es/over'
import lensProp from 'ramda/es/lensProp'
import nanoid from 'nanoid'
import prop from 'ramda/es/prop'
import reject from 'ramda/es/reject'
import startsWith from 'ramda/es/startsWith'
import propSatisfies from 'ramda/es/propSatisfies'
import values from 'ramda/es/values'
import sortWith from 'ramda/es/sortWith'
import descend from 'ramda/es/descend'
import mergeDeepRight from 'ramda/es/mergeDeepRight'
import defaultTo from 'ramda/es/defaultTo'
import identity from 'ramda/es/identity'
import omit from 'ramda/es/omit'

console.log('tab-explorer.js loaded')

// chrome.runtime.sendMessage('whoami', res => {
//   console.log('whoami response :', res)
//   const selfTabId = res.tab.id
//   chrome.tabs.onActivated.addListener(info => {
//     if (info.tabId === selfTabId) {
//       console.log('current tab activated :', info)
//     }
//   })
// })

// function logCurrent() {
//   chrome.windows.getCurrent({ populate: true }, w =>
//     console.log('current window', w.id, w),
//   )
//   chrome.tabs.getCurrent(t => console.log('current tab', t.id, t))
// }

// logCurrent()

// HELPERS
const overProp = pipe(
  lensProp,
  over,
)
const mergeModel = m => mergeLeft({ [m.id]: m })

const pageUrl = chrome.runtime.getURL('tab-explorer.html')
const defaultFavIconUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAARklEQVR4Xu3M0QkAIAzE0M7pNN1cBwhFDkUFL/l/8VatF6cAiASBEs0VIEFoQAQIFQChAiBUAIQC8JMA+wUwYMDA/O3A/QbXNAnXAnMZWQAAAABJRU5ErkJggg=='

console.log('pageUrl', pageUrl)

const getPopulatedWindow = () =>
  new Promise(resolve =>
    chrome.windows.getCurrent({ populate: true }, resolve),
  )

// const getCurrentTab = () =>
//   new Promise(resolve => chrome.tabs.getCurrent(resolve))

const closeTabs = tabIds =>
  new Promise(resolve => chrome.tabs.remove(tabIds, resolve))

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

const getCache = key => localStorage.getItem(key)
const setCache = key => value => localStorage.setItem(key, value)

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

const useCacheStateEffect = state =>
  useEffect(
    () => setCache('te-app-state')(JSON.stringify(state, null, 2)),
    [state],
  )

// HOOKS
function useCurrentSessionTabs() {
  const windowTabs = useCurrentWindowTabs()
  return reject(propSatisfies(startsWith(pageUrl))('url'))(windowTabs)
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

function useSaveSessionCallback(setState) {
  return useCallback(
    async otherTabs => {
      createAndAddSessionFromTabs(otherTabs, setState)
    },
    [setState],
  )
}

function useSaveAndCloseSessionCallback(setState) {
  return useCallback(
    async otherTabs => {
      createAndAddSessionFromTabs(otherTabs, setState)
      await closeTabs(otherTabs.map(prop('id')))
    },
    [setState],
  )
}

function usePureActions(setState) {
  const overStateProp = prop => fn => setState(overProp(prop)(fn))
  const overSessions = overStateProp('sessions')

  return useMemo(
    () => ({
      deleteSessionWithId: id => {
        overSessions(omit([id]))
      },
      addNewSessionFromTabs: tabs => {
        const session = sessionFromTabs(tabs)
        overSessions(mergeModel(session))
      },
    }),
    [setState],
  )
}

// VIEW

const App = () => {
  const [state, setState] = useState(loadCachedState)

  const currentSessionTabs = useCurrentSessionTabs()

  const displaySessions = compose(
    sortWith([descend(prop('createdAt'))]),
    values,
  )(state.sessions)

  const saveSession = useSaveSessionCallback(setState)
  const saveAndCloseSession = useSaveAndCloseSessionCallback(setState)
  const act = usePureActions(setState)

  useCacheStateEffect(state)

  useEffect(() => console.log('state changed', state), [state])

  const onTabItemClicked = useCallback(tab => {
    chrome.tabs.update(tab.id, { active: true }, updatedTab =>
      console.log('tab updated', updatedTab),
    )
  })

  return (
    <div className="pa2">
      <div className="pa3 f3">Tab Explorer</div>
      <div className="pa1">
        <button
          className="ma2"
          onClick={() => saveSession(currentSessionTabs)}
        >
          Save Session
        </button>
        <button
          className="ma2"
          onClick={() => saveAndCloseSession(currentSessionTabs)}
        >
          Save And Close Session
        </button>
        {/* <button className="ph2" /> */}
      </div>
      <div>{map(renderTabItem(onTabItemClicked))(currentSessionTabs)}</div>
      <div className="pa4" />
      <div className="ph3 f3">Saved Sessions</div>
      {/* <div className="pa3" /> */}
      <div>{map(renderSavedSession(act))(displaySessions)}</div>
    </div>
  )
}

const renderTabItem = onTabItemClicked => t => {
  return (
    <div
      className="pa2 pointer flex items-center "
      key={t.id}
      onClick={() => onTabItemClicked(t)}
    >
      <img
        className="pr3"
        src={t.favIconUrl || defaultFavIconUrl}
        alt="F"
        width={24}
        height={24}
      />
      <div>{t.title}</div>
    </div>
  )
}

const renderSavedSession = act => session => (
  <div className="pa3" key={session.id}>
    <div className="pa3">TS: {session.createdAt}</div>
    <div>
      <button onClick={() => act.deleteSessionWithId(session.id)}>
        Delete
      </button>
    </div>
    {map(renderTabItem(identity))(session.tabs)}
  </div>
)

// MAIN

render(<App />, document.getElementById('root'))
