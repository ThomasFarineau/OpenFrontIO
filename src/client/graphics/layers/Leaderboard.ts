import { LitElement, css, html, unsafeCSS } from "lit";
import { customElement, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { EventBus, GameEvent } from "../../../core/EventBus";
import { GameView, PlayerView, UnitView } from "../../../core/game/GameView";
import { ClientID } from "../../../core/Schemas";
import { renderNumber } from "../../Utils";
import styles from "../styles/Leaderboard.sass";
import { Layer } from "./Layer";

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

@customElement("leader-board")
export class Leaderboard extends LitElement implements Layer {
  static styles = css`
    ${unsafeCSS(styles)}
  `;
  public game: GameView;
  public clientID: ClientID;
  public eventBus: EventBus;

  players: Entry[] = [];

  @state()
  private _leaderboardHidden = true;
  private _shownOnInit = false;
  private showTopFive = true;

  init() {}

  tick() {
    if (!this._shownOnInit && !this.game.inSpawnPhase()) {
      this._shownOnInit = true;
      this.showLeaderboard();
      this.updateLeaderboard();
    }
    if (this._leaderboardHidden) {
      return;
    }

    if (this.game.ticks() % 10 == 0) {
      this.updateLeaderboard();
    }
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
        score: formatPercentage(
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
        score: formatPercentage(
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

  renderLayer(context: CanvasRenderingContext2D) {}

  shouldTransform(): boolean {
    return false;
  }

  render() {
    return html`
      <button
        @click=${() => this.toggleLeaderboard()}
        class="leaderboard-button ${this._shownOnInit && this._leaderboardHidden
          ? ""
          : "hidden"}"
      >
        Leaderboard
      </button>
      <div
        class="leaderboard ${this._leaderboardHidden ? "hidden" : ""}"
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
    `;
  }

  toggleLeaderboard() {
    this._leaderboardHidden = !this._leaderboardHidden;
    this.requestUpdate();
  }

  hideLeaderboard() {
    this._leaderboardHidden = true;
    this.requestUpdate();
  }

  showLeaderboard() {
    this._leaderboardHidden = false;
    this.requestUpdate();
  }

  get isVisible() {
    return !this._leaderboardHidden;
  }
}

function formatPercentage(value: number): string {
  const percentage = value * 100;
  if (percentage >= 99.5) return "100%";
  if (percentage <= 0.01) return "0%";
  return percentage.toPrecision(percentage < 0.1 ? 1 : 2) + "%";
}
