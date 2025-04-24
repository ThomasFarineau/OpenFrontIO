import { LitElement, css, html, unsafeCSS } from "lit";
import { customElement, state } from "lit/decorators.js";
import { EventBus } from "../../../core/EventBus";
import { GameView } from "../../../core/game/GameView";
import { ClientID } from "../../../core/Schemas";
import { AttackRatioEvent } from "../../InputHandler";
import { SendSetTargetTroopRatioEvent } from "../../Transport";
import { renderTroops } from "../../Utils";
import styles from "../styles/global.sass";
import { UIState } from "../UIState";
import { Layer } from "./Layer";

@customElement("control-panel")
export class ControlPanel extends LitElement implements Layer {
  static styles = css`
    ${unsafeCSS(styles)}
  `;
  public game: GameView;
  public clientID: ClientID;
  public eventBus: EventBus;
  public uiState: UIState;

  @state()
  private attackRatio: number = 0.2;

  @state()
  private targetTroopRatio = 0.95;

  @state()
  private currentTroopRatio = 0.95;

  @state()
  private _population: number;

  @state()
  private _maxPopulation: number;

  @state()
  private popRate: number;

  @state()
  private _troops: number;

  @state()
  private _workers: number;

  @state()
  private _isVisible = false;

  @state()
  private _manpower: number = 0;

  @state()
  private _gold: number;

  @state()
  private _goldPerSecond: number;

  private _lastPopulationIncreaseRate: number;

  private _popRateIsIncreasing: boolean = true;

  private init_: boolean = false;

  init() {
    this.attackRatio = Number(
      localStorage.getItem("settings.attackRatio") ?? "0.2",
    );
    this.targetTroopRatio = Number(
      localStorage.getItem("settings.troopRatio") ?? "0.95",
    );
    this.init_ = true;
    this.uiState.attackRatio = this.attackRatio;
    this.currentTroopRatio = this.targetTroopRatio;
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
        // If we're changing the ratio from 1%, then set it to 10% instead of 11% to keep a consistency
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

    if (!this._isVisible && !this.game.inSpawnPhase()) {
      this.setVisibile(true);
    }

    const player = this.game.myPlayer();
    if (player == null || !player.isAlive()) {
      this.setVisibile(false);
      return;
    }

    const popIncreaseRate = player.population() - this._population;
    if (this.game.ticks() % 5 == 0) {
      this._popRateIsIncreasing =
        popIncreaseRate >= this._lastPopulationIncreaseRate;
      this._lastPopulationIncreaseRate = popIncreaseRate;
    }

    this._population = player.population();
    this._maxPopulation = this.game.config().maxPopulation(player);
    this._gold = player.gold();
    this._troops = player.troops();
    this._workers = player.workers();
    this.popRate = this.game.config().populationIncreaseRate(player) * 10;
    this._goldPerSecond = this.game.config().goldAdditionRate(player) * 10;

    this.currentTroopRatio = player.troops() / player.population();
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

  setVisibile(visible: boolean) {
    this._isVisible = visible;
    this.requestUpdate();
  }

  targetTroops(): number {
    return this._manpower * this.targetTroopRatio;
  }

  onTroopChange(newRatio: number) {
    this.eventBus.emit(new SendSetTargetTroopRatioEvent(newRatio));
  }

  delta(): number {
    const d = this._population - this.targetTroops();
    return d;
  }

  render() {
    return html`
      <div
        class="control-panel ${this._isVisible ? "" : "hidden"}"
        @contextmenu=${(e) => e.preventDefault()}
      >
        <div class="desktop-only">
          <div class="justify-between">
            <b><span class="icon">📈</span> Pop:</b>
            <span translate="no">
              ${renderTroops(this._population)} /
              ${renderTroops(this._maxPopulation)}
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
            Troops: <span translate="no">${renderTroops(this._troops)}</span> |
            Workers: <span translate="no">${renderTroops(this._workers)}</span>
          </label>

          <div class="with-value">
            <input
              id="troop-ratio"
              class="targetTroopRatio fill-${Math.round(
                this.targetTroopRatio * 100,
              )}"
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
              class="attackRatio fill-${Math.round(this.attackRatio * 100)}"
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
