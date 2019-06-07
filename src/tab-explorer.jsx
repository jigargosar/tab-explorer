/* eslint-disable no-console */
import React, { useRef } from 'react'
import { render } from 'react-dom'
import 'tachyons'
import './main.css'
import compose from 'ramda/es/compose'
import map from 'ramda/es/map'
import prop from 'ramda/es/prop'
import values from 'ramda/es/values'
import sortWith from 'ramda/es/sortWith'
import descend from 'ramda/es/descend'
import { format } from 'date-fns'
import {
  useAppActions,
  useAppState,
  AppActionsProvider,
  useAuthState,
  useOpenTabs,
} from './tab-explorer/hooks'
import intersperse from 'ramda/es/intersperse'
import propOr from 'ramda/es/propOr'
import pipe from 'ramda/es/pipe'
import addIndex from 'ramda/es/addIndex'

// UI
function TextA(props) {
  return <div className="pv1 ttu tracked b" {...props} />
}

function TBtn(props) {
  return <button className="ttu f7" {...props} />
}

function hspaced(elList) {
  const mapIndexed = addIndex(map)
  const fn = pipe(
    intersperse(<div className="ph1" />),
    mapIndexed((el, idx) =>
      React.cloneElement(el, { ...el.props, key: idx }),
    ),
  )
  return fn(elList)
}

function SpacerH(props) {
  return hspaced(props.children)
}

// FavIcon

const defaultFavIconUrl =
  //#region
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAARklEQVR4Xu3M0QkAIAzE0M7pNN1cBwhFDkUFL/l/8VatF6cAiASBEs0VIEFoQAQIFQChAiBUAIQC8JMA+wUwYMDA/O3A/QbXNAnXAnMZWQAAAABJRU5ErkJggg=='
//#endregion

const Fav = React.memo(function({ url }) {
  const ref = useRef()
  return (
    <img
      ref={ref}
      src={url || defaultFavIconUrl}
      style={{ width: 24, height: 24 }}
      width={24}
      height={24}
      onError={() => (ref.current.src = defaultFavIconUrl)}
    />
  )
})

// AppView

const App = () => {
  const [state, actions] = useAppState()

  const displaySessions = compose(
    sortWith([
      descend(propOr(false)('pinned')),
      descend(prop('createdAt')),
    ]),
    values,
  )(state.sessions)

  return (
    <AppActionsProvider value={actions}>
      <div className="pa3">
        <div>2</div>
        <UserToolbar />
        <div className="lh-copy f3">Tab Explorer</div>
        <div className="pv1" />
        <OpenTabsPanel />
        <div className="pv2" />
        <SessionsPanel actions={actions} sessions={displaySessions} />
      </div>
    </AppActionsProvider>
  )
}

// Auth View

function UserToolbar() {
  const [user, initialising, error] = useAuthState()
  const actions = useAppActions()

  return (
    <div className="flex items-center">
      <SpacerH>
        <div>User: {`${user}`}</div>
        <div>Error: {`${error}`}</div>
        <TBtn
          disabled={initialising}
          onClick={() => (user ? actions.signOut() : actions.signIn())}
        >
          {user ? 'SignOut' : 'SignIn'}
        </TBtn>
      </SpacerH>
    </div>
  )
}

// Current Window Open Tabs View

function OpenTabsPanel() {
  const actions = useAppActions()
  const tabs = useOpenTabs()

  const btn = (label, onClick) => {
    return <TBtn onClick={onClick}>{label}</TBtn>
  }

  const toolbar = (
    <div className="pv1 flex items-center">
      {hspaced([
        <TextA key>Open Tabs</TextA>,
        btn('Save Session', () => actions.saveSession(tabs)),
        btn('Save And Close Session', () =>
          actions.saveSessionAndCloseTabs(tabs),
        ),
      ])}
    </div>
  )

  const viewTabItem = tab => <OpenTabsListItem key={tab.id} tab={tab} />
  const viewTabList = <div className="pv1">{map(viewTabItem)(tabs)}</div>
  return (
    <div className="">
      {toolbar}
      {viewTabList}
    </div>
  )
}

function OpenTabsListItem({ tab }) {
  const actions = useAppActions()

  return (
    <div
      className="pv1 pointer flex items-center "
      onClick={() => actions.onOpenTabsListItemClicked(tab)}
    >
      <div className="ph1" />
      <Fav url={tab.favIconUrl} />
      <div className="ph1" />
      <div>{tab.title}</div>
    </div>
  )
}

// Session/Collection View

function SessionsPanel({ actions, sessions }) {
  const renderSessionItem = session => {
    return <SessionListItem key={session.id} {...{ session }} />
  }
  return (
    <>
      <div className="flex items-center">
        <SpacerH>
          <TextA>Collections</TextA>
          <TBtn onClick={() => actions.onCollapseAllSessionsClicked()}>
            Collapse All
          </TBtn>
          <TBtn onClick={() => actions.onExpandAllSessionsClicked()}>
            Expand All
          </TBtn>
        </SpacerH>
      </div>
      <div className="pv1" />
      <div>{map(renderSessionItem)(sessions)}</div>
    </>
  )
}

function SessionListItem({ session }) {
  const actions = useAppActions()
  const renderTabItem = tab => (
    <SessionTabItem key={tab.id} tab={tab} sessionId={session.id} />
  )

  function renderSessionItemToolbar() {
    const btn = (label, onClick) => {
      return <TBtn onClick={onClick}>{label}</TBtn>
    }
    return (
      <div className="pv1 flex items-center">
        {hspaced([
          <div key className="lh-copy ">
            {format(session.createdAt, 'Do MMM hh:mma')}
          </div>,
          btn('Delete', () => actions.deleteSessionWithId(session.id)),
          btn(`Open ${session.tabs.length} tabs`, () =>
            actions.onOpenTabsClicked(session.tabs),
          ),
          btn(session.pinned ? 'Unpin' : 'Pin', () =>
            actions.onSessionTogglePinnedClicked(session.id),
          ),
          btn(session.collapsed ? 'Expand' : 'Collapse', () =>
            actions.onSessionToggleCollapsedClicked(session.id),
          ),
        ])}
      </div>
    )
  }

  return (
    <div className="pv2">
      {renderSessionItemToolbar()}
      {!session.collapsed && map(renderTabItem)(session.tabs)}
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
        <Fav url={tab.favIconUrl} />
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

render(<App />, document.getElementById('root1'))
