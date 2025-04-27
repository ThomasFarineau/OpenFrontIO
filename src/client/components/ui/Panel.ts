import { css, html, TemplateResult, unsafeCSS } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { EventBus } from "../../../core/EventBus";
import { GameView } from "../../../core/game/GameView";
import { ClientID } from "../../../core/Schemas";
import { Layer } from "../../graphics/layers/Layer";
import { UIState } from "../../graphics/UIState";
import { AttackRatioEvent } from "../../InputHandler";
import { SendSetTargetTroopRatioEvent } from "../../Transport";
import { renderTroops, translateText } from "../../Utils";
import { populationIcon } from "../icons";
import OverlayComponent from "./OverlayComponent";
import styles from "./Panel.sass";

const DEFAULT_ATTACK_RATIO = 0.2;
const DEFAULT_TARGET_TROOP_RATIO = 0.95;

function renderRange(
  id: string,
  value: number,
  min: number,
  max: number,
  fillPct: number,
  selectorPct: number,
  onInput: (e: Event) => void,
): TemplateResult {
  return html`
    <div class="with-value">
      <input
        id=${id}
        class="fill-${fillPct} selector-${selectorPct}"
        type="range"
        min=${min}
        max=${max}
        .value=${String(value)}
        @input=${onInput}
      />
      <span>${value}%</span>
    </div>
  `;
}

@customElement("panel-component")
export default class Panel extends OverlayComponent implements Layer {
  static styles = css`
    ${unsafeCSS(styles)}
  `;

  public game!: GameView;
  public clientID!: ClientID;
  public eventBus!: EventBus;
  public uiState!: UIState;

  @state() private attackRatio = DEFAULT_ATTACK_RATIO;
  @state() private targetTroopRatio = DEFAULT_TARGET_TROOP_RATIO;
  @state() private population = 0;
  @state() private maxPopulation = 0;
  @state() private popRate = 0;
  @state() private troops = 0;
  @state() private worker = 0;
  @state() private manPower = 0;
  @state() private popRateIsIncreasing = true;
  private lastPopIncreaseRate = 0;
  private initialized = false;

  @query("#attack-ratio") private attackInput!: HTMLInputElement;
  @query("#troop-ratio") private troopInput!: HTMLInputElement;

  firstUpdated() {
    this.attackRatio = Number(
      localStorage.getItem("settings.attackRatio") ?? DEFAULT_ATTACK_RATIO,
    );
    this.targetTroopRatio = Number(
      localStorage.getItem("settings.troopRatio") ?? DEFAULT_TARGET_TROOP_RATIO,
    );
    this.uiState.attackRatio = this.attackRatio;

    this.eventBus.emit(new SendSetTargetTroopRatioEvent(this.targetTroopRatio));
    this.initialized = true;

    this.eventBus.on(AttackRatioEvent, ({ attackRatio }) => {
      const raw = +this.attackInput.value + attackRatio;
      this.attackRatio = Math.min(1, Math.max(0.01, raw / 100));
      this.uiState.attackRatio = this.attackRatio;
      localStorage.setItem("settings.attackRatio", this.attackRatio.toString());
    });

    this.attackInput.addEventListener("input", () => this.handleAttackInput());
    this.troopInput.addEventListener("input", () => this.handleTroopInput());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.attackInput.removeEventListener("input", () =>
      this.handleAttackInput(),
    );
    this.troopInput.removeEventListener("input", () => this.handleTroopInput());
  }

  tick() {
    if (!this.isVisible && !this.game.inSpawnPhase()) this.show();

    const player = this.game.myPlayer();
    if (!player || !player.isAlive()) {
      this.hide();
      return;
    }

    const popIncRate = player.population() - this.population;
    if (this.game.ticks() % 5 === 0) {
      this.popRateIsIncreasing = popIncRate >= this.lastPopIncreaseRate;
      this.lastPopIncreaseRate = popIncRate;
    }

    this.population = player.population();
    this.maxPopulation = this.game.config().maxPopulation(player);
    this.troops = player.troops();
    this.worker = player.workers();
    this.popRate = this.game.config().populationIncreaseRate(player) * 10;
    this.manPower = this.troops;
  }

  private handleAttackInput() {
    this.attackRatio = parseInt(this.attackInput.value, 10) / 100;
    this.uiState.attackRatio = this.attackRatio;
    localStorage.setItem("settings.attackRatio", this.attackRatio.toString());
  }

  private handleTroopInput() {
    this.targetTroopRatio = parseInt(this.troopInput.value, 10) / 100;
    this.eventBus.emit(new SendSetTargetTroopRatioEvent(this.targetTroopRatio));
    localStorage.setItem(
      "settings.troopRatio",
      this.targetTroopRatio.toString(),
    );
  }

  renderLayer(_context: CanvasRenderingContext2D) {}

  renderComponent() {
    const attackPct = Math.round(this.attackRatio * 100);
    const troopPct = Math.round((this.troops / this.population) * 100);

    return html`
      <div class="panel" @contextmenu=${(e: Event) => e.preventDefault()}>
        <div class="md-hide">
          <div class="justify-between">
            <b
              ><span class="icon">${populationIcon()}</span> ${translateText(
                "panel.population",
              )}:</b
            >
            <span>
              ${renderTroops(this.population)} /
              ${renderTroops(this.maxPopulation)}
              <span
                class=${this.popRateIsIncreasing
                  ? "isIncreasing"
                  : "isNotIncreasing"}
              >
                (+${renderTroops(this.popRate)})
              </span>
            </span>
          </div>
        </div>

        <div>
          <label class="block"
            >${translateText("panel.troops")}: ${renderTroops(this.troops)} |
            ${translateText("panel.workers")}:
            ${renderTroops(this.worker)}</label
          >
          ${renderRange(
            "troop-ratio",
            this.targetTroopRatio * 100,
            1,
            100,
            troopPct,
            Math.round(this.targetTroopRatio * 100),
            (e: Event) => this.handleTroopInput(),
          )}
        </div>

        <div>
          <label
            >${translateText("panel.troops_ready")}:
            ${renderTroops(this.troops * this.attackRatio)}</label
          >
          ${renderRange(
            "attack-ratio",
            attackPct,
            1,
            100,
            attackPct,
            attackPct,
            (e: Event) => this.handleAttackInput(),
          )}
        </div>
      </div>
    `;
  }
}
