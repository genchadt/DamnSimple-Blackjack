// Updated index.ts
import { Engine } from "@babylonjs/core";
import { GameScene } from "./scenes/GameScene";
import { SettingsScene } from "./scenes/SettingsScene";

// Required for GUI
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";

class Game {
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private gameScene: GameScene | null = null;
    private settingsScene: SettingsScene | null = null;
    private currentScene: "game" | "settings" = "game";
    private currentLanguage: string = "english";
    private currencySign: string = "$";

    constructor() {
        console.log("Game constructor called");
        
        // Get the canvas element
        const canvas = document.getElementById("renderCanvas");
        if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
            console.error("Canvas element not found or is not a canvas");
            throw new Error("Canvas element not found or is not a canvas");
        }
        this.canvas = canvas;
        
        // Initialize the Babylon engine
        this.engine = new Engine(this.canvas, true);
        console.log("Engine created");
        
        // Create the game scene directly (skip main menu)
        this.startGame();
        
        // Run the render loop
        this.engine.runRenderLoop(() => {
            if (this.currentScene === "game" && this.gameScene) {
                this.gameScene.getScene().render();
            } else if (this.currentScene === "settings" && this.settingsScene) {
                this.settingsScene.getScene().render();
            }
        });
        
        // Handle browser resize
        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }

    private startGame(): void {
        console.log("Starting game");
        // Create the game scene with openSettings callback
        this.gameScene = new GameScene(
            this.engine, 
            this.canvas,
            () => this.openSettings()
        );
        this.currentScene = "game";
    }
    
    public openSettings(): void {
        console.log("Opening settings");
        // Create the settings scene
        this.settingsScene = new SettingsScene(
            this.engine, 
            this.canvas, 
            () => this.closeSettings(),
            () => this.resetFunds(),
            (lang) => this.changeLanguage(lang),
            (currency) => this.changeCurrency(currency)
        );
        this.currentScene = "settings";
    }
    
    private closeSettings(): void {
        console.log("Closing settings");
        this.currentScene = "game";
        
        // Update the game UI to reflect any changes
        if (this.gameScene) {
            this.gameScene.update();
        }
    }
    
    private resetFunds(): void {
        console.log("Resetting funds");
        if (this.gameScene) {
            this.gameScene.getBlackjackGame().resetFunds();
        }
    }
    
    private changeLanguage(language: string): void {
        console.log(`Changing language to ${language}`);
        this.currentLanguage = language;
        // This would be implemented to handle language changes
    }
    
    private changeCurrency(currency: string): void {
        console.log(`Changing currency to ${currency}`);
        this.currencySign = currency;
        
        // Update game UI with new currency sign
        if (this.gameScene) {
            const gameUI = this.gameScene.getGameUI();
            if (gameUI) {
                gameUI.setCurrencySign(currency);
            }
        }
    }
    
    public getCurrencySign(): string {
        return this.currencySign;
    }
}

// Start the game when the page loads
window.addEventListener("DOMContentLoaded", () => {
    console.log("DOM content loaded, creating game");
    new Game();
});
