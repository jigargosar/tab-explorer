port module TabExplorer exposing (main)

import Browser
import Html exposing (..)
import Json.Encode as JE


port onCurrentWindowTabsChanged : (JE.Value -> msg) -> Sub msg


main : Program Flags Model Msg
main =
    Browser.element
        { init = init
        , view = view
        , update = update
        , subscriptions = subscriptions
        }


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch [ onCurrentWindowTabsChanged OnCurrentWindowTabs ]


type alias Flags =
    {}


type alias Model =
    {}


init : Flags -> ( Model, Cmd Msg )
init flags =
    ( {}, Cmd.none )


type Msg
    = NoOp
    | OnCurrentWindowTabs JE.Value


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        NoOp ->
            ( model, Cmd.none )

        OnCurrentWindowTabs encodedTabs ->
            let
                _ =
                    encodedTabs
                        |> Debug.log "encodedTabs"
            in
            ( model, Cmd.none )


view : Model -> Html Msg
view model =
    div [] [ text "foo" ]
