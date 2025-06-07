// src/index.ts
// Added loading indicator hiding
import { Engine } from "@babylonjs/core/Engines/engine"; // Corrected import path
import { GameScene } from "./scenes/GameScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { Scene } from "@babylonjs/core/scene"; // Import Scene
import { GameStorage } from "./game/GameStorage"; // *** ADDED ***
import { QualityLevel, QualitySettings } from "./Constants"; // *** ADDED ***

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
    private currentQualityLevel: QualityLevel; // *** ADDED ***
    private loadingIndicator: HTMLElement | null;

    constructor() {
        console.log("[Game] Constructor called");
        this.loadingIndicator = document.getElementById("loadingIndicator");

        const canvas = document.getElementById("renderCanvas");
        if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
            this.showError("Canvas element not found or is not a canvas");
            throw new Error("Canvas element not found or is not a canvas");
        }
        this.canvas = canvas;

        // *** ADDED: Load quality setting before creating engine ***
        this.currentQualityLevel = GameStorage.loadQualityLevel();

        try {
            this.engine = new Engine(this.canvas, true, { stencil: true, preserveDrawingBuffer: true }, true); // Added options
            console.log("[Game] Engine created");

            // *** ADDED: Apply loaded quality setting to engine ***
            this.applyQualitySettings(this.currentQualityLevel, false); // Apply without saving again

            // Expose engine globally for debugging if needed
            (window as any).engine = this.engine;

            // Start the game directly
            this.startGame();

            // Run the render loop
            this.engine.runRenderLoop(() => {
                if (this.currentSceneInstance) {
                    this.currentSceneInstance.render();
                } else {
                    // console.warn("[Game] Render loop running but no active scene.");
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
        console.log(`[Game] Switching scene from ${this.currentSceneType} to ${newSceneType}`);

        // Dispose previous scene if it exists
        if (this.currentSceneInstance) {
            console.log(`[Game] Disposing previous scene (${this.currentSceneType})`);
            if (this.currentSceneType === "game" && this.gameScene) {
                this.gameScene.dispose();
                this.gameScene = null;
            } else if (this.currentSceneType === "settings" && this.settingsScene) {
                this.settingsScene.dispose();
                this.settingsScene = null;
            }
            this.currentSceneInstance = null;
        }

        // Create and set the new scene
        try {
            if (newSceneType === "game") {
                console.log("[Game] Creating new GameScene...");
                this.gameScene = new GameScene(this.engine, this.canvas, () => this.openSettings());
                this.currentSceneInstance = this.gameScene.getScene();
                this.currentSceneType = "game";
                // Apply settings after scene creation
                this.applyCurrencySign();
                // Apply quality setting to the new GameScene's components
                this.gameScene.applyQualitySetting(this.currentQualityLevel);
                console.log("[Game] GameScene created and set as active.");
            } else if (newSceneType === "settings") {
                console.log("[Game] Creating new SettingsScene...");
                this.settingsScene = new SettingsScene(
                    this.engine, this.canvas,
                    () => this.closeSettings(),
                    () => this.resetFunds(),
                    (lang) => this.changeLanguage(lang),
                    (currency) => this.changeCurrency(currency),
                    (level) => this.changeQuality(level), // Pass quality change handler
                    this.currentQualityLevel // Pass current quality level
                );
                this.currentSceneInstance = this.settingsScene.getScene();
                this.currentSceneType = "settings";
                console.log("[Game] SettingsScene created and set as active.");
            }

            // Hide loading indicator once the first scene is ready
            if (this.currentSceneInstance) {
                this.currentSceneInstance.executeWhenReady(() => {
                    this.hideLoading();
                    console.log(`[Game] Scene (${this.currentSceneType}) is ready.`);
                });
            }

        } catch (e) {
            this.showError(`Error creating ${newSceneType} scene: ${e}`);
            console.error(`Scene Creation Error (${newSceneType}):`, e);
        }
    }

    private startGame(): void {
        console.log("[Game] Starting game (switching to game scene).");
        this.switchScene("game");
    }

    public openSettings(): void {
        console.log("[Game] Opening settings (switching to settings scene).");
        this.switchScene("settings");
    }

    private closeSettings(): void {
        console.log("[Game] Closing settings (switching back to game scene).");
        this.switchScene("game");
        // Update game UI after returning (handled by applyCurrencySign in switchScene)
    }

    private resetFunds(): void {
        console.log("[Game] Resetting funds request.");
        // Ensure we are in the game scene logic context when resetting
        if (this.gameScene) {
            this.gameScene.getBlackjackGame().resetFunds();
            console.log("[Game] Funds reset in BlackjackGame instance.");
            // Optionally update UI immediately if needed, though switching back will update it
            this.gameScene.update();
        } else {
            console.warn("[Game] Cannot reset funds: GameScene not active.");
            // If settings needs direct access, PlayerFunds would need static methods or event bus
        }
    }

    private changeLanguage(language: string): void {
        console.log(`[Game] Changing language to ${language}`);
        this.currentLanguage = language;
        // TODO: Implement actual language change logic (e.g., update UI text)
        console.warn("[Game] Language change functionality not fully implemented.");
    }

    private changeCurrency(currency: string): void {
        console.log(`[Game] Changing currency to ${currency}`);
        this.currencySign = currency;
        // Apply the change to the game UI if it's active
        this.applyCurrencySign();
    }

    /**
     * Changes the graphics quality setting.
     * @param level The new quality level.
     */
    private changeQuality(level: QualityLevel): void {
        if (this.currentQualityLevel === level) return; // No change
        console.log(`[Game] Changing quality from ${this.currentQualityLevel} to ${level}`);
        this.applyQualitySettings(level, true); // Apply and save

        // If the game scene is active, tell it to update its visuals
        if (this.currentSceneType === "game" && this.gameScene) {
            console.log("[Game] Applying quality setting to active GameScene.");
            this.gameScene.applyQualitySetting(level);
        }
    }

    /**
     * Applies quality settings to the engine and saves the choice.
     * @param level The quality level to apply.
     * @param save Whether to save the setting to storage.
     */
    private applyQualitySettings(level: QualityLevel, save: boolean): void {
        this.currentQualityLevel = level;
        const settings = QualitySettings[level];

        // Apply hardware scaling to the engine
        this.engine.setHardwareScalingLevel(settings.scaling);
        console.log(`[Game] Applied quality setting: ${level} (Scaling: ${settings.scaling}, Texture: ${settings.textureSize})`);

        if (save) {
            GameStorage.saveQualityLevel(level);
        }
    }

    private applyCurrencySign(): void {
        if (this.currentSceneType === "game" && this.gameScene) {
            const gameUI = this.gameScene.getGameUI();
            if (gameUI) {
                console.log(`[Game] Applying currency sign '${this.currencySign}' to GameUI.`);
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

// Start the game when the page loads
window.addEventListener("DOMContentLoaded", () => {
    console.log("[DOM] DOM content loaded, creating game...");
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
