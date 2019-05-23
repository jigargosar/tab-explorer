import React, {
  Component,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react'
import { render } from 'react-dom'
import 'tachyons'
import './main.css'
import mergeDeepLeft from 'ramda/es/mergeDeepLeft'
import mergeLeft from 'ramda/es/mergeLeft'
import compose from 'ramda/es/compose'
import pipe from 'ramda/es/pipe'
import map from 'ramda/es/map'
import over from 'ramda/es/over'
import lensProp from 'ramda/es/lensProp'
import nanoid from 'nanoid'
import prop from 'ramda/es/prop'
import propEq from 'ramda/es/propEq'
import reject from 'ramda/es/reject'
import startsWith from 'ramda/es/startsWith'
import propSatisfies from 'ramda/es/propSatisfies'
import values from 'ramda/es/values'
import sortWith from 'ramda/es/sortWith'
import descend from 'ramda/es/descend'
import tap from 'ramda/es/tap'
import mergeDeepRight from 'ramda/es/mergeDeepRight'
import defaultTo from 'ramda/es/defaultTo'

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

const pageUrl = chrome.runtime.getURL('tab-explorer.html')
const defaultFavIconUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAARklEQVR4Xu3M0QkAIAzE0M7pNN1cBwhFDkUFL/l/8VatF6cAiASBEs0VIEFoQAQIFQChAiBUAIQC8JMA+wUwYMDA/O3A/QbXNAnXAnMZWQAAAABJRU5ErkJggg=='

console.log('pageUrl', pageUrl)

const getPopulatedWindow = () =>
  new Promise(resolve =>
    chrome.windows.getCurrent({ populate: true }, resolve),
  )

const getCurrentTab = () =>
  new Promise(resolve => chrome.tabs.getCurrent(resolve))

const getCurrentTabAndWindow = async () => {
  const [win, tab] = await Promise.all([
    getPopulatedWindow(),
    getCurrentTab(),
  ])
  return { win, tab }
}

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

const useCurrentTabId = () => {
  const [id, setId] = useState(-1)

  useEffect(() => {
    getCurrentTab().then(t => setId(t.id))
  }, [])

  return id
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

const useCacheState = state =>
  useEffect(
    () => setCache('te-app-state', JSON.stringify(state, null, 2)),
    [state],
  )

const App = () => {
  const [state, setState] = useState(loadCachedState)

  const sessionTabs = useSessionTabs()
  const sessionList = compose(
    sortWith([descend(prop('createdAt'))]),
    values,
  )(state.sessions)

  const saveSession = useSaveSessionCallback(setState)

  useCacheState(state)

  useEffect(() => console.log('state changed', state), [state])

  return (
    <div className="pa2">
      <div className="pa3 f3">Tab Explorer</div>
      <div className="pa1">
        <button className="ph2" onClick={() => saveSession(sessionTabs)}>
          Save Session
        </button>
        {/* <button className="ph2" />
        <button className="ph2" /> */}
      </div>
      <div>{map(renderTabItem)(sessionTabs)}</div>
      <div className="pa3 f3">Saved Sessions</div>
      <div>{map(renderSavedSession)(sessionList)}</div>
    </div>
  )
}

render(<App />, document.getElementById('root'))

function useSessionTabs() {
  const windowTabs = useCurrentWindowTabs()
  return reject(propSatisfies(startsWith(pageUrl))('url'))(windowTabs)
}

function useSaveSessionCallback(setState) {
  return useCallback(
    async otherTabs => {
      const session = {
        id: 'S_' + nanoid(),
        createdAt: Date.now(),
        tabs: otherTabs,
      }
      console.log('session :', session)
      setState(s =>
        compose(
          tap(console.log),
          over(lensProp('sessions'))(mergeLeft({ [session.id]: session })),
          tap(console.log),
        )(s),
      )
      // await closeTabs(otherTabs.map(prop('id')))
    },
    [setState],
  )
}

function renderTabItem(t) {
  return (
    <div className="flex items-center pa2" key={t.id}>
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

function renderSavedSession(session) {
  return (
    <div className="pa3" key={session.id}>
      <div className="pa3">TS: {session.createdAt}</div>
      {map(renderTabItem)(session.tabs)}
    </div>
  )
}
