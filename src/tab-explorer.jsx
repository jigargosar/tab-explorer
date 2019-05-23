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

const App = () => {
  const [state, setState] = useState(() => ({
    sessions: {},
  }))

  const sessionTabs = useSessionTabs()

  const mergeState = useCallback(
    pipe(
      mergeLeft,
      setState,
    ),
    [setState],
  )

  const saveSession = useSaveSessionCallback(mergeState)

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
    </div>
  )
}

render(<App />, document.getElementById('root'))

function useSessionTabs() {
  const windowTabs = useCurrentWindowTabs()
  return reject(propSatisfies(startsWith(pageUrl))('url'))(windowTabs)
}

function useSaveSessionCallback(mergeState) {
  return useCallback(
    async otherTabs => {
      const session = {
        id: 'S_' + nanoid(),
        createdAt: Date.now(),
        tabs: otherTabs,
      }
      mergeState(
        over(lensProp('sessions'))(mergeLeft({ [session.id]: session })),
      )
      await closeTabs(otherTabs.map(prop('id')))
    },
    [mergeState],
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
