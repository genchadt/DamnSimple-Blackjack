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

    private hideLoading(): void {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'none';
        }
    }

    private showError(message: string): void {
        if (this.loadingIndicator) {
            this.loadingIndicator.innerText = `Error: ${message}`;
            this.loadingIndicator.style.color = 'red';
            this.loadingIndicator.style.display = 'block';
        }
        console.error(`[Game] Error: ${message}`);
    }

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

    private startGame(): void {
        console.info("[Game] Starting game (switching to game scene).");
        this.switchScene("game");
    }

    public openSettings(): void {
        console.info("[Game] Opening settings (switching to settings scene).");
        this.switchScene("settings");
    }

    private closeSettings(): void {
        console.info("[Game] Closing settings (switching back to game scene).");
        this.switchScene("game");
    }

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

    private changeLanguage(language: string): void {
        console.info(`[Game] Changing language to ${language}`);
        this.currentLanguage = language;
        console.warn("[Game] Language change functionality not fully implemented.");
    }

    private changeCurrency(currency: string): void {
        console.info(`[Game] Changing currency to ${currency}`);
        this.currencySign = currency;
        this.applyCurrencySign();
    }

    /**
     * Changes the graphics quality setting.
     * @param level The new quality level.
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
     * Changes the UI scale setting.
     * @param level The new UI scale level.
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
