import { css, html, unsafeCSS } from "lit";
import { customElement, state } from "lit/decorators.js";
import { EventBus } from "../../../core/EventBus";
import { GameView } from "../../../core/game/GameView";
import { ClientID } from "../../../core/Schemas";
import { Layer } from "../../graphics/layers/Layer";
import styles from "../../graphics/styles/global.sass";
import { UIState } from "../../graphics/UIState";
import { AttackRatioEvent } from "../../InputHandler";
import { SendSetTargetTroopRatioEvent } from "../../Transport";
import { renderTroops } from "../../Utils";
import OverlayComponent from "./OverlayComponent";

const DEFAULT_ATTACK_RATIO = 0.2;
const DEFAULT_TARGET_TROOP_RATIO = 0.95;

@customElement("control-panel")
export class ControlPanel extends OverlayComponent implements Layer {
  static styles = css`
    ${unsafeCSS(styles)}
  `;
  public game: GameView;
  public clientID: ClientID;
  public eventBus: EventBus;
  public uiState: UIState;

  @state() private attackRatio: number = DEFAULT_ATTACK_RATIO;
  @state() private targetTroopRatio = DEFAULT_TARGET_TROOP_RATIO;
  @state() private population: number;
  @state() private maxPopulation: number;
  @state() private popRate: number;
  @state() private troops: number;
  @state() private worker: number;
  @state() private manPower: number = 0;

  private _lastPopulationIncreaseRate: number;

  private _popRateIsIncreasing: boolean = true;

  private init_: boolean = false;

  init() {
    this.attackRatio = Number(
      localStorage.getItem("settings.attackRatio") ??
        String(DEFAULT_ATTACK_RATIO),
    );
    this.targetTroopRatio = Number(
      localStorage.getItem("settings.troopRatio") ??
        String(DEFAULT_TARGET_TROOP_RATIO),
    );
    this.init_ = true;
    this.uiState.attackRatio = this.attackRatio;
    this.eventBus.on(AttackRatioEvent, (event) => {
      let newAttackRatio =
        (parseInt(
          (document.getElementById("attack-ratio") as HTMLInputElement).value,
        ) +
          event.attackRatio) /
        100;

      if (newAttackRatio < 0.01) {
        newAttackRatio = 0.01;
      }

      if (newAttackRatio > 1) {
        newAttackRatio = 1;
      }

      if (newAttackRatio == 0.11 && this.attackRatio == 0.01) {
        newAttackRatio = 0.1;
      }

      this.attackRatio = newAttackRatio;
      this.onAttackRatioChange(this.attackRatio);
    });
  }

  tick() {
    if (this.init_) {
      this.eventBus.emit(
        new SendSetTargetTroopRatioEvent(this.targetTroopRatio),
      );
      this.init_ = false;
    }

    if (!this.isVisible && !this.game.inSpawnPhase()) {
      this.show();
    }

    const player = this.game.myPlayer();
    if (player == null || !player.isAlive()) {
      this.hide();
      return;
    }

    const popIncreaseRate = player.population() - this.population;
    if (this.game.ticks() % 5 == 0) {
      this._popRateIsIncreasing =
        popIncreaseRate >= this._lastPopulationIncreaseRate;
      this._lastPopulationIncreaseRate = popIncreaseRate;
    }

    this.population = player.population();
    this.maxPopulation = this.game.config().maxPopulation(player);
    this.troops = player.troops();
    this.worker = player.workers();
    this.popRate = this.game.config().populationIncreaseRate(player) * 10;

    this.requestUpdate();
  }

  onAttackRatioChange(newRatio: number) {
    this.uiState.attackRatio = newRatio;
  }

  renderLayer(context: CanvasRenderingContext2D) {
    // Render any necessary canvas elements
  }

  shouldTransform(): boolean {
    return false;
  }

  targetTroops(): number {
    return this.manPower * this.targetTroopRatio;
  }

  onTroopChange(newRatio: number) {
    this.eventBus.emit(new SendSetTargetTroopRatioEvent(newRatio));
  }

  delta(): number {
    return this.population - this.targetTroops();
  }

  renderComponent() {
    return html`
      <div class="control-panel" @contextmenu=${(e) => e.preventDefault()}>
        <div class="desktop-only">
          <div class="justify-between">
            <b><span class="icon">📈</span> Pop:</b>
            <span translate="no">
              ${renderTroops(this.population)} /
              ${renderTroops(this.maxPopulation)}
              <span
                class="${this._popRateIsIncreasing
                  ? "isIncreasing"
                  : "isNotIncreasing"}"
                translate="no"
              >
                (+${renderTroops(this.popRate)})
              </span>
            </span>
          </div>
        </div>

        <div>
          <label class="block" translate="no" for="troop-ratio">
            Troops: <span translate="no">${renderTroops(this.troops)}</span> |
            Workers: <span translate="no">${renderTroops(this.worker)}</span>
          </label>

          <div class="with-value">
            <input
              id="troop-ratio"
              class="targetTroopRatio fill-${Math.round(
                (this.troops / this.population) * 100,
              )} selector-${Math.round(this.targetTroopRatio * 100)}"
              type="range"
              min="1"
              max="100"
              .value=${(this.targetTroopRatio * 100).toString()}
              @input=${(e: Event) => {
                this.targetTroopRatio =
                  parseInt((e.target as HTMLInputElement).value) / 100;
                this.onTroopChange(this.targetTroopRatio);
              }}
            />
            <span> ${(this.targetTroopRatio * 100).toFixed(0)}% </span>
          </div>
        </div>

        <div>
          <label translate="no" for="attack-ratio">
            Troops Ready:
            ${renderTroops(this.game?.myPlayer()?.troops() * this.attackRatio)}
          </label>

          <div class="with-value">
            <input
              id="attack-ratio"
              class="attackRatio fill-${Math.round(
                this.attackRatio * 100,
              )} selector-${Math.round(this.attackRatio * 100)}"
              type="range"
              min="1"
              max="100"
              .value=${(this.attackRatio * 100).toString()}
              @input=${(e: Event) => {
                this.attackRatio =
                  parseInt((e.target as HTMLInputElement).value) / 100;
                this.onAttackRatioChange(this.attackRatio);
              }}
            />
            <span> ${(this.attackRatio * 100).toFixed(0)}% </span>
          </div>
        </div>
      </div>
    `;
  }
}
