import { css, html, TemplateResult, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { EventBus } from "../../../core/EventBus";
import { GameType } from "../../../core/game/Game";
import { GameUpdateType } from "../../../core/game/GameUpdates";
import { GameView } from "../../../core/game/GameView";
import { UserSettings } from "../../../core/game/UserSettings";
import { AlternateViewEvent, RefreshGraphicsEvent } from "../../InputHandler";
import { PauseGameEvent } from "../../Transport";
import { secondsToHms, translateText } from "../../Utils";
import { closeIcon, pauseIcon, resumeIcon, settingsIcon } from "../icons";
import styles from "./Options.sass";
import OverlayComponent from "./OverlayComponent";

@customElement("options-component")
export default class Options extends OverlayComponent {
  static styles = css`
    ${unsafeCSS(styles)}
  `;

  @property({ type: Object }) game!: GameView;

  @property({ type: Object }) eventBus!: EventBus;

  @state() private showPauseButton = false;
  @state() private isPaused = false;
  @state() private showSettings = false;
  @state() private alternateView = false;
  @state() private timer = 0;
  @state() private _showOnStart = false;

  private userSettings = new UserSettings();
  private hasWinner = false;

  updated(changed: Map<string, unknown>): void {
    if (changed.has("game")) {
      this.init();
    }
  }

  public tick(): void {
    if (!this._showOnStart) {
      this._showOnStart = true;
      this.show();
    } else {
      if (!this.hasWinner) {
        this.hasWinner =
          (this.game.updatesSinceLastTick()[GameUpdateType.Win] || []).length >
          0;
      }

      if (this.game.inSpawnPhase()) {
        this.timer = 0;
      } else if (!this.hasWinner && this.game.ticks() % 10 === 0) {
        this.timer++;
      }
    }
  }

  renderComponent = (): TemplateResult => html`
    <ul class="options" @contextmenu=${(e: Event) => e.preventDefault()}>
      ${this.showPauseButton
        ? html`
            <li
              @click=${() => this.togglePause()}
              title=${translateText(
                this.isPaused ? "options.resume" : "options.pause",
              )}
            >
              ${this.isPaused ? resumeIcon() : pauseIcon()}
            </li>
          `
        : null}
      <li class="timer">${secondsToHms(this.timer)}</li>
      <li
        @click=${() => this.exitGame()}
        title=${translateText("options.quit")}
      >
        ${closeIcon()}
      </li>
      <li class="settings">
        <span @click=${() => this.toggleSettingsMenu()}>
          ${settingsIcon()}
        </span>
        ${this.showSettings
          ? html`
              <ul
                class="dropdown-menu"
                @click=${(e: MouseEvent) => e.stopPropagation()}
              >
                ${this.settingsItems().map(
                  (item) => html`
                    <li
                      @click=${item.action}
                      title=${translateText(item.label)}
                    >
                      ${item.content()}
                    </li>
                  `,
                )}
              </ul>
            `
          : null}
      </li>
    </ul>
  `;

  private init(): void {
    this.showPauseButton =
      this.game.config().gameConfig().gameType === GameType.Singleplayer;
    this.isPaused = false;
    this.showSettings = false;
    this.alternateView = false;
    this.timer = 0;
    this.hasWinner = false;
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    this.eventBus.emit(new PauseGameEvent(this.isPaused));
  }

  private exitGame(): void {
    const player = this.game.myPlayer();
    if (player?.isAlive()) {
      const confirmQuit = confirm(translateText("options.quit_confirm"));
      if (!confirmQuit) {
        return;
      }
    }
    window.location.href = "/";
  }

  private toggleSettingsMenu(): void {
    this.showSettings = !this.showSettings;
    this.requestUpdate();
  }

  private toggleTerrain(): void {
    this.alternateView = !this.alternateView;
    this.eventBus.emit(new AlternateViewEvent(this.alternateView));
    this.requestUpdate();
  }

  private toggleEmojis(): void {
    this.userSettings.toggleEmojis();
    this.requestUpdate();
  }

  private toggleDarkMode(): void {
    this.userSettings.toggleDarkMode();
    this.eventBus.emit(new RefreshGraphicsEvent());
    this.requestUpdate();
  }

  private toggleLeftClickBehavior(): void {
    this.userSettings.toggleLeftClickOpenMenu();
    this.requestUpdate();
  }

  private toggleFocusLock(): void {
    this.userSettings.toggleFocusLocked();
    this.requestUpdate();
  }

  private settingsItems() {
    return [
      {
        action: () => this.toggleTerrain(),
        label: "options.toggle_terrain",
        content: () =>
          `🌲: ${this.alternateView ? translateText("options.on") : translateText("options.off")}`,
      },
      {
        action: () => this.toggleEmojis(),
        label: "options.toggle_emojis",
        content: () =>
          `🙂: ${this.userSettings.emojis() ? translateText("options.on") : translateText("options.off")}`,
      },
      {
        action: () => this.toggleDarkMode(),
        label: "options.toggle_dark_mode",
        content: () =>
          `🌙: ${this.userSettings.darkMode() ? translateText("options.on") : translateText("options.off")}`,
      },
      {
        action: () => this.toggleLeftClickBehavior(),
        label: "options.toggle_attack.title",
        content: () =>
          `🖱️: ${this.userSettings.leftClickOpensMenu() ? translateText("options.toggle_attack.menu") : translateText("options.toggle_attack.attack")}`,
      },
      {
        action: () => this.toggleFocusLock(),
        label: "options.toggle_focus.title",
        content: () =>
          `🗺: ${this.userSettings.focusLocked() ? translateText("options.toggle_focus.lock") : translateText("options.toggle_focus.hover")}`,
      },
    ];
  }
}
