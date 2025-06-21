// src/index.ts
// Added loading indicator hiding
import { Engine } from "@babylonjs/core/Engines/engine"; // Corrected import path
import { GameScene } from "./scenes/GameScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { Scene } from "@babylonjs/core/scene"; // Import Scene
import { GameStorage } from "./game/GameStorage";
import { QualityLevel, QualitySettings, UIScaleLevel, UIScaleSettings, DEFAULT_UI_SCALE_LEVEL } from "./Constants";

// Required for GUI and Inspector
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import "@babylonjs/gui"; // Ensure GUI is imported

class Game {
    private canvas: HTMLCanvasElement;
    private engine!: Engine;
    private gameScene: GameScene | null = null;
    private settingsScene: SettingsScene | null = null;
    private currentSceneInstance: Scene | null = null; // Store the active Scene object
    private currentSceneType: "game" | "settings" | "none" = "none";
    private currentLanguage: string = "english";
    private currencySign: string = "$";
    private currentQualityLevel: QualityLevel;
    private currentUIScaleLevel: UIScaleLevel; // *** ADDED ***
    private loadingIndicator: HTMLElement | null;

    /**
     * Creates a new Game instance.
     *
     * Loads the current quality level and UI scale level from storage.
     * Creates a new Babylon engine and applies the current graphics quality settings.
     * Creates the initial GameScene and starts the game loop.
     *
     * @throws {Error} If the canvas element is not found, or if the engine cannot be initialized.
     */
    constructor() {
        console.info("[Game] Constructor called");
        this.loadingIndicator = document.getElementById("loadingIndicator");

        const canvas = document.getElementById("renderCanvas");
        if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
            this.showError("Canvas element not found or is not a canvas");
            throw new Error("Canvas element not found or is not a canvas");
        }
        this.canvas = canvas;

        this.currentQualityLevel = GameStorage.loadQualityLevel();
        this.currentUIScaleLevel = GameStorage.loadUIScaleLevel(); // *** ADDED ***

        try {
            this.engine = new Engine(this.canvas, true, { stencil: true, preserveDrawingBuffer: true }, true);
            console.info("[Game] Engine created");

            this.applyGraphicsQualitySettings(this.currentQualityLevel, false); // Apply without saving again
            // UI Scale is applied when GameScene/GameUI is created/switched to

            (window as any).engine = this.engine;

            this.startGame();

            this.engine.runRenderLoop(() => {
                if (this.currentSceneInstance) {
                    this.currentSceneInstance.render();
                }
            });

            window.addEventListener("resize", () => {
                this.engine.resize();
            });

        } catch (e) {
            this.showError(`Error initializing Babylon engine: ${e}`);
            console.error("Engine Initialization Error:", e);
        }
    }


    /**
     * Hides the loading indicator.
     *
     * If the loading indicator element was found at initialization,
     * this sets its display style to 'none'.
     */
    private hideLoading(): void {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'none';
        }
    }

    /**
     * Shows an error message.
     *
     * If the loading indicator element was found at initialization,
     * this sets its text content to the given message, sets its
     * color to red, and makes it visible.
     *
     * Additionally logs the error to the console.
     *
     * @param message The error message to display
     */
    private showError(message: string): void {
        if (this.loadingIndicator) {
            this.loadingIndicator.innerText = `Error: ${message}`;
            this.loadingIndicator.style.color = 'red';
            this.loadingIndicator.style.display = 'block';
        }
        console.error(`[Game] Error: ${message}`);
    }

    /**
     * Switches the current scene to a new one.
     *
     * The scene can be either a GameScene or a SettingsScene.
     * If the current scene is not null, it is disposed of before creating the new scene.
     * The new scene is created and set as active.
     * The current graphics quality and UI scale are applied to the new GameScene.
     * The loading indicator is hidden when the new scene is ready.
     *
     * @param newSceneType The type of the new scene to create and set as active.
     *     Must be either "game" or "settings".
     */
    private switchScene(newSceneType: "game" | "settings"): void {
        console.info(`[Game] Switching scene from ${this.currentSceneType} to ${newSceneType}`);

        if (this.currentSceneInstance) {
            console.info(`[Game] Disposing previous scene (${this.currentSceneType})`);
            if (this.currentSceneType === "game" && this.gameScene) {
                this.gameScene.dispose();
                this.gameScene = null;
            } else if (this.currentSceneType === "settings" && this.settingsScene) {
                this.settingsScene.dispose();
                this.settingsScene = null;
            }
            this.currentSceneInstance = null;
        }

        try {
            if (newSceneType === "game") {
                console.info("[Game] Creating new GameScene...");
                this.gameScene = new GameScene(this.engine, this.canvas, () => this.openSettings());
                this.currentSceneInstance = this.gameScene.getScene();
                this.currentSceneType = "game";
                this.applyCurrencySign();
                this.gameScene.applyGraphicsQualitySetting(this.currentQualityLevel); // Apply current graphics quality
                this.gameScene.applyUIScaleSetting(this.currentUIScaleLevel); // *** ADDED: Apply UI Scale ***
                console.info("[Game] GameScene created and set as active.");
            } else if (newSceneType === "settings") {
                console.info("[Game] Creating new SettingsScene...");
                this.settingsScene = new SettingsScene(
                    this.engine, this.canvas,
                    () => this.closeSettings(),
                    () => this.resetFunds(),
                    (lang) => this.changeLanguage(lang),
                    (currency) => this.changeCurrency(currency),
                    (level) => this.changeGraphicsQuality(level),
                    this.currentQualityLevel,
                    (level) => this.changeUIScale(level), // *** ADDED: Pass UI Scale handler ***
                    this.currentUIScaleLevel // *** ADDED: Pass current UI Scale ***
                );
                this.currentSceneInstance = this.settingsScene.getScene();
                this.currentSceneType = "settings";
                console.info("[Game] SettingsScene created and set as active.");
            }

            if (this.currentSceneInstance) {
                this.currentSceneInstance.executeWhenReady(() => {
                    this.hideLoading();
                    console.info(`[Game] Scene (${this.currentSceneType}) is ready.`);
                });
            }

        } catch (e) {
            this.showError(`Error creating ${newSceneType} scene: ${e}`);
            console.error(`Scene Creation Error (${newSceneType}):`, e);
        }
    }

    /**
     * Starts the game by switching to the game scene.
     *
     * This simply calls `switchScene("game")` to switch to the game scene.
     */
    private startGame(): void {
        console.info("[Game] Starting game (switching to game scene).");
        this.switchScene("game");
    }

    /**
     * Opens the settings scene.
     *
     * This method switches the current scene to the settings scene,
     * logging the action and updating the scene state accordingly.
     */
    public openSettings(): void {
        console.info("[Game] Opening settings (switching to settings scene).");
        this.switchScene("settings");
    }

    /**
     * Closes the settings scene.
     *
     * This method switches the current scene back to the game scene,
     * logging the action and updating the scene state accordingly.
     */
    private closeSettings(): void {
        console.info("[Game] Closing settings (switching back to game scene).");
        this.switchScene("game");
    }

    /**
     * Resets the player's funds to the default amount.
     *
     * This method logs the request and checks if the GameScene is active.
     * If it is, it calls `resetFunds()` on the BlackjackGame instance,
     * logs this action, and updates the GameScene to reflect the change.
     * If not, it logs a warning that the GameScene is not active.
     */
    private resetFunds(): void {
        console.info("[Game] Resetting funds request.");
        if (this.gameScene) {
            this.gameScene.getBlackjackGame().resetFunds();
            console.info("[Game] Funds reset in BlackjackGame instance.");
            this.gameScene.update();
        } else {
            console.warn("[Game] Cannot reset funds: GameScene not active.");
        }
    }

    /**
     * Changes the language setting.
     *
     * This method logs the request and checks if the language is valid.
     * If it is, it updates the current language setting and logs the change.
     * If not, it logs a warning that the language is not valid.
     *
     * @param language The new language.
     */
    private changeLanguage(language: string): void {
        console.info(`[Game] Changing language to ${language}`);
        this.currentLanguage = language;
        console.warn("[Game] Language change functionality not fully implemented.");
    }

    /**
     * Changes the currency setting.
     *
     * This method logs the request and updates the currency setting.
     * It also applies the new currency sign to the active GameScene
     * by calling `applyCurrencySign()`.
     *
     * @param currency The new currency.
     */
    private changeCurrency(currency: string): void {
        console.info(`[Game] Changing currency to ${currency}`);
        this.currencySign = currency;
        this.applyCurrencySign();
    }

    /**
     * Updates the graphics quality level if it has changed and applies the new settings.
     *
     * This method logs the change in graphics quality level and applies the new settings
     * to the game engine. If the current scene is the GameScene, it also updates the
     * graphics quality settings for the active scene.
     *
     * @param level The new graphics quality level to apply.
     */
    private changeGraphicsQuality(level: QualityLevel): void {
        if (this.currentQualityLevel === level) return;
        console.info(`[Game] Changing graphics quality from ${this.currentQualityLevel} to ${level}`);
        this.applyGraphicsQualitySettings(level, true);

        if (this.currentSceneType === "game" && this.gameScene) {
            console.info("[Game] Applying graphics quality setting to active GameScene.");
            this.gameScene.applyGraphicsQualitySetting(level);
        }
    }

    /**
     * Applies graphics quality settings to the engine and saves the choice.
     * @param level The quality level to apply.
     * @param save Whether to save the setting to storage.
     */
    private applyGraphicsQualitySettings(level: QualityLevel, save: boolean): void {
        this.currentQualityLevel = level;
        const settings = QualitySettings[level];

        // Hardware scaling is no longer part of graphics quality to decouple it from UI rendering.
        // This call affected the entire canvas resolution, including UI elements.
        // this.engine.setHardwareScalingLevel(settings.scaling);
        console.info(`[Game] Applied graphics quality setting: ${level} (Texture Size: ${settings.textureSize})`);

        if (save) {
            GameStorage.saveQualityLevel(level);
        }
    }

    /**
     * Updates the UI scale setting to the given level, saving the setting and applying it to the active scene if applicable.
     *
     * If the current scene is the game scene, this method tells it to update its UI scale.
     * If the current scene is the settings scene, the new scale will be applied on the next switch.
     *
     * @param level The new UI scale level to apply.
     */
    private changeUIScale(level: UIScaleLevel): void {
        if (this.currentUIScaleLevel === level) return;
        console.info(`[Game] Changing UI scale from ${this.currentUIScaleLevel} to ${level}`);
        this.currentUIScaleLevel = level;
        GameStorage.saveUIScaleLevel(level); // Save setting

        // If the game scene is active, tell it to update its UI scale
        if (this.currentSceneType === "game" && this.gameScene) {
            console.info("[Game] Applying UI scale setting to active GameScene.");
            this.gameScene.applyUIScaleSetting(level);
        }
        // If settings scene is active, it will be recreated on switch, applying new scale then.
    }

    /**
     * Applies the current currency sign to the GameUI.
     *
     * This method checks if the current scene is the game scene and,
     * if so, retrieves the GameUI instance to apply the current currency
     * sign. Logs the application process or warns if the GameUI is not found.
     */
    private applyCurrencySign(): void {
        if (this.currentSceneType === "game" && this.gameScene) {
            const gameUI = this.gameScene.getGameUI();
            if (gameUI) {
                console.info(`[Game] Applying currency sign '${this.currencySign}' to GameUI.`);
                gameUI.setCurrencySign(this.currencySign);
            } else {
                console.warn("[Game] Tried to apply currency sign, but GameUI not found in GameScene.");
            }
        }
    }

    /**
     * Gets the current currency sign.
     *
     * @returns The current currency sign, for example "$" or "€".
     */
    public getCurrencySign(): string {
        return this.currencySign;
    }
}

window.addEventListener("DOMContentLoaded", () => {
    console.info("[DOM] DOM content loaded, creating game...");
    try {
        new Game();
    } catch (e) {
        console.error("[DOM] Error during Game instantiation:", e);
        const loadingIndicator = document.getElementById("loadingIndicator");
        if (loadingIndicator) {
            loadingIndicator.innerText = `Fatal Error: Could not initialize game. Check console.`;
            loadingIndicator.style.color = 'red';
            loadingIndicator.style.display = 'block';
        }
    }
});
