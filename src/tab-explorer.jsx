import React, { Component, useEffect, useState } from 'react'
import { render } from 'react-dom'
import 'tachyons'
import './main.css'
import mergeDeepLeft from 'ramda/es/mergeDeepLeft'

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

const App = () => {
  const [state, setState] = useState(() => ({ tabId: -1, tabs: [] }))

  useEffect(() => {
    chrome.windows.getCurrent({ populate: true }, w => {
      console.log('current window', w.id, w)
      chrome.tabs.getCurrent(t => {
        setState(mergeDeepLeft({ tabId: t.id, tabs: w.tabs }))
        console.log('current tab', t.id, t)
      })
    })
  }, [setState])

  useEffect(() => {
    const currTabId = state.tabId
    console.log('eff called')

    if (currTabId === -1) return

    console.log('eff registering listener')

    const activatedListener = ({ tabId }) => {
      // if (currTabId !== tabId) return
      chrome.windows.getCurrent({ populate: true }, w => {
        setState(mergeDeepLeft({ tabId: currTabId, tabs: w.tabs }))
      })
    }
    chrome.tabs.onActivated.addListener(activatedListener)

    return () => {
      chrome.tabs.onActivated.removeListener(activatedListener)
    }
  }, [state.tabId, setState])

  return (
    <div>
      <div>HW</div>
    </div>
  )
}

render(<App />, document.getElementById('root'))
