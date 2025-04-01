// src/scenes/gamescene-ts
// Use constants and pass correct XZ vector
import { Scene, Engine, Vector3 } from "@babylonjs/core";
import { BlackjackGame } from "../game/BlackjackGame";
import { GameUI } from "../ui/GameUI";
import { DebugManager } from "../debug/DebugManager";
import { TableEnvironment } from "./components/TableEnvironment";
import { CardVisualizer } from "./components/CardVisualizer";
import { GameController } from "./components/GameController";
import { Constants, DefaultDeckPositionXZ } from "../Constants"; // *** IMPORT Constants and DefaultDeckPositionXZ ***

export class GameScene {
    private scene: Scene;
    private blackjackGame: BlackjackGame;
    private gameUI: GameUI;
    private debugManager: DebugManager;
    private tableEnvironment: TableEnvironment;
    private cardVisualizer: CardVisualizer;
    private gameController: GameController;
    private engine: Engine;

    constructor(engine: Engine, canvas: HTMLCanvasElement, onOpenSettings: () => void) {
        console.log("GameScene constructor called");
        this.engine = engine;
        this.scene = new Scene(engine);

        // --- Order of Initialization ---
        // 1. Core Game Logic
        console.log("[GS] Creating BlackjackGame...");
        this.blackjackGame = new BlackjackGame();
        console.log("[GS] BlackjackGame created.");

        // 2. Visualizers (needs scene, game logic, conceptual deck position XZ)
        //    Pass the default XZ position from constants.
        console.log("[GS] Creating CardVisualizer...");
        this.cardVisualizer = new CardVisualizer(
            this.scene,
            this.blackjackGame,
            DefaultDeckPositionXZ // Pass the XZ vector from constants
        );
        console.log("[GS] CardVisualizer created.");


        // 3. Environment (needs scene, needs CardVisualizer for deck box creation)
        console.log("[GS] Creating TableEnvironment...");
        // TableEnvironment constructor will use its internal deckPosition (from Constants)
        // and create the visual box there using CardVisualizer.
        this.tableEnvironment = new TableEnvironment(this.scene, this.cardVisualizer);
        console.log("[GS] TableEnvironment created.");


        // 4. UI (depends on scene, game logic, needs callbacks)
        console.log("[GS] Creating GameUI...");
        this.gameUI = new GameUI(
            this.scene,
            this.blackjackGame,
            onOpenSettings,
            this.clearTable.bind(this)
        );
        console.log("[GS] GameUI created.");

        // 5. Controller (depends on all above, orchestrates interactions)
        console.log("[GS] Creating GameController...");
        this.gameController = new GameController(
            this.scene,
            this.blackjackGame,
            this.gameUI,
            this.cardVisualizer
        );
        console.log("[GS] GameController created.");

        // 6. Debug Manager (optional)
        console.log("[GS] Creating DebugManager...");
        this.debugManager = new DebugManager(this, this.cardVisualizer);
        console.log("[GS] DebugManager created.");


        console.log("GameScene construction complete.");
        // Initial update/restore logic is handled within GameController constructor
    }

    public clearTable(): void {
        this.gameController.clearTable();
    }

    public update(): void {
        this.gameController.update();
    }

    // --- Getters ---
    public getGameUI(): GameUI { return this.gameUI; }
    public getScene(): Scene { return this.scene; }
    public getBlackjackGame(): BlackjackGame { return this.blackjackGame; }

     public dispose(): void {
         console.log("Disposing GameScene");
         this.gameUI?.dispose();
         // this.debugManager?.dispose(); // Assuming no specific dispose needed for DebugManager
         this.cardVisualizer?.clearTable(); // Clear visuals before disposing scene elements
         this.tableEnvironment?.dispose(); // Dispose table, deck visuals etc.
         this.scene.dispose(); // Dispose the Babylon scene itself
         console.log("GameScene disposed.");
     }
}
