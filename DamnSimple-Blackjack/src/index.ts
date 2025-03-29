// src/index.ts
// Added loading indicator hiding
import { Engine } from "@babylonjs/core/Engines/engine"; // Corrected import path
import { GameScene } from "./scenes/GameScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { Scene } from "@babylonjs/core/scene"; // Import Scene

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

        try {
            this.engine = new Engine(this.canvas, true, { stencil: true, preserveDrawingBuffer: true }, true); // Added options
            console.log("[Game] Engine created");

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
                // Apply currency sign if needed after scene creation
                this.applyCurrencySign();
                console.log("[Game] GameScene created and set as active.");
            } else if (newSceneType === "settings") {
                 console.log("[Game] Creating new SettingsScene...");
                this.settingsScene = new SettingsScene(
                    this.engine, this.canvas,
                    () => this.closeSettings(),
                    () => this.resetFunds(),
                    (lang) => this.changeLanguage(lang),
                    (currency) => this.changeCurrency(currency)
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
