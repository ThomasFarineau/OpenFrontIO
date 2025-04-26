import { css, html, LitElement, unsafeCSS } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { EventBus, GameEvent } from "../../../core/EventBus";
import { GameView, PlayerView, UnitView } from "../../../core/game/GameView";
import { ClientID } from "../../../core/Schemas";
import { MouseMoveEvent } from "../../InputHandler";
import styles from "../styles/global.sass";
import { TransformHandler } from "../TransformHandler";
import { Layer } from "./Layer";

import "../../components/ui/Infobar";
import Infobar from "../../components/ui/Infobar";
import "../../components/ui/Leaderboard";
import Leaderboard from "../../components/ui/Leaderboard";
import "../../components/ui/Options";
import Options from "../../components/ui/Options";
import "../../components/ui/PlayerInfo";
import PlayerInfo from "../../components/ui/PlayerInfo";

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

  @property({ type: Object }) game!: GameView;
  @property({ type: String }) clientID!: ClientID;
  @property({ type: Object }) eventBus!: EventBus;
  @property({ type: Object }) transform!: TransformHandler;

  @query("playerinfo-component") public playerInfo!: PlayerInfo;
  @query("infobar-component") private infoBar!: Infobar;
  @query("leaderboard-component") private leaderboard!: Leaderboard;
  @query("options-component") private options!: Options;

  init() {
    this.eventBus.on(MouseMoveEvent, (e: MouseMoveEvent) =>
      this.playerInfo.onMouseEvent(e),
    );
  }

  updated(changedProps: Map<string, any>) {
    if (changedProps.has("game") || changedProps.has("clientID")) {
      this.leaderboard.tick();
      this.infoBar.tick();
      this.options.tick();
    }
  }

  tick() {
    this.options.tick();
    this.infoBar.tick();
    this.leaderboard.tick();
  }

  renderLayer(_: CanvasRenderingContext2D) {}

  shouldTransform(): boolean {
    return false;
  }

  render() {
    return html`
      <div class="inGameHeader">
        <leaderboard-component
          .game=${this.game}
          .clientID=${this.clientID}
          .eventBus=${this.eventBus}
        ></leaderboard-component>
        <infobar-component .game=${this.game}></infobar-component>
        <div class="spacer"></div>
        <div class="right-side">
          <options-component
            .game=${this.game}
            .eventBus=${this.eventBus}
          ></options-component>
          <playerinfo-component
            .game=${this.game}
            .eventBus=${this.eventBus}
            .transform=${this.transform}
          ></playerinfo-component>
        </div>
      </div>
    `;
  }
}
