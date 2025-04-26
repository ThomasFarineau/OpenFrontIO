import { css, html, TemplateResult, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { EventBus } from "../../../core/EventBus";
import {
  PlayerProfile,
  PlayerType,
  Relation,
  UnitType,
} from "../../../core/game/Game";
import { TileRef } from "../../../core/game/GameMap";
import { GameView, PlayerView, UnitView } from "../../../core/game/GameView";
import { ClientID } from "../../../core/Schemas";
import { TransformHandler } from "../../graphics/TransformHandler";
import { MouseMoveEvent } from "../../InputHandler";
import { renderNumber, renderTroops, translateText } from "../../Utils";
import {
  cityIcon,
  goldIcon,
  healthIcon,
  missileSiloIcon,
  portIcon,
  samLauncherIcon,
} from "../icons";
import OverlayComponent from "./OverlayComponent";
import styles from "./PlayerInfo.sass";

/**
 * Calcule la distance euclidienne entre un point et une tuile dans le monde
 */
function euclideanDistWorld(
  coord: { x: number; y: number },
  tileRef: TileRef,
  game: GameView,
): number {
  const dx = coord.x - game.x(tileRef);
  const dy = coord.y - game.y(tileRef);
  return Math.hypot(dx, dy);
}

/**
 * Comparateur triant par distance à un point global
 */
function sortByDist(
  coord: { x: number; y: number },
  game: GameView,
): (a: UnitView, b: UnitView) => number {
  return (a, b) =>
    euclideanDistWorld(coord, a.tile(), game) -
    euclideanDistWorld(coord, b.tile(), game);
}

@customElement("playerinfo-component")
export default class PlayerInfo extends OverlayComponent {
  static styles = css`
    ${unsafeCSS(styles)}
  `;

  @property({ type: Object }) game!: GameView;
  @property({ type: String }) clientID!: ClientID;
  @property({ type: Object }) eventBus!: EventBus;
  @property({ type: Object }) transform!: TransformHandler;

  @state() private player: PlayerView | null = null;
  @state() private profile: PlayerProfile | null = null;
  @state() private unit: UnitView | null = null;

  private lastMouse = 0;

  async onMouseEvent(e: MouseMoveEvent) {
    const now = Date.now();
    if (now - this.lastMouse < 100) return;
    this.lastMouse = now;
    await this.checkCursor(e.x, e.y);
  }

  renderComponent = (): TemplateResult | null => html`
    <ul class="player-info" @contextmenu=${(e: Event) => e.preventDefault()}>
      ${this.player ? this.renderPlayer(this.player) : ""}
      ${this.unit ? this.renderUnit(this.unit) : ""}
    </ul>
  `;

  public async checkCursor(x: number, y: number) {
    const { x: wx, y: wy } = this.transform.screenToWorldCoordinates(x, y);
    if (!this.game.isValidCoord(wx, wy)) return;

    const tile = this.game.ref(wx, wy);
    if (!tile) return;

    let newPlayer: PlayerView | null = null;
    let newProfile: PlayerProfile | null = null;
    let newUnit: UnitView | null = null;

    const owner = this.game.owner(tile);
    if (owner?.isPlayer()) {
      newPlayer = owner as PlayerView;
      newProfile = await newPlayer.profile();
    } else if (!this.game.isLand(tile)) {
      const candidates = this.game
        .units(UnitType.Warship, UnitType.TradeShip, UnitType.TransportShip)
        .filter(
          (u) => euclideanDistWorld({ x: wx, y: wy }, u.tile(), this.game) < 50,
        )
        .sort(sortByDist({ x: wx, y: wy }, this.game));
      if (candidates.length) {
        newUnit = candidates[0];
      }
    }

    if (newPlayer === this.player && newUnit === this.unit) {
      return;
    }

    this.player = newPlayer;
    this.profile = newProfile;
    this.unit = newUnit;
    this.isVisible = !!(newPlayer || newUnit);

    this.requestUpdate();
  }

  tick(): void {}

  private renderRow(
    title: string | null,
    value: string | TemplateResult,
    icon?: TemplateResult,
    condition = true,
    label?: string,
  ): TemplateResult | null {
    if (!condition) return null;
    return html`
      <li>
        <span>
          ${icon ? html`<span class="icon">${icon}</span>` : ""}
          <span>${title}:</span>
        </span>
        ${label
          ? html`<span class="label label-${label}">${value}</span>`
          : html`<span class="value">${value}</span>`}
      </li>
    `;
  }

  private renderPlayer(p: PlayerView): TemplateResult {
    const me = this.game.myPlayer();
    const friendly = me?.isFriendly(p) ?? false;
    const incoming = p.outgoingAttacks().reduce((sum, a) => sum + a.troops, 0);
    const typeKey = p.type().toLowerCase();
    const relKey =
      Relation[
        this.profile?.relations[me?.smallID() ?? 0] ?? Relation.Neutral
      ].toLowerCase();

    const items = [
      {
        title: translateText("player_info.type.title"),
        value: translateText(`player_info.type.${typeKey}`),
        label: typeKey,
      },
      {
        title: translateText("player_info.defending_troops"),
        value: renderTroops(p.troops()),
        condition: p.troops() >= 1,
      },
      {
        title: translateText("player_info.attacking_troops"),
        value: renderTroops(incoming),
        condition: incoming >= 1,
      },
      {
        title: translateText("player_info.gold"),
        icon: goldIcon(),
        value: renderNumber(p.gold()),
      },
      {
        title: translateText("player_info.cities"),
        icon: cityIcon(),
        value: p.units(UnitType.City).length.toString(),
      },
      {
        title: translateText("player_info.ports"),
        icon: portIcon(),
        value: p.units(UnitType.Port).length.toString(),
      },
      {
        title: translateText("player_info.missileSilos"),
        icon: missileSiloIcon(),
        value: p.units(UnitType.MissileSilo).length.toString(),
      },
      {
        title: translateText("player_info.samLaunchers"),
        icon: samLauncherIcon(),
        value: p.units(UnitType.SAMLauncher).length.toString(),
      },
      {
        title: translateText("player_info.relation"),
        value: translateText(`relation.${relKey}`),
        condition: p.type() === PlayerType.FakeHuman && me != null,
        label: relKey,
      },
    ];

    return html`
      <li class="name ${friendly ? "isFriendly" : ""}">
        ${p.flag()
          ? html`<img alt=${p.name()} src="/flags/${p.flag()}.svg" />`
          : ""}
        <span>${unsafeHTML(p.name())}</span>
      </li>
      ${items.map((item) =>
        this.renderRow(
          item.title ?? null,
          item.value,
          item.icon,
          item.condition ?? true,
          item.label,
        ),
      )}
    `;
  }

  private renderUnit(u: UnitView): TemplateResult {
    const me = this.game.myPlayer();
    const friendly = me?.isFriendly(u.owner()) ?? false;
    const key =
      Object.keys(UnitType)[
        Object.values(UnitType).indexOf(u.type())
      ].toLowerCase();

    const items = [
      {
        labelText: translateText("player_info.unit"),
        value: translateText(`unit.${key}`),
      },
      {
        labelText: translateText("player_info.health"),
        icon: healthIcon(),
        value: u.health().toString(),
        condition: u.hasHealth(),
      },
    ];

    return html`
      <li class="name ${friendly ? "isFriendly" : ""}">
        ${u.owner().flag()
          ? html`<img
              alt=${u.owner().name()}
              src="/flags/${u.owner().flag()}.svg"
            />`
          : ""}
        <span>${unsafeHTML(u.owner().name())}</span>
      </li>
      ${items.map((item) =>
        this.renderRow(
          item.labelText ?? null,
          item.value,
          item.icon,
          item.condition,
        ),
      )}
    `;
  }
}
