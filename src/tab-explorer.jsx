import React, { Component, useEffect, useState, useCallback } from 'react'
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

const App = () => {
  const [state, setState] = useState(() => ({
    tabId: -1,
    tabs: [],
    sessions: {},
  }))

  const currentTabs = state.tabs.filter(t => t.id !== state.tabId)

  const mergeState = useCallback(
    pipe(
      mergeLeft,
      setState,
    ),
    [setState],
  )

  const saveSession = useCallback(
    async sessionTabs => {
      const session = {
        id: 'S_' + nanoid(),
        createdAt: Date.now(),
        tabs: sessionTabs,
      }

      mergeState(
        over(lensProp('sessions'))(mergeLeft({ [session.id]: session })),
      )
      await closeTabs(sessionTabs.map(prop('id')))
    },
    [mergeState],
  )

  useEffect(() => console.log('state changed', state), [state])

  useEffect(() => {
    getCurrentTabAndWindow().then(({ win, tab }) =>
      mergeState({ tabId: tab.id, tabs: win.tabs }),
    )
  }, [mergeState])

  useListener(
    chrome.tabs.onActivated,
    async ({ tabId }) => {
      const { win, tab } = await getCurrentTabAndWindow()
      if (tabId !== tab.id) return
      mergeState({ tabs: win.tabs })
    },
    [mergeState],
  )

  return (
    <div className="pa2">
      <div className="pa3 f3">Tab Explorer</div>
      <div className="pa1">
        <button className="ph2" onClick={() => saveSession(currentTabs)}>
          Save Session
        </button>
        {/* <button className="ph2" />
        <button className="ph2" /> */}
      </div>
      <div>{map(renderTabItem)(currentTabs)}</div>
    </div>
  )
}

render(<App />, document.getElementById('root'))

function renderTabItem(t) {
  return (
    <div className="pa2" key={t.id}>
      <div>{t.title}</div>
    </div>
  )
}
