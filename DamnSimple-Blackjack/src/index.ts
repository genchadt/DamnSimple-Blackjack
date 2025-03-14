// index-ts
import { Engine } from "@babylonjs/core";
import { MainMenuScene } from "./scenes/mainmenuscene-ts";
import { GameScene } from "./scenes/gamescene-ts";

// Required for GUI
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import { MultiMaterial } from "@babylonjs/core";

class Game {
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private mainMenuScene: MainMenuScene;
    private gameScene: GameScene | null = null;
    private currentScene: "menu" | "game" = "menu";

    constructor() {
        // Get the canvas element
        this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
        
        // Initialize the Babylon engine
        this.engine = new Engine(this.canvas, true);
        
        // Create the main menu scene
        this.mainMenuScene = new MainMenuScene(this.engine, this.canvas, () => this.startGame());
        
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
        // Create the game scene
        this.gameScene = new GameScene(this.engine, this.canvas);
        this.currentScene = "game";
    }
}

// Start the game when the page loads
window.addEventListener("DOMContentLoaded", () => {
    new Game();
});
