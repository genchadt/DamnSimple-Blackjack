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

    /**
     * Constructor for the game.
     * Gets the canvas element, initializes the Babylon engine, creates the game scene, and starts the render loop.
     * Also handles browser resize events.
     */
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

    /**
     * Initializes and starts the game scene.
     * Sets the current scene to "game" and creates a new GameScene instance,
     * passing the engine, canvas, and a callback function to open the settings.
     */
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

    /**
     * Opens the settings scene.
     * This method initializes the settings scene, allowing the user to adjust game settings.
     */
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
    
    /**
     * Closes the settings scene and returns to the game scene.
     * Called from the settings scene when the user clicks the "Back" button.
     * Updates the game UI to reflect any changes made in the settings scene.
     */
    private closeSettings(): void {
        console.log("Closing settings");
        this.currentScene = "game";
        
        // Update the game UI to reflect any changes
        if (this.gameScene) {
            this.gameScene.update();
        }
    }
    
    /**
     * Resets the player's funds to the default amount.
     * This method is called from the settings scene when the user clicks the "Reset Funds" button.
     * It resets the player's funds in the game scene's BlackjackGame object.
     */
    private resetFunds(): void {
        console.log("Resetting funds");
        if (this.gameScene) {
            this.gameScene.getBlackjackGame().resetFunds();
        }
    }
    
    /**
     * Changes the language of the game.
     * This method is called from the settings scene when the user selects a different language.
     * It sets the current language in the game scene's BlackjackGame object.
     * @param language The language to change to, e.g. "English", "Spanish", etc.
     */
    private changeLanguage(language: string): void {
        console.log(`Changing language to ${language}`);
        this.currentLanguage = language;
        // This would be implemented to handle language changes
    }
    
    /**
     * Changes the currency used in the game.
     * This method is called from the settings scene when the user selects a different currency.
     * It updates the currency sign in the game scene's GameUI object.
     * @param currency The currency to change to, e.g. "$", " ", etc.
     */
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
    
    /**
     * Returns the currency sign to be used in the game UI.
     * @returns The currency sign, e.g. "$", " ", etc.
     */
    public getCurrencySign(): string {
        return this.currencySign;
    }
}

// Start the game when the page loads
window.addEventListener("DOMContentLoaded", () => {
    console.log("DOM content loaded, creating game");
    new Game();
});
