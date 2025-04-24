import { LitElement, TemplateResult, css, html, unsafeCSS } from "lit";
import { customElement, state } from "lit/decorators.js";
import styles from "../styles/global.sass";
import { Layer } from "./Layer";

import { GameView, PlayerView, UnitView } from "../../../core/game/GameView";
import cityIcon from "../../components/icons/City";
import defensePostIcon from "../../components/icons/DefensePost";
import goldIcon from "../../components/icons/Gold";
import missileSiloIcon from "../../components/icons/MissileSilo";
import portIcon from "../../components/icons/Port";
import samLauncherIcon from "../../components/icons/SAMLauncher";
import warshipIcon from "../../components/icons/Warship";

import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { EventBus, GameEvent } from "../../../core/EventBus";
import { GameType, UnitType } from "../../../core/game/Game";
import { GameUpdateType } from "../../../core/game/GameUpdates";
import { UserSettings } from "../../../core/game/UserSettings";
import { ClientID } from "../../../core/Schemas";
import { AlternateViewEvent, RefreshGraphicsEvent } from "../../InputHandler";
import { PauseGameEvent } from "../../Transport";
import { renderNumber, renderPercentage, secondsToHms } from "../../Utils";

const button = ({
  classes = "",
  onClick = () => {},
  title = "",
  children,
}) => html`
  <button
    class="flex items-center justify-center p-1
                               bg-opacity-70 bg-gray-700 text-opacity-90 text-white
                               border-none rounded cursor-pointer
                               hover:bg-opacity-60 hover:bg-gray-600
                               transition-colors duration-200
                               text-sm lg:text-xl ${classes}"
    @click=${onClick}
    aria-label=${title}
    title=${title}
  >
    ${children}
  </button>
`;

function optionButton(onClick = () => {}, title = "", content) {
  return html`
    <li @click=${onClick} aria-label=${title} title=${title}>${content}</li>
  `;
}

interface Entry {
  name: string;
  position: number;
  score: string;
  gold: string;
  troops: string;
  isMyPlayer: boolean;
  player: PlayerView;
}

export class GoToPlayerEvent implements GameEvent {
  constructor(public player: PlayerView) {}
}

export class GoToUnitEvent implements GameEvent {
  constructor(public unit: UnitView) {}
}

@customElement("in-game-header")
export class InGameHeader extends LitElement implements Layer {
  static styles = css`
    ${unsafeCSS(styles)}
  `;

  public game: GameView;
  public clientID: ClientID;
  public eventBus: EventBus;
  private userSettings: UserSettings = new UserSettings();

  players: Entry[] = [];

  @state()
  private _leaderboardHidden = true;
  private _shownOnInit = false;
  private showTopFive = true;
  private playerGold: string;
  private goldPerSecond: number;
  private _isVisible = false;

  private leaderboardCollapsed = false;

  @state()
  private showPauseButton: boolean = true;

  @state()
  private isPaused: boolean = false;

  @state()
  private timer: number = 0;

  @state()
  private showSettings: boolean = false;

  private isOptionVisible = true;

  private hasWinner = false;

  @state()
  private alternateView: boolean = false;

  private onTerrainButtonClick() {
    this.alternateView = !this.alternateView;
    this.eventBus.emit(new AlternateViewEvent(this.alternateView));
    this.requestUpdate();
  }

  private onExitButtonClick() {
    const isAlive = this.game.myPlayer()?.isAlive();
    if (isAlive) {
      const isConfirmed = confirm("Are you sure you want to exit the game?");
      if (!isConfirmed) return;
    }
    window.location.href = "/";
  }

  private onSettingsButtonClick() {
    this.showSettings = !this.showSettings;
    this.requestUpdate();
  }

  private onPauseButtonClick() {
    this.isPaused = !this.isPaused;
    this.eventBus.emit(new PauseGameEvent(this.isPaused));
  }

  private onToggleEmojisButtonClick() {
    this.userSettings.toggleEmojis();
    this.requestUpdate();
  }

  private onToggleDarkModeButtonClick() {
    this.userSettings.toggleDarkMode();
    this.requestUpdate();
    this.eventBus.emit(new RefreshGraphicsEvent());
  }

  private onToggleFocusLockedButtonClick() {
    this.userSettings.toggleFocusLocked();
    this.requestUpdate();
  }

  private onToggleLeftClickOpensMenu() {
    this.userSettings.toggleLeftClickOpenMenu();
  }

  private informativeBarData: {
    type: UnitType;
    icon: TemplateResult;
    value: string;
  }[] = [
    {
      type: UnitType.City,
      icon: cityIcon(),
      value: "0",
    },
    {
      type: UnitType.Port,
      icon: portIcon(),
      value: "0",
    },
    {
      type: UnitType.MissileSilo,
      icon: missileSiloIcon(),
      value: "0",
    },
    {
      type: UnitType.DefensePost,
      icon: defensePostIcon(),
      value: "0",
    },
    {
      type: UnitType.SAMLauncher,
      icon: samLauncherIcon(),
      value: "0",
    },
    {
      type: UnitType.Warship,
      icon: warshipIcon(),
      value: "0",
    },
  ];

  init() {
    console.log("init called from OptionsMenu");
    this.showPauseButton =
      this.game.config().gameConfig().gameType == GameType.Singleplayer;
    this.isOptionVisible = true;
    this.requestUpdate();
  }

  tick() {
    this.hasWinner =
      this.hasWinner ||
      this.game.updatesSinceLastTick()[GameUpdateType.Win].length > 0;
    if (this.game.inSpawnPhase()) {
      this.timer = 0;
    } else if (!this.hasWinner && this.game.ticks() % 10 == 0) {
      this.timer++;
    }
    this.isOptionVisible = true;
    this.requestUpdate();

    if (!this._shownOnInit && !this.game.inSpawnPhase()) {
      this._shownOnInit = true;
      this.showLeaderboard();
      this.updateLeaderboard();
    }

    if (this.game.ticks() % 10 == 0) {
      this.updateLeaderboard();
    }

    const player = this.game.myPlayer();

    if (player == null || !player.isAlive()) {
      this.setVisible(false);
      return;
    } else if (!this._isVisible && !this.game.inSpawnPhase()) {
      this.setVisible(true);
    }

    this.goldPerSecond = this.game.config().goldAdditionRate(player) * 10;
    this.playerGold = renderNumber(player.gold());

    this.informativeBarData.forEach((entry) => {
      entry.value = renderNumber(player.units(entry.type).length);
    });
  }

  setVisible(visible: boolean) {
    this._isVisible = visible;
    this.requestUpdate();
  }

  renderLayer(context: CanvasRenderingContext2D) {}

  shouldTransform(): boolean {
    return false;
  }

  toggleLeaderboard() {
    this.leaderboardCollapsed = !this.leaderboardCollapsed;
    this.requestUpdate();
  }

  hideLeaderboard() {
    this.leaderboardCollapsed = true;
    this.requestUpdate();
  }

  showLeaderboard() {
    this.leaderboardCollapsed = false;
    this.requestUpdate();
  }

  private updateLeaderboard() {
    if (this.clientID == null) {
      return;
    }
    const myPlayer = this.game
      .playerViews()
      .find((p) => p.clientID() == this.clientID);

    const sorted = this.game
      .playerViews()
      .sort((a, b) => b.numTilesOwned() - a.numTilesOwned());

    const numTilesWithoutFallout =
      this.game.numLandTiles() - this.game.numTilesWithFallout();

    const playersToShow = this.showTopFive ? sorted.slice(0, 5) : sorted;

    this.players = playersToShow.map((player, index) => {
      let troops = player.troops() / 10;
      if (!player.isAlive()) {
        troops = 0;
      }
      return {
        name: player.displayName(),
        position: index + 1,
        score: renderPercentage(
          player.numTilesOwned() / numTilesWithoutFallout,
        ),
        gold: renderNumber(player.gold()),
        troops: renderNumber(troops),
        isMyPlayer: player == myPlayer,
        player: player,
      };
    });

    if (myPlayer != null && this.players.find((p) => p.isMyPlayer) == null) {
      let place = 0;
      for (const p of sorted) {
        place++;
        if (p == myPlayer) {
          break;
        }
      }

      let myPlayerTroops = myPlayer.troops() / 10;
      if (!myPlayer.isAlive()) {
        myPlayerTroops = 0;
      }
      this.players.pop();
      this.players.push({
        name: myPlayer.displayName(),
        position: place,
        score: renderPercentage(
          myPlayer.numTilesOwned() / this.game.numLandTiles(),
        ),
        gold: renderNumber(myPlayer.gold()),
        troops: renderNumber(myPlayerTroops),
        isMyPlayer: true,
        player: myPlayer,
      });
    }

    this.requestUpdate();
  }

  private handleRowClickPlayer(player: PlayerView) {
    this.eventBus.emit(new GoToPlayerEvent(player));
  }

  render() {
    return html`
      <div class="inGameHeader">
        <button
          @click=${() => this.toggleLeaderboard()}
          class="leaderboard-button ${this.leaderboardCollapsed
            ? ""
            : "hidden2"}"
        >
          Open Leaderboard
        </button>
        <div
          class="leaderboard ${this.leaderboardCollapsed ? "hidden2" : ""}"
          @contextmenu=${(e) => e.preventDefault()}
        >
          <h1>Leaderboard</h1>

          <div class="table-content">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Owned</th>
                  <th>Gold</th>
                  <th>Troops</th>
                </tr>
              </thead>
              <tbody>
                ${this.players.map(
                  ({
                    isMyPlayer,
                    position,
                    name,
                    score,
                    gold,
                    troops,
                    player,
                  }) => html`
                    <tr
                      class="${isMyPlayer ? "focused" : ""}"
                      @click=${() => this.handleRowClickPlayer(player)}
                    >
                      <td>${position}</td>
                      <td class="player-name">${unsafeHTML(name)}</td>
                      <td>${score}</td>
                      <td>${gold}</td>
                      <td>${troops}</td>
                    </tr>
                  `,
                )}
              </tbody>
            </table>
          </div>

          <div class="actions">
            <button @click=${() => this.hideLeaderboard()}>Hide</button>
            <button
              @click=${() => {
                this.showTopFive = !this.showTopFive;
                this.updateLeaderboard();
              }}
            >
              ${this.showTopFive ? "Show All" : "Show Top 5"}
            </button>
          </div>
        </div>

        <ul class="informative-bar ${!this._isVisible ? "hidden" : ""}">
          <li>
            <span class="icon">${goldIcon()}</span>
            <span class="value">
              ${this.playerGold}
              <span class="subvalue"
                >(+ ${renderNumber(this.goldPerSecond)})</span
              >
            </span>
          </li>
          ${this.informativeBarData.map(
            (d) => html`
              <li>
                <span class="icon">${d.icon}</span>
                <span class="value">${d.value}</span>
              </li>
            `,
          )}
        </ul>
        <div class="spacer"></div>
        ${this.isOptionVisible &&
        html`
          <ul class="options" @contextmenu=${(e) => e.preventDefault()}>
            ${this.showPauseButton &&
            optionButton(
              this.onPauseButtonClick,
              this.isPaused ? "Resume game" : "Pause game",
              this.isPaused ? "▶️" : "⏸",
            )}
            <li class="timer">${secondsToHms(this.timer)}</li>
            ${optionButton(this.onExitButtonClick, "Exit game", "❌")}
            ${optionButton(this.onSettingsButtonClick, "Settings", "⚙️")}
          </ul>

          ${this.showSettings
            ? html`<ul class="dropdown-menu">
                ${button({
                  onClick: this.onTerrainButtonClick,
                  title: "Toggle Terrain",
                  children: "🌲: " + (this.alternateView ? "On" : "Off"),
                })}
                ${button({
                  onClick: this.onToggleEmojisButtonClick,
                  title: "Toggle Emojis",
                  children:
                    "🙂: " + (this.userSettings.emojis() ? "On" : "Off"),
                })}
                ${button({
                  onClick: this.onToggleDarkModeButtonClick,
                  title: "Dark Mode",
                  children:
                    "🌙: " + (this.userSettings.darkMode() ? "On" : "Off"),
                })}
                ${button({
                  onClick: this.onToggleLeftClickOpensMenu,
                  title: "Left click",
                  children:
                    "🖱️: " +
                    (this.userSettings.leftClickOpensMenu()
                      ? "Opens menu"
                      : "Attack"),
                })}
                ${button({
                  onClick: this.onToggleFocusLockedButtonClick,
                  title: "Lock Focus",
                  children:
                    "🗺: " +
                    (this.userSettings.focusLocked()
                      ? "Focus locked"
                      : "Hover focus"),
                })}
              </ul>`
            : null}
        `}
      </div>
    `;
  }
}
