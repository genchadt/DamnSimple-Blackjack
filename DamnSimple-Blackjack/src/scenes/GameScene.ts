// src/scenes/gamescene-ts (Updated TableEnvironment instantiation)
import { Scene, Engine, Vector3 } from "@babylonjs/core";
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
        // 1. Core Game Logic (loads state)
        this.blackjackGame = new BlackjackGame();

        // 2. Visualizers (depend on scene, game logic) - Create CardVisualizer first
        //    It needs the deck position *conceptually*, but TableEnvironment uses its constants.
        //    We pass a temporary deck position, TableEnvironment will use constants.
        const tempDeckPos = new Vector3(3.5, 0, 0); // Temporary, Y will be adjusted
        this.cardVisualizer = new CardVisualizer(
            this.scene,
            this.blackjackGame,
            tempDeckPos
        );

        // 3. Environment (depends on scene, needs CardVisualizer for deck material)
        this.tableEnvironment = new TableEnvironment(this.scene, this.cardVisualizer); // Pass CardVisualizer

        // 4. UI (depends on scene, game logic, needs callbacks)
        this.gameUI = new GameUI(
            this.scene,
            this.blackjackGame,
            onOpenSettings,
            this.clearTable.bind(this)
        );

        // 5. Controller (depends on all above, orchestrates interactions)
        this.gameController = new GameController(
            this.scene,
            this.blackjackGame,
            this.gameUI,
            this.cardVisualizer
        );

        // 6. Debug Manager (optional)
        this.debugManager = new DebugManager(this, this.cardVisualizer);


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
