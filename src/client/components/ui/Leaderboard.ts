import { css, html, TemplateResult, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { EventBus } from "../../../core/EventBus";
import { GameView, PlayerView } from "../../../core/game/GameView";
import { ClientID } from "../../../core/Schemas";
import { GoToPlayerEvent } from "../../graphics/layers/GameOverlay";
import { renderNumber, renderPercentage, translateText } from "../../Utils";
import { sortAscendingIcon, sortDescendingIcon, unsortedIcon } from "../icons";
import styles from "./Leaderboard.sass";
import OverlayComponent from "./OverlayComponent";

const TOP_OF = 5;

type SortField = "owned" | "gold" | "troops";

interface LeaderboardEntry {
  player: PlayerView;
  rank: number;
  raw: Record<SortField, number>;
  formatted: { score: string; gold: string; troops: string };
  isMyPlayer: boolean;
}

@customElement("leaderboard-component")
export default class Leaderboard extends OverlayComponent {
  static styles = css`
    ${unsafeCSS(styles)}
  `;

  @property({ type: Object }) game!: GameView;
  @property({ type: String }) clientID!: ClientID;
  @property({ type: Object }) eventBus!: EventBus;

  @state() private entries: LeaderboardEntry[] = [];
  @state() private showTop = true;
  @state() private collapsed = false;
  @state() private initialShown = false;
  @state() private sortField: SortField = "owned";
  @state() private sortAsc = false;

  updated(changed: Map<string, any>) {
    if (changed.has("game") || changed.has("clientID")) this.tick();
  }

  renderComponent = (): TemplateResult | null =>
    this.collapsed ? this.renderCollapsed() : this.renderExpanded();

  tick() {
    if (!this.game || !this.clientID) return;
    if (!this.initialShown && !this.game.inSpawnPhase()) {
      this.initialShown = true;
      this.show();
    }
    if (this.game.ticks() % 10 !== 0) return;

    const players = this.game.playerViews().filter((p) => p.isAlive());
    const me = players.find((p) => p.clientID() === this.clientID) || null;
    const totalTiles =
      this.game.numLandTiles() - this.game.numTilesWithFallout();

    const sortedByOwned = [...players].sort(
      (a, b) => b.numTilesOwned() - a.numTilesOwned(),
    );
    const rankByPlayer = new Map(sortedByOwned.map((p, i) => [p, i + 1]));

    const data = players.map((p) => {
      const owned = p.numTilesOwned();
      const troops = p.isAlive() ? p.troops() / 10 : 0;
      return {
        player: p,
        rank: rankByPlayer.get(p)!,
        raw: { owned, gold: p.gold(), troops },
        formatted: {
          score: renderPercentage(owned / totalTiles),
          gold: renderNumber(p.gold()),
          troops: renderNumber(troops),
        },
        isMyPlayer: p === me,
      };
    });

    data.sort((a, b) =>
      this.sortAsc
        ? a.raw[this.sortField] - b.raw[this.sortField]
        : b.raw[this.sortField] - a.raw[this.sortField],
    );

    const visibleEntries = this.showTop ? data.slice(0, TOP_OF) : data;
    if (me && !visibleEntries.some((e) => e.player === me)) {
      const idx = data.findIndex((e) => e.player === me);
      if (idx >= 0) visibleEntries.splice(-1, 1, data[idx]);
    }

    this.entries = visibleEntries;
  }

  private onHeaderClick(field: SortField) {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = field === "owned";
    }
    this.tick();
  }

  private onToggleShow() {
    this.showTop = !this.showTop;
    this.tick();
  }

  private onToggleCollapse() {
    this.collapsed = !this.collapsed;
  }

  private onRowClick(p: PlayerView) {
    this.eventBus.emit(new GoToPlayerEvent(p));
  }

  private renderHeaderCell(label: string, field: SortField) {
    const icon =
      this.sortField === field
        ? this.sortAsc
          ? sortAscendingIcon()
          : sortDescendingIcon()
        : unsortedIcon();
    return html` <th @click=${() => this.onHeaderClick(field)}>
      <span class="sortable"> ${label}<span class="icon">${icon}</span> </span>
    </th>`;
  }

  private renderExpanded(): TemplateResult {
    return html` <div
      class="leaderboard"
      @contextmenu=${(e: Event) => e.preventDefault()}
    >
      <h1>${translateText("leaderboard.title")}</h1>
      <div class="table-content">
        <table>
          <thead>
            <tr>
              <th>${translateText("leaderboard.rank")}</th>
              <th>${translateText("leaderboard.player")}</th>
              ${this.renderHeaderCell(
                translateText("leaderboard.owned"),
                "owned",
              )}
              ${this.renderHeaderCell(
                translateText("leaderboard.gold"),
                "gold",
              )}
              ${this.renderHeaderCell(
                translateText("leaderboard.troops"),
                "troops",
              )}
            </tr>
          </thead>
          <tbody>
            ${this.entries.map(
              (e) =>
                html` <tr
                  class=${e.isMyPlayer ? "focused" : ""}
                  @click=${() => this.onRowClick(e.player)}
                >
                  <td>${e.rank}</td>
                  <td class="player-name">${unsafeHTML(e.player.name())}</td>
                  <td>${e.formatted.score}</td>
                  <td>${e.formatted.gold}</td>
                  <td>${e.formatted.troops}</td>
                </tr>`,
            )}
          </tbody>
        </table>
      </div>
      <div class="actions">
        <button @click=${this.onToggleCollapse}>
          ${translateText("leaderboard.close")}
        </button>
        <button @click=${this.onToggleShow}>
          ${this.showTop
            ? translateText("leaderboard.showAll")
            : translateText("leaderboard.showTop", { num: TOP_OF })}
        </button>
      </div>
    </div>`;
  }

  private renderCollapsed(): TemplateResult {
    return html` <button
      class="leaderboard-button"
      @click=${this.onToggleCollapse}
    >
      ${translateText("leaderboard.open")}
    </button>`;
  }
}
