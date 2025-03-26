// src/scenes/gamescene-ts (Initializes components correctly)
import { Scene, Engine } from "@babylonjs/core";
import { BlackjackGame } from "../game/BlackjackGame";
import { GameUI } from "../ui/GameUI";
import { DebugManager } from "../debug/DebugManager";
import { TableEnvironment } from "./components/TableEnvironment";
import { CardVisualizer } from "./components/CardVisualizer";
import { GameController } from "./components/GameController";

export class GameScene {
    private scene: Scene;
    private blackjackGame: BlackjackGame;
    private gameUI: GameUI;
    private debugManager: DebugManager; // Keep for debugging
    private tableEnvironment: TableEnvironment;
    private cardVisualizer: CardVisualizer;
    private gameController: GameController;
    private engine: Engine; // Keep engine reference for disposal

    constructor(engine: Engine, canvas: HTMLCanvasElement, onOpenSettings: () => void) {
        console.log("GameScene constructor called");
        this.engine = engine;
        this.scene = new Scene(engine);

        // --- Order of Initialization ---
        // 1. Core Game Logic (loads state)
        this.blackjackGame = new BlackjackGame();

        // 2. Environment (static elements)
        this.tableEnvironment = new TableEnvironment(this.scene);

        // 3. Visualizers (depend on scene, game logic, environment)
        this.cardVisualizer = new CardVisualizer(
            this.scene,
            this.blackjackGame,
            this.tableEnvironment.getDeckPosition()
            // Callback set by GameController later
        );

        // 4. UI (depends on scene, game logic, needs callbacks)
        this.gameUI = new GameUI(
            this.scene,
            this.blackjackGame,
            onOpenSettings,
            this.clearTable.bind(this) // Pass clearTable callback
        );

        // 5. Controller (depends on all above, orchestrates interactions)
        this.gameController = new GameController(
            this.scene,
            this.blackjackGame,
            this.gameUI,
            this.cardVisualizer
        );

        // 6. Debug Manager (optional, depends on scene, game, visualizer, UI)
        this.debugManager = new DebugManager(this, this.cardVisualizer);


        // Initial update is handled within GameController constructor after potential restore
        console.log("GameScene construction complete.");
    }

    // clearTable is now primarily called by GameUI/GameController actions
    public clearTable(): void {
        // Delegate clearing visuals to the controller/visualizer
        this.gameController.clearTable();
    }

    /**
     * Updates the game state and UI via the controller.
     */
    public update(): void {
        // Delegate update logic to the controller
        this.gameController.update();
    }

    // --- Getters ---
    public getGameUI(): GameUI {
        return this.gameUI;
    }

    public getScene(): Scene {
        return this.scene;
    }

    public getBlackjackGame(): BlackjackGame {
        return this.blackjackGame;
    }

     /**
      * Disposes of the scene and its resources.
      */
     public dispose(): void {
         console.log("Disposing GameScene");
         // Dispose UI first
         this.gameUI?.dispose(); // Add dispose method to GameUI if needed

         // Dispose other components
         // this.debugManager?.dispose(); // Add dispose if needed
         // this.cardVisualizer?.dispose(); // Add dispose if needed
         this.tableEnvironment?.getScene()?.dispose(); // Dispose environment scene elements? Or just scene below?

         // Dispose the main scene
         this.scene.dispose();
         console.log("GameScene disposed.");
     }
}
