/* eslint-disable no-console */
import React, { Fragment } from 'react'
import { render } from 'react-dom'
import 'tachyons'
import './main.css'
import compose from 'ramda/es/compose'
import map from 'ramda/es/map'
import prop from 'ramda/es/prop'
import values from 'ramda/es/values'
import sortWith from 'ramda/es/sortWith'
import descend from 'ramda/es/descend'

import {
  useAppActions,
  useAppState,
  useOpenTabsList,
  AppActionsProvider,
} from './tab-explorer/hooks'
import intersperse from 'ramda/es/intersperse'

console.log('tab-explorer.js loaded')

// VIEW

const defaultFavIconUrl =
  //#region
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAARklEQVR4Xu3M0QkAIAzE0M7pNN1cBwhFDkUFL/l/8VatF6cAiASBEs0VIEFoQAQIFQChAiBUAIQC8JMA+wUwYMDA/O3A/QbXNAnXAnMZWQAAAABJRU5ErkJggg=='
//#endregion

const App = () => {
  const [state, actions] = useAppState()

  const displaySessions = compose(
    sortWith([descend(prop('createdAt'))]),
    values,
  )(state.sessions)

  const renderSessionItem = session => {
    return <SessionListItem key={session.id} {...{ session }} />
  }

  return (
    <AppActionsProvider value={actions}>
      <div className="pa3">
        <div className="lh-copy f3">Tab Explorer</div>
        <div className="pv1" />
        <OpenTabs />
        <div className="pv2" />
        <div className="pv1 ttu tracked b">Collections</div>
        <div className="pv1" />
        <div>{map(renderSessionItem)(displaySessions)}</div>
      </div>
    </AppActionsProvider>
  )
}

function OpenTabs() {
  const actions = useAppActions()
  const tabs = useOpenTabsList()

  const viewBtn = (label, onClick) => (
    <button className="" onClick={onClick}>
      {label}
    </button>
  )
  const viewToolbar = (
    <div className="pv1 flex items-center">
      <div className="ph2">Open Tabs</div>
      <div className="ph1" />
      {viewBtn('Save Session', () => actions.saveSession(tabs))}
      <div className="ph1" />
      {viewBtn('Save And Close Session', () =>
        actions.saveSessionAndCloseTabs(tabs),
      )}
    </div>
  )

  function TabListItem({ tab }) {
    return (
      <div
        className="pv1 pointer flex items-center "
        onClick={() => actions.onOpenTabsListItemClicked(tab)}
      >
        <div className="ph1" />
        <img
          className=""
          src={tab.favIconUrl || defaultFavIconUrl}
          width={24}
          height={24}
        />
        <div className="ph1" />
        <div>{tab.title}</div>
      </div>
    )
  }

  const viewTabItem = tab => <TabListItem key={tab.id} tab={tab} />
  const viewTabList = <div className="pv1">{map(viewTabItem)(tabs)}</div>
  return (
    <div className="">
      {viewToolbar}
      {viewTabList}
    </div>
  )
}

function SessionListItem({ session }) {
  const actions = useAppActions()
  const renderTabItem = tab => (
    <SessionTabItem key={tab.id} tab={tab} sessionId={session.id} />
  )

  function renderSessionItemToolbar() {
    const btn = (label, onClick) => (
      <button className="ttu f7" onClick={onClick}>
        {label}
      </button>
    )
    const btnList = [
      btn('Delete', () => actions.deleteSessionWithId(session.id)),
      btn(`Open ${session.tabs.length} tabs`, () =>
        actions.onOpenTabsClicked(session.tabs),
      ),
      btn(session.pinned ? 'Unpin' : 'Pin', () =>
        actions.onSessionTogglePinnedClicked(session.id),
      ),
    ]
    const toolBarItems = intersperse(<div className="ph1" />)(btnList)

    const toolbar = toolBarItems.map((el, idx) =>
      React.cloneElement(el, { ...el.props, key: idx }),
    )
    return (
      <div className="pv1 flex items-center">
        <div className="pv1 b">TS: {session.createdAt}</div>
        <div className="ph1" />
        {toolbar}
      </div>
    )
  }

  return (
    <div className="pv2">
      {renderSessionItemToolbar()}
      {map(renderTabItem)(session.tabs)}
    </div>
  )
}

function SessionTabItem({ sessionId, tab }) {
  const actions = useAppActions()
  return (
    <div className="lh-copy flex ">
      <button
        className="self-center ttu f7"
        onClick={() => actions.deleteSessionTab(sessionId, tab)}
      >
        X
      </button>
      <div className="mh1" />
      <div className="pa1 flex items-center">
        <img
          src={tab.favIconUrl || defaultFavIconUrl}
          width={24}
          height={24}
        />
      </div>
      <div
        className=" ph1 flex-auto pointer flex items-center hover-blue black"
        onClick={() => actions.onSessionTabsListItemClicked(tab)}
      >
        {tab.title}
      </div>
    </div>
  )
}

// MAIN

//#region ALT IMP

// const Cmd = {
//   batch: (...l) => l,
//   none: [],
// }

// function useStateRef(init) {
//   const [state, setState] = useState(init)

//   const stateRef = useRef(state)

//   const setStateRef = useCallback(
//     stateOrFn => {
//       stateRef.current = is(Function)(stateOrFn)
//         ? stateOrFn(stateRef.current)
//         : stateOrFn

//       setState(stateRef.current)
//     },
//     [setState, stateRef],
//   )

//   return [stateRef, setStateRef]
// }

// function App({ flags, init, update, view }) {
//   const [initialModel, initialCmd] = useMemo(() => init(flags), [])

//   function runCmd(cmd) {
//     console.log('cmd', cmd)
//   }

//   useEffect(() => {
//     console.log('initialModel', initialModel)
//     runCmd(initialCmd)
//   }, [initialModel, initialCmd])

//   const [modelRef, setModel] = useStateRef(initialModel)

//   function send(kind, args) {
//     const msg = { kind, args }
//     const [model, cmd] = update(msg, modelRef.current)
//     setModel(model)
//     runCmd(cmd)
//   }

//   return view(modelRef.current, send)
// }

// function init(/* flags */) {
//   return [{ type: 'LOADING' }, Cmd.none]
// }

// function update(msg, model) {
//   if (msg.kind === 'CycleState') {
//     const nextTypeMap = {
//       LOADING: 'SUCCESS',
//       SUCCESS: 'REFRESHING',
//       REFRESHING: 'LOADING',
//     }
//     return [assoc('type')(nextTypeMap[model.type])(model), Cmd.none]
//   } else {
//     return [model, Cmd.none]
//   }
// }

// function view(model, send) {
//   return (
//     <div>
//       <div>HW</div>
//       <div onClick={() => send('CycleState')}>
//         {JSON.stringify(model.type)}
//       </div>
//     </div>
//   )
// }

// render(
//   <App flags={{}} init={init} update={update} view={view} />,
//   document.getElementById('root'),
// )

//#endregion

render(<App />, document.getElementById('root1'))
