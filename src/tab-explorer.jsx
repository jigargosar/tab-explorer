import React, { Component } from 'react'
import { render } from 'react-dom'
import 'tachyons'
import './main.css'

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

function logCurrent() {
  chrome.windows.getCurrent({ populate: true }, w =>
    console.log('current window', w.id, w),
  )
  chrome.tabs.getCurrent(t => console.log('current tab', t.id, t))
}

logCurrent()

const App = () => (
  <div>
    <div>HW</div>
  </div>
)

render(<App />, document.getElementById('root'))
