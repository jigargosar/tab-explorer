port module TabExplorer exposing (main)

import Browser
import Html exposing (..)
import Json.Decode as JD exposing (Decoder)
import Json.Encode as JE exposing (Value)


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
                        |> JD.decodeValue (JD.list tabDecoder)
                        |> Debug.log "encodedTabs"
            in
            ( model, Cmd.none )


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


view : Model -> Html Msg
view model =
    div [] [ text "foo" ]
