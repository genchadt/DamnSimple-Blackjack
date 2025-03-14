// src/index.ts
import { Engine } from "@babylonjs/core";
import { MainMenuScene } from "./src/scenes/MainMenuScene";
import { GameScene } from "./src/scenes/GameScene";
import { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial";

// Required for GUI
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";

class Game {
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private mainMenuScene: MainMenuScene;
    private gameScene: GameScene | null = null;
    private currentScene: "menu" | "game" = "menu";

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
        
        // Create the main menu scene
        this.mainMenuScene = new MainMenuScene(this.engine, this.canvas, () => this.startGame());
        console.log("Main menu scene created");
        
        // Run the render loop
        this.engine.runRenderLoop(() => {
            if (this.currentScene === "menu") {
                this.mainMenuScene.getScene().render();
            } else if (this.gameScene) {
                this.gameScene.getScene().render();
            }
        });
        
        // Handle browser resize
        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }

    private startGame(): void {
        console.log("Starting game");
        // Create the game scene
        this.gameScene = new GameScene(this.engine, this.canvas);
        this.currentScene = "game";
    }
}

// Start the game when the page loads
window.addEventListener("DOMContentLoaded", () => {
    console.log("DOM content loaded, creating game");
    new Game();
});
