import { css, html, TemplateResult, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { UnitType } from "../../../core/game/Game";
import { GameView } from "../../../core/game/GameView";
import { renderNumber, translateText } from "../../Utils";
import {
  cityIcon,
  defensePostIcon,
  goldIcon,
  missileSiloIcon,
  portIcon,
  samLauncherIcon,
  warshipIcon,
} from "../icons";
import styles from "./Infobar.sass";
import OverlayComponent from "./OverlayComponent";

interface InfoEntry {
  type: UnitType;
  icon: TemplateResult;
  value: string;
}

@customElement("infobar-component")
export default class Infobar extends OverlayComponent {
  static styles = css`
    ${unsafeCSS(styles)}
  `;

  @property({ type: Object }) game!: GameView;

  @state() private playerGold = "0";

  @state() private goldPerSecond = 0;

  @state() private entries: InfoEntry[] = [
    { type: UnitType.City, icon: cityIcon(), value: "0" },
    {
      type: UnitType.Port,
      icon: portIcon(),
      value: "0",
    },
    { type: UnitType.MissileSilo, icon: missileSiloIcon(), value: "0" },
    {
      type: UnitType.DefensePost,
      icon: defensePostIcon(),
      value: "0",
    },
    { type: UnitType.SAMLauncher, icon: samLauncherIcon(), value: "0" },
    {
      type: UnitType.Warship,
      icon: warshipIcon(),
      value: "0",
    },
  ];
  @state() private _shownOnInit = false;

  updated(changedProps: Map<string, unknown>): void {
    if (changedProps.has("game")) {
      this.tick();
    }
  }

  public tick(): void {
    if (!this._shownOnInit && !this.game.inSpawnPhase()) {
      this._shownOnInit = true;
      this.show();
      this.tick();
    }

    const player = this.game?.myPlayer();
    if (!player || !player.isAlive()) {
      this.isVisible = false;
      return;
    }

    if (!this.isVisible && !this.game.inSpawnPhase()) {
      this.isVisible = true;
    }

    this.playerGold = renderNumber(player.gold());
    this.goldPerSecond = this.game.config().goldAdditionRate(player) * 10;

    this.entries = this.entries.map((entry) => ({
      ...entry,
      value: renderNumber(player.units(entry.type).length),
    }));
  }

  renderComponent = (): TemplateResult | null => html`
    <ul class="infobar">
      ${this.renderGold()} ${this.entries.map((e) => this.renderEntry(e))}
    </ul>
  `;

  private renderGold(): TemplateResult {
    return html`
      <li title="${translateText("infobar.gold")}">
        <span class="icon">${goldIcon()}</span>
        <span class="value number">
          ${this.playerGold}
          <span class="subvalue">(+ ${renderNumber(this.goldPerSecond)})</span>
        </span>
      </li>
    `;
  }

  private renderEntry(entry: InfoEntry): TemplateResult {
    const key =
      Object.keys(UnitType)[
        Object.values(UnitType).indexOf(entry.type)
      ].toLowerCase();
    return html`
      <li title="${translateText(`infobar.${key}`)}">
        <span class="icon">${entry.icon}</span>
        <span class="value number">${entry.value}</span>
      </li>
    `;
  }
}
