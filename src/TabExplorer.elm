port module TabExplorer exposing (main)

import Browser
import Compare
import Html exposing (..)
import Html.Attributes exposing (class)
import Html.Events exposing (onClick)
import Json.Decode as JD exposing (Decoder)
import Json.Encode as JE exposing (Value)



-- PORTS


port onCurrentWindowTabsChanged : (JE.Value -> msg) -> Sub msg


port createTab : { url : String, active : Bool } -> Cmd msg


port updateTab : ( Int, { active : Bool } ) -> Cmd msg



-- TAB MODEL


type alias Tab =
    { id : Int
    , title : String
    , url : String
    , favIconUrl : Maybe String
    }


tabDecoder : Decoder Tab
tabDecoder =
    JD.map4 Tab
        (JD.field "id" JD.int)
        (JD.field "title" JD.string)
        (JD.field "url" JD.string)
        (JD.maybe <| JD.field "favIconUrl" JD.string)



-- SESSION MODEL


type alias Session =
    { id : String
    , title : String
    , createdAt : Int
    , modifiedAt : Int
    , deleted : Bool
    , tabs : List Tab
    , pinned : Bool
    , collapsed : Bool
    }


sessionDecoder : Decoder Session
sessionDecoder =
    JD.map8 Session
        (JD.field "id" JD.string)
        (optionalField "title" JD.string "")
        (JD.field "createdAt" JD.int)
        (JD.field "modifiedAt" JD.int)
        (optionalField "deleted" JD.bool False)
        (JD.field "tabs" <| JD.list tabDecoder)
        (optionalField "pinned" JD.bool False)
        (optionalField "collapsed" JD.bool False)



-- MODEL


type alias Flags =
    { sessions : Value
    }


type alias Problem =
    { msg : String, details : String }


type alias Model =
    { openTabs : List Tab
    , sessions : List Session
    , problems : List Problem
    }


init : Flags -> ( Model, Cmd Msg )
init flags =
    { openTabs = []
    , sessions = []
    , problems = []
    }
        |> updateEncodedSessions flags.sessions


appendProblem : Problem -> Model -> Model
appendProblem problem model =
    { model | problems = model.problems ++ [ problem ] }


setSessions : List Session -> Model -> Model
setSessions sessions model =
    { model | sessions = sessions }


setOpenTabs : List Tab -> Model -> Model
setOpenTabs tabs model =
    { model | openTabs = tabs }



-- MESSAGES


type Msg
    = NoOp
    | OnCurrentWindowTabsChanged JE.Value
    | OnOpenTabItemClicked Tab
    | OnSessionTabItemClicked Tab



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch [ onCurrentWindowTabsChanged OnCurrentWindowTabsChanged ]



-- UPDATE


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        NoOp ->
            model |> withNoCmd

        OnCurrentWindowTabsChanged encodedOpenTabs ->
            model |> updateEncodedOpenTabs encodedOpenTabs

        OnOpenTabItemClicked tab ->
            model |> withCmd (activateTabCmd tab)

        OnSessionTabItemClicked tab ->
            model |> withCmd (createAndActivateTabWithUrl tab.url)


activateTabCmd : Tab -> Cmd msg
activateTabCmd tab =
    updateTab ( tab.id, { active = True } )


updateEncodedSessions : Value -> Model -> ( Model, Cmd Msg )
updateEncodedSessions encodedSessions model =
    encodedSessions
        |> JD.decodeValue (JD.list sessionDecoder)
        |> Result.mapError (\error -> Problem "Unable to parse cached sessions" (JD.errorToString error))
        |> unpackResult appendProblem setSessions
        |> callWith model
        |> withNoCmd


updateEncodedOpenTabs : Value -> Model -> ( Model, Cmd Msg )
updateEncodedOpenTabs encodedOpenTabs model =
    encodedOpenTabs
        |> JD.decodeValue (JD.list tabDecoder)
        |> Result.mapError (\error -> Problem "Unable to parse open tabs" (JD.errorToString error))
        |> unpackResult appendProblem setOpenTabs
        |> callWith model
        |> withNoCmd


createAndActivateTabWithUrl : String -> Cmd Msg
createAndActivateTabWithUrl url =
    createTab { url = url, active = True }



-- VIEW


getDisplaySessions : List Session -> List Session
getDisplaySessions sessions =
    let
        comparator =
            Compare.concat [ Compare.by .pinned, Compare.by .createdAt |> Compare.reverse ]
    in
    List.sortWith (Compare.by .createdAt |> Compare.reverse) sessions


view : Model -> Html Msg
view model =
    div [ class "pa3 lh-copy" ]
        [ div [ class "measure-wide center b mb3" ] [ text "TabExplorer" ]
        , viewProblems model.problems
        , viewOpenTabs model.openTabs
        , viewSessions <| getDisplaySessions model.sessions
        ]


viewProblems : List Problem -> Html Msg
viewProblems problems =
    if List.isEmpty problems then
        text ""

    else
        div [ class "measure-wide center mv3" ] (List.map viewError problems)


viewError : Problem -> Html Msg
viewError problem =
    div [ class "mv4" ]
        [ div [ class "pa2 bg-red white br3 mb3" ] [ text <| "Error: " ++ problem.msg ]
        , div [ class "ph3 code pre lh-solid f6" ] [ text problem.details ]
        ]


viewOpenTabs : List Tab -> Html Msg
viewOpenTabs tabs =
    div [ class "measure-wide center ba br3" ]
        [ div [ class "pa2 bb" ] [ text "Open Tabs" ]
        , div [ class "pv2" ] (List.map viewOpenTabItem tabs)
        ]


viewOpenTabItem : Tab -> Html Msg
viewOpenTabItem tab =
    div [ class "pointer", onClick <| OnOpenTabItemClicked tab ]
        [ div [ class "pv1 ph2" ] [ text tab.title ]
        ]


viewSessions : List Session -> Html Msg
viewSessions sessions =
    div [ class "measure-wide center" ]
        [ div [ class "b mv3 " ] [ text "Saved Sessions" ]
        , div [ class "pv2" ] (List.map viewSessionItem sessions)
        ]


viewSessionItem : Session -> Html Msg
viewSessionItem session =
    div [ class "mb3 ba br3" ]
        [ div [ class "pa2 bb" ] [ session.createdAt |> String.fromInt |> text ]
        , div [ class "pv2" ] (List.map viewSessionTabItem session.tabs)
        ]


viewSessionTabItem : Tab -> Html Msg
viewSessionTabItem tab =
    div [ class "pointer", onClick <| OnSessionTabItemClicked tab ]
        [ div [ class "pv1 ph2" ] [ text tab.title ]
        ]



-- MAIN


main : Program Flags Model Msg
main =
    Browser.element
        { init = init
        , view = view
        , update = update
        , subscriptions = subscriptions
        }



-- COMMON HELPERS


callWith : a -> (a -> b) -> b
callWith a fn =
    fn a


mergeResult : Result a a -> a
mergeResult result =
    case result of
        Err a ->
            a

        Ok a ->
            a


unpackResult : (err -> b) -> (a -> b) -> Result err a -> b
unpackResult fromErr fromOk result =
    result
        |> Result.mapError fromErr
        |> Result.map fromOk
        |> mergeResult


withNoCmd : model -> ( model, Cmd msg )
withNoCmd model =
    ( model, Cmd.none )


withCmd : Cmd msg -> model -> ( model, Cmd msg )
withCmd cmd model =
    ( model, cmd )


optionalField : String -> Decoder a -> a -> Decoder a
optionalField fname fdecoder defVal =
    JD.field fname fdecoder
        |> JD.maybe
        |> JD.map (Maybe.withDefault defVal)
