import React, { Component, useEffect, useState, useCallback } from 'react'
import { render } from 'react-dom'
import 'tachyons'
import './main.css'
import mergeDeepLeft from 'ramda/es/mergeDeepLeft'
import { resolve } from 'path'
import mergeLeft from 'ramda/es/mergeLeft'
import compose from 'ramda/es/compose'
import pipe from 'ramda/es/pipe'

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

const useListener = (event, listener, deps) => {
  const callback = useCallback(listener, deps)
  useEffect(() => {
    event.addListener(callback)
    return () => event.removeListener(callback)
  }, deps)
}

const App = () => {
  const [state, setState] = useState(() => ({ tabId: -1, tabs: [] }))

  const mergeState = useCallback(
    pipe(
      mergeLeft,
      setState,
    ),
    [setState],
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
    <div>
      <div>HW</div>
    </div>
  )
}

render(<App />, document.getElementById('root'))
